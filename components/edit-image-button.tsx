"use client";
import {Brush} from "lucide-react";
import {Icon} from "@aleeforoughi/feather-react";
import {BRUSH_EDIT_FA} from "@/lib/region-edit";
/**
 * The «ویرایش با قلم» button on a picture (owner, 2026-11-06): small, icon only, 4px corners, at the top right (the start side in Persian RTL); it appears on hover on a computer and is
 * always visible on a phone (no hover there). The parent is `relative group`.
 */
export function EditImageButton({label,onClick}:{label:string;onClick:()=>void}){
 return <button type="button" onClick={e=>{e.stopPropagation();onClick();}} aria-label={BRUSH_EDIT_FA+" "+label} title={BRUSH_EDIT_FA}
  className="absolute start-1.5 top-1.5 z-10 flex size-7 items-center justify-center rounded-[4px] bg-background/85 text-fg-primary shadow-sm backdrop-blur-sm opacity-0 motion-hover group-hover:opacity-100 hover:bg-background focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-ring [@media(hover:none)]:opacity-100">
  <Icon icon={Brush} size={16} aria-hidden="true"/>
 </button>;
}
