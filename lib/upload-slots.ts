/** Upload cards: picking a «+» entry adds an empty card inside the chat input, which then takes one file of that entry's kind and role. Pure; safe in the browser and on the server. */
import {MAX_ATTACHMENTS,TAG_WORD_FA,allocateTag,type AttachmentKind,type AttachmentRole,type TagCounters} from "./attachments";
import {fa} from "./format";
import type {InsertIconKey,InsertItem} from "./insert-menu";

/** What a file is for: its kind must match, and `role` (absent for documents and the automatic entry) is what the user chose. */
export type Upload={kind:"image"|"video"|"audio"|"file";role?:AttachmentRole};
/**
 * An empty card. `upload` undefined: the automatic entry (any supported file; Whoush infers the role). `tag` is reserved when the card is made (the automatic card
 * has none until its file arrives, since its kind is unknown), so the card can show `#تصویر-۱` before the upload; like any tag it is never reused.
 */
export type UploadSlot={id:string;titleFa:string;icon:InsertIconKey;upload?:Upload;tag?:string};
/** The category a card shows: its kind's icon and Persian word (تصویر، ویدیو، صدا، فایل), or «هر نوع فایل» for the automatic card. */
export type SlotCategory="image"|"video"|"audio"|"file"|"any";
export const slotCategory=(s:UploadSlot):SlotCategory=>s.upload?.kind??"any";
export const SLOT_CATEGORY_FA:Record<SlotCategory,string>={...TAG_WORD_FA,any:"هر نوع فایل"};
/** The attachment kind a card's tag is counted under (documents share the `file` prefix). */
const tagKind=(u:Upload):AttachmentKind=>u.kind==="file"?"pdf":u.kind;
/** Reserves the next tag of the card's kind. Undefined for the automatic card (no kind yet) or when the 99 numbers of that kind are used up. */
export function reserveSlotTag(counters:TagCounters,u:Upload|undefined):{tag:string;counters:TagCounters}|undefined{
 return u?allocateTag(counters,tagKind(u)):undefined;
}

export const UPLOAD_KIND_FA={image:"تصویر",video:"ویدیو",audio:"صدا",file:"سند (PDF، JSON یا Markdown)"} as const;
export const SLOT_DROP_FA="یا فایل رو اینجا رها کن";
export const SLOTS_FULL_FA="حداکثر "+fa(MAX_ATTACHMENTS)+" پیوست در هر پیام ممکن است.";

/** The Persian reason a file does not fit an upload, or undefined when it fits. */
export const uploadRejection=(u:Upload,kind:AttachmentKind)=>(u.kind==="file"?kind==="pdf"||kind==="json"||kind==="md":u.kind===kind)?undefined:"این گزینه فقط "+UPLOAD_KIND_FA[u.kind]+" می‌پذیرد.";

/** The card a menu entry adds; undefined for entries that do not upload (the saved-character dialog). */
export function slotFor(item:InsertItem,id:string):UploadSlot|undefined{
 const a=item.action;
 if(a.type==="characters")return undefined;
 const upload:Upload|undefined=a.type==="auto"?undefined:a.type==="file"?{kind:"file"}:{kind:a.kind,role:a.role};
 return {id,titleFa:item.titleFa,icon:item.icon,...(upload?{upload}:{})};
}
/** Adds a card when cards plus attached files stay within MAX_ATTACHMENTS; otherwise the list is unchanged and `full` is true. */
export function addSlot(slots:readonly UploadSlot[],slot:UploadSlot,attachmentCount:number):{slots:UploadSlot[];full:boolean}{
 if(slots.length+attachmentCount>=MAX_ATTACHMENTS)return {slots:[...slots],full:true};
 return {slots:[...slots,slot],full:false};
}
export const removeSlot=(slots:readonly UploadSlot[],id:string):UploadSlot[]=>slots.filter(s=>s.id!==id);
/** The accessible name of a card's upload button: «آپلود کاراکتر». */
export const slotLabelFa=(s:UploadSlot)=>"آپلود "+s.titleFa;
