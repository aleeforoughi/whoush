/** Following one generation job from the browser until it ends: no React here, so the loop is testable and free of render rules. */
import {followDeadlineMs,isFinalJobState,isOwnedOutputUrl,pollDelayMs} from "./job-progress";
import type {JobSnapshot} from "./projects";

export const UNTRACKED_JOB_FA="وضعیت پایانی این تولید ثبت نشده است.";
export const LOST_JOB_FA="وضعیت این تولید دیگر در دسترس نیست (سرور دوباره راه‌اندازی شده).";
type JobReply={id?:string;state:string;messageFa:string;outputs?:{kind:"image"|"video";url:string}[];typicalMs?:number;progressFa?:string[];progressFacts?:JobSnapshot["progressFacts"];audioNoteFa?:string;beauty?:{shareReady?:unknown;samePerson?:unknown;verdictFa?:unknown;fixFa?:unknown};refused?:boolean;alternative?:{modelId:string;name:string;neurons:number}};

/** The transcript's record of a job from the server's view of it (only Whoush-owned output paths are kept). */
export function jobSnapshot(v:JobReply,tag?:string):JobSnapshot{
 return {state:v.state,messageFa:v.messageFa,...(v.id?{jobId:v.id}:{}),...(v.outputs?.length?{outputs:v.outputs.filter(o=>isOwnedOutputUrl(o.url))}:{}),
  ...(v.typicalMs?{typicalMs:v.typicalMs}:{}),...(tag?{tag}:{}),...(v.audioNoteFa?{audioNoteFa:v.audioNoteFa.slice(0,200)}:{}),
  ...(v.beauty&&typeof v.beauty.verdictFa==="string"?{beauty:{shareReady:v.beauty.shareReady===true,samePerson:v.beauty.samePerson===true,verdictFa:v.beauty.verdictFa.slice(0,160),...(typeof v.beauty.fixFa==="string"&&v.beauty.fixFa?{fixFa:v.beauty.fixFa.slice(0,160)}:{})}}:{}),...(v.refused?{refused:true as const,...(v.alternative?{alternative:{modelId:String(v.alternative.modelId).slice(0,128),name:String(v.alternative.name).slice(0,80),neurons:Number(v.alternative.neurons)}}:{})}:{}),
  ...(v.progressFa?.length?{progressFa:[...v.progressFa]}:{}),...(v.progressFacts?{progressFacts:{...v.progressFacts}}:{})};
}

/**
 * Asks the server about `start.jobId` (1.5 s, slowing to 5 s) until the job ends or followDeadlineMs passes, calling `onUpdate` on every change. Stops early
 * when `stillWanted()` is false (the user opened another project). A 404 means the server no longer knows the job: it ends as `lost`. Network errors and
 * other failures are retried until the deadline. Returns the last snapshot.
 */
export async function followJobUntilDone(start:JobSnapshot,onUpdate:(next:JobSnapshot)=>void,stillWanted:()=>boolean,
 io:{fetch:typeof fetch;sleep:(ms:number)=>Promise<void>;now:()=>number}={fetch:(...a)=>fetch(...a),sleep:ms=>new Promise(r=>setTimeout(r,ms)),now:()=>Date.now()}):Promise<JobSnapshot>{
 if(!start.jobId||isFinalJobState(start.state))return start;
 const deadline=io.now()+followDeadlineMs(start.typicalMs);
 let last=start;
 const apply=(next:JobSnapshot)=>{
  // The progress lines arrive a few seconds after the job starts: a change in them is an update too.
  if(next.state===last.state&&next.messageFa===last.messageFa&&(next.outputs?.length??0)===(last.outputs?.length??0)
   &&(next.progressFa??[]).join("\n")===(last.progressFa??[]).join("\n")&&JSON.stringify(next.progressFacts??{})===JSON.stringify(last.progressFacts??{})&&next.audioNoteFa===last.audioNoteFa&&JSON.stringify(next.beauty??null)===JSON.stringify(last.beauty??null)&&next.refused===last.refused)return;
  last=next;onUpdate(next);
 };
 for(let n=0;io.now()<deadline&&!isFinalJobState(last.state);n++){
  await io.sleep(pollDelayMs(n));
  if(!stillWanted())return last;
  let r:Response;
  try{r=await io.fetch("/api/generation/jobs/"+start.jobId,{cache:"no-store"});}catch{continue;}
  if(r.status===404){apply({...last,state:"lost",messageFa:LOST_JOB_FA});break;}
  if(!r.ok)continue;
  const v=await r.json().catch(()=>undefined) as JobReply|undefined;
  if(v)apply({...jobSnapshot({...v,id:start.jobId,typicalMs:v.typicalMs??start.typicalMs},start.tag),...(start.draft?{draft:start.draft}:{}),...(start.rerun?{rerun:start.rerun}:{})});
 }
 return last;
}
