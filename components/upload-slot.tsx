"use client";
import {useState,type DragEvent} from "react";
import {Upload as UploadIcon,X} from "lucide-react";
import {Button,Icon} from "@aleeforoughi/feather-react";
import {INSERT_ICONS} from "@/components/insert-menu";
import {SLOT_DROP_FA,slotLabelFa,type UploadSlot} from "@/lib/upload-slots";

const hasFiles=(e:DragEvent)=>Array.from(e.dataTransfer.types).includes("Files");

/**
 * An empty upload card inside the chat input, styled as an empty state: transparent with a faint dashed border and a muted icon and title, so the one strong element is
 * the full-width, icon-only upload button (secondary fill with a solid 3:1 border; never the blue primary, which belongs to send). Its accessible name is «آپلود <title>». The whole card is a drop zone. The remove button is a sibling of
 * the upload button, never nested in it.
 */
export function UploadSlotCard({slot,disabled,onUpload,onDropFiles,onRemove}:{slot:UploadSlot;disabled?:boolean;onUpload:()=>void;onDropFiles:(files:File[])=>void;onRemove:()=>void}){
 const [over,setOver]=useState(false);
 const drop=(e:DragEvent)=>{if(!hasFiles(e))return;e.preventDefault();e.stopPropagation();setOver(false);const f=Array.from(e.dataTransfer.files);if(f.length)onDropFiles(f);};
 return <li className={"relative flex w-48 shrink-0 flex-col gap-2 rounded-control border border-dashed p-2 motion-hover "+(over?"border-primary bg-surface-hover":"border-line-secondary bg-transparent")}
  onDragEnter={e=>{if(hasFiles(e)){e.preventDefault();e.stopPropagation();setOver(true);}}}
  onDragOver={e=>{if(hasFiles(e)){e.preventDefault();e.stopPropagation();}}}
  onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node|null))setOver(false);}}
  onDrop={drop}>
  {/* pe-10 keeps the title clear of the remove button in the top-end corner */}
  <span className="flex min-h-control items-center gap-2 ps-1 pe-10 text-fg-secondary">
   <Icon icon={INSERT_ICONS[slot.icon]} size={16} aria-hidden="true" className="shrink-0"/>
   <span className="type-label">{slot.titleFa}</span>
  </span>
  <Button type="button" variant="ghost" size="icon" onClick={onRemove} aria-label={"حذف کارت "+slot.titleFa} className="absolute end-1 top-1 text-fg-secondary">
   <Icon icon={X} aria-hidden="true"/>
  </Button>
  <Button type="button" variant="secondary" data-slot-id={slot.id} onClick={onUpload} disabled={disabled} aria-label={slotLabelFa(slot)} aria-describedby={"slot-hint-"+slot.id} className="w-full border-line-primary">
   <Icon icon={UploadIcon} aria-hidden="true"/>
  </Button>
  <span id={"slot-hint-"+slot.id} className="px-1 text-center type-caption text-fg-secondary">{SLOT_DROP_FA}</span>
 </li>;
}
