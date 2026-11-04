/** Chat attachment contract: kinds, limits, magic-byte sniffing and wire shape. Pure; safe in the browser and on the server. */
import {faPlain} from "./format";
import {normalizePersian} from "./safety";
import type {SlotId} from "./reference-slots";
export type AttachmentKind="image"|"video"|"audio"|"pdf"|"json"|"md";
export type AttachmentRole="character"|"environment"|"object"|"graphic"|"edit_reference"|"motion_reference"|"lip_sync"|"music"|"voice_clone"|"general";
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
/**
 * Roles per media kind: English ids on the wire, Persian labels in the UI. Files (pdf, json, md) have no role. Choosing a role is OPTIONAL:
 * without one, Whoush infers it from the brief (`inferAttachmentRoles`). `en` is the provider-facing phrase used when a mention is rewritten for the media prompt.
 * `general` is an internal inferred role only: it is not in these lists, never offered in the UI and rejected on the wire.
 */
export const ATTACHMENT_ROLES={
 image:[{id:"character",labelFa:"کاراکتر",en:"character"},{id:"environment",labelFa:"محیط",en:"environment"},{id:"object",labelFa:"اشیا",en:"object"},{id:"graphic",labelFa:"گرافیک",en:"graphic"},{id:"edit_reference",labelFa:"مرجع ادیت",en:"edit reference"}],
 video:[{id:"motion_reference",labelFa:"الگوی حرکت",en:"motion reference"},{id:"edit_reference",labelFa:"مرجع ادیت",en:"edit reference"}],
 audio:[{id:"lip_sync",labelFa:"الگوی حرکت لب",en:"lip sync"},{id:"music",labelFa:"موسیقی",en:"music reference"},{id:"voice_clone",labelFa:"کلون صدا",en:"voice reference"}]
} as const satisfies Record<"image"|"video"|"audio",readonly {id:AttachmentRole;labelFa:string;en:string}[]>;
export const ATTACHMENT_ROLE_IDS=["character","environment","object","graphic","edit_reference","motion_reference","lip_sync","music","voice_clone"] as const satisfies readonly AttachmentRole[];
/** The roles a kind may carry and the UI offers (never `general`); empty for files. */
export const rolesFor=(kind:AttachmentKind):readonly {id:AttachmentRole;labelFa:string;en:string}[]=>isMediaKind(kind)?ATTACHMENT_ROLES[kind as "image"|"video"|"audio"]:[];
export const GENERAL_ROLE_LABEL_FA="مرجع کلی";
export const roleLabelFa=(role:AttachmentRole)=>role==="general"?GENERAL_ROLE_LABEL_FA:ATTACHMENT_ROLES.image.find(r=>r.id===role)?.labelFa??ATTACHMENT_ROLES.video.find(r=>r.id===role)?.labelFa??ATTACHMENT_ROLES.audio.find(r=>r.id===role)?.labelFa??role;
export const roleAllowed=(kind:AttachmentKind,role:AttachmentRole)=>rolesFor(kind).some(r=>r.id===role);
export const VOICE_CLONE_CONSENT_FA="صاحب این صدا هستم یا اجازهٔ کتبی صاحب صدا را دارم";

// ---- tags: image1, video1, audio1, file1 (pdf, json, md) stay English on the wire; users see #تصویر۱, #ویدیو۱, #صدا۱, #فایل۱ ----
export type TagPrefix="image"|"video"|"audio"|"file";
export const TAG_PATTERN=/^(image|video|audio|file)[1-9]\d?$/;
export const tagPrefix=(kind:AttachmentKind):TagPrefix=>kind==="image"||kind==="video"||kind==="audio"?kind:"file";
export type TagCounters=Record<TagPrefix,number>;
export const newTagCounters=():TagCounters=>({image:0,video:0,audio:0,file:0});
/**
 * Pure allocator for the next tag of a kind. Counters only ever count up, so a removed attachment's number is never reused;
 * "new chat" starts from `newTagCounters()`. Undefined when the conversation has used all 99 numbers of that prefix.
 */
export function allocateTag(counters:TagCounters,kind:AttachmentKind):{tag:string;counters:TagCounters}|undefined{
 const prefix=tagPrefix(kind),n=counters[prefix]+1;
 return n>99?undefined:{tag:prefix+n,counters:{...counters,[prefix]:n}};
}
/** The Persian word shown in a tag: `image1` is `#تصویر-۱`. The internal/wire tag stays English. */
export const TAG_WORD_FA={image:"تصویر",video:"ویدیو",audio:"صدا",file:"فایل"} as const satisfies Record<TagPrefix,string>;
/** Every spelling accepted in a mention, as normalized by `normalizeMention`: Persian words (ویدئو too) and the legacy English prefixes. */
const MENTION_WORDS:Record<string,TagPrefix>={"تصویر":"image","ویدیو":"video","ویدئو":"video","صدا":"audio","فایل":"file",image:"image",video:"video",audio:"audio",file:"file"};
const faNumber=(n:number|string)=>String(n).replace(/\d/g,d=>String.fromCharCode(0x06f0+Number(d)));
/** The user-facing form of an internal tag: the Persian word, an ASCII hyphen and Persian digits. `image1` is `#تصویر-۱`, `file12` is `#فایل-۱۲`. */
export function displayTag(tag:string):string{
 const m=/^(image|video|audio|file)(\d+)$/.exec(tag);
 return m?"#"+TAG_WORD_FA[m[1] as TagPrefix]+"-"+faNumber(m[2]):"#"+tag;
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
/** Every valid mention in the text, in order, with its position and its internal tag. */
function scanMentions(text:string):Array<{index:number;raw:string;tag:string}>{
 const out:Array<{index:number;raw:string;tag:string}>=[];
 for(const m of text.matchAll(mentionRe())){
  const prefix=MENTION_WORDS[normalizeMention(m[1])],n=normalizeMention(m[2]);
  if(prefix&&/^[1-9]\d?$/.test(n))out.push({index:m.index,raw:m[0],tag:prefix+n});
 }
 return out;
}
/** Distinct internal tags mentioned in the text (`#تصویر-۱`, `#تصویر۱` and `@image1` all give `image1`), in order of first use. */
export function parseMentions(text:string):string[]{
 return [...new Set(scanMentions(text).map(m=>m.tag))];
}
/** The text cut into plain runs and mentions (`raw` as typed, `tag` internal). */
export function splitMentions(text:string):Array<{text:string}|{tag:string;raw:string}>{
 const out:Array<{text:string}|{tag:string;raw:string}>=[];let at=0;
 for(const m of scanMentions(text)){
  if(m.index>at)out.push({text:text.slice(at,m.index)});
  out.push({tag:m.tag,raw:m.raw});at=m.index+m.raw.length;
 }
 if(at<text.length)out.push({text:text.slice(at)});
 return out;
}
const tagNumber=(tag:string)=>tag.replace(/\D/g,"");
/** Provider-facing English description of a tagged attachment, e.g. `[reference image 1 · character]` or `[motion reference video 1]`. */
export function describeTagEn(a:{tag:string;kind:AttachmentKind;role?:AttachmentRole}):string{
 const n=tagNumber(a.tag),en=a.role?rolesFor(a.kind).find(r=>r.id===a.role)?.en:undefined;
 if(a.kind==="image")return "[reference image "+n+(en?" · "+en:"")+"]";
 if(a.kind==="video")return "["+(en??"reference")+" video "+n+"]";
 if(a.kind==="audio")return "["+(en??"reference")+" audio "+n+"]";
 return "[attached document "+n+"]";
}
/** Replaces every mention, in any accepted spelling, with its English description; a tag with no attachment becomes `[missing attachment]`. */
export function rewriteMentions(text:string,byTag:ReadonlyMap<string,{tag:string;kind:AttachmentKind;role?:AttachmentRole}>):string{
 let out="",at=0;
 for(const m of scanMentions(text)){
  const a=byTag.get(m.tag);
  out+=text.slice(at,m.index)+(a?describeTagEn(a):"[missing attachment]");at=m.index+m.raw.length;
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
/** Whether an attachment's tag matches a normalized picker query (Persian or English word, either digit set, hyphen or not): `image1` matches `تص`, `im`, `تصویر-`, `تصویر۱` and `image1`, not `صدا`. */
export function tagMatchesQuery(tag:string,query:string):boolean{
 const q=normalizeMention(query),m=/^(image|video|audio|file)(\d+)$/.exec(tag);
 if(!m)return false;
 return Object.entries(MENTION_WORDS).some(([w,p])=>p===m[1]&&((w+m[2]).startsWith(q)||(w+"-"+m[2]).startsWith(q)));
}
/**
 * The open `#query` or `@query` token right before the caret (at the start or after whitespace), if any. The query is normalized (lowercase, ASCII digits,
 * ی/ک unified). An ordinary hashtag such as `#نوروز` is not a trigger, because it is not the start of any tag word.
 */
export function mentionTrigger(text:string,caret:number):{start:number;query:string}|undefined{
 const m=/(^|\s)[#@]([\p{L}\p{N}\u200c\u0640\u2010\u2011\u2013\u2212\-]*)$/u.exec(text.slice(0,caret));
 if(!m)return undefined;
 const query=normalizeMention(m[2]);
 return isTagQuery(query)?{start:caret-m[2].length-1,query}:undefined;
}
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
  ["edit_reference",wordsRe(["ویرایش","ادیت","حذف کن","پاک کن","جایگزین","عوض کن","تغییر بده","رتوش","edit","remove","replace","retouch"])],
  ["character",wordsRe(["کاراکتر","شخصیت","چهره","صورت","پرتره","این آدم","این فرد","خودم","character","face","portrait","person"])],
  ["graphic",wordsRe(["لوگو","پوستر","گرافیک","تایپوگرافی","فونت","متن روی","بنر","logo","poster","graphic","typography","banner"])],
  ["object",wordsRe(["محصول","شیء","اشیا","کالا","لباس","کیف","کفش","بطری","product","object","item"])],
  ["environment",wordsRe(["محیط","فضا","مکان","لوکیشن","پس‌زمینه","اتاق","خیابان","منظره","location","background","scene","room"])]
 ],
 video:[
  ["edit_reference",wordsRe(["ویرایش","ادیت","حذف کن","پاک کن","جایگزین","عوض کن","تغییر بده","رتوش","edit","remove","replace","retouch"])],
  ["motion_reference",wordsRe(["حرکت","رقص","الگوی حرکت","مثل این حرکت","motion","dance","movement"])]
 ],
 audio:[
  ["lip_sync",wordsRe(["لب","لیپ سینک","دیالوگ","گفتار","صحبت","حرف بزند","lip sync","lipsync","speech","talk"])],
  ["music",wordsRe(["موسیقی","آهنگ","ریتم","بیت","ملودی","music","song","beat"])]
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
 return attachments.flatMap((a):InferredRole[]=>{
  if(!isMediaKind(a.kind))return [];
  if(a.role)return [{tag:a.tag,role:a.role,roleSource:"user"}];
  const ctx=mentionContext(text,a.tag),words=ctx===undefined?whole:normalizePersian(ctx);
  const hit=INFER_RULES[a.kind as "image"|"video"|"audio"].find(([,re])=>re.test(words));
  return [{tag:a.tag,role:hit?hit[0]:"general",roleSource:"inferred"}];
 });
}
const EXT_MIMES:Record<string,readonly string[]>={
 jpg:["image/jpeg"],jpeg:["image/jpeg"],png:["image/png"],webp:["image/webp"],
 mp4:["video/mp4","video/quicktime"],m4v:["video/mp4"],mov:["video/quicktime","video/mp4"],webm:["video/webm","audio/webm"],weba:["audio/webm"],
 mp3:["audio/mpeg"],wav:["audio/wav"],m4a:["audio/mp4"],m4b:["audio/mp4"],ogg:["audio/ogg"],oga:["audio/ogg"],
 pdf:["application/pdf"],json:["application/json"],md:["text/markdown"],markdown:["text/markdown"]
};
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
 id:string;tag:string;kind:AttachmentKind;mime:string;bytes:number;sha256:string;name:string;role?:AttachmentRole;consent?:boolean;
 width?:number;height?:number;durationSeconds?:number;textExcerpt?:string;speech?:AttachmentSpeech;previewUrl?:string;
 /** The reference slot card the file was added through (browser only, never sent). */slot?:SlotId;
};
/** Goes back to "Whoush picks automatically": no role, and no speech details or consent that belonged to one. */
export function withoutRole(a:LocalAttachment):LocalAttachment{
 const next={...a};
 delete next.role;delete next.speech;delete next.consent;
 return next;
}
/** Sets the role and drops what belongs to another role: speech details ride only with `lip_sync`, consent only with `voice_clone`. A role the kind cannot have is ignored. */
export function withRole(a:LocalAttachment,role:AttachmentRole):LocalAttachment{
 if(!roleAllowed(a.kind,role))return a;
 const next:LocalAttachment={...a,role};
 delete next.speech;delete next.consent;
 if(role==="lip_sync")next.speech=a.role==="lip_sync"&&a.speech?a.speech:{hasSpeech:true,language:"unknown",accent:"unspecified"};
 if(role==="voice_clone"&&a.role==="voice_clone"&&a.consent!==undefined)next.consent=a.consent;
 return next;
}
/** A media attachment that cannot be sent yet. A role is optional, so the only blocker is `voice_clone` without the consent box. */
export type SendBlocker={id:string;tag:string;reason:"consent"};
export function sendBlockers(list:readonly Pick<LocalAttachment,"id"|"tag"|"kind"|"role"|"consent">[]):SendBlocker[]{
 return list.filter(a=>isMediaKind(a.kind)&&a.role==="voice_clone"&&a.consent!==true).map(a=>({id:a.id,tag:a.tag,reason:"consent" as const}));
}
/** The request payload: metadata and text excerpts only. No bytes, no file name, no object URL. Speech details travel only with the `lip_sync` role. */
export function toWireAttachment(a:LocalAttachment){
 return {id:a.id,tag:a.tag,kind:a.kind,mime:a.mime,bytes:a.bytes,sha256:a.sha256,...(a.role?{role:a.role}:{}),...(a.role==="voice_clone"&&a.consent===true?{consent:true as const}:{}),
  ...(a.width!==undefined?{width:a.width}:{}),...(a.height!==undefined?{height:a.height}:{}),
  ...(a.durationSeconds!==undefined?{durationSeconds:a.durationSeconds}:{}),
  ...(a.textExcerpt!==undefined?{textExcerpt:a.textExcerpt}:{}),...(a.speech&&a.role==="lip_sync"?{speech:a.speech}:{})};
}
