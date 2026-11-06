"use client";
import {EditImageButton} from "@/components/edit-image-button";
import {useEffect,useState} from "react";
import {Clapperboard,Image as ImageIcon} from "lucide-react";
import {Badge,Icon} from "@aleeforoughi/feather-react";
import {ShareActions} from "@/components/share-actions";
import type {JobView} from "@/lib/studio-types";
import {displayTag} from "@/lib/attachments";
import {estimateProgress,isActiveJob,isOwnedOutputUrl,jobStatusFa} from "@/lib/job-progress";
import {fa} from "@/lib/format";

const STOPPED_FA:Record<string,string>={failed:"ناموفق",canceled:"لغو شد",released:"آزاد شد",lost:"در دسترس نیست"};

/**
 * The generation box in the preview panel. While the job is queued or running, a transparent blue gradient sweeps across it and, at its foot, the live status
 * (state, kind and model: real facts only), a smooth progress bar and the estimated percentage («تخمینی»: the provider reports states, not progress, so it
 * eases towards 95% and reaches 100% only on completion). Done: the output when there is one, otherwise the demo note. Stopped: the reason, no bar.
 */
export function GenerationPreview({job,kind="image",model,placeholder,onEdit}:{job:JobView;kind?:"image"|"video";model?:string;placeholder:string;
 /** «ادیت» on a finished image (components/edit-image-button.tsx). */onEdit?:()=>void}){
 const key=job.state+"|"+job.messageFa;
 const active=isActiveJob(job.state);
 // Time in the current state, measured by the interval (restarted whenever the state changes), so rendering stays pure.
 const [tick,setTick]=useState({key,elapsed:0});
 const elapsed=tick.key===key?tick.elapsed:0;
 useEffect(()=>{
  if(!active)return;
  const start=Date.now(),id=window.setInterval(()=>setTick({key,elapsed:Date.now()-start}),300);
  return()=>window.clearInterval(id);
 },[active,key]);
 const percent=estimateProgress(job.state,elapsed,kind,job.typicalMs);
 // Only a Whoush-owned output is shown (launch gate 8); a provider URL keeps the placeholder.
 const first=job.outputs?.[0],output=first&&typeof window!=="undefined"&&isOwnedOutputUrl(first.url,window.location.origin)?first:undefined;
 const stopped=STOPPED_FA[job.state],shown=output&&!active?output:undefined;
 const status=jobStatusFa(job.state,kind,model);
 return <div className="flex flex-col gap-3">
  {/* While generating or without an output: a 16:9 stage. With an output: the frame follows the media, so the whole image or video shows at its own ratio. */}
  <div className={"relative flex flex-col overflow-hidden rounded-card border border-line-secondary bg-surface-subtle "+(shown?"":"min-h-48 md:aspect-video")}>
   {active&&<div aria-hidden="true" className="whoush-generating pointer-events-none absolute inset-0"/>}
   <div className={"relative flex flex-1 flex-col items-center justify-center gap-3 text-center "+(shown?"p-2":"p-8")}>
    {shown
     ?(shown.kind==="video"
      ?<video src={shown.url} controls playsInline preload="metadata" aria-label={"ویدیوی "+(job.tag?displayTag(job.tag):"ساخته‌شده")} className="block h-auto max-h-[min(75dvh,56rem)] w-full rounded-control bg-background object-contain"/>
      // eslint-disable-next-line @next/next/no-img-element -- a Whoush-owned output shown in the preview
      :<span className="group relative block w-fit max-w-full">{onEdit&&<EditImageButton label={job.tag?displayTag(job.tag):""} onClick={onEdit}/>}
       <img src={shown.url} alt={"تصویر "+(job.tag?displayTag(job.tag):"ساخته‌شده")} className="block h-auto max-h-[min(75dvh,56rem)] w-auto max-w-full rounded-control"/></span>)
     :<>
      <Icon icon={kind==="video"?Clapperboard:ImageIcon} size={32} aria-hidden="true" className={active?"text-primary":"text-fg-secondary"}/>
      <p className="type-body text-fg-primary">{active?status:job.messageFa}</p>
      {!active&&!stopped&&<p className="type-caption text-fg-secondary">{placeholder}</p>}
     </>}
   </div>
   {percent!==null&&active&&<div className="relative flex flex-col gap-2 border-t border-line-tertiary bg-background/60 px-4 py-3">
    <div className="flex items-center justify-between gap-3">
     <span aria-live="polite" className="min-w-0 truncate type-body-sm text-fg-primary">{status}{job.tag&&<span className="text-fg-secondary"> · <bdi>{displayTag(job.tag)}</bdi></span>}</span>
     <span className="shrink-0 type-label text-fg-primary tabular-nums">{fa(percent)}٪ <span className="type-caption text-fg-secondary">(تخمینی)</span></span>
    </div>
    <div role="progressbar" aria-label="پیشرفت تخمینی ساخت" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-valuetext={"حدود "+fa(percent)+" درصد (تخمینی)"}
     className="h-1.5 w-full overflow-hidden rounded-control bg-surface-hover">
     <div className="h-full rounded-control bg-primary transition-[width] duration-500 ease-out motion-reduce:transition-none" style={{width:percent+"%"}}/>
    </div>
   </div>}
  </div>
  {stopped&&<div className="flex flex-wrap items-center gap-2"><Badge variant="destructive">{stopped}</Badge><span className="type-body-sm text-fg-secondary">{job.messageFa}</span></div>}
  {/* TODO(launch gate 8): outputs must be mirrored to owned storage (docs/LAUNCH_GATES.md) first; download and share then use a Whoush URL, never the provider's. */}
  {!active&&job.outputs?.map((o,i)=><ShareActions key={i} reason="پس از فعال شدن تولید واقعی" file={{name:"output",mime:o.kind==="video"?"video/mp4":"image/png",kind:o.kind,tag:o.kind+(i+1)}}/>)}
 </div>;
}
