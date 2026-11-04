/** Upload cards: picking a «+» entry adds an empty card inside the chat input, which then takes one file of that entry's kind and role. Pure; safe in the browser and on the server. */
import {MAX_ATTACHMENTS,type AttachmentKind,type AttachmentRole} from "./attachments";
import {fa} from "./format";
import type {InsertIconKey,InsertItem} from "./insert-menu";

/** What a file is for: its kind must match, and `role` (absent for documents and the automatic entry) is what the user chose. */
export type Upload={kind:"image"|"video"|"audio"|"file";role?:AttachmentRole};
/** An empty card. `upload` undefined: the automatic entry (any supported file; Whoush infers the role). */
export type UploadSlot={id:string;titleFa:string;icon:InsertIconKey;upload?:Upload};

export const UPLOAD_KIND_FA={image:"تصویر",video:"ویدیو",audio:"صدا",file:"سند (PDF، JSON یا Markdown)"} as const;
export const SLOT_HINT_FA="برای آپلود بزن یا فایل رو اینجا رها کن";
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
