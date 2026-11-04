"use client";
import {Badge} from "@aleeforoughi/feather-react";
import {ShareActions} from "@/components/share-actions";
import type {JobView} from "@/lib/studio-types";
import {fa} from "@/lib/format";

const STEPS=["در صف","در حال تولید","تکمیل"] as const;
const FAILED:Record<string,string>={failed:"ناموفق",canceled:"لغو شد",released:"آزاد شد"};
/** Position of the current state in STEPS; completed states are past the last step. */
function position(state:string):number{
 if(state==="running")return 1;
 if(state==="completed"||state==="completed_demo")return 3;
 return 0;
}

/** Job progress as text steps only. No percentages: the provider reports states, not progress. */
export function JobSteps({job}:{job:JobView}){
 const failed=FAILED[job.state];
 const at=position(job.state);
 return <div className="flex flex-col gap-3">
  <h3 className="type-label text-fg-primary">وضعیت تولید</h3>
  <ol className="flex flex-col gap-2">
   {STEPS.map((label,i)=>{
    const status=failed?"pending":i<at?"done":i===at?"active":"pending";
    const hint=status==="done"?"انجام شد":status==="active"?"در جریان":"در انتظار";
    return <li key={label} className="flex items-center gap-3" aria-current={status==="active"?"step":undefined}>
     <span aria-hidden="true" className={"flex size-8 shrink-0 items-center justify-center rounded-full type-label "+(status==="done"?"bg-primary text-primary-foreground":status==="active"?"border border-primary bg-surface-selected text-fg-primary":"border border-line-secondary text-fg-secondary")}>{fa(i+1)}</span>
     <span className={"type-body-sm "+(status==="pending"?"text-fg-secondary":"text-fg-primary")}>{label}<span className="sr-only"> ({hint})</span></span>
    </li>;
   })}
  </ol>
  {failed&&<div className="flex flex-wrap items-center gap-2"><Badge variant="destructive">{failed}</Badge><span className="type-body-sm text-fg-secondary">{job.messageFa}</span></div>}
  {!failed&&<p className="type-body-sm text-fg-secondary">{job.messageFa}</p>}
  {/* TODO(launch gate 8): outputs must be mirrored to owned storage (docs/LAUNCH_GATES.md) first; download and share then use a Whoush URL, never the provider's. The provider URL is not fetched or shown here. */}
  {job.outputs?.map((o,i)=><ShareActions key={i} reason="پس از فعال شدن تولید واقعی" file={{name:"output",mime:o.kind==="video"?"video/mp4":"image/png",kind:o.kind,tag:o.kind+(i+1)}}/>)}
 </div>;
}
