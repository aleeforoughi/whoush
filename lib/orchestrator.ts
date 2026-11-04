import "server-only";
import {createHash,randomUUID} from "node:crypto";
import {buildProposal,NoCompatibleModelError} from "./agent";
import {CHARACTER_VIEWS,REQUIRED_CHARACTER_VIEWS} from "./characters";
import {CreativePlanSchema,CreativeTurnInputSchema,STYLE_VISUAL,toPublicPlan,type GenerationStyle,type PublicReference,PlannerInvalidOutputError,PlannerRefusedError,PlannerUnavailableError,type CreativePlan,type PlannerRequest,type PlannerResult,type PrivatePlanner,type PublicCreativePlan} from "./creative-plan";
import {llmPolicy,preparePrivateCreativeRequest} from "./llm";
import {defaultAuditSink,type PrivateAuditRecord,type PrivateAuditSink} from "./private-audit";
import {displayTag,inferAttachmentRoles,isMediaKind,parseMentions,rewriteMentions,roleLabelFa,type AttachmentKind,type AttachmentRole,type RoleSource} from "./attachments";
import {detectMediaKind,suggestModel} from "./router";
import {evaluateTextSafety,normalizePersian,type SafetyCategory} from "./safety";
import {SKILLS,SKILL_REGISTRY_VERSION} from "./skills";
import type {GenerationProposal,MediaRequirements,SuggestedModel} from "./types";
export type OrchestratorDeps={planner?:PrivatePlanner;audit?:PrivateAuditSink;now?:()=>Date};
export type OrchestratorResult=
 |{status:"planned";turnId:string;proposal:GenerationProposal;plan:PublicCreativePlan}
 |{status:"unsupported";turnId:string;plan:PublicCreativePlan;message:string;suggestedModel?:SuggestedModel}
 |{status:"restricted";decision:"block"|"review";category:SafetyCategory;message:string};
const FA_REFUSED="این درخواست در حال حاضر قابل پردازش نیست. لطفاً آن را با توضیح غیرحساس‌تر دوباره بنویس.";
const FA_NO_REFS="برنامه تولید با کاراکتر انتخاب‌شده آماده است، اما هنوز هیچ مدل تأییدشده‌ای عکس مرجع کاراکتر را نمی‌پذیرد؛ برای همین فعلاً پیشنهاد تولید و هزینه نمایش داده نمی‌شود.";
const FA_TEXT_BLOCKED="یکی از فایل‌های متنیِ پیوست‌شده مسدود شد. ";
const FA_MEDIA_REVIEW="برنامه آماده است، اما بررسی ایمنی فایل‌های تصویری، ویدیویی و صوتی هنوز فعال نیست؛ برای همین فعلاً پیشنهاد تولید و هزینه نمایش داده نمی‌شود.";
const FA_VOICE_CLONE="کلون صدا در هووش پشتیبانی نمی‌شود؛ هووش فقط تصویر و ویدیو می‌سازد و تولید یا شبیه‌سازی صدا ممکن نیست.";
const faMissing=(tags:readonly string[])=>tags.length===1?"پیوست "+displayTag(tags[0])+" در این گفت‌وگو پیدا نشد؛ آن را دوباره اضافه کن یا تگ را اصلاح کن.":"پیوست‌های "+tags.map(displayTag).join("، ")+" در این گفت‌وگو پیدا نشدند؛ آن‌ها را دوباره اضافه کن یا تگ‌ها را اصلاح کن.";
const faSuggestion=(m:SuggestedModel)=>" مدل مناسب این کار: "+m.name+"؛ پس از تأیید فعال می‌شود.";
const FA_PDF_NOTE="محتوای فایل PDF هنوز خوانده نمی‌شود و در برنامه اثری ندارد";
const lipsMsg="برنامه لیپ‌سینک آماده است، اما هنوز هیچ مدل تأییدشده‌ای هماهنگی لب را پشتیبانی نمی‌کند؛ برای همین فعلاً پیشنهاد تولید و هزینه نمایش داده نمی‌شود.";
// ---- deterministic planner (pure, no network): complete valid plan from the active skills ----
// Every customer-visible line is Persian. `mediaPrompt` (private, provider-facing) is English, so each phrase that feeds both
// is written as an {en, fa} pair: `.fa` goes into the public plan, `.en` into the prompt.
type Pair={en:string;fa:string};
const P=(en:string,fa:string):Pair=>({en,fa});
const faDigits=(s:string)=>s.replace(/\d/g,d=>"۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
const has=(p:string,w:RegExp)=>w.test(p);
const PORTRAIT=/\b(portrait|headshot|selfie|face|person|people|woman|man|girl|boy|bride|groom|model|child|presenter|speaker|host|singer|actor|actress)\b|lip sync|lipsync|پرتره|چهره|سلفی|عروس|داماد|دختر|پسر|زن|مرد|مدل|شخص|کودک/;
const NIGHT=/\b(night|neon|moonlit)\b|شب|نئون/;
const VERTICAL=/\b(reels?|tiktok|stor(y|ies)|vertical|shorts)\b|استوری|ریلز|تیک تاک|عمودی/;
const MOVES:ReadonlyArray<readonly [RegExp,Pair]>=[
 [/\b(drone|aerial)\b|پهپاد/,P("slow aerial glide forward","حرکت هوایی آرام رو به جلو")],
 [/\b(orbit|around)\b|چرخش/,P("slow orbit around the subject","چرخش آرام دور سوژه")],
 [/\b(pan)\b|پن/,P("slow horizontal pan","پن افقی آرام")],
 [/\b(static|locked|still camera)\b|ثابت/,P("locked-off tripod, no camera movement","سه‌پایهٔ ثابت، بدون حرکت دوربین")]
];
const DOLLY=P("slow dolly-in at walking pace","دالی‌این آرام با سرعت قدم زدن");
const viewTitles=(ids:readonly string[])=>ids.map(id=>CHARACTER_VIEWS.find(v=>v.id===id)?.title??id).join("، ");
const missingViews=(angles:readonly string[])=>REQUIRED_CHARACTER_VIEWS.filter(v=>!angles.includes(v));
const missingQuestion=(angles:readonly string[])=>{const m=missingViews(angles);return m.length?"زاویه‌های «"+viewTitles(m)+"» هنوز اضافه نشده‌اند و ساخته نمی‌شوند؛ ادامه بدهیم یا اول آن‌ها را اضافه می‌کنی؟":undefined;};
const fas=(l:readonly Pair[])=>l.map(x=>x.fa);
const ens=(l:readonly Pair[])=>l.map(x=>x.en);
// ---- the style chosen in the + menu ----
// realistic = photoreal (hyper_realism stays on); three_d and cartoon = stylized (hyper_realism off). The choice wins over `visualStyle` and over style words in the text.
const STYLE_PAIRS:Record<GenerationStyle,Pair>={
 realistic:P("realistic style: natural texture, light and color","سبک واقع‌گرایانه: بافت، نور و رنگ طبیعی"),
 three_d:P("3D render style: physically based materials, soft global illumination, clean shading","رندر سه‌بعدی تمیز با متریال فیزیکی، نور نرم و سایهٔ طبیعی؛ بدون بافت پوست عکاسی یا نویز"),
 cartoon:P("cartoon style: clean outlines, simplified shapes, harmonious vivid palette","سبک کارتونی: خطوط تمیز، فرم‌های ساده و پالت رنگی هماهنگ")
};
const STYLE_IDENTITY=P("The character's identity stays recognizable in the chosen style (a stylized identity, not a photographic one)","هویت کاراکتر در سبک انتخاب‌شده قابل تشخیص می‌ماند");
export function styleDirectives(style:GenerationStyle|undefined,hasCharacter:boolean):{hard:Pair[];soft:Pair[];directives:Pair[]}{
 if(!style)return {hard:[],soft:[],directives:[]};
 if(style==="realistic")return {hard:[],soft:[STYLE_PAIRS.realistic],directives:[]};
 return {hard:hasCharacter?[STYLE_IDENTITY]:[],soft:[],directives:[STYLE_PAIRS[style]]};
}
const hasCharacterRef=(req:PlannerRequest)=>Boolean(req.input.characterRef)||(req.attachments??[]).some(a=>a.kind==="image"&&a.role==="character");
// ---- attachment roles ----
// Each role adds a hard constraint, a continuity lock or a soft preference. The Persian half names the attachment as `#تصویر-۱` (`displayTag`); the English
// half uses the internal `@image1`, which `rewriteMentions` turns into an English description (`[reference image 1 · character]`) in the provider-facing prompt.
type Ref={tag:string;kind:AttachmentKind;role?:AttachmentRole};
const tagMap=(l:readonly Ref[]=[])=>new Map(l.map(a=>[a.tag,a]));
function roleRule(kind:AttachmentKind,role:AttachmentRole,tag:string):{hard?:Pair;soft?:Pair;lock?:Pair}{
 const at="@"+tag,fa=displayTag(tag);
 switch(role){
  case "character":return {hard:P(at+": preserve facial identity, hair, skin tone and body proportions exactly as in the reference",fa+": هویت چهره، مو، رنگ پوست و تناسب بدن مطابق مرجع حفظ شود")};
  case "start_frame":return {hard:P(at+": this image is the first frame of the video; its composition, subject and lighting are the starting point",fa+" فریم اول ویدیوست؛ ترکیب‌بندی، سوژه و نور همین عکس نقطهٔ شروع است")};
  case "end_frame":return {hard:P(at+": this image is the last frame of the video; the video ends on its composition, subject and lighting",fa+" فریم آخر ویدیوست؛ ویدیو با همین ترکیب‌بندی، سوژه و نور تمام می‌شود")};
  case "outfit":return {hard:P(at+": apply this outfit (design, color, fabric and cut) to the subject; do not copy the face or body of the model in the outfit photo","لباس و کفش "+fa+" (طرح، رنگ، جنس و برش) روی سوژه اعمال می‌شود؛ چهره و بدن مدلِ عکس مرجع کپی نمی‌شود"),
   soft:P("Clothing stays modest and non-provocative, in line with the content policy","پوشش مطابق سیاست محتوای هووش، پوشیده و غیرتحریک‌آمیز")};
  case "hairstyle":return {hard:P(at+": apply the hairstyle and, where present, the beard and moustache shape; the subject's face, skin tone and identity do not change","مدل مو و فرم ریش و سبیل "+fa+" (در صورت وجود) اعمال می‌شود؛ چهره، رنگ پوست و هویت سوژه تغییر نمی‌کند")};
  case "makeup":return {hard:P(at+": apply this makeup (colors and intensity); keep natural skin texture, never plastic or over-smoothed skin","آرایش "+fa+" (رنگ‌ها و شدت) اعمال می‌شود؛ بافت طبیعی پوست حفظ می‌شود و پوست پلاستیکی یا صاف‌شده نمی‌شود")};
  case "continue":return {hard:P(at+": continue this video from its last frame; subject, light, camera movement and color stay continuous","امتداد "+fa+" از آخرین فریم؛ سوژه، نور، حرکت دوربین و رنگ پیوسته می‌مانند")};
  case "environment":return {lock:P(at+": keep the location, architecture, light direction and time of day of the reference",fa+": مکان، معماری، جهت نور و ساعت روز مطابق مرجع ثابت بماند")};
  case "object":return {hard:P(at+": keep the object's shape, material, color, proportions and logo placement as in the reference",fa+": شکل، جنس، رنگ، تناسب و جای لوگوی شیء مطابق مرجع حفظ شود")};
  case "graphic":return {hard:P(at+": use the graphic, logo or text exactly as provided, with no distortion, recoloring or retyping",fa+": گرافیک، لوگو یا متن مرجع بدون اعوجاج، تغییر رنگ یا بازنویسی استفاده شود")};
  case "edit_reference":return kind==="video"
   ?{hard:P(at+": preserve the frame rate, frame count, cuts, audio, framing and grade of the source video except for the requested change",fa+": نرخ فریم، تعداد فریم، برش‌ها، صدا، کادر و گرید رنگ ویدیوی مبدأ حفظ شود، به‌جز تغییر درخواست‌شده")}
   :{hard:P(at+": change only the requested region and preserve all remaining pixels, identity, framing and light",fa+": فقط بخش درخواست‌شده تغییر کند و بقیهٔ پیکسل‌ها، هویت، کادر و نور حفظ شود")};
  case "motion_reference":return {hard:P(at+": follow the path, speed, timing and blocking of the motion, but not the appearance of the reference",fa+": مسیر، سرعت، زمان‌بندی و بلاکینگ حرکت از مرجع دنبال شود، اما ظاهر مرجع کپی نشود")};
  case "music":return {soft:P(at+": let its beat, tempo and structure guide the cut rhythm and motion timing; do not generate or alter any music",fa+": ضرباهنگ، تمپو و ساختار موسیقی راهنمای ریتم برش‌ها و زمان‌بندی حرکت باشد؛ موسیقی ساخته یا تغییر داده نمی‌شود")};
  case "general":return kind==="image"
   ?{hard:P(at+": use only as a loose reference for style and composition; do not copy its identity or details unless the brief asks for it",fa+" به‌عنوان مرجع کلی سبک و ترکیب‌بندی استفاده می‌شود؛ هویت یا جزئیات آن کپی نمی‌شود مگر خواسته شود")}
   :kind==="video"
    ?{soft:P(at+": use as a general visual reference for look, pacing and framing; do not copy it",fa+" به‌عنوان مرجع بصری کلی برای حال‌وهوا، ریتم و کادر استفاده می‌شود؛ عیناً کپی نمی‌شود")}
    :{soft:P(at+": use as a mood reference for the sound only; do not generate, imitate or alter any audio",fa+" به‌عنوان مرجع حال‌وهوای صدا استفاده می‌شود؛ صدایی ساخته، تقلید یا تغییر داده نمی‌شود")};
  default:return {};
 }
}
export function roleDirectives(refs:readonly Ref[]=[]):{hard:Pair[];soft:Pair[];locks:Pair[]}{
 const out={hard:[] as Pair[],soft:[] as Pair[],locks:[] as Pair[]};
 for(const a of refs){
  if(!a.role)continue;
  const r=roleRule(a.kind,a.role,a.tag);
  if(r.hard)out.hard.push(r.hard);
  if(r.soft)out.soft.push(r.soft);
  if(r.lock)out.locks.push(r.lock);
 }
 return out;
}
export function deterministicPlanner(req:PlannerRequest):{plan:CreativePlan}{
 const {input,kind,activeSkillIds:ids}=req;const text=input.text;const p=normalizePersian(text);
 const portrait=has(p,PORTRAIT),night=has(p,NIGHT),vertical=has(p,VERTICAL),photoreal=ids.includes("hyper_realism"),ref=input.characterRef;
 const dur=/(\d{1,2})\s*(?:s|sec|secs|second|seconds|ثانیه)\b/.exec(p);
 const look=P("full-frame mirrorless look, natural color science","ظاهر دوربین بدون‌آینهٔ فول‌فریم با رنگ‌های طبیعی");
 const d=portrait
  ?{look,framing:P("head-and-shoulders, eyes on the upper third, subject slightly off-center","کادر سر و شانه، چشم‌ها روی خط یک‌سوم بالایی، سوژه کمی خارج از مرکز"),lighting:P("soft key about 45 degrees to the camera side, gentle fill, subtle rim separation","نور اصلی نرم با زاویهٔ حدود ۴۵ درجه از کنار دوربین، پرکنندهٔ ملایم و جداسازی ظریف لبه"),focus:P("focal plane on the nearest eye, shallow depth of field","فوکوس روی نزدیک‌ترین چشم، عمق میدان کم")}
  :{look,framing:P("wide environmental framing, horizon on a third, foreground-midground-background layering","کادر باز محیطی، خط افق روی یک‌سوم، لایه‌بندی پیش‌زمینه، میانه و پس‌زمینه"),lighting:P("natural directional light with consistent shadow direction, soft overcast or golden-hour quality","نور طبیعی جهت‌دار با جهت ثابت سایه، کیفیت نرم ابری یا ساعت طلایی"),focus:P("deep depth of field, focus about one third into the scene","عمق میدان زیاد، فوکوس حدود یک‌سوم داخل صحنه")};
 const camera=portrait
  ?{look:d.look.fa,focalLengthMm:85,aperture:night?"f/1.8":"f/2.0",shutter:night?"1/125s":"1/200s",iso:night?1600:200,whiteBalanceK:night?3800:5600,framing:d.framing.fa,lighting:d.lighting.fa,focus:d.focus.fa,aspectRatio:vertical?"9:16":"4:5"}
  :{look:d.look.fa,focalLengthMm:35,aperture:night?"f/2.8":"f/5.6",shutter:night?"1/60s":"1/250s",iso:night?1600:100,whiteBalanceK:night?4000:5600,framing:d.framing.fa,lighting:d.lighting.fa,focus:d.focus.fa,aspectRatio:vertical?"9:16":"3:2"};
 const mv=MOVES.find(([re])=>re.test(p))?.[1]??DOLLY;
 const size=portrait?P("medium close-up","نمای نزدیک متوسط"):P("wide establishing shot","نمای باز معرفی صحنه");
 const notes=[P("First, middle and last frames share identity, wardrobe, lighting direction and palette","فریم اول، میانی و آخر هویت، لباس، جهت نور و پالت رنگی یکسان دارند"),P("Natural motion blur from the 180 degree shutter; no FPS drift","محوشدگی حرکتی طبیعی از شاتر ۱۸۰ درجه؛ بدون نوسان فریم‌ریت")];
 const shot={shotSize:size.fa,cameraMovement:mv.fa,lens:portrait?"معادل لنز ۵۰ میلی‌متر":"معادل لنز ۲۸ میلی‌متر",targetFps:24,shutterAngle:180,durationSeconds:dur?Math.min(60,Math.max(1,Number(dur[1]))):5,blocking:"حرکت سوژه دلیل مشخص دارد و خوانا است؛ محور دوربین و جهت حرکت روی صفحه ثابت می‌ماند",continuityNotes:fas(notes)};
 const lips=ids.includes("persian_lip_sync_phonetics"),speech=input.audio?.hasSpeech===true;
 const rd=roleDirectives(req.attachments),byTag=tagMap(req.attachments),sd=styleDirectives(input.style,hasCharacterRef(req));
 const hardP:Pair[]=[P("Follow the brief exactly; do not add unrequested subjects, text or logos","دقیقاً مطابق توضیح تو؛ سوژه، متن یا لوگوی اضافه‌ای وارد نمی‌شود"),
  ...(input.task==="edit"?[P("Preserve all unedited source regions: identity, framing, lighting, color and pixels","همهٔ بخش‌های ویرایش‌نشدهٔ تصویر مبدأ حفظ می‌شود: هویت، کادر، نور، رنگ و پیکسل‌ها")]:[]),
  ...(kind==="video"?[P("Keep people and objects continuous; no teleporting, sudden appearance or unintended cuts","افراد و اشیا پیوسته می‌مانند؛ بدون جابه‌جایی ناگهانی، ظاهر یا ناپدید شدن ناگهانی و برش ناخواسته")]:[]),
  ...(ref?[P("Use only the provided reference angles; never invent missing views","فقط از زاویه‌های مرجع ارائه‌شده استفاده می‌شود؛ نمای ناموجود ساخته نمی‌شود")]:[]),
  ...sd.hard,...rd.hard];
 const directivesP:Pair[]=photoreal
  ?[P("Natural skin microtexture with visible pores, fine hairs and subtle asymmetry where people appear","بافت ریز طبیعی پوست با منافذ قابل‌دیدن، موهای ریز و کمی عدم تقارن، هرجا آدمی دیده می‌شود"),P("No waxy, plastic or over-smoothed skin","پوست مومی، پلاستیکی یا بیش‌ازحد صاف نباشد"),P("Physically accurate materials: fabric weave, metal, glass, wood, stone","مواد با رفتار فیزیکی درست: بافت پارچه، فلز، شیشه، چوب و سنگ"),P("No gratuitous film grain, glow, haze or stylistic filters unless requested","بدون گرین فیلم، درخشش، مه یا فیلتر سبکیِ بی‌دلیل، مگر اینکه خواسته شود"),P("Balanced exposure with natural highlight roll-off","نوردهی متعادل با افت طبیعی نواحی روشن")]
  :[...sd.directives,P("Respect the requested stylized look; do not impose photographic textures or lens artifacts","سبک خواسته‌شده رعایت می‌شود؛ بافت عکاسی یا خطاهای لنز تحمیل نمی‌شود"),P("Keep line, palette and shading consistent across the whole frame","خط، پالت رنگی و سایه‌پردازی در کل کادر یکدست می‌ماند")];
 const directives=fas(directivesP);
 const hard=fas(hardP);
 const docs=(req.attachments??[]).filter(a=>a.textExcerpt).length,pdfs=(req.attachments??[]).filter(a=>a.kind==="pdf").length;
 const soft=[...fas(sd.soft),kind==="image"?"نسبت تصویر "+faDigits(camera.aspectRatio):"کادر مناسب پلتفرم با جذابیت واضح در ثانیهٔ اول",...fas(rd.soft),...(night?["حال‌وهوای کم‌نور با منابع نور واقعی صحنه"]:[]),
  ...(docs?[faDigits(String(docs))+" سند متنی به‌عنوان زمینه همراه درخواست ثبت شد؛ برنامهٔ آزمایشی هنوز محتوای آن‌ها را اعمال نمی‌کند"]:[]),...(pdfs?[FA_PDF_NOTE]:[])];
 const direction=kind==="image"?[camera.focalLengthMm+"mm",camera.aperture,camera.shutter,"ISO "+camera.iso,camera.whiteBalanceK+"K",d.framing.en,d.lighting.en]:[size.en,mv.en,shot.targetFps+"fps",shot.shutterAngle+" degree shutter",shot.durationSeconds+"s"];
 // The user's text gets whatever budget the direction, hard constraints and role lines leave, so the constraints at the end are never cut off.
 const rest="\nDirection: "+direction.join(", ")+". "+ens(directivesP).join(". ")+". "+ens(hardP).join(". ")+(rd.locks.length||rd.soft.length||sd.soft.length?". "+ens([...rd.locks,...rd.soft,...sd.soft]).join(". "):"");
 const restEn=rewriteMentions(rest,byTag),prompt=(rewriteMentions(text,byTag).slice(0,Math.max(200,3000-restEn.length))+restEn).slice(0,3000);
 const plan:CreativePlan={
  intentSummaryFa:(kind==="image"?"ساخت تصویر: ":"ساخت ویدیو: ")+text.replace(/\s+/g," ").slice(0,160)+(text.length>160?"…":""),
  mediaKind:kind,
  mediaPrompt:prompt,
  hardConstraints:hard,
  softPreferences:soft,
  negative:["extra fingers","distorted anatomy","garbled or misspelled text","watermark",...(photoreal?["waxy or plastic skin","over-smoothing","gratuitous grain, glow or filters"]:[])],
  camera:kind==="image"?camera:undefined,shot:kind==="video"?shot:undefined,
  identityLock:ref?{characterId:ref.id,version:ref.version,providedAngles:[...ref.angles],lockedAttributes:["هندسهٔ چهره","مدل مو و خط رویش مو","رنگ و بافت پوست","تناسب بدن","سن ظاهری","لباس، مگر تغییرش خواسته شود"],allowedChanges:["ژست و حالت چهره","محیط و نور طبق درخواست","زاویهٔ دوربین"]}:undefined,
  continuity:{locks:["هویت، لباس، مدل مو، وسایل و پالت رنگی در همهٔ فریم‌ها و بازبینی‌ها یکسان می‌ماند","جهت نور و ساعت روز ثابت است، مگر اینکه توضیح تو آن را تغییر بدهد","هر چیزی که درخواست تغییرش نشده، دست‌نخورده می‌ماند",...fas(rd.locks)],
   antiTeleport:kind==="video"?["هر فرد و شیء پایدار می‌ماند: بدون ظاهر یا ناپدید شدن ناگهانی","تماس دست با اشیا و مسیر حرکت‌ها از نظر فیزیکی قابل‌باور می‌ماند","میان فریم‌های پیاپی پرش ناگهانی در موقعیت وجود ندارد"]:[]},
  realism:{mode:photoreal?"photoreal":"stylized",directives},
  speech:kind==="video"?{lipSync:lips?{status:speech?"planned_from_audio":"needs_audio",notes:speech?["زمان‌بندی دهان از روی صدای ارائه‌شده استخراج می‌شود، نه از زمان‌بندی حدسیِ متن","صدا، کلمات و لهجهٔ فایل اصلی بدون تغییر می‌ماند",...(ids.includes("tehrani_accent")?["لهجهٔ تهرانی فقط هدف خلاقانه برای دیالوگ تازه‌نوشته‌شده است؛ صدای ارائه‌شده هرگز تغییر نمی‌کند"]:[])]:["برای هم‌زمان‌سازی لب، فایل صوتی گفتار را ارائه کن؛ زمان‌بندی هرگز فقط از روی متن حدس زده نمی‌شود"]}:{status:"not_requested",notes:[]},accent:ids.includes("tehrani_accent")?"tehrani":input.audio?.accent==="original"?"original":"unspecified"}:undefined,
  qaChecklist:["سوژه، تعداد و ترکیب‌بندی با توضیح تو می‌خواند","آناتومی، دست‌ها و هندسه قابل‌باورند","متن فارسی یا انگلیسی داخل تصویر درست نوشته شده و حروف فارسی به‌هم‌پیوسته‌اند",kind==="video"?"فریم اول، میانی و آخر هویت و نور را حفظ می‌کنند؛ شیئی ناگهان جابه‌جا نمی‌شود؛ مدت و فریم‌ریت با برنامه می‌خواند":"نور، نوردهی و پرسپکتیو یکدست است",...(photoreal?["پوست و مواد طبیعی دیده می‌شوند، نه مومی یا بیش‌ازحد فیلترشده"]:[])],
  clarifyingQuestionFa:ref?missingQuestion(ref.angles):undefined
 };
 return {plan};
}
// ---- invariants: planner output is untrusted ----
function enforce(raw:CreativePlan,req:PlannerRequest):{plan:CreativePlan;corrections:string[]}{
 const c:string[]=[],det=deterministicPlanner(req).plan as CreativePlan,p:CreativePlan={...raw},{kind,input,activeSkillIds:ids}=req,ref=input.characterRef;
 const note=(n:string,cond:boolean)=>{if(cond)c.push(n);return cond;};
 if(note("media_kind",p.mediaKind!==kind))p.mediaKind=kind;
 if(kind==="image"){if(note("shot_dropped",Boolean(p.shot)))delete p.shot;if(note("camera_filled",!p.camera))p.camera=det.camera;}
 else if(note("shot_filled",!p.shot))p.shot=det.shot;
 if(note("continuity_filled",!p.continuity.locks.length||(kind==="video"&&!p.continuity.antiTeleport.length)))p.continuity={locks:p.continuity.locks.length?p.continuity.locks:det.continuity.locks,antiTeleport:kind==="video"&&!p.continuity.antiTeleport.length?det.continuity.antiTeleport:p.continuity.antiTeleport};
 if(!ref){if(note("identity_dropped",Boolean(p.identityLock)))delete p.identityLock;}
 else{
  const il=p.identityLock??det.identityLock!;
  note("identity_overwritten",!p.identityLock||il.characterId!==ref.id||il.version!==ref.version||il.providedAngles.join()!==ref.angles.join());
  p.identityLock={...il,characterId:ref.id,version:ref.version,providedAngles:[...ref.angles],lockedAttributes:il.lockedAttributes.length?il.lockedAttributes:det.identityLock!.lockedAttributes};
  if(!p.clarifyingQuestionFa)p.clarifyingQuestionFa=missingQuestion(ref.angles);
 }
 const photoreal=ids.includes("hyper_realism");
 if(note("realism_mode",p.realism.mode!==(photoreal?"photoreal":"stylized")||!p.realism.directives.length))p.realism=det.realism;
 // Role directives are hard invariants: a planner that dropped one gets it back (Persian in the plan, English in the prompt).
 const rd=roleDirectives(req.attachments),lacks=(l:readonly string[])=>(x:Pair)=>!l.includes(x.fa);
 const lackHard=rd.hard.filter(lacks(p.hardConstraints)),lackLocks=rd.locks.filter(lacks(p.continuity.locks)),lackSoft=rd.soft.filter(lacks(p.softPreferences));
 if(note("role_directives",lackHard.length+lackLocks.length+lackSoft.length>0)){
  p.hardConstraints=[...p.hardConstraints,...fas(lackHard)];p.continuity={...p.continuity,locks:[...p.continuity.locks,...fas(lackLocks)]};p.softPreferences=[...p.softPreferences,...fas(lackSoft)];
  const extra=rewriteMentions(" "+ens([...lackHard,...lackLocks,...lackSoft]).join(". ")+".",tagMap(req.attachments));
  p.mediaPrompt=p.mediaPrompt.slice(0,Math.max(0,3000-extra.length))+extra;
 }
 // The chosen style is restored the same way: Persian in the plan, English in the prompt.
 const sdr=styleDirectives(input.style,hasCharacterRef(req)),lackStyleHard=sdr.hard.filter(lacks(p.hardConstraints)),lackStyleSoft=sdr.soft.filter(lacks(p.softPreferences)),lackStyleDir=sdr.directives.filter(lacks(p.realism.directives));
 if(note("style_directives",lackStyleHard.length+lackStyleSoft.length+lackStyleDir.length>0)){
  p.hardConstraints=[...p.hardConstraints,...fas(lackStyleHard)];p.softPreferences=[...p.softPreferences,...fas(lackStyleSoft)];p.realism={...p.realism,directives:[...p.realism.directives,...fas(lackStyleDir)]};
  const extra=" "+ens([...lackStyleHard,...lackStyleSoft,...lackStyleDir]).join(". ")+".";
  p.mediaPrompt=p.mediaPrompt.slice(0,Math.max(0,3000-extra.length))+extra;
 }
 if(kind==="image"){if(note("speech_dropped",Boolean(p.speech)))delete p.speech;}
 else{
  const lips=ids.includes("persian_lip_sync_phonetics"),status=!lips?"not_requested":input.audio?.hasSpeech?"planned_from_audio":"needs_audio";
  const accent=ids.includes("tehrani_accent")?"tehrani":input.audio?.accent==="original"?"original":"unspecified";
  const s=p.speech??det.speech!;
  note("speech",!p.speech||s.lipSync.status!==status||s.accent!==accent);
  p.speech={lipSync:{status,notes:s.lipSync.status===status&&s.lipSync.notes.length?s.lipSync.notes:det.speech!.lipSync.notes},accent};
 }
 return {plan:p,corrections:c};
}
// Customer projection must not echo vendor/model names, skill titles/ids or prompt internals unless the user wrote them.
const FORBIDDEN=["claude","anthropic","openai","gpt","sonnet","opus","haiku","systeminstructions","reasoningtier","promptsha256",...Object.entries(SKILLS).flatMap(([id,s])=>[s.title.toLowerCase(),...(id.includes("_")?[id]:[])])];
// Model-family words are only forbidden as standalone Latin tokens (so "solid" or "terrain" never trip it), and only when the user did not type them.
const FAMILY_WORDS=["sol","astra","luna","terra"].map(w=>new RegExp("(?<![a-z0-9])"+w+"(?![a-z0-9])"));
const leaks=(pub:PublicCreativePlan,userText:string)=>{const j=JSON.stringify(pub).toLowerCase(),u=userText.toLowerCase();return FORBIDDEN.some(t=>j.includes(t)&&!u.includes(t))||FAMILY_WORDS.some(r=>r.test(j)&&!r.test(u));};
// ---- private prompt store for the generation phase (bounded, server memory only) ----
const MAX_PROMPTS=200;
const store=()=>((globalThis as {__whoushPrompts?:Map<string,string>}).__whoushPrompts??=new Map());
export const getPrivateMediaPrompt=(turnId:string):string|undefined=>store().get(turnId);
function keepPrompt(turnId:string,prompt:string){const m=store();m.set(turnId,prompt);while(m.size>MAX_PROMPTS)m.delete(m.keys().next().value as string);}
// ---- attachments ----
type Audio=NonNullable<ReturnType<typeof CreativeTurnInputSchema.parse>["audio"]>;
/** One set of audio flags from the legacy `audio` field and from audio attachments; the first source that has speech decides language and accent. */
export function deriveAudio(input:{audio?:Audio;attachments?:readonly {kind:string;role?:string;speech?:{hasSpeech:boolean;language:Audio["language"];accent:Audio["accent"]}}[]}):Audio|undefined{
 const a=input.audio,files=(input.attachments??[]).filter(x=>x.kind==="audio");
 if(!a&&!files.length)return undefined;
 // Only a `lip_sync` audio carries speech, and it implies speech; the language defaults to unknown and the accent to unspecified.
 const lip=files.filter(f=>f.role==="lip_sync").map(f=>({hasSpeech:true,language:(f.speech?.language??"unknown") as Audio["language"],accent:(f.speech?.accent??"unspecified") as Audio["accent"]}));
 const speaker=a?.hasSpeech?a:lip[0];
 return {hasAudioReference:Boolean(a?.hasAudioReference)||files.length>0||Boolean(speaker),hasSpeech:Boolean(speaker),language:speaker?.language??a?.language??"unknown",accent:speaker?.accent&&speaker.accent!=="unspecified"?speaker.accent:a?.accent??"unspecified"};
}
/**
 * Hard capability requirements. Character angles and every attached image (all image roles are references) count as reference images;
 * a `motion_reference` video needs `motionReference`, an `edit_reference` video `videoReference`, a `lip_sync` audio `lipSync`, a `start_frame` image `startImage`, a `continue` video `videoContinuation`.
 * `operation` names the specialised work the attachments describe (checked in this order): a lip_sync audio is `lip_sync`; an edit_reference video with a
 * character or object image is `replace`; a motion_reference video with an image that is not a graphic is `motion_transfer`.
 */
export function mediaRequirements(input:{characterRef?:{angles:readonly string[]};attachments?:readonly {kind:string;role?:string}[]},lipSync:boolean):MediaRequirements{
 const files=input.attachments??[],images=files.filter(a=>a.kind==="image"&&a.role),refs=(input.characterRef?.angles.length??0)+images.length;
 const lips=lipSync||files.some(a=>a.kind==="audio"&&a.role==="lip_sync");
 const video=(role:string)=>files.some(a=>a.kind==="video"&&a.role===role);
 const operation:MediaRequirements["operation"]=files.some(a=>a.kind==="audio"&&a.role==="lip_sync")?"lip_sync"
  :video("edit_reference")&&images.some(a=>a.role==="character"||a.role==="object")?"replace"
  :video("motion_reference")&&images.some(a=>a.role!=="graphic")?"motion_transfer":undefined;
 return {...(operation?{operation}:{}),referenceImages:refs||undefined,lipSync:lips||undefined,
  ...(video("motion_reference")?{motionReference:true}:{}),...(video("edit_reference")?{videoReference:true}:{}),
  ...(files.some(a=>a.kind==="image"&&a.role==="start_frame")?{startImage:true}:{}),...(files.some(a=>a.kind==="image"&&a.role==="end_frame")?{endImage:true}:{}),...(video("continue")?{videoContinuation:true}:{})};
}
// ---- orchestration ----
export async function orchestrateCreativeTurn(rawInput:unknown,deps:OrchestratorDeps={}):Promise<OrchestratorResult>{
 const parsed=CreativeTurnInputSchema.parse(rawInput),audit=deps.audit??defaultAuditSink,now=deps.now??(()=>new Date());
 const safety=evaluateTextSafety(parsed.text);
 if(safety.decision!=="allow")return {status:"restricted",decision:safety.decision,category:safety.category,message:safety.message};
 // A role is optional: media without one gets Whoush's best guess from the words of the brief (no media analysis), before skills resolve.
 // Inferred roles drive the same skills, constraints, kind override and requirements as chosen ones; `voice_clone` is never inferred.
 const given=parsed.attachments??[],roles=new Map(inferAttachmentRoles(parsed.text,given).map(r=>[r.tag,r]));
 const files:Array<Omit<(typeof given)[number],"role">&{role?:AttachmentRole;roleSource?:RoleSource}>=given.map(f=>{const r=roles.get(f.tag);return r?{...f,role:r.role,roleSource:r.roleSource}:f;});
 // Text attachments are user text: they get the same preflight before any planner sees them.
 for(const f of files){
  if(!f.textExcerpt)continue;
  const r=evaluateTextSafety(f.textExcerpt);
  if(r.decision!=="allow")return {status:"restricted",decision:r.decision,category:r.category,message:FA_TEXT_BLOCKED+r.message};
 }
 // Planners see attachments only through `req.attachments` (kinds and excerpts as data); the audio flags are merged into `input.audio`.
 // An edit_reference (image or video) makes the turn an edit, which brings photo_editor or video_editor.
 const task=parsed.task!=="character"&&files.some(f=>f.role==="edit_reference")?"edit":parsed.task;
 const input={...parsed,task,visualStyle:parsed.style?STYLE_VISUAL[parsed.style]:parsed.visualStyle,audio:deriveAudio({...parsed,attachments:files}),attachments:undefined};
 // A video attachment (every media attachment carries a role), a lip_sync audio or a start_frame or end_frame image makes the output a video even when the text sounds like
 // an image request. Such a turn always has media, so it stops at the media-review check below and never reaches `buildProposal`, which re-detects from the text.
 const kind=files.some(f=>f.kind==="video"||(f.kind==="audio"&&f.role==="lip_sync")||(f.kind==="image"&&(f.role==="start_frame"||f.role==="end_frame")))?"video":detectMediaKind(input.text),a=input.audio,ref=input.characterRef;
 const refs:PublicReference[]=files.flatMap(f=>isMediaKind(f.kind)&&f.role?[{tag:f.tag,kind:f.kind,role:f.role,roleSource:f.roleSource??"user",labelFa:roleLabelFa(f.role,f.kind)}]:[]);
 const have=new Set(files.map(f=>f.tag)),missing=parseMentions(input.text).filter(t=>!have.has(t)),byTag=tagMap(files);
 const prep=preparePrivateCreativeRequest({prompt:input.text,kind,task:input.task,attachmentRoles:files.flatMap(f=>f.role?[f.role]:[]),hasReferences:Boolean(ref||a?.hasAudioReference||files.length),hasAudioReference:a?(a.hasAudioReference||a.hasSpeech):undefined,hasSpeechAudio:a?.hasSpeech,speechLanguage:a?.language,accent:a?.accent,characterRef:ref,visualStyle:input.visualStyle});
 const req:PlannerRequest={...prep,privateRoute:prep.privateRoute&&{provider:prep.privateRoute.provider,modelId:prep.privateRoute.modelId},kind,input,...(files.length?{attachments:files.map(f=>({tag:f.tag,kind:f.kind,...(f.role?{role:f.role,roleSource:f.roleSource??"user"}:{}),...(f.textExcerpt?{textExcerpt:f.textExcerpt}:{})}))}:{})};
 const turnId=randomUUID();
 const rec=(x:Partial<PrivateAuditRecord>)=>audit.record({turnId,at:now().toISOString(),skillRegistryVersion:SKILL_REGISTRY_VERSION,activeSkillIds:[...prep.activeSkillIds],reasoningTier:prep.privateReasoningTier,route:req.privateRoute,planner:"deterministic",...(input.style?{style:input.style}:{}),promptSha256:createHash("sha256").update(input.text).digest("hex"),...(files.length?{attachments:files.map(f=>({tag:f.tag,...(f.role?{role:f.role,roleSource:f.roleSource??"user"}:{}),kind:f.kind,bytes:f.bytes,sha256:f.sha256}))}:{}),...x});
 let planner=deps.planner,label:PrivateAuditRecord["planner"]=planner&&planner!==deterministicPlanner?"live":"deterministic",fallbackReason:string|undefined;
 if(!planner){
  const pol=llmPolicy(prep.privateReasoningTier);
  if(pol.live&&req.privateRoute){const {modelId,provider}=req.privateRoute;label="live";planner=provider==="openai"?async r=>(await import("./llm-openai")).planWithOpenAI(r,modelId):async r=>(await import("./llm-anthropic")).planWithAnthropic(r,modelId);}
  else{planner=deterministicPlanner;fallbackReason=pol.reason;}
 }
 let result:PlannerResult|undefined;
 try{result=await planner(req);}
 catch(e){
  if(e instanceof PlannerRefusedError){rec({planner:label,fallbackReason:"planner_refused"});return {status:"restricted",decision:"review",category:"none",message:FA_REFUSED};}
  label="deterministic";fallbackReason=e instanceof PlannerUnavailableError?"planner_unavailable":e instanceof PlannerInvalidOutputError?"invalid_output":"planner_error";
 }
 const finalize=(raw:unknown)=>{
  const v=CreativePlanSchema.safeParse(raw);if(!v.success)return {reason:"invalid_output"};
  const e=enforce(v.data,req);return leaks(toPublicPlan(e.plan),input.text)?{reason:"leak_filtered"}:{e};
 };
 let fin=result?finalize(result.plan):{reason:fallbackReason??"planner_error"};
 if(!fin.e){label="deterministic";fallbackReason=fin.reason;fin=finalize(deterministicPlanner(req).plan);}
 if(!fin.e)throw new Error("deterministic planner produced an invalid plan");
 const {plan,corrections}=fin.e;
 // Provider-facing text names attachments by description; the public Persian text keeps what the user typed. A missing tag is a question, never a block.
 plan.mediaPrompt=rewriteMentions(plan.mediaPrompt,byTag).slice(0,3000);
 if(missing.length)plan.clarifyingQuestionFa=[faMissing(missing),plan.clarifyingQuestionFa].filter(Boolean).join(" ").slice(0,400);
 // plan inspection: LLM output never bypasses the safety layer
 for(const t of [plan.mediaPrompt,...plan.hardConstraints]){
  const r=evaluateTextSafety(t);
  if(r.decision!=="allow"){rec({planner:label,fallbackReason:"plan_restricted",corrections,usage:result?.usage});return {status:"restricted",decision:r.decision,category:r.category,message:r.message};}
 }
 // Hard capability requirements: a character reference needs reference-image input, lip sync needs a lip-sync model.
 const requirements=mediaRequirements({characterRef:ref,attachments:files},kind==="video"&&prep.activeSkillIds.includes("persian_lip_sync_phonetics"));
 // Voice cloning is never offered: Whoush only makes images and videos, and generating or imitating a voice is out of scope.
 if(files.some(f=>f.role==="voice_clone")){
  rec({planner:label,fallbackReason:"voice_clone_unsupported",corrections:corrections.length?corrections:undefined});
  return {status:"unsupported",turnId,plan:toPublicPlan(plan,refs,undefined,input.style),message:FA_VOICE_CLONE};
 }
 // TODO(docs/MODERATION_POLICY.md step 4, "Reference inspection"): plug a real multimodal inspector in here. Until one exists, any image, video or
 // audio attachment fails closed: the plan is returned, but no proposal or price, so uninspected media can never reach provider handoff (step 6).
 if(files.some(f=>isMediaKind(f.kind))){
  rec({planner:label,fallbackReason:"media_review_unavailable",corrections:corrections.length?corrections:undefined});
  const suggestedModel=suggestModel(requirements,kind);
  return {status:"unsupported",turnId,plan:toPublicPlan(plan,refs,suggestedModel,input.style),message:FA_MEDIA_REVIEW+(suggestedModel?faSuggestion(suggestedModel):""),...(suggestedModel?{suggestedModel}:{})};
 }
 let proposal:GenerationProposal;
 try{proposal=buildProposal(input.text,input.preference,requirements);}
 catch(e){
  if(!(e instanceof NoCompatibleModelError))throw e;
  rec({planner:label,fallbackReason:"no_compatible_model",corrections:corrections.length?corrections:undefined});
  const suggestedModel=suggestModel(requirements,kind),base=ref?FA_NO_REFS:lipsMsg;
  return {status:"unsupported",turnId,plan:toPublicPlan(plan,refs,suggestedModel,input.style),message:base+(suggestedModel?faSuggestion(suggestedModel):""),...(suggestedModel?{suggestedModel}:{})};
 }
 keepPrompt(turnId,plan.mediaPrompt);
 rec({planner:label,fallbackReason,corrections:corrections.length?corrections:undefined,usage:label==="live"?result?.usage:undefined});
 return {status:"planned",turnId,proposal,plan:toPublicPlan(plan,refs,undefined,input.style)};
}
