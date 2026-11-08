"use client";
import {useState} from "react";
import {TagText} from "@/components/message-text";
import {SAVE_AGAIN_FA,useSaveFromUrl} from "@/components/share-actions";
import {Brush,Clapperboard,Download,Image as ImageIcon,Maximize2,RotateCcw,Shuffle,TriangleAlert,VolumeX} from "lucide-react";
import {Badge,Button,Icon} from "@aleeforoughi/feather-react";
import {displayTag} from "@/lib/attachments";
import {jobStateFa} from "@/lib/projects";
import {fa} from "@/lib/format";
import {GenerationProgress,useJobLive} from "@/components/generation-preview";
import type {JobView} from "@/lib/studio-types";

export const OPEN_PREVIEW_FA="نمایش",CLOSE_PREVIEW_FA="بستن نمایش";
/** Shown when a plan cannot be run again because the server no longer has it (a restart). */
export const RERUN_GONE_FA="این برنامه دیگه روی سرور نیست؛ درخواستت رو یه بار دیگه بفرست تا از نو بسازمش.";
/** The states a generation can be run again from: it stopped without an output. */
export const RETRY_STATES=["failed","canceled","released","lost"];
export type PreviewOutput={kind:"image"|"video";url:string};

/**
 * A finished picture at the card's full width and its own shape (owner, 2026-11-08: "the generated image card is stretching the image"). The ratio the
 * plan asked for only reserves the height until the picture loads; then the picture's real size decides. A locked edit comes back at the photo's own
 * shape (3:2) even when the model was asked for a 4:5 close-up, and forcing the planned box squeezed it.
 */
function OutputImage({url,planned}:{url:string;planned?:string}){
 const [real,setReal]=useState<{url:string;ratio:string}|null>(null);
 const read=(img:HTMLImageElement|null)=>{if(img?.complete&&img.naturalWidth&&img.naturalHeight&&real?.url!==url)setReal({url,ratio:img.naturalWidth+" / "+img.naturalHeight});};
 const ratio=real?.url===url?real.ratio:planned;
 // eslint-disable-next-line @next/next/no-img-element -- a provider output URL shown as the card's preview
 return <img ref={read} src={url} alt="" onLoad={e=>read(e.currentTarget)} style={ratio?{aspectRatio:ratio}:undefined} className="block h-auto w-full rounded-control object-contain"/>;
}

/**
 * A generation's preview as a card in the conversation. On top, full width inside the card (16:9): the output, an image (a button that opens the preview panel)
 * or a video with its own player controls, or the kind's icon while there is no output yet. Under it, «پیش‌نمایش #تولید-۱», the job state and the message, as a
 * button that opens the preview panel on this generation. Shown for every generation with a preview, so the panel can always be brought back from the chat.
 */
export function PreviewCard({tag,state,messageFa,job,model,output,video,onOpen,onEdit,onView,onRetry,onSwitch,retryNeurons,aspect}:{tag?:string;state:string;messageFa:string;
 /** The job, for its live status line while it works (the same line as the preview panel). */job?:JobView;model?:string;
 output?:PreviewOutput;video?:boolean;onOpen:()=>void;
 /** Full screen (the viewer): a tap on the image, or the corner button on a video. */onView?:()=>void;
 /** «ویرایش با قلم» on a finished image. */onEdit?:()=>void;
 /** «دوباره بساز» on a generation that stopped without an output (owner, 2026-11-07), with its price when known. */onRetry?:()=>void;retryNeurons?:number;
 /** A refused generation on the other model the server suggests (`job.alternative`). */onSwitch?:()=>void;
 /** The ratio asked for («9:16»): the picture's box is reserved before it loads, so the chat does not jump when it arrives (Safari has no scroll anchoring). */aspect?:string}){
 const ratio=aspect&&/^\d{1,2}:\d{1,2}$/.test(aspect)?aspect.replace(":"," / "):undefined;
 const label=OPEN_PREVIEW_FA+(tag?" "+displayTag(tag):"");
 // «دانلود» (owner, 2026-11-08): on a phone, the share sheet with «Save Image» / «Save Video»; elsewhere a download (components/share-actions.tsx).
 const saveOutput=useSaveFromUrl(output?.url??"",{name:"output",mime:output?.kind==="video"?"video/mp4":"image/png",kind:output?.kind==="video"?"video":"image",tag:tag??"generation1"});
 const live=useJobLive(job??{state,messageFa},video?"video":"image",model),line=live.active?live.status:messageFa;
 // While it works (no output yet): the same sweep and progress foot as the preview panel (owner, 2026-11-07).
 const working=live.active&&!output&&live.percent!==null;
 // A generation that stopped without an output: the card turns red with the reason and a rerun button (owner, 2026-11-07).
 const failed=!output&&RETRY_STATES.includes(state);
 // The placeholder keeps a 16:9 frame; a real output sets its own frame, so the whole image or video shows at its own ratio (never cropped to fill).
 // An output fills the card's width and takes the height of its own ratio (owner, 2026-11-08): never cut, no empty space around it. The ratio reserves
 // that height before the picture loads, so the chat does not jump.
 const frame="relative flex w-full items-center overflow-hidden rounded-control text-fg-secondary",media=frame+(output?" justify-start":" aspect-video justify-center bg-surface-hover");
 return <div data-preview-card={tag??""} data-failed={failed||undefined} className={"flex w-full flex-col gap-3 rounded-card p-3 "+(failed?"bg-destructive/10":"whoush-widget")}>
  {/* The card reads top to bottom (owner, 2026-11-08): its title, the picture, the description, then «ادیت» and «دانلود». The full-screen button sits on
      the picture's top-left corner (the end side in Persian). */}
  {output?.kind==="video"
   ?<span className="relative order-2 block w-full">{onView&&<button type="button" onClick={onView} aria-label={"نمایش تمام‌صفحه"+(tag?" "+displayTag(tag):"")} title="نمایش تمام‌صفحه"
     className="absolute end-1.5 top-1.5 z-10 flex size-7 items-center justify-center rounded-[4px] bg-background/85 text-fg-primary shadow-sm backdrop-blur-sm motion-hover hover:bg-surface-pressed"><Icon icon={Maximize2} size={16} aria-hidden="true"/></button>}<video src={output.url+"#t=0.1"} controls playsInline preload="metadata" aria-label={"ویدیوی "+(tag?displayTag(tag):"پیش‌نمایش")} className="block h-auto w-full rounded-control bg-background"/></span>
   :working
    ?<button type="button" onClick={onOpen} aria-label={label} className="relative order-2 flex aspect-video w-full items-center justify-center overflow-hidden rounded-control bg-surface-hover motion-hover hover:bg-surface-pressed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
     <GenerationProgress compact status={live.status} percent={live.percent!}/>
    </button>
   :<span className="group relative order-2 block w-full">{output&&onView&&<button type="button" onClick={onView} tabIndex={-1} aria-hidden="true"
     className="absolute end-1.5 top-1.5 z-10 flex size-7 items-center justify-center rounded-[4px] bg-background/85 text-fg-primary shadow-sm backdrop-blur-sm motion-hover hover:bg-surface-pressed"><Icon icon={Maximize2} size={16} aria-hidden="true"/></button>}<button type="button" onClick={output&&onView?onView:onOpen} aria-label={output&&onView?"نمایش تمام‌صفحه"+(tag?" "+displayTag(tag):""):label} className={media+" motion-hover not-disabled:hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"}>
    {output
     ?<OutputImage url={output.url} planned={ratio}/>
     :<Icon icon={failed?TriangleAlert:video?Clapperboard:ImageIcon} size={32} aria-hidden="true" className={failed?"text-destructive":undefined}/>}
   </button></span>}
  {failed&&<span role="alert" className="order-4 px-1 type-caption text-destructive">{messageFa}</span>}
  {/* Card buttons (owner, 2026-11-08): the full card width, split evenly, at least 48px tall with generous padding. */}
  {failed&&(onRetry||(onSwitch&&job?.alternative))&&<div className="order-4 flex gap-2">
   {/* Refused by the model's own rules (owner, 2026-11-08): the same request on a model with other rules comes first. */}
   {onSwitch&&job?.alternative&&<Button type="button" size="sm" variant="destructive" onClick={onSwitch} className="h-auto min-h-12 flex-1 px-4 py-3"><Icon icon={Shuffle} aria-hidden="true"/>با {job.alternative.name} بساز<span className="type-caption opacity-80">{fa(job.alternative.neurons)} نورون</span></Button>}
   {onRetry&&<Button type="button" size="sm" variant={onSwitch&&job?.alternative?"outline":"destructive"} onClick={onRetry} className="h-auto min-h-12 flex-1 px-4 py-3"><Icon icon={RotateCcw} aria-hidden="true"/>دوباره بساز{retryNeurons?<span className="type-caption opacity-80">{fa(retryNeurons)} نورون</span>:null}</Button>}
  </div>}
  {/* A silent video says why (its soundtrack failed the check and was removed): calm, never an error. */}
  {output?.kind==="video"&&job?.audioNoteFa&&<p className="order-4 flex items-center gap-1.5 px-1 type-caption text-fg-secondary"><Icon icon={VolumeX} size={16} aria-hidden="true" className="size-3.5 shrink-0"/>{job.audioNoteFa}</p>}
  {/* In the chat (owner, 2026-11-06): «ادیت» and «دانلود» as action buttons under the picture, not on hover. */}
  {output&&<div className="order-6 flex gap-2">
   {onEdit&&output.kind!=="video"&&<Button type="button" size="sm" variant="secondary" onClick={onEdit} className="h-auto min-h-12 flex-1 px-4 py-3"><Icon icon={Brush} aria-hidden="true"/>ادیت</Button>}
   <Button type="button" size="sm" variant="outline" onClick={()=>void saveOutput.save()} className="h-auto min-h-12 flex-1 px-4 py-3"><Icon icon={Download} aria-hidden="true"/>{saveOutput.again?SAVE_AGAIN_FA:"دانلود"}</Button>
  </div>}
  <button type="button" onClick={onOpen} aria-label={label+": "+jobStateFa(state)}
   className="group/preview order-1 flex w-full items-center gap-2 rounded-control px-1 py-0.5 text-start motion-hover hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
   <span className="flex min-w-0 flex-1 flex-col gap-1">
    <span className="flex flex-wrap items-center gap-2">
     <span className="type-label text-fg-primary">پیش‌نمایش{tag?" "+displayTag(tag):""}</span>
     <Badge variant="outline">{jobStateFa(state)}</Badge>
    </span>
   </span>
  </button>
  {!working&&!failed&&<p aria-live={live.active?"polite":undefined} className="order-5 line-clamp-2 px-1 type-caption text-fg-secondary"><TagText text={line}/></p>}
 </div>;
}
