/** Chat history as projects and the assets page: the pure data model. Browser-local only (see lib/project-store.ts); safe in the browser and on the server. */
import {isQuestionChoices,type QuestionChoice} from "./media-intent";
import {findReferenceNeed,type ReferenceRequest} from "./reference-needs";
import {ATTACHMENT_KIND_IDS,ATTACHMENT_ROLE_IDS,MAX_ATTACHMENTS,displayTag,isGenerationTag,nextGenerationTag,splitMentions,tagPrefix,type AttachmentKind,type AttachmentRole,type AttachmentSpeech,type LocalAttachment,type TagCounters} from "./attachments";
import {GENERATION_STYLES,MAX_GENERATION_REFS,MAX_GENERATION_SUMMARY_CHARS,MAX_HISTORY_CHARS,MAX_HISTORY_TURNS,REACTION_EMOJIS,STYLE_LABEL_FA,type GenerationRef,type GenerationStyle,type HistoryTurn,type PublicCreativePlan,type ReactionEmoji} from "./creative-plan";
import {faPlain} from "./format";
import {MODES} from "./mode";
import {UNSUPPORTED_REASONS,type AgentPreference,type UnsupportedReason} from "./types";

export const PROJECT_VERSION=1;
export const MAX_TITLE=80;
export const MAX_MESSAGES=500;
export const MAX_MESSAGE_TEXT=8000;
export const AUTO_TITLE_MAX=40;
export const UNTITLED_FA="پروژهٔ بی‌نام";
/** Shown wherever projects or assets are listed: there are no accounts or server storage yet. */
export const LOCAL_ONLY_FA="پروژه‌ها و فایل‌ها فقط در همین مرورگر ذخیره می‌شوند";
export const PAST_PROPOSAL_FA="این پیشنهاد مربوط به قبل است؛ برای تولید دوباره بفرست";

export type MessageKind="text"|"proposal"|"no_model"|"restricted"|"job"|"question"|"gif";
/** What a past proposal needs to be shown read-only: the recommended model and its fixed Neurons, and the public plan. Never approvable after a reload (quotes expire). */
/** `tag` is the generation's tag in this chat (`generation1`, shown as #تولید-۱); proposals saved before tags existed get one when the project opens. */
export type ProposalSnapshot={operation:"generate_image"|"generate_video";modelName:string;neurons:number;intentSummaryFa:string;plan:PublicCreativePlan;tag?:string;
 /** A follow-up about one or two parts of the scene: «بوم» opens on just those parts (lib/staging.ts, followUpFocus; «camera» in older saves). */focus?:string[]};
export type NoModelSnapshot={message:string;plan?:PublicCreativePlan;reason?:UnsupportedReason};
/**
 * A generation's status in the transcript. `jobId` lets a reopened project ask the server again (a job still running is followed to its end); `outputs` are
 * Whoush-owned media paths only, so a finished job shows its result after a reload; `typicalMs` paces the progress estimate.
 */
export type JobSnapshot={state:string;messageFa:string;tag?:string;jobId?:string;outputs?:{kind:"image"|"video";url:string}[];typicalMs?:number;
 /** A video's cheap opening-frame draft (made on `draftModel`), not the video itself. */draft?:{modelName:string}};
const OWNED_MEDIA_PATH=/^\/api\/generation\/media\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const isJobOutputs=(v:unknown)=>Array.isArray(v)&&v.length<=4&&v.every(o=>isObject(o)&&(o.kind==="image"||o.kind==="video")&&typeof o.url==="string"&&OWNED_MEDIA_PATH.test(o.url));
/**
 * `generationTags`: generations a user message referred to with a card (older projects), shown with it and sent again on a rerun. `brief`: what was actually sent
 * when the message answered Whoush's question (the original request plus the answer); a rerun sends it again.
 */
type MessageBase={id:string;role:"user"|"agent";text:string;at:string;attachmentIds?:string[];generationTags?:string[];brief?:string;reactions?:Reaction[]};
/** A Slack-style emoji reaction on a message, by the user or by Whoush; at most one of each emoji per reactor. */
export type Reaction={emoji:ReactionEmoji;by:"user"|"whoush"};
/** A GIF sent in the chat (by the user or by Whoush): GIPHY's own media URLs, as the API returned them (never cached or rewritten). */
export type GifSnapshot={id:string;url:string;stillUrl:string;width:number;height:number;title:string};
/** Whoush's one critical question: no plan card or price until the user answers. */
export type QuestionSnapshot={question:string;/** Photos Whoush asked for (one upload slot per angle). */references?:ReferenceRequest;
 /** One-tap answers («عکس»، «ویدیو»، «هر دو»). */choices?:QuestionChoice[];
 /** The edit card: the photo or generation to open for «ادیت» (lib/edit-card.ts). */editCard?:{tag:string};
 /** One card per picture to edit. */editCards?:{tag:string}[]};
export type StoredMessage=MessageBase&(
 |{kind?:"text";snapshot?:undefined}
 /** A refusal, with the safe ideas Whoush offered (one tap each). */
 |{kind:"restricted";snapshot?:{choices?:QuestionChoice[]}}
 |{kind:"proposal";snapshot:ProposalSnapshot}
 |{kind:"no_model";snapshot:NoModelSnapshot}
 |{kind:"job";snapshot:JobSnapshot}
 |{kind:"question";snapshot:QuestionSnapshot}
 |{kind:"gif";snapshot:GifSnapshot});
export type CharacterRef={id:string;name:string;angles:string[];version:number};
export type Project={
 id:string;title:string;titleSource:"auto"|"user";createdAt:string;updatedAt:string;version:1;
 messages:StoredMessage[];tagCounters:TagCounters;mode:AgentPreference;style:GenerationStyle|null;characterRef?:CharacterRef;
};
/** What the rail needs; the store lists these without the transcripts. */
export type ProjectSummary=Pick<Project,"id"|"title"|"titleSource"|"createdAt"|"updatedAt">;
export const summarize=(p:ProjectSummary):ProjectSummary=>({id:p.id,title:p.title,titleSource:p.titleSource,createdAt:p.createdAt,updatedAt:p.updatedAt});

// ---- titles ----
const ZWNJ="‌";
/**
 * The title of a new project from its first message: mentions (`#تصویر-۱`) removed, whitespace collapsed, at most 40 characters plus «…».
 * A cut never lands inside a word joined by a ZWNJ (the whole word goes) or before a combining mark. Nothing left means «پروژهٔ بی‌نام».
 */
export function autoTitle(firstUserText:string):string{
 const plain=splitMentions(firstUserText).map(p=>"text" in p?p.text:" ").join("").replace(/\s+/g," ").trim();
 if(!plain)return UNTITLED_FA;
 const chars=Array.from(plain);
 if(chars.length<=AUTO_TITLE_MAX)return plain;
 let end=AUTO_TITLE_MAX;
 if(chars[end-1]===ZWNJ||chars[end]===ZWNJ){
  const space=chars.lastIndexOf(" ",end-1);
  if(space>0)end=space;
  else while(end>1&&(chars[end-1]===ZWNJ||chars[end]===ZWNJ))end--;
 }
 while(end>1&&/\p{M}/u.test(chars[end]??""))end--;
 const cut=chars.slice(0,end).join("").replace(/[\s‌]+$/u,"");
 return (cut||plain.slice(0,1))+"…";
}

// ---- recency ----
/** Most recently updated first; equal times keep a stable order by id. Returns a new array. */
export function sortRecent<T extends {id:string;updatedAt:string}>(items:readonly T[]):T[]{
 return [...items].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)||a.id.localeCompare(b.id));
}
const MIN=60_000,HOUR=60*MIN,DAY=24*HOUR;
/** «همین الان», «۵ دقیقه پیش», «۲ ساعت پیش», «دیروز», «۳ روز پیش»; a week or more (or an unreadable date) is the Jalali date. */
export function relativeTimeFa(date:string|number|Date,now:Date=new Date()):string{
 const t=new Date(date).getTime();
 if(!Number.isFinite(t))return "";
 const diff=now.getTime()-t;
 if(diff<MIN)return "همین الان";
 if(diff<HOUR)return faPlain(Math.floor(diff/MIN))+" دقیقه پیش";
 if(diff<DAY)return faPlain(Math.floor(diff/HOUR))+" ساعت پیش";
 const days=Math.floor(diff/DAY);
 if(days===1)return "دیروز";
 if(days<7)return faPlain(days)+" روز پیش";
 return new Date(t).toLocaleDateString("fa-IR");
}
const JOB_STATE_FA:Record<string,string>={queued:"در صف",running:"در حال تولید",completed:"تکمیل",completed_demo:"تکمیل (نمایشی)",failed:"ناموفق",canceled:"لغو شد",released:"آزاد شد"};
export const jobStateFa=(state:string)=>JOB_STATE_FA[state]??JOB_STATE_FA.queued;

// ---- validation ----
const ID=/^[a-z0-9-]{8,80}$/i;
const isObject=(v:unknown):v is Record<string,unknown>=>typeof v==="object"&&v!==null&&!Array.isArray(v);
const isTime=(v:unknown)=>typeof v==="string"&&Number.isFinite(Date.parse(v));
const isCount=(v:unknown)=>typeof v==="number"&&Number.isInteger(v)&&v>=0&&v<=99;
const strings=(v:unknown,max=100)=>Array.isArray(v)&&v.length<=max&&v.every(x=>typeof x==="string"&&x.length<=1000);
const bad=(what:string):never=>{throw new Error("پروژهٔ ذخیره‌شده نامعتبر است: "+what);};
/** Only the plan fields PlanDetails reads; a damaged local record must not crash the transcript. */
function isPlan(p:unknown):p is PublicCreativePlan{
 if(!isObject(p))return false;
 const c=p.continuity;
 return typeof p.intentSummaryFa==="string"&&(p.mediaKind==="image"||p.mediaKind==="video")&&strings(p.hardConstraints)&&strings(p.softPreferences)&&strings(p.qaChecklist)
  &&Array.isArray(p.references)&&isObject(c)&&strings(c.locks)&&strings(c.antiTeleport)&&isObject(p.realism);
}
function checkMessage(m:unknown,i:number){
 if(!isObject(m))return bad("پیام "+faPlain(i+1));
 if(typeof m.id!=="string"||m.id.length<1||m.id.length>80)bad("شناسهٔ پیام");
 if(m.role!=="user"&&m.role!=="agent")bad("نقش پیام");
 if(typeof m.text!=="string"||m.text.length>MAX_MESSAGE_TEXT)bad("متن پیام");
 if(!isTime(m.at))bad("زمان پیام");
 if(m.attachmentIds!==undefined&&!(Array.isArray(m.attachmentIds)&&m.attachmentIds.length<=MAX_ATTACHMENTS&&m.attachmentIds.every(x=>typeof x==="string"&&ID.test(x))))bad("پیوست‌های پیام");
 if(m.reactions!==undefined&&!(Array.isArray(m.reactions)&&m.reactions.length<=REACTION_EMOJIS.length*2&&m.reactions.every(r=>isObject(r)&&(REACTION_EMOJIS as readonly unknown[]).includes(r.emoji)&&(r.by==="user"||r.by==="whoush"))))bad("واکنش‌ها");
 if(m.brief!==undefined&&!(typeof m.brief==="string"&&m.brief.length<=4000))bad("متن ارسال‌شده");
 if(m.generationTags!==undefined&&!(Array.isArray(m.generationTags)&&m.generationTags.length<=MAX_GENERATION_REFS&&m.generationTags.every(x=>typeof x==="string"&&isGenerationTag(x))))bad("تولیدهای پیام");
 const s=m.snapshot;
 switch(m.kind){
  case undefined:case "text":if(s!==undefined)bad("پیام ساده عکس لحظه‌ای ندارد");break;
  case "restricted":if(s!==undefined&&!(isObject(s)&&(s.choices===undefined||isQuestionChoices(s.choices))))bad("پیشنهادهای جایگزین");break;
  case "proposal":
   if(!isObject(s)||(s.operation!=="generate_image"&&s.operation!=="generate_video")||typeof s.modelName!=="string"||!Number.isSafeInteger(s.neurons)||typeof s.intentSummaryFa!=="string"||!isPlan(s.plan)||(s.tag!==undefined&&!(typeof s.tag==="string"&&isGenerationTag(s.tag)))
    ||(s.focus!==undefined&&!(Array.isArray(s.focus)&&s.focus.length<=5&&s.focus.every(f=>["frame","angle","distance","lens","light","camera"].includes(f as string)))))bad("پیشنهاد");
   break;
  case "no_model":if(!isObject(s)||typeof s.message!=="string"||(s.plan!==undefined&&!isPlan(s.plan))||(s.reason!==undefined&&!UNSUPPORTED_REASONS.includes(s.reason as UnsupportedReason)))bad("نبود مدل سازگار");break;
  case "gif":if(!isObject(s)||typeof s.id!=="string"||typeof s.title!=="string"||!isGiphyMedia(s.url)||!isGiphyMedia(s.stillUrl)||!(Number(s.width)>0&&Number(s.height)>0))bad("گیف");break;
  case "question":if(!isObject(s)||typeof s.question!=="string"||s.question.length<1||s.question.length>1000||(s.choices!==undefined&&!isQuestionChoices(s.choices))
   ||(s.editCard!==undefined&&!(isObject(s.editCard)&&typeof (s.editCard as {tag?:unknown}).tag==="string"&&((s.editCard as {tag:string}).tag.length<=40)))
   ||(s.editCards!==undefined&&!(Array.isArray(s.editCards)&&s.editCards.length<=10&&s.editCards.every(c=>isObject(c)&&typeof (c as {tag?:unknown}).tag==="string"&&(c as {tag:string}).tag.length<=40))))bad("سؤال");
   else if(s.references!==undefined){const r=s.references as Record<string,unknown>;
    if(!isObject(r)||typeof r.need!=="string"||!findReferenceNeed(r.need)||typeof r.titleFa!=="string"||typeof r.role!=="string"||!Array.isArray(r.angles)||r.angles.length>6
     ||!r.angles.every(a=>isObject(a)&&typeof (a as Record<string,unknown>).id==="string"&&typeof (a as Record<string,unknown>).titleFa==="string"))bad("سؤال");}
   break;
  case "job":if(!isObject(s)||typeof s.state!=="string"||typeof s.messageFa!=="string"||(s.tag!==undefined&&!(typeof s.tag==="string"&&isGenerationTag(s.tag)))
   ||(s.jobId!==undefined&&!(typeof s.jobId==="string"&&/^[0-9a-f-]{36}$/.test(s.jobId)))||(s.outputs!==undefined&&!isJobOutputs(s.outputs))
   ||(s.typicalMs!==undefined&&!(Number.isSafeInteger(s.typicalMs)&&(s.typicalMs as number)>0&&(s.typicalMs as number)<=3_600_000))
   ||(s.draft!==undefined&&!(isObject(s.draft)&&typeof (s.draft as Record<string,unknown>).modelName==="string"&&((s.draft as Record<string,unknown>).modelName as string).length<=80)))bad("وضعیت تولید");break;
  default:bad("نوع پیام");
 }
}
/** Throws an Error with a Persian message when a project is not one this app could have written. */
export function validateProject(p:unknown):asserts p is Project{
 if(!isObject(p))return bad("ساختار");
 if(typeof p.id!=="string"||!ID.test(p.id))bad("شناسه");
 if(typeof p.title!=="string"||p.title.trim().length<1||p.title.length>MAX_TITLE)bad("عنوان باید بین ۱ تا ۸۰ نویسه باشد");
 if(p.titleSource!=="auto"&&p.titleSource!=="user")bad("منبع عنوان");
 if(!isTime(p.createdAt)||!isTime(p.updatedAt))bad("زمان");
 if(p.version!==PROJECT_VERSION)bad("نسخه");
 if(!Array.isArray(p.messages)||p.messages.length>MAX_MESSAGES)bad("تعداد پیام‌ها بیش از "+faPlain(MAX_MESSAGES)+" است");
 (p.messages as unknown[]).forEach(checkMessage);
 const c=p.tagCounters;
 if(!isObject(c)||!(["image","video","audio","file"] as const).every(k=>isCount(c[k])))bad("شمارندهٔ برچسب‌ها");
 if(!MODES.some(m=>m.preference===p.mode))bad("حالت ساخت");
 if(p.style!==null&&!(GENERATION_STYLES as readonly unknown[]).includes(p.style))bad("سبک");
 const r=p.characterRef;
 if(r!==undefined&&!(isObject(r)&&typeof r.id==="string"&&ID.test(r.id)&&typeof r.name==="string"&&r.name.length>=1&&r.name.length<=MAX_TITLE&&strings(r.angles,6)&&Number.isInteger(r.version)&&(r.version as number)>=1))bad("کاراکتر");
}
/** A stored value as a project, or undefined if it does not validate (such records are skipped, never rendered). */
export function parseProject(raw:unknown):Project|undefined{
 try{validateProject(raw);return raw;}catch{return undefined;}
}
/** A valid title for a user rename: trimmed, 1..80 characters. */
export function cleanTitle(raw:string):string|undefined{
 const t=raw.replace(/\s+/g," ").trim();
 return t.length>=1&&t.length<=MAX_TITLE?t:undefined;
}

// ---- assets ----
/** A file of a project, kept in this browser. `name` is private and never leaves it. `blob` is absent when the browser had no room to store it. */
export type StoredAsset={
 id:string;projectId:string;kind:AttachmentKind;role?:AttachmentRole;roleSource?:"user";tag:string;mime:string;bytes:number;sha256:string;
 width?:number;height?:number;durationSeconds?:number;name:string;createdAt:string;textExcerpt?:string;speech?:AttachmentSpeech;blob?:Blob;fromGeneration?:string;
};
export function attachmentToAsset(a:LocalAttachment,projectId:string,createdAt:string,blob?:Blob):StoredAsset{
 return {id:a.id,projectId,kind:a.kind,...(a.role?{role:a.role,roleSource:"user" as const}:{}),tag:a.tag,mime:a.mime,bytes:a.bytes,sha256:a.sha256,
  ...(a.width!==undefined?{width:a.width}:{}),...(a.height!==undefined?{height:a.height}:{}),...(a.durationSeconds!==undefined?{durationSeconds:a.durationSeconds}:{}),
  name:a.name,createdAt,...(a.textExcerpt!==undefined?{textExcerpt:a.textExcerpt}:{}),...(a.speech?{speech:a.speech}:{}),...(a.fromGeneration?{fromGeneration:a.fromGeneration}:{}),...(blob?{blob}:{})};
}
/** The chat's attachment for a stored asset; pass an object URL made from its blob (the caller revokes it). */
export function assetToAttachment(a:StoredAsset,previewUrl?:string):LocalAttachment{
 return {id:a.id,tag:a.tag,kind:a.kind,mime:a.mime,bytes:a.bytes,sha256:a.sha256,name:a.name,...(a.role?{role:a.role}:{}),
  ...(a.width!==undefined?{width:a.width}:{}),...(a.height!==undefined?{height:a.height}:{}),...(a.durationSeconds!==undefined?{durationSeconds:a.durationSeconds}:{}),
  ...(a.textExcerpt!==undefined?{textExcerpt:a.textExcerpt}:{}),...(a.speech?{speech:a.speech}:{}),...(typeof a.fromGeneration==="string"?{fromGeneration:a.fromGeneration}:{}),...(previewUrl?{previewUrl}:{})};
}
/** The assets page's kind tabs; «فایل» is every document kind (pdf, json, md). */
export const ASSET_FILTERS=[{id:"all",labelFa:"همه"},{id:"image",labelFa:"تصویر"},{id:"video",labelFa:"ویدیو"},{id:"audio",labelFa:"صدا"},{id:"file",labelFa:"فایل"}] as const;
export type AssetKindFilter=(typeof ASSET_FILTERS)[number]["id"];
export const parseKindFilter=(v:unknown):AssetKindFilter=>ASSET_FILTERS.find(f=>f.id===v)?.id??"all";
export const assetGroup=(kind:AttachmentKind):Exclude<AssetKindFilter,"all">=>tagPrefix(kind);
export function filterAssets<T extends {kind:AttachmentKind;projectId:string}>(assets:readonly T[],f:{kind?:AssetKindFilter;projectId?:string|null}):T[]{
 return assets.filter(a=>(!f.kind||f.kind==="all"||assetGroup(a.kind)===f.kind)&&(!f.projectId||a.projectId===f.projectId));
}
/** Newest first, for the gallery. */
export const sortAssets=<T extends {id:string;createdAt:string}>(assets:readonly T[]):T[]=>[...assets].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||a.id.localeCompare(b.id));
export const isAssetKind=(v:unknown):v is AttachmentKind=>(ATTACHMENT_KIND_IDS as readonly unknown[]).includes(v);
export const isAssetRole=(v:unknown):v is AttachmentRole=>(ATTACHMENT_ROLE_IDS as readonly unknown[]).includes(v);
/**
 * The user message «اجرای دوباره» sends again: the message itself for a user message, the user message it answered (the nearest one before it) for an agent
 * message. Undefined for an unknown id or an agent message with no user message before it.
 */
export function rerunSource<T extends {id:string;role:"user"|"agent"}>(messages:readonly T[],id:string):T|undefined{
 const i=messages.findIndex(m=>m.id===id);
 if(i<0)return undefined;
 for(let j=i;j>=0;j--)if(messages[j].role==="user")return messages[j];
 return undefined;
}
/** Each item once, by id, first occurrence kept (a message sent again carries the same files as the original). */
export const uniqueById=<T extends {id:string}>(items:readonly T[]):T[]=>{const seen=new Set<string>();return items.filter(x=>!seen.has(x.id)&&(seen.add(x.id),true));};

// ---- generations: every proposal of a chat is a generation with its own tag (#تولید-۱), referable later in the same chat only ----
type WithSnapshot={id:string;kind?:string;snapshot?:unknown};
/** The generation tags in use in a transcript. */
export function generationTagsIn(messages:readonly WithSnapshot[]):string[]{
 return messages.flatMap(m=>m.kind==="proposal"&&typeof (m.snapshot as ProposalSnapshot).tag==="string"?[(m.snapshot as ProposalSnapshot).tag!]:[]);
}
/** Gives every proposal without a tag (saved before tags existed) the next free one, in transcript order; tagged ones keep theirs. Returns a new array. */
export function withGenerationTags<T extends WithSnapshot>(messages:readonly T[]):T[]{
 const used=generationTagsIn(messages);
 return messages.map(m=>{
  if(m.kind!=="proposal"||(m.snapshot as ProposalSnapshot).tag)return m;
  const tag=nextGenerationTag(used);if(!tag)return m;
  used.push(tag);return {...m,snapshot:{...(m.snapshot as ProposalSnapshot),tag}};
 });
}
/** The proposal message of a generation tag in this transcript, if any. */
export function findGeneration<T extends WithSnapshot>(messages:readonly T[],tag:string):(T&{snapshot:ProposalSnapshot})|undefined{
 return messages.find(m=>m.kind==="proposal"&&(m.snapshot as ProposalSnapshot).tag===tag) as (T&{snapshot:ProposalSnapshot})|undefined;
}
const KIND_FA={image:"تصویر",video:"ویدیو"} as const;
/**
 * The Persian summary of a generation's public plan that goes with a message referring to it, so the planner can revise it: kind, model, intent, the chosen style,
 * camera or shot, the key constraints and preferences. Plain data from the stored public plan (never the private media prompt), cut to the schema limit.
 */
export function generationSummaryFa(s:ProposalSnapshot):string{
 const p=s.plan,c=p.camera,sh=p.shot,lines=[
  "نوع: "+KIND_FA[p.mediaKind]+(s.modelName?" · مدل: "+s.modelName:""),
  "هدف: "+p.intentSummaryFa,
  ...(p.style?["سبک: "+STYLE_LABEL_FA[p.style]]:[]),
  ...(c?["دوربین: "+c.look+"؛ لنز "+c.focalLengthMm+" میلی‌متر، "+c.aperture+"، کادر: "+c.framing+"؛ نور: "+c.lighting+"؛ نسبت "+c.aspectRatio]:[]),
  ...(sh?["نما: "+sh.shotSize+"؛ حرکت: "+sh.cameraMovement+"؛ "+sh.durationSeconds+" ثانیه"]:[]),
  ...(p.hardConstraints.length?["قیدها: "+p.hardConstraints.slice(0,6).join("؛ ")]:[]),
  ...(p.softPreferences.length?["ترجیحات: "+p.softPreferences.slice(0,4).join("؛ ")]:[])
 ];
 const out=lines.join("\n");
 return out.length>MAX_GENERATION_SUMMARY_CHARS?out.slice(0,MAX_GENERATION_SUMMARY_CHARS-1)+"…":out;
}
/** The wire reference of a generation for POST /api/agent. */
export const toGenerationRef=(s:ProposalSnapshot&{tag:string}):GenerationRef=>({tag:s.tag,mediaKind:s.plan.mediaKind,summaryFa:generationSummaryFa(s)});
/** The generations a message refers to: the «اصلاح» cards first, then those it mentions (#تولید-۱), each once, only ones of this chat, at most MAX_GENERATION_REFS. */
export function referencedGenerations(cards:readonly string[],mentioned:readonly string[],known:ReadonlySet<string>):string[]{
 return [...new Set([...cards,...mentioned.filter(isGenerationTag)])].filter(t=>known.has(t)).slice(0,MAX_GENERATION_REFS);
}
/**
 * The text sent for a message that answers Whoush's question: the original request (or the brief it was sent with) and the answer on a new line, cut to the
 * 4000-character limit by shortening the original, never the answer.
 */
export function answerBrief(original:string,answer:string,max=4000):string{
 const room=Math.max(0,max-answer.length-1);
 return (original.slice(0,room)+"\n"+answer).slice(0,max);
}

const GIPHY_MEDIA=/^https:\/\/media\d*\.giphy\.com\/media\//;
const isGiphyMedia=(u:unknown)=>typeof u==="string"&&u.length<=500&&GIPHY_MEDIA.test(u);
/** Adds the reaction, or removes it when that reactor already has it (Slack-style toggle). Returns a new list in a stable order (palette order, user before Whoush). */
export function toggleReaction(list:readonly Reaction[]|undefined,emoji:ReactionEmoji,by:Reaction["by"]):Reaction[]{
 const cur=list??[],has=cur.some(r=>r.emoji===emoji&&r.by===by);
 const next=has?cur.filter(r=>!(r.emoji===emoji&&r.by===by)):[...cur,{emoji,by}];
 const order=(r:Reaction)=>REACTION_EMOJIS.indexOf(r.emoji)*2+(r.by==="user"?0:1);
 return [...next].sort((a,b)=>order(a)-order(b));
}
/** Reactions grouped by emoji for display: who reacted (the user, Whoush or both), in palette order. */
export function groupReactions(list:readonly Reaction[]|undefined):{emoji:ReactionEmoji;user:boolean;whoush:boolean}[]{
 const m=new Map<ReactionEmoji,{emoji:ReactionEmoji;user:boolean;whoush:boolean}>();
 for(const r of list??[]){const g=m.get(r.emoji)??{emoji:r.emoji,user:false,whoush:false};g[r.by]=true;m.set(r.emoji,g);}
 return [...m.values()].sort((a,b)=>REACTION_EMOJIS.indexOf(a.emoji)-REACTION_EMOJIS.indexOf(b.emoji));
}
type HistorySource={role:"user"|"agent";text:string;kind?:string;snapshot?:unknown;brief?:string};
/**
 * The recent turns sent with a message so Whoush stays conversation aware: the last MAX_HISTORY_TURNS messages, each cut to MAX_HISTORY_CHARS. A proposal adds its
 * generation tag and intent, a question its question, a GIF reads as «[GIF: title]» and is flagged so Whoush does not send GIFs back to back.
 */
export function historyFor(messages:readonly HistorySource[]):HistoryTurn[]{
 return messages.slice(-MAX_HISTORY_TURNS).map(m=>{
  let text=m.text;
  if(m.kind==="proposal"){const s=m.snapshot as ProposalSnapshot;text=[m.text,(s.tag?displayTag(s.tag)+": ":"")+s.intentSummaryFa].filter(Boolean).join("\n");}
  else if(m.kind==="question")text=[m.text,(m.snapshot as QuestionSnapshot).question].filter(Boolean).join("\n");
  else if(m.kind==="gif")text="[GIF: "+(m.snapshot as GifSnapshot).title+"]";
  return {role:m.role,text:text.slice(0,MAX_HISTORY_CHARS),...(m.kind==="gif"?{gif:true as const}:{})};
 }).filter(t=>t.text.trim().length>0);
}
