"use client";
import {File as FileIcon,FileAudio,FileJson,FileText,Play,X,type LucideIcon} from "lucide-react";
import {Badge,Button,Checkbox,Dialog,DialogBody,DialogClose,DialogContent,DialogDescription,DialogFooter,DialogHeader,DialogTitle,Icon,Label,Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from "@aleeforoughi/feather-react";
import {ATTACHMENT_KINDS,VOICE_CLONE_CONSENT_FA,displayTag,isMediaKind,roleLabelFa,rolesFor,type AttachmentKind,type AttachmentRole,type AttachmentSpeech,type LocalAttachment,type SendBlocker} from "@/lib/attachments";
import {faBytes,faDimensions,faDuration} from "@/lib/format";

const ICONS:Record<AttachmentKind,LucideIcon>={image:FileIcon,video:FileIcon,audio:FileAudio,pdf:FileIcon,json:FileJson,md:FileText};
const LANGUAGES=[{value:"fa",label:"فارسی"},{value:"other",label:"زبان دیگر"},{value:"unknown",label:"نامشخص"}];
const ACCENTS=[{value:"original",label:"حفظ لهجهٔ اصلی"},{value:"tehrani",label:"تهرانی"},{value:"unspecified",label:"نامشخص"}];
/** `role: null` goes back to «انتخاب خودکار هووش» (no role chosen). */
export type AttachmentPatch=Partial<Pick<LocalAttachment,"speech"|"consent">>&{role?:AttachmentRole|null};
export const AUTO_ROLE_FA="انتخاب خودکار هووش";
const AUTO_ROLE="auto";
export const canPreview=(a:LocalAttachment)=>Boolean(a.previewUrl)&&(a.kind==="image"||a.kind==="video");
/** The Persian tag (`#تصویر-۱`) in a `<bdi>`; it is Persian text now, so it takes its direction from its own letters. */
const tagText=(tag:string)=><bdi>{displayTag(tag)}</bdi>;

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
/** The tag as a small Badge; with `onMention` it is a button that puts the Persian tag (`#تصویر-۱`) into the prompt at the caret. */
export function TagBadge({tag,onMention}:{tag:string;onMention?:()=>void}){
 const badge=<Badge variant="secondary">{tagText(tag)}</Badge>;
 return onMention
  ?<button type="button" onClick={onMention} aria-label={"درج "+displayTag(tag)+" در متن"} className="hit-area inline-flex rounded-full motion-hover not-disabled:hover:opacity-80">{badge}</button>
  :badge;
}
/** The Persian reason a media attachment blocks sending: only a `voice_clone` audio without its consent box does. */
export function BlockerMessage({tag}:{tag:string;reason?:SendBlocker["reason"]}){
 return <>برای {tagText(tag)} تأیید مالکیت یا اجازهٔ صدا را علامت بزن</>;
}

/** One attachment: editable in the composer tray (`onChange`/`onRemove`), read-only in a sent message. `error` marks the missing role or consent that blocks sending. */
export function AttachmentChip({item:a,error,onChange,onRemove,onPreview,onMention}:{item:LocalAttachment;error?:SendBlocker["reason"];onChange?:(patch:AttachmentPatch)=>void;onRemove?:()=>void;onPreview?:()=>void;onMention?:()=>void}){
 const media=isMediaKind(a.kind),editable=Boolean(onChange),roles=[{value:AUTO_ROLE,label:AUTO_ROLE_FA},...rolesFor(a.kind).map(r=>({value:r.id,label:r.labelFa}))];
 const speech=a.speech,lip=a.role==="lip_sync"&&speech,clone=a.role==="voice_clone";
 const controls=editable&&(media||a.kind==="audio");
 const set=(patch:Partial<AttachmentSpeech>)=>speech&&onChange?.({speech:{...speech,...patch}});
 const thumb=canPreview(a)&&onPreview
  ?<button type="button" onClick={onPreview} aria-label={"پیش‌نمایش "+a.name} className="shrink-0 rounded-control hit-area motion-hover not-disabled:hover:opacity-80"><Thumb a={a}/></button>
  :<Thumb a={a}/>;
 return <li id={"attachment-"+a.id} className={"flex min-w-0 max-w-full flex-col gap-2 rounded-card border bg-surface-subtle p-2 "+(error?"border-destructive ":"border-line-secondary ")+(controls?"basis-full":"")}>
  <div className="flex items-center gap-2">
   {thumb}
   <span className="flex min-w-0 flex-1 flex-col">
    <span className="block max-w-full truncate type-label text-fg-primary sm:max-w-56" title={a.name}><bdi>{a.name}</bdi></span>
    <Meta a={a}/>
   </span>
   {onRemove&&<Button type="button" variant="ghost" size="icon" onClick={onRemove} aria-label={"حذف "+a.name}><Icon icon={X} aria-hidden="true"/></Button>}
  </div>
  <div className="flex flex-wrap items-center gap-2">
   <TagBadge tag={a.tag} onMention={onMention}/>
   {media&&!editable&&<Badge variant="outline">{a.role?roleLabelFa(a.role):AUTO_ROLE_FA}</Badge>}
   {controls&&media&&<Select value={a.role??AUTO_ROLE} onValueChange={v=>onChange?.({role:v===AUTO_ROLE?null:v as AttachmentRole})} items={roles}>
    <SelectTrigger aria-label={"نقش "+displayTag(a.tag)} className="max-w-full"><SelectValue/></SelectTrigger>
    <SelectContent>{roles.map(r=><SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
   </Select>}
  </div>
  {controls&&lip&&<div className="flex flex-wrap items-center gap-2">
   <Select value={lip.language} onValueChange={v=>set({language:v as AttachmentSpeech["language"]})} items={LANGUAGES}>
    <SelectTrigger aria-label="زبان گفتار"><span className="text-fg-secondary">زبان</span><SelectValue/></SelectTrigger>
    <SelectContent>{LANGUAGES.map(l=><SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
   </Select>
   <Select value={lip.accent} onValueChange={v=>set({accent:v as AttachmentSpeech["accent"]})} items={ACCENTS}>
    <SelectTrigger aria-label="لهجه"><span className="text-fg-secondary">لهجه</span><SelectValue/></SelectTrigger>
    <SelectContent>{ACCENTS.map(l=><SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
   </Select>
  </div>}
  {controls&&clone&&<span className="flex min-h-control items-center gap-2">
   <Checkbox id={"consent-"+a.id} checked={a.consent===true} onCheckedChange={v=>onChange?.({consent:v===true})} aria-invalid={error==="consent"}/>
   <Label htmlFor={"consent-"+a.id}>{VOICE_CLONE_CONSENT_FA}</Label>
  </span>}
  {error&&<p role="alert" className="type-caption text-destructive"><BlockerMessage tag={a.tag} reason={error}/></p>}
 </li>;
}

/** Large preview of an attached image or video from its local object URL; for any other attachment, its details. */
export function AttachmentPreview({item,onClose}:{item:LocalAttachment|null;onClose:()=>void}){
 return <Dialog open={item!==null} onOpenChange={open=>{if(!open)onClose();}}>
  <DialogContent showCloseButton={false} className="sm:max-w-3xl">
   <DialogHeader>
    <DialogTitle className="break-all"><bdi>{item?.name}</bdi></DialogTitle>
    <DialogDescription>{item&&<>{tagText(item.tag)}{item.role&&<> · {roleLabelFa(item.role)}</>} · <Meta a={item}/></>}</DialogDescription>
   </DialogHeader>
   {item?.previewUrl&&(item.kind==="image"||item.kind==="video")&&<DialogBody>
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
