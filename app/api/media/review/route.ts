import {NextResponse} from "next/server";
import {BLOCKED_FA,BLOCKED_LABEL_FA,MAX_REVIEW_BYTES,REVIEW_UNAVAILABLE_FA,reviewAvailable,reviewUpload,type ReviewImageMime,type UploadReview} from "@/lib/upload-review";
import {beautifyOffer} from "@/lib/beautify";
import {MAX_VIDEO_REVIEW_BYTES,VIDEO_TOO_LONG_FA,VideoTooLongError,reviewVideoUpload,sniffVideo,videoReviewAvailable} from "@/lib/video-review";
const VIDEO_UNAVAILABLE_FA="بررسی ایمنی ویدیو الان در دسترس نیست. چند لحظه بعد دوباره امتحان کن.";
const headers={"Cache-Control":"no-store"};
/** At most this many photos are checked at once per server process; the rest are told to try again (the studio retries). */
const MAX_IN_FLIGHT=6;
const inFlight=()=>((globalThis as {__whoushReviewSlots?:{n:number}}).__whoushReviewSlots??={n:0});
/** The photo's type from its bytes, never from the header alone: JPEG, PNG or WebP. */
function sniff(b:Uint8Array):ReviewImageMime|undefined{
 if(b.length>3&&b[0]===0xff&&b[1]===0xd8&&b[2]===0xff)return "image/jpeg";
 if(b.length>8&&b[0]===0x89&&b[1]===0x50&&b[2]===0x4e&&b[3]===0x47)return "image/png";
 if(b.length>12&&String.fromCharCode(...b.slice(0,4))==="RIFF"&&String.fromCharCode(...b.slice(8,12))==="WEBP")return "image/webp";
 return undefined;
}
/** Whether photos can be checked now (the studio shows uploads as unchecked otherwise). Never says why. */
/** `video`: uploaded videos are checked too (frames and soundtrack, lib/video-review.ts). */
export async function GET(){return NextResponse.json({enabled:reviewAvailable(),video:await videoReviewAvailable()},{headers});}
/**
 * One uploaded photo (the raw bytes, JPEG, PNG or WebP) to its safety verdict: `{reviewId,state:"safe"}` or `{reviewId,state:"blocked",message}`. Only a safe
 * photo is kept (in Whoush's media store, for the provider); the turn later names it by `reviewId`. Errors are `{error,message}` in Persian, with no internals.
 */
export async function POST(request:Request){
 const fail=(error:string,message:string,status:number)=>NextResponse.json({error,message},{status,headers});
 if(!reviewAvailable())return fail("review_unavailable",REVIEW_UNAVAILABLE_FA,503);
 if(Number(request.headers.get("content-length")??"0")>MAX_VIDEO_REVIEW_BYTES)return fail("too_large","حجم فایل برای بررسی زیاده.",413);
 let bytes:Uint8Array;
 try{bytes=new Uint8Array(await request.arrayBuffer());}catch{return fail("bad_photo","عکس خونده نشد.",400);}
 // A video (owner, 2026-11-08): checked like a photo, right after upload (frames and soundtrack).
 const video=sniffVideo(bytes);
 if(video){
  if(!(await videoReviewAvailable()))return fail("review_unavailable",VIDEO_UNAVAILABLE_FA,503);
  if(bytes.byteLength>MAX_VIDEO_REVIEW_BYTES)return fail("too_large","حجم ویدیو برای بررسی زیاده.",413);
 }else if(!bytes.byteLength||bytes.byteLength>MAX_REVIEW_BYTES)return fail("too_large","حجم عکس برای بررسی زیاده.",413);
 const mime=video?undefined:sniff(bytes);if(!video&&!mime)return fail("bad_photo","فقط عکس JPEG، PNG یا WebP، یا ویدیوی MP4، MOV یا WebM بررسی می‌شه.",415);
 const slots=inFlight();if(slots.n>=MAX_IN_FLIGHT)return fail("busy",REVIEW_UNAVAILABLE_FA,429);
 slots.n++;
 try{
  const r:UploadReview=video?await reviewVideoUpload(bytes,video):await reviewUpload(bytes,mime!);
  // «Beautify it» (owner, 2026-11-08): an everyday photo of a person that would clearly improve comes back with the offer (parts and Persian notes only).
  return NextResponse.json(r.state==="safe"?{reviewId:r.reviewId,state:"safe",...(r.beautify?{beautify:beautifyOffer("",r.beautify.issues,r.beautify.minor)}:{})}:{reviewId:r.reviewId,state:"blocked",message:r.messageFa??BLOCKED_FA[r.category],label:r.labelFa??BLOCKED_LABEL_FA[r.category],fix:r.fixFa},{headers});
 }catch(e){
  if(e instanceof VideoTooLongError)return fail("too_long",VIDEO_TOO_LONG_FA,422);
  return fail("review_failed",video?VIDEO_UNAVAILABLE_FA:REVIEW_UNAVAILABLE_FA,502);
 }
 finally{slots.n--;}
}
