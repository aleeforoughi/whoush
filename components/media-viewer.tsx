"use client";
import {useCallback,useEffect,useLayoutEffect,useRef,useState,type KeyboardEvent,type PointerEvent,type RefObject} from "react";
import Link from "next/link";
import {AudioLines,ChevronLeft,ChevronRight,Download,FileJson,FileQuestion,FileText,FolderOpen,Images,Film,X,type LucideIcon} from "lucide-react";
import {Dialog as DialogPrimitive} from "@base-ui/react/dialog";
import {Badge,Button,Dialog,DialogPortal,Icon} from "@aleeforoughi/feather-react";
import {ATTACHMENT_KINDS,displayTag,roleLabelFa,type AttachmentKind,type AttachmentRole} from "@/lib/attachments";
import {faBytes,faDimensions,faDuration} from "@/lib/format";
import {HIDE_AFTER_MS,SWIPE_THRESHOLD,hasNext,hasPrev,keyToStep,nextIndex,swipeStep,viewerCounter,type ViewerStep} from "@/lib/viewer";
import {MISSING_FILE_FA,ShareActions,triggerDownload,type ShareFile} from "@/components/share-actions";

/** One file in the viewer. `url` is an object URL the caller owns (the viewer never revokes it); with only a `blob` the viewer makes its own and revokes it. */
export type ViewerItem={
 id:string;kind:AttachmentKind;mime:string;bytes:number;name:string;tag:string;role?:AttachmentRole;
 width?:number;height?:number;durationSeconds?:number;projectId?:string;url?:string;blob?:Blob;
};
const KIND_ICONS:Record<AttachmentKind,LucideIcon>={image:Images,video:Film,audio:AudioLines,pdf:FileText,json:FileJson,md:FileText};
export const VIEWER_LABEL_FA="نمایش تمام‌صفحه";
const shareFile=(item:ViewerItem,projectTitle:string|undefined):ShareFile=>({blob:item.blob,name:item.name,mime:item.mime,kind:item.kind,tag:item.tag,width:item.width,height:item.height,durationSeconds:item.durationSeconds,projectTitle});

/** An object URL for the item: the caller's, or one made here from the blob and revoked on change and on unmount. */
function useItemUrl(item:ViewerItem):string|undefined{
 const [own,setOwn]=useState<{blob:Blob;url:string}|null>(null);
 const {url,blob}=item;
 useEffect(()=>{
  if(url||!blob)return;
  const made=URL.createObjectURL(blob);
  // Creating an object URL is a resource of the outside world (revoked below), so it is kept in state once made.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  setOwn({blob,url:made});
  return()=>URL.revokeObjectURL(made);
 },[url,blob]);
 return url??(own&&own.blob===blob?own.url:undefined);
}
function useReducedMotion():boolean{
 const [reduced,setReduced]=useState(()=>typeof window!=="undefined"&&window.matchMedia("(prefers-reduced-motion: reduce)").matches);
 useEffect(()=>{
  const q=window.matchMedia("(prefers-reduced-motion: reduce)"),on=()=>setReduced(q.matches);
  on();q.addEventListener("change",on);
  return()=>q.removeEventListener("change",on);
 },[]);
 return reduced;
}
const isRtl=()=>typeof document!=="undefined"&&getComputedStyle(document.documentElement).direction==="rtl";

function Meta({item}:{item:ViewerItem}){
 return <span className="type-caption text-fg-secondary">
  {ATTACHMENT_KINDS[item.kind].labelFa} · {faBytes(item.bytes)}
  {item.durationSeconds!==undefined&&<> · <bdi>{faDuration(item.durationSeconds)}</bdi></>}
  {item.width!==undefined&&item.height!==undefined&&<> · <bdi>{faDimensions(item.width,item.height)}</bdi></>}
 </span>;
}

function Missing(){
 return <div role="status" className="flex max-w-xs flex-col items-center gap-3 p-6 text-center text-fg-secondary">
  <Icon icon={FileQuestion} size={32} aria-hidden="true" className="size-12"/><p className="type-body text-fg-primary">{MISSING_FILE_FA}</p>
 </div>;
}

/** The file itself, as large as fits: images and video are contained, never cropped. */
function Media({item,autoPlay}:{item:ViewerItem;autoPlay:boolean}){
 const url=useItemUrl(item);
 if(!item.blob&&!item.url)return <Missing/>;
 if(!url)return null;
 if(item.kind==="image")
  // eslint-disable-next-line @next/next/no-img-element -- a local blob: URL; next/image cannot optimize it
  return <img src={url} alt={displayTag(item.tag)} draggable={false} className="max-h-dvh max-w-full select-none object-contain"/>;
 // The bottom strip stays free for the native controls and the counter.
 if(item.kind==="video")return <video src={url} controls playsInline muted autoPlay={autoPlay} aria-label={displayTag(item.tag)} className="max-h-[calc(100dvh-4rem)] max-w-full object-contain"/>;
 if(item.kind==="audio")return <div className="flex w-full max-w-md flex-col items-center gap-6 p-6">
  <Icon icon={AudioLines} size={32} aria-hidden="true" className="size-24 text-fg-secondary"/>
  <audio src={url} controls aria-label={displayTag(item.tag)} className="w-full"/>
 </div>;
 return <div className="flex w-full max-w-md flex-col items-center gap-4 p-6 text-center">
  <Icon icon={KIND_ICONS[item.kind]} size={32} aria-hidden="true" className="size-24 text-fg-secondary"/>
  <p className="max-w-full break-all type-title text-fg-primary"><bdi>{item.name}</bdi></p>
  <Meta item={item}/>
  <Button type="button" variant="secondary" onClick={()=>triggerDownload(shareFile(item,undefined))} aria-label={"دانلود "+displayTag(item.tag)}><Icon icon={Download} aria-hidden="true"/>دانلود</Button>
 </div>;
}

/** Whether keyboard focus is on one of the overlay controls: the overlays must not fade out from under it. */
function focusInChrome(root:HTMLElement|null):boolean{
 const el=document.activeElement;
 if(!root||!(el instanceof HTMLElement)||!root.contains(el))return false;
 if(!el.closest("[data-viewer-chrome]"))return false;
 try{return el.matches(":focus-visible");}catch{return true;}
}

function ViewerBody({items,index,onIndexChange,onClose,projectTitleOf,stageRef}:{items:ViewerItem[];index:number;onIndexChange:(i:number)=>void;onClose:()=>void;projectTitleOf?:(item:ViewerItem)=>string|undefined;stageRef:RefObject<HTMLDivElement|null>}){
 const item=items[index],n=items.length;
 const [rtl]=useState(isRtl);
 const reduced=useReducedMotion();
 const [shown,setShown]=useState(true);
 const rootRef=useRef<HTMLDivElement>(null);
 const timer=useRef(0);
 const swipe=useRef<{x:number;y:number;id:number}|null>(null);
 const projectTitle=projectTitleOf?.(item);
 const arm=useCallback(()=>{
  window.clearTimeout(timer.current);
  if(reduced)return;
  const tick=()=>{
   // Keyboard focus on a control keeps the overlays up; check again later.
   if(focusInChrome(rootRef.current)){timer.current=window.setTimeout(tick,HIDE_AFTER_MS);return;}
   setShown(false);
  };
  timer.current=window.setTimeout(tick,HIDE_AFTER_MS);
 },[reduced]);
 /** Pointer move, tap, key press, focus and a new item all bring the overlays back and restart the countdown. */
 const wake=useCallback(()=>{setShown(true);arm();},[arm]);
 useEffect(()=>{
  arm();
  return()=>window.clearTimeout(timer.current);
 },[arm]);
 // Reduced motion: always visible (a state that was hidden before the preference changed is overridden at render).
 const visible=shown||reduced;
 const go=useCallback((step:ViewerStep)=>{
  const to=nextIndex(index,n,step,rtl);
  if(to!==index){onIndexChange(to);wake();}
 },[index,n,rtl,onIndexChange,wake]);
 // A disabled button that had focus leaves it on the page body: keep the keyboard inside the viewer.
 useEffect(()=>{
  const root=rootRef.current,active=document.activeElement;
  if(root&&(!active||active===document.body||!root.contains(active)))stageRef.current?.focus({preventScroll:true});
 },[index,stageRef]);
 function onKeyDown(e:KeyboardEvent<HTMLDivElement>){
  wake();
  const target=e.target as HTMLElement;
  // Keys typed in a nested dialog (a portal, still a React child) or in a media control are theirs.
  if(e.defaultPrevented||e.altKey||e.ctrlKey||e.metaKey||e.shiftKey||!e.currentTarget.contains(target)||target.closest("input,textarea,select,video,audio,[contenteditable]"))return;
  const step=keyToStep(e.key,rtl);
  if(!step)return;
  e.preventDefault();go(step);
 }
 function onPointerDown(e:PointerEvent<HTMLDivElement>){
  wake();
  const t=e.target as HTMLElement;
  if(!e.isPrimary||(e.pointerType==="mouse"&&e.button!==0)||t.closest("[data-viewer-chrome],audio")){swipe.current=null;return;}
  // The bottom strip of a video is its own seek bar.
  if(t instanceof HTMLVideoElement&&e.clientY>t.getBoundingClientRect().bottom-64){swipe.current=null;return;}
  swipe.current={x:e.clientX,y:e.clientY,id:e.pointerId};
 }
 function onPointerUp(e:PointerEvent<HTMLDivElement>){
  const s=swipe.current;swipe.current=null;
  if(!s||s.id!==e.pointerId)return;
  const step=swipeStep(e.clientX-s.x,rtl,SWIPE_THRESHOLD,e.clientY-s.y);
  if(step)go(step);
 }
 const fade="motion-state "+(visible?"opacity-100":"pointer-events-none opacity-0");
 const PrevIcon=rtl?ChevronRight:ChevronLeft,NextIcon=rtl?ChevronLeft:ChevronRight;
 const role=item.role?roleLabelFa(item.role,item.kind):undefined;
 const projectHref=item.projectId?"/studio?project="+item.projectId:undefined;
 return <div ref={rootRef} onKeyDown={onKeyDown} onPointerMove={wake} onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={()=>{swipe.current=null;}} onFocusCapture={wake} className="absolute inset-0 overflow-hidden">
  <div ref={stageRef} tabIndex={-1} className="absolute inset-0 flex touch-pan-y items-center justify-center outline-none">
   <Media key={item.id} item={item} autoPlay={!reduced}/>
  </div>
  <p className="sr-only" aria-live="polite">{displayTag(item.tag)} · {viewerCounter(index,n)}</p>
  <div data-viewer-chrome className={"absolute inset-x-0 top-0 z-10 flex flex-wrap items-start gap-2 bg-linear-to-b from-background/80 to-background/0 p-4 "+fade}>
   <DialogPrimitive.Close render={<Button type="button" variant="secondary" size="icon" aria-label="بستن" className="order-1"/>}><Icon icon={X} aria-hidden="true"/></DialogPrimitive.Close>
   <div className="order-3 flex w-full min-w-0 flex-col items-center gap-1 text-center sm:order-2 sm:w-auto sm:flex-1">
    <div className="flex min-w-0 max-w-full flex-wrap items-center justify-center gap-2">
     <Badge variant="secondary"><bdi>{displayTag(item.tag)}</bdi></Badge>
     {role&&<span className="type-caption text-fg-primary">{role}</span>}
    </div>
    {projectTitle&&(projectHref
     ?<Link href={projectHref} onClick={onClose} className="max-w-full truncate type-label text-fg-primary underline-offset-4 hover:underline"><bdi>{projectTitle}</bdi></Link>
     :<span className="max-w-full truncate type-label text-fg-primary"><bdi>{projectTitle}</bdi></span>)}
   </div>
   <div className="order-2 ms-auto flex items-center gap-2 sm:order-3 sm:ms-0">
    <ShareActions overlay file={shareFile(item,projectTitle)}/>
    {projectHref&&<Button variant="secondary" size="icon" aria-label="باز کردن پروژه" title="باز کردن پروژه" render={<Link href={projectHref} onClick={onClose}/>} nativeButton={false}><Icon icon={FolderOpen} aria-hidden="true"/></Button>}
   </div>
  </div>
  {n>1&&<>
   <div data-viewer-chrome className={"absolute start-3 top-1/2 z-10 -translate-y-1/2 "+fade}>
    <Button type="button" variant="secondary" size="icon" disabled={!hasPrev(index)} onClick={()=>go("prev")} aria-label="قبلی"><Icon icon={PrevIcon} aria-hidden="true"/></Button>
   </div>
   <div data-viewer-chrome className={"absolute end-3 top-1/2 z-10 -translate-y-1/2 "+fade}>
    <Button type="button" variant="secondary" size="icon" disabled={!hasNext(index,n)} onClick={()=>go("next")} aria-label="بعدی"><Icon icon={NextIcon} aria-hidden="true"/></Button>
   </div>
  </>}
  <div aria-hidden="true" className={"pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center bg-linear-to-t from-background/80 to-background/0 p-4 "+fade}>
   <span className="type-label text-fg-primary">{viewerCounter(index,n)}</span>
  </div>
 </div>;
}

/**
 * The full-screen viewer for images, video, audio and files: the whole viewport, no corners, with the controls laid over the media and faded out after
 * 3 seconds without pointer movement. It is a Base UI dialog (focus trap, Escape, focus return) styled with tokens; the `dark` class gives it Feather's dark tokens in
 * both themes. Feather's `DialogContent` is not used because its backdrop (scrim and blur) and rounded frame cannot be overridden from outside.
 * `index` is the open item or null; moves are reported through `onIndexChange`, closing through `onClose`.
 * `restoreFocusTo` picks the element that gets focus back on close (default: whatever opened the viewer).
 */
export function MediaViewer({items,index,onIndexChange,onClose,projectTitleOf,restoreFocusTo}:{
 items:ViewerItem[];index:number|null;onIndexChange:(index:number)=>void;onClose:()=>void;
 projectTitleOf?:(item:ViewerItem)=>string|undefined;restoreFocusTo?:(item:ViewerItem)=>HTMLElement|null;
}){
 const stageRef=useRef<HTMLDivElement>(null);
 const current=index!==null?items[index]:undefined;
 const open=current!==undefined;
 // The item that opened the viewer, the element that had focus when it opened, and the item shown last: kept for the focus return after it has closed.
 const was=useRef({open:false,opened:undefined as ViewerItem|undefined,opener:null as HTMLElement|null,last:undefined as ViewerItem|undefined});
 // A layout effect runs before the dialog moves focus into itself, so the opener is still the active element.
 useLayoutEffect(()=>{
  const w=was.current;
  if(current){
   if(!w.open){w.opened=current;w.opener=document.activeElement instanceof HTMLElement?document.activeElement:null;}
   w.last=current;
  }
  w.open=current!==undefined;
 });
 const finalFocus=useCallback(()=>{
  const {opened,opener,last}=was.current;
  // Back to the element that opened the viewer, unless the person moved on to another item: then to that item's own opener.
  if(last&&opened&&last.id!==opened.id)return restoreFocusTo?.(last)??true;
  if(opener&&opener!==document.body&&opener.isConnected)return opener;
  return (opened&&restoreFocusTo?.(opened))??true;
 },[restoreFocusTo]);
 return <Dialog open={open} onOpenChange={o=>{if(!o)onClose();}}>
  <DialogPortal>
   <DialogPrimitive.Popup
    data-slot="media-viewer"
    aria-label={VIEWER_LABEL_FA}
    aria-modal="true"
    initialFocus={stageRef}
    finalFocus={finalFocus}
    className="dark motion-dialog fixed inset-0 z-50 m-0 h-dvh w-screen max-w-none overflow-hidden rounded-none border-0 bg-background p-0 text-fg-primary opacity-100 outline-none data-starting-style:opacity-0"
   >
    {current&&index!==null&&<ViewerBody items={items} index={index} onIndexChange={onIndexChange} onClose={onClose} projectTitleOf={projectTitleOf} stageRef={stageRef}/>}
   </DialogPrimitive.Popup>
  </DialogPortal>
 </Dialog>;
}
