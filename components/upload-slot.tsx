"use client";
import {useState,type DragEvent} from "react";
import {Upload as UploadIcon,X} from "lucide-react";
import {Button,Icon} from "@aleeforoughi/feather-react";
import {INSERT_ICONS} from "@/components/insert-menu";
import {SLOT_HINT_FA,slotLabelFa,type UploadSlot} from "@/lib/upload-slots";

const hasFiles=(e:DragEvent)=>Array.from(e.dataTransfer.types).includes("Files");

/**
 * An empty upload card inside the chat input: the entry's icon and title with an upload hint. The whole card is the upload button (it opens the picker for that kind);
 * a file dropped on it fills it. The remove button is a sibling, never nested in the upload button.
 */
export function UploadSlotCard({slot,disabled,onUpload,onDropFiles,onRemove}:{slot:UploadSlot;disabled?:boolean;onUpload:()=>void;onDropFiles:(files:File[])=>void;onRemove:()=>void}){
 const [over,setOver]=useState(false);
 const drop=(e:DragEvent)=>{if(!hasFiles(e))return;e.preventDefault();e.stopPropagation();setOver(false);const f=Array.from(e.dataTransfer.files);if(f.length)onDropFiles(f);};
 return <li className="relative flex w-48 shrink-0"
  onDragEnter={e=>{if(hasFiles(e)){e.preventDefault();e.stopPropagation();setOver(true);}}}
  onDragOver={e=>{if(hasFiles(e)){e.preventDefault();e.stopPropagation();}}}
  onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node|null))setOver(false);}}
  onDrop={drop}>
  <button type="button" data-slot-id={slot.id} onClick={onUpload} disabled={disabled} aria-label={slotLabelFa(slot)} aria-describedby={"slot-hint-"+slot.id}
   className={"flex w-full flex-col items-start gap-2 rounded-control border border-dashed p-3 text-start motion-hover disabled:opacity-50 not-disabled:hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring "
    +(over?"border-primary bg-surface-hover":"border-line-primary bg-surface-subtle")}>
   {/* pe-8 keeps the title clear of the remove button in the top-end corner */}
   <span className="flex min-h-8 items-center gap-2 pe-8">
    <span className="flex size-8 shrink-0 items-center justify-center rounded-control bg-surface-hover text-fg-secondary"><Icon icon={INSERT_ICONS[slot.icon]} size={16} aria-hidden="true"/></span>
    <span className="type-label text-fg-primary">{slot.titleFa}</span>
   </span>
   <span id={"slot-hint-"+slot.id} className="flex items-start gap-1 type-caption text-fg-secondary"><Icon icon={UploadIcon} size={16} aria-hidden="true" className="mt-0.5 shrink-0"/>{SLOT_HINT_FA}</span>
  </button>
  <Button type="button" variant="ghost" size="icon" onClick={onRemove} aria-label={"حذف کارت "+slot.titleFa} className="absolute end-0 top-0">
   <Icon icon={X} aria-hidden="true"/>
  </Button>
 </li>;
}
