"use client";
import {AudioLines,FileText,Image as ImageIcon,Lightbulb,Shapes,Video,type LucideIcon} from "lucide-react";
import {Icon} from "@aleeforoughi/feather-react";
/** What a # option is, for its thumbnail when it has no picture of its own. */
export type TagThumbKind="image"|"video"|"audio"|"file"|"prop"|"light";
const ICONS:Record<TagThumbKind,LucideIcon>={image:ImageIcon,video:Video,audio:AudioLines,file:FileText,prop:Shapes,light:Lightbulb};
/**
 * The small thumbnail at the start of every # option (owner, 2026-11-06: recognisable at a glance): the picture itself for photos and generated images,
 * otherwise the kind's icon on a tile of the same size.
 */
export function TagThumb({url,kind}:{url?:string;kind:TagThumbKind}){
 return url
  // eslint-disable-next-line @next/next/no-img-element -- a local blob: URL or an owned output
  ?<img src={url} alt="" className="size-8 shrink-0 rounded-control object-cover"/>
  :<span className="flex size-8 shrink-0 items-center justify-center rounded-control bg-surface-hover text-fg-secondary"><Icon icon={ICONS[kind]} size={16} aria-hidden="true"/></span>;
}
