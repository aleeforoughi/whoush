"use client";
import {useId,useState,type ReactNode} from "react";
import {Check,CircleFadingPlus,Clapperboard,Copy,Download,ExternalLink,Image as ImageIcon,Instagram,Share2} from "lucide-react";
import {Badge,Button,Dialog,DialogBody,DialogClose,DialogContent,DialogDescription,DialogFooter,DialogHeader,DialogTitle,Icon,Label,Textarea} from "@aleeforoughi/feather-react";
import {displayTag,type AttachmentKind} from "@/lib/attachments";
import {FIT_CROP_FA,FIT_GOOD_FA,INSTAGRAM_NOT_DIRECT_FA,INSTAGRAM_URL,SHARE_TARGETS,downloadFileName,fitsTarget,instagramFit,type ShareTarget} from "@/lib/share";

/** What a share needs to know about a file. `name` is private: it stays here and the download uses `downloadFileName`. */
export type ShareFile={blob?:Blob;name:string;mime:string;kind:AttachmentKind;tag:string;width?:number;height?:number;durationSeconds?:number;projectTitle?:string};
export const MISSING_FILE_FA="فایل در این مرورگر موجود نیست";
const TARGET_ICONS:Record<ShareTarget,typeof Share2>={story:CircleFadingPlus,post:ImageIcon,reel:Clapperboard};
const GENERIC_STEPS=["فایل را دانلود کن","اینستاگرام را باز کن و + را بزن","پست، ریلز یا استوری را انتخاب کن و فایل را از گالری بردار"];

const fileName=(f:ShareFile)=>downloadFileName({projectTitle:f.projectTitle,tag:f.tag,mime:f.mime});
export function triggerDownload(f:ShareFile){
 if(!f.blob)return;
 const url=URL.createObjectURL(f.blob),a=document.createElement("a");
 a.href=url;a.download=fileName(f);a.rel="noopener";a.hidden=true;
 document.body.appendChild(a);a.click();a.remove();
 window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
/** The device's own share sheet with the file, if this browser can share files at all (never on most desktop browsers). Undefined otherwise. */
export function shareableFile(f:ShareFile):File|undefined{
 if(!f.blob||typeof navigator==="undefined"||typeof navigator.canShare!=="function"||typeof navigator.share!=="function")return undefined;
 const file=new File([f.blob],fileName(f),{type:f.mime});
 try{return navigator.canShare({files:[file]})?file:undefined;}catch{return undefined;}
}

/**
 * «دانلود» and «اشتراک‌گذاری» for one file, plus the Instagram dialog. Nothing is uploaded and nothing is posted: sharing is the device's share sheet
 * (where Instagram appears when installed) or a download. `reason` disables the buttons and says why (no stored file, or generated outputs that are not available yet).
 * `overlay` is for buttons laid over media: only icon buttons (secondary variant, legible on any picture), no notes; a share that cannot finish opens the dialog, which says why.
 * `instagram` shows the Instagram button (on by default, except on a card's overlay where only download and share fit).
 */
export function ShareActions({file,compact=false,reason,overlay=false,instagram=!overlay}:{file:ShareFile;compact?:boolean;reason?:string;overlay?:boolean;instagram?:boolean}){
 const [open,setOpen]=useState(false);
 const [target,setTarget]=useState<ShareTarget|null>(null);
 const [message,setMessage]=useState("");
 const [caption,setCaption]=useState("");
 const [copied,setCopied]=useState("");
 const fitId=useId();
 const blockedReason=reason??(file.blob?undefined:MISSING_FILE_FA),blocked=blockedReason!==undefined;
 const fit=instagramFit(file),tag=displayTag(file.tag),mediaFile=file.kind==="image"||file.kind==="video";
 async function shareNow(tip?:string):Promise<boolean>{
  const f=shareableFile(file);
  if(!f)return false;
  setMessage(tip??"");
  try{await navigator.share({files:[f],title:"هووش"});setMessage("");}
  catch(err){
   if(err instanceof DOMException&&err.name==="AbortError")setMessage("");
   else{setMessage("اشتراک‌گذاری انجام نشد. فایل را دانلود کن و از گالری بفرست.");if(overlay)setOpen(true);}
  }
  return true;
 }
 async function share(){
  if(blocked)return;
  if(!await shareNow())setOpen(true);
 }
 async function pick(t:ShareTarget){
  if(blocked||!mediaFile)return;
  setTarget(t);setCopied("");
  const def=SHARE_TARGETS.find(x=>x.id===t)!;
  if(await shareNow(def.tipFa))return;
  // No file sharing in this browser: download it, then the person opens Instagram themselves.
  triggerDownload(file);setMessage("");
 }
 async function copy(){
  try{await navigator.clipboard.writeText(caption);setCopied("متن کپی شد.");}
  catch{setCopied("کپی انجام نشد؛ متن را انتخاب و دستی کپی کن.");}
 }
 const iconOnly=compact||overlay,sized=iconOnly?"icon":"default";
 const btn=(label:string,icon:typeof Share2,onClick:()=>void,visible:string)=>
  <Button type="button" variant={overlay?"secondary":"outline"} size={sized} disabled={blocked} aria-label={label+" "+tag} aria-describedby={blocked&&!overlay?fitId+"-why":undefined} onClick={onClick}>
   <Icon icon={icon} aria-hidden="true"/>{!iconOnly&&visible}
  </Button>;
 const chosen=target?SHARE_TARGETS.find(t=>t.id===target):undefined;
 const canShareHere=open&&Boolean(shareableFile(file));
 const body:ReactNode=<>
  <DialogHeader>
   <DialogTitle>اشتراک‌گذاری در اینستاگرام</DialogTitle>
   <DialogDescription>هووش چیزی را از طرف تو منتشر نمی‌کند: فایل را خودت دانلود می‌کنی یا از منوی اشتراک‌گذاری دستگاه می‌فرستی. <bdi>{tag}</bdi></DialogDescription>
  </DialogHeader>
  <DialogBody>
   <p className="type-body-sm text-fg-primary">{fit.noteFa}</p>
   <div role="group" aria-label="مقصد در اینستاگرام" className="grid grid-cols-1 gap-2 min-[390px]:grid-cols-3">
    {SHARE_TARGETS.map(t=>{
     const good=mediaFile&&fitsTarget(fit,t.id);
     return <Button key={t.id} type="button" variant={target===t.id?"secondary":"outline"} disabled={blocked||!mediaFile} aria-pressed={target===t.id} onClick={()=>void pick(t.id)} className="h-auto flex-col gap-1 py-2">
      <Icon icon={TARGET_ICONS[t.id]} aria-hidden="true"/><span>{t.labelFa}</span>
      {mediaFile&&<Badge variant={good?"secondary":"outline"}>{good?FIT_GOOD_FA:FIT_CROP_FA}</Badge>}
     </Button>;
    })}
   </div>
   {!mediaFile&&<p className="type-caption text-fg-secondary">{INSTAGRAM_NOT_DIRECT_FA}.</p>}
   {chosen&&<div role="status" className="flex flex-col gap-2 rounded-card border border-line-secondary bg-surface-subtle p-3">
    {canShareHere
     ?<p className="type-body-sm text-fg-primary">{chosen.tipFa}.</p>
     :<>
      <p className="type-body-sm text-fg-primary">فایل دانلود شد. اینستاگرام را باز کن: {chosen.stepsFa}</p>
      <Button variant="outline" render={<a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer"/>} nativeButton={false}><Icon icon={ExternalLink} aria-hidden="true"/>باز کردن اینستاگرام</Button>
     </>}
   </div>}
   {message&&<p role="status" className="type-caption text-fg-secondary">{message}</p>}
   <ol className="list-[persian] ps-5 type-body-sm text-fg-primary marker:text-fg-secondary">{GENERIC_STEPS.map(s=><li key={s}>{s}</li>)}</ol>
   <Button type="button" variant="outline" disabled={blocked} onClick={()=>triggerDownload(file)} aria-label={"دانلود "+tag}><Icon icon={Download} aria-hidden="true"/>دانلود</Button>
   <div className="flex flex-col gap-2">
    <Label htmlFor={fitId+"-caption"}>متن پست (اختیاری)</Label>
    <Textarea id={fitId+"-caption"} value={caption} onChange={e=>{setCaption(e.target.value);setCopied("");}} rows={3} maxLength={2200} placeholder="کپشن را اینجا بنویس"/>
    <div className="flex flex-wrap items-center gap-2">
     <Button type="button" variant="outline" disabled={!caption.trim()} onClick={()=>void copy()}><Icon icon={Copy} aria-hidden="true"/>کپی متن</Button>
     {copied&&<span role="status" className="type-caption text-fg-secondary"><Icon icon={Check} size={16} aria-hidden="true" className="me-1 inline"/>{copied}</span>}
    </div>
   </div>
  </DialogBody>
  <DialogFooter><DialogClose render={<Button type="button" variant="outline"/>}>بستن</DialogClose></DialogFooter>
 </>;
 return <div className={compact||overlay?"flex min-w-0 flex-col gap-1":"flex min-w-0 flex-col gap-2"}>
  <div className={overlay?"flex items-center gap-2":"flex flex-wrap items-center gap-2"}>
   {btn("دانلود",Download,()=>triggerDownload(file),"دانلود")}
   {btn("اشتراک‌گذاری",Share2,()=>void share(),"اشتراک‌گذاری")}
   {instagram&&btn("اشتراک‌گذاری در اینستاگرام",Instagram,()=>setOpen(true),"اینستاگرام")}
  </div>
  {!overlay&&(blocked
   ?<p id={fitId+"-why"} className="type-caption text-fg-secondary">{blockedReason}</p>
   :<p id={fitId+"-note"} className="type-caption text-fg-secondary">{fit.noteFa}</p>)}
  {!overlay&&message&&!open&&<p role="status" className="type-caption text-fg-secondary">{message}</p>}
  <Dialog open={open} onOpenChange={o=>{setOpen(o);if(!o){setTarget(null);setMessage("");setCopied("");}}}>
   <DialogContent showCloseButton={false} className="sm:max-w-lg">{body}</DialogContent>
  </Dialog>
 </div>;
}
