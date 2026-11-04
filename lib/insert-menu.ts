/** The «+» insert menu as pure data: what each entry does and where its title and hint come from. Safe in the browser and on the server. */
import {ATTACHMENT_ROLES,FILE_MENU_FA,roleLabelFa,type AttachmentKind,type AttachmentRole} from "./attachments";

export type InsertIconKey="auto"|"character"|"characters"|"start_frame"|"end_frame"|"environment"|"object"|"outfit"|"hairstyle"|"makeup"|"graphic"|"edit_image"|"motion"|"edit_video"|"continue"|"speech"|"music"|"document";
/** `auto`: any file, no role (Whoush infers it). `role`: a file picker restricted to `kind`, the file gets `role` with `roleSource: "user"`. `file`: documents. `characters`: the saved-character dialog. */
export type InsertAction=
 |{type:"auto"}
 |{type:"role";kind:"image"|"video"|"audio";role:AttachmentRole}
 |{type:"file"}
 |{type:"characters"};
export type InsertItem={id:string;titleFa:string;hintFa:string;icon:InsertIconKey;action:InsertAction};
export type InsertGroup={id:"popular"|"image"|"video"|"audio"|"file";/** True for «پرکاربردترین»: shortcuts that repeat entries of the kind groups below. */featured?:true;labelFa:string;items:readonly InsertItem[]};

export const AUTO_UPLOAD_FA={titleFa:"آپلود با نقش خودکار",hintFa:"هر فایلی؛ نقش را هووش انتخاب می‌کند"} as const;
export const MY_CHARACTERS_FA={titleFa:"کاراکترهای من",hintFa:"انتخاب از استودیوی کاراکتر"} as const;
const ROLE_ICON:Record<string,InsertIconKey>={
 "image:character":"character","image:start_frame":"start_frame","image:end_frame":"end_frame","image:environment":"environment","image:object":"object","image:outfit":"outfit","image:hairstyle":"hairstyle","image:makeup":"makeup","image:graphic":"graphic","image:edit_reference":"edit_image",
 "video:motion_reference":"motion","video:edit_reference":"edit_video","video:continue":"continue","audio:lip_sync":"speech","audio:music":"music"
};
const roleItems=(kind:"image"|"video"|"audio"):InsertItem[]=>ATTACHMENT_ROLES[kind].map(r=>({id:kind+":"+r.id,titleFa:roleLabelFa(r.id,kind),hintFa:r.hintFa,icon:ROLE_ICON[kind+":"+r.id],action:{type:"role",kind,role:r.id}}));
const imageItems=roleItems("image"),characterAt=imageItems.findIndex(i=>i.id==="image:character");
/** «پرکاربردترین»: the most used entries, shown first so they need no scrolling; each also stays in its own group. */
export const POPULAR_IDS=["image:character","image:start_frame","image:edit_reference","image:outfit","audio:lip_sync"] as const;
const byId=new Map([...imageItems,...roleItems("video"),...roleItems("audio")].map(i=>[i.id,i]));
export const INSERT_MENU:readonly InsertGroup[]=[
 {id:"popular",featured:true,labelFa:"پرکاربردترین",items:[{id:"auto",...AUTO_UPLOAD_FA,icon:"auto",action:{type:"auto"}},...POPULAR_IDS.map(id=>({...byId.get(id)!,id:"popular:"+id}))]},
 // «کاراکترهای من» comes right after کاراکتر
 {id:"image",labelFa:"تصویر",items:[...imageItems.slice(0,characterAt+1),{id:"characters",...MY_CHARACTERS_FA,icon:"characters",action:{type:"characters"}},...imageItems.slice(characterAt+1)]},
 {id:"video",labelFa:"ویدیو",items:roleItems("video")},
 {id:"audio",labelFa:"صدا",items:roleItems("audio")},
 {id:"file",labelFa:"فایل",items:[{id:"file",titleFa:FILE_MENU_FA.labelFa,hintFa:FILE_MENU_FA.hintFa,icon:"document",action:{type:"file"}}]}
];
/** Every (kind, role) pair the menu uploads with, in menu order (the «پرکاربردترین» shortcuts are not counted twice). */
export const menuRoles=():{kind:AttachmentKind;role:AttachmentRole}[]=>INSERT_MENU.filter(g=>!g.featured).flatMap(g=>g.items.flatMap(i=>i.action.type==="role"?[{kind:i.action.kind,role:i.action.role}]:[]));
