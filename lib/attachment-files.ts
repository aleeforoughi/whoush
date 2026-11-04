"use client";
import {ATTACHMENT_ERRORS_FA,ATTACHMENT_KINDS,MAX_DURATION_SECONDS,SNIFF_BYTES,sniffKind,type LocalAttachment} from "./attachments";
import {sha256Hex} from "./characters";
import {readImageSize} from "./character-files";
const METADATA_TIMEOUT_MS=5000;
const MAX_SIDE=20000;
/** Duration and pixel size of a video or audio blob URL from its `loadedmetadata`; rejects with a Persian reason after 5 seconds. */
function readMediaMetadata(url:string,tag:"video"|"audio"):Promise<{durationSeconds?:number;width?:number;height?:number}>{
 return new Promise((resolve,reject)=>{
  const el=document.createElement(tag);
  let timer=0;
  const done=(fn:()=>void)=>{window.clearTimeout(timer);el.onloadedmetadata=null;el.onerror=null;el.removeAttribute("src");el.load();fn();};
  timer=window.setTimeout(()=>done(()=>reject(new Error(ATTACHMENT_ERRORS_FA.metadataTimeout))),METADATA_TIMEOUT_MS);
  el.preload="metadata";el.muted=true;
  el.onerror=()=>done(()=>reject(new Error(ATTACHMENT_ERRORS_FA.metadataFailed)));
  el.onloadedmetadata=()=>{
   const d=el.duration,v=el as HTMLVideoElement,w=tag==="video"?v.videoWidth:0,h=tag==="video"?v.videoHeight:0;
   done(()=>{
    if(Number.isFinite(d)&&d>MAX_DURATION_SECONDS)return reject(new Error(ATTACHMENT_ERRORS_FA.tooLong));
    resolve({durationSeconds:Number.isFinite(d)&&d>=0?Math.round(d*10)/10:undefined,...(w>0&&h>0&&w<=MAX_SIDE&&h<=MAX_SIDE?{width:w,height:h}:{})});
   });
  };
  el.src=url;
 });
}
const TEXTISH=/\.(json|md|markdown)$/i;
/**
 * Verifies a user-chosen file by its bytes, hashes it and reads its metadata. The caller assigns the tag; media has no role until the user picks one. Throws an Error with a Persian message when it
 * must be rejected. Nothing is uploaded or stored: the returned `previewUrl` is an object URL the caller must revoke.
 */
export async function readAttachment(file:File):Promise<Omit<LocalAttachment,"tag">>{
 const small=file.size<=ATTACHMENT_KINDS.json.maxBytes&&(TEXTISH.test(file.name)||/json|markdown|text\/plain/i.test(file.type));
 let head:Uint8Array;
 try{head=new Uint8Array(await file.slice(0,small?file.size:SNIFF_BYTES).arrayBuffer());}catch{throw new Error(ATTACHMENT_ERRORS_FA.unreadable);}
 const sniffed=sniffKind(head,file.type,file.name,file.size);
 if(!sniffed.ok)throw new Error(sniffed.error);
 const {kind,mime,textExcerpt}=sniffed;
 let sha256:string;
 try{sha256=await sha256Hex(file);}catch{throw new Error(ATTACHMENT_ERRORS_FA.unreadable);}
 const a:Omit<LocalAttachment,"tag">={id:crypto.randomUUID(),kind,mime,bytes:file.size,sha256,name:file.name||"فایل",...(textExcerpt!==undefined?{textExcerpt}:{})};
 if(kind==="image"){
  const {width,height}=await readImageSize(file);
  if(width>MAX_SIDE||height>MAX_SIDE)throw new Error("ابعاد تصویر بیش از حد بزرگ است.");
  return {...a,width,height,previewUrl:URL.createObjectURL(file)};
 }
 if(kind==="video"||kind==="audio"){
  const previewUrl=URL.createObjectURL(file);
  try{return {...a,...await readMediaMetadata(previewUrl,kind),previewUrl};}
  catch(e){URL.revokeObjectURL(previewUrl);throw e;}
 }
 return a;
}
