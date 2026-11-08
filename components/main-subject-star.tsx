"use client";
import {Star} from "lucide-react";
import {Icon} from "@aleeforoughi/feather-react";
import {MAIN_SUBJECT_FA,shownTag} from "@/lib/main-subject";

/**
 * The «سوژه اصلی» star: marks this file or # as the main subject (only one at a time; tapping it again clears it). Filled and blue when it is the main subject.
 */
/** The short label beside the star on a card. */
export const SUBJECT_SHORT_FA="سوژه";
/** `labelled`: the short word «سوژه» beside the star, on its right in RTL (owner, 2026-11-08: the chat input's cards), part of the same button. */
export function MainSubjectStar({tag,on,onToggle,className="",labelled=false}:{tag:string;on:boolean;onToggle:()=>void;className?:string;labelled?:boolean}){
 return <button type="button" onClick={e=>{e.stopPropagation();onToggle();}} aria-pressed={on}
  aria-label={(on?"برداشتن "+MAIN_SUBJECT_FA+": ":MAIN_SUBJECT_FA+" کن: ")+shownTag(tag)} title={MAIN_SUBJECT_FA}
  className={"hit-area flex shrink-0 items-center justify-center rounded-control "+(labelled?"h-7 gap-1 px-1.5 ":"size-7 ")+" motion-hover hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring "+(on?"text-primary":"text-fg-tertiary hover:text-fg-primary")+" "+className}>
  {/* Selected: the word in the primary text colour (white in dark mode) beside the brand-coloured star; not selected: washed out with the star. */}
  {labelled&&<span aria-hidden="true" className={"type-caption "+(on?"text-fg-primary":"")}>{SUBJECT_SHORT_FA}</span>}
  <Icon icon={Star} size={16} aria-hidden="true" className={"size-4 "+(on?"fill-current":"")}/>
 </button>;
}
