"use client";
import {TagThumb} from "@/components/tag-thumb";
import {useState,type ReactElement} from "react";
import {Badge,Popover,PopoverContent,PopoverTrigger} from "@aleeforoughi/feather-react";
import type {MentionOption} from "@/components/mention-textarea";
import {displayTag} from "@/lib/attachments";
import {MainSubjectStar} from "@/components/main-subject-star";

export const TAG_PICKER_LABEL_FA="#های این گفت‌وگو";
export const TAG_PICKER_EMPTY_FA="هنوز چیزی برای # نیست. با «+» فایل یا مرجع اضافه کن؛ هر تولید هم یه # می‌گیره.";

/**
 * The composer's «#» button: a popover listing every `#` this chat has right now (files, generations, scene props and lights), the same entries the typed `#`
 * picker offers. Choosing one drops it into the prompt as a badge with a × to dismiss it. The trigger is the caller's button, rendered through `render`.
 */
export function TagPicker({options,trigger,onPick,main,onToggleMain}:{options:readonly MentionOption[];trigger:ReactElement;onPick:(tag:string)=>void;
 /** «سوژه اصلی»: the current main subject and the star that marks one (it also drops the # into the prompt). */main?:string|null;onToggleMain?:(tag:string)=>void}){
 const [open,setOpen]=useState(false);
 return <Popover open={open} onOpenChange={setOpen}>
  <PopoverTrigger render={trigger}/>
  <PopoverContent side="top" align="start" sideOffset={8} aria-label={TAG_PICKER_LABEL_FA} className="flex w-[min(20rem,calc(100vw-2rem))] flex-col gap-1 p-1!">
   {options.length
    ?<ul aria-label={TAG_PICKER_LABEL_FA} className="scrollbar-right flex max-h-64 flex-col overflow-y-auto">
     {options.map(o=><li key={o.id} className="flex items-center gap-1">
      <button type="button" onClick={()=>{setOpen(false);onPick(o.tag);}}
       className="flex min-h-control min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 rounded-control px-3 py-2 text-start motion-hover hover:bg-surface-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring">
       <TagThumb url={o.thumbUrl} kind={o.thumbKind}/>
       <bdi className="type-label text-fg-primary">{displayTag(o.tag)}</bdi>
       <Badge variant="outline">{o.badgeFa}</Badge>
       {o.captionFa&&<span className="min-w-0 truncate type-caption text-fg-secondary">{o.captionFa}</span>}
      </button>
      {onToggleMain&&<MainSubjectStar tag={o.tag} on={main===o.tag} onToggle={()=>onToggleMain(o.tag)}/>}
     </li>)}
    </ul>
    :<p role="status" className="p-3 type-caption text-fg-secondary">{TAG_PICKER_EMPTY_FA}</p>}
  </PopoverContent>
 </Popover>;
}
