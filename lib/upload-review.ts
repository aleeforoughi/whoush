import "server-only";
import {createHash,randomUUID} from "node:crypto";
import {storeMedia,type StoredMime} from "./media-store";
import {evaluatePlanTextSafety} from "./safety";
import {inspectUpload,inspectionAvailable,type BeautifyAssessment,type UploadCategory,type UploadInspector} from "./reference-inspect";
import {BEAUTIFY_PARTS_MINOR,type BeautifyIssue} from "./beautify";
import type {PhotoCoverage} from "./drift";
/** The Beautify findings kept for a safe photo: only when needed, with notes that pass the text checks, and for a minor only the photo-craft parts. */
function beautifyFindings(b:BeautifyAssessment|undefined,person:boolean):{minor:boolean;issues:BeautifyIssue[]}|undefined{
 if(!b?.needed||!person)return undefined;
 const issues=b.issues.filter(i=>(!b.minor||BEAUTIFY_PARTS_MINOR.includes(i.part))&&i.noteFa.trim()&&i.noteEn.trim()
  &&evaluatePlanTextSafety(i.noteFa).decision==="allow"&&evaluatePlanTextSafety(i.noteEn).decision==="allow"&&!/https?:|[<>{}]/.test(i.noteFa+i.noteEn)
  // The Persian note is shown as written: one with Latin letters mixed in (a model slip, «برق می‌zane») is dropped; the part keeps its English note.
  &&!/[A-Za-z]/.test(i.noteFa))
  .map(i=>({part:i.part,noteFa:i.noteFa.trim().slice(0,120),noteEn:i.noteEn.trim().slice(0,160)}));
 return {minor:b.minor,issues:issues.filter((i,k)=>issues.findIndex(j=>j.part===i.part)===k)};
}
/**
 * The safety check of an uploaded photo (owner, 2026-11-06: review right after upload, never a blocker). The studio sends each photo as soon as it is added;
 * a private vision check (lib/reference-inspect.ts) decides, and only a photo found safe is stored in Whoush's media store. The verdict is kept server-side
 * under an unguessable review id, the only thing the client sends back with the turn: a client cannot claim a photo is checked, and the bytes a provider
 * receives are exactly the bytes that were checked. Development memory: a restart forgets reviews, and the studio simply checks the photo again.
 */
export const REVIEW_IMAGE_MIMES=["image/jpeg","image/png","image/webp"] as const satisfies readonly StoredMime[];
export type ReviewImageMime=(typeof REVIEW_IMAGE_MIMES)[number];
/** The studio shrinks a photo to 2048 px before sending; this leaves room for an original that is already small. */
export const MAX_REVIEW_BYTES=12*1024*1024;
export const REVIEW_VIDEO_MIMES=["video/mp4","video/quicktime","video/webm"] as const satisfies readonly StoredMime[];
export type ReviewVideoMime=(typeof REVIEW_VIDEO_MIMES)[number];
/** A video's review (lib/video-review.ts) is kept here too, under the same kind of id: `kind` says which; `messageFa`/`labelFa` override the photo wording. */
export type UploadReview={reviewId:string;sha256:string;at:string;kind?:"video"}&({state:"safe";mediaId:string;mime:ReviewImageMime|ReviewVideoMime;person:boolean;
  /** «Beautify it» (lib/beautify.ts): this everyday photo of a person would clearly improve; what it needs, and whether the person looks under 18. */beautify?:{minor:boolean;issues:BeautifyIssue[]};
  /** What the photo shows of its person (lib/drift.ts): the framing, the head's angle, teeth, open eyes. */coverage?:PhotoCoverage}
 |{state:"blocked";category:Exclude<UploadCategory,"none">;fixFa:string;messageFa?:string;labelFa?:string});
/** One short line per blocked category with its general reason (owner, 2026-11-07: say why in a word, never like an error; no details, no lecture), never naming a provider or model; the fix says what to do. */
export const BLOCKED_FA:Record<Exclude<UploadCategory,"none">,string>={
 iran_political:"این عکس سیاسیه؛ اینجا سراغ سیاست نمی‌ریم.",
 iran_royal:"این عکس نماد سیاسی داره؛ سراغ سیاست نمی‌ریم.",
 sexual:"این عکس برهنگی داره و ازش استفاده نمی‌کنیم.",
 minor:"برای امنیت بچه‌ها از این عکس استفاده نمی‌کنیم.",
 alcohol:"این عکس الکل داره و ازش استفاده نمی‌کنیم.",
 drugs:"این عکس مواد مخدر داره و ازش استفاده نمی‌کنیم.",
 violence:"این عکس خشونت یا خون داره؛ ازش استفاده نمی‌کنیم.",
 public_figure:"از عکس آدم مشهور بدون اجازه‌ش استفاده نمی‌کنیم."
};
/** The reason in a word or two, on the photo itself (calm, not an error look). */
export const BLOCKED_LABEL_FA:Record<Exclude<UploadCategory,"none">,string>={
 iran_political:"سیاسی",iran_royal:"سیاسی",sexual:"برهنگی",minor:"امنیت کودک",alcohol:"الکل",drugs:"مواد مخدر",violence:"خشونت",public_figure:"فرد مشهور"
};
/**
 * The safe way forward when the check has none to offer (owner, 2026-11-06: Whoush is the user's advocate and always offers a safe change). A suggestion
 * always takes the restricted thing out and points somewhere safe; it never says how to keep it and get past the check.
 */
export const FIX_FA:Record<Exclude<UploadCategory,"none">,string>={
 iran_political:"یه عکس دیگه بفرست؛ مثلاً از خودت، یه دوست یا یه جای قشنگ.",
 iran_royal:"یه عکس بدون این نماد بفرست؛ برای حال‌وهوای ایرانی، معماری، کاشی‌کاری و طبیعت ایران عالیه.",
 sexual:"یه عکس از همون شخص با لباس روزمره بفرست، یا فقط از چهره‌ش.",
 minor:"یه عکس دیگه بفرست که موقعیتش معمولی و روزمره‌ست.",
 alcohol:"یه عکس بدون نوشیدنی الکلی بفرست؛ صحنه رو با چای، قهوه یا آبمیوه می‌سازم.",
 drugs:"یه عکس دیگه بفرست؛ مثلاً یه صحنهٔ دورهمی با چای و میوه.",
 violence:"یه عکس آروم‌تر بفرست؛ هیجان صحنه رو می‌شه با نور، حرکت و حالت چهره نشون داد.",
 public_figure:"یه عکس از خودت یا کسی که اجازه‌شو داری بفرست."
};
/** The check's own suggestion when it is plain Persian text that passes the same text safety check; otherwise the standard one. */
function safeFix(fix:string|undefined,category:Exclude<UploadCategory,"none">):string{
 const f=(fix??"").trim();
 return f.length>=8&&f.length<=240&&/[\u0600-\u06FF]/.test(f)&&!/https?:|[<>{}]/.test(f)&&evaluatePlanTextSafety(f).decision==="allow"?f:FIX_FA[category];
}
export const REVIEW_UNAVAILABLE_FA="بررسی ایمنی عکس الان در دسترس نیست. چند لحظه بعد دوباره امتحان کن.";
const MAX_KEPT=500;
const registry=()=>((globalThis as {__whoushUploadReviews?:Map<string,UploadReview>}).__whoushUploadReviews??=new Map());
export function keep(r:UploadReview){const m=registry();m.set(r.reviewId,r);if(m.size>MAX_KEPT)m.delete(m.keys().next().value!);}
export const reviewAvailable=()=>inspectionAvailable();
/** Checks and (when safe) stores one photo. Throws when the check cannot run: the photo stays unchecked, and is never used. */
export async function reviewUpload(bytes:Uint8Array,mime:ReviewImageMime,deps:{inspect?:UploadInspector;store?:typeof storeMedia;now?:()=>Date}={}):Promise<UploadReview>{
 if(!bytes.byteLength||bytes.byteLength>MAX_REVIEW_BYTES)throw new Error("Photo size out of range");
 const v=await (deps.inspect??inspectUpload)({bytes,mime});
 const base={reviewId:randomUUID(),sha256:createHash("sha256").update(bytes).digest("hex"),at:(deps.now?.()??new Date()).toISOString()};
 const r:UploadReview=v.category==="none"
  ?{...base,state:"safe",mediaId:(await (deps.store??storeMedia)(bytes,mime)).id,mime,person:v.person,...(beautifyFindings(v.beautify,v.person)?{beautify:beautifyFindings(v.beautify,v.person)!}:{}),...(v.person&&v.coverage?{coverage:v.coverage}:{})}
  :{...base,state:"blocked",category:v.category,fixFa:safeFix(v.fixFa,v.category)};
 keep(r);return r;
}
/** The checked-safe review behind an id, or undefined (unknown, forgotten after a restart, or blocked). */
export function safeReview(reviewId:string|undefined):Extract<UploadReview,{state:"safe"}>|undefined{
 const r=reviewId?registry().get(reviewId):undefined;return r?.state==="safe"?r:undefined;
}
export function forgetReviewsForTests(){registry().clear();}
