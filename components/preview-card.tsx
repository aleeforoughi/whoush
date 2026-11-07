"use client";
import {downloadFromUrl} from "@/components/edit-image-button";
import {Brush,Clapperboard,Download,Image as ImageIcon,Maximize2,RotateCcw,TriangleAlert} from "lucide-react";
import {Badge,Button,Icon} from "@aleeforoughi/feather-react";
import {displayTag} from "@/lib/attachments";
import {jobStateFa} from "@/lib/projects";
import {fa} from "@/lib/format";
import {GenerationProgress,useJobLive} from "@/components/generation-preview";
import type {JobView} from "@/lib/studio-types";

export const OPEN_PREVIEW_FA="نمایش",CLOSE_PREVIEW_FA="بستن نمایش",BACK_TO_CHAT_FA="بازگشت به چت";
/** Shown when a plan cannot be run again because the server no longer has it (a restart). */
export const RERUN_GONE_FA="این برنامه دیگه روی سرور نیست؛ درخواستت رو یه بار دیگه بفرست تا از نو بسازمش.";
/** The states a generation can be run again from: it stopped without an output. */
export const RETRY_STATES=["failed","canceled","released","lost"];
export type PreviewOutput={kind:"image"|"video";url:string};

/**
 * A generation's preview as a card in the conversation. On top, full width inside the card (16:9): the output, an image (a button that opens the preview panel)
 * or a video with its own player controls, or the kind's icon while there is no output yet. Under it, «پیش‌نمایش #تولید-۱», the job state and the message, as a
 * button that opens the preview panel on this generation. Shown for every generation with a preview, so the panel can always be brought back from the chat.
 */
export function PreviewCard({tag,state,messageFa,job,model,output,video,onOpen,onEdit,onView,onRetry,retryNeurons}:{tag?:string;state:string;messageFa:string;
 /** The job, for its live status line while it works (the same line as the preview panel). */job?:JobView;model?:string;
 output?:PreviewOutput;video?:boolean;onOpen:()=>void;
 /** Full screen (the viewer): a tap on the image, or the corner button on a video. */onView?:()=>void;
 /** «ویرایش با قلم» on a finished image. */onEdit?:()=>void;
 /** «دوباره بساز» on a generation that stopped without an output (owner, 2026-11-07), with its price when known. */onRetry?:()=>void;retryNeurons?:number}){
 const label=OPEN_PREVIEW_FA+(tag?" "+displayTag(tag):"");
 const live=useJobLive(job??{state,messageFa},video?"video":"image",model),line=live.active?live.status:messageFa;
 // While it works (no output yet): the same sweep and progress foot as the preview panel (owner, 2026-11-07).
 const working=live.active&&!output&&live.percent!==null;
 // A generation that stopped without an output: the card turns red with the reason and a rerun button (owner, 2026-11-07).
 const failed=!output&&RETRY_STATES.includes(state);
 // The placeholder keeps a 16:9 frame; a real output sets its own frame, so the whole image or video shows at its own ratio (never cropped to fill).
 // A narrower output sits at the start (right, in Persian), at most 300px tall, with no letterbox around it.
 const frame="relative flex w-full items-center overflow-hidden rounded-control text-fg-secondary",media=frame+(output?" justify-start":" aspect-video justify-center bg-surface-hover");
 return <div data-preview-card={tag??""} data-failed={failed||undefined} className={"flex w-full max-w-md flex-col gap-2 rounded-card border p-2 "+(failed?"border-destructive/60 bg-destructive/5":"border-line-secondary bg-surface-subtle")}>
  {output?.kind==="video"
   ?<span className="relative block w-fit max-w-full">{onView&&<button type="button" onClick={onView} aria-label={"نمایش تمام‌صفحه"+(tag?" "+displayTag(tag):"")} title="نمایش تمام‌صفحه"
     className="absolute start-1.5 top-1.5 z-10 flex size-7 items-center justify-center rounded-[4px] bg-background/85 text-fg-primary shadow-sm backdrop-blur-sm hover:bg-background"><Icon icon={Maximize2} size={16} aria-hidden="true"/></button>}<video src={output.url+"#t=0.1"} controls playsInline preload="metadata" aria-label={"ویدیوی "+(tag?displayTag(tag):"پیش‌نمایش")} className="block h-auto max-h-[300px] w-auto max-w-full rounded-control bg-background"/></span>
   :working
    ?<button type="button" onClick={onOpen} aria-label={label} className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-control bg-surface-hover motion-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
     <GenerationProgress compact status={live.status} percent={live.percent!}/>
    </button>
   :<span className="group relative block w-fit max-w-full"><button type="button" onClick={output&&onView?onView:onOpen} aria-label={output&&onView?"نمایش تمام‌صفحه"+(tag?" "+displayTag(tag):""):label} className={media+" motion-hover not-disabled:hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"}>
    {output
     // eslint-disable-next-line @next/next/no-img-element -- a provider output URL shown as the card's preview
     ?<img src={output.url} alt="" className="block h-auto max-h-[300px] w-auto max-w-full rounded-control"/>
     :<Icon icon={failed?TriangleAlert:video?Clapperboard:ImageIcon} size={32} aria-hidden="true" className={failed?"text-destructive":undefined}/>}
   </button></span>}
  {failed&&<div className="flex flex-wrap items-center justify-between gap-2 px-1">
   <span role="alert" className="type-caption text-destructive">{messageFa}</span>
   {onRetry&&<Button type="button" size="sm" variant="destructive" onClick={onRetry}><Icon icon={RotateCcw} aria-hidden="true"/>دوباره بساز{retryNeurons?" · "+fa(retryNeurons)+" نورون":""}</Button>}
  </div>}
  {/* In the chat (owner, 2026-11-06): «ادیت» and «دانلود» as action buttons under the picture, not on hover. */}
  {output&&<div className="flex flex-wrap items-center gap-2 px-1">
   {onEdit&&output.kind!=="video"&&<Button type="button" size="sm" variant="secondary" onClick={onEdit}><Icon icon={Brush} aria-hidden="true"/>ادیت</Button>}
   <Button type="button" size="sm" variant="outline" onClick={()=>void downloadFromUrl(output.url,{name:"output",mime:output.kind==="video"?"video/mp4":"image/png",kind:output.kind==="video"?"video":"image",tag:tag??"generation1"})}><Icon icon={Download} aria-hidden="true"/>دانلود</Button>
  </div>}
  <button type="button" onClick={onOpen} aria-label={label+": "+jobStateFa(state)}
   className="group/preview flex w-full items-center gap-2 rounded-control px-1 py-1 text-start motion-hover hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
   <span className="flex min-w-0 flex-1 flex-col gap-1">
    <span className="flex flex-wrap items-center gap-2">
     <span className="type-label text-fg-primary">پیش‌نمایش{tag?" "+displayTag(tag):""}</span>
     <Badge variant="outline">{jobStateFa(state)}</Badge>
    </span>
    {!working&&!failed&&<span aria-live={live.active?"polite":undefined} className="line-clamp-2 type-caption text-fg-secondary">{line}</span>}
   </span>
   <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-control text-fg-secondary group-hover/preview:text-fg-primary"><Icon icon={Maximize2} size={16} className="size-4"/></span>
  </button>
 </div>;
}
