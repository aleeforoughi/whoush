import "server-only";
/**
 * The frame preview of an edit to a video (owner, 2026-11-08: "take a screenshot from the reference video every 5 s" (then: every 3 s), at least the first, middle and last
 * frame, then use those screenshots with the references to generate the frames as a draft; the user can decide or change it"). Frames are taken from the
 * user's own checked video (lib/video-review.ts: the whole video passed, picture and sound), stored like a checked upload, and each one is then edited by
 * the cheap image model with the user's photos. A PREVIEW OF THE EDIT, not of the video: the video models offered now read only the prompt (they never see
 * the source video or the photos), so the card says so. Frames are never logged.
 */
import {execFile} from "node:child_process";
import {mkdtemp,readFile,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
/** One frame every 3 seconds (owner, 2026-11-08), never fewer than 3 (first, middle, last), at most 12 (each frame is a paid image). */
export const PREVIEW_EVERY_SECONDS=3,MIN_PREVIEW_FRAMES=3,MAX_PREVIEW_FRAMES=12;
export const previewFramesFor=(seconds:number)=>Math.min(MAX_PREVIEW_FRAMES,Math.max(MIN_PREVIEW_FRAMES,Math.ceil(seconds/PREVIEW_EVERY_SECONDS)));
/** The moments to take, in seconds: evenly from the first frame to the last (a hair before the end, where a frame still exists). */
export function frameTimes(seconds:number):number[]{
 const n=previewFramesFor(seconds),end=Math.max(0,seconds-0.1);
 return Array.from({length:n},(_,i)=>Math.round((n===1?0:end*i/(n-1))*10)/10);
}

const FFMPEG=process.env.WHOUSH_FFMPEG_PATH||"ffmpeg";
const ff=(args:string[])=>new Promise<boolean>(resolve=>{execFile(FFMPEG,args,{timeout:30_000,maxBuffer:4_000_000},err=>resolve(!err));});
export type SourceFrame={atSeconds:number;bytes:Uint8Array};
/** The frames at `times` as JPEGs, at most 1280 px on the long side (enough for an edit). Throws when one cannot be read: no preview rather than a partial one. */
export async function sourceFrames(video:Uint8Array,times:readonly number[]):Promise<SourceFrame[]>{
 const dir=await mkdtemp(join(tmpdir(),"whoush-frames-"));
 try{
  const file=join(dir,"in.video");await writeFile(file,video);
  return await Promise.all(times.map(async(t,i)=>{
   const out=join(dir,"f"+i+".jpg");
   const ok=await ff(["-hide_banner","-nostdin","-loglevel","error","-y","-ss",t.toFixed(2),"-i",file,"-frames:v","1","-vf","scale='if(gt(iw,ih),min(1280,iw),-2)':'if(gt(iw,ih),-2,min(1280,ih))'","-q:v","3",out]);
   if(!ok)throw new Error("frame_failed");
   return {atSeconds:t,bytes:new Uint8Array(await readFile(out))};
  }));
 }finally{await rm(dir,{recursive:true,force:true}).catch(()=>{});}
}

/**
 * The image prompt for one frame: the edit the plan describes, applied to this exact frame, which is attached LAST (after the user's photos, so the
 * photos keep the numbers the plan's order note gives them). Everything the edit does not change stays as the frame shows it.
 */
export function framePrompt(planPrompt:string,frameNumber:number,photoCount:number,atSeconds:number):string{
 const lead="A single still image: frame "+frameNumber+" of a video, at "+atSeconds.toFixed(1)+" s, with the requested change applied. Attached image "+(photoCount+1)+
  " is that original frame: keep its composition, camera angle, framing, background, lighting, colours and every pose and position exactly; change only what the request asks for. ";
 const tail=" Photorealistic, one still frame: no motion blur, no text, no captions, no borders.";
 return (lead+planPrompt).slice(0,3000-tail.length)+tail;
}
