"use client";
import {File as FileIcon,FileAudio,FileJson,FileText,Play,X,type LucideIcon} from "lucide-react";
import {Badge,Button,Checkbox,Dialog,DialogBody,DialogClose,DialogContent,DialogDescription,DialogFooter,DialogHeader,DialogTitle,Icon,Label,Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from "@aleeforoughi/feather-react";
import {ATTACHMENT_KINDS,type AttachmentKind,type AttachmentRole,type AttachmentSpeech,type LocalAttachment} from "@/lib/attachments";
import {faBytes,faDimensions,faDuration} from "@/lib/format";

const ICONS:Record<AttachmentKind,LucideIcon>={image:FileIcon,video:FileIcon,audio:FileAudio,pdf:FileIcon,json:FileJson,md:FileText};
const LANGUAGES=[{value:"fa",label:"فارسی"},{value:"other",label:"زبان دیگر"},{value:"unknown",label:"نامشخص"}];
const ACCENTS=[{value:"original",label:"حفظ لهجهٔ اصلی"},{value:"tehrani",label:"تهرانی"},{value:"unspecified",label:"نامشخص"}];
const ROLES:{value:AttachmentRole;label:string}[]=[{value:"reference",label:"مرجع تولید"},{value:"context",label:"فقط زمینه"}];
export type AttachmentPatch=Partial<Pick<LocalAttachment,"role"|"speech">>;
export const canPreview=(a:LocalAttachment)=>Boolean(a.previewUrl)&&(a.kind==="image"||a.kind==="video");

function Thumb({a}:{a:LocalAttachment}){
 const frame="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-control border border-line-secondary bg-surface-hover text-fg-secondary";
 if(a.kind==="image"&&a.previewUrl)
  // eslint-disable-next-line @next/next/no-img-element -- a local blob: URL; next/image cannot optimize it
  return <span className={frame}><img src={a.previewUrl} alt="" className="size-full object-cover"/></span>;
 if(a.kind==="video"&&a.previewUrl)
  return <span className={frame}><video src={a.previewUrl+"#t=0.1"} preload="metadata" muted playsInline aria-hidden="true" tabIndex={-1} className="size-full object-cover"/>
   <span className="absolute inset-0 flex items-center justify-center"><Icon icon={Play} size={16} aria-hidden="true" className="text-fg-primary"/></span></span>;
 return <span className={frame}><Icon icon={ICONS[a.kind]} size={24} aria-hidden="true"/></span>;
}
function Meta({a}:{a:LocalAttachment}){
 return <span className="type-caption text-fg-secondary">
  {ATTACHMENT_KINDS[a.kind].labelFa} · {faBytes(a.bytes)}
  {a.durationSeconds!==undefined&&<> · <bdi>{faDuration(a.durationSeconds)}</bdi></>}
  {a.width!==undefined&&a.height!==undefined&&<> · <bdi>{faDimensions(a.width,a.height)}</bdi></>}
 </span>;
}

/** One attachment: editable in the composer tray (`onChange`/`onRemove`), read-only in a sent message. */
export function AttachmentChip({item:a,onChange,onRemove,onPreview}:{item:LocalAttachment;onChange?:(patch:AttachmentPatch)=>void;onRemove?:()=>void;onPreview?:()=>void}){
 const media=a.kind==="image"||a.kind==="video",speech=a.speech,editable=Boolean(onChange);
 const controls=editable&&(media||a.kind==="audio");
 const set=(patch:Partial<AttachmentSpeech>)=>speech&&onChange?.({speech:{...speech,...patch}});
 const thumb=canPreview(a)&&onPreview
  ?<button type="button" onClick={onPreview} aria-label={"پیش‌نمایش "+a.name} className="shrink-0 rounded-control hit-area motion-hover not-disabled:hover:opacity-80"><Thumb a={a}/></button>
  :<Thumb a={a}/>;
 return <li className={"flex flex-col gap-2 rounded-card border border-line-secondary bg-surface-subtle p-2 "+(controls?"basis-full":"max-w-full")}>
  <div className="flex items-center gap-2">
   {thumb}
   <span className="flex min-w-0 flex-1 flex-col">
    <span className="block max-w-56 truncate type-label text-fg-primary" title={a.name}><bdi>{a.name}</bdi></span>
    <Meta a={a}/>
   </span>
   {!editable&&media&&<Badge variant="outline">{a.role==="reference"?"مرجع":"زمینه"}</Badge>}
   {onRemove&&<Button type="button" variant="ghost" size="icon" onClick={onRemove} aria-label={"حذف "+a.name}><Icon icon={X} aria-hidden="true"/></Button>}
  </div>
  {controls&&media&&<div role="group" aria-label={"نقش "+a.name} className="flex flex-wrap gap-1">
   {ROLES.map(r=><Button key={r.value} type="button" variant={a.role===r.value?"secondary":"ghost"} aria-pressed={a.role===r.value} onClick={()=>onChange?.({role:r.value})}>{r.label}</Button>)}
  </div>}
  {controls&&a.kind==="audio"&&speech&&<div className="flex flex-wrap items-center gap-x-4 gap-y-1">
   <span className="flex min-h-control items-center gap-2">
    <Checkbox id={"speech-"+a.id} checked={speech.hasSpeech} onCheckedChange={v=>set({hasSpeech:v===true})}/>
    <Label htmlFor={"speech-"+a.id}>شامل گفتار است</Label>
   </span>
   {speech.hasSpeech&&<>
    <Select value={speech.language} onValueChange={v=>set({language:v as AttachmentSpeech["language"]})} items={LANGUAGES}>
     <SelectTrigger aria-label="زبان گفتار"><span className="text-fg-secondary">زبان</span><SelectValue/></SelectTrigger>
     <SelectContent>{LANGUAGES.map(l=><SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
    </Select>
    <Select value={speech.accent} onValueChange={v=>set({accent:v as AttachmentSpeech["accent"]})} items={ACCENTS}>
     <SelectTrigger aria-label="لهجه"><span className="text-fg-secondary">لهجه</span><SelectValue/></SelectTrigger>
     <SelectContent>{ACCENTS.map(l=><SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
    </Select>
   </>}
  </div>}
 </li>;
}

/** Large preview of an attached image or video, from its local object URL. */
export function AttachmentPreview({item,onClose}:{item:LocalAttachment|null;onClose:()=>void}){
 return <Dialog open={item!==null} onOpenChange={open=>{if(!open)onClose();}}>
  <DialogContent showCloseButton={false} className="sm:max-w-3xl">
   <DialogHeader>
    <DialogTitle className="break-all"><bdi>{item?.name}</bdi></DialogTitle>
    <DialogDescription>{item&&<Meta a={item}/>}</DialogDescription>
   </DialogHeader>
   {item?.previewUrl&&<DialogBody>
    <div className="flex max-h-[60vh] items-center justify-center overflow-hidden rounded-card border border-line-secondary bg-surface-subtle">
     {item.kind==="image"
      // eslint-disable-next-line @next/next/no-img-element -- a local blob: URL; next/image cannot optimize it
      ?<img src={item.previewUrl} alt={item.name} className="max-h-[60vh] w-auto max-w-full object-contain"/>
      :<video src={item.previewUrl} controls playsInline className="max-h-[60vh] w-full"/>}
    </div>
   </DialogBody>}
   <DialogFooter><DialogClose render={<Button variant="outline"/>}>بستن</DialogClose></DialogFooter>
  </DialogContent>
 </Dialog>;
}
