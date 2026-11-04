/** Chat attachment contract: kinds, limits, magic-byte sniffing and wire shape. Pure; safe in the browser and on the server. */
import {faPlain} from "./format";
export type AttachmentKind="image"|"video"|"audio"|"pdf"|"json"|"md";
export type AttachmentRole="reference"|"context";
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
/** What the browser knows about one attached file. `name`, `previewUrl` and the File itself never leave the browser. */
export type LocalAttachment={
 id:string;kind:AttachmentKind;mime:string;bytes:number;sha256:string;name:string;role:AttachmentRole;
 width?:number;height?:number;durationSeconds?:number;textExcerpt?:string;speech?:AttachmentSpeech;previewUrl?:string;
};
/** The request payload: metadata and text excerpts only. No bytes, no file name, no object URL. */
export function toWireAttachment(a:LocalAttachment){
 return {id:a.id,kind:a.kind,mime:a.mime,bytes:a.bytes,sha256:a.sha256,role:a.role,
  ...(a.width!==undefined?{width:a.width}:{}),...(a.height!==undefined?{height:a.height}:{}),
  ...(a.durationSeconds!==undefined?{durationSeconds:a.durationSeconds}:{}),
  ...(a.textExcerpt!==undefined?{textExcerpt:a.textExcerpt}:{}),...(a.speech?{speech:a.speech}:{})};
}
