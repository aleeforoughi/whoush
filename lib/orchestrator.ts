import "server-only";
import {createHash,randomUUID} from "node:crypto";
import {buildProposal,NoCompatibleModelError} from "./agent";
import {CHARACTER_VIEWS,REQUIRED_CHARACTER_VIEWS} from "./characters";
import {CreativePlanSchema,CreativeTurnInputSchema,toPublicPlan,PlannerInvalidOutputError,PlannerRefusedError,PlannerUnavailableError,type CreativePlan,type PlannerRequest,type PlannerResult,type PrivatePlanner,type PublicCreativePlan} from "./creative-plan";
import {llmPolicy,preparePrivateCreativeRequest} from "./llm";
import {defaultAuditSink,type PrivateAuditRecord,type PrivateAuditSink} from "./private-audit";
import {detectMediaKind} from "./router";
import {evaluateTextSafety,normalizePersian,type SafetyCategory} from "./safety";
import {SKILLS,SKILL_REGISTRY_VERSION} from "./skills";
import type {GenerationProposal} from "./types";
export type OrchestratorDeps={planner?:PrivatePlanner;audit?:PrivateAuditSink;now?:()=>Date};
export type OrchestratorResult=
 |{status:"planned";turnId:string;proposal:GenerationProposal;plan:PublicCreativePlan}
 |{status:"unsupported";turnId:string;plan:PublicCreativePlan;message:string}
 |{status:"restricted";decision:"block"|"review";category:SafetyCategory;message:string};
const FA_REFUSED="این درخواست در حال حاضر قابل پردازش نیست. لطفاً آن را با توضیح غیرحساس‌تر دوباره بنویس.";
const FA_NO_REFS="برنامه تولید با کاراکتر انتخاب‌شده آماده است، اما هنوز هیچ مدل تأییدشده‌ای عکس مرجع کاراکتر را نمی‌پذیرد؛ برای همین فعلاً پیشنهاد تولید و هزینه نمایش داده نمی‌شود.";
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
 const hardP:Pair[]=[P("Follow the brief exactly; do not add unrequested subjects, text or logos","دقیقاً مطابق توضیح تو؛ سوژه، متن یا لوگوی اضافه‌ای وارد نمی‌شود"),
  ...(input.task==="edit"?[P("Preserve all unedited source regions: identity, framing, lighting, color and pixels","همهٔ بخش‌های ویرایش‌نشدهٔ تصویر مبدأ حفظ می‌شود: هویت، کادر، نور، رنگ و پیکسل‌ها")]:[]),
  ...(kind==="video"?[P("Keep people and objects continuous; no teleporting, sudden appearance or unintended cuts","افراد و اشیا پیوسته می‌مانند؛ بدون جابه‌جایی ناگهانی، ظاهر یا ناپدید شدن ناگهانی و برش ناخواسته")]:[]),
  ...(ref?[P("Use only the provided reference angles; never invent missing views","فقط از زاویه‌های مرجع ارائه‌شده استفاده می‌شود؛ نمای ناموجود ساخته نمی‌شود")]:[])];
 const directivesP:Pair[]=photoreal
  ?[P("Natural skin microtexture with visible pores, fine hairs and subtle asymmetry where people appear","بافت ریز طبیعی پوست با منافذ قابل‌دیدن، موهای ریز و کمی عدم تقارن، هرجا آدمی دیده می‌شود"),P("No waxy, plastic or over-smoothed skin","پوست مومی، پلاستیکی یا بیش‌ازحد صاف نباشد"),P("Physically accurate materials: fabric weave, metal, glass, wood, stone","مواد با رفتار فیزیکی درست: بافت پارچه، فلز، شیشه، چوب و سنگ"),P("No gratuitous film grain, glow, haze or stylistic filters unless requested","بدون گرین فیلم، درخشش، مه یا فیلتر سبکیِ بی‌دلیل، مگر اینکه خواسته شود"),P("Balanced exposure with natural highlight roll-off","نوردهی متعادل با افت طبیعی نواحی روشن")]
  :[P("Respect the requested stylized look; do not impose photographic textures or lens artifacts","سبک خواسته‌شده رعایت می‌شود؛ بافت عکاسی یا خطاهای لنز تحمیل نمی‌شود"),P("Keep line, palette and shading consistent across the whole frame","خط، پالت رنگی و سایه‌پردازی در کل کادر یکدست می‌ماند")];
 const directives=fas(directivesP);
 const hard=fas(hardP);
 const soft=[kind==="image"?"نسبت تصویر "+faDigits(camera.aspectRatio):"کادر مناسب پلتفرم با جذابیت واضح در ثانیهٔ اول",...(night?["حال‌وهوای کم‌نور با منابع نور واقعی صحنه"]:[])];
 const direction=kind==="image"?[camera.focalLengthMm+"mm",camera.aperture,camera.shutter,"ISO "+camera.iso,camera.whiteBalanceK+"K",d.framing.en,d.lighting.en]:[size.en,mv.en,shot.targetFps+"fps",shot.shutterAngle+" degree shutter",shot.durationSeconds+"s"];
 const plan:CreativePlan={
  intentSummaryFa:(kind==="image"?"ساخت تصویر: ":"ساخت ویدیو: ")+text.replace(/\s+/g," ").slice(0,160)+(text.length>160?"…":""),
  mediaKind:kind,
  mediaPrompt:(text.slice(0,1700)+"\nDirection: "+direction.join(", ")+". "+ens(directivesP).join(". ")+". "+ens(hardP).join(". ")).slice(0,3000),
  hardConstraints:hard,
  softPreferences:soft,
  negative:["extra fingers","distorted anatomy","garbled or misspelled text","watermark",...(photoreal?["waxy or plastic skin","over-smoothing","gratuitous grain, glow or filters"]:[])],
  camera:kind==="image"?camera:undefined,shot:kind==="video"?shot:undefined,
  identityLock:ref?{characterId:ref.id,version:ref.version,providedAngles:[...ref.angles],lockedAttributes:["هندسهٔ چهره","مدل مو و خط رویش مو","رنگ و بافت پوست","تناسب بدن","سن ظاهری","لباس، مگر تغییرش خواسته شود"],allowedChanges:["ژست و حالت چهره","محیط و نور طبق درخواست","زاویهٔ دوربین"]}:undefined,
  continuity:{locks:["هویت، لباس، مدل مو، وسایل و پالت رنگی در همهٔ فریم‌ها و بازبینی‌ها یکسان می‌ماند","جهت نور و ساعت روز ثابت است، مگر اینکه توضیح تو آن را تغییر بدهد","هر چیزی که درخواست تغییرش نشده، دست‌نخورده می‌ماند"],
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
const leaks=(pub:PublicCreativePlan,userText:string)=>{const j=JSON.stringify(pub).toLowerCase(),u=userText.toLowerCase();return FORBIDDEN.some(t=>j.includes(t)&&!u.includes(t));};
// ---- private prompt store for the generation phase (bounded, server memory only) ----
const MAX_PROMPTS=200;
const store=()=>((globalThis as {__whoushPrompts?:Map<string,string>}).__whoushPrompts??=new Map());
export const getPrivateMediaPrompt=(turnId:string):string|undefined=>store().get(turnId);
function keepPrompt(turnId:string,prompt:string){const m=store();m.set(turnId,prompt);while(m.size>MAX_PROMPTS)m.delete(m.keys().next().value as string);}
// ---- orchestration ----
export async function orchestrateCreativeTurn(rawInput:unknown,deps:OrchestratorDeps={}):Promise<OrchestratorResult>{
 const input=CreativeTurnInputSchema.parse(rawInput),audit=deps.audit??defaultAuditSink,now=deps.now??(()=>new Date());
 const safety=evaluateTextSafety(input.text);
 if(safety.decision!=="allow")return {status:"restricted",decision:safety.decision,category:safety.category,message:safety.message};
 const kind=detectMediaKind(input.text),a=input.audio,ref=input.characterRef;
 const prep=preparePrivateCreativeRequest({prompt:input.text,kind,task:input.task,hasReferences:Boolean(ref||a?.hasAudioReference),hasAudioReference:a?(a.hasAudioReference||a.hasSpeech):undefined,hasSpeechAudio:a?.hasSpeech,speechLanguage:a?.language,accent:a?.accent,characterRef:ref,visualStyle:input.visualStyle});
 const req:PlannerRequest={...prep,privateRoute:prep.privateRoute&&{provider:prep.privateRoute.provider,modelId:prep.privateRoute.modelId},kind,input};
 const turnId=randomUUID();
 const rec=(x:Partial<PrivateAuditRecord>)=>audit.record({turnId,at:now().toISOString(),skillRegistryVersion:SKILL_REGISTRY_VERSION,activeSkillIds:[...prep.activeSkillIds],reasoningTier:prep.privateReasoningTier,route:req.privateRoute,planner:"deterministic",promptSha256:createHash("sha256").update(input.text).digest("hex"),...x});
 let planner=deps.planner,label:PrivateAuditRecord["planner"]=planner&&planner!==deterministicPlanner?"live":"deterministic",fallbackReason:string|undefined;
 if(!planner){
  const pol=llmPolicy(prep.privateReasoningTier);
  if(pol.live&&req.privateRoute){const modelId=req.privateRoute.modelId;label="live";planner=async r=>(await import("./llm-anthropic")).planWithAnthropic(r,modelId);}
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
 // plan inspection: LLM output never bypasses the safety layer
 for(const t of [plan.mediaPrompt,...plan.hardConstraints]){
  const r=evaluateTextSafety(t);
  if(r.decision!=="allow"){rec({planner:label,fallbackReason:"plan_restricted",corrections,usage:result?.usage});return {status:"restricted",decision:r.decision,category:r.category,message:r.message};}
 }
 // Hard capability requirements: a character reference needs reference-image input, lip sync needs a lip-sync model.
 const requirements={referenceImages:ref?ref.angles.length:undefined,lipSync:kind==="video"&&prep.activeSkillIds.includes("persian_lip_sync_phonetics")?true:undefined};
 let proposal:GenerationProposal;
 try{proposal=buildProposal(input.text,input.preference,requirements);}
 catch(e){
  if(!(e instanceof NoCompatibleModelError))throw e;
  rec({planner:label,fallbackReason:"no_compatible_model",corrections:corrections.length?corrections:undefined});
  return {status:"unsupported",turnId,plan:toPublicPlan(plan),message:ref?FA_NO_REFS:lipsMsg};
 }
 keepPrompt(turnId,plan.mediaPrompt);
 rec({planner:label,fallbackReason,corrections:corrections.length?corrections:undefined,usage:label==="live"?result?.usage:undefined});
 return {status:"planned",turnId,proposal,plan:toPublicPlan(plan)};
}
