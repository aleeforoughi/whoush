"use client";
/**
 * The studio side of the photo safety check (owner, 2026-11-06: checked right after upload, like a progress bar on the photo, never a blocker). A photo is
 * shrunk to 2048 px (JPEG) and sent to POST /api/media/review as soon as it is added; the card shows the progress, then a small verified badge, or why it
 * cannot be used. A message sent while a photo is still being checked waits for it in the chat and then goes on by itself.
 */
export type PhotoReview=
 |{state:"checking";progress:number}
 |{state:"safe";reviewId:string;/** «Beautify it» offered for this photo (lib/beautify.ts): the parts to start with and what was seen. */beautify?:Omit<BeautifyOffer,"tag">}
 |{state:"blocked";reviewId:string;reasonFa:string;fixFa?:string;/** The reason in a word or two, shown on the photo. */labelFa?:string}
 |{state:"failed";reasonFa:string};
import {parseBeautifyOffer,type BeautifyOffer} from "./beautify";
export const REVIEW_ROUTE="/api/media/review";
export const REVIEWING_FA="بررسی ایمنی…";
export const REVIEWED_FA="بررسی شد؛ آمادهٔ استفاده";
/** Shown on a blocked photo when the reason has no short label: calm, not an error. */
export const BLOCKED_SHORT_FA="استفاده نمی‌شه";
export const REVIEW_FAILED_FA="بررسی ایمنی انجام نشد. دوباره امتحان کن.";
export const RETRY_REVIEW_FA="دوباره بررسی کن";
/** The chat's waiting line while photos of the message are still being checked. */
export const WAITING_FA="یه لحظه، فایل‌هات در حال بررسی ایمنی‌ان. تموم شد، خودم ادامه می‌دم.";
const MAX_SIDE=2048;

/**
 * The photo as Whoush checks and uses it. Quality first (owner, 2026-11-06: edits must not get pixelated; measured live, a needless JPEG re-encode here cut
 * sharpness by a third before the model ever saw the photo): a JPEG, PNG or WebP of at most 2048 px on its longer side is sent byte for byte as it is. Only a
 * larger photo (or another type) is redrawn, at 2048 px with high-quality smoothing, as a high-quality JPEG.
 */
export async function shrinkForReview(blob:Blob):Promise<Blob>{
 const accepted=/^image\/(jpeg|png|webp)$/.test(blob.type);
 try{
  const bmp=await createImageBitmap(blob,{imageOrientation:"from-image"});
  const long=Math.max(bmp.width,bmp.height);
  if(accepted&&long<=MAX_SIDE&&blob.size<=11*1024*1024){bmp.close();return blob;}
  const k=Math.min(1,MAX_SIDE/long),w=Math.max(1,Math.round(bmp.width*k)),h=Math.max(1,Math.round(bmp.height*k));
  const canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext("2d");if(!ctx){bmp.close();throw new Error("no canvas");}
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";
  ctx.fillStyle="#fff";ctx.fillRect(0,0,w,h);ctx.drawImage(bmp,0,0,w,h);bmp.close();
  const out=await new Promise<Blob|null>(res=>canvas.toBlob(res,"image/jpeg",0.95));
  if(out)return out;
 }catch{/* fall through: send the original if its type is accepted */}
 if(accepted)return blob;
 throw new Error("unreadable");
}

/**
 * Sends one photo for checking. `onProgress` gets 0..1: the upload is the first half, the check itself creeps on until the answer. A network or server error
 * is `failed` (the photo stays unused, and can be checked again).
 */
export function sendForReview(blob:Blob,onProgress:(p:number)=>void,timeoutMs=60_000):Promise<PhotoReview>{
 return new Promise(resolve=>{
  const xhr=new XMLHttpRequest();let creep=0,shown=0;
  const show=(p:number)=>{shown=Math.max(shown,Math.min(p,.97));onProgress(shown);};
  const stop=()=>window.clearInterval(creep);
  xhr.open("POST",REVIEW_ROUTE);xhr.setRequestHeader("Content-Type",blob.type||"application/octet-stream");xhr.responseType="json";xhr.timeout=timeoutMs;
  xhr.upload.onprogress=e=>{if(e.lengthComputable)show(.5*e.loaded/e.total);};
  // After the upload, the check: about 5 seconds, so the bar moves on towards the end and waits there for the answer.
  xhr.upload.onload=()=>{show(.5);creep=window.setInterval(()=>show(shown+(.97-shown)*.12),400);};
  xhr.onload=()=>{
   stop();
   const b=(xhr.response??{}) as {reviewId?:string;state?:string;message?:string;label?:string;fix?:string;beautify?:unknown};
   if(xhr.status===200&&b.state==="safe"&&b.reviewId){onProgress(1);const offer=parseBeautifyOffer(b.beautify);resolve({state:"safe",reviewId:b.reviewId,...(offer?{beautify:offer}:{})});}
   else if(xhr.status===200&&b.state==="blocked"&&b.reviewId)resolve({state:"blocked",reviewId:b.reviewId,reasonFa:typeof b.message==="string"?b.message:BLOCKED_SHORT_FA,...(typeof b.label==="string"&&b.label?{labelFa:b.label}:{}),...(typeof b.fix==="string"&&b.fix?{fixFa:b.fix}:{})});
   else resolve({state:"failed",reasonFa:typeof b.message==="string"?b.message:REVIEW_FAILED_FA});
  };
  xhr.onerror=xhr.ontimeout=()=>{stop();resolve({state:"failed",reasonFa:REVIEW_FAILED_FA});};
  show(.02);xhr.send(blob);
 });
}

/** Shrinks and checks a photo; a failure is tried once more after a short pause (a busy server, a dropped connection) before it is reported. */
export async function reviewPhoto(blob:Blob,onProgress:(p:number)=>void):Promise<PhotoReview>{
 let small:Blob;
 try{small=await shrinkForReview(blob);}catch{return {state:"failed",reasonFa:"این عکس خونده نشد؛ یه عکس JPEG یا PNG امتحان کن."};}
 const first=await sendForReview(small,onProgress);
 if(first.state!=="failed")return first;
 await new Promise(r=>setTimeout(r,1500));
 return sendForReview(small,onProgress);
}

/**
 * A video's check (owner, 2026-11-08: like a photo, right after upload): the file is sent as it is (MP4, MOV or WebM, up to 100 MB); the server samples its
 * frames and checks its soundtrack. A long upload and check get a longer limit, and one retry like a photo.
 */
export async function reviewVideo(blob:Blob,onProgress:(p:number)=>void):Promise<PhotoReview>{
 const first=await sendForReview(blob,onProgress,240_000);
 if(first.state!=="failed")return first;
 await new Promise(r=>setTimeout(r,1500));
 return sendForReview(blob,onProgress,240_000);
}

/** Whether the server checks photos (and videos) now (otherwise uploads stay as before: unchecked, and a turn with them stops before a price). */
export async function photoReviewEnabled():Promise<{photos:boolean;videos:boolean}>{
 try{const r=await fetch(REVIEW_ROUTE,{cache:"no-store"});if(!r.ok)return {photos:false,videos:false};const b=(await r.json()) as {enabled?:boolean;video?:boolean};return {photos:Boolean(b.enabled),videos:Boolean(b.video)};}
 catch{return {photos:false,videos:false};}
}

/**
 * Whoush's reply when photos of a message cannot be used: each one with why and a safe way forward (owner, 2026-11-06: Whoush is the user's advocate and
 * always offers a safe change, never a workaround). A check that failed is retried by «اجرای دوباره».
 */
export function reviewStopFa(items:readonly {tagFa:string;review?:PhotoReview}[]):string{
 const lines=items.map(({tagFa,review:r})=>"• "+tagFa+": "+(r?.state==="blocked"?r.reasonFa+(r.fixFa?" "+r.fixFa:""):REVIEW_FAILED_FA+" «اجرای دوباره» رو بزن تا دوباره بررسی کنم."));
 const blocked=items.some(x=>x.review?.state==="blocked");
 return (blocked?"از این عکس‌ها استفاده نمی‌کنیم، ولی با یه تغییر کوچیک ادامه می‌دیم:":"بررسی ایمنی این عکس‌ها تموم نشد:")+"\n"+lines.join("\n")+
  (blocked?"\nعکس رو حذف یا عوض کن و دوباره بفرست؛ بقیه‌ش با من.":"");
}
