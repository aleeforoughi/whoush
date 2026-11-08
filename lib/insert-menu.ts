/** The «+» insert menu as pure data: what each entry does and where its title and hint come from. Safe in the browser and on the server. */
import {ATTACHMENT_ROLES,FILE_MENU_FA,roleLabelFa,type AttachmentKind,type AttachmentRole} from "./attachments";

export type InsertIconKey="auto"|"reference_image"|"reference_video"|"frame"|"character"|"characters"|"start_frame"|"end_frame"|"environment"|"object"|"outfit"|"hairstyle"|"makeup"|"graphic"|"edit_image"|"motion"|"edit_video"|"continue"|"continue_back"|"speech"|"music"|"document";
/** `auto`: any file, no role (Whoush infers it). `role`: a file picker restricted to `kind`, the file gets `role` with `roleSource: "user"`. `file`: documents. `characters`: the saved-character dialog. */
export type InsertAction=
 |{type:"auto"}
 |{type:"role";kind:"image"|"video"|"audio";role:AttachmentRole}
 |{type:"file"}
 |{type:"characters"};
export type InsertItem={id:string;titleFa:string;hintFa:string;icon:InsertIconKey;action:InsertAction};
export type InsertGroup={id:"popular"|"references"|"image"|"video"|"audio";/** True for «پرکاربردترین»: shortcuts that repeat entries of the kind groups below. */featured?:true;labelFa:string;items:readonly InsertItem[]};

export const AUTO_UPLOAD_FA={titleFa:"رفرنس اتوماتیک",hintFa:"هر عکس، ویدیو یا صدایی؛ هووش خودش می‌فهمه برای چیه"} as const;
export const MY_CHARACTERS_FA={titleFa:"کاراکتر",hintFa:"یکی از کاراکترهایی که توی استودیوی کاراکتر ساختی"} as const;
const ROLE_ICON:Record<string,InsertIconKey>={
 "image:reference":"reference_image","image:frame":"frame","video:reference":"reference_video",
 "image:character":"character","image:start_frame":"start_frame","image:end_frame":"end_frame","image:environment":"environment","image:object":"object","image:outfit":"outfit","image:hairstyle":"hairstyle","image:makeup":"makeup","image:graphic":"graphic","image:edit_reference":"edit_image",
 "video:motion_reference":"motion","video:edit_reference":"edit_video","video:continue":"continue","video:extend_back":"continue_back","audio:lip_sync":"speech","audio:music":"music"
};
const roleItems=(kind:"image"|"video"|"audio"):InsertItem[]=>ATTACHMENT_ROLES[kind].map(r=>({id:kind+":"+r.id,titleFa:roleLabelFa(r.id,kind),hintFa:r.hintFa,icon:ROLE_ICON[kind+":"+r.id],action:{type:"role",kind,role:r.id}}));
const imageItems=roleItems("image"),characterAt=imageItems.findIndex(i=>i.id==="image:character");
/** «پرکاربردترین»: the most used entries, shown first so they need no scrolling; each also stays in its own group. */
export const POPULAR_IDS=["image:reference","image:character","image:frame","image:outfit","audio:lip_sync"] as const;
/** «ادیت عکس» and «ادیت ویدیو» (owner, 2026-11-08: back in the menu): the file is the one to edit. */
const editItem=(kind:"image"|"video"):InsertItem=>({id:kind+":edit_reference",titleFa:roleLabelFa("edit_reference",kind),hintFa:kind==="image"?"همین عکس رو بفرست؛ فقط چیزی که می‌گی عوض می‌شه":"همین ویدیو رو بفرست؛ فقط چیزی که می‌گی عوض می‌شه",icon:kind==="image"?"edit_image":"edit_video",action:{type:"role",kind,role:"edit_reference"}});
const byId=new Map([...imageItems,...roleItems("video"),...roleItems("audio"),editItem("image"),editItem("video")].map(i=>[i.id,i]));
const item=(id:string)=>byId.get(id)!;
/** «امتداد ویدیو به جلو» / «از عقب» (owner, 2026-11-08). */
const extendItem=(role:"continue"|"extend_back"):InsertItem=>({id:"video:"+role,titleFa:roleLabelFa(role,"video"),hintFa:role==="continue"?"ویدیو از آخرین فریمش ادامه پیدا می‌کنه":"یه تکه‌ی تازه قبل از شروع همین ویدیو ساخته می‌شه",icon:role==="continue"?"continue":"continue_back",action:{type:"role",kind:"video",role}});
const FILE_ITEM:InsertItem={id:"file",titleFa:FILE_MENU_FA.labelFa,hintFa:FILE_MENU_FA.hintFa,icon:"document",action:{type:"file"}};
/**
 * The menu in the owner's order (2026-11-08), four groups set apart by a line: references (automatic, photo, video, file); photo roles (edit, person,
 * the saved characters, hair and makeup, outfit, setting, objects and products, graphic, frame); video roles (edit, motion); audio roles (speech, music).
 */
export const INSERT_MENU:readonly InsertGroup[]=[
 {id:"popular",featured:true,labelFa:"پرکاربردترین",items:[{id:"popular:auto",...AUTO_UPLOAD_FA,icon:"auto",action:{type:"auto"}},...POPULAR_IDS.map(id=>({...byId.get(id)!,id:"popular:"+id}))]},
 {id:"references",labelFa:"رفرنس",items:[{id:"auto",...AUTO_UPLOAD_FA,icon:"auto",action:{type:"auto"}},item("image:reference"),item("video:reference"),FILE_ITEM]},
 // The saved characters («کاراکتر») come right after the character role («شخص»).
 {id:"image",labelFa:"تصویر",items:[item("image:edit_reference"),...imageItems.slice(1,characterAt+1),{id:"characters",...MY_CHARACTERS_FA,icon:"characters",action:{type:"characters"}},...imageItems.slice(characterAt+1)]},
 {id:"video",labelFa:"ویدیو",items:[item("video:edit_reference"),item("video:motion_reference"),extendItem("continue"),extendItem("extend_back")]},
 {id:"audio",labelFa:"صدا",items:roleItems("audio")}
];
/** Every (kind, role) pair the menu uploads with, in menu order (the «پرکاربردترین» shortcuts are not counted twice). */
export const menuRoles=():{kind:AttachmentKind;role:AttachmentRole}[]=>INSERT_MENU.filter(g=>!g.featured).flatMap(g=>g.items.flatMap(i=>i.action.type==="role"?[{kind:i.action.kind,role:i.action.role}]:[]));

/** «پرکاربردترین» is hidden for now (owner, 2026-11-05). Flip to bring it back; `INSERT_MENU` keeps the full definition. */
export const SHOW_POPULAR=false;
/** The automatic upload entry, kept at the top of the menu (with no group label) while «پرکاربردترین» is hidden: it is the only way to upload without choosing a role. */
export const AUTO_ITEM:InsertItem={id:"auto",...AUTO_UPLOAD_FA,icon:"auto",action:{type:"auto"}};
/** One section of the visible menu. `labelFa` names it for search and screen readers; `heading` shows it, otherwise a line sets the section apart. */
export type MenuSection={id:string;labelFa?:string;heading?:boolean;items:readonly InsertItem[]};
/** What the «+» menu shows: the four groups set apart by lines (owner, 2026-11-08), with «پرکاربردترین» and headings when it is enabled. */
export function visibleInsertMenu(showPopular:boolean=SHOW_POPULAR):MenuSection[]{
 return INSERT_MENU.filter(g=>showPopular||!g.featured).map(g=>({id:g.id,labelFa:g.labelFa,items:g.items,...(showPopular?{heading:true}:{})}));
}
/**
 * Search folding: lower case, Arabic ي/ك/ة to Persian, ئ/ؤ/أ/إ/آ variants, ZWNJ and tatweel and diacritics removed, Persian/Arabic digits to ASCII, spaces collapsed.
 * So «ویدئو», «ويديو» and «ویدیو» match each other, and «لباس‌وکفش» matches «لباس و کفش» once spaces are ignored.
 */
export function foldSearch(s:string):string{
 return s.toLowerCase().normalize("NFC")
  .replace(/[ً-ْٰـ]/g,"").replace(/‌/g,"")
  .replace(/ي|ى/g,"ی").replace(/ك/g,"ک").replace(/ة/g,"ه").replace(/[أإآ]/g,"ا").replace(/ؤ/g,"و").replace(/ئ/g,"ی")
  .replace(/[۰-۹]/g,d=>String(d.charCodeAt(0)-0x06f0)).replace(/[٠-٩]/g,d=>String(d.charCodeAt(0)-0x0660))
  .replace(/\s+/g," ").trim();
}
/**
 * Filters the menu as the user types: an entry stays when every word of the query appears in its title, its hint or its group's label (so «ویدیو» lists every video
 * entry). Sections with no remaining entry are dropped. An empty query returns the menu unchanged.
 */
export function filterInsertMenu(sections:readonly MenuSection[],query:string):MenuSection[]{
 const words=foldSearch(query).split(" ").filter(Boolean);
 if(!words.length)return sections.map(s=>({...s}));
 const squash=(s:string)=>s.replace(/ /g,"");
 const has=(text:string)=>{const hay=foldSearch(text);return words.every(w=>hay.includes(w)||squash(hay).includes(squash(w)));};
 // Entries whose title matches come first, and the sections that have one (a hint like «مشخص» must not put its entry above «شخص»).
 const out=sections.map(s=>{const items=s.items.filter(i=>has([i.titleFa,i.hintFa,s.labelFa??""].join(" ")));const byTitle=items.filter(i=>has(i.titleFa));
  return {...s,items:[...byTitle,...items.filter(i=>!byTitle.includes(i))],titled:byTitle.length>0};}).filter(s=>s.items.length>0);
 return [...out.filter(s=>s.titled),...out.filter(s=>!s.titled)].map(({titled:_t,...s})=>s);
}
/** The icon of a role, as in the «+» menu (`auto` for no role, `document` for documents), so a card shows the same icon as the entry that made it. */
export function roleIconKey(kind:AttachmentKind,role?:AttachmentRole):InsertIconKey{
 if(kind==="pdf"||kind==="json"||kind==="md")return "document";
 return (role&&ROLE_ICON[kind+":"+role])||"auto";
}
