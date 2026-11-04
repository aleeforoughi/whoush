"use client";
import {cloneElement,useId,useRef,useState,useSyncExternalStore,type DragEvent,type MouseEvent,type ReactElement,type ReactNode} from "react";
import Link from "next/link";
import {AudioLines,ChevronDown,ChevronUp,Film,Mic,Mountain,Move,Music,Package,PencilLine,Plus,Shapes,Sparkles,Upload,UserRound,X,type LucideIcon} from "lucide-react";
import {Badge,Button,Checkbox,Dialog,DialogBody,DialogClose,DialogContent,DialogDescription,DialogFooter,DialogHeader,DialogTitle,Icon,Label,Popover,PopoverContent,PopoverHeader,PopoverTitle,PopoverTrigger,RadioGroup,RadioGroupItem} from "@aleeforoughi/feather-react";
import {ATTACHMENT_KINDS,VOICE_CLONE_CONSENT_FA,displayTag,roleLabelFa,type LocalAttachment} from "@/lib/attachments";
import {characterCoverage,characterUsability,type CharacterProfile} from "@/lib/characters";
import {fa} from "@/lib/format";
import {SLOT_BASE,SLOT_IDS,SLOT_KIND,UPLOAD_LABEL_FA,defaultRoleForSlot,rolesForSlot,slotCanAdd,slotLook,type SlotChoice,type SlotIconKey,type SlotId} from "@/lib/reference-slots";
import {AUTO_ROLE_FA} from "@/components/attachment-chip";

export const SLOTS_COLLAPSED_KEY="whoush-slots-collapsed";
const ICONS:Record<SlotIconKey,LucideIcon>={character:UserRound,environment:Mountain,object:Package,graphic:Shapes,edit:PencilLine,motion:Move,speech:AudioLines,music:Music,voice:Mic,auto:Sparkles};
const MEDIA_ACCEPT:Record<"image"|"audio"|"video",string>={image:ATTACHMENT_KINDS.image.mimes.join(","),audio:ATTACHMENT_KINDS.audio.mimes.join(","),video:ATTACHMENT_KINDS.video.mimes.join(",")};
const NO_CHARACTER="none";
const hasFiles=(e:DragEvent)=>Array.from(e.dataTransfer.types).includes("Files");
/** localStorage can throw (private windows, blocked storage); the cards then simply do not remember. Read through useSyncExternalStore so server and client markup agree. */
const listeners=new Set<()=>void>();
const subscribe=(cb:()=>void)=>{listeners.add(cb);window.addEventListener("storage",cb);return()=>{listeners.delete(cb);window.removeEventListener("storage",cb);};};
const storedValue=()=>{try{return window.localStorage.getItem(SLOTS_COLLAPSED_KEY);}catch{return null;}};
const writeCollapsed=(v:boolean)=>{try{window.localStorage.setItem(SLOTS_COLLAPSED_KEY,v?"1":"0");}catch{ /* not remembered */ }listeners.forEach(l=>l());};

/** Narrow screens get the role and upload choices as a dialog (a popover would not fit between the cards and the composer); wider ones as a popover anchored to the card. */
const NARROW="(max-width: 767px)";
const subscribeNarrow=(cb:()=>void)=>{const m=window.matchMedia(NARROW);m.addEventListener("change",cb);return()=>m.removeEventListener("change",cb);};
const isNarrow=()=>window.matchMedia(NARROW).matches;

export type SlotUpload={slot:SlotId;choice:SlotChoice;consent:boolean};
export type ReferenceSlotsProps={
 /** The files picked for the next message; the cards show the ones added through them (`slot`). The same state feeds the tray chips. */
 attachments:readonly LocalAttachment[];emptyConversation:boolean;reading:boolean;
 characters:readonly CharacterProfile[];charactersLoaded:boolean;characterId:string|null;onCharacterChange:(id:string|null)=>void;
 onAddFiles:(files:File[],upload:SlotUpload)=>void;
 /** Files dropped onto a card: the panel's own drop handling must end too. */
 onDropFiles:(files:File[],upload:SlotUpload)=>void;onChangeRole:(slot:SlotId,choice:SlotChoice)=>void;onConsent:(slot:SlotId,value:boolean)=>void;onRemove:(id:string)=>void;
 /** The card a file is being dragged over (`null` when it leaves), for the live announcement and the panel overlay. */
 onDragSlot:(over:{slot:SlotId;title:string}|null)=>void;
};

function Thumb({a}:{a:LocalAttachment}){
 const frame="relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-control border border-line-secondary bg-surface-hover text-fg-secondary";
 // eslint-disable-next-line @next/next/no-img-element -- a local blob: URL; next/image cannot optimize it
 if(a.kind==="image"&&a.previewUrl)return <span className={frame}><img src={a.previewUrl} alt="" className="size-full object-cover"/></span>;
 if(a.kind==="video"&&a.previewUrl)return <span className={frame}><video src={a.previewUrl+"#t=0.1"} preload="metadata" muted playsInline aria-hidden="true" tabIndex={-1} className="size-full object-cover"/></span>;
 return <span className={frame}><Icon icon={a.kind==="audio"?AudioLines:Film} size={16} aria-hidden="true"/></span>;
}

function SlotCard({slot,items,choice,consent,open,onOpenChange,onPick,onConsent,onUpload,onRemove,onDropFiles,onDragSlot,characters,charactersLoaded,characterId,onCharacterChange,reading}:{
 slot:SlotId;items:readonly LocalAttachment[];choice:SlotChoice;consent:boolean;open:boolean;onOpenChange:(open:boolean)=>void;onPick:(choice:SlotChoice)=>void;onConsent:(value:boolean)=>void;
 onUpload:(files:File[])=>void;onRemove:(id:string)=>void;onDropFiles:(files:File[])=>void;onDragSlot:ReferenceSlotsProps["onDragSlot"];
 characters:readonly CharacterProfile[];charactersLoaded:boolean;characterId:string|null;onCharacterChange:(id:string|null)=>void;reading:boolean;
}){
 const uid=useId(),input=useRef<HTMLInputElement>(null),[over,setOver]=useState(false),narrow=useSyncExternalStore(subscribeNarrow,isNarrow,()=>false);
 const [openerEl,setOpenerEl]=useState<HTMLElement|null>(null);
 const kind=SLOT_KIND[slot] as "image"|"audio"|"video",look=slotLook(slot,choice,roleLabelFa),filled=items.length>0,roles=rolesForSlot(slot),canAdd=slotCanAdd(slot,items.length);
 const saved=slot==="character"?characters.find(c=>c.id===characterId):undefined;
 const needsConsent=choice==="voice_clone",uploadBlocked=reading||(needsConsent&&!consent);
 const cardName=SLOT_BASE[slot].title;
 const frame="flex min-w-0 flex-col items-start gap-1 rounded-card border p-2 text-start text-fg-primary motion-hover group-data-[over=true]/slot:border-primary group-data-[over=true]/slot:bg-surface-hover ";
 const head=<span className="flex w-full items-center justify-between gap-2">
  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-hover text-fg-secondary"><Icon icon={ICONS[look.icon]} size={16} aria-hidden="true"/></span>
  {!filled&&<Badge variant="outline">اختیاری</Badge>}
 </span>;
 const savedLine=saved&&<span className="type-caption text-fg-primary">کاراکتر ذخیره‌شده: <bdi>{saved.name}</bdi></span>;
 function drag(e:DragEvent,enter:boolean){
  if(!hasFiles(e))return;
  e.preventDefault();
  if(enter){setOver(true);onDragSlot({slot,title:look.title});}
 }
 /** The dialog has no trigger of its own, so focus goes back to the card's opener by hand when it closes. */
 function openDialog(e:MouseEvent<HTMLElement>){setOpenerEl(e.currentTarget);onOpenChange(true);}
 function changeDialog(o:boolean){onOpenChange(o);if(!o)requestAnimationFrame(()=>openerEl?.focus());}
 /** The element that opens the choices: a popover trigger on wide screens, a plain button that opens the dialog on narrow ones. */
 const opener=(render:ReactElement<{children?:ReactNode}>,children:ReactNode)=>narrow
  ?cloneElement(render,{onClick:openDialog,"aria-haspopup":"dialog","aria-expanded":open} as object,children)
  :<PopoverTrigger render={render}>{children}</PopoverTrigger>;
 const trigger=filled
  ?opener(<Button type="button" variant="ghost" size="sm" aria-label={"تغییر نقش کارت "+cardName} className="max-w-full"/>,<>
    <span className="min-w-0 truncate">{choice==="auto"?AUTO_ROLE_FA:roleLabelFa(choice)}</span><Icon icon={ChevronDown} aria-hidden="true"/>
   </>)
  :null;
 const title="نقش و آپلود برای کارت "+cardName;
 const panel=<>
    <RadioGroup value={choice} onValueChange={v=>onPick(v as SlotChoice)} aria-label="نقش">
     {[...roles.map(r=>({id:r.id as SlotChoice,label:r.labelFa})),{id:"auto" as SlotChoice,label:AUTO_ROLE_FA}].map(r=><div key={r.id} className="flex min-h-control items-center gap-3">
      <RadioGroupItem id={uid+"-"+r.id} value={r.id}/><Label htmlFor={uid+"-"+r.id} className="min-h-control flex-1 items-center">{r.label}</Label>
     </div>)}
    </RadioGroup>
    {needsConsent&&<span className="flex min-h-control items-center gap-2">
     <Checkbox id={uid+"-consent"} checked={consent} onCheckedChange={v=>onConsent(v===true)}/>
     <Label htmlFor={uid+"-consent"}>{VOICE_CLONE_CONSENT_FA}</Label>
    </span>}
    {canAdd&&<Button type="button" disabled={uploadBlocked} onClick={()=>{onOpenChange(false);input.current?.click();}}><Icon icon={Upload} aria-hidden="true"/>{UPLOAD_LABEL_FA[kind]}</Button>}
    {slot==="character"&&<section aria-label="انتخاب از کاراکترهای من" className="flex flex-col gap-2 border-t border-line-tertiary pt-3">
     <h4 className="type-label text-fg-primary">انتخاب از کاراکترهای من</h4>
     <RadioGroup value={characterId??NO_CHARACTER} onValueChange={v=>onCharacterChange(v===NO_CHARACTER?null:String(v))} aria-label="کاراکتر ذخیره‌شده">
      <div className="flex min-h-control items-center gap-3"><RadioGroupItem id={uid+"-char-none"} value={NO_CHARACTER}/><Label htmlFor={uid+"-char-none"} className="min-h-control flex-1 items-center">بدون کاراکتر</Label></div>
      {characters.map(c=>{
       const usable=characterUsability(c),cov=characterCoverage(c.references);
       return <div key={c.id} className="flex min-h-control items-center gap-3">
        <RadioGroupItem id={uid+"-char-"+c.id} value={c.id} disabled={!usable.ok}/>
        <Label htmlFor={uid+"-char-"+c.id} className="min-h-control flex-1 flex-col items-start justify-center gap-0">
         <span>{c.name}</span>
         <span className="type-caption text-fg-secondary">{usable.ok?"ضروری "+fa(cov.requiredCount)+" از "+fa(cov.requiredTotal)+" · "+fa(cov.count)+" نما":usable.reason}</span>
        </Label>
       </div>;
      })}
     </RadioGroup>
     {charactersLoaded&&characters.length===0&&<p className="type-caption text-fg-secondary">هنوز کاراکتری نساخته‌ای.</p>}
     <Button variant="ghost" render={<Link href="/characters"/>} nativeButton={false}><Icon icon={Plus} aria-hidden="true"/>{charactersLoaded&&characters.length===0?"ساخت کاراکتر":"مدیریت کاراکترها"}</Button>
    </section>}
  </>;
 return <div data-over={over} className="group/slot min-w-0"
  onDragEnter={e=>drag(e,true)} onDragOver={e=>drag(e,true)}
  onDragLeave={e=>{if(!hasFiles(e)||e.currentTarget.contains(e.relatedTarget as Node|null))return;setOver(false);onDragSlot(null);}}
  onDrop={e=>{if(!hasFiles(e))return;e.preventDefault();e.stopPropagation();setOver(false);onDragSlot(null);onDropFiles(Array.from(e.dataTransfer.files));}}>
  <input ref={input} type="file" hidden multiple={slot==="character"} accept={MEDIA_ACCEPT[kind]} data-testid={"slot-input-"+slot} tabIndex={-1}
   onChange={e=>{const files=Array.from(e.target.files??[]);e.target.value="";if(files.length)onUpload(files);}}/>
  <Popover open={open} onOpenChange={onOpenChange}>
   {filled
    ?<div role="group" aria-label={"کارت "+look.title} className={frame+"w-full border-line-secondary bg-surface-subtle"}>
      {head}
      <span className="type-label">{look.title}</span>
      {savedLine}
      <ul className="flex w-full min-w-0 flex-col gap-2">
       {items.map(a=><li key={a.id} className="flex min-w-0 flex-col gap-1">
        <span className="flex items-center justify-between gap-1">
         <Thumb a={a}/>
         <Button type="button" variant="ghost" size="icon" onClick={()=>onRemove(a.id)} aria-label={"حذف "+displayTag(a.tag)+" از کارت "+cardName}><Icon icon={X} aria-hidden="true"/></Button>
        </span>
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 type-caption"><bdi className="type-label text-fg-primary">{displayTag(a.tag)}</bdi><span className="text-fg-secondary">{a.role?roleLabelFa(a.role):AUTO_ROLE_FA}</span></span>
       </li>)}
      </ul>
      <span className="flex w-full flex-wrap items-center justify-between gap-1">
       {trigger}
       {canAdd&&<Button type="button" variant="outline" size="sm" disabled={reading} onClick={()=>input.current?.click()} aria-label={"افزودن عکس دوم به کارت "+cardName}><Icon icon={Plus} aria-hidden="true"/>{fa(1)}</Button>}
      </span>
     </div>
    :opener(<button type="button" aria-label={"افزودن مرجع "+look.title+": نقش و آپلود"} className={frame+"min-h-20 w-full border-dashed border-line-primary bg-transparent not-disabled:hover:bg-surface-hover aria-expanded:bg-surface-hover"}/>,<>
      {head}
      <span className="type-label">{look.title}</span>
      <span className="type-caption text-fg-secondary">{look.hint}</span>
      {savedLine}
     </>)}
   {!narrow&&<PopoverContent side="bottom" align="center" className="max-h-(--available-height) w-72 max-w-[calc(100dvw-2rem)] overflow-y-auto">
    <PopoverHeader><PopoverTitle>{title}</PopoverTitle></PopoverHeader>
    {panel}
   </PopoverContent>}
  </Popover>
  {narrow&&<Dialog open={open} onOpenChange={changeDialog}>
   <DialogContent showCloseButton={false}>
    <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription className="sr-only">نقش این مرجع را انتخاب کن و فایل را آپلود کن</DialogDescription></DialogHeader>
    <DialogBody className="flex flex-col gap-3">{panel}</DialogBody>
    <DialogFooter><DialogClose render={<Button variant="outline"/>}>بستن</DialogClose></DialogFooter>
   </DialogContent>
  </Dialog>}
 </div>;
}

/**
 * Optional reference cards under the prompt: کاراکتر, محیط, صدا and الگوی حرکت. A card is a starting point: its role is a choice (changeable before and after
 * uploading), and the file it receives is an ordinary attachment (tag, limits, sniffing, fail-closed media) with that role and `roleSource: "user"`. The cards hold no
 * state of their own for files: they show the tray attachments added through them, so a removal or role change anywhere shows everywhere.
 */
export function ReferenceSlots({attachments,emptyConversation,reading,characters,charactersLoaded,characterId,onCharacterChange,onAddFiles,onDropFiles,onChangeRole,onConsent,onRemove,onDragSlot}:ReferenceSlotsProps){
 const gridId=useId();
 const raw=useSyncExternalStore(subscribe,storedValue,()=>null),[local,setLocal]=useState<boolean|null>(null);
 const [choices,setChoices]=useState<Record<SlotId,SlotChoice>>({character:defaultRoleForSlot("character"),location:defaultRoleForSlot("location"),audio:defaultRoleForSlot("audio"),motion:defaultRoleForSlot("motion")});
 const [consent,setConsent]=useState(false);
 const [openSlot,setOpenSlot]=useState<SlotId|null>(null);
 // Expanded on an empty conversation, collapsed once it has begun, unless the user chose (remembered in localStorage).
 const collapsed=local??(raw==="1"?true:raw==="0"?false:!emptyConversation);
 function toggle(){const next=!collapsed;setLocal(next);writeCollapsed(next);}
 return <section aria-label="مرجع‌ها" className="flex flex-col gap-2">
  <div className="flex items-center justify-between gap-2">
   <h3 className="type-label text-fg-primary">مرجع‌ها · اختیاری</h3>
   <Button type="button" variant="ghost" size="sm" aria-expanded={!collapsed} aria-controls={gridId} onClick={toggle}>
    <Icon icon={collapsed?ChevronDown:ChevronUp} aria-hidden="true"/>{collapsed?"نمایش":"پنهان کردن"}
   </Button>
  </div>
  <div id={gridId} className={collapsed?"hidden":"grid grid-cols-2 gap-element"}>
   {SLOT_IDS.map(slot=>{
    const items=attachments.filter(a=>a.slot===slot),current:SlotChoice=items.length?items[0].role??"auto":choices[slot];
    const upload=(files:File[])=>{onAddFiles(files,{slot,choice:current,consent});setConsent(false);};
    return <SlotCard key={slot} slot={slot} items={items} choice={current} consent={items.length?items[0].consent===true:consent} open={openSlot===slot} onOpenChange={o=>setOpenSlot(o?slot:openSlot===slot?null:openSlot)}
     onPick={choice=>{setChoices(c=>({...c,[slot]:choice}));if(items.length)onChangeRole(slot,choice);if(choice!=="voice_clone")setConsent(false);}}
     onConsent={v=>{if(items.length)onConsent(slot,v);else setConsent(v);}}
     onUpload={upload} onRemove={onRemove} onDropFiles={files=>{onDropFiles(files,{slot,choice:current,consent});setConsent(false);}} onDragSlot={onDragSlot}
     characters={characters} charactersLoaded={charactersLoaded} characterId={characterId} onCharacterChange={onCharacterChange} reading={reading}/>;
   })}
  </div>
 </section>;
}
