"use client";
import {BadgeCheck,Info,RotateCw} from "lucide-react";
import {Icon} from "@aleeforoughi/feather-react";
import {BLOCKED_SHORT_FA,RETRY_REVIEW_FA,REVIEWED_FA,REVIEWING_FA,type PhotoReview} from "@/lib/photo-review";
import {fa} from "@/lib/format";

/** A small progress ring (0..1), in the primary colour. */
export function ReviewRing({progress,size=20}:{progress:number;size?:number}){
 const r=(size-4)/2,c=2*Math.PI*r;
 return <svg width={size} height={size} viewBox={"0 0 "+size+" "+size} aria-hidden="true" className="shrink-0 -rotate-90">
  <circle cx={size/2} cy={size/2} r={r} fill="none" strokeWidth={2.5} className="stroke-line-primary"/>
  <circle cx={size/2} cy={size/2} r={r} fill="none" strokeWidth={2.5} strokeLinecap="round" className="stroke-primary transition-[stroke-dashoffset] duration-300"
   strokeDasharray={c} strokeDashoffset={c*(1-Math.max(.04,Math.min(1,progress)))}/>
 </svg>;
}

/**
 * The safety check, drawn on a photo's thumbnail (owner, 2026-11-06, like an upload that shows its check): while checking, a veil with a ring and «بررسی
 * ایمنی…»; once safe, a small verified badge in the corner; blocked, a red veil with the reason (and the way to fix it) in the title; a failed check, a
 * button to check again. It sits over the media area, so it never changes the card's size.
 */
export function PhotoReviewOverlay({review,onRetry}:{review?:PhotoReview;onRetry?:()=>void}){
 if(!review)return null;
 if(review.state==="safe")return <span title={REVIEWED_FA} aria-label={REVIEWED_FA} role="img"
  className="pointer-events-auto absolute bottom-1 start-1 flex size-6 items-center justify-center rounded-full bg-background/85 text-primary shadow-sm">
  <Icon icon={BadgeCheck} size={16} aria-hidden="true"/>
 </span>;
 if(review.state==="checking")return <span role="status" aria-live="polite" aria-label={REVIEWING_FA+" "+fa(Math.round(review.progress*100))+"٪"}
  className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 bg-background/60 backdrop-blur-[1px]">
  <ReviewRing progress={review.progress} size={24}/>
  <span className="type-caption text-fg-primary">{REVIEWING_FA}</span>
 </span>;
 if(review.state==="blocked")return <span role="img" aria-label={(review.labelFa??BLOCKED_SHORT_FA)+": "+review.reasonFa+(review.fixFa?" "+review.fixFa:"")} title={review.reasonFa+(review.fixFa?"\n"+review.fixFa:"")}
  className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center gap-1 bg-background/80 px-2 text-center text-fg-primary backdrop-blur-[2px]">
  {/* Calm, not an error (owner, 2026-11-07): an info mark and the reason in a word; the full line and the way forward are in the chat and the title. */}
  <Icon icon={Info} size={16} aria-hidden="true" className="text-fg-secondary"/>
  <span className="type-caption font-medium">{review.labelFa??BLOCKED_SHORT_FA}</span>
 </span>;
 return <span className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center gap-1 bg-background/70 px-2 text-center">
  <span className="type-caption text-fg-secondary">{review.reasonFa}</span>
  {onRetry&&<button type="button" onClick={e=>{e.stopPropagation();onRetry();}}
   className="hit-area flex items-center gap-1 rounded-control px-2 py-1 type-caption text-primary motion-hover hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
   <Icon icon={RotateCw} size={16} aria-hidden="true"/>{RETRY_REVIEW_FA}
  </button>}
 </span>;
}
