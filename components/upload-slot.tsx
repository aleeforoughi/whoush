"use client";
import {useState,type DragEvent} from "react";
import {AudioLines,FileText,Image as ImageIcon,Paperclip,Upload as UploadIcon,Video,type LucideIcon} from "lucide-react";
import {Button,Icon} from "@aleeforoughi/feather-react";
import {TagBadge} from "@/components/attachment-chip";
import {CARD_FRAME,CARD_MEDIA,CARD_META,CardRoleRow} from "@/components/attachment-card";
import {SLOT_CATEGORY_FA,SLOT_DROP_FA,slotCategory,slotLabelFa,type SlotCategory,type UploadSlot} from "@/lib/upload-slots";

/** The small category icon in the top start corner (top right in RTL) of the upload button. */
const CATEGORY_ICONS:Record<SlotCategory,LucideIcon>={image:ImageIcon,video:Video,audio:AudioLines,file:FileText,any:Paperclip};

const hasFiles=(e:DragEvent)=>Array.from(e.dataTransfer.types).includes("Files");

/**
 * An empty upload card inside the chat input, the same size and layout as the file card that will replace it (`CARD_*` in `components/attachment-card.tsx`):
 * - media area: the upload button (neutral secondary fill with a solid 3:1 border; never the blue primary, which belongs to send) with the upload icon, the category
 *   name under it (تصویر، ویدیو، صدا، فایل، هر نوع فایل) and a small category icon in the top start corner (top right in RTL), exactly where the thumbnail will be;
 * - tag row: the tag the file will get (`#تصویر-۱`, reserved when the card was made);
 * - role row: the role's icon and name, muted, and the small delete button, exactly where they stay after the upload.
 * The frame is a washed-out empty state (transparent, faint dashed border) and the whole card is a drop zone. The upload button's accessible name is «آپلود <role>»,
 * with the drop hint as its description for screen readers.
 */
export function UploadSlotCard({slot,disabled,onUpload,onDropFiles,onRemove}:{slot:UploadSlot;disabled?:boolean;onUpload:()=>void;onDropFiles:(files:File[])=>void;onRemove:()=>void}){
 const [over,setOver]=useState(false);
 const drop=(e:DragEvent)=>{if(!hasFiles(e))return;e.preventDefault();e.stopPropagation();setOver(false);const f=Array.from(e.dataTransfer.files);if(f.length)onDropFiles(f);};
 return <li className={CARD_FRAME+" border-dashed motion-hover "+(over?"border-primary bg-surface-hover":"border-line-secondary bg-transparent")}
  onDragEnter={e=>{if(hasFiles(e)){e.preventDefault();e.stopPropagation();setOver(true);}}}
  onDragOver={e=>{if(hasFiles(e)){e.preventDefault();e.stopPropagation();}}}
  onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node|null))setOver(false);}}
  onDrop={drop}>
  <Button type="button" variant="secondary" data-slot-id={slot.id} onClick={onUpload} disabled={disabled} aria-label={slotLabelFa(slot)} aria-describedby={"slot-hint-"+slot.id}
   className={CARD_MEDIA+" h-auto flex-col gap-1 border-line-primary p-0"}>
   {/* the category icon sits in the top start corner (top right in RTL) */}
   <Icon icon={CATEGORY_ICONS[slotCategory(slot)]} size={16} aria-hidden="true" className="absolute start-2 top-2"/>
   <Icon icon={UploadIcon} size={24} aria-hidden="true"/>
   <span className="type-caption" aria-hidden="true">{SLOT_CATEGORY_FA[slotCategory(slot)]}</span>
  </Button>
  <span id={"slot-hint-"+slot.id} className="sr-only">{SLOT_DROP_FA}</span>
  <span className={CARD_META}>{slot.tag&&<TagBadge tag={slot.tag}/>}</span>
  <CardRoleRow icon={slot.icon} label={slot.titleFa} muted remove={{label:"حذف کارت "+slot.titleFa,onClick:onRemove}}/>
 </li>;
}
