"use client";
import {useState,type DragEvent} from "react";
import {AudioLines,FileText,Image as ImageIcon,Paperclip,Upload as UploadIcon,Video,X,type LucideIcon} from "lucide-react";
import {Button,Icon} from "@aleeforoughi/feather-react";
import {TagBadge} from "@/components/attachment-chip";
import {CARD_FOOT,CARD_FRAME,CARD_MEDIA,CARD_META} from "@/components/attachment-card";
import {SLOT_CATEGORY_FA,SLOT_DROP_FA,slotCategory,slotLabelFa,type SlotCategory,type UploadSlot} from "@/lib/upload-slots";

const hasFiles=(e:DragEvent)=>Array.from(e.dataTransfer.types).includes("Files");
/** The card shows its CATEGORY's icon (a کاراکتر card shows the image icon), so the kind of file it wants is clear at a glance; the role is the title. */
const CATEGORY_ICONS:Record<SlotCategory,LucideIcon>={image:ImageIcon,video:Video,audio:AudioLines,file:FileText,any:Paperclip};

/**
 * An empty upload card inside the chat input, the same size and layout as the file card that will replace it (`CARD_*` in `components/attachment-card.tsx`):
 * - media area: the icon-only upload button (neutral secondary fill with a solid 3:1 border; never the blue primary, which belongs to send), exactly where the thumbnail will be;
 * - meta row: the category icon and word and the tag the file will get (`#تصویر-۱`, reserved when the card was made);
 * - bottom row: the role name, muted, exactly where the role menu will be.
 * The frame is a washed-out empty state (transparent, faint dashed border) and the whole card is a drop zone. The upload button's accessible name is «آپلود <role>»
 * and the drop hint is its description (screen readers only; the dashed frame shows it visually). The remove button is a sibling of the upload button.
 */
export function UploadSlotCard({slot,disabled,onUpload,onDropFiles,onRemove}:{slot:UploadSlot;disabled?:boolean;onUpload:()=>void;onDropFiles:(files:File[])=>void;onRemove:()=>void}){
 const [over,setOver]=useState(false);
 const category=slotCategory(slot);
 const drop=(e:DragEvent)=>{if(!hasFiles(e))return;e.preventDefault();e.stopPropagation();setOver(false);const f=Array.from(e.dataTransfer.files);if(f.length)onDropFiles(f);};
 return <li className={CARD_FRAME+" border-dashed motion-hover "+(over?"border-primary bg-surface-hover":"border-line-secondary bg-transparent")}
  onDragEnter={e=>{if(hasFiles(e)){e.preventDefault();e.stopPropagation();setOver(true);}}}
  onDragOver={e=>{if(hasFiles(e)){e.preventDefault();e.stopPropagation();}}}
  onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node|null))setOver(false);}}
  onDrop={drop}>
  <Button type="button" variant="secondary" data-slot-id={slot.id} onClick={onUpload} disabled={disabled} aria-label={slotLabelFa(slot)} aria-describedby={"slot-hint-"+slot.id}
   className={CARD_MEDIA+" h-auto border-line-primary p-0"}>
   <Icon icon={UploadIcon} size={24} aria-hidden="true"/>
  </Button>
  <span id={"slot-hint-"+slot.id} className="sr-only">{SLOT_DROP_FA}</span>
  <Button type="button" variant="secondary" size="icon" onClick={onRemove} aria-label={"حذف کارت "+slot.titleFa} className="absolute end-3 top-3">
   <Icon icon={X} aria-hidden="true"/>
  </Button>
  <span className={CARD_META+" text-fg-secondary"}>
   <Icon icon={CATEGORY_ICONS[category]} size={16} aria-hidden="true" className="shrink-0"/>
   <span className="min-w-0 flex-1 truncate type-caption">{SLOT_CATEGORY_FA[category]}</span>
   {slot.tag&&<TagBadge tag={slot.tag}/>}
  </span>
  <span className={CARD_FOOT+" text-fg-secondary"}><span className="truncate">{slot.titleFa}</span></span>
 </li>;
}
