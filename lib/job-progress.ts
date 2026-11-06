/**
 * Estimated generation progress for the preview. The provider reports states (queued, running, completed), not progress, so the percentage is an ESTIMATE from the
 * time spent in the current state against a typical duration: it eases towards 95% and reaches 100% only when the provider reports completion. Never a claim of success.
 */
export const DONE_STATES=["completed","completed_demo"] as const;
/** `lost`: the browser asked about a job the server no longer knows (a development restart; jobs are not yet durable), so its outcome cannot be shown. */
export const STOPPED_STATES=["failed","canceled","released","lost"] as const;
export const isFinalJobState=(state:string)=>(DONE_STATES as readonly string[]).includes(state)||(STOPPED_STATES as readonly string[]).includes(state);
/** How long the browser keeps following a job: four times its typical time, at least 3 and at most 15 minutes. Reopening the project follows it again. */
export function followDeadlineMs(typicalMs:number|undefined,kind:"image"|"video"="image"):number{
 return Math.min(15*60_000,Math.max(3*60_000,4*(typicalMs&&typicalMs>0?typicalMs:TYPICAL_MS[kind])));
}
/** The wait before status check `n` (0-based): 1.5 s at first, slowing to 5 s, so a long video does not poll every second for minutes. */
export const pollDelayMs=(n:number)=>Math.min(5_000,1_500+n*250);
/** Typical generation time by kind, in milliseconds: the fallback pace when the model has no measured time (MediaModel.typicalSeconds). */
export const TYPICAL_MS={image:60_000,video:120_000} as const;
const QUEUE_CAP=12,ON_TIME=85,RUN_CAP=95;

/**
 * The estimated percentage (0 to 100, whole number) or null when the job stopped (failed, canceled, released) and has no progress to show.
 * While running, the bar moves at an even pace and reaches 85% at the typical time (the model's measured time when known, else the kind's), so it neither
 * races ahead at the start nor crawls at the end of a normal run; only past the typical time does it slow, easing towards 95% and never claiming completion.
 */
export function estimateProgress(state:string,msInState:number,kind:"image"|"video"="image",typicalMs?:number):number|null{
 if((DONE_STATES as readonly string[]).includes(state))return 100;
 if((STOPPED_STATES as readonly string[]).includes(state))return null;
 const t=Math.max(0,msInState);
 if(state==="running"){
  const typ=typicalMs&&typicalMs>0?typicalMs:TYPICAL_MS[kind];
  const p=t<=typ?QUEUE_CAP+(ON_TIME-QUEUE_CAP)*t/typ:ON_TIME+(RUN_CAP-ON_TIME)*(1-Math.exp(-(t-typ)/(0.5*typ)));
  return Math.min(RUN_CAP,Math.round(p));
 }
 return Math.min(QUEUE_CAP,Math.round(QUEUE_CAP*(1-Math.exp(-t/4000))));
}
/** Whether the job is still in progress (queued or running): the preview shows the bar and the animated gradient only then. */
export const isActiveJob=(state:string)=>!(DONE_STATES as readonly string[]).includes(state)&&!(STOPPED_STATES as readonly string[]).includes(state);
/** The live status line from real facts only: the state, the kind and the model when known. */
export function jobStatusFa(state:string,kind:"image"|"video"="image",model?:string):string{
 const what=kind==="video"?"ویدیو":"تصویر",withModel=model?" با "+model:"";
 if(state==="quoted"||state==="approved")return "تأیید و آماده‌سازی ساخت"+withModel+"…";
 if(state==="reserved")return "رزرو نورون و آماده‌سازی"+withModel+"…";
 if(state==="queued"||state==="submitted")return "در صف سرویس ساخت"+withModel+"…";
 if(state==="running")return "در حال ساخت "+what+withModel+"…";
 if((DONE_STATES as readonly string[]).includes(state))return "ساخت "+what+" تمام شد";
 if(state==="failed")return "ساخت "+what+" ناموفق بود";
 if(state==="canceled")return "ساخت "+what+" لغو شد";
 if(state==="released")return "رزرو نورون آزاد شد";
 if(state==="lost")return "وضعیت این تولید دیگر در دسترس نیست";
 return "در حال آماده‌سازی…";
}
/**
 * Whether an output URL may be shown: only a Whoush-owned one (a same-origin path). Provider URLs are never fetched or shown until outputs are mirrored to owned
 * storage (docs/LAUNCH_GATES.md, gate 8); until then the preview keeps its placeholder.
 */
export function isOwnedOutputUrl(url:string,origin?:string):boolean{
 if(url.startsWith("/")&&!url.startsWith("//"))return true;
 try{return origin!==undefined&&new URL(url).origin===origin;}catch{return false;}
}
