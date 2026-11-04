/** The «+» insert menu as pure data: what each entry does and where its title and hint come from. Safe in the browser and on the server. */
import {ATTACHMENT_ROLES,FILE_MENU_FA,roleLabelFa,type AttachmentKind,type AttachmentRole} from "./attachments";
import type {GenerationStyle} from "./creative-plan";

export type InsertIconKey="auto"|"character"|"characters"|"start_frame"|"end_frame"|"environment"|"object"|"outfit"|"hairstyle"|"makeup"|"graphic"|"edit_image"|"motion"|"edit_video"|"continue"|"speech"|"music"|"document"|"style_realistic"|"style_three_d"|"style_cartoon";
/** `auto`: any file, no role (Whoush infers it). `role`: a file picker restricted to `kind`, the file gets `role` with `roleSource: "user"`. `file`: documents. `characters`: the saved-character dialog. */
export type InsertAction=
 |{type:"auto"}
 |{type:"role";kind:"image"|"video"|"audio";role:AttachmentRole}
 |{type:"file"}
 |{type:"characters"}
 /** Not an upload: sets the visual style of the current message (single choice). */
 |{type:"style";style:GenerationStyle};
export type InsertItem={id:string;titleFa:string;hintFa:string;icon:InsertIconKey;action:InsertAction};
export type InsertGroup={id:"auto"|"image"|"video"|"audio"|"file"|"style";/** False for the style group: its entries pick a setting and never open a file picker. */upload:boolean;/** The group heading; the top item has none. */labelFa?:string;items:readonly InsertItem[]};

export const AUTO_UPLOAD_FA={titleFa:"آپلود با نقش خودکار",hintFa:"هر فایلی؛ نقش را هووش انتخاب می‌کند"} as const;
export const MY_CHARACTERS_FA={titleFa:"کاراکترهای من",hintFa:"انتخاب از استودیوی کاراکتر"} as const;
const ROLE_ICON:Record<string,InsertIconKey>={
 "image:character":"character","image:start_frame":"start_frame","image:end_frame":"end_frame","image:environment":"environment","image:object":"object","image:outfit":"outfit","image:hairstyle":"hairstyle","image:makeup":"makeup","image:graphic":"graphic","image:edit_reference":"edit_image",
 "video:motion_reference":"motion","video:edit_reference":"edit_video","video:continue":"continue","audio:lip_sync":"speech","audio:music":"music"
};
/** The «سبک» entries: one style per message. Titles equal `STYLE_LABEL_FA` in lib/creative-plan.ts (tested). */
export const STYLE_ITEMS:readonly InsertItem[]=[
 {id:"style:realistic",titleFa:"واقع‌گرایانه",hintFa:"مثل عکس واقعی، بافت و نور طبیعی",icon:"style_realistic",action:{type:"style",style:"realistic"}},
 {id:"style:three_d",titleFa:"سه‌بعدی",hintFa:"رندر سه‌بعدی تمیز",icon:"style_three_d",action:{type:"style",style:"three_d"}},
 {id:"style:cartoon",titleFa:"کارتونی",hintFa:"کارتونی و رنگی",icon:"style_cartoon",action:{type:"style",style:"cartoon"}}
];
const roleItems=(kind:"image"|"video"|"audio"):InsertItem[]=>ATTACHMENT_ROLES[kind].map(r=>({id:kind+":"+r.id,titleFa:roleLabelFa(r.id,kind),hintFa:r.hintFa,icon:ROLE_ICON[kind+":"+r.id],action:{type:"role",kind,role:r.id}}));
const imageItems=roleItems("image"),characterAt=imageItems.findIndex(i=>i.id==="image:character");
export const INSERT_MENU:readonly InsertGroup[]=[
 {id:"auto",upload:true,items:[{id:"auto",...AUTO_UPLOAD_FA,icon:"auto",action:{type:"auto"}}]},
 // «کاراکترهای من» comes right after کاراکتر
 {id:"image",upload:true,labelFa:"تصویر",items:[...imageItems.slice(0,characterAt+1),{id:"characters",...MY_CHARACTERS_FA,icon:"characters",action:{type:"characters"}},...imageItems.slice(characterAt+1)]},
 {id:"video",upload:true,labelFa:"ویدیو",items:roleItems("video")},
 {id:"audio",upload:true,labelFa:"صدا",items:roleItems("audio")},
 {id:"file",upload:true,labelFa:"فایل",items:[{id:"file",titleFa:FILE_MENU_FA.labelFa,hintFa:FILE_MENU_FA.hintFa,icon:"document",action:{type:"file"}}]},
 {id:"style",upload:false,labelFa:"سبک",items:STYLE_ITEMS}
];
/** Every (kind, role) pair the menu uploads with, in menu order. */
export const menuRoles=():{kind:AttachmentKind;role:AttachmentRole}[]=>INSERT_MENU.flatMap(g=>g.items.flatMap(i=>i.action.type==="role"?[{kind:i.action.kind,role:i.action.role}]:[]));
