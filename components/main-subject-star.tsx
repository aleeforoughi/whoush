"use client";
import {Star} from "lucide-react";
import {Icon} from "@aleeforoughi/feather-react";
import {MAIN_SUBJECT_FA,shownTag} from "@/lib/main-subject";

/**
 * The «سوژه اصلی» star: marks this file or # as the main subject (only one at a time; tapping it again clears it). Filled and blue when it is the main subject.
 */
export function MainSubjectStar({tag,on,onToggle,className=""}:{tag:string;on:boolean;onToggle:()=>void;className?:string}){
 return <button type="button" onClick={e=>{e.stopPropagation();onToggle();}} aria-pressed={on}
  aria-label={(on?"برداشتن "+MAIN_SUBJECT_FA+": ":MAIN_SUBJECT_FA+" کن: ")+shownTag(tag)} title={MAIN_SUBJECT_FA}
  className={"hit-area flex size-7 shrink-0 items-center justify-center rounded-control motion-hover hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring "+(on?"text-primary":"text-fg-tertiary hover:text-fg-primary")+" "+className}>
  <Icon icon={Star} size={16} aria-hidden="true" className={"size-4 "+(on?"fill-current":"")}/>
 </button>;
}
