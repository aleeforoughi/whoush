/** Reference slot cards under the composer: which files a card takes, which roles it offers, and how its title follows the role. Pure; safe in the browser. */
import {faPlain} from "./format";
import {rolesFor,withRole,type AttachmentKind,type AttachmentRole,type LocalAttachment} from "./attachments";

export type SlotId="character"|"location"|"audio"|"motion";
export const SLOT_IDS=["character","location","audio","motion"] as const satisfies readonly SlotId[];
/** What a card is chosen with: a role of its kind, or `auto` (no role, so Whoush infers it from the brief). */
export type SlotChoice=AttachmentRole|"auto";
export const SLOT_KIND:Record<SlotId,AttachmentKind>={character:"image",location:"image",audio:"audio",motion:"video"};
/** The role a card starts with; the user may change it before or after uploading. */
export const SLOT_DEFAULT_ROLE:Record<SlotId,AttachmentRole>={character:"character",location:"environment",audio:"lip_sync",motion:"motion_reference"};
/** Files a card takes: the character card up to two photos, the others one. */
export const SLOT_MAX_FILES:Record<SlotId,number>={character:2,location:1,audio:1,motion:1};
export const SLOT_BASE={
 character:{title:"کاراکتر",hint:"از استودیوی کاراکتر یا تا ۲ عکس"},
 location:{title:"محیط",hint:"عکس لوکیشن یا پس‌زمینه"},
 audio:{title:"صدا",hint:"گفتار برای حرکت لب یا موسیقی"},
 motion:{title:"الگوی حرکت",hint:"ویدیو برای الگوبرداری حرکت"}
} as const satisfies Record<SlotId,{title:string;hint:string}>;
export const UPLOAD_LABEL_FA={image:"آپلود عکس",audio:"آپلود صدا",video:"آپلود ویدیو"} as const;
const KIND_NOUN_FA={image:"عکس",audio:"صدا",video:"ویدیو"} as const;

export const slotAccepts=(slot:SlotId,kind:AttachmentKind)=>SLOT_KIND[slot]===kind;
/** The roles a card offers: exactly the roles the role table has for the card's kind. `voice_clone` appears only on the audio card, and it is never `general`. */
export const rolesForSlot=(slot:SlotId)=>rolesFor(SLOT_KIND[slot]);
export const defaultRoleForSlot=(slot:SlotId):SlotChoice=>SLOT_DEFAULT_ROLE[slot];
export const slotCanAdd=(slot:SlotId,filled:number)=>filled<SLOT_MAX_FILES[slot];
/** The Persian reason a file cannot go into this card, or undefined when it fits. `filled` is how many files the card already holds. */
export function slotRejection(slot:SlotId,kind:AttachmentKind,filled:number):string|undefined{
 if(!slotAccepts(slot,kind)){const k=SLOT_KIND[slot];return "این کارت فقط "+KIND_NOUN_FA[k as "image"|"audio"|"video"]+" می‌پذیرد";}
 if(!slotCanAdd(slot,filled))return SLOT_MAX_FILES[slot]>1?"این کارت حداکثر "+faPlain(SLOT_MAX_FILES[slot])+" "+KIND_NOUN_FA.image+" می‌پذیرد":"این کارت فقط یک فایل می‌پذیرد؛ اول فایل قبلی را بردار";
 return undefined;
}
/** The file as the card stores it: the card's role (unless `auto`) with `consent` for voice_clone, and the card it belongs to. The wire carries a role only when the user chose one, so it is always `roleSource: "user"` server-side. */
export function applySlotPreset(a:LocalAttachment,slot:SlotId,choice:SlotChoice,consent=false):LocalAttachment{
 const next=choice==="auto"?{...a}:withRole(a,choice);
 if(next.role==="voice_clone"&&consent)next.consent=true;
 return {...next,slot};
}

export type SlotIconKey="character"|"environment"|"object"|"graphic"|"edit"|"motion"|"speech"|"music"|"voice"|"auto";
const ROLE_LOOK:Record<string,{hint:string;icon:SlotIconKey}>={
 character:{hint:"عکس چهره یا شخصیت",icon:"character"},
 environment:{hint:"عکس لوکیشن یا پس‌زمینه",icon:"environment"},
 object:{hint:"عکس محصول یا شیء",icon:"object"},
 graphic:{hint:"لوگو، پوستر یا طرح گرافیکی",icon:"graphic"},
 edit_reference:{hint:"عکسی که می‌خواهی ویرایش شود",icon:"edit"},
 motion_reference:{hint:"ویدیو برای الگوبرداری حرکت",icon:"motion"},
 lip_sync:{hint:"گفتار برای حرکت لب",icon:"speech"},
 music:{hint:"موسیقی یا ریتم مرجع",icon:"music"},
 voice_clone:{hint:"صدای خودت، با تأیید مالکیت",icon:"voice"}
};
const AUTO_HINT="هووش نقش را انتخاب می‌کند";
/** Title, hint and icon of a card for its current role. A card at its default role keeps its own title and hint; any other role changes them (location + مرجع ادیت reads «مرجع ادیت», «عکسی که می‌خواهی ویرایش شود»). */
export function slotLook(slot:SlotId,choice:SlotChoice,roleLabel:(r:AttachmentRole)=>string):{title:string;hint:string;icon:SlotIconKey}{
 if(choice==="auto")return {title:SLOT_BASE[slot].title,hint:AUTO_HINT,icon:"auto"};
 const look=ROLE_LOOK[choice]??{hint:SLOT_BASE[slot].hint,icon:"auto" as const};
 if(choice===SLOT_DEFAULT_ROLE[slot])return {title:SLOT_BASE[slot].title,hint:SLOT_BASE[slot].hint,icon:look.icon};
 // a video edit reference is a video, not a photo
 const hint=choice==="edit_reference"&&SLOT_KIND[slot]==="video"?"ویدیویی که می‌خواهی ویرایش شود":look.hint;
 return {title:roleLabel(choice),hint,icon:look.icon};
}
