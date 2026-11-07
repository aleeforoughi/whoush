"use client";
import {useState} from "react";
import {Brush,Download,Instagram,Share2,type LucideIcon} from "lucide-react";
import {Icon} from "@aleeforoughi/feather-react";
import {BRUSH_EDIT_FA} from "@/lib/region-edit";
import {shareableFile,triggerDownload,type ShareFile} from "@/components/share-actions";

/** One small action on a picture: icon and label, 4px corners, a see-through background (the same look for every action in the stack). */
function ActionChip({icon,label,aria,onClick}:{icon:LucideIcon;label:string;aria:string;onClick:()=>void}){
 return <button type="button" onClick={e=>{e.stopPropagation();onClick();}} aria-label={aria}
  className="flex h-7 items-center gap-1 rounded-[4px] bg-background/85 ps-1.5 pe-2 type-caption font-medium text-fg-primary shadow-sm backdrop-blur-sm hover:bg-background focus-visible:outline-2 focus-visible:outline-ring">
  {/* In RTL the first child sits on the right: the icon, then the label on its left. */}
  <Icon icon={icon} size={16} aria-hidden="true"/><span aria-hidden="true">{label}</span>
 </button>;
}
const STACK="absolute start-1.5 top-1.5 z-10 flex flex-col items-stretch gap-1 opacity-0 motion-hover group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100";
/** On a computer: the stack over the picture, on hover. On a phone (no hover): a small row under the picture, outside it. */
const OVER="absolute start-1.5 top-1.5 z-10 flex flex-col items-stretch gap-1 opacity-0 motion-hover group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:hidden";
const UNDER="mt-1.5 hidden flex-wrap items-center gap-1 [@media(hover:none)]:flex";

/**
 * The «ادیت» button on a picture (owner, 2026-11-06): small, 4px corners, at the top right (the start side in Persian RTL), the icon with its label «ادیت»
 * on its left. It appears on hover on a computer and is always visible on a phone (no hover there). The parent is `relative group`.
 */
export function EditImageButton({label,onClick}:{label:string;onClick:()=>void}){
 return <div className={STACK}><ActionChip icon={Brush} label={BRUSH_EDIT_FA} aria={BRUSH_EDIT_FA+" "+label} onClick={onClick}/></div>;
}

/**
 * The action stack on a generated picture (owner, 2026-11-06): «ادیت», «دانلود», «اشتراک» and «اینستاگرام», stacked vertically at the top right in one style,
 * on hover; on a phone a small row under the picture, outside it. A generated file lives at a URL: its bytes are fetched when an action needs them. Instagram opens the device's share
 * sheet (where Instagram appears when installed), or downloads the file to post from the gallery. The parent is `relative group`.
 */
export function ImageActionStack({label,onEdit,file,url,under=false}:{label:string;onEdit?:()=>void;file:Omit<ShareFile,"blob">;url:string;
 /** The phone row, placed after the picture (the computer stack is placed before it, over the picture). */under?:boolean}){
 const [blob,setBlob]=useState<Blob>();
 const get=async():Promise<ShareFile|undefined>=>{
  if(blob)return {...file,blob};
  try{const b=await fetch(url).then(r=>r.ok?r.blob():undefined);if(!b)return undefined;setBlob(b);return {...file,blob:b};}catch{return undefined;}
 };
 const share=async()=>{
  const f=await get();if(!f)return;
  const sf=shareableFile(f);
  if(sf){try{await navigator.share({files:[sf],title:"هووش"});}catch{/* closed or refused */}return;}
  triggerDownload(f);
 };
 return <div className={under?UNDER:OVER}>
  {onEdit&&<ActionChip icon={Brush} label={BRUSH_EDIT_FA} aria={BRUSH_EDIT_FA+" "+label} onClick={onEdit}/>}
  <ActionChip icon={Download} label="دانلود" aria={"دانلود "+label} onClick={()=>void get().then(f=>f&&triggerDownload(f))}/>
  <ActionChip icon={Share2} label="اشتراک" aria={"اشتراک‌گذاری "+label} onClick={()=>void share()}/>
  {/* Instagram is a phone app: offered on phones only (owner, 2026-11-06). */}
  {under&&<ActionChip icon={Instagram} label="اینستاگرام" aria={"اشتراک‌گذاری در اینستاگرام "+label} onClick={()=>void share()}/>}
 </div>;
}

/** Downloads a generated file by its URL (fetched when asked). */
export async function downloadFromUrl(url:string,file:Omit<ShareFile,"blob">){
 try{const b=await fetch(url).then(r=>r.ok?r.blob():undefined);if(b)triggerDownload({...file,blob:b});}catch{/* nothing to save */}
}
