"use client";
import {Brush} from "lucide-react";
import {Icon} from "@aleeforoughi/feather-react";
import {BRUSH_EDIT_FA} from "@/lib/region-edit";
/**
 * The «ادیت» button on a picture (owner, 2026-11-06): small, 4px corners, at the top right (the start side in Persian RTL), the icon with its label «ادیت»
 * on its left. It appears on hover on a computer and is always visible on a phone (no hover there). The parent is `relative group`.
 */
export function EditImageButton({label,onClick}:{label:string;onClick:()=>void}){
 return <button type="button" onClick={e=>{e.stopPropagation();onClick();}} aria-label={BRUSH_EDIT_FA+" "+label}
  className="absolute start-1.5 top-1.5 z-10 flex h-7 items-center gap-1 rounded-[4px] bg-background/85 ps-1.5 pe-2 type-caption font-medium text-fg-primary shadow-sm backdrop-blur-sm opacity-0 motion-hover group-hover:opacity-100 hover:bg-background focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-ring [@media(hover:none)]:opacity-100">
  {/* In RTL the first child sits on the right: the icon, then the label on its left. */}
  <Icon icon={Brush} size={16} aria-hidden="true"/><span aria-hidden="true">{BRUSH_EDIT_FA}</span>
 </button>;
}
