import "server-only";
import {createHash,randomUUID} from "node:crypto";
import {buildProposal,NoCompatibleModelError} from "./agent";
import {CHARACTER_VIEWS,REQUIRED_CHARACTER_VIEWS} from "./characters";
import {CreativePlanSchema,CreativeTurnInputSchema,STYLE_VISUAL,toPublicPlan,type GenerationStyle,type GifMood,type PublicReference,type ReactionEmoji,type Staging,PlannerInvalidOutputError,PlannerRefusedError,PlannerUnavailableError,type CreativePlan,type PlannerRequest,type PlannerResult,type PrivatePlanner,type PublicCreativePlan} from "./creative-plan";
import {llmGate,preparePrivateCreativeRequest} from "./llm";
import {acquireProviderSlot,countAstraCall,defaultRouterState,estimateTurnCostUsd,loadRoutingConfig,markProviderCooldown,planRoute,profileTask,type RoutingAudit,type RoutingAttempt,type RoutingConfig,type RouterState} from "./llm-routing";
import {defaultAuditSink,type PrivateAuditRecord,type PrivateAuditSink} from "./private-audit";
import {REGION_COLOR_FA,describeTagEn,displayTag,inferAttachmentRoles,isGenerationTag,isMediaKind,parseMentions,rewriteMentions,roleLabelFa,type AttachmentKind,type AttachmentRole,type RoleSource} from "./attachments";
import {providerForModelId} from "./llm-routing";
import {replyScriptFor} from "./finglish";
import {clearSightByMovingProp,occlusionMessageFa,sceneVisibility} from "./scene-visibility";
import {compileImagePrompt,SCENE_COMPILER_VERSION,FA_EDIT_SCOPE_MIXED,GENERIC_EDIT_RULE_EN,resolveOperation,sceneChangeGroups} from "./scene-compiler";
import {propTags,applyStagingCues,applyTypedMappings,lensFor,describeStagingEn,describeStagingFa,sceneLeadEn,detectProps,detectSubject,expandMappings,mapReferences,tidyProps,typedMappings} from "./staging";
import {findGif,type ChatGif} from "./giphy";
import {describeFocus} from "./frame-css";
import {draftVideoModel,requestedMediaKind,suggestModel} from "./router";
import {mainSubjectNote,mainSubjectRule,shownTag,typedMainSubject} from "./main-subject";
import {MEDIA_KIND_CHOICES,MEDIA_KIND_QUESTION_FA,MEDIA_KIND_QUESTION_FINGLISH,type QuestionChoice} from "./media-intent";
import {evaluatePlanTextSafety,evaluateTextSafety,normalizePersian,type SafetyCategory} from "./safety";
import {SKILLS,SKILL_REGISTRY_VERSION} from "./skills";
import {detectReferenceNeeds,type ReferenceRequest} from "./reference-needs";
import type {GenerationProposal,MediaRequirements,ProposalResearch,SuggestedModel,UnsupportedReason} from "./types";
import {researchReferences,type ResearchReference,type ResearchResult,type TurnReference} from "./research";
import {inspectReferences,locateEdit,type EditLocation} from "./reference-inspect";
import {faPlain} from "./format";
import {devLiveTest} from "./policy";
import {continuesWork} from "./follow-up";
import {EDIT_CARDS_FA,EDIT_CARD_FA,EDIT_CARD_FINGLISH,SUGGESTED_FA,SUGGESTED_FINGLISH,mightEditPhoto,wantsEditCard,type SuggestedEdit} from "./edit-card";
import {safeReview} from "./upload-review";
import {rememberRegionEdit} from "./region-restore";
import {MEDIA_ROUTE,readMedia,storeMedia} from "./media-store";
import {framePrompt,frameTimes,sourceFrames,type SourceFrame} from "./frame-draft";
import {nearestAspectRatio} from "./aspect";
import {reviewAvailable,reviewPlan,promptWithFixes,type PlanReviewer} from "./plan-review";
import {findMediaModel} from "./catalog";
import {triageAvailable,triageTurn,type TriageEffort,type TurnTriager} from "./turn-triage";
import {audioCheckAvailable} from "./audio-check";
import {soundLineFa,soundWanted} from "./sound-intent";
import type {ResearchPlan} from "./creative-plan";
export type OrchestratorDeps={planner?:PrivatePlanner;audit?:PrivateAuditSink;now?:()=>Date;
 /** Edit or reference, with the areas to change (a private vision check by default; tests pass a stub). */
 locateEdit?:(text:string,img:{bytes:Uint8Array;mime:import("./media-store").StoredMime})=>Promise<EditLocation>;
 /** Progress for the chat's live status: called as each real stage of the turn starts (never invented, never with private details). */
 onStage?:(stage:TurnStage)=>void;
 /** Detail lines for a stage (owner, 2026-11-07: alive, specific progress): `story` lines about what Whoush is working out for this brief, shown while the
  *  stage runs; `facts` from the turn itself (the lens and frame chosen, what is researched, the model, the risks found). Every line passed the plan-text
  *  safety check and the leak filter; none names a private model or provider. */
 onNote?:(note:TurnNote)=>void;
 /** Finds a chat GIF for a mood (GIPHY by default; tests pass a stub). */
 findGif?:(mood:GifMood)=>Promise<ChatGif|undefined>;
 /** Researches what the plan marked as needing research (open-licensed references, inspected). Tests pass a stub; the default searches and inspects. */
 research?:(plan:ResearchPlan)=>Promise<ResearchResult>;
 /** The pre-generation risk check (the cheapest private model by default; tests pass a stub). */
 reviewPlan?:PlanReviewer;
 /** Test hook: the planner for one routed model. Defaults to the real Anthropic or OpenAI adapter. */
 plannerFor?:(modelId:string,provider:"anthropic"|"openai")=>PrivatePlanner;routing?:RoutingConfig;routerState?:RouterState;
 /** Turn triage (reply, ask or make) before planning: the cheapest private model by default when no test planner is given; tests pass a stub. */
 triage?:TurnTriager;
 /** Whether generated sound can be checked here (tests pass a stub). */audioCheckAvailable?:()=>Promise<boolean>;
 /** The frame preview's source frames and their storage (lib/frame-draft.ts); tests pass stubs. */frames?:{read?:(mediaId:string)=>Promise<Uint8Array|undefined>;sample?:(video:Uint8Array,times:readonly number[])=>Promise<SourceFrame[]>;store?:(bytes:Uint8Array)=>Promise<{id:string}>};
 /** Tests only: plan even with unchecked files (fixtures that exercise the planner's role invariants); the turn still stops before a price. */planUncheckedMedia?:boolean};
export {TURN_STAGES,type TurnStage,type TurnNote} from "./orchestrator-stages";
import type {TurnNote,TurnStage} from "./orchestrator-stages";
export type OrchestratorResult=
 /** A message that needs no picture or video (a greeting, thanks, a question about Whoush): a direct answer, with no plan, price or card. */
 |{status:"reply";turnId:string;message:string;reaction?:ReactionEmoji}
 |{status:"planned";turnId:string;proposal:GenerationProposal;plan:PublicCreativePlan;gif?:ChatGif;reaction?:ReactionEmoji}
 |{status:"unsupported";turnId:string;plan:PublicCreativePlan;message:string;suggestedModel?:SuggestedModel;
  /** Why no proposal: the user's files are not yet inspected (a launch gate, not a missing model), no model fits, or a voice clone was asked. */reason:UnsupportedReason;
  /** media_review: the photos the server does not know as checked (a restart forgets reviews); the studio checks them again and resends. */unreviewed?:string[]}
 |{status:"restricted";decision:"block"|"review";category:SafetyCategory;message:string;
  /** Safe ideas the user can take with one tap (lib/safe-alternatives.ts): Whoush never leaves a refusal as a dead end. */choices?:QuestionChoice[]}
 /** Whoush needs one critical answer before it can offer a generation: no plan card, no price, only the question. */
 |{status:"needs_input";turnId:string;message:string;question:string;reaction?:ReactionEmoji;
  /** The photos Whoush needs to keep something only a photo can (lib/reference-needs.ts): the card shows an upload slot per angle. */references?:ReferenceRequest;
  /** One-tap answers («عکس»، «ویدیو»، «هر دو»): each sends its reply as the user's answer. */choices?:QuestionChoice[];
  /** The edit cards (lib/edit-card.ts): the photos or generations to open full screen for «ادیت», one card each, maybe with regions Whoush painted itself. */editCards?:{tag:string;suggested?:SuggestedEdit[]}[]};
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
/** The start of the «use the photos you sent earlier?» question; the next turn recognises its answer by it. */
const REUSE_MARKER_FA="همون عکس‌هایی که قبلاً فرستادی",REUSE_MARKER_FINGLISH="Hamun aksai ke ghablan ferestadi";
const FA_REFUSED="این درخواست در حال حاضر قابل پردازش نیست. لطفاً آن را با توضیح غیرحساس‌تر دوباره بنویس.";
const FA_NO_REFS="پرامپت تولید با کاراکتر انتخاب‌شده آماده است، اما هنوز هیچ مدل تأییدشده‌ای عکس مرجع کاراکتر را نمی‌پذیرد؛ برای همین فعلاً پیشنهاد تولید و هزینه نمایش داده نمی‌شود.";
const FA_TEXT_BLOCKED="یکی از فایل‌های متنیِ پیوست‌شده مسدود شد. ";
/**
 * Why files of this message cannot be used yet (owner, 2026-11-08: calm and general, never like a malfunction): photos and videos are used only once
 * checked after upload; audio has no check yet. Names the files and gives the way forward.
 */
export function faMediaReview(tags:readonly string[],kinds:readonly string[]):string{
 const audio=kinds.includes("audio");
 return "از "+tags.join("، ")+" فعلاً استفاده نمی‌کنم: "+(audio?"فایل صوتی هنوز بررسی ایمنی نمی‌شه. ":"")+
  (kinds.some(k=>k!=="audio")?"عکس و ویدیو رو فقط بعد از بررسی ایمنی که موقع آپلود انجام می‌شه به کار می‌برم؛ اگه بررسیش هنوز تموم نشده، چند لحظه صبر کن و دوباره بفرست. ":"")+
  "یا بدون "+(tags.length>1?"این فایل‌ها":"این فایل")+" بگو چی بسازم.";
}
/**
 * The proposal set to the version of its recommended model whose length covers a source video (owner, 2026-11-08): the shortest at least as long, else the
 * longest; same resolution when that version exists. `seconds`: the length chosen, when the model has lengths to choose from.
 */
export function matchSourceLength(p:GenerationProposal,sourceSeconds:number):{proposal:GenerationProposal;seconds?:number}{
 const fam=(n:string)=>n.split(" · ")[0].trim(),rec=p.suggestions.find(s=>s.modelId===p.selectedModelId)??p.suggestions[0];
 if(!rec)return {proposal:p};
 const family=p.suggestions.filter(s=>fam(s.name)===fam(rec.name)&&s.durationSeconds),lengths=[...new Set(family.map(s=>s.durationSeconds!))].sort((a,b)=>a-b);
 if(!lengths.length)return {proposal:p};
 const want=lengths.find(d=>d>=sourceSeconds-0.5)??lengths[lengths.length-1];
 const pick=family.find(s=>s.durationSeconds===want&&s.resolution===rec.resolution)??family.find(s=>s.durationSeconds===want)!;
 return {proposal:{...p,recommendedModelId:pick.modelId,selectedModelId:pick.modelId,fixedNeurons:pick.neurons},seconds:want};
}
/** The marker of the turn that set files aside for their checks (faMediaReview). */
const SET_ASIDE_FA=" فعلاً استفاده نمی‌کنم";
const DONE_QUESTION=/(تموم|تمام|چک شد|بررسی شد|آماده|اوکی شد|درست شد|حله|شد\s*[؟?]|\bdone\b|\bready\b|\bchecked\b|\bfinished\b|tamoom|amade)/i;
export const RESUME_QUESTION_FA="دوباره بسازمش؟",RESUME_LABEL_FA="آره، بساز";
/** When «تموم شد؟» follows a turn that set files aside, and every file the set-aside request named has now passed: what to say, and the request to send again. */
export function resumeAfterReview(text:string,ownFiles:number,history:readonly {role:"user"|"agent";text:string}[],prior:readonly {tag:string;kind:string;reviewId?:string}[]):{message:string;request:string}|undefined{
 if(ownFiles||text.length>60||!DONE_QUESTION.test(normalizePersian(text)))return undefined;
 // The latest turn that set files aside, with only short messages from the user since («ایمنی شد؟», «تموم شد؟»), whatever Whoush answered them.
 const i=history.findLastIndex(t=>t.role==="agent"&&t.text.includes(SET_ASIDE_FA));
 if(i<1||history.slice(i+1).some(t=>t.role==="user"&&t.text.length>60))return undefined;
 // The request is the user's messages just before it (a brief, then its #files): each kept once, a message already inside another one dropped.
 let j=i;while(j>0&&history[j-1].role==="user")j--;
 const run=[...new Set(history.slice(j,i).map(t=>t.text.trim()).filter(Boolean))];
 const request=run.filter(t=>!run.some(o=>o!==t&&o.includes(t))).join(" ");
 if(!request)return undefined;
 const named=parseMentions(request).map(tag=>prior.find(p=>p.tag===tag)).filter((p):p is NonNullable<typeof p>=>Boolean(p)&&isMediaKind(p!.kind as never));
 if(!named.length||named.some(isUnchecked))return undefined;
 return {message:"آره، بررسی "+named.map(p=>displayTag(p.tag)).join("، ")+" تموم شده و "+(named.length>1?"همه‌شون قبول شدن.":"قبول شد."),request};
}
const FA_NO_PHOTO_MODEL="پرامپت آماده است، اما الان هیچ مدل فعالی این عکس‌ها رو به‌عنوان مرجع نمی‌گیره (مثلاً تعدادشون بیشتر از حد مدله)؛ برای همین فعلاً پیشنهاد تولید و هزینه نمایش داده نمی‌شود.";
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
  ...(input.task==="edit"?[P(GENERIC_EDIT_RULE_EN,"همهٔ بخش‌های ویرایش‌نشدهٔ تصویر مبدأ حفظ می‌شود: هویت، کادر، نور، رنگ و پیکسل‌ها")]:[]),
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
/**
 * Whether an attached media file is not known as checked: a photo (and a painted photo's marked copy) or a video (frames and soundtrack, lib/video-review.ts)
 * with a safe review on the server is checked; every other media file (audio has no check yet) is not, and is never sent anywhere.
 */
const isUnchecked=(f:{kind:string;reviewId?:string;regionEdit?:{guideReviewId?:string}})=>isMediaKind(f.kind as never)&&!(
 (f.kind==="image"&&safeReview(f.reviewId)&&(!f.regionEdit||safeReview(f.regionEdit.guideReviewId)))||(f.kind==="video"&&safeReview(f.reviewId)?.kind==="video"));
/** Fill-ins the enforcer makes on every plan that lacks them: routine, never a sign the planner misread the brief. */
const ROUTINE_CORRECTIONS=new Set(["camera_filled","shot_filled","continuity_filled","style_directives","role_directives","realism_mode"]);
/** How many corrections mean a misread brief (the escalation test). */
export const seriousCorrections=(c:readonly string[])=>c.filter(x=>!ROUTINE_CORRECTIONS.has(x)).length;
const leakText=(text:string,userText:string)=>{const j=text.toLowerCase(),u=userText.toLowerCase();return FORBIDDEN.some(t=>j.includes(t)&&!u.includes(t))||FAMILY_WORDS.some(r=>r.test(j)&&!r.test(u));};
const leaks=(pub:PublicCreativePlan,userText:string)=>{const j=JSON.stringify(pub).toLowerCase(),u=userText.toLowerCase();return FORBIDDEN.some(t=>j.includes(t)&&!u.includes(t))||FAMILY_WORDS.some(r=>r.test(j)&&!r.test(u));};
// ---- private prompt store for the generation phase (bounded, server memory only) ----
const MAX_PROMPTS=200;
const store=()=>((globalThis as {__whoushPrompts?:Map<string,string>}).__whoushPrompts??=new Map());
/** What an image turn's prompt was compiled from (the planner's text and the aspect ratio), so a canvas change recompiles it. Private, like the prompt. */
type SceneContent={content:string;aspect:string;
 /** The scene the turn was planned with (the canvas before the user's changes), and whether a source photo is edited: a later canvas change is checked against it. */
 staging:Staging;sourceImage:boolean};
const contents=()=>((globalThis as {__whoushPromptContent?:Map<string,SceneContent>}).__whoushPromptContent??=new Map());
export const getPrivateMediaPrompt=(turnId:string):string|undefined=>store().get(turnId);
/** The inspected research references of a turn (Whoush-owned copies), private to the server: quotes bind the ones the user kept. */
/** A file tag's number (image3 → 3), for the order photos are attached in. */
const tagOrder=(tag:string)=>Number(tag.replace(/\D/g,""))||0;
const refStore=()=>((globalThis as {__whoushTurnRefs?:Map<string,TurnReference[]>}).__whoushTurnRefs??=new Map());
export const getTurnReferences=(turnId:string):readonly TurnReference[]=>refStore().get(turnId)??[];
/** The draft for a video: the cheapest image model that takes reference images (docs/RESEARCH_PIPELINE.md). */
export const DRAFT_IMAGE_MODEL="nano-banana-2-1";
const DRAFT_PREFIX="A single still photograph: the opening frame of this video shot, as it looks at its first moment. ";
const DRAFT_SUFFIX=" Still image only: no motion blur, no text or captions.";
/** Tests only: references for a quotable turn. */
export function keepTurnReferencesForTests(turnId:string,refs:ResearchReference[]){refStore().set(turnId,refs);}
/** The prompt-compiler version of a turn whose image prompt was compiled from a scene (lib/scene-compiler.ts); none for other prompts. */
export const privatePromptCompilerVersion=(turnId:string):string|undefined=>contents().has(turnId)?SCENE_COMPILER_VERSION:undefined;
/**
 * The scene the user arranged in «بوم» before pressing «بساز»: a new private turn derived from `turnId`, with the arranged staging (enum values and prop kinds
 * only, never free text) appended to the provider-facing prompt as the deciding direction. The original turn is untouched; quotes bind to the new one.
 * Undefined when the original turn is unknown or expired.
 */
/** A photo edit whose canvas changes the camera and the light (or the layout) together: refused before any quote (docs/CANVAS_TO_IMAGE.md section 3). */
/** The user's arranged scene hides the subject (a table in front of a floor-level camera): refused before any quote, with the smallest fix in Persian. */
export class SceneOccluded extends Error{readonly code="composition_occluded";constructor(readonly messageFa:string){super("composition_occluded");this.name="SceneOccluded";}}
export class SceneEditConflict extends Error{readonly code="edit_scope_mixed";readonly messageFa=FA_EDIT_SCOPE_MIXED;constructor(){super("edit_scope_mixed");this.name="SceneEditConflict";}}
export function deriveTurnWithStaging(turnId:string,staging:Staging,aspect?:string):string|undefined{
 const base=store().get(turnId);if(base===undefined)return undefined;
 // An image turn is compiled again from its content and the new scene: the old scene never stays next to the new one.
 const kept=contents().get(turnId);
 if(kept){
  const asp=aspect??kept.aspect;
  if(sceneVisibility(staging,asp).subject==="occluded")throw new SceneOccluded(occlusionMessageFa(staging,asp));
  const op=resolveOperation({sourceImage:kept.sourceImage,change:sceneChangeGroups(kept.staging,staging)});
  if("conflict" in op)throw new SceneEditConflict();
  const c={...kept,aspect:aspect??kept.aspect},id=randomUUID();copyReferences(turnId,id);
  // The new turn keeps the original scene as its reference, so a second change is checked against the photo's scene, not the first change.
  keepPrompt(id,compileImagePrompt({content:c.content,staging,aspect:c.aspect,operation:op.operation}).prompt,c);return id;
 }
 // The lens follows the adjusted scene (Whoush's choice for what it now shows), so the camera direction never contradicts it.
 // The user's camera and light open the prompt in plain words (the model weighs the start; a long description before them outweighed them), and the
 // full scene follows at the end; the planner's own text sits between, cut to fit.
 const lead=sceneLeadEn(staging)+" ";
 const extra=" User-adjusted scene (overrides any earlier camera, framing or lighting direction): "+describeStagingEn(staging)+describeFocus(staging,undefined,aspect??"16:9").en+" "+lensFor(staging).en+(aspect?" Aspect ratio "+aspect+".":"");
 const id=randomUUID();copyReferences(turnId,id);keepPrompt(id,(lead+base.slice(0,Math.max(0,3000-extra.length-lead.length))+extra).slice(0,3000));
 return id;
}
/** Tests only: a quotable image-edit turn (no image-edit model is verified yet, so none can be planned as one). */
export function keepEditTurnForTests(turnId:string,prompt:string,c:{content:string;aspect:string;staging:Staging}){keepPrompt(turnId,prompt,{...c,sourceImage:true});}
function keepPrompt(turnId:string,prompt:string,content?:SceneContent){
 const m=store(),c=contents(),r=refStore();m.set(turnId,prompt);if(content)c.set(turnId,content);
 while(m.size>MAX_PROMPTS){const k=m.keys().next().value as string;m.delete(k);c.delete(k);r.delete(k);}
}
/** A turn derived from another (an arranged scene) keeps the same research references. */
function copyReferences(from:string,to:string){const r=refStore().get(from);if(r?.length)refStore().set(to,r);}
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
 return {...(operation?{operation}:{}),referenceImages:refs||undefined,
  ...(input.characterRef?.angles.length||images.some(a=>a.role==="character")?{identityReference:true}:{}),...(input.characterRef?.angles.length?{savedCharacter:true}:{}),lipSync:lips||undefined,
  ...(video("motion_reference")?{motionReference:true}:{}),...(video("edit_reference")?{videoReference:true}:{}),
  ...(files.some(a=>a.kind==="image"&&a.role==="start_frame")?{startImage:true}:{}),...(files.some(a=>a.kind==="image"&&a.role==="end_frame")?{endImage:true}:{}),...(video("continue")?{videoContinuation:true}:{})};
}
// ---- orchestration ----
export async function orchestrateCreativeTurn(rawInput:unknown,deps:OrchestratorDeps={}):Promise<OrchestratorResult>{
 const raw=CreativeTurnInputSchema.parse(rawInput);
 // Mappings typed in the brief («#زن:تصویر-۱»: this prop looks like that file) are kept aside; the planner reads them as «#زن (#تصویر-۱)», an ordinary mention.
 const typed=typedMappings(raw.text),parsed={...raw,text:expandMappings(raw.text)},audit=deps.audit??defaultAuditSink,now=deps.now??(()=>new Date());
 const stage=(x:TurnStage)=>{try{deps.onStage?.(x);}catch{ /* progress is best effort */ }};
 // Detail lines are model or plan text: each passes the plan-text safety check and the leak filter, or is left out.
 const note=(st:TurnStage,kind:TurnNote["kind"],lines:readonly (string|undefined|false)[])=>{
  try{const ok=lines.filter((l):l is string=>typeof l==="string"&&l.trim().length>0).map(l=>l.replace(/\s+/g," ").trim().slice(0,140)).filter(l=>evaluatePlanTextSafety(l).decision==="allow"&&!leakText(l,raw.text));
   if(ok.length)deps.onNote?.({stage:st,kind,lines:ok});}catch{ /* best effort */ }
 };
 stage("reading");
 // A painted edit's note («ویرایش با قلم») is the user's words too: the same check, even when the message text does not repeat it.
 const notes=(parsed.attachments??[]).flatMap(a=>a.regionEdit?a.regionEdit.regions.map(r=>r.note):[]);
 const safety=[parsed.text,...notes].map(t=>evaluateTextSafety(t)).find(r=>r.decision!=="allow")??evaluateTextSafety(parsed.text);
 if(safety.decision!=="allow")return {status:"restricted",decision:safety.decision,category:safety.category,message:safety.message,...(safety.choices?{choices:safety.choices}:{})};
 // A role is optional: media without one gets Whoush's best guess from the words of the brief (no media analysis), before skills resolve.
 // Inferred roles drive the same skills, constraints, kind override and requirements as chosen ones; `voice_clone` is never inferred.
 // Keeping the thread (lib/follow-up.ts): with no files of its own, a message that continues the latest work keeps the photos that work was built on.
 const ownFiles=parsed.attachments??[],carryTags=!ownFiles.length&&parsed.continueWith?.length&&continuesWork(parsed.text,Boolean(parsed.generations?.length))?parsed.continueWith:[];
 const carried=(parsed.priorAttachments??[]).filter(a=>carryTags.includes(a.tag));
 const given=[...ownFiles,...carried],roles=new Map(inferAttachmentRoles(parsed.text,given).map(r=>[r.tag,r]));
 // A painted photo is the photo to edit, whatever role it had.
 const files0:Array<Omit<(typeof given)[number],"role">&{role?:AttachmentRole;roleSource?:RoleSource}>=given.map(f=>{if(f.regionEdit)return {...f,role:"edit_reference" as const,roleSource:"user" as RoleSource};const r=roles.get(f.tag);return r?{...f,role:r.role,roleSource:r.roleSource}:f;});
 // Something only a photo can keep (the user's tattoos, logo, product, face, outfit): its photos get the right role (a user's own choice stays), and without
 // any photo Whoush asks for exactly the ones it needs, once (an answer without photos goes ahead without them).
 const need=detectReferenceNeeds(normalizePersian(parsed.text))[0];
 // A general reference («عکس رفرنس») is resolved by the brief's words; for a detail like a tattoo it stays the general reference it already is.
 const fits=(f:{role?:AttachmentRole})=>Boolean(need)&&(f.role===need!.role||(need!.role==="reference"&&f.role==="general"));
 const finglish=replyScriptFor(parsed.text)==="finglish",askTurn=randomUUID();
 // Which question this message answers: the last Whoush turn in the history carries the question's text.
 const safeHistory=(parsed.history??[]).filter(t=>evaluateTextSafety(t.text).decision==="allow");
 const lastAsked=[...safeHistory].reverse().find(t=>t.role==="agent")?.text??"";
 const answered=(marker:string,fing:string)=>Boolean(parsed.answersQuestion)&&(lastAsked.includes(marker)||lastAsked.includes(fing));
 // The edit card (owner, 2026-11-06): a local change with no place named («اینجاشو عوض کن», «با قلم مشخص کنم») gets the picture to mark, once.
 if(!parsed.answersQuestion&&!files0.some(f=>f.regionEdit)&&wantsEditCard(parsed.text)){
  // One card per picture to edit: the photos and generations the message names, else the photos it carries, else the one generation of this chat.
  const mentioned=parseMentions(parsed.text),imgs=files0.filter(f=>f.kind==="image"),gens=(parsed.generations??[]).filter(g=>g.mediaKind==="image");
  const named=[...imgs.filter(f=>mentioned.includes(f.tag)).map(f=>f.tag),...gens.filter(g=>mentioned.includes(g.tag)).map(g=>g.tag)];
  const targets=named.length?named:imgs.length?imgs.map(f=>f.tag):gens.length===1?[gens[0].tag]:[];
  if(targets.length)return {status:"needs_input",turnId:askTurn,message:finglish?EDIT_CARD_FINGLISH:targets.length>1?EDIT_CARDS_FA:EDIT_CARD_FA,question:targets.length>1?EDIT_CARDS_FA:EDIT_CARD_FA,editCards:targets.map(tag=>({tag}))};
 }
 // Edit or reference (owner, 2026-11-06): a photo with a request that changes something in it is asked to the vision check. An edit gets its card with
 // the areas already painted and commented, to confirm or change; a reference goes on to a new picture. A check that cannot run changes nothing here.
 const checkedPhotos=files0.filter(f=>f.kind==="image"&&!f.regionEdit&&safeReview(f.reviewId));
 if(!parsed.answersQuestion&&checkedPhotos.length===1&&!files0.some(f=>f.regionEdit)&&mightEditPhoto(parsed.text)){
  const photo=checkedPhotos[0],stored=await readMedia(safeReview(photo.reviewId)!.mediaId).catch(()=>undefined);
  const loc=stored?await (deps.locateEdit??locateEdit)(parsed.text,{bytes:new Uint8Array(stored.bytes),mime:stored.mime}).catch(()=>undefined):undefined;
  const regions=loc?.mode==="edit"?loc.regions.filter(r=>r.noteFa.trim()&&r.box[2]>r.box[0]&&r.box[3]>r.box[1]):[];
  if(regions.length&&regions.every(r=>evaluateTextSafety(r.noteFa).decision==="allow")){
   const suggested:SuggestedEdit[]=regions.map(r=>({note:r.noteFa.trim().slice(0,300),boxes:[[r.box[0],r.box[1],r.box[2],r.box[3]]]}));
   return {status:"needs_input",turnId:askTurn,message:finglish?SUGGESTED_FINGLISH:SUGGESTED_FA,question:SUGGESTED_FA,editCards:[{tag:photo.tag,suggested}]};
  }
 }
 // Picking up a request that was set aside for its checks (owner, 2026-11-08: «تموم شد؟» was answered with an invented "still checking"): when Whoush's last
 // turn set files aside, and the user now asks whether it is done while every file that request named has passed, Whoush says so and offers to make it, with
 // one tap that sends the same request again (its #files come with it).
 const resume=resumeAfterReview(parsed.text,ownFiles.length,safeHistory,parsed.priorAttachments??[]);
 if(resume)return {status:"needs_input",turnId:askTurn,message:resume.message,question:RESUME_QUESTION_FA,choices:[{id:"resume1",labelFa:RESUME_LABEL_FA,replyFa:resume.request}]};
 // Triage (owner, 2026-11-07, lib/turn-triage.ts): not every message needs a plan. A greeting or a question gets a direct answer; a request missing something
 // that would change the result a lot (or that needs a link Whoush cannot open) gets one follow-up; the rest is planned, with effort to match the brief.
 // An answer to Whoush's own question, an arranged scene and a brushed edit always go on to planning: they already say what to make.
 let effort="standard" as TriageEffort;
 const triager=deps.triage??(!deps.planner&&triageAvailable()?triageTurn:undefined);
 // It runs in the background (owner, 2026-11-07: planning starts alongside it): a reply or a question wins over anything after it, so every later early
 // return waits for it first (`early`), and the planner is cancelled when it answers.
 const triageP:Promise<OrchestratorResult|undefined>=triager&&!parsed.answersQuestion&&!parsed.stagingOverride&&parsed.task!=="character"&&!files0.some(f=>f.regionEdit)?(async()=>{
  // Each file in the chat with the real state of its check, so «تموم شد؟» is answered from facts, never guessed from the chat.
  const seenTags=new Set<string>(),triageFiles=[...files0,...(parsed.priorAttachments??[])].filter(f=>isMediaKind(f.kind as never)&&!seenTags.has(f.tag)&&seenTags.add(f.tag)).map(f=>({tagFa:displayTag(f.tag),checked:!isUnchecked(f)}));
  const t=await triager({text:parsed.text,history:safeHistory,generations:parsed.generations?.length??0,script:finglish?"finglish":"fa",files:triageFiles}).catch(()=>null);
  // Its texts are model output: the same plan-text safety check and leak filter as the planner's reply, else the turn goes on to planning.
  const ok=(x:string)=>evaluatePlanTextSafety(x).decision==="allow"&&!leakText(x,parsed.text)&&!(finglish&&/[\u0600-\u06ff]/.test(x.replace(/[#@][^\s]+/g," ")));
  if(t?.mode==="reply"&&ok(t.replyFa))return {status:"reply",turnId:askTurn,message:t.replyFa,...(t.react?{reaction:t.react}:{})} as OrchestratorResult;
  if(t?.mode==="ask"&&ok(t.leadFa+" "+t.questionFa)&&t.choices.every(c=>ok(c.labelFa+" "+c.replyFa)))
   return {status:"needs_input",turnId:askTurn,message:t.leadFa||t.questionFa,question:t.questionFa,...(t.choices.length?{choices:t.choices.map((c,i)=>({id:"triage"+(i+1),labelFa:c.labelFa,replyFa:c.replyFa}))}:{}),...(t.react?{reaction:t.react}:{})} as OrchestratorResult;
  if(t?.mode==="make"){effort=t.effort;note("planning","story",t.storyFa);}
  return undefined;
 })():Promise.resolve(undefined);
 const early=async(r:OrchestratorResult):Promise<OrchestratorResult>=>(await triageP)??r;
 // Photo or video (owner, 2026-11-06): what this message says wins; then a file that only a video can use; then the generation it changes; then what the
 // user said earlier in this chat. When nothing says, Whoush asks once, before any planning (an answer that still says nothing gets a photo).
 const said=requestedMediaKind(parsed.text);
 const earlier=[...safeHistory].reverse().filter(t=>t.role==="user").map(t=>requestedMediaKind(t.text)).find(Boolean);
 const videoFile=files0.some(f=>f.kind==="video"||(f.kind==="audio"&&f.role==="lip_sync")||(f.kind==="image"&&(f.role==="start_frame"||f.role==="end_frame")));
 const chosen=videoFile?"video":said??(parsed.generations?.length?parsed.generations[0].mediaKind:earlier);
 // Asked only of a brief on its own: a message with files or #tags works with something already in the chat (and a missing #file gets its own question).
 if(!chosen&&!parsed.answersQuestion&&parsed.task!=="character"&&!files0.length&&!parseMentions(parsed.text).length&&!parsed.stagingOverride){
  return early({status:"needs_input",turnId:askTurn,message:pickLine(VOICE[finglish?"finglish":"fa"].needsInput,askTurn),question:finglish?MEDIA_KIND_QUESTION_FINGLISH:MEDIA_KIND_QUESTION_FA,choices:MEDIA_KIND_CHOICES.map(c=>({...c}))});
 }
 const kind:"image"|"video"=chosen==="both"||chosen==="video"?"video":"image",wantsBoth=chosen==="both";
 // Photos for the thing to keep may already be in this chat (sent with an earlier message): Whoush uses them instead of asking again. Ones that were given
 // for it (their role fits) are used as they are; other earlier photos are offered with one question («همون عکس‌ها؟»). A saved character covers a face.
 const priorImages=(parsed.priorAttachments??[]).filter(p=>p.kind==="image"&&!(parsed.attachments??[]).some(f=>f.tag===p.tag));
 const reuseAsked=answered(REUSE_MARKER_FA,REUSE_MARKER_FINGLISH),reuseYes=reuseAsked&&/(همونا|همون عکس|آره|اره|بله|اوکی|hamuna|hamoona|are|bale|yes|ok)/.test(normalizePersian(parsed.text).split(" ").slice(-12).join(" "));
 let reused:typeof priorImages=[];
 if(need&&!files0.some(f=>f.kind==="image")&&!(need.id==="face"&&parsed.characterRef)){
  const fitting=priorImages.filter(fits);
  if(fitting.length)reused=fitting;
  else if(priorImages.length&&reuseYes)reused=priorImages;
  else if(priorImages.length&&!parsed.answersQuestion){
   const tags=priorImages.slice(0,6).map(f=>displayTag(f.tag)).join("، ");
   return early({status:"needs_input",turnId:askTurn,message:finglish?need.askFinglish:need.askFa,
    question:(finglish?REUSE_MARKER_FINGLISH+" ("+tags+") baraye "+need.titleFa+" estefade konam? Age na, aks-e taze befrest.":REUSE_MARKER_FA+" ("+tags+") رو برای "+need.titleFa+" استفاده کنم؟ اگه نه، عکس تازه بفرست."),
    choices:[{id:"reuse",labelFa:finglish?"Are, hamuna":"آره، همونا",replyFa:finglish?"are, hamuna ro estefade kon":"آره، همونا رو استفاده کن"}],
    references:{need:need.id,titleFa:need.titleFa,role:need.role,angles:need.angles.map(a=>({id:a.id,titleFa:a.titleFa}))}});
  }
  // Asked only when the message brought no photo at all and none is in the chat (a photo the user gave another role is theirs to decide); an answer to
  // the photo-or-video question still gets this one question.
  else if(!priorImages.length&&(!parsed.answersQuestion||answered(MEDIA_KIND_QUESTION_FA,MEDIA_KIND_QUESTION_FINGLISH))){
   return early({status:"needs_input",turnId:askTurn,message:finglish?need.askFinglish:need.askFa,question:need.askFa,references:{need:need.id,titleFa:need.titleFa,role:need.role,angles:need.angles.map(a=>({id:a.id,titleFa:a.titleFa}))}});
  }
 }
 const withReused:typeof files0=[...files0,...reused.map(f=>({...f,...(f.role?{roleSource:"user" as RoleSource}:{})}))];
 const needPhotos=need?withReused.filter(f=>f.kind==="image"&&(fits(f)||!f.role||f.roleSource==="inferred")):[];
 const needTags=new Set(needPhotos.map(f=>f.tag));
 const files=withReused.map(f=>needTags.has(f.tag)&&need&&!fits(f)?{...f,role:need.role==="reference"?"general":need.role,roleSource:"inferred" as RoleSource}:f);
 // Text attachments are user text: they get the same preflight before any planner sees them.
 for(const f of files){
  if(!f.textExcerpt)continue;
  const r=evaluateTextSafety(f.textExcerpt);
  if(r.decision!=="allow")return {status:"restricted",decision:r.decision,category:r.category,message:FA_TEXT_BLOCKED+r.message,...(r.choices?{choices:r.choices}:{})};
 }
 // Summaries of earlier generations come from the browser: user data like excerpts, with the same preflight.
 const generations=parsed.generations??[];
 // Recent turns are client-sent text: each gets the same preflight as the brief, and a turn that fails it is simply left out (it never blocks today's message).
 const history=(parsed.history??[]).filter(t=>evaluateTextSafety(t.text).decision==="allow");
 const script=replyScriptFor(parsed.text);
 for(const g of generations){
  const r=evaluateTextSafety(g.summaryFa);
  if(r.decision!=="allow")return {status:"restricted",decision:r.decision,category:r.category,message:FA_TEXT_BLOCKED+r.message,...(r.choices?{choices:r.choices}:{})};
 }
 // Planners see attachments only through `req.attachments` (kinds and excerpts as data); the audio flags are merged into `input.audio`.
 // An edit_reference (image or video) makes the turn an edit, which brings photo_editor or video_editor.
 const task=parsed.task!=="character"&&files.some(f=>f.role==="edit_reference")?"edit":parsed.task;
 // «سوژه اصلی» (lib/main-subject.ts): marked with the star, or written in the brief. A file or generation is known now (the planner is told to compose around
 // it); a scene prop only once the plan has its scene. Anything else is ignored: the choice is optional and never blocks the turn.
 const mainWanted=parsed.mainSubject??typedMainSubject(parsed.text);
 let mainTag=mainWanted&&[...files.map(f=>f.tag),...(parsed.generations??[]).map(g=>g.tag)].includes(mainWanted)?mainWanted:undefined;
 // A brush edit's regions travel with the public plan, so the chat shows them (and a reopened chat still does).
 const regionEdits=files0.filter(f=>f.regionEdit).map(f=>({tag:f.tag,regions:f.regionEdit!.regions.map(r=>({n:r.n,color:r.color,note:r.note}))}));
 const withMain=(p:PublicCreativePlan):PublicCreativePlan=>({...p,...(mainTag?{mainSubject:mainTag}:{}),...(regionEdits.length?{regionEdits}:{})});
 const input={...parsed,text:mainTag?(parsed.text+mainSubjectNote(mainTag)).slice(0,4000):parsed.text,task,visualStyle:parsed.style?STYLE_VISUAL[parsed.style]:parsed.visualStyle,audio:deriveAudio({...parsed,attachments:files}),attachments:undefined,priorAttachments:undefined,generations:undefined,history:undefined,stagingOverride:undefined,aspectOverride:undefined};
 // A video attachment (every media attachment carries a role), a lip_sync audio or a start_frame or end_frame image makes the output a video even when the text sounds like
 // an image request. Such a turn always has media, so it stops at the media-review check below and never reaches `buildProposal`, which re-detects from the text.
 const a=input.audio,ref=input.characterRef;
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
  const v=CreativePlanSchema.safeParse(raw);
  // Owner dev testing only: which fields made a plan invalid (paths and error codes, never content), so a planner that fails can be fixed.
  if(!v.success){if(devLiveTest().enabled)console.info("[whoush dev-live] planner output invalid at",v.error.issues.slice(0,6).map(i=>i.path.join(".")+":"+i.code).join(", "));return {reason:"invalid_output"};}
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
 let routing:RoutingAudit|undefined;
 // Planning (the planner and its escalation ladder). It may run alongside the triage (owner, 2026-11-07: ~5 s saved per planned turn); a triage reply or
 // question cancels it. It returns a result only when it ends the turn itself (a refusal).
 const runPlanning=async(signal:AbortSignal):Promise<OrchestratorResult|undefined>=>{
 stage("planning");
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
   const cfg=deps.routing??loadRoutingConfig(),state=deps.routerState??defaultRouterState(),prof0=profileTask(input,kind,prep.activeSkillIds,req.attachments);
   // The triage's effort moves the score: a light brief plans on the quick band, a deep one a band higher (owner, 2026-11-07: effort follows the input).
   const prof=effort==="light"?{...prof0,score:Math.min(prof0.score,20),signals:[...prof0.signals,"triage:light"]}:effort==="deep"?{...prof0,score:Math.min(100,prof0.score+25),signals:[...prof0.signals,"triage:deep:+25"]}:prof0;
   const chars=req.systemInstructions.length+req.userText.length+(req.attachments??[]).reduce((n,x)=>n+(x.textExcerpt?.length??0),0)+(req.generations??[]).reduce((n,g)=>n+g.summaryFa.length,0)+(req.history??[]).reduce((n,t)=>n+t.text.length,0);
   const route=planRoute(prof,{cfg,now:now(),state,inputChars:chars});
   routing={...prof,band:route.band,ladder:route.ladder,skipped:route.skipped,attempts:[],chosenModelId:null};
   if(!route.ladder.length)fallbackReason=route.skipped.some(x=>x.why==="cooldown")?"provider cooldown":route.skipped.some(x=>x.why==="no_key")?"api key not configured":"no route available";
   let best:{o:Awaited<ReturnType<typeof attempt>>;modelId:string}|undefined,last:Outcome="planner_error",made=0;
   // `made` counts real calls against the attempt budget. A rung whose provider stays busy (all in-flight slots taken past maxQueueWaitMs) is skipped without a call.
   for(let i=0;i<route.ladder.length&&made<cfg.escalation.maxAttemptsPerTurn&&!signal.aborted;i++){
    const modelId=route.ladder[i],provider=providerForModelId(modelId)!;
    const release=await acquireProviderSlot(provider,cfg,state);
    if(!release){routing.skipped.push({modelId,why:"provider_busy"});continue;}
    made++;
    let o:Awaited<ReturnType<typeof attempt>>,t0=Date.now();
    try{
     req.privateRoute={provider,modelId};
     if(modelId===cfg.astra.modelId)countAstraCall(now(),state);
     const adapter=deps.plannerFor?.(modelId,provider)??(provider==="openai"?async(r:PlannerRequest)=>(await import("./llm-openai")).planWithOpenAI(r,modelId,signal):async(r:PlannerRequest)=>(await import("./llm-anthropic")).planWithAnthropic(r,modelId,signal));
     t0=Date.now();o=await attempt(adapter);
    }finally{release();}
    if(signal.aborted)break; // cancelled: the triage answered instead (no cooldown, no escalation)
    const usage=o.result?.usage,u=usage as {input_tokens?:number;output_tokens?:number}|undefined;
    routing.attempts.push({modelId,provider,outcome:o.outcome,latencyMs:Date.now()-t0,...(usage?{usage}:{}),estCostUsd:u&&typeof u.input_tokens==="number"&&cfg.prices[modelId]?(u.input_tokens*cfg.prices[modelId][0]+(u.output_tokens??0)*cfg.prices[modelId][1])/1e6:null,...(o.limit?{limit:o.limit}:{}),...(o.retryAfterMs!==undefined?{retryAfterMs:o.retryAfterMs}:{})} as RoutingAttempt);
    last=o.outcome;
    // Owner dev testing only: why a rung ended (outcome, corrections count, latency), never content, so a turn that escalates can be traced.
    if(devLiveTest().enabled)console.info("[whoush dev-live] rung",modelId,o.outcome,"corrections",o.fin?.e?.corrections.join("|")||"-","ms",Date.now()-t0,"fallback",o.fin?.reason??"-");
    if(o.outcome==="planner_unavailable")markProviderCooldown(provider,now(),cfg,state,{limit:o.limit,retryAfterMs:o.retryAfterMs});
    if(o.outcome==="refused"&&!cfg.escalation.escalateOn.includes("refused")){rec({planner:"live",fallbackReason:"planner_refused",routing});return refusedResult();}
    const more=i+1<route.ladder.length&&made<cfg.escalation.maxAttemptsPerTurn;
    if(o.outcome==="ok"){
     best=o.fin?.e?{o,modelId}:best;
     // Only corrections that mean the planner misread the brief count (owner, 2026-11-07: no second paid plan for routine fill-ins): a missing camera, shot
     // or continuity block and the style or role directives are filled here anyway, so they never send the turn to a second model.
     if(more&&seriousCorrections(o.fin!.e!.corrections)>=cfg.escalation.escalateOnCorrectionsAtLeast)continue;
     break;
    }
    if(!(more&&(cfg.escalation.escalateOn as string[]).includes(o.outcome)))break;
   }
   if(best){label="live";result=best.o.result;fin=best.o.fin!;routing.chosenModelId=best.modelId;req.privateRoute={provider:providerForModelId(best.modelId)!,modelId:best.modelId};}
   else if(route.ladder.length){fallbackReason=!made?"provider busy":last==="refused"?"planner_refused":last;}
  }
 }
 return undefined;
 };
 // Started at once only when the message already reads as a request to make something (it names a photo or video, brings files or #tags, or continues
 // earlier work), so a greeting never pays for a cancelled plan. The routing then uses the brief's own score: a light or deep effort from the triage
 // only moves the band when planning starts after it.
 // A file that cannot be used (unchecked, blocked, forgotten after a restart, or audio, which has no check yet) is known before planning: the turn says so
 // at once with Whoush's own plan (owner, 2026-11-08: no 40-second paid plan that ends in a refusal), and the paid planner never runs.
 const mediaUnchecked=files.some(isUnchecked)&&!deps.planUncheckedMedia;
 if(mediaUnchecked)fallbackReason="media_review_unavailable";
 const cancel=new AbortController();
 const likelyMake=Boolean(said||videoFile||files0.length||parsed.generations?.length||parseMentions(parsed.text).length);
 const planP=likelyMake&&!mediaUnchecked?runPlanning(cancel.signal):undefined;
 const triaged=await triageP;
 if(triaged){cancel.abort();if(planP)await planP.catch(()=>undefined);return triaged;}
 const ended=mediaUnchecked?undefined:await (planP??runPlanning(cancel.signal));
 if(ended)return ended;
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
  if(plan.mediaKind!=="image"){const en=" Scene (must match): "+describeStagingEn(plan.staging)+describeFocus(plan.staging,undefined,plan.camera?.aspectRatio??"16:9").en+" "+lens.en;
   plan.mediaPrompt=plan.mediaPrompt.slice(0,Math.max(0,3000-en.length))+en;}
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
 // The main subject leads: the first hard rule, and the provider prompt builds the frame around it.
 const mainProp=!mainTag&&mainWanted&&plan.staging?.props?propTags(plan.staging.props).indexOf(mainWanted):-1;
 if(mainProp!==undefined&&mainProp>=0&&plan.staging?.props)mainTag=mainWanted;
 if(mainTag){
  const r=mainSubjectRule(mainTag,plan.mediaKind),prop=mainProp!==undefined&&mainProp>=0?plan.staging!.props![mainProp]:undefined;
  const en=prop?r.en.replace(" "+shownTag(mainTag)+"."," the "+prop.kind+" in the scene ("+prop.label+")."):r.en;
  if(!plan.hardConstraints.includes(r.fa))plan.hardConstraints=[r.fa,...plan.hardConstraints];
  plan.mediaPrompt=plan.mediaPrompt.slice(0,Math.max(0,3000-en.length))+en;
 }
 if(parsed.aspectOverride&&plan.camera&&plan.camera.aspectRatio!==parsed.aspectOverride){
  plan.camera={...plan.camera,aspectRatio:parsed.aspectOverride};
  if(plan.mediaKind!=="image"){const en=" Aspect ratio "+parsed.aspectOverride+".";plan.mediaPrompt=plan.mediaPrompt.slice(0,Math.max(0,3000-en.length))+en;}
 }
 const plannedStaging=plan.staging;
 if(parsed.stagingOverride){
  const o=parsed.stagingOverride,lens=lensFor(o),asp=parsed.aspectOverride??plan.camera?.aspectRatio??"16:9",focus=describeFocus(o,undefined,asp);
  const fa=describeStagingFa(o)+(focus.fa?"؛ "+focus.fa:""),en=" "+describeStagingEn(o)+focus.en+" "+lens.en;
  plan.staging=o;
  // Whoush re-picks the lens for the scene the user arranged: focal length and aperture (bokeh or deep focus, macro when it is that close).
  if(plan.camera)plan.camera={...plan.camera,focalLengthMm:lens.focalLengthMm,aperture:lens.aperture,iso:lens.iso,focus:lens.fa};
  if(plan.shot)plan.shot={...plan.shot,lens:lens.focalLengthMm+"mm "+lens.aperture};
  if(!plan.hardConstraints.includes(fa))plan.hardConstraints=[...plan.hardConstraints,fa];
  if(plan.mediaKind!=="image")plan.mediaPrompt=plan.mediaPrompt.slice(0,Math.max(0,3000-en.length))+en;
 }
 plan.mediaPrompt=rewriteMentions(plan.mediaPrompt,byTag,genTags).slice(0,3000);
 // An image prompt is compiled once from the final scene: the planner's text without its own camera and light words, then the canvas (lib/scene-compiler.ts).
 let content:SceneContent|undefined;
 // A brush edit has no scene to compile: its prompt is only the edit and the locks (a camera or light description would invite a re-shoot).
 if(plan.mediaKind==="image"&&plan.staging&&!files.some(f=>f.regionEdit)){
  const aspect=plan.camera?.aspectRatio??"16:9";
  // A hidden subject: the user's own arrangement is refused with the fix; a scene Whoush arranged moves its prop out of the way (the camera stays as asked).
  if(sceneVisibility(plan.staging,aspect).subject==="occluded"){
   if(parsed.stagingOverride){const q=occlusionMessageFa(plan.staging,aspect);rec({planner:label,fallbackReason:"composition_occluded",corrections:corrections.length?corrections:undefined});return {status:"needs_input",turnId,message:q,question:q};}
   plan.staging=clearSightByMovingProp(plan.staging,aspect);
  }
  const sourceImage=files.some(f=>f.kind==="image"&&f.role==="edit_reference");
  // Here the canvas the user arranged started from an earlier turn's plan, not from this turn's, so a change in both camera and light cannot be told
  // apart from a different plan: it stays a generic edit (no lock). The canvas change at «بساز» is checked against this turn's scene, which the canvas showed.
  const before=plannedStaging??plan.staging,op=resolveOperation({sourceImage,change:sceneChangeGroups(before,plan.staging)});
  const operation="conflict" in op?"content_edit":op.operation;
  content={content:plan.mediaPrompt,aspect,staging:plan.staging,sourceImage};plan.mediaPrompt=compileImagePrompt({content:plan.mediaPrompt,staging:plan.staging,aspect,operation}).prompt;
 }
 // What the plan decided, said as facts while the turn goes on: the goal, the lens and the frame.
 const cam=plan.camera,lensFa=cam?.focalLengthMm?"لنز "+faPlain(cam.focalLengthMm)+" میلی‌متری"+(cam.aperture?"، دیافراگم "+cam.aperture:""):undefined;
 note("planning","facts",[plan.intentSummaryFa,[lensFa,cam?.aspectRatio?"کادر "+cam.aspectRatio:undefined].filter(Boolean).join("، ")]);
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
  return {status:"unsupported",turnId,plan:withMain(toPublicPlan(plan,refs,undefined,input.style)),message:FA_VOICE_CLONE,reason:"voice_clone"};
 }
 // docs/MODERATION_POLICY.md step 4, "Reference inspection": every photo was checked right after upload (POST /api/media/review, lib/upload-review.ts). Only
 // the server's own record counts, by the review id the photo carries; a photo it does not know as safe (unchecked, blocked, forgotten after a restart) and
 // every video or audio file (no inspector yet) fail closed: the plan is returned with no proposal or price, so unchecked media never reaches a provider.
 const unchecked=files.filter(isUnchecked);
 if(unchecked.length){
  rec({planner:label,fallbackReason:"media_review_unavailable",corrections:corrections.length?corrections:undefined});
  const suggestedModel=suggestModel(requirements,kind),photos=unchecked.filter(f=>f.kind==="image").map(f=>f.tag);
  return {status:"unsupported",turnId,plan:withMain(toPublicPlan(plan,refs,suggestedModel,input.style)),message:faMediaReview(unchecked.map(f=>displayTag(f.tag)),unchecked.map(f=>f.kind))+(suggestedModel?faSuggestion(suggestedModel):""),...(suggestedModel?{suggestedModel}:{}),reason:"media_review",
   ...(photos.length===unchecked.length?{unreviewed:photos}:{})};
 }
 // The checked photos go to the model as reference images, in tag order; the prompt names each by its tag («[reference image 1 · character]»), and the
 // order note says which attached image is which.
 // A painted photo («ویرایش با قلم») is followed by its marked copy: the same photo with the area to change in translucent red, a guide only.
 // One picture is sent once (owner, 2026-11-06: no duplicates): two #s with the same checked bytes are one reference, and the order note names both.
 const sortedPhotos=files.filter(f=>f.kind==="image").sort((a,b)=>tagOrder(a.tag)-tagOrder(b.tag));
 const shaOf=(f:(typeof sortedPhotos)[number])=>safeReview(f.reviewId)?.sha256??f.tag;
 const photos=sortedPhotos.filter((f,i)=>f.regionEdit||sortedPhotos.findIndex(g=>!g.regionEdit&&shaOf(g)===shaOf(f))===i);
 const alsoNamed=(f:(typeof sortedPhotos)[number])=>sortedPhotos.filter(g=>g!==f&&!photos.includes(g)&&shaOf(g)===shaOf(f)).map(g=>describeTagEn(g));
 const asRef=(id:string|undefined,f:(typeof photos)[number],guide=false):TurnReference=>{const r=safeReview(id)!;const t=displayTag(f.tag)+(guide?" (ناحیه)":"");
  return {id:r.mediaId,url:MEDIA_ROUTE+r.mediaId,subjectFa:t,title:t,license:"user",creator:"",sourceUrl:"",source:"upload" as const,mime:r.mime};};
 const uploads:TurnReference[]=photos.flatMap(f=>f.regionEdit?[asRef(f.reviewId,f),asRef(f.regionEdit.guideReviewId,f,true)]:[asRef(f.reviewId,f)]);
 const painted=photos.filter(f=>f.regionEdit);
 if(painted.length){
  // Change only the painted area, as the note says; everything else is locked. The rule leads the plan, the sentence leads the edit in the prompt.
  for(const f of painted){
   const tagFa=displayTag(f.tag),list=f.regionEdit!.regions.map(r=>"#ادیت-"+faPlain(r.n)+" ("+REGION_COLOR_FA[r.color]+"): «"+r.note+"»").join("؛ ");
   plan.hardConstraints=["فقط ناحیه‌های رنگ‌شدهٔ "+tagFa+" تغییر می‌کنند — "+list+" — و بقیهٔ عکس دقیقاً همان می‌ماند: چهره، بافت پوست (منافذ و جزئیات، بدون صاف‌شدن)، بدن، ژست، کادر، نور، تنظیمات رنگ (وایت‌بالانس، نوردهی، کنتراست، اشباع و گریدینگ) و پس‌زمینه",...plan.hardConstraints.filter(c=>!c.startsWith("فقط ناحیه‌های رنگ‌شدهٔ "+tagFa))];
  }
  const lead=painted.map(f=>"Edit "+describeTagEn(f)+" only inside the areas painted in its marked copy, each as noted: "+f.regionEdit!.regions.map(r=>"the "+r.color+" area: "+r.note).join("; ")+". Do not regenerate the photo: everything outside these areas is copied from the source unchanged. "+GENERIC_EDIT_RULE_EN+". Inside each area, match the surrounding skin texture, grain, light and colour exactly so the change is invisible. The output is the edited photo only, with no paint and no marks.").join(" ");
  // The provider prompt is the edit and the locks only (owner, 2026-11-06: change only that part, nothing else): no planner scene, camera, light or
  // style lines, which would read as a re-shoot of the whole photo.
  plan.mediaPrompt=lead.slice(0,3000);content=undefined;
 }
 if(uploads.length){
  const order=" Attached reference images, in this order: "+photos.flatMap(f=>{const also=alsoNamed(f),names=describeTagEn(f)+(also.length?" (also named "+also.join(", ")+")":"");return f.regionEdit?[names,"the same photo with the areas to change painted in translucent colours (a guide only, never draw the paint)"]:[names];}).map((d,i)=>(i+1)+" = "+d).join("; ")+".";
  plan.mediaPrompt=plan.mediaPrompt.slice(0,Math.max(0,3000-order.length))+order;
  if(content)content={...content,content:(content.content.slice(0,Math.max(0,3000-order.length))+order)};
 }
 // A video model takes no photos (Seedance refuses real faces): the photos serve the video's opening-frame draft, which an image model makes from them.
 const modelReq:MediaRequirements=kind==="video"&&uploads.length?{...requirements,referenceImages:undefined,identityReference:undefined}:{...requirements,...(uploads.length?{referenceImages:Math.max(requirements.referenceImages??0,uploads.length)}:{})};
 // Research (docs/RESEARCH_PIPELINE.md): what has a real identity or needs research gets open-licensed references, each inspected by a vision model before
 // use. The research text is planner output, so it passes the same plan-text safety check first. A failure leaves a note, never a broken turn.
 let research:ResearchResult|undefined;
 // Only when the user gave no reference of their own (owner, 2026-11-06): an attached image or a saved character means their references lead, not the web.
 const userGaveReferences=Boolean(ref)||files.some(f=>f.kind==="image");
 if(plan.research?.subjects.length&&!userGaveReferences){
  for(const t of plan.research.subjects.flatMap(x=>[x.labelFa,...x.factsFa,...x.queries])){
   const r=evaluatePlanTextSafety(t);
   if(r.decision!=="allow"){rec({planner:label,fallbackReason:"plan_restricted",corrections,usage:result?.usage});return {status:"restricted",decision:r.decision,category:r.category,message:r.message};}
  }
  stage("researching");
  note("researching","facts",plan.research.subjects.slice(0,3).map(x=>"دنبال مرجع برای «"+x.labelFa+"»"));
  research=await (deps.research??(rp=>researchReferences(rp,{inspect:inspectReferences})))(plan.research)
   .catch(()=>({subjects:plan.research!.subjects.map(x=>({labelFa:x.labelFa,factsFa:[...x.factsFa],found:0,kept:0})),references:[],notesFa:["جست‌وجوی مرجع این بار انجام نشد؛ جزئیات تحقیق فقط در نوشتن صحنه به کار رفت."]}));
 }
 const refCount=research?.references.length??0;
 if(research)note("researching","facts",[refCount?faPlain(refCount)+" مرجع بررسی‌شده نگه داشتم":"مرجع مناسبی پیدا نشد؛ از دانسته‌ها می‌سازم"]);
 stage("pricing");
 let proposal:GenerationProposal;
 // With references, an image is offered on models that take them as images; when none fits, the usual models are offered and the references only shaped the plan.
 let usedAsImages=false;
 try{
  if(refCount&&kind==="image"){
   try{proposal=buildProposal(input.text,input.preference,{...modelReq,referenceImages:Math.max(requirements.referenceImages??0,refCount)},kind);usedAsImages=true;}
   catch(e){if(!(e instanceof NoCompatibleModelError))throw e;proposal=buildProposal(input.text,input.preference,modelReq,kind);}
  }else proposal=buildProposal(input.text,input.preference,modelReq,kind);
 }
 catch(e){
  if(!(e instanceof NoCompatibleModelError))throw e;
  rec({planner:label,fallbackReason:"no_compatible_model",corrections:corrections.length?corrections:undefined});
  const suggestedModel=suggestModel(modelReq,kind),base=ref?FA_NO_REFS:uploads.length&&!modelReq.lipSync?FA_NO_PHOTO_MODEL:lipsMsg;
  return {status:"unsupported",turnId,plan:withMain(toPublicPlan(plan,refs,suggestedModel,input.style)),message:base+(suggestedModel?faSuggestion(suggestedModel):""),...(suggestedModel?{suggestedModel}:{}),reason:"no_model"};
 }
 // Length from the source video (owner, 2026-11-08: an edit or a replacement in a video lasts as long as that video): the recommended model's version
 // that covers it, at the same resolution. A video to continue is not a source of length.
 const source=kind==="video"?files.find(f=>f.kind==="video"&&f.role!=="continue"&&f.durationSeconds):undefined;
 let lengthNote="";
 if(source?.durationSeconds){const m=matchSourceLength(proposal,source.durationSeconds);proposal=m.proposal;if(m.seconds){
  const src=Math.round(source.durationSeconds),same=Math.abs(m.seconds-source.durationSeconds)<=0.5,tag=displayTag(source.tag);
  lengthNote=script==="finglish"?(same?"\nToole video ba "+tag+" yekie: "+m.seconds+" sanie.":"\n"+tag+" "+src+" sanie-st; noskhe-ye "+m.seconds+" sanie-i ro gozashtam ke kamel ja beshe.")
   :(same?"\nمدت ویدیو با "+tag+" یکیه: "+faPlain(m.seconds)+" ثانیه.":"\n"+tag+" "+faPlain(src)+" ثانیه‌ست؛ نسخهٔ "+faPlain(m.seconds)+" ثانیه‌ای رو گذاشتم که کامل جا بشه.");}}
 {const m=findMediaModel(proposal.selectedModelId);if(m)note("pricing","facts",["مدل پیشنهادی: "+m.name]);}
 // Pre-generation risk check: the cheapest model stress-tests the plan for the chosen model before any generation is paid for. Fixes go into the prompt (and
 // into the scene text, so a canvas change keeps them); each risk shown passes the same safety and leak checks as the planner's own text.
 const chosenModel=findMediaModel(proposal.selectedModelId),reviewer=deps.reviewPlan??(reviewAvailable()?reviewPlan:undefined);
 let review:{severity:"high"|"medium"|"low";issueFa:string;fixEn:string}[]|null=null;
 // The pre-generation review would add scene-level fixes; a brush edit has no scene, so it is skipped there.
 // A light brief (triage) skips it: one subject, nothing to stress-test that is worth the wait.
 if(chosenModel&&reviewer&&!painted.length&&effort!=="light"){
  stage("reviewing");
  review=await reviewer({brief:input.text,kind,mediaPrompt:plan.mediaPrompt,hardConstraints:plan.hardConstraints,
   researchFactsFa:research?.subjects.flatMap(x=>x.factsFa)??[],aspect:content?.aspect??plan.camera?.aspectRatio,
   model:{name:chosenModel.name,kind:chosenModel.kind,resolution:chosenModel.resolution,durationSeconds:chosenModel.durationSeconds,takesReferences:usedAsImages,referenceCount:usedAsImages?refCount:0}}).catch(()=>null);
  if(review)review=review.filter(x=>evaluatePlanTextSafety(x.issueFa).decision==="allow"&&evaluatePlanTextSafety(x.fixEn).decision==="allow"&&!leakText(x.issueFa,input.text)&&!leakText(x.fixEn,input.text));
  if(review)note("reviewing","facts",review.length?review.slice(0,3).map(x=>x.issueFa):["ریسک جدی‌ای پیدا نشد"]);
  if(review?.length){plan.mediaPrompt=promptWithFixes(plan.mediaPrompt,review);if(content)content={...content,content:promptWithFixes(content.content,review)};}
 }
 keepPrompt(turnId,plan.mediaPrompt,content);
 if(uploads.length&&kind==="image")refStore().set(turnId,uploads);
 // A brush edit: after generation, everything outside the edited areas is restored from the source photo exactly (lib/region-restore.ts).
 const firstPainted=painted[0];
 if(firstPainted&&kind==="image")rememberRegionEdit(turnId,{sourceId:safeReview(firstPainted.reviewId)!.mediaId,guideId:safeReview(firstPainted.regionEdit!.guideReviewId)!.mediaId});
 if(research){
  if(usedAsImages&&refCount)refStore().set(turnId,research.references);
  const notes=[...research.notesFa,...(refCount&&!usedAsImages?[kind==="video"?"برای ویدیو، مرجع‌ها فعلاً در نوشتن صحنه به کار رفتن، نه به‌عنوان تصویر.":"مدل‌های پیشنهادی مرجع تصویری نمی‌گیرن؛ مرجع‌ها در نوشتن صحنه به کار رفتن."]:[])];
  const report:ProposalResearch={subjects:research.subjects.map(x=>({labelFa:x.labelFa,factsFa:x.factsFa,kept:x.kept})),
   references:research.references.map(({mime:_m,...r})=>r),notesFa:notes,usedAsImages:usedAsImages&&refCount>0};
  proposal={...proposal,research:report};
 }
 if(review)proposal={...proposal,review:{risks:review.map(x=>({severity:x.severity,issueFa:x.issueFa}))}};
 // Video drafts first (owner, 2026-11-08): a short, silent 480p video on the cheapest model that can run, from the same prompt, to test the motion and the
 // scene before the real price. Where none can run, a still of the opening frame on the cheapest image model (taking the references when it can).
 // Both are quoted against their own private turn.
 // With a source video (an edit or a replacement in the user's own clip), the draft is the frame preview instead (owner, 2026-11-08): the clip's frames
 // (first, middle, last, one every 3 s), each edited by the cheap image model with the user's photos. A preview of the edit: the card says the video
 // models read only the prompt. Anything that fails leaves the usual draft.
 const frameModel=findMediaModel(DRAFT_IMAGE_MODEL),sourceVideo=kind==="video"?files.find(f=>f.kind==="video"&&f.role!=="continue"&&f.durationSeconds&&safeReview(f.reviewId)?.kind==="video"):undefined;
 if(sourceVideo&&frameModel&&!frameModel.pricePending&&frameModel.neurons){
  try{
   const fd=deps.frames??{},mediaId=safeReview(sourceVideo.reviewId)!.mediaId;
   const video=await (fd.read??(async(id:string)=>(await readMedia(id))?.bytes))(mediaId);
   if(!video)throw new Error("source_missing");
   const shots=await (fd.sample??sourceFrames)(video,frameTimes(sourceVideo.durationSeconds!));
   const cap=frameModel.capabilities.referenceImages.supported?frameModel.capabilities.referenceImages.max??1:1,photosFor=uploads.slice(0,Math.max(0,cap-1));
   const frames=await Promise.all(shots.map(async(s,i)=>{
    const stored=await (fd.store??(b=>storeMedia(b,"image/jpeg")))(s.bytes),label=displayTag(sourceVideo.tag)+" · فریم "+faPlain(i+1);
    const turn=randomUUID();
    keepPrompt(turn,framePrompt(plan.mediaPrompt,i+1,photosFor.length,s.atSeconds));
    refStore().set(turn,[...photosFor,{id:stored.id,url:MEDIA_ROUTE+stored.id,subjectFa:label,title:label,license:"user",creator:"",sourceUrl:"",source:"upload" as const,mime:"image/jpeg"}]);
    return {turnId:turn,atSeconds:s.atSeconds};
   }));
   // Each frame keeps the source video's shape: its ratio, or the nearest the image model offers.
   const ratio=(w:number,h:number)=>{const g=(a:number,b:number):number=>b?g(b,a%b):a,k=g(w,h);return w/k<100&&h/k<100?w/k+":"+h/k:w>=h?"16:9":"9:16";};
   const shape=sourceVideo.width&&sourceVideo.height?nearestAspectRatio(ratio(sourceVideo.width,sourceVideo.height),frameModel.capabilities.aspectRatios):undefined;
   if(frames.length)proposal={...proposal,draft:{turnId:frames[0].turnId,modelId:frameModel.id,modelName:frameModel.name,neurons:frames.length*frameModel.neurons,kind:"frames",frames,...(shape?{aspectRatio:shape}:{})}};
  }catch(e){if(devLiveTest().enabled)console.info("[whoush dev-live] frame preview skipped:",e instanceof Error?e.message:"error");}
 }
 const videoDraft=kind==="video"&&!proposal.draft?draftVideoModel(plan.camera?.aspectRatio):undefined;
 if(proposal.draft){/* the frame preview */}
 else if(videoDraft&&videoDraft.id!==proposal.selectedModelId&&videoDraft.neurons<proposal.fixedNeurons){
  const draftTurn=randomUUID();
  keepPrompt(draftTurn,plan.mediaPrompt);
  proposal={...proposal,draft:{turnId:draftTurn,modelId:videoDraft.id,modelName:videoDraft.name,neurons:videoDraft.neurons,kind:"video"}};
 }else if(kind==="video"){
  const draftModel=findMediaModel(DRAFT_IMAGE_MODEL);
  if(draftModel&&!draftModel.pricePending&&draftModel.neurons){
   const draftTurn=randomUUID();
   keepPrompt(draftTurn,(DRAFT_PREFIX+plan.mediaPrompt).slice(0,3000-DRAFT_SUFFIX.length)+DRAFT_SUFFIX);
   // The research references (inspected) go with the draft: the image model takes them even when the video model cannot.
   const refs=[...uploads,...(research?.references??[])];if(refs.length)refStore().set(draftTurn,refs);
   proposal={...proposal,draft:{turnId:draftTurn,modelId:draftModel.id,modelName:draftModel.name,neurons:draftModel.neurons}};
   // The references now serve the draft: the report says so, and the user can still remove any before drafting.
   if(refs.length&&proposal.research)proposal={...proposal,research:{...proposal.research,usedAsImages:true,
    notesFa:[...proposal.research.notesFa.filter(n=>!n.startsWith("برای ویدیو")),"مرجع‌ها توی پیش‌نویس (عکس فریم اول) به کار می‌رن؛ خود ویدیو فعلاً از همین پرامپت بررسی‌شده ساخته می‌شه."]}};
  }
 }
 rec({planner:label,fallbackReason,corrections:corrections.length?corrections:undefined,usage:label==="live"?result?.usage:undefined});
 // The proposal speaks in Whoush's voice; a rejected explicit model request keeps its factual note after the reply.
 // «هر دو»: the video's opening-frame draft is the photo, then the video from it.
 const photoNote=uploads.length&&kind==="video"&&proposal.draft&&!proposal.draft.kind?(script==="finglish"?"\nAksato too pish-nevis (frame-e aval) estefade mikonam; khod-e video felan az roo-ye prompt sakhte mishe.":"\nعکس‌هات توی پیش‌نویس (فریم اول) به کار می‌رن؛ خود ویدیو فعلاً از روی پرامپت ساخته می‌شه."):"";
 const bothNote=wantsBoth&&proposal.draft&&!proposal.draft.kind?(script==="finglish"?"\nHar do ro misazam: aval aks (frame-e aval), baad video.":"\nهر دو رو می‌سازم: اول عکس (فریم اول)، بعد ویدیو از روی همون."):"";
 // Sound (owner, 2026-11-08): a video model with checked sound gets the card's toggle, and Whoush asks (or confirms what the brief said). Without the
 // check here no model is offered sound: the toggle is hidden and the video stays silent.
 let soundNote="";
 if(kind==="video"){
  const ready=proposal.suggestions.some(s=>s.audio)&&await (deps.audioCheckAvailable??audioCheckAvailable)();
  if(!ready)proposal={...proposal,suggestions:proposal.suggestions.map(({audio:_a,...s})=>s)};
  else{const w=soundWanted(parsed.text);proposal={...proposal,...(w!==undefined?{soundWanted:w}:{})};
   if(proposal.suggestions.find(s=>s.modelId===proposal.selectedModelId)?.audio)soundNote="\n"+soundLineFa(w,script);}
 }
 proposal={...proposal,message:replyText("planned")+lengthNote+soundNote+bothNote+photoNote+(proposal.explicitRejected?"\n"+proposal.message:"")};
 const gif=gifMood?await (deps.findGif??findGif)(gifMood).catch(()=>undefined):undefined;
 return {status:"planned",turnId,proposal,plan:withMain(toPublicPlan(plan,refs,undefined,input.style)),...(gif?{gif}:{}),...(reaction?{reaction}:{})};
}
