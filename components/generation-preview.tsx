"use client";
import {ImageActionStack} from "@/components/edit-image-button";
import {useEffect,useState,type CSSProperties} from "react";
import {Clapperboard,Image as ImageIcon} from "lucide-react";
import {Badge,Icon} from "@aleeforoughi/feather-react";
import {ShareActions} from "@/components/share-actions";
import type {JobView} from "@/lib/studio-types";
import {displayTag} from "@/lib/attachments";
import {estimateProgress,isActiveJob,isOwnedOutputUrl,liveStatusFa} from "@/lib/job-progress";
import {fa} from "@/lib/format";

const STOPPED_FA:Record<string,string>={failed:"ناموفق",canceled:"لغو شد",released:"آزاد شد",lost:"در دسترس نیست"};

/**
 * The generation box in the preview panel. While the job is queued or running, a transparent blue gradient sweeps across it and, at its foot, the live status
 * (state, kind and model: real facts only), a smooth progress bar and the estimated percentage («تخمینی»: the provider reports states, not progress, so it
 * eases towards 95% and reaches 100% only on completion). Done: the output when there is one, otherwise the demo note. Stopped: the reason, no bar.
 */
/**
 * The live status of a job while it works (owner, 2026-11-07): the real stage, then the lines written for this job, moving forward with the time spent in
 * the current state (measured by an interval restarted on every state change, so rendering stays pure). Also the estimated percentage. Shared by the preview
 * panel and the chat card, so both say the same thing at the same moment.
 */
export function useJobLive(job:JobView,kind:"image"|"video"="image",model?:string):{active:boolean;percent:number|null;status:string}{
 const key=job.state+"|"+job.messageFa;
 const active=isActiveJob(job.state);
 const [tick,setTick]=useState({key,elapsed:0});
 const elapsed=tick.key===key?tick.elapsed:0;
 useEffect(()=>{
  if(!active)return;
  const start=Date.now(),id=window.setInterval(()=>setTick({key,elapsed:Date.now()-start}),300);
  return()=>window.clearInterval(id);
 },[active,key]);
 return {active,percent:estimateProgress(job.state,elapsed,kind,job.typicalMs),
  status:liveStatusFa({state:job.state,elapsedMs:elapsed,kind,model,typicalMs:job.typicalMs,lines:job.progressFa,facts:job.progressFacts})};
}

/**
 * A working generation, minimal (owner, 2026-11-07): the estimated percentage, large, in the centre, with the live status line under it, and a ring on the
 * frame's border that fills with blue as it grows. The same in the preview panel and the chat card; `compact` is the card's size. The parent is the frame:
 * `relative`, rounded, `overflow-hidden`.
 */
export function GenerationProgress({status,percent,compact=false}:{status:string;percent:number;compact?:boolean}){
 return <>
  <span aria-hidden="true" className="whoush-generating pointer-events-none absolute inset-0"/>
  <span aria-hidden="true" className="whoush-progress-ring" style={{"--whoush-progress":percent+"%"} as CSSProperties}/>
  <span role="progressbar" aria-label="پیشرفت تخمینی ساخت" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-valuetext={"حدود "+fa(percent)+" درصد (تخمینی)"}
   className={"relative flex flex-col items-center justify-center text-center "+(compact?"gap-1 px-4":"gap-2 px-8")}>
   <span className={"text-fg-primary tabular-nums "+(compact?"type-heading-1":"type-display")}>{fa(percent)}٪</span>
   <span aria-live="polite" className={"max-w-sm text-fg-secondary "+(compact?"line-clamp-2 type-caption":"type-body-sm")}>{status}</span>
  </span>
 </>;
}

export function GenerationPreview({job,kind="image",model,placeholder,onEdit,onView}:{job:JobView;kind?:"image"|"video";model?:string;placeholder:string;
 /** Full screen (the viewer). */onView?:()=>void;
 /** «ادیت» on a finished image (components/edit-image-button.tsx). */onEdit?:()=>void}){
 const {active,percent,status}=useJobLive(job,kind,model);
 // Only a Whoush-owned output is shown (launch gate 8); a provider URL keeps the placeholder.
 const first=job.outputs?.[0],output=first&&typeof window!=="undefined"&&isOwnedOutputUrl(first.url,window.location.origin)?first:undefined;
 const stopped=STOPPED_FA[job.state],shown=output&&!active?output:undefined;
 // eslint-disable-next-line @next/next/no-img-element -- a Whoush-owned output shown in the preview
 const picture=shown?<img src={shown.url} alt={"تصویر "+(job.tag?displayTag(job.tag):"ساخته‌شده")} className="block h-auto max-h-[min(75dvh,56rem)] w-auto max-w-full rounded-control"/>:null;
 return <div className="flex flex-col gap-3">
  {/* While generating or without an output: a 16:9 stage. With an output: the frame follows the media, so the whole image or video shows at its own ratio. */}
  <div className={"relative flex flex-col overflow-hidden rounded-card border border-line-secondary bg-surface-subtle "+(shown?"":"min-h-48 md:aspect-video")}>
   {active&&percent!==null&&!shown&&<div className="relative flex flex-1 flex-col items-center justify-center p-8"><GenerationProgress status={status} percent={percent}/></div>}
   {!(active&&percent!==null&&!shown)&&<div className={"relative flex flex-1 flex-col items-center justify-center gap-3 text-center "+(shown?"p-2":"p-8")}>
    {shown
     ?(shown.kind==="video"
      ?<video src={shown.url+"#t=0.1"} controls playsInline preload="metadata" aria-label={"ویدیوی "+(job.tag?displayTag(job.tag):"ساخته‌شده")} className="block h-auto max-h-[min(75dvh,56rem)] w-full rounded-control bg-background object-contain"/>
      :<span className="group relative block w-fit max-w-full"><ImageActionStack label={job.tag?displayTag(job.tag):""} onEdit={onEdit} url={shown.url} file={{name:"output",mime:"image/png",kind:"image",tag:job.tag??"generation1"}}/>
       {onView
        ?<button type="button" onClick={onView} aria-label={"نمایش تمام‌صفحه "+(job.tag?displayTag(job.tag):"")} className="block rounded-control motion-hover hover:opacity-90">{picture}</button>
        :picture}<ImageActionStack under label={job.tag?displayTag(job.tag):""} onEdit={onEdit} url={shown.url} file={{name:"output",mime:"image/png",kind:"image",tag:job.tag??"generation1"}}/></span>)
     :<>
      <Icon icon={kind==="video"?Clapperboard:ImageIcon} size={32} aria-hidden="true" className={active?"text-primary":"text-fg-secondary"}/>
      <p className="type-body text-fg-primary">{active?status:job.messageFa}</p>
      {!active&&!stopped&&<p className="type-caption text-fg-secondary">{placeholder}</p>}
     </>}
   </div>}
  </div>
  {stopped&&<div className="flex flex-wrap items-center gap-2"><Badge variant="destructive">{stopped}</Badge><span className="type-body-sm text-fg-secondary">{job.messageFa}</span></div>}
  {/* TODO(launch gate 8): outputs must be mirrored to owned storage (docs/LAUNCH_GATES.md) first; download and share then use a Whoush URL, never the provider's. */}
 </div>;
}
