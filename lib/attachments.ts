/** Chat attachment contract: kinds, limits, magic-byte sniffing and wire shape. Pure; safe in the browser and on the server. */
import {faPlain} from "./format";
import {normalizePersian} from "./safety";
export type AttachmentKind="image"|"video"|"audio"|"pdf"|"json"|"md";
export type AttachmentRole="reference"|"frame"|"character"|"start_frame"|"end_frame"|"environment"|"object"|"outfit"|"hairstyle"|"makeup"|"graphic"|"edit_reference"|"motion_reference"|"continue"|"extend_back"|"lip_sync"|"music"|"voice_clone"|"general";
export type AttachmentSpeech={hasSpeech:boolean;language:"fa"|"other"|"unknown";accent:"tehrani"|"original"|"unspecified"};
const MB=1024*1024;
export const ATTACHMENT_KINDS={
 image:{mimes:["image/jpeg","image/png","image/webp"],maxBytes:20*MB,labelFa:"تصویر"},
 video:{mimes:["video/mp4","video/quicktime","video/webm"],maxBytes:100*MB,labelFa:"ویدیو"},
 audio:{mimes:["audio/mpeg","audio/wav","audio/x-wav","audio/mp4","audio/x-m4a","audio/ogg","audio/webm"],maxBytes:25*MB,labelFa:"صدا"},
 pdf:{mimes:["application/pdf"],maxBytes:20*MB,labelFa:"PDF"},
 json:{mimes:["application/json"],maxBytes:1*MB,labelFa:"JSON"},
 md:{mimes:["text/markdown","text/x-markdown","text/plain"],maxBytes:1*MB,labelFa:"Markdown"}
} as const satisfies Record<AttachmentKind,{mimes:readonly string[];maxBytes:number;labelFa:string}>;
export const ATTACHMENT_KIND_IDS=Object.keys(ATTACHMENT_KINDS) as [AttachmentKind,...AttachmentKind[]];
export const MAX_ATTACHMENTS=10;
export const MAX_TOTAL_ATTACHMENT_BYTES=200*MB;
export const MAX_EXCERPT_CHARS=8000;
export const MAX_DURATION_SECONDS=3600;
/** Bytes read for magic-number sniffing of binary files. */
export const SNIFF_BYTES=64*1024;
export const isMediaKind=(k:AttachmentKind)=>k==="image"||k==="video"||k==="audio";
type RoleDef={id:AttachmentRole;labelFa:string;hintFa:string;en:string};
/**
 * The roles the UI offers per media kind, in menu order (most used first): English ids on the wire, Persian labels and one-line hints in the UI. Files (pdf, json, md) have no role.
 * Choosing a role is OPTIONAL: without one, Whoush infers it from the brief (`inferAttachmentRoles`). `en` is the provider-facing phrase used when a mention is rewritten for the media prompt.
 * `general` is an internal inferred role only. `voice_clone` is NOT offered anywhere in the UI; the server still accepts it (with consent) only to refuse it, see `WIRE_ONLY_ROLES`.
 * Owner list of 2026-11-05. Two roles are categories that Whoush narrows from the brief (`resolveChosenRole`), so the planner always sees a concrete role:
 * `reference` (عکس رفرنس / فیلم رفرنس) becomes the edit source when the brief asks to change it (a video: to continue it), otherwise a general reference;
 * `frame` (فریم) becomes the start or the end frame (the brief decides; two frames without a hint are first and last).
 */
export const ATTACHMENT_ROLES={
 image:[
  {id:"reference",labelFa:"عکس رفرنس",hintFa:"عکسی که کار ازش الهام بگیره؛ توی پیامت بگو چیش مهمه",en:"image reference"},
  {id:"character",labelFa:"شخص",hintFa:"عکس یه آدم؛ چهره‌ش توی کار دقیقاً همین می‌مونه",en:"character"},
  {id:"hairstyle",labelFa:"پیرایش و آرایش",hintFa:"عکس مدل مو، ریش یا آرایشی که می‌خوای روی سوژه بیاد",en:"hairstyle, beard and makeup reference"},
  {id:"outfit",labelFa:"پوشاک",hintFa:"عکس لباس یا کفشی که می‌خوای سوژه بپوشه",en:"outfit reference"},
  {id:"environment",labelFa:"محیط",hintFa:"عکس جایی که می‌خوای صحنه اونجا باشه",en:"environment"},
  {id:"object",labelFa:"اشیا و محصول",hintFa:"عکس محصول یا وسیله‌ای که باید دقیقاً همین‌طور دیده بشه",en:"object"},
  {id:"graphic",labelFa:"گرافیک",hintFa:"لوگو یا طرحی که باید بدون تغییر روی کار بیاد",en:"graphic"},
  {id:"frame",labelFa:"فریم",hintFa:"عکسی که ویدیو باهاش شروع یا تموم می‌شه",en:"video frame"}
 ],
 video:[
  {id:"reference",labelFa:"ویدیو رفرنس",hintFa:"ویدیویی که کار ازش الهام بگیره؛ توی پیامت بگو چیش مهمه",en:"video reference"},
  {id:"motion_reference",labelFa:"الگوی حرکت",hintFa:"ویدیویی که حرکت‌هاش روی سوژه‌ی تو پیاده می‌شه",en:"motion reference"}
 ],
 audio:[
  {id:"lip_sync",labelFa:"الگوی گفتار",hintFa:"صدای حرف زدن؛ لب‌های سوژه با همین صدا تکون می‌خوره",en:"lip sync"},
  {id:"music",labelFa:"موزیک",hintFa:"آهنگی که ویدیو با ریتمش کات می‌خوره",en:"music reference"}
 ]
} as const satisfies Record<"image"|"video"|"audio",readonly RoleDef[]>;
/** The «فایل» group of the + menu: documents carry no role. */
export const FILE_MENU_FA={labelFa:"فایل",hintFa:"متن یا سند (PDF، JSON یا Markdown) برای توضیح بیشتر"} as const;
/** Roles the wire accepts but the UI never offers. `voice_clone` needs `consent: true` and always ends in an `unsupported` result (`voice_clone_unsupported`). */
const WIRE_ONLY_ROLES={audio:[{id:"voice_clone",labelFa:"کلون صدا",hintFa:"",en:"voice reference"}]} as const satisfies Partial<Record<"image"|"video"|"audio",readonly RoleDef[]>>;
/**
 * Concrete roles that are no longer in the menu but stay valid: Whoush resolves and infers them, the planner and skills use them, older projects and API clients
 * may still send them, and sent messages keep showing their labels.
 */
const RESOLVED_ROLES={
 image:[
  {id:"start_frame",labelFa:"فریم اول",hintFa:"همین عکس متحرک می‌شه",en:"start frame"},
  {id:"end_frame",labelFa:"فریم آخر",hintFa:"ویدیو به همین عکس ختم می‌شه",en:"end frame"},
  {id:"edit_reference",labelFa:"ادیت عکس",hintFa:"همین عکس رو بفرست؛ فقط چیزی که می‌گی عوض می‌شه",en:"edit reference"},
  {id:"makeup",labelFa:"آرایش",hintFa:"آرایش صورت با همین رنگ‌ها",en:"makeup reference"}
 ],
 video:[
  {id:"edit_reference",labelFa:"ادیت ویدیو",hintFa:"همین ویدیو رو بفرست؛ فقط چیزی که می‌گی عوض می‌شه",en:"edit reference"},
  // Forward and backward (owner, 2026-11-08): continue after the last frame, or a new clip that ends on the first frame.
  {id:"continue",labelFa:"امتداد ویدیو به جلو",hintFa:"ویدیو از آخرین فریمش ادامه پیدا می‌کنه",en:"video to continue"},
  {id:"extend_back",labelFa:"امتداد ویدیو از عقب",hintFa:"یه تکه‌ی تازه قبل از شروع همین ویدیو ساخته می‌شه",en:"video to extend backward"}
 ]
} as const satisfies Partial<Record<"image"|"video"|"audio",readonly RoleDef[]>>;
export const ATTACHMENT_ROLE_IDS=["reference","frame","character","start_frame","end_frame","environment","object","outfit","hairstyle","makeup","graphic","edit_reference","motion_reference","continue","extend_back","lip_sync","music","voice_clone"] as const satisfies readonly AttachmentRole[];
/** The roles a kind may carry and the UI offers (never `general`, never `voice_clone`); empty for files. */
export const rolesFor=(kind:AttachmentKind):readonly RoleDef[]=>isMediaKind(kind)?ATTACHMENT_ROLES[kind as "image"|"video"|"audio"]:[];
const wireRolesFor=(kind:AttachmentKind):readonly RoleDef[]=>kind==="audio"?[...ATTACHMENT_ROLES.audio,...WIRE_ONLY_ROLES.audio]:kind==="image"||kind==="video"?[...rolesFor(kind),...RESOLVED_ROLES[kind]]:[];
export const GENERAL_ROLE_LABEL_FA="مرجع کلی";
/** The Persian label of a role. `edit_reference` reads «ادیت عکس» or «ادیت ویدیو» by kind; without a kind the image label is used. */
export function roleLabelFa(role:AttachmentRole,kind?:AttachmentKind):string{
 if(role==="general")return GENERAL_ROLE_LABEL_FA;
 const kinds:AttachmentKind[]=kind&&isMediaKind(kind)?[kind]:["image","video","audio"];
 for(const k of kinds){const r=wireRolesFor(k).find(x=>x.id===role);if(r)return r.labelFa;}
 return role;
}
/** Whether the wire accepts this role on this kind (the UI offers `rolesFor`; `voice_clone` is accepted only to be refused). */
export const roleAllowed=(kind:AttachmentKind,role:AttachmentRole)=>wireRolesFor(kind).some(r=>r.id===role);

// ---- tags: image1, video1, audio1, file1 (pdf, json, md) stay English on the wire; users see #تصویر۱, #ویدیو۱, #صدا۱, #فایل۱ ----
export type TagPrefix="image"|"video"|"audio"|"file";
export const TAG_PATTERN=/^(image|video|audio|file)[1-9]\d?$/;
export const tagPrefix=(kind:AttachmentKind):TagPrefix=>kind==="image"||kind==="video"||kind==="audio"?kind:"file";
export type TagCounters=Record<TagPrefix,number>;
export const newTagCounters=():TagCounters=>({image:0,video:0,audio:0,file:0});
/**
 * Legacy counter-based allocator (counts up, never reuses); the studio now uses `lowestFreeTag`, and the counters are kept only in the saved project format;
 * "new chat" starts from `newTagCounters()`. Undefined when the conversation has used all 99 numbers of that prefix.
 */
export function allocateTag(counters:TagCounters,kind:AttachmentKind):{tag:string;counters:TagCounters}|undefined{
 const prefix=tagPrefix(kind),n=counters[prefix]+1;
 return n>99?undefined:{tag:prefix+n,counters:{...counters,[prefix]:n}};
}
/**
 * The tag a new file gets: the LOWEST free number of its kind's prefix, given every tag in use in the conversation (sent messages, files in the composer and
 * numbers reserved by empty upload cards). So removing `#تصویر-۲` from the composer and adding another photo gives `#تصویر-۲` again, while a number used in a
 * sent message is never handed to another file. Undefined when all 99 numbers of that prefix are in use.
 */
export function lowestFreeTag(used:Iterable<string>,kind:AttachmentKind):string|undefined{
 const p=tagPrefix(kind),taken=new Set(used);
 for(let n=1;n<=99;n++)if(!taken.has(p+n))return p+n;
 return undefined;
}
/** Keeps the saved counters (project format) at least at the highest number in use; allocation itself uses `lowestFreeTag`. */
export function bumpTagCounters(c:TagCounters,tag:string):TagCounters{
 const m=/^(image|video|audio|file)(\d+)$/.exec(tag);if(!m)return c;
 const k=m[1] as TagPrefix;return {...c,[k]:Math.max(c[k],Number(m[2]))};
}
/** The Persian word shown in a tag: `image1` is `#تصویر-۱`. The internal/wire tag stays English. */
export const TAG_WORD_FA={image:"تصویر",video:"ویدیو",audio:"صدا",file:"فایل"} as const satisfies Record<TagPrefix,string>;
// ---- generation tags: every generation plan of a chat gets `generation1`, `generation2`, ... shown as #تولید-۱; they name generations of that chat only ----
/** A mention names a file (`image1`, ...) or a generation of this chat (`generation1`). */
export type MentionPrefix=TagPrefix|"generation";
export const GENERATION_TAG_PATTERN=/^generation[1-9]\d?$/;
export const GENERATION_WORD_FA="تولید";
export const isGenerationTag=(tag:string)=>GENERATION_TAG_PATTERN.test(tag);
/** The next generation tag of a chat: the lowest number not in use (generations are never removed, so in practice one more than the last). Undefined after 99. */
export function nextGenerationTag(used:Iterable<string>):string|undefined{
 const taken=new Set(used);
 for(let n=1;n<=99;n++)if(!taken.has("generation"+n))return "generation"+n;
 return undefined;
}
const WORD_FA:Record<MentionPrefix,string>={...TAG_WORD_FA,generation:GENERATION_WORD_FA};
/** Every spelling accepted in a mention, as normalized by `normalizeMention`: Persian words (ویدئو too) and the legacy English prefixes. */
const MENTION_WORDS:Record<string,MentionPrefix>={"تصویر":"image","ویدیو":"video","ویدئو":"video","صدا":"audio","فایل":"file","تولید":"generation",image:"image",video:"video",audio:"audio",file:"file",generation:"generation",
 // Finglish (owner, 2026-11-08: «#tasvir-1»): typed and shown in the Finglish interface.
 tasvir:"image",seda:"audio",tolid:"generation"};
/** The Finglish word of each tag kind: `image1` is «#tasvir-1». */
export const TAG_WORD_FI:Record<MentionPrefix,string>={image:"tasvir",video:"video",audio:"seda",file:"file",generation:"tolid"};
/**
 * The script tags are shown in: Persian (default) or Finglish (lib/ui-lang.ts). Set once in the browser by the language provider; the server always
 * writes Persian tags (Whoush's replies are in the user's own script, and the Finglish page converts tags as it shows them).
 */
let tagScript:"fa"|"fi"="fa";
export const setTagScript=(s:"fa"|"fi")=>{tagScript=s;};
const faNumber=(n:number|string)=>String(n).replace(/\d/g,d=>String.fromCharCode(0x06f0+Number(d)));
/** The user-facing form of an internal tag: the Persian word, an ASCII hyphen and Persian digits. `image1` is `#تصویر-۱`, `file12` is `#فایل-۱۲`. */
export function displayTag(tag:string):string{return displayTagIn(tag,tagScript);}
/** A tag in a given script (Persian «#تصویر-۱» or Finglish «#tasvir-1»). */
export function displayTagIn(tag:string,script:"fa"|"fi"):string{
 if(isPropTag(tag))return tag;
 const m=/^(image|video|audio|file|generation)(\d+)$/.exec(tag);
 if(!m)return "#"+tag;
 return script==="fi"?"#"+TAG_WORD_FI[m[1] as MentionPrefix]+"-"+m[2]:"#"+WORD_FA[m[1] as MentionPrefix]+"-"+faNumber(m[2]);
}
/** Persian tags in a text in their Finglish form («#تصویر-۱» is «#tasvir-1»), for the Finglish page. */
export function finglishTags(text:string):string{
 return text.replace(mentionRe(),(raw,word:string,num:string)=>{const p=MENTION_WORDS[normalizeMention(word)],n=normalizeMention(num);return p&&/^[1-9]\d?$/.test(n)?raw[0]+TAG_WORD_FI[p]+"-"+n:raw;});
}
/** Case and script tolerant form of a typed token: Arabic ي/ى become ی, ك becomes ک, Arabic-Indic and Persian digits become ASCII, the dashes U+2010, U+2011, U+2013 and U+2212 become `-`, ZWNJ and tatweel vanish. */
const normalizeMention=(s:string)=>s.replace(/[\u200c\u0640]/g,"").replace(/[\u064a\u0649]/g,"\u06cc").replace(/\u0643/g,"\u06a9").replace(/[\u2010\u2011\u2013\u2212]/g,"-")
 .replace(/[\u0660-\u0669]/g,c=>String(c.charCodeAt(0)-0x0660)).replace(/[\u06f0-\u06f9]/g,c=>String(c.charCodeAt(0)-0x06f0)).toLowerCase();
/**
 * Mention syntax: `#` or `@` + a Persian or English kind word + an optional hyphen (or U+2010, U+2011, U+2013, U+2212 dash) + a number from 1 to 99, e.g. `#تصویر-۱`, `#تصویر۱`, `@صدا3`, `@image-1`. A ZWNJ in place of the hyphen is part of the word and ignored. A token starts at the beginning
 * or after anything but a letter, digit, mark, ZWNJ, underscore, `@` or `#` (so `email@image1.com` is not a mention) and is not followed by a letter, digit,
 * mark, ZWNJ or underscore (so `#تصویر۱۲۳` and `#نوروز` are not mentions).
 */
const mentionRe=()=>/(?<![\p{L}\p{N}\p{M}\u200c_@#])[#@]([\p{L}\u200c\u0640]+)[-\u2010\u2011\u2013\u2212]?(\p{N}+)(?![\p{L}\p{N}\p{M}\u200c_])/gu;
// ---- prop tags: a prop of the scene is named by its own tag, «#زن», «#ماشین-قرمز», «#درخت-۲», and can be mapped to a file: «#زن:تصویر-۱» ----
/** The tolerant form used to compare typed tags (ی/ک, digits, dashes, ZWNJ, case). */
export const normalizeMentionText=(s:string)=>normalizeMention(s);
/** A prop mention's tag is the text itself (it starts with `#`), unlike a file's or generation's internal tag (`image1`). */
export const isPropTag=(tag:string)=>tag.startsWith("#");
const propRe=()=>/(?<![\p{L}\p{N}\p{M}\u200c_@#])#([\p{L}\p{N}\u200c\u0640-]+?)(?::([\p{L}\u200c\u0640]+[-\u2010\u2011\u2013\u2212]?\p{N}+))?(?![\p{L}\p{N}\p{M}\u200c\u0640_-])/gu;
/** The file tag (`image1`) a typed reference word names («تصویر-۱», «image1»), if any. */
export function fileTagOf(word:string):string|undefined{const m=scanMentions("#"+word)[0];return m&&m.raw.length===word.length+1&&!isGenerationTag(m.tag)?m.tag:undefined;}
/** A prop mention's parts: its prop tag («#زن») and the file it is mapped to (`image1`), if any. */
export function propMentionParts(tag:string):{prop:string;file?:string}{
 const i=tag.indexOf(":");if(i<0)return {prop:tag};
 const file=fileTagOf(tag.slice(i+1));return file?{prop:tag.slice(0,i),file}:{prop:tag};
}
/** The canonical mention of a prop mapped to a file: «#زن» + `image1` is «#زن:تصویر-۱». */
export const propMention=(prop:string,file?:string)=>file?prop+":"+displayTag(file).slice(1):prop;
/** Every valid mention in the text, in order, with its position and its internal tag; with `props` (the scene's prop tags), prop mentions too. */
function scanMentions(text:string,props?:readonly string[]):Array<{index:number;raw:string;tag:string}>{
 const out:Array<{index:number;raw:string;tag:string}>=[];
 for(const m of text.matchAll(mentionRe())){
  const prefix=MENTION_WORDS[normalizeMention(m[1])],n=normalizeMention(m[2]);
  if(prefix&&/^[1-9]\d?$/.test(n))out.push({index:m.index,raw:m[0],tag:prefix+n});
 }
 if(props?.length){
  const byNorm=new Map(props.map(p=>[normalizeMention(p),p] as const));
  for(const m of text.matchAll(propRe())){
   const prop=byNorm.get(normalizeMention("#"+m[1]));if(!prop||out.some(o=>o.index===m.index))continue;
   const file=m[2]?fileTagOf(m[2]):undefined;
   // A «:» that names no file is plain text after the prop's tag.
   const raw=file?m[0]:"#"+m[1];
   out.push({index:m.index,raw,tag:propMention(prop,file)});
  }
  out.sort((a,b)=>a.index-b.index);
 }
 return out;
}
/** Distinct internal tags mentioned in the text (`#تصویر-۱`, `#تصویر۱` and `@image1` all give `image1`), in order of first use. */
export function parseMentions(text:string):string[]{
 return [...new Set(scanMentions(text).map(m=>m.tag))];
}
/** The text cut into plain runs and mentions (`raw` as typed, `tag` internal). */
export function splitMentions(text:string,props?:readonly string[]):Array<{text:string}|{tag:string;raw:string}>{
 const out:Array<{text:string}|{tag:string;raw:string}>=[];let at=0;
 for(const m of scanMentions(text,props)){
  if(m.index>at)out.push({text:text.slice(at,m.index)});
  out.push({tag:m.tag,raw:m.raw});at=m.index+m.raw.length;
 }
 if(at<text.length)out.push({text:text.slice(at)});
 return out;
}
const tagNumber=(tag:string)=>tag.replace(/\D/g,"");
/** Provider-facing English description of a tagged attachment, e.g. `[reference image 1 · character]` or `[motion reference video 1]`. */
export function describeTagEn(a:{tag:string;kind:AttachmentKind;role?:AttachmentRole}):string{
 const n=tagNumber(a.tag),en=a.role?wireRolesFor(a.kind).find(r=>r.id===a.role)?.en:undefined;
 if(a.kind==="image"&&a.role==="start_frame")return "[start frame image "+n+"]";
 if(a.kind==="image"&&a.role==="end_frame")return "[end frame image "+n+"]";
 if(a.kind==="video"&&a.role==="continue")return "[video to continue "+n+"]";
 if(a.kind==="video"&&a.role==="extend_back")return "[video to extend backward "+n+"]";
 if(a.kind==="image"&&(a.role==="outfit"||a.role==="hairstyle"||a.role==="makeup"))return "["+en+" image "+n+"]";
 if(a.kind==="image")return "[reference image "+n+(en?" · "+en:"")+"]";
 if(a.kind==="video")return "["+(en??"reference")+" video "+n+"]";
 if(a.kind==="audio")return "["+(en??"reference")+" audio "+n+"]";
 return "[attached document "+n+"]";
}
/**
 * Replaces every mention, in any accepted spelling, with its English description; a tag with no attachment becomes `[missing attachment]`. A generation of this chat
 * (`#تولید-۱`) becomes `[earlier generation 1]`, or `[missing generation]` when it is not among `generations`.
 */
export function rewriteMentions(text:string,byTag:ReadonlyMap<string,{tag:string;kind:AttachmentKind;role?:AttachmentRole}>,generations:ReadonlySet<string>=new Set()):string{
 let out="",at=0;
 for(const m of scanMentions(text)){
  const a=byTag.get(m.tag);
  const en=isGenerationTag(m.tag)?(generations.has(m.tag)?"[earlier generation "+tagNumber(m.tag)+"]":"[missing generation]"):a?describeTagEn(a):"[missing attachment]";
  out+=text.slice(at,m.index)+en;at=m.index+m.raw.length;
 }
 return out+text.slice(at);
}
/** Inserts the canonical `#تصویر-۱ ` over the range [start,end), adding a leading space when the previous character is not whitespace; returns the new text and caret. */
export function insertMention(text:string,start:number,end:number,tag:string):{text:string;caret:number}{
 const before=text.slice(0,start),after=text.slice(end),shown=displayTag(tag);
 const lead=before===""||/\s$/.test(before)?"":" ",ins=lead+shown+(/^\s/.test(after)?"":" ");
 return {text:before+ins+after,caret:before.length+lead.length+shown.length+1};
}
/** Whether a normalized query is the start of a tag word, optionally followed by a hyphen and up to two digits: `تص`, `im`, `صدا`, `صدا-`, `video2`. */
function isTagQuery(q:string):boolean{
 return Object.keys(MENTION_WORDS).some(w=>w.startsWith(q)||(q.startsWith(w)&&/^-?\d{0,2}$/.test(q.slice(w.length))));
}
/** Whether an attachment's (or a generation's) tag matches a normalized picker query (Persian or English word, either digit set, hyphen or not): `image1` matches `تص`, `im`, `تصویر-`, `تصویر۱` and `image1`, not `صدا`. */
export function tagMatchesQuery(tag:string,query:string):boolean{
 const q=normalizeMention(query),m=/^(image|video|audio|file|generation)(\d+)$/.exec(tag);
 if(!m)return false;
 return Object.entries(MENTION_WORDS).some(([w,p])=>p===m[1]&&((w+m[2]).startsWith(q)||(w+"-"+m[2]).startsWith(q)));
}
/**
 * The open `#query` or `@query` token right before the caret (at the start or after whitespace), if any. The query is normalized (lowercase, ASCII digits,
 * ی/ک unified). An ordinary hashtag such as `#نوروز` is not a trigger, because it is not the start of any tag word.
 */
export function mentionTrigger(text:string,caret:number,props:readonly string[]=[]):{start:number;query:string;prop?:string}|undefined{
 const before=text.slice(0,caret);
 // «#زن:» opens the files to map the prop to; what follows the colon filters them.
 const r=/(^|\s)(#[\p{L}\p{N}\u200c\u0640\-]+):([\p{L}\p{N}\u200c\u0640\u2010\u2011\u2013\u2212\-]*)$/u.exec(before);
 if(r){const prop=props.find(p=>normalizeMention(p)===normalizeMention(r[2]));if(prop)return {start:caret-r[3].length-r[2].length-1,query:normalizeMention(r[3]),prop};}
 const m=/(^|\s)[#@]([\p{L}\p{N}\u200c\u0640\u2010\u2011\u2013\u2212\-]*)$/u.exec(before);
 if(!m)return undefined;
 const query=normalizeMention(m[2]);
 return isTagQuery(query)||props.some(p=>propMatchesQuery(p,query))?{start:caret-m[2].length-1,query}:undefined;
}
/** Whether a prop's tag («#ماشین-قرمز») starts with a normalized picker query («ماش»). */
export const propMatchesQuery=(prop:string,query:string)=>normalizeMention(prop.slice(1)).startsWith(query);
// ---- role inference: words only, no image analysis ----
/** Where an attachment's role came from: the user's choice, or Whoush's best guess from the brief. */
export type RoleSource="user"|"inferred";
export type InferredRole={tag:string;role:AttachmentRole;roleSource:RoleSource};
const CLAUSE_END=/[.،,؛;?!؟\n\r]/;
/** Whole-word match on the normalized text; a Persian keyword may carry a plural or possessive suffix (لوگوی, کفش‌ها, چهره‌ام). */
const wordsRe=(l:readonly string[])=>new RegExp("(?<![\\p{L}\\p{N}])(?:"+l.map(w=>normalizePersian(w)+(/[\u0600-\u06ff]/.test(w)?"(?:ها|های|ی|ای|ام|ات|اش)?":"")).join("|")+")(?![\\p{L}\\p{N}])","u");
/** First match wins, in this order. Keywords are matched as whole words on the normalized text. */
const INFER_RULES={
 image:[
  // Retouch, makeup and beautify requests on a photo edit that photo in place (owner, 2026-11-06: influencers' everyday edits).
  ["edit_reference",wordsRe(["ویرایش","ادیت","حذف کن","پاک کن","جایگزین","عوض کن","تغییر بده","رتوش","روتوش","روتوشش","روتوش کن","زیباتر کن","زیباترش کن","خوشگل تر کن","خوشگلترش کن","خوشگلم کن",
   "آرایش کن","آرایشش کن","آرایشم کن","میکاپ کن","میکاپش کن","لاغرتر کن","لاغرترم کن","صاف کن","صافش کن","پولیش کن","edit","remove","replace","retouch","touch up","beautify","polish","slim"])],
  ["end_frame",wordsRe(["فریم آخر","آخر ویدیو","تهش","پایان ویدیو","ختم بشه به","ختم بشه","ختم شود","ختم شه","تموم بشه","برسه","برسد","تمام بشه","end frame","last frame","ending"])],
  ["start_frame",wordsRe(["شروع کن","شروع کن از","شروع از","شروع بشه","start from","starts from","متحرکش کن","زنده‌اش کن","جون بده","انیمیت","متحرک کن","تبدیل به ویدیو","animate","bring to life","make it move"])],
  ["outfit",wordsRe(["لباس","مانتو","کت","شلوار","پیراهن","دامن","کفش","پوشش","ست لباس","استایل لباس","outfit","dress","clothes","wardrobe"])],
  ["hairstyle",wordsRe(["مدل مو","مو","رنگ مو","کوتاهی مو","ریش","سبیل","فرم ریش","پیرایش","اصلاح","hairstyle","haircut","hair","beard","moustache","grooming"])],
  ["makeup",wordsRe(["آرایش","میکاپ","رژ لب","رژ","سایه چشم","خط چشم","ریمل","ابرو","makeup","lipstick","eyebrow"])],
  ["character",wordsRe(["کاراکتر","شخصیت","چهره","صورت","پرتره","این آدم","این فرد","خودم","character","face","portrait","person"])],
  ["graphic",wordsRe(["لوگو","پوستر","گرافیک","تایپوگرافی","فونت","متن روی","بنر","logo","poster","graphic","typography","banner"])],
  ["object",wordsRe(["محصول","شیء","اشیا","کالا","کیف","بطری","product","object","item"])],
  ["environment",wordsRe(["محیط","فضا","مکان","لوکیشن","پس‌زمینه","اتاق","خیابان","منظره","location","background","scene","room"])]
 ],
 video:[
  ["edit_reference",wordsRe(["ویرایش","ادیت","حذف کن","پاک کن","جایگزین","عوض کن","تغییر بده","رتوش","edit","remove","replace","retouch"])],
  ["continue",wordsRe(["امتداد","ادامه بده","ادامه ویدیو","ادامهٔ ویدیو","طولانی‌ترش کن","ادامه‌اش","extend","continue"])],
  ["motion_reference",wordsRe(["حرکت","رقص","الگوی حرکت","کپی حرکت","مثل این حرکت","motion","dance","movement"])]
 ],
 audio:[
  ["lip_sync",wordsRe(["لب","لیپ سینک","لیپ‌سینک","دیالوگ","گفتار","صحبت","حرف بزند","lip sync","lipsync","speech","talk"])],
  ["music",wordsRe(["موسیقی","موزیک","آهنگ","ریتم","بیت","ملودی","music","song","beat"])]
 ]
} as const satisfies Record<"image"|"video"|"audio",readonly (readonly [AttachmentRole,RegExp])[]>;
const withoutMentions=(s:string)=>{let out="",at=0;for(const m of scanMentions(s)){out+=s.slice(at,m.index)+" ";at=m.index+m.raw.length;}return out+s.slice(at);};
/** The words between two mentions are shared: the earlier one keeps the first half (rounded up), the later one the rest. Returns where each share ends and starts. */
function shareGap(text:string,a:number,b:number):{leftEnd:number;rightStart:number}{
 const words=[...text.slice(a,b).matchAll(/\S+/g)],left=Math.ceil(words.length/2);
 return {leftEnd:left===0?a:a+words[left-1].index+words[left-1][0].length,rightStart:left===words.length?b:a+words[left].index};
}
/** The text around every mention of `tag`: its clause (cut at . ، , ؛ ; ? ! and newlines), narrowed to its half of the words it shares with a neighbouring mention. Undefined when the tag is not mentioned. */
function mentionContext(text:string,tag:string):string|undefined{
 const all=scanMentions(text),mine=all.filter(m=>m.tag===tag);
 if(!mine.length)return undefined;
 return mine.map(m=>{
  let cs=m.index,ce=m.index+m.raw.length;
  while(cs>0&&!CLAUSE_END.test(text[cs-1]))cs--;
  while(ce<text.length&&!CLAUSE_END.test(text[ce]))ce++;
  const near=all.filter(o=>o.index>=cs&&o.index+o.raw.length<=ce),i=near.findIndex(o=>o.index===m.index),prev=near[i-1],next=near[i+1];
  const from=prev?shareGap(text,prev.index+prev.raw.length,m.index).rightStart:cs,to=next?shareGap(text,m.index+m.raw.length,next.index).leftEnd:ce;
  return withoutMentions(text.slice(from,to));
 }).join(" ");
}
/**
 * Best-guess role for every image, video and audio attachment, from the words of the brief only (no image or audio analysis).
 * A role the user chose is kept (`roleSource: "user"`). Otherwise the context is the clause around the attachment's mention (any accepted spelling),
 * or the whole text when it is not mentioned, and the first matching keyword group decides; no match is `general`. `voice_clone` is never inferred.
 */
export function inferAttachmentRoles(text:string,attachments:readonly {tag:string;kind:AttachmentKind;role?:AttachmentRole}[]):InferredRole[]{
 const whole=normalizePersian(withoutMentions(text));
 const wordsFor=(tag:string)=>{const ctx=mentionContext(text,tag);return {words:ctx===undefined?whole:normalizePersian(ctx),mentioned:ctx!==undefined};};
 const frames=attachments.filter(a=>a.kind==="image"&&a.role==="frame");
 const framed=resolveFrames(frames.map(f=>({tag:f.tag,...wordsFor(f.tag)})),frames.length);
 return attachments.flatMap((a):InferredRole[]=>{
  if(!isMediaKind(a.kind))return [];
  if(a.role==="frame"&&a.kind==="image")return [{tag:a.tag,role:framed.get(a.tag)??"start_frame",roleSource:"user"}];
  if(a.role==="reference")return [{tag:a.tag,role:resolveReference(a.kind,wordsFor(a.tag).words),roleSource:"user"}];
  if(a.role)return [{tag:a.tag,role:a.role,roleSource:"user"}];
  const {words}=wordsFor(a.tag);
  const hit=INFER_RULES[a.kind as "image"|"video"|"audio"].find(([,re])=>re.test(words));
  return [{tag:a.tag,role:hit?hit[0]:"general",roleSource:"inferred"}];
 });
}
const ruleFor=(kind:"image"|"video",role:AttachmentRole)=>INFER_RULES[kind].find(([r])=>r===role)![1];
/** «عکس رفرنس» / «فیلم رفرنس»: the edit source when the brief asks to change it, a video to continue when it asks to extend it, otherwise a general reference. */
function resolveReference(kind:AttachmentKind,words:string):AttachmentRole{
 if(kind!=="image"&&kind!=="video")return "general";
 if(ruleFor(kind,"edit_reference").test(words))return "edit_reference";
 if(kind==="video"&&ruleFor("video","continue").test(words))return "continue";
 return "general";
}
/**
 * «فریم»: the end frame when the words around its mention say so (فریم آخر، ختم بشه به…), the start frame when they say so; with several frames and no hint,
 * the first is the start frame and the next the end frame. A single unmentioned frame reads the whole brief; otherwise it is the start frame.
 */
function resolveFrames(frames:readonly {tag:string;words:string;mentioned:boolean}[],count:number):Map<string,AttachmentRole>{
 const out=new Map<string,AttachmentRole>(),open:string[]=[];
 for(const f of frames){
  const hinted=f.mentioned||count===1;
  if(hinted&&ruleFor("image","end_frame").test(f.words))out.set(f.tag,"end_frame");
  else if(hinted&&ruleFor("image","start_frame").test(f.words))out.set(f.tag,"start_frame");
  else open.push(f.tag);
 }
 const taken=new Set(out.values());
 for(const tag of open){
  const role:AttachmentRole=!taken.has("start_frame")?"start_frame":!taken.has("end_frame")?"end_frame":"start_frame";
  out.set(tag,role);taken.add(role);
 }
 return out;
}
const EXT_MIMES:Record<string,readonly string[]>={
 jpg:["image/jpeg"],jpeg:["image/jpeg"],png:["image/png"],webp:["image/webp"],
 mp4:["video/mp4","video/quicktime"],m4v:["video/mp4"],mov:["video/quicktime","video/mp4"],webm:["video/webm","audio/webm"],weba:["audio/webm"],
 mp3:["audio/mpeg"],wav:["audio/wav"],m4a:["audio/mp4"],m4b:["audio/mp4"],ogg:["audio/ogg"],oga:["audio/ogg"],
 pdf:["application/pdf"],json:["application/json"],md:["text/markdown"],markdown:["text/markdown"]
};
const KIND_EXTS:Record<AttachmentKind,readonly string[]>={image:["jpg","jpeg","png","webp"],video:["mp4","mov","webm"],audio:["mp3","wav","m4a","ogg"],pdf:["pdf"],json:["json"],md:["md","markdown"]};
/** The `accept` list for a file input restricted to one kind (`file` = PDF, JSON and Markdown): its extensions plus its mime types. */
export function acceptFor(kind:AttachmentKind|"file"):string{
 const kinds:AttachmentKind[]=kind==="file"?["pdf","json","md"]:[kind];
 return [...new Set([...kinds.flatMap(k=>KIND_EXTS[k].map(e=>"."+e)),...kinds.flatMap(k=>ATTACHMENT_KINDS[k].mimes)])].join(",");
}
/** The `accept` list for the file input. */
export const ATTACHMENT_ACCEPT=[...Object.keys(EXT_MIMES).filter(e=>e!=="m4v"&&e!=="weba").map(e=>"."+e),...new Set(Object.values(ATTACHMENT_KINDS).flatMap(k=>k.mimes))].join(",");

export const ATTACHMENT_ERRORS_FA={
 empty:"فایل خالی است.",
 unsupported:"این نوع فایل پشتیبانی نمی‌شود. تصویر، ویدیو، صدا، PDF، JSON و Markdown مجازند.",
 mismatch:"نوع یا پسوند فایل با محتوای واقعی آن نمی‌خواند؛ فایل رد شد.",
 invalidText:"محتوای فایل متنی معتبر (UTF-8) نیست.",
 invalidJson:"فایل JSON معتبر نیست.",
 markup:"فایل‌های HTML و SVG مجاز نیستند.",
 unreadable:"فایل قابل خواندن نیست.",
 metadataTimeout:"خواندن مشخصات فایل بیش از ۵ ثانیه طول کشید.",
 metadataFailed:"مشخصات این فایل قابل خواندن نیست؛ ممکن است خراب باشد.",
 tooLong:"مدت این فایل بیش از یک ساعت است.",
 tagsExhausted:"از این نوع پیوست در این گفت‌وگو به سقف ۹۹ رسیده‌ای؛ گفت‌وگوی جدید شروع کن."
} as const;
const mbFa=(b:number)=>faPlain(Math.round(b/MB));
export const tooLargeFa=(kind:AttachmentKind)=>"حجم فایل "+ATTACHMENT_KINDS[kind].labelFa+" باید حداکثر "+mbFa(ATTACHMENT_KINDS[kind].maxBytes)+" مگابایت باشد.";
export const tooManyFa=()=>"حداکثر "+faPlain(MAX_ATTACHMENTS)+" پیوست در هر پیام مجاز است.";
export const totalTooLargeFa=()=>"مجموع حجم پیوست‌ها باید حداکثر "+mbFa(MAX_TOTAL_ATTACHMENT_BYTES)+" مگابایت باشد.";

export type SniffResult={ok:true;kind:AttachmentKind;mime:string;textExcerpt?:string}|{ok:false;error:string};
const fail=(error:string):SniffResult=>({ok:false,error});
const startsWith=(b:Uint8Array,sig:readonly number[],at=0)=>b.length>=at+sig.length&&sig.every((v,i)=>b[at+i]===v);
const ascii=(b:Uint8Array,at:number,len:number)=>b.length<at+len?"":String.fromCharCode(...b.subarray(at,at+len));
type Detected={kind:AttachmentKind;mime:string;declared:readonly string[]};
const det=(kind:AttachmentKind,mime:string,declared:readonly string[]=[mime]):Detected=>({kind,mime,declared});
const M4A_BRANDS=["M4A ","M4B ","M4P "];
/** Binary signature detection. Undefined when no supported signature matches. */
function detectBinary(b:Uint8Array,declaredMime:string):Detected|undefined{
 if(startsWith(b,[0xff,0xd8,0xff]))return det("image","image/jpeg");
 if(startsWith(b,[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))return det("image","image/png");
 if(ascii(b,0,4)==="RIFF"&&ascii(b,8,4)==="WEBP")return det("image","image/webp");
 if(ascii(b,0,4)==="RIFF"&&ascii(b,8,4)==="WAVE")return det("audio","audio/wav",["audio/wav","audio/x-wav"]);
 if(ascii(b,4,4)==="ftyp"){
  const brand=ascii(b,8,4);
  if(M4A_BRANDS.includes(brand))return det("audio","audio/mp4",["audio/mp4","audio/x-m4a"]);
  return brand==="qt  "?det("video","video/quicktime",["video/quicktime","video/mp4"]):det("video","video/mp4",["video/mp4","video/quicktime"]);
 }
 if(startsWith(b,[0x1a,0x45,0xdf,0xa3]))return declaredMime==="audio/webm"?det("audio","audio/webm"):det("video","video/webm");
 if(ascii(b,0,4)==="OggS")return det("audio","audio/ogg");
 if(ascii(b,0,3)==="ID3"||(b[0]===0xff&&b.length>1&&(b[1]&0xe0)===0xe0))return det("audio","audio/mpeg");
 if(ascii(b,0,5)==="%PDF-")return det("pdf","application/pdf");
 return undefined;
}
const EXECUTABLE=[[0x4d,0x5a],[0x7f,0x45,0x4c,0x46],[0xfe,0xed,0xfa,0xce],[0xfe,0xed,0xfa,0xcf],[0xcf,0xfa,0xed,0xfe],[0xca,0xfe,0xba,0xbe]] as const;
const MARKUP=/^\s*(?:<\?xml|<!doctype|<html|<svg|<script|<head|<body)/i;
const MD_MIMES=["text/markdown","text/x-markdown"];
const BLANK_MIMES=["","application/octet-stream"];
const extOf=(name:string)=>{const m=/\.([a-z0-9]+)$/i.exec(name.trim());return m?m[1].toLowerCase():"";};
/** The first 8000 characters of a text attachment (JSON is re-serialized compactly); never ends on half a surrogate pair. */
export function textExcerpt(kind:"md"|"json",text:string):string{
 const s=kind==="json"?JSON.stringify(JSON.parse(text)):text;
 const cut=s.slice(0,MAX_EXCERPT_CHARS),last=cut.charCodeAt(cut.length-1);
 return cut.length===MAX_EXCERPT_CHARS&&last>=0xd800&&last<=0xdbff?cut.slice(0,-1):cut;
}
/**
 * Decides what a file really is from its bytes. `bytes` may be only a leading slice of the file (pass the real `size`);
 * text kinds need the whole file. A declared mime or extension that disagrees with the bytes rejects the file.
 */
export function sniffKind(bytes:Uint8Array,mime:string,fileName:string,size=bytes.length):SniffResult{
 const m=mime.toLowerCase().split(";")[0].trim(),ext=extOf(fileName);
 if(size<=0||bytes.length===0)return fail(ATTACHMENT_ERRORS_FA.empty);
 const bin=detectBinary(bytes,m);
 let kind:AttachmentKind,canonical:string,declared:readonly string[],text:string|undefined;
 if(bin){
  ({kind,mime:canonical,declared}=bin);
  if(!BLANK_MIMES.includes(m)&&!declared.includes(m))return fail(ATTACHMENT_ERRORS_FA.mismatch);
  if(ext&&EXT_MIMES[ext]&&!EXT_MIMES[ext].includes(canonical))return fail(ATTACHMENT_ERRORS_FA.mismatch);
  if(ext&&!EXT_MIMES[ext]&&["svg","html","htm","exe","js"].includes(ext))return fail(ATTACHMENT_ERRORS_FA.unsupported);
 }else{
  if(EXECUTABLE.some(sig=>startsWith(bytes,sig)))return fail(ATTACHMENT_ERRORS_FA.unsupported);
  const wantsJson=m==="application/json"||ext==="json",wantsMd=MD_MIMES.includes(m)||ext==="md"||ext==="markdown";
  if(wantsJson===wantsMd)return fail(wantsJson?ATTACHMENT_ERRORS_FA.mismatch:ATTACHMENT_ERRORS_FA.unsupported);
  kind=wantsJson?"json":"md";canonical=wantsJson?"application/json":"text/markdown";
  const okMime=wantsJson?BLANK_MIMES.includes(m)||m==="application/json":BLANK_MIMES.includes(m)||MD_MIMES.includes(m)||m==="text/plain";
  const okExt=!ext||!EXT_MIMES[ext]||EXT_MIMES[ext].includes(canonical);
  if(!okMime||!okExt||(m==="text/plain"&&ext!=="md"&&ext!=="markdown"))return fail(ATTACHMENT_ERRORS_FA.mismatch);
  if(size>ATTACHMENT_KINDS[kind].maxBytes)return fail(tooLargeFa(kind));
  if(bytes.length<size)return fail(ATTACHMENT_ERRORS_FA.unreadable);
  try{text=new TextDecoder("utf-8",{fatal:true}).decode(bytes);}catch{return fail(ATTACHMENT_ERRORS_FA.invalidText);}
  if(text.includes("\0"))return fail(ATTACHMENT_ERRORS_FA.invalidText);
  if(MARKUP.test(text))return fail(ATTACHMENT_ERRORS_FA.markup);
  if(kind==="json"){try{JSON.parse(text);}catch{return fail(ATTACHMENT_ERRORS_FA.invalidJson);}}
 }
 if(size>ATTACHMENT_KINDS[kind].maxBytes)return fail(tooLargeFa(kind));
 return text===undefined?{ok:true,kind,mime:canonical}:{ok:true,kind,mime:canonical,textExcerpt:textExcerpt(kind as "md"|"json",text)};
}
/** Count and total-size limits for one message. */
export function validateAttachmentSet(list:readonly {bytes:number}[]):{ok:true}|{ok:false;error:string}{
 if(list.length>MAX_ATTACHMENTS)return {ok:false,error:tooManyFa()};
 if(list.reduce((n,a)=>n+a.bytes,0)>MAX_TOTAL_ATTACHMENT_BYTES)return {ok:false,error:totalTooLargeFa()};
 return {ok:true};
}
/** What the browser knows about one attached file. `name`, `previewUrl` and the File itself never leave the browser. A media `role` is optional: without one the server infers it. */
export type LocalAttachment={
 id:string;tag:string;kind:AttachmentKind;mime:string;bytes:number;sha256:string;name:string;role?:AttachmentRole;
 width?:number;height?:number;durationSeconds?:number;textExcerpt?:string;speech?:AttachmentSpeech;previewUrl?:string;
 /** «ویرایش با قلم» (lib/region-edit.ts): each painted region (number, colour, what to change) and the marked copy (its blob kept by the studio under `guideId`). Memory only. */
 regionEdit?:{regions:{n:number;color:RegionColorName;note:string}[];guideId:string;guideUrl:string;/** The exact selection, a base64 PNG (white = selected). */mask?:string};
 /** The generation this photo is a copy of (opened for «ادیت»): one copy per generation, and the # list shows the generation once. */
 fromGeneration?:string;
};
/** Goes back to "Whoush picks automatically": no role, and no speech details that belonged to one. */
export function withoutRole(a:LocalAttachment):LocalAttachment{
 const next={...a};
 delete next.role;delete next.speech;
 return next;
}
/** Sets the role and drops what belongs to another role: speech details ride only with `lip_sync`. A role the UI does not offer for the kind is ignored. */
export function withRole(a:LocalAttachment,role:AttachmentRole):LocalAttachment{
 // Any role the kind may carry, not only the menu's (owner, 2026-11-08: «ادیت عکس» chosen in the + menu showed «اتوماتیک» once sent, because it is a
 // resolved role outside the role menu's list); the voice clone, which needs consent, never this way.
 if(!roleAllowed(a.kind,role)||role==="voice_clone")return a;
 const next:LocalAttachment={...a,role};
 delete next.speech;
 if(role==="lip_sync")next.speech=a.role==="lip_sync"&&a.speech?a.speech:{hasSpeech:true,language:"unknown",accent:"unspecified"};
 return next;
}
/** The request payload: metadata and text excerpts only. No bytes, no file name, no object URL. Speech details travel only with the `lip_sync` role. */
/** The attachment as the agent receives it (details only, never the bytes); `reviewId`: the server's safety check of a photo, when it was found safe. */
/** The five region colours of «ویرایش با قلم», by the English name the prompt uses (lib/region-edit.ts draws them). */
export const REGION_COLOR_NAMES=["red","blue","green","yellow","magenta"] as const;
export type RegionColorName=(typeof REGION_COLOR_NAMES)[number];
export const REGION_COLOR_FA:Record<RegionColorName,string>={red:"قرمز",blue:"آبی",green:"سبز",yellow:"زرد",magenta:"بنفش"};
export function toWireAttachment(a:LocalAttachment,reviewId?:string,guideReviewId?:string){
 return {...(reviewId&&(a.kind==="image"||a.kind==="video")?{reviewId}:{}),...(a.regionEdit&&guideReviewId&&a.kind==="image"?{regionEdit:{guideReviewId,regions:a.regionEdit.regions.map(r=>({n:r.n,color:r.color,note:r.note})),...(a.regionEdit.mask?{mask:a.regionEdit.mask}:{})}}:{}),id:a.id,tag:a.tag,kind:a.kind,mime:a.mime,bytes:a.bytes,sha256:a.sha256,...(a.role?{role:a.role}:{}),
  ...(a.width!==undefined?{width:a.width}:{}),...(a.height!==undefined?{height:a.height}:{}),
  ...(a.durationSeconds!==undefined?{durationSeconds:a.durationSeconds}:{}),
  ...(a.textExcerpt!==undefined?{textExcerpt:a.textExcerpt}:{}),...(a.speech&&a.role==="lip_sync"?{speech:a.speech}:{})};
}
