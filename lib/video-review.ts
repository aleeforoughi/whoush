import "server-only";
/**
 * The safety check of an uploaded video (owner, 2026-11-08: like photos, right after upload, before anything is planned or generated). The studio sends the
 * video as soon as it is added. Its picture is sampled (frames spread over its length) and every frame goes through the same private vision check as an
 * uploaded photo (lib/reference-inspect.ts); its soundtrack goes through the generated-audio check (lib/audio-check.ts: extracted, transcribed verbatim,
 * lexical then semantic review). Only a video whose frames and words all pass is stored, under a review id like a photo's (lib/upload-review.ts).
 * Fail closed: a frame or soundtrack that cannot be checked, a video ffmpeg cannot read, or one too long, throws, and the video stays unchecked (never
 * used). Frames, audio and transcript are never stored or logged.
 */
import {execFile} from "node:child_process";
import {createHash,randomUUID} from "node:crypto";
import {mkdtemp,readdir,readFile,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {hasFfmpeg,soundtrackVerdict,type AudioCategory,type AudioCheckDeps} from "./audio-check";
import {storeMedia} from "./media-store";
import {inspectUpload,inspectionAvailable,type UploadCategory,type UploadInspector} from "./reference-inspect";
import {BLOCKED_LABEL_FA,FIX_FA,keep,type ReviewVideoMime,type UploadReview} from "./upload-review";
import {voiceGate} from "./voice";

export const MAX_VIDEO_REVIEW_BYTES=100*1024*1024;
/** The longest video checked: past this, more frames would be needed than a quick check allows. */
export const MAX_VIDEO_REVIEW_SECONDS=120;
/** Frames sampled from a video: spread evenly over its length (a 10 s clip: one a little more than every second). */
export const VIDEO_REVIEW_FRAMES=8;
const FRAME_CONCURRENCY=4;

/** The video's own reasons, in the photo wording's tone (lib/upload-review.ts BLOCKED_FA). */
export const VIDEO_BLOCKED_FA:Record<Exclude<UploadCategory,"none">,string>={
 iran_political:"این ویدیو سیاسیه؛ اینجا سراغ سیاست نمی‌ریم.",
 iran_royal:"این ویدیو نماد سیاسی داره؛ سراغ سیاست نمی‌ریم.",
 sexual:"این ویدیو برهنگی داره و ازش استفاده نمی‌کنیم.",
 minor:"برای امنیت بچه‌ها از این ویدیو استفاده نمی‌کنیم.",
 alcohol:"این ویدیو الکل داره و ازش استفاده نمی‌کنیم.",
 drugs:"این ویدیو مواد مخدر داره و ازش استفاده نمی‌کنیم.",
 violence:"این ویدیو خشونت یا خون داره؛ ازش استفاده نمی‌کنیم.",
 public_figure:"از ویدیوی آدم مشهور بدون اجازه‌ش استفاده نمی‌کنیم."
};
/** A soundtrack that fails, said as what it is: the words, not the picture. */
const SPEECH_FA:Record<Exclude<AudioCategory,"none">,{fa:string;label:string;as:Exclude<UploadCategory,"none">}>={
 politics:{fa:"صدای این ویدیو حرف سیاسی داره؛ اینجا سراغ سیاست نمی‌ریم.",label:"سیاسی",as:"iran_political"},
 sexual:{fa:"صدای این ویدیو حرف نامناسب داره و ازش استفاده نمی‌کنیم.",label:"نامناسب",as:"sexual"},
 minors:{fa:"صدای این ویدیو با قانون امنیت بچه‌ها جور نیست.",label:"امنیت کودک",as:"minor"},
 violence:{fa:"صدای این ویدیو حرف خشن داره و ازش استفاده نمی‌کنیم.",label:"خشونت",as:"violence"},
 religion:{fa:"صدای این ویدیو به باورها بی‌احترامی می‌کنه؛ ازش استفاده نمی‌کنیم.",label:"بی‌احترامی",as:"violence"},
 alcohol:{fa:"صدای این ویدیو درباره‌ی الکله و ازش استفاده نمی‌کنیم.",label:"الکل",as:"alcohol"},
 drugs:{fa:"صدای این ویدیو درباره‌ی مواد مخدره و ازش استفاده نمی‌کنیم.",label:"مواد مخدر",as:"drugs"},
 hate:{fa:"صدای این ویدیو حرف توهین‌آمیز داره و ازش استفاده نمی‌کنیم.",label:"توهین‌آمیز",as:"violence"}
};
const SPEECH_FIX_FA="همین ویدیو رو بدون صدا بفرست، یا یه ویدیوی دیگه.";

/** Whether uploaded videos can be checked here: the photo inspector, ffmpeg, and the soundtrack check's transcriber and review. */
export async function videoReviewAvailable():Promise<boolean>{
 return inspectionAvailable()&&voiceGate().live&&Boolean(process.env.ANTHROPIC_API_KEY)&&await hasFfmpeg();
}

/** The container from its first bytes, never from the header alone: MP4 or QuickTime (an `ftyp` box), or WebM (EBML). */
export function sniffVideo(b:Uint8Array):ReviewVideoMime|undefined{
 if(b.length>12&&String.fromCharCode(...b.slice(4,8))==="ftyp")return String.fromCharCode(...b.slice(8,10))==="qt"?"video/quicktime":"video/mp4";
 if(b.length>4&&b[0]===0x1a&&b[1]===0x45&&b[2]===0xdf&&b[3]===0xa3)return "video/webm";
 return undefined;
}

const FFMPEG=process.env.WHOUSH_FFMPEG_PATH||"ffmpeg";
const ff=(args:string[],timeoutMs=60_000)=>new Promise<{code:number;stderr:string}>(resolve=>{
 execFile(FFMPEG,args,{timeout:timeoutMs,maxBuffer:4_000_000},(err,_o,stderr)=>resolve({code:err?1:0,stderr:String(stderr)}));
});
/** The video's length in seconds, from ffmpeg's own reading of the file; undefined when it cannot read it. */
export function parseDuration(stderr:string):number|undefined{
 const m=/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(stderr);
 return m?Number(m[1])*3600+Number(m[2])*60+Number(m[3]):undefined;
}
/** Frames spread evenly over the video, as small JPEGs (768 px on the long side). */
async function sampleFrames(dir:string,video:string):Promise<{seconds:number;frames:Uint8Array[]}>{
 const probe=await ff(["-hide_banner","-nostdin","-i",video],20_000);
 const seconds=parseDuration(probe.stderr);
 if(!seconds||!Number.isFinite(seconds)||seconds<=0)throw new Error("unreadable_video");
 if(seconds>MAX_VIDEO_REVIEW_SECONDS)throw new VideoTooLongError();
 const fps=Math.max(VIDEO_REVIEW_FRAMES/seconds,0.05);
 const r=await ff(["-hide_banner","-nostdin","-y","-i",video,"-vf","fps="+fps.toFixed(4)+",scale='if(gt(iw,ih),768,-2)':'if(gt(iw,ih),-2,768)'","-frames:v",String(VIDEO_REVIEW_FRAMES),"-q:v","4",join(dir,"f_%02d.jpg")],90_000);
 if(r.code!==0)throw new Error("frames_failed");
 const names=(await readdir(dir)).filter(n=>/^f_\d+\.jpg$/.test(n)).sort();
 if(!names.length)throw new Error("no_frames");
 return {seconds,frames:await Promise.all(names.map(async n=>new Uint8Array(await readFile(join(dir,n)))))};
}
export class VideoTooLongError extends Error{constructor(){super("video_too_long");this.name="VideoTooLongError";}}
export const VIDEO_TOO_LONG_FA="ویدیو برای بررسی حداکثر دو دقیقه می‌تونه باشه؛ یه تکهٔ کوتاه‌ترش رو بفرست.";

/** Runs `fn` over the items, at most `n` at a time; the first rejection rejects the whole. */
async function pool<T,R>(items:readonly T[],n:number,fn:(x:T)=>Promise<R>):Promise<R[]>{
 const out:R[]=new Array(items.length);let next=0;
 await Promise.all(Array.from({length:Math.min(n,items.length)},async()=>{while(next<items.length){const i=next++;out[i]=await fn(items[i]);}}));
 return out;
}

export type VideoReviewDeps={inspect?:UploadInspector;sample?:(videoBytes:Uint8Array)=>Promise<Uint8Array[]>;audio?:AudioCheckDeps;
 soundtrack?:(videoBytes:Uint8Array)=>Promise<Awaited<ReturnType<typeof soundtrackVerdict>>>;store?:typeof storeMedia;now?:()=>Date};

/** Checks and (when safe) stores one video. Throws when the check cannot run: the video stays unchecked, and is never used. */
export async function reviewVideoUpload(bytes:Uint8Array,mime:ReviewVideoMime,deps:VideoReviewDeps={}):Promise<UploadReview>{
 if(!bytes.byteLength||bytes.byteLength>MAX_VIDEO_REVIEW_BYTES)throw new Error("Video size out of range");
 const sample=deps.sample??(b=>withVideo(b,async(dir,file)=>(await sampleFrames(dir,file)).frames));
 // The picture and the soundtrack are checked at the same time (the soundtrack's answer is used only when every frame passes).
 const soundP=(deps.soundtrack??(b=>soundtrackVerdict(b,deps.audio)))(bytes);soundP.catch(()=>{});
 const frames=await sample(bytes);
 const inspect=deps.inspect??inspectUpload;
 const verdicts=await pool(frames,FRAME_CONCURRENCY,f=>inspect({bytes:f,mime:"image/jpeg"}));
 const base={reviewId:randomUUID(),sha256:createHash("sha256").update(bytes).digest("hex"),at:(deps.now?.()??new Date()).toISOString(),kind:"video" as const};
 const bad=verdicts.find(v=>v.category!=="none");
 let r:UploadReview;
 if(bad&&bad.category!=="none")r={...base,state:"blocked",category:bad.category,fixFa:FIX_FA[bad.category].replace(/عکس/g,"ویدیو"),messageFa:VIDEO_BLOCKED_FA[bad.category],labelFa:BLOCKED_LABEL_FA[bad.category]};
 else{
  const sound=await soundP;
  if(sound==="unchecked")throw new Error("soundtrack_unchecked");
  if(sound!=="none"&&sound!=="clean"){const x=SPEECH_FA[sound];r={...base,state:"blocked",category:x.as,fixFa:SPEECH_FIX_FA,messageFa:x.fa,labelFa:x.label};}
  else r={...base,state:"safe",mediaId:(await (deps.store??storeMedia)(bytes,mime)).id,mime,person:verdicts.some(v=>v.person)};
 }
 keep(r);return r;
}
/** The video in a scratch folder for ffmpeg, removed afterwards whatever happens. */
async function withVideo<T>(bytes:Uint8Array,fn:(dir:string,file:string)=>Promise<T>):Promise<T>{
 const dir=await mkdtemp(join(tmpdir(),"whoush-video-"));
 try{const file=join(dir,"in.video");await writeFile(file,bytes);return await fn(dir,file);}
 finally{await rm(dir,{recursive:true,force:true}).catch(()=>{});}
}
