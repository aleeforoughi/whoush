import "server-only";
import {createHash,randomUUID} from "node:crypto";
import {buildProposal,NoCompatibleModelError} from "./agent";
import {CHARACTER_VIEWS,REQUIRED_CHARACTER_VIEWS} from "./characters";
import {CreativePlanSchema,CreativeTurnInputSchema,STYLE_VISUAL,toPublicPlan,type GenerationStyle,type GifMood,type PublicReference,type ReactionEmoji,type Staging,PlannerInvalidOutputError,PlannerRefusedError,PlannerUnavailableError,type CreativePlan,type PlannerRequest,type PlannerResult,type PrivatePlanner,type PublicCreativePlan} from "./creative-plan";
import {llmGate,preparePrivateCreativeRequest} from "./llm";
import {acquireProviderSlot,countAstraCall,defaultRouterState,estimateTurnCostUsd,loadRoutingConfig,markProviderCooldown,planRoute,profileTask,type RoutingAudit,type RoutingAttempt,type RoutingConfig,type RouterState} from "./llm-routing";
import {defaultAuditSink,type PrivateAuditRecord,type PrivateAuditSink} from "./private-audit";
import {displayTag,inferAttachmentRoles,isGenerationTag,isMediaKind,parseMentions,rewriteMentions,roleLabelFa,type AttachmentKind,type AttachmentRole,type RoleSource} from "./attachments";
import {providerForModelId} from "./llm-routing";
import {replyScriptFor} from "./finglish";
import {applyStagingCues,applyTypedMappings,lensFor,describeStagingEn,describeStagingFa,sceneLeadEn,detectProps,detectSubject,expandMappings,mapReferences,tidyProps,typedMappings} from "./staging";
import {findGif,type ChatGif} from "./giphy";
import {describeFocus} from "./frame-css";
import {detectMediaKind,suggestModel} from "./router";
import {evaluatePlanTextSafety,evaluateTextSafety,normalizePersian,type SafetyCategory} from "./safety";
import {SKILLS,SKILL_REGISTRY_VERSION} from "./skills";
import {detectReferenceNeeds,type ReferenceRequest} from "./reference-needs";
import type {GenerationProposal,MediaRequirements,SuggestedModel} from "./types";
export type OrchestratorDeps={planner?:PrivatePlanner;audit?:PrivateAuditSink;now?:()=>Date;
 /** Progress for the chat's live status: called as each real stage of the turn starts (never invented, never with private details). */
 onStage?:(stage:TurnStage)=>void;
 /** Finds a chat GIF for a mood (GIPHY by default; tests pass a stub). */
 findGif?:(mood:GifMood)=>Promise<ChatGif|undefined>;
 /** Test hook: the planner for one routed model. Defaults to the real Anthropic or OpenAI adapter. */
 plannerFor?:(modelId:string,provider:"anthropic"|"openai")=>PrivatePlanner;routing?:RoutingConfig;routerState?:RouterState};
export {TURN_STAGES,type TurnStage} from "./orchestrator-stages";
import type {TurnStage} from "./orchestrator-stages";
export type OrchestratorResult=
 |{status:"planned";turnId:string;proposal:GenerationProposal;plan:PublicCreativePlan;gif?:ChatGif;reaction?:ReactionEmoji}
 |{status:"unsupported";turnId:string;plan:PublicCreativePlan;message:string;suggestedModel?:SuggestedModel}
 |{status:"restricted";decision:"block"|"review";category:SafetyCategory;message:string}
 /** Whoush needs one critical answer before it can offer a generation: no plan card, no price, only the question. */
 |{status:"needs_input";turnId:string;message:string;question:string;reaction?:ReactionEmoji;
  /** The photos Whoush needs to keep something only a photo can (lib/reference-needs.ts): the card shows an upload slot per angle. */references?:ReferenceRequest};
/**
 * Whoush's own lines when no planner reply is usable (deterministic planner, or a reply that failed a check): everyday spoken Persian, or Finglish for a Finglish
 * brief, in Whoush's voice. A question's setup carries no emoji (docs/CREATIVE_SKILLS.md, Whoush voice).
 */
const VOICE={
 fa:{
  planned:["اینم پرامپتش 🎬 یه نگاه بنداز؛ اگه اوکی بود، بزن بریم!","حله! پرامپتش آماده‌ست ✨ جزئیاتو ببین، هر جاش رو خواستی بگو عوضش کنیم.","ایول، ایده‌ی خوبیه 😎 پرامپت رو چیدم؛ هر وقت آماده بودی بسازیمش."],
  revision:(tag:string)=>["ردیفه! تغییرها رو روی "+tag+" اعمال کردم 👌 بقیه‌ش همون‌طور که بود موند.","حله، "+tag+" رو با تغییرهای تو دوباره چیدم ✨ یه نگاه بنداز."],
  needsInput:["قبل از اینکه شروع کنم، یه چیز مهم رو باید بدونم.","یه سؤال کوچیک دارم تا دقیقاً همونی بشه که می‌خوای."]
 },
 finglish:{
  planned:["Ine barnamash 🎬 Ye negah bendaz, age oki bood bezan berim!","Halle! Naghshash amadas ✨ Joziyato bebin, har jash ro khasti begu avazesh konim.","Eyval, ide-ye khubie 😎 Barnamaro chidam; harvaght amade budi besazimesh."],
  revision:(tag:string)=>["Radife! Taghiraro ru "+tag+" emal kardam 👌 Baghiash hamun-tor ke bud mund.","Halle, "+tag+" ro ba taghirat-e to dobare chidam ✨ Ye negah bendaz."],
  needsInput:["Ghabl az inke shoru konam, ye chiz-e mohem ro bayad bedunam.","Ye soal-e kuchik daram ta daghighan hamuni beshe ke mikhay."]
 }
} as const;
const pickLine=(lines:readonly string[],seed:string)=>lines[[...seed].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,7)%lines.length];
const FA_REFUSED="این درخواست در حال حاضر قابل پردازش نیست. لطفاً آن را با توضیح غیرحساس‌تر دوباره بنویس.";
const FA_NO_REFS="پرامپت تولید با کاراکتر انتخاب‌شده آماده است، اما هنوز هیچ مدل تأییدشده‌ای عکس مرجع کاراکتر را نمی‌پذیرد؛ برای همین فعلاً پیشنهاد تولید و هزینه نمایش داده نمی‌شود.";
const FA_TEXT_BLOCKED="یکی از فایل‌های متنیِ پیوست‌شده مسدود شد. ";
const FA_MEDIA_REVIEW="پرامپت آماده است، اما بررسی ایمنی فایل‌های تصویری، ویدیویی و صوتی هنوز فعال نیست؛ برای همین فعلاً پیشنهاد تولید و هزینه نمایش داده نمی‌شود.";
const FA_VOICE_CLONE="کلون صدا در هووش پشتیبانی نمی‌شود؛ هووش فقط تصویر و ویدیو می‌سازد و تولید یا شبیه‌سازی صدا ممکن نیست.";
const faMissingGenerations=(tags:readonly string[])=>tags.map(displayTag).join("، ")+(tags.length===1?" در این گفت‌وگو پیدا نشد؛ تگ را اصلاح کن یا از «اصلاح» روی کارت همان تولید استفاده کن.":" در این گفت‌وگو پیدا نشدند؛ تگ‌ها را اصلاح کن یا از «اصلاح» روی کارت همان تولید استفاده کن.");
const faMissing=(tags:readonly string[])=>tags.length===1?"پیوست "+displayTag(tags[0])+" در این گفت‌وگو پیدا نشد؛ آن را دوباره اضافه کن یا تگ را اصلاح کن.":"پیوست‌های "+tags.map(displayTag).join("، ")+" در این گفت‌وگو پیدا نشدند؛ آن‌ها را دوباره اضافه کن یا تگ‌ها را اصلاح کن.";
const faSuggestion=(m:SuggestedModel)=>" مدل مناسب این کار: "+m.name+"؛ پس از تأیید فعال می‌شود.";
const FA_PDF_NOTE="محتوای فایل PDF هنوز خوانده نمی‌شود و در پرامپت اثری ندارد";
const lipsMsg="پرامپت لیپ‌سینک آماده است، اما هنوز هیچ مدل تأییدشده‌ای هماهنگی لب را پشتیبانی نمی‌کند؛ برای همین فعلاً پیشنهاد تولید و هزینه نمایش داده نمی‌شود.";
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
/** Missing character angles are Whoush's call, not a question: it continues with the provided angles and says so in the plan. */
const missingAnglesNote=(angles:readonly string[])=>{const m=missingViews(angles);return m.length?"زاویه‌های «"+viewTitles(m)+"» هنوز اضافه نشده‌اند؛ هووش فقط از زاویه‌های موجود استفاده می‌کند و آن‌ها را از خودش نمی‌سازد":undefined;};
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
  // `reference` and `frame` are resolved from the brief in inferAttachmentRoles before planning; these fallbacks only guard a caller that skips that step.
  case "reference":return roleRule(kind,"general",tag);
  case "frame":return roleRule(kind,"start_frame",tag);
  case "character":return {hard:P(at+": preserve facial identity, hair, skin tone and body proportions exactly as in the reference",fa+": هویت چهره، مو، رنگ پوست و تناسب بدن مطابق مرجع حفظ شود")};
  case "start_frame":return {hard:P(at+": this image is the first frame of the video; its composition, subject and lighting are the starting point",fa+" فریم اول ویدیوست؛ ترکیب‌بندی، سوژه و نور همین عکس نقطهٔ شروع است")};
  case "end_frame":return {hard:P(at+": this image is the last frame of the video; the video ends on its composition, subject and lighting",fa+" فریم آخر ویدیوست؛ ویدیو با همین ترکیب‌بندی، سوژه و نور تمام می‌شود")};
  case "outfit":return {hard:P(at+": apply this outfit (design, color, fabric and cut) to the subject; do not copy the face or body of the model in the outfit photo","پوشاک "+fa+" (طرح، رنگ، جنس و برش) روی سوژه اعمال می‌شود؛ چهره و بدن مدلِ عکس مرجع کپی نمی‌شود"),
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
  ?{look,framing:P("head-and-shoulders, subject centred in the frame","کادر سر و شانه، سوژه وسط کادر"),lighting:P("soft key about 45 degrees to the camera side, gentle fill, subtle rim separation","نور اصلی نرم با زاویهٔ حدود ۴۵ درجه از کنار دوربین، پرکنندهٔ ملایم و جداسازی ظریف لبه"),focus:P("focal plane on the nearest eye, shallow depth of field","فوکوس روی نزدیک‌ترین چشم، عمق میدان کم")}
  :{look,framing:P("wide environmental framing, horizon on a third, foreground-midground-background layering","کادر باز محیطی، خط افق روی یک‌سوم، لایه‌بندی پیش‌زمینه، میانه و پس‌زمینه"),lighting:P("natural directional light with consistent shadow direction, soft overcast or golden-hour quality","نور طبیعی جهت‌دار با جهت ثابت سایه، کیفیت نرم ابری یا ساعت طلایی"),focus:P("deep depth of field, focus about one third into the scene","عمق میدان زیاد، فوکوس حدود یک‌سوم داخل صحنه")};
 const camera=portrait
  ?{look:d.look.fa,focalLengthMm:85,aperture:night?"f/1.8":"f/2.0",shutter:night?"1/125s":"1/200s",iso:night?1600:200,whiteBalanceK:night?3800:5600,framing:d.framing.fa,lighting:d.lighting.fa,focus:d.focus.fa,aspectRatio:vertical?"9:16":"4:5"}
  :{look:d.look.fa,focalLengthMm:35,aperture:night?"f/2.8":"f/5.6",shutter:night?"1/60s":"1/250s",iso:night?1600:100,whiteBalanceK:night?4000:5600,framing:d.framing.fa,lighting:d.lighting.fa,focus:d.focus.fa,aspectRatio:vertical?"9:16":"3:2"};
 // Diagram staging, consistent with the camera and shot text above: a soft key at 45 degrees with fill and rim for people, directional daylight (or practicals and moon at night) for scenes.
 const warm=night?3200:camera.whiteBalanceK;
 // The subject decides what the diagrams show; person scenes get a 45-degree soft key with fill and rim, objects a soft product light, open scenes daylight or practicals.
 const subject=detectSubject(p,Boolean(ref)),props=detectProps(p,subject);
 const staging:Staging=subject==="person"
  ?{subject,props,cameraAngle:"eye_level",shotSize:portrait?"medium_close_up":"medium",lights:[
    {role:"key",direction:"front_left",height:"high",quality:"soft",source:night?"practical":"softbox",colorTemperatureK:warm},
    {role:"fill",direction:"front_right",height:"eye",quality:"soft",source:night?"practical":"softbox",colorTemperatureK:warm},
    {role:"rim",direction:"back_right",height:"high",quality:"hard",source:night?"neon":"led_panel",colorTemperatureK:night?6500:5600,...(night?{colorHex:"#4f8cff"}:{})}]}
  :subject==="object"
   ?{subject,props,cameraAngle:"high",shotSize:"medium",lights:[{role:"key",direction:"front_left",height:"high",quality:"soft",source:"softbox",colorTemperatureK:5600},{role:"rim",direction:"back_right",height:"high",quality:"hard",source:"led_panel",colorTemperatureK:6000}]}
   :{subject,props,cameraAngle:"eye_level",shotSize:subject==="environment"?"wide":"full",lights:night
     ?[{role:"key",direction:"front_left",height:"eye",quality:"soft",source:"practical",colorTemperatureK:3200},{role:"fill",direction:"back",height:"high",quality:"soft",source:"moon",colorTemperatureK:7500}]
     :[{role:"key",direction:"back_left",height:"high",quality:"hard",source:"sun",colorTemperatureK:5600},{role:"fill",direction:"top",height:"high",quality:"soft",source:"sky",colorTemperatureK:7000}]};
 const gens=req.generations??[],revision=gens[0];
 const mv=MOVES.find(([re])=>re.test(p))?.[1]??DOLLY;
 const size=portrait?P("medium close-up","نمای نزدیک متوسط"):P("wide establishing shot","نمای باز معرفی صحنه");
 const notes=[P("First, middle and last frames share identity, wardrobe, lighting direction and palette","فریم اول، میانی و آخر هویت، لباس، جهت نور و پالت رنگی یکسان دارند"),P("Natural motion blur from the 180 degree shutter; no FPS drift","محوشدگی حرکتی طبیعی از شاتر ۱۸۰ درجه؛ بدون نوسان فریم‌ریت")];
 const shot={shotSize:size.fa,cameraMovement:mv.fa,lens:portrait?"معادل لنز ۵۰ میلی‌متر":"معادل لنز ۲۸ میلی‌متر",targetFps:24,shutterAngle:180,durationSeconds:dur?Math.min(60,Math.max(1,Number(dur[1]))):5,blocking:"حرکت سوژه دلیل مشخص دارد و خوانا است؛ محور دوربین و جهت حرکت روی صفحه ثابت می‌ماند",continuityNotes:fas(notes)};
 const lips=ids.includes("persian_lip_sync_phonetics"),speech=input.audio?.hasSpeech===true;
 const rd=roleDirectives(req.attachments),byTag=tagMap(req.attachments),sd=styleDirectives(input.style,hasCharacterRef(req));
 const hardP:Pair[]=[P("Follow the brief exactly; do not add unrequested subjects, text or logos","دقیقاً مطابق توضیح تو؛ سوژه، متن یا لوگوی اضافه‌ای وارد نمی‌شود"),
  ...gens.map(g=>P("Revise "+"[earlier generation "+g.tag.replace(/\D/g,"")+"]"+": apply only the requested changes and keep its subject, composition, camera, lighting and style otherwise","در "+displayTag(g.tag)+" فقط تغییرهای خواسته‌شده اعمال می‌شود؛ سوژه، ترکیب‌بندی، دوربین، نور و سبک آن بقیه‌اش همان می‌ماند")),
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
 const anglesNote=ref?missingAnglesNote(ref.angles):undefined;
 const soft=[...(anglesNote?[anglesNote]:[]),...fas(sd.soft),kind==="image"?"نسبت تصویر "+faDigits(camera.aspectRatio):"کادر مناسب پلتفرم با جذابیت واضح در ثانیهٔ اول",...fas(rd.soft),...(night?["حال‌وهوای کم‌نور با منابع نور واقعی صحنه"]:[]),
  ...(docs?[faDigits(String(docs))+" سند متنی به‌عنوان زمینه همراه درخواست ثبت شد؛ برنامهٔ آزمایشی هنوز محتوای آن‌ها را اعمال نمی‌کند"]:[]),...(pdfs?[FA_PDF_NOTE]:[])];
 const direction=kind==="image"?[camera.focalLengthMm+"mm",camera.aperture,camera.shutter,"ISO "+camera.iso,camera.whiteBalanceK+"K",d.framing.en,d.lighting.en]:[size.en,mv.en,shot.targetFps+"fps",shot.shutterAngle+" degree shutter",shot.durationSeconds+"s"];
 // The user's text gets whatever budget the direction, hard constraints and role lines leave, so the constraints at the end are never cut off.
 const rest="\nDirection: "+direction.join(", ")+". "+ens(directivesP).join(". ")+". "+ens(hardP).join(". ")+(rd.locks.length||rd.soft.length||sd.soft.length?". "+ens([...rd.locks,...rd.soft,...sd.soft]).join(". "):"");
 const genTags=new Set(gens.map(g=>g.tag));
 const restEn=rewriteMentions(rest,byTag,genTags),prompt=(rewriteMentions(text,byTag,genTags).slice(0,Math.max(200,3000-restEn.length))+restEn).slice(0,3000);
 const plan:CreativePlan={
  intentSummaryFa:(revision?"تغییر "+displayTag(revision.tag)+": ":kind==="image"?"ساخت تصویر: ":"ساخت ویدیو: ")+text.replace(/\s+/g," ").slice(0,160)+(text.length>160?"…":""),
  mediaKind:kind,
  mediaPrompt:prompt,
  hardConstraints:hard,
  softPreferences:soft,
  negative:["extra fingers","distorted anatomy","garbled or misspelled text","watermark",...(photoreal?["waxy or plastic skin","over-smoothing","gratuitous grain, glow or filters"]:[])],
  camera:kind==="image"?camera:undefined,shot:kind==="video"?shot:undefined,staging,
  identityLock:ref?{characterId:ref.id,version:ref.version,providedAngles:[...ref.angles],lockedAttributes:["هندسهٔ چهره","مدل مو و خط رویش مو","رنگ و بافت پوست","تناسب بدن","سن ظاهری","لباس، مگر تغییرش خواسته شود"],allowedChanges:["ژست و حالت چهره","محیط و نور طبق درخواست","زاویهٔ دوربین"]}:undefined,
  continuity:{locks:["هویت، لباس، مدل مو، وسایل و پالت رنگی در همهٔ فریم‌ها و بازبینی‌ها یکسان می‌ماند","جهت نور و ساعت روز ثابت است، مگر اینکه توضیح تو آن را تغییر بدهد","هر چیزی که درخواست تغییرش نشده، دست‌نخورده می‌ماند",...fas(rd.locks)],
   antiTeleport:kind==="video"?["هر فرد و شیء پایدار می‌ماند: بدون ظاهر یا ناپدید شدن ناگهانی","تماس دست با اشیا و مسیر حرکت‌ها از نظر فیزیکی قابل‌باور می‌ماند","میان فریم‌های پیاپی پرش ناگهانی در موقعیت وجود ندارد"]:[]},
  realism:{mode:photoreal?"photoreal":"stylized",directives},
  speech:kind==="video"?{lipSync:lips?{status:speech?"planned_from_audio":"needs_audio",notes:speech?["زمان‌بندی دهان از روی صدای ارائه‌شده استخراج می‌شود، نه از زمان‌بندی حدسیِ متن","صدا، کلمات و لهجهٔ فایل اصلی بدون تغییر می‌ماند",...(ids.includes("tehrani_accent")?["لهجهٔ تهرانی فقط هدف خلاقانه برای دیالوگ تازه‌نوشته‌شده است؛ صدای ارائه‌شده هرگز تغییر نمی‌کند"]:[])]:["برای هم‌زمان‌سازی لب، فایل صوتی گفتار را ارائه کن؛ زمان‌بندی هرگز فقط از روی متن حدس زده نمی‌شود"]}:{status:"not_requested",notes:[]},accent:ids.includes("tehrani_accent")?"tehrani":input.audio?.accent==="original"?"original":"unspecified"}:undefined,
  qaChecklist:["سوژه، تعداد و ترکیب‌بندی با توضیح تو می‌خواند","آناتومی، دست‌ها و هندسه قابل‌باورند","متن فارسی یا انگلیسی داخل تصویر درست نوشته شده و حروف فارسی به‌هم‌پیوسته‌اند",kind==="video"?"فریم اول، میانی و آخر هویت و نور را حفظ می‌کنند؛ شیئی ناگهان جابه‌جا نمی‌شود؛ مدت و فریم‌ریت با پرامپت می‌خواند":"نور، نوردهی و پرسپکتیو یکدست است",...(photoreal?["پوست و مواد طبیعی دیده می‌شوند، نه مومی یا بیش‌ازحد فیلترشده"]:[])]
 };
 return {plan};
}
// ---- invariants: planner output is untrusted ----
function enforce(raw:CreativePlan,req:PlannerRequest):{plan:CreativePlan;corrections:string[]}{
 const c:string[]=[],det=deterministicPlanner(req).plan as CreativePlan,p:CreativePlan={...raw},{kind,input,activeSkillIds:ids}=req,ref=input.characterRef;
 const note=(n:string,cond:boolean)=>{if(cond)c.push(n);return cond;};
 if(note("media_kind",p.mediaKind!==kind))p.mediaKind=kind;
 if(kind==="image"){if(note("shot_dropped",Boolean(p.shot)))delete p.shot;if(note("camera_filled",!p.camera))p.camera=det.camera;}
 // Diagram data only: filled from the deterministic plan when missing, without counting as a correction (it must never trigger escalation).
 if(!p.staging)p.staging=det.staging;
 else if(note("shot_filled",!p.shot))p.shot=det.shot;
 if(note("continuity_filled",!p.continuity.locks.length||(kind==="video"&&!p.continuity.antiTeleport.length)))p.continuity={locks:p.continuity.locks.length?p.continuity.locks:det.continuity.locks,antiTeleport:kind==="video"&&!p.continuity.antiTeleport.length?det.continuity.antiTeleport:p.continuity.antiTeleport};
 if(!ref){if(note("identity_dropped",Boolean(p.identityLock)))delete p.identityLock;}
 else{
  const il=p.identityLock??det.identityLock!;
  note("identity_overwritten",!p.identityLock||il.characterId!==ref.id||il.version!==ref.version||il.providedAngles.join()!==ref.angles.join());
  p.identityLock={...il,characterId:ref.id,version:ref.version,providedAngles:[...ref.angles],lockedAttributes:il.lockedAttributes.length?il.lockedAttributes:det.identityLock!.lockedAttributes};
  // Missing angles are a note in the plan, never a question (Whoush continues with what it has); added silently, not counted as a correction.
  const anglesNote=missingAnglesNote(ref.angles);
  if(anglesNote&&!p.softPreferences.includes(anglesNote))p.softPreferences=[anglesNote,...p.softPreferences];
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
/** The same filter for a single customer-facing text (the chat reply). */
const leakText=(text:string,userText:string)=>{const j=text.toLowerCase(),u=userText.toLowerCase();return FORBIDDEN.some(t=>j.includes(t)&&!u.includes(t))||FAMILY_WORDS.some(r=>r.test(j)&&!r.test(u));};
const leaks=(pub:PublicCreativePlan,userText:string)=>{const j=JSON.stringify(pub).toLowerCase(),u=userText.toLowerCase();return FORBIDDEN.some(t=>j.includes(t)&&!u.includes(t))||FAMILY_WORDS.some(r=>r.test(j)&&!r.test(u));};
// ---- private prompt store for the generation phase (bounded, server memory only) ----
const MAX_PROMPTS=200;
const store=()=>((globalThis as {__whoushPrompts?:Map<string,string>}).__whoushPrompts??=new Map());
export const getPrivateMediaPrompt=(turnId:string):string|undefined=>store().get(turnId);
/**
 * The scene the user arranged in «بوم» before pressing «بساز»: a new private turn derived from `turnId`, with the arranged staging (enum values and prop kinds
 * only, never free text) appended to the provider-facing prompt as the deciding direction. The original turn is untouched; quotes bind to the new one.
 * Undefined when the original turn is unknown or expired.
 */
export function deriveTurnWithStaging(turnId:string,staging:Staging,aspect?:string):string|undefined{
 const base=store().get(turnId);if(base===undefined)return undefined;
 // The lens follows the adjusted scene (Whoush's choice for what it now shows), so the camera direction never contradicts it.
 // The user's camera and light open the prompt in plain words (the model weighs the start; a long description before them outweighed them), and the
 // full scene follows at the end; the planner's own text sits between, cut to fit.
 const lead=sceneLeadEn(staging)+" ";
 const extra=" User-adjusted scene (overrides any earlier camera, framing or lighting direction): "+describeStagingEn(staging)+describeFocus(staging,undefined,aspect??"16:9").en+" "+lensFor(staging).en+(aspect?" Aspect ratio "+aspect+".":"");
 const id=randomUUID();keepPrompt(id,(lead+base.slice(0,Math.max(0,3000-extra.length-lead.length))+extra).slice(0,3000));
 return id;
}
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
 const raw=CreativeTurnInputSchema.parse(rawInput);
 // Mappings typed in the brief («#زن:تصویر-۱»: this prop looks like that file) are kept aside; the planner reads them as «#زن (#تصویر-۱)», an ordinary mention.
 const typed=typedMappings(raw.text),parsed={...raw,text:expandMappings(raw.text)},audit=deps.audit??defaultAuditSink,now=deps.now??(()=>new Date());
 const stage=(x:TurnStage)=>{try{deps.onStage?.(x);}catch{ /* progress is best effort */ }};
 stage("reading");
 const safety=evaluateTextSafety(parsed.text);
 if(safety.decision!=="allow")return {status:"restricted",decision:safety.decision,category:safety.category,message:safety.message};
 // A role is optional: media without one gets Whoush's best guess from the words of the brief (no media analysis), before skills resolve.
 // Inferred roles drive the same skills, constraints, kind override and requirements as chosen ones; `voice_clone` is never inferred.
 const given=parsed.attachments??[],roles=new Map(inferAttachmentRoles(parsed.text,given).map(r=>[r.tag,r]));
 const files0:Array<Omit<(typeof given)[number],"role">&{role?:AttachmentRole;roleSource?:RoleSource}>=given.map(f=>{const r=roles.get(f.tag);return r?{...f,role:r.role,roleSource:r.roleSource}:f;});
 // Something only a photo can keep (the user's tattoos, logo, product, face, outfit): its photos get the right role (a user's own choice stays), and without
 // any photo Whoush asks for exactly the ones it needs, once (an answer without photos goes ahead without them).
 const need=detectReferenceNeeds(normalizePersian(parsed.text))[0];
 // A general reference («عکس رفرنس») is resolved by the brief's words; for a detail like a tattoo it stays the general reference it already is.
 const fits=(f:{role?:AttachmentRole})=>Boolean(need)&&(f.role===need!.role||(need!.role==="reference"&&f.role==="general"));
 const needPhotos=need?files0.filter(f=>f.kind==="image"&&(fits(f)||!f.role||f.roleSource==="inferred")):[];
 // Asked only when the message brought no photo at all (a photo the user gave another role is theirs to decide).
 if(need&&!files0.some(f=>f.kind==="image")&&!parsed.answersQuestion){
  const ask=replyScriptFor(parsed.text)==="finglish"?need.askFinglish:need.askFa;
  return {status:"needs_input",turnId:randomUUID(),message:ask,question:need.askFa,references:{need:need.id,titleFa:need.titleFa,role:need.role,angles:need.angles.map(a=>({id:a.id,titleFa:a.titleFa}))}};
 }
 const needTags=new Set(needPhotos.map(f=>f.tag));
 const files=files0.map(f=>needTags.has(f.tag)&&need&&!fits(f)?{...f,role:need.role==="reference"?"general":need.role,roleSource:"inferred" as RoleSource}:f);
 // Text attachments are user text: they get the same preflight before any planner sees them.
 for(const f of files){
  if(!f.textExcerpt)continue;
  const r=evaluateTextSafety(f.textExcerpt);
  if(r.decision!=="allow")return {status:"restricted",decision:r.decision,category:r.category,message:FA_TEXT_BLOCKED+r.message};
 }
 // Summaries of earlier generations come from the browser: user data like excerpts, with the same preflight.
 const generations=parsed.generations??[];
 // Recent turns are client-sent text: each gets the same preflight as the brief, and a turn that fails it is simply left out (it never blocks today's message).
 const history=(parsed.history??[]).filter(t=>evaluateTextSafety(t.text).decision==="allow");
 const script=replyScriptFor(parsed.text);
 for(const g of generations){
  const r=evaluateTextSafety(g.summaryFa);
  if(r.decision!=="allow")return {status:"restricted",decision:r.decision,category:r.category,message:FA_TEXT_BLOCKED+r.message};
 }
 // Planners see attachments only through `req.attachments` (kinds and excerpts as data); the audio flags are merged into `input.audio`.
 // An edit_reference (image or video) makes the turn an edit, which brings photo_editor or video_editor.
 const task=parsed.task!=="character"&&files.some(f=>f.role==="edit_reference")?"edit":parsed.task;
 const input={...parsed,task,visualStyle:parsed.style?STYLE_VISUAL[parsed.style]:parsed.visualStyle,audio:deriveAudio({...parsed,attachments:files}),attachments:undefined,generations:undefined,history:undefined,stagingOverride:undefined,aspectOverride:undefined};
 // A video attachment (every media attachment carries a role), a lip_sync audio or a start_frame or end_frame image makes the output a video even when the text sounds like
 // an image request. Such a turn always has media, so it stops at the media-review check below and never reaches `buildProposal`, which re-detects from the text.
 const kind=files.some(f=>f.kind==="video"||(f.kind==="audio"&&f.role==="lip_sync")||(f.kind==="image"&&(f.role==="start_frame"||f.role==="end_frame")))?"video":generations.length&&detectMediaKind(input.text)!=="video"?generations[0].mediaKind:detectMediaKind(input.text),a=input.audio,ref=input.characterRef;
 const refs:PublicReference[]=files.flatMap(f=>isMediaKind(f.kind)&&f.role?[{tag:f.tag,kind:f.kind,role:f.role,roleSource:f.roleSource??"user",labelFa:roleLabelFa(f.role,f.kind)}]:[]);
 const have=new Set([...files.map(f=>f.tag),...generations.map(g=>g.tag)]),mentionedMissing=parseMentions(input.text).filter(t=>!have.has(t)),byTag=tagMap(files),genTags=new Set(generations.map(g=>g.tag));
 const missing=mentionedMissing.filter(t=>!isGenerationTag(t)),missingGenerations=mentionedMissing.filter(isGenerationTag);
 const prep=preparePrivateCreativeRequest({prompt:input.text,kind,task:input.task,attachmentRoles:files.flatMap(f=>f.role?[f.role]:[]),hasReferences:Boolean(ref||a?.hasAudioReference||files.length),hasAudioReference:a?(a.hasAudioReference||a.hasSpeech):undefined,hasSpeechAudio:a?.hasSpeech,speechLanguage:a?.language,accent:a?.accent,characterRef:ref,visualStyle:input.visualStyle});
 const req:PlannerRequest={...prep,privateRoute:prep.privateRoute&&{provider:prep.privateRoute.provider,modelId:prep.privateRoute.modelId},kind,input,...(files.length?{attachments:files.map(f=>({tag:f.tag,kind:f.kind,...(f.role?{role:f.role,roleSource:f.roleSource??"user"}:{}),...(f.textExcerpt?{textExcerpt:f.textExcerpt}:{})}))}:{}),...(generations.length?{generations:generations.map(g=>({...g}))}:{}),...(history.length?{history}:{}),replyScript:script,...(parsed.stagingOverride?{stagingOverride:parsed.stagingOverride}:{})};
 const turnId=randomUUID();
 const rec=(x:Partial<PrivateAuditRecord>)=>audit.record({turnId,at:now().toISOString(),skillRegistryVersion:SKILL_REGISTRY_VERSION,activeSkillIds:[...prep.activeSkillIds],reasoningTier:prep.privateReasoningTier,route:req.privateRoute,planner:"deterministic",...(input.style?{style:input.style}:{}),promptSha256:createHash("sha256").update(input.text).digest("hex"),...(routing?{routing}:{}),...(files.length?{attachments:files.map(f=>({tag:f.tag,...(f.role?{role:f.role,roleSource:f.roleSource??"user"}:{}),kind:f.kind,bytes:f.bytes,sha256:f.sha256}))}:{}),...x});
 let label:PrivateAuditRecord["planner"]=deps.planner&&deps.planner!==deterministicPlanner?"live":"deterministic",fallbackReason:string|undefined;
 let result:PlannerResult|undefined,fin:{e?:{plan:CreativePlan;corrections:string[]};reason?:string}={reason:"planner_error"};
 const finalize=(raw:unknown)=>{
  const v=CreativePlanSchema.safeParse(raw);if(!v.success)return {reason:"invalid_output"};
  const e=enforce(v.data,req);return leaks(toPublicPlan(e.plan),input.text)?{reason:"leak_filtered"}:{e};
 };
 // One attempt: call a planner, then validate, enforce invariants and leak-filter its output. `refused` is reported, never retried here.
 type Outcome="ok"|"refused"|"planner_unavailable"|"invalid_output"|"leak_filtered"|"planner_error";
 const attempt=async(pl:PrivatePlanner):Promise<{outcome:Outcome;result?:PlannerResult;fin?:{e?:{plan:CreativePlan;corrections:string[]};reason?:string};limit?:"rate"|"quota";retryAfterMs?:number}>=>{
  let r:PlannerResult;
  try{r=await pl(req);}
  catch(e){
   if(e instanceof PlannerUnavailableError)return {outcome:"planner_unavailable",...(e.limit?{limit:e.limit}:{}),...(e.retryAfterMs!==undefined?{retryAfterMs:e.retryAfterMs}:{})};
   return {outcome:e instanceof PlannerRefusedError?"refused":e instanceof PlannerInvalidOutputError?"invalid_output":"planner_error"};
  }
  const f=finalize(r.plan);
  return {outcome:f.e?"ok":(f.reason as Outcome),result:r,fin:f};
 };
 const refusedResult=():OrchestratorResult=>({status:"restricted",decision:"review",category:"none",message:FA_REFUSED});
 stage("planning");
 let routing:RoutingAudit|undefined;
 if(deps.planner){
  const o=await attempt(deps.planner);
  if(o.outcome==="refused"){rec({planner:label,fallbackReason:"planner_refused"});return refusedResult();}
  result=o.result;if(o.fin)fin=o.fin;
  if(!fin.e){label="deterministic";fallbackReason=o.outcome==="ok"?fin.reason:o.outcome;}
 }else{
  const gate=llmGate();
  if(!gate.live)fallbackReason=gate.reason;
  else{
   // Task-based routing: profile the task, take the band's ladder (minus unavailable rungs), try rungs in order within the attempt budget.
   // A refusal is a safety signal: it ends the turn as restricted and never moves to another model, unless the owner lists `refused` in `escalateOn`.
   const cfg=deps.routing??loadRoutingConfig(),state=deps.routerState??defaultRouterState(),prof=profileTask(input,kind,prep.activeSkillIds,req.attachments);
   const chars=req.systemInstructions.length+req.userText.length+(req.attachments??[]).reduce((n,x)=>n+(x.textExcerpt?.length??0),0)+(req.generations??[]).reduce((n,g)=>n+g.summaryFa.length,0)+(req.history??[]).reduce((n,t)=>n+t.text.length,0);
   const route=planRoute(prof,{cfg,now:now(),state,inputChars:chars});
   routing={...prof,band:route.band,ladder:route.ladder,skipped:route.skipped,attempts:[],chosenModelId:null};
   if(!route.ladder.length)fallbackReason=route.skipped.some(x=>x.why==="cooldown")?"provider cooldown":route.skipped.some(x=>x.why==="no_key")?"api key not configured":"no route available";
   let best:{o:Awaited<ReturnType<typeof attempt>>;modelId:string}|undefined,last:Outcome="planner_error",made=0;
   // `made` counts real calls against the attempt budget. A rung whose provider stays busy (all in-flight slots taken past maxQueueWaitMs) is skipped without a call.
   for(let i=0;i<route.ladder.length&&made<cfg.escalation.maxAttemptsPerTurn;i++){
    const modelId=route.ladder[i],provider=providerForModelId(modelId)!;
    const release=await acquireProviderSlot(provider,cfg,state);
    if(!release){routing.skipped.push({modelId,why:"provider_busy"});continue;}
    made++;
    let o:Awaited<ReturnType<typeof attempt>>,t0=Date.now();
    try{
     req.privateRoute={provider,modelId};
     if(modelId===cfg.astra.modelId)countAstraCall(now(),state);
     const adapter=deps.plannerFor?.(modelId,provider)??(provider==="openai"?async(r:PlannerRequest)=>(await import("./llm-openai")).planWithOpenAI(r,modelId):async(r:PlannerRequest)=>(await import("./llm-anthropic")).planWithAnthropic(r,modelId));
     t0=Date.now();o=await attempt(adapter);
    }finally{release();}
    const usage=o.result?.usage,u=usage as {input_tokens?:number;output_tokens?:number}|undefined;
    routing.attempts.push({modelId,provider,outcome:o.outcome,latencyMs:Date.now()-t0,...(usage?{usage}:{}),estCostUsd:u&&typeof u.input_tokens==="number"&&cfg.prices[modelId]?(u.input_tokens*cfg.prices[modelId][0]+(u.output_tokens??0)*cfg.prices[modelId][1])/1e6:null,...(o.limit?{limit:o.limit}:{}),...(o.retryAfterMs!==undefined?{retryAfterMs:o.retryAfterMs}:{})} as RoutingAttempt);
    last=o.outcome;
    if(o.outcome==="planner_unavailable")markProviderCooldown(provider,now(),cfg,state,{limit:o.limit,retryAfterMs:o.retryAfterMs});
    if(o.outcome==="refused"&&!cfg.escalation.escalateOn.includes("refused")){rec({planner:"live",fallbackReason:"planner_refused",routing});return refusedResult();}
    const more=i+1<route.ladder.length&&made<cfg.escalation.maxAttemptsPerTurn;
    if(o.outcome==="ok"){
     best=o.fin?.e?{o,modelId}:best;
     if(more&&(o.fin!.e!.corrections.length>=cfg.escalation.escalateOnCorrectionsAtLeast))continue;
     break;
    }
    if(!(more&&(cfg.escalation.escalateOn as string[]).includes(o.outcome)))break;
   }
   if(best){label="live";result=best.o.result;fin=best.o.fin!;routing.chosenModelId=best.modelId;req.privateRoute={provider:providerForModelId(best.modelId)!,modelId:best.modelId};}
   else if(route.ladder.length){fallbackReason=!made?"provider busy":last==="refused"?"planner_refused":last;}
  }
 }
 if(!fin.e){
  if(!fallbackReason)fallbackReason=fin.reason;
  label="deterministic";fin=finalize(deterministicPlanner(req).plan);
 }
 if(!fin.e)throw new Error("deterministic planner produced an invalid plan");
 const {plan,corrections}=fin.e;
 // Provider-facing text names attachments by description; the public Persian text keeps what the user typed. A missing tag is a question, never a block.
 // A scene the user arranged in the diagrams is applied exactly: the staging, a hard constraint naming it and the provider-facing direction.
 // The canvas is the source of truth for the provider. Without the user's own arrangement: a planner's props are tidied (crowded or all lifted means
 // misread), what the brief says explicitly (angle, shot size, side, lighting words) wins over the planner's choice, and the resulting scene is written into
 // the provider prompt as the deciding direction, so the output follows what the canvas shows.
 if(plan.staging&&!parsed.stagingOverride){
  plan.staging=applyStagingCues({...plan.staging,props:mapReferences(applyTypedMappings(tidyProps(plan.staging.props),typed),refs.map(r=>need&&needTags.has(r.tag)?{...r,mapsTo:need.mapsTo}:r))},normalizePersian(parsed.text));
  // Whoush picks the lens for the scene it built (the same rule as for an arranged one), so the plan, the canvas and the build agree.
  const lens=lensFor(plan.staging);
  if(plan.camera)plan.camera={...plan.camera,focalLengthMm:lens.focalLengthMm,aperture:lens.aperture,iso:lens.iso,focus:lens.fa};
  if(plan.shot)plan.shot={...plan.shot,lens:lens.focalLengthMm+"mm "+lens.aperture};
  const en=" Scene (must match): "+describeStagingEn(plan.staging)+describeFocus(plan.staging,undefined,plan.camera?.aspectRatio??"16:9").en+" "+lens.en;
  plan.mediaPrompt=plan.mediaPrompt.slice(0,Math.max(0,3000-en.length))+en;
 }
 // Keeping it is a hard rule, naming the photos (the provider-facing text names them by description).
 if(need&&needTags.size){
  // The photos are kept exactly: the general reference's «loose reference, do not copy its details» rule would contradict that, so it goes.
  for(const t of needTags){
   const loose=roleRule("image","general",t).hard;
   if(loose){plan.hardConstraints=plan.hardConstraints.filter(c=>c!==loose.fa);plan.mediaPrompt=plan.mediaPrompt.split(loose.en).join("");}
  }
  const shown=[...needTags].map(displayTag).join("، "),fa=need.keepFa(shown),en=" "+need.keepEn([...needTags].map(displayTag).join(", "));
  if(!plan.hardConstraints.includes(fa))plan.hardConstraints=[...plan.hardConstraints,fa];
  plan.mediaPrompt=plan.mediaPrompt.slice(0,Math.max(0,3000-en.length))+en;
 }
 if(parsed.aspectOverride&&plan.camera&&plan.camera.aspectRatio!==parsed.aspectOverride){
  plan.camera={...plan.camera,aspectRatio:parsed.aspectOverride};
  const en=" Aspect ratio "+parsed.aspectOverride+".";plan.mediaPrompt=plan.mediaPrompt.slice(0,Math.max(0,3000-en.length))+en;
 }
 if(parsed.stagingOverride){
  const o=parsed.stagingOverride,lens=lensFor(o),asp=parsed.aspectOverride??plan.camera?.aspectRatio??"16:9",focus=describeFocus(o,undefined,asp);
  const fa=describeStagingFa(o)+(focus.fa?"؛ "+focus.fa:""),en=" "+describeStagingEn(o)+focus.en+" "+lens.en;
  plan.staging=o;
  // Whoush re-picks the lens for the scene the user arranged: focal length and aperture (bokeh or deep focus, macro when it is that close).
  if(plan.camera)plan.camera={...plan.camera,focalLengthMm:lens.focalLengthMm,aperture:lens.aperture,iso:lens.iso,focus:lens.fa};
  if(plan.shot)plan.shot={...plan.shot,lens:lens.focalLengthMm+"mm "+lens.aperture};
  if(!plan.hardConstraints.includes(fa))plan.hardConstraints=[...plan.hardConstraints,fa];
  plan.mediaPrompt=plan.mediaPrompt.slice(0,Math.max(0,3000-en.length))+en;
 }
 plan.mediaPrompt=rewriteMentions(plan.mediaPrompt,byTag,genTags).slice(0,3000);
 stage("checking");
 // plan inspection: LLM output never bypasses the safety layer
 for(const t of [plan.mediaPrompt,...plan.hardConstraints]){
  const r=evaluatePlanTextSafety(t); // planner text: negated generic categories ("no political banners") are compliance, not violations
  if(r.decision!=="allow"){rec({planner:label,fallbackReason:"plan_restricted",corrections,usage:result?.usage});return {status:"restricted",decision:r.decision,category:r.category,message:r.message};}
 }
 // The chat reply: the planner's, in Whoush's voice and the user's script, when it passes the plan-text safety check and the leak filter; otherwise Whoush's own line.
 const planReply=plan.reply;delete plan.reply;
 const own=(kind:"planned"|"needsInput")=>generations.length&&kind==="planned"?pickLine(VOICE[script].revision(displayTag(generations[0].tag)),turnId):pickLine(VOICE[script][kind],turnId);
 // A Finglish reply must be Latin letters only (tags such as #تولید-۱ excepted); a reply that mixes scripts falls back to Whoush's own Finglish line.
 const mixedScript=(t:string)=>script==="finglish"&&/[\u0600-\u06ff]/.test(t.replace(/[#@][^\s]+/g," "));
 const usable=(t:string|undefined)=>Boolean(t)&&evaluatePlanTextSafety(t!).decision==="allow"&&!leakText(t!,input.text)&&!mixedScript(t!);
 const replyText=(kind:"planned"|"needsInput")=>usable(planReply?.text)?planReply!.text:own(kind);
 // A GIF only on a planned turn, only when the planner chose a mood, and never when one of the last three Whoush turns already had one.
 const recentGif=history.filter(t=>t.role==="agent").slice(-3).some(t=>t.gif);
 const gifMood=planReply?.gif&&!recentGif?planReply.gif:undefined;
 // Whoush's emoji reaction on the user's message (from the shared palette; the schema already rejects anything else).
 const reaction=planReply?.react??undefined;
 // One critical question stops the turn before any model or price is offered: a mentioned file or generation that is not in the chat, or the planner's own question.
 // A message that answers an earlier question is never asked again: Whoush decides, and a reference that is still missing is left out with a note in the plan.
 const missingNote=[missing.length?faMissing(missing):"",missingGenerations.length?faMissingGenerations(missingGenerations):""].filter(Boolean);
 const question=input.answersQuestion?"":[...missingNote,plan.clarifyingQuestionFa??""].filter(Boolean).join(" ").slice(0,400);
 if(input.answersQuestion&&(missing.length||missingGenerations.length))plan.softPreferences=[[...missing,...missingGenerations].map(displayTag).join("، ")+" در این گفت‌وگو نیست؛ هووش بدون آن می‌سازد",...plan.softPreferences];
 delete plan.clarifyingQuestionFa;
 if(question){
  const r=evaluatePlanTextSafety(question);
  if(r.decision!=="allow"){rec({planner:label,fallbackReason:"plan_restricted",corrections,usage:result?.usage});return {status:"restricted",decision:r.decision,category:r.category,message:r.message};}
  rec({planner:label,fallbackReason:"needs_input",corrections:corrections.length?corrections:undefined,usage:label==="live"?result?.usage:undefined});
  return {status:"needs_input",turnId,message:replyText("needsInput"),question,...(reaction?{reaction}:{})};
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
 stage("pricing");
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
 // The proposal speaks in Whoush's voice; a rejected explicit model request keeps its factual note after the reply.
 proposal={...proposal,message:replyText("planned")+(proposal.explicitRejected?"\n"+proposal.message:"")};
 const gif=gifMood?await (deps.findGif??findGif)(gifMood).catch(()=>undefined):undefined;
 return {status:"planned",turnId,proposal,plan:toPublicPlan(plan,refs,undefined,input.style),...(gif?{gif}:{}),...(reaction?{reaction}:{})};
}
