/** Chat attachment contract: kinds, limits, magic-byte sniffing and wire shape. Pure; safe in the browser and on the server. */
import {faPlain} from "./format";
export type AttachmentKind="image"|"video"|"audio"|"pdf"|"json"|"md";
export type AttachmentRole="character"|"environment"|"object"|"graphic"|"edit_reference"|"motion_reference"|"lip_sync"|"music"|"voice_clone";
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
 * Roles per media kind: English ids on the wire, Persian labels in the UI. Files (pdf, json, md) have no role. Media has NO default role:
 * the user must choose one before sending. `en` is the provider-facing phrase used when a mention is rewritten for the media prompt.
 */
export const ATTACHMENT_ROLES={
 image:[{id:"character",labelFa:"کاراکتر",en:"character"},{id:"environment",labelFa:"محیط",en:"environment"},{id:"object",labelFa:"اشیا",en:"object"},{id:"graphic",labelFa:"گرافیک",en:"graphic"},{id:"edit_reference",labelFa:"مرجع ادیت",en:"edit reference"}],
 video:[{id:"motion_reference",labelFa:"الگوی حرکت",en:"motion reference"},{id:"edit_reference",labelFa:"مرجع ادیت",en:"edit reference"}],
 audio:[{id:"lip_sync",labelFa:"الگوی حرکت لب",en:"lip sync"},{id:"music",labelFa:"موسیقی",en:"music reference"},{id:"voice_clone",labelFa:"کلون صدا",en:"voice reference"}]
} as const satisfies Record<"image"|"video"|"audio",readonly {id:AttachmentRole;labelFa:string;en:string}[]>;
export const ATTACHMENT_ROLE_IDS=["character","environment","object","graphic","edit_reference","motion_reference","lip_sync","music","voice_clone"] as const satisfies readonly AttachmentRole[];
/** The roles a kind may carry; empty for files. */
export const rolesFor=(kind:AttachmentKind):readonly {id:AttachmentRole;labelFa:string;en:string}[]=>isMediaKind(kind)?ATTACHMENT_ROLES[kind as "image"|"video"|"audio"]:[];
export const roleLabelFa=(role:AttachmentRole)=>ATTACHMENT_ROLES.image.find(r=>r.id===role)?.labelFa??ATTACHMENT_ROLES.video.find(r=>r.id===role)?.labelFa??ATTACHMENT_ROLES.audio.find(r=>r.id===role)?.labelFa??role;
export const roleAllowed=(kind:AttachmentKind,role:AttachmentRole)=>rolesFor(kind).some(r=>r.id===role);
export const VOICE_CLONE_CONSENT_FA="صاحب این صدا هستم یا اجازهٔ کتبی صاحب صدا را دارم";

// ---- tags: image1, video1, audio1, file1 (pdf, json, md) ----
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
/** Mention syntax: `@image1` at the start or after anything but a letter, digit, underscore or `@` (so `email@image1.com` is not a mention). */
const mentionRe=()=>/(?<![\p{L}\p{N}_@])@((?:image|video|audio|file)[1-9]\d?)(?![A-Za-z0-9_])/giu;
/** Distinct lowercase tags mentioned in the text, in order of first use. */
export function parseMentions(text:string):string[]{
 return [...new Set([...text.matchAll(mentionRe())].map(m=>m[1].toLowerCase()))];
}
/** The text cut into plain runs and mentions (`raw` as typed, `tag` lowercase). */
export function splitMentions(text:string):Array<{text:string}|{tag:string;raw:string}>{
 const out:Array<{text:string}|{tag:string;raw:string}>=[];let at=0;
 for(const m of text.matchAll(mentionRe())){
  if(m.index>at)out.push({text:text.slice(at,m.index)});
  out.push({tag:m[1].toLowerCase(),raw:m[0]});at=m.index+m[0].length;
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
/** Replaces every mention with its English description; a tag with no attachment becomes `[missing attachment]`. */
export function rewriteMentions(text:string,byTag:ReadonlyMap<string,{tag:string;kind:AttachmentKind;role?:AttachmentRole}>):string{
 return text.replace(mentionRe(),(_m,t:string)=>{const a=byTag.get(t.toLowerCase());return a?describeTagEn(a):"[missing attachment]";});
}
/** Inserts `@tag ` over the range [start,end), adding a leading space when the previous character is not whitespace; returns the new text and caret. */
export function insertMention(text:string,start:number,end:number,tag:string):{text:string;caret:number}{
 const before=text.slice(0,start),after=text.slice(end);
 const lead=before===""||/\s$/.test(before)?"":" ",ins=lead+"@"+tag+(/^\s/.test(after)?"":" ");
 return {text:before+ins+after,caret:before.length+lead.length+1+tag.length+1};
}
/** The open `@query` token right before the caret (at the start or after whitespace), if any. */
export function mentionTrigger(text:string,caret:number):{start:number;query:string}|undefined{
 const m=/(^|\s)@([A-Za-z0-9]*)$/.exec(text.slice(0,caret));
 return m?{start:caret-m[2].length-1,query:m[2].toLowerCase()}:undefined;
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
 tooLong:"مدت این فایل بیش از یک ساعت است."
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
/** What the browser knows about one attached file. `name`, `previewUrl` and the File itself never leave the browser. Media has no `role` until the user picks one. */
export type LocalAttachment={
 id:string;tag:string;kind:AttachmentKind;mime:string;bytes:number;sha256:string;name:string;role?:AttachmentRole;consent?:boolean;
 width?:number;height?:number;durationSeconds?:number;textExcerpt?:string;speech?:AttachmentSpeech;previewUrl?:string;
};
/** A media attachment that cannot be sent yet: no role chosen, or `voice_clone` without the consent box. */
export type SendBlocker={id:string;tag:string;reason:"role"|"consent"};
export function sendBlockers(list:readonly Pick<LocalAttachment,"id"|"tag"|"kind"|"role"|"consent">[]):SendBlocker[]{
 const out:SendBlocker[]=[];
 for(const a of list){
  if(!isMediaKind(a.kind))continue;
  if(!a.role)out.push({id:a.id,tag:a.tag,reason:"role"});
  else if(a.role==="voice_clone"&&a.consent!==true)out.push({id:a.id,tag:a.tag,reason:"consent"});
 }
 return out;
}
/** The request payload: metadata and text excerpts only. No bytes, no file name, no object URL. Speech details travel only with the `lip_sync` role. */
export function toWireAttachment(a:LocalAttachment){
 return {id:a.id,tag:a.tag,kind:a.kind,mime:a.mime,bytes:a.bytes,sha256:a.sha256,...(a.role?{role:a.role}:{}),...(a.role==="voice_clone"&&a.consent===true?{consent:true as const}:{}),
  ...(a.width!==undefined?{width:a.width}:{}),...(a.height!==undefined?{height:a.height}:{}),
  ...(a.durationSeconds!==undefined?{durationSeconds:a.durationSeconds}:{}),
  ...(a.textExcerpt!==undefined?{textExcerpt:a.textExcerpt}:{}),...(a.speech&&a.role==="lip_sync"?{speech:a.speech}:{})};
}
