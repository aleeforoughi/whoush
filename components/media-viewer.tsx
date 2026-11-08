"use client";
import {TagText} from "@/components/message-text";
import {faPlain} from "@/lib/format";
import {useCallback,useEffect,useLayoutEffect,useRef,useState,type KeyboardEvent,type PointerEvent,type RefObject} from "react";
import Link from "next/link";
import {AudioLines,Brush,ChevronLeft,Info,ChevronRight,Download,FileJson,FileQuestion,FileText,FolderOpen,Images,Film,X,type LucideIcon,ZoomIn,ZoomOut} from "lucide-react";
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
 /** The essentials shown over the picture (owner, 2026-11-06): title, date, the brief, the model and a few facts. */info?:ViewerInfo;
};
export type ViewerInfo={titleFa:string;dateIso?:string;briefFa?:string;model?:string;facts:{labelFa:string;value:string}[]};
const faDate=(iso:string)=>{try{return new Intl.DateTimeFormat("fa-IR",{dateStyle:"medium",timeStyle:"short"}).format(new Date(iso));}catch{return "";}};
/** A file known only by its URL (a generation): its bytes are fetched once the viewer shows it, so download and share work too. */
function useFetchedBlob(item:ViewerItem):Blob|undefined{
 const [got,setGot]=useState<{id:string;blob:Blob}|null>(null);
 useEffect(()=>{
  if(item.blob||!item.url||item.url.startsWith("blob:"))return;
  let alive=true;
  fetch(item.url).then(r=>r.ok?r.blob():undefined).then(b=>{if(alive&&b)setGot({id:item.id,blob:b});}).catch(()=>undefined);
  return()=>{alive=false;};
 },[item.id,item.url,item.blob]);
 return item.blob??(got?.id===item.id?got.blob:undefined);
}
/**
 * «جزییات» (owner, 2026-11-06): nothing lies over the picture; a fixed button opens this sheet, which scrolls and closes: the title and date, the model and the
 * facts, and the whole brief.
 */
export const DETAILS_BUTTON_FA="جزییات";
function DetailsSheet({info,onClose}:{info:ViewerInfo;onClose:()=>void}){
 return <div data-viewer-chrome role="dialog" aria-label={DETAILS_BUTTON_FA} className="absolute inset-x-0 bottom-0 z-20 flex max-h-[70dvh] flex-col rounded-t-[12px] border-t border-white/10 bg-background shadow-2xl">
  <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
   <span className="type-label text-fg-primary">{DETAILS_BUTTON_FA}</span>
   <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="بستن جزییات"><Icon icon={X} aria-hidden="true"/></Button>
  </div>
  <div className="flex flex-col gap-3 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
   <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
    <span className="type-title text-fg-primary"><bdi>{info.titleFa}</bdi></span>
    {info.dateIso&&<span className="type-caption text-fg-secondary">{faDate(info.dateIso)}</span>}
   </div>
   {(info.model||info.facts.length>0)&&<ul className="flex flex-wrap gap-1.5">
    {info.model&&<li className="rounded-[4px] bg-primary/15 px-1.5 py-0.5 type-caption text-fg-primary"><bdi>{info.model}</bdi></li>}
    {info.facts.map(f=><li key={f.labelFa} className="rounded-[4px] bg-white/10 px-1.5 py-0.5 type-caption text-fg-secondary">{f.labelFa}: <bdi className="text-fg-primary">{f.value}</bdi></li>)}
   </ul>}
   {info.briefFa&&<p className="whitespace-pre-wrap type-body text-fg-primary">{info.briefFa}</p>}
  </div>
 </div>;
}
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
  {ATTACHMENT_KINDS[item.kind].labelFa}{item.bytes>0&&<> · {faBytes(item.bytes)}</>}
  {item.durationSeconds!==undefined&&<> · <bdi>{faDuration(item.durationSeconds)}</bdi></>}
  {item.width!==undefined&&item.height!==undefined&&<> · <bdi>{faDimensions(item.width,item.height)}</bdi></>}
 </span>;
}

function Missing(){
 return <div role="status" className="flex max-w-xs flex-col items-center gap-3 p-6 text-center text-fg-secondary">
  <Icon icon={FileQuestion} size={32} aria-hidden="true" className="size-12"/><p className="type-body text-fg-primary">{MISSING_FILE_FA}</p>
 </div>;
}

/**
 * A picture you can explore (owner, 2026-11-06): pinch to zoom and drag to move on a phone, the wheel and drag on a computer, double-tap or double-click to
 * zoom in or back. While zoomed (or mid-pinch) the gestures are the picture's, so a drag never turns into a swipe to the next item (`onBusy`).
 */
function ZoomableImage({src,alt,onBusy,controls=true}:{src:string;alt:string;onBusy:(busy:boolean)=>void;/** The desktop zoom bar shows with the other controls. */controls?:boolean}){
 const [v,setV]=useState({s:1,x:0,y:0});
 const pts=useRef(new Map<number,{x:number;y:number}>());
 const pinch=useRef<{d:number;mx:number;my:number;v:{s:number;x:number;y:number}}|null>(null);
 const drag=useRef<{x:number;y:number;v:{s:number;x:number;y:number}}|null>(null);
 const lastTap=useRef(0);
 const [moving,setMoving]=useState(false);
 const set=(n:{s:number;x:number;y:number})=>{const s=Math.min(6,Math.max(1,n.s));const next=s===1?{s:1,x:0,y:0}:{...n,s};setV(next);onBusy(next.s>1);};
 const dist=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);
 function down(e:PointerEvent<HTMLDivElement>){
  pts.current.set(e.pointerId,{x:e.clientX,y:e.clientY});const p=[...pts.current.values()];
  if(p.length===2){pinch.current={d:dist(p[0],p[1]),mx:(p[0].x+p[1].x)/2,my:(p[0].y+p[1].y)/2,v};drag.current=null;setMoving(true);onBusy(true);e.stopPropagation();return;}
  const now=Date.now();if(now-lastTap.current<300){set(v.s>1?{s:1,x:0,y:0}:{s:2.5,x:0,y:0});lastTap.current=0;e.stopPropagation();return;}lastTap.current=now;
  if(v.s>1){drag.current={x:e.clientX,y:e.clientY,v};setMoving(true);try{e.currentTarget.setPointerCapture(e.pointerId);}catch{/* no capture */}e.stopPropagation();}
 }
 function move(e:PointerEvent<HTMLDivElement>){
  if(!pts.current.has(e.pointerId))return;pts.current.set(e.pointerId,{x:e.clientX,y:e.clientY});const p=[...pts.current.values()];
  if(pinch.current&&p.length>=2){const c=pinch.current,d=dist(p[0],p[1]),mx=(p[0].x+p[1].x)/2,my=(p[0].y+p[1].y)/2;set({s:c.v.s*d/c.d,x:c.v.x+(mx-c.mx),y:c.v.y+(my-c.my)});return;}
  if(drag.current){const c=drag.current;set({...c.v,x:c.v.x+e.clientX-c.x,y:c.v.y+e.clientY-c.y});}
 }
 function up(e:PointerEvent<HTMLDivElement>){pts.current.delete(e.pointerId);if(pts.current.size<2)pinch.current=null;if(!pts.current.size){drag.current=null;setMoving(false);onBusy(v.s>1);}}
 return <div onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
  onWheel={e=>set({...v,s:v.s*(e.deltaY<0?1.15:1/1.15)})} className="relative flex size-full touch-none items-center justify-center" style={{cursor:v.s>1?"grab":"default"}}>
  {/* eslint-disable-next-line @next/next/no-img-element -- a local blob: URL or an owned output */}
  <img src={src} alt={alt} draggable={false} className="max-h-dvh max-w-full select-none object-contain" style={{transform:`translate(${v.x}px,${v.y}px) scale(${v.s})`,transition:moving?"none":"transform .15s ease-out"}}/>
  {/* Desktop (owner, 2026-11-08): a zoom bar instead of a magnifier cursor: −, a slider with the zoom in percent, +. Phones pinch and double-tap. */}
  <div data-viewer-chrome dir="ltr" onPointerDown={e=>e.stopPropagation()} className={"absolute inset-x-0 bottom-4 mx-auto hidden w-fit items-center gap-2 rounded-control border border-line-secondary bg-surface-subtle px-2 py-1 text-fg-primary shadow-sm [@media(hover:hover)]:flex motion-state "+(controls?"opacity-100":"pointer-events-none opacity-0")}>
   <Button type="button" variant="ghost" size="icon" aria-label="کوچک‌نمایی" title="کوچک‌نمایی" disabled={v.s<=1} onClick={()=>set({...v,s:v.s/1.25})}><Icon icon={ZoomOut} aria-hidden="true"/></Button>
   <input type="range" dir="ltr" min={100} max={600} step={1} value={Math.round(v.s*100)} onChange={e=>set({...v,s:Number(e.target.value)/100})} aria-label="بزرگ‌نمایی" aria-valuetext={faPlain(Math.round(v.s*100))+"٪"} className="h-5 w-32 cursor-pointer accent-primary"/>
   <span className="min-w-10 text-center type-caption tabular-nums">{faPlain(Math.round(v.s*100))}٪</span>
   <Button type="button" variant="ghost" size="icon" aria-label="بزرگ‌نمایی" title="بزرگ‌نمایی" disabled={v.s>=6} onClick={()=>set({...v,s:v.s*1.25})}><Icon icon={ZoomIn} aria-hidden="true"/></Button>
  </div>
 </div>;
}

/** The file itself, as large as fits: images and video are contained, never cropped. */
function Media({item,autoPlay,onBusy,controls=true}:{item:ViewerItem;autoPlay:boolean;onBusy:(busy:boolean)=>void;controls?:boolean}){
 const url=useItemUrl(item);
 if(!item.blob&&!item.url)return <Missing/>;
 if(!url)return null;
 if(item.kind==="image")
  return <ZoomableImage src={url} alt={displayTag(item.tag)} onBusy={onBusy} controls={controls}/>;
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

/**
 * The viewer's two-line description (owner, 2026-11-08: "summarize and reword, max two lines"): for a generation, Whoush's own summary of what was made
 * (the plan's intent, its «ساخت تصویر:»-style lead-in dropped); otherwise the chat's title. Kept to two lines on screen.
 */
export function viewerCaption(brief:string|undefined,title:string|undefined):string|undefined{
 const b=brief?.replace(/^\s*(?:ساخت|ویرایش|ادیت|ایجاد)[^:：]{0,48}[:：]\s*/u,"").replace(/\s+/g," ").trim();
 return b||title||undefined;
}
function ViewerBody({items,index,onIndexChange,onClose,projectTitleOf,stageRef,onEdit}:{items:ViewerItem[];index:number;onIndexChange:(i:number)=>void;onClose:()=>void;projectTitleOf?:(item:ViewerItem)=>string|undefined;stageRef:RefObject<HTMLDivElement|null>;
 onEdit?:(item:ViewerItem)=>void}){
 const item=items[index],n=items.length;
 const blob=useFetchedBlob(item);
 const busy=useRef(false);
 // The sheet belongs to the item it was opened on: moving to another item closes it.
 const [detailsFor,setDetailsFor]=useState<string|null>(null);
 const details=detailsFor===item.id,setDetails=(open:boolean)=>setDetailsFor(open?item.id:null);
 useEffect(()=>{busy.current=false;},[item.id]);
 const [rtl]=useState(isRtl);
 const reduced=useReducedMotion();
 const [shown,setShown]=useState(true);
 /** Tapping the picture hides everything but «جزییات»; tapping again brings it back (owner, 2026-11-08). */
 const [bare,setBare]=useState(false),tapTimer=useRef(0);
 useEffect(()=>()=>window.clearTimeout(tapTimer.current),[]);
 const rootRef=useRef<HTMLDivElement>(null);
 const timer=useRef(0);
 const swipe=useRef<{x:number;y:number;id:number;/** It began on a picture: a tap there shows or hides the controls. */t:boolean}|null>(null);
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
 const visible=(shown||reduced)&&!bare;
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
  swipe.current={x:e.clientX,y:e.clientY,id:e.pointerId,t:e.target instanceof HTMLImageElement};
 }
 function onPointerUp(e:PointerEvent<HTMLDivElement>){
  const s=swipe.current;swipe.current=null;
  // A zoomed or pinched picture keeps its gestures: no swipe to the next item.
  if(!s||s.id!==e.pointerId||busy.current)return;
  const step=swipeStep(e.clientX-s.x,rtl,SWIPE_THRESHOLD,e.clientY-s.y);
  if(step)go(step);
  // A tap on a picture (not a swipe, not on a control or a video) shows or hides the controls, once it is clearly not the first tap of a double tap
  // (which zooms the picture).
  else if(s.t&&Math.hypot(e.clientX-s.x,e.clientY-s.y)<10){window.clearTimeout(tapTimer.current);tapTimer.current=window.setTimeout(()=>{setBare(b=>!b);wake();},320);}
 }
 const fade="motion-state "+(visible?"opacity-100":"pointer-events-none opacity-0");
 const PrevIcon=rtl?ChevronRight:ChevronLeft,NextIcon=rtl?ChevronLeft:ChevronRight;
 const role=item.role?roleLabelFa(item.role,item.kind):undefined;
 const projectHref=item.projectId?"/studio?project="+item.projectId:undefined;
 const caption=viewerCaption(item.info?.briefFa,projectTitle);
 return <div ref={rootRef} onKeyDown={onKeyDown} onPointerMove={wake} onPointerDownCapture={()=>window.clearTimeout(tapTimer.current)} onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={()=>{swipe.current=null;}} onFocusCapture={wake} className="absolute inset-0 overflow-hidden">
  <div ref={stageRef} tabIndex={-1} className="absolute inset-0 flex touch-pan-y items-center justify-center outline-none">
   <Media key={item.id} item={item} autoPlay={!reduced} onBusy={b=>{busy.current=b;}} controls={visible}/>
  </div>
  <p className="sr-only" aria-live="polite">{displayTag(item.tag)} · {viewerCounter(index,n)}</p>
  {/* A soft gradient under the top controls and the description keeps them readable on any picture. */}
  <div data-viewer-chrome className={"absolute inset-x-0 top-0 z-10 flex flex-wrap items-start gap-2 bg-linear-to-b from-black/75 via-black/45 to-transparent p-4 pb-12 "+fade}>
   <DialogPrimitive.Close render={<Button type="button" variant="secondary" size="icon" aria-label="بستن" className="order-1"/>}><Icon icon={X} aria-hidden="true"/></DialogPrimitive.Close>
   {/* The tag and a two-line description, from the start side (owner, 2026-11-08: right in Persian, left in Finglish). */}
   <div className="order-3 flex w-full min-w-0 flex-col items-start gap-1 text-start sm:order-2 sm:w-auto sm:flex-1">
    <div className="flex min-w-0 max-w-full flex-wrap items-center justify-start gap-2">
     <Badge variant="secondary"><bdi>{displayTag(item.tag)}</bdi></Badge>
     {role&&<span className="type-caption text-fg-primary">{role}</span>}
    </div>
    {caption&&(projectHref
     ?<Link href={projectHref} onClick={onClose} className="line-clamp-2 max-w-full type-label text-fg-primary underline-offset-4 hover:underline"><TagText text={caption}/></Link>
     :<p className="line-clamp-2 max-w-full type-label text-fg-primary"><TagText text={caption}/></p>)}
   </div>
   <div className="order-2 ms-auto flex items-center gap-2 sm:order-3 sm:ms-0">
    {onEdit&&item.kind==="image"&&<Button type="button" variant="secondary" onClick={()=>onEdit(item)} aria-label={"ادیت "+displayTag(item.tag)}><Icon icon={Brush} aria-hidden="true"/>ادیت</Button>}
    <ShareActions overlay instagram file={shareFile({...item,blob},projectTitle)}/>
    {projectHref&&<Button variant="secondary" size="icon" aria-label="باز کردن پروژه" title="باز کردن پروژه" render={<Link href={projectHref} onClick={onClose}/>} nativeButton={false}><Icon icon={FolderOpen} aria-hidden="true"/></Button>}
   </div>
  </div>
  {/* Nothing lies over the picture: a fixed «جزییات» button (always visible, not faded) opens the details sheet. */}
  {item.info&&!details&&<div data-viewer-chrome className="absolute bottom-0 end-0 z-10 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
   <Button type="button" variant="secondary" size="sm" onClick={()=>setDetails(true)} aria-haspopup="dialog"><Icon icon={Info} aria-hidden="true"/>{DETAILS_BUTTON_FA}</Button>
  </div>}
  {n>1&&!details&&<div aria-hidden="true" className={"pointer-events-none absolute bottom-0 start-0 z-10 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] "+fade}><span className="type-caption text-fg-secondary">{viewerCounter(index,n)}</span></div>}
  {details&&item.info&&<DetailsSheet info={item.info} onClose={()=>setDetails(false)}/>}
 </div>;
}

/**
 * The full-screen viewer for images, video, audio and files: the whole viewport, no corners, with the controls laid over the media and faded out after
 * 3 seconds without pointer movement. It is a Base UI dialog (focus trap, Escape, focus return) styled with tokens; the `dark` class gives it Feather's dark tokens in
 * both themes. Feather's `DialogContent` is not used because its backdrop (scrim and blur) and rounded frame cannot be overridden from outside.
 * `index` is the open item or null; moves are reported through `onIndexChange`, closing through `onClose`.
 * `restoreFocusTo` picks the element that gets focus back on close (default: whatever opened the viewer).
 */
export function MediaViewer({items,index,onIndexChange,onClose,projectTitleOf,restoreFocusTo,onEdit}:{
 items:ViewerItem[];index:number|null;onIndexChange:(index:number)=>void;onClose:()=>void;
 /** «ادیت» on an image: closes the viewer and opens it in the brush editor. */onEdit?:(item:ViewerItem)=>void;
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
    {current&&index!==null&&<ViewerBody items={items} index={index} onIndexChange={onIndexChange} onClose={onClose} projectTitleOf={projectTitleOf} stageRef={stageRef} onEdit={onEdit}/>}
   </DialogPrimitive.Popup>
  </DialogPortal>
 </Dialog>;
}
