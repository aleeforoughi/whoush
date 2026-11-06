"use client";
import {useEffect,useRef,useState} from "react";
import {Check,Hand,Redo2,Trash2,Undo2,X} from "lucide-react";
import {Button,Icon} from "@aleeforoughi/feather-react";
import {BRUSH_DONE_FA,BRUSH_EDIT_FA,BRUSH_HINT_FA,BRUSH_MISSING_NOTE_FA,BRUSH_NOTE_PLACEHOLDER_FA,BRUSH_SIZES,MAX_NOTE,MAX_REGIONS,REGION_COLORS,
 NEON_SHADOW,colorCss,maskHasPaint,regionTagFa,type Region} from "@/lib/region-edit";
import {displayTag} from "@/lib/attachments";

/** A region in the editor: its colour slot (0..4, one layer each), its number (#ادیت-n), its comment and where its pin sits. */
type Draft={slot:number;n:number;note:string;pin:{x:number;y:number}};
type View={s:number;x:number;y:number};
const MIN_S=1,MAX_S=8;
export const CONTINUE_FA="برای ادامهٔ همین ناحیه، اول روی برچسبش بزن.";

/**
 * The full-screen photo editor for «ویرایش با قلم» (lib/region-edit.ts), mobile first. Every new touch starts a new region with the next colour and tag
 * (#ویرایش-۱, #ویرایش-۲ …), like dropping a new comment; tapping a region's pin or row first makes the next stroke continue it. Two fingers pinch to zoom
 * and move; on a computer the wheel zooms and the hand tool moves. Each region has its own layer at the photo's own pixel size, so the marked copy lines up.
 */
export function RegionEditor({tag,photoUrl,onClose,onDone}:{tag:string;photoUrl:string;onClose:()=>void;
 onDone:(r:{masks:HTMLCanvasElement[];regions:Region[]})=>void}){
 const [regions,setRegions]=useState<Draft[]>([]);
 const [focus,setFocus]=useState<number|null>(null);
 const [size,setSize]=useState(2);
 const [hand,setHand]=useState(false);
 const [view,setView]=useState<View>({s:1,x:0,y:0});
 const [natural,setNatural]=useState<{w:number;h:number}|null>(null);
 const [missing,setMissing]=useState(false);
 // The brush cursor: a circle the size of the brush on screen (screen pixels, so it matches the stroke at any zoom), where the pointer is.
 const [cursor,setCursor]=useState<{x:number;y:number}|null>(null);
 const stage=useRef<HTMLDivElement>(null);
 // A new region's comment takes focus once its field exists (the field is made by the same render that adds the region).
 const [focusNote,setFocusNote]=useState<number|null>(null);
 useEffect(()=>{if(focusNote===null)return;const el=notes.current.get(focusNote);if(el){el.focus({preventScroll:true});setFocusNote(null);}},[focusNote,regions]);
 const layers=useRef<(HTMLCanvasElement|null)[]>([]);
 const notes=useRef(new Map<number,HTMLTextAreaElement>());
 const history=useRef<{slot:number;data:ImageData;created:boolean}[]>([]);
 const pointers=useRef(new Map<number,{x:number;y:number}>());
 const stroke=useRef<{slot:number;last:{x:number;y:number};created:boolean}|null>(null);
 const pinch=useRef<{d:number;mx:number;my:number;view:View}|null>(null);
 const pan=useRef<{x:number;y:number;view:View}|null>(null);
 const viewRef=useRef(view),regionsRef=useRef(regions),focusRef=useRef(focus);
 useEffect(()=>{viewRef.current=view;regionsRef.current=regions;focusRef.current=focus;},[view,regions,focus]);
 useEffect(()=>{
  const prev=document.body.style.overflow;document.body.style.overflow="hidden";
  const key=(e:KeyboardEvent)=>{if(e.key==="Escape")onClose();};window.addEventListener("keydown",key);
  return()=>{document.body.style.overflow=prev;window.removeEventListener("keydown",key);};
 },[onClose]);

 /** Screen point → photo pixel, through the zoom and move (getBoundingClientRect includes the CSS transform). */
 function toPhoto(cx:number,cy:number,slot:number){const m=layers.current[slot]!,r=m.getBoundingClientRect();return {x:(cx-r.left)*m.width/r.width,y:(cy-r.top)*m.height/r.height,k:m.width/r.width};}
 function paint(slot:number,from:{x:number;y:number},to:{x:number;y:number},k:number){
  const ctx=layers.current[slot]?.getContext("2d");if(!ctx)return;
  ctx.strokeStyle=REGION_COLORS[slot].css;ctx.lineCap="round";ctx.lineJoin="round";ctx.lineWidth=Math.max(2,BRUSH_SIZES[size].px*k);
  ctx.beginPath();ctx.moveTo(from.x,from.y);ctx.lineTo(to.x,to.y);ctx.stroke();
 }
 /** A new touch: continue the region the user picked, else start the next one (the last one again when all five are used). */
 function startStroke(cx:number,cy:number){
  const list=regionsRef.current,picked=focusRef.current;
  let slot:number,created=false;
  if(picked!==null&&list.some(r=>r.slot===picked))slot=picked;
  else if(list.length<MAX_REGIONS){slot=[0,1,2,3,4].find(s=>!list.some(r=>r.slot===s))!;created=true;}
  else slot=list[list.length-1].slot;
  const m=layers.current[slot],ctx=m?.getContext("2d");if(!m||!ctx)return;
  history.current.push({slot,data:ctx.getImageData(0,0,m.width,m.height),created});if(history.current.length>30)history.current.shift();redoStack.current=[];bump();
  const p=toPhoto(cx,cy,slot);stroke.current={slot,last:p,created};paint(slot,p,p,p.k);
  if(created){const n=Math.max(0,...list.map(r=>r.n))+1,next=[...list,{slot,n,note:"",pin:{x:p.x/m.width,y:p.y/m.height}}];regionsRef.current=next;setRegions(next);}
 }
 /** A second finger arrived mid-stroke: that stroke was the start of a pinch, so it is taken back (and its new region with it). */
 function cancelStroke(){
  const s=stroke.current;if(!s)return;stroke.current=null;
  const last=history.current.pop(),ctx=layers.current[s.slot]?.getContext("2d");if(last&&ctx)ctx.putImageData(last.data,0,0);
  if(s.created){const next=regionsRef.current.filter(r=>r.slot!==s.slot);regionsRef.current=next;setRegions(next);}
  bump();
 }
 const dist=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);
 function down(e:React.PointerEvent<HTMLDivElement>){
  e.currentTarget.setPointerCapture(e.pointerId);pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
  const pts=[...pointers.current.values()];
  if(pts.length===2){cancelStroke();pan.current=null;pinch.current={d:dist(pts[0],pts[1]),mx:(pts[0].x+pts[1].x)/2,my:(pts[0].y+pts[1].y)/2,view:viewRef.current};return;}
  if(pts.length===1){if(hand||e.button===1)pan.current={x:e.clientX,y:e.clientY,view:viewRef.current};else startStroke(e.clientX,e.clientY);}
 }
 function move(e:React.PointerEvent<HTMLDivElement>){
  const box=stage.current?.getBoundingClientRect();if(box)setCursor(pointers.current.size>1?null:{x:e.clientX-box.left,y:e.clientY-box.top});
  if(!pointers.current.has(e.pointerId))return;pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
  const pts=[...pointers.current.values()];
  if(pinch.current&&pts.length>=2){
   const p=pinch.current,d=dist(pts[0],pts[1]),mx=(pts[0].x+pts[1].x)/2,my=(pts[0].y+pts[1].y)/2;
   setView({s:Math.min(MAX_S,Math.max(MIN_S,p.view.s*d/p.d)),x:p.view.x+(mx-p.mx),y:p.view.y+(my-p.my)});return;
  }
  if(pan.current){const p=pan.current;setView({...p.view,x:p.view.x+e.clientX-p.x,y:p.view.y+e.clientY-p.y});return;}
  const s=stroke.current;if(s){const p=toPhoto(e.clientX,e.clientY,s.slot);paint(s.slot,s.last,p,p.k);s.last=p;}
 }
 function up(e:React.PointerEvent<HTMLDivElement>){
  pointers.current.delete(e.pointerId);
  if(pointers.current.size<2)pinch.current=null;
  if(!pointers.current.size){
   pan.current=null;
   const s=stroke.current;stroke.current=null;
   if(s){
    // The next touch is a new region again; a new region's comment takes focus, like a new comment pin.
    setFocus(null);
    if(s.created)setFocusNote(s.slot);
   }
  }
 }
 function wheel(e:React.WheelEvent<HTMLDivElement>){
  const v=viewRef.current,s=Math.min(MAX_S,Math.max(MIN_S,v.s*(e.deltaY<0?1.15:1/1.15)));setView(s===1?{s:1,x:0,y:0}:{...v,s});
 }
 /** Undo and redo, stroke by stroke; a region a stroke created leaves with it and comes back with it (its comment kept). */
 const redoStack=useRef<{slot:number;before:ImageData;after:ImageData;created:boolean;region?:Draft}[]>([]);
 // How many steps undo and redo can take, for their buttons (the stacks themselves live in refs).
 const [steps,setSteps]=useState({u:0,r:0});const bump=()=>setSteps({u:history.current.length,r:redoStack.current.length});
 function undo(){
  const last=history.current.pop();if(!last)return;
  const m=layers.current[last.slot],ctx=m?.getContext("2d");if(!m||!ctx)return;
  const after=ctx.getImageData(0,0,m.width,m.height);ctx.putImageData(last.data,0,0);
  let region:Draft|undefined;
  if(last.created&&!maskHasPaint(m)){region=regionsRef.current.find(r=>r.slot===last.slot);const next=regionsRef.current.filter(r=>r.slot!==last.slot);regionsRef.current=next;setRegions(next);}
  redoStack.current.push({slot:last.slot,before:last.data,after,created:last.created,region});bump();
 }
 function redo(){
  const r=redoStack.current.pop();if(!r)return;
  const ctx=layers.current[r.slot]?.getContext("2d");if(!ctx)return;
  ctx.putImageData(r.after,0,0);history.current.push({slot:r.slot,data:r.before,created:r.created});
  if(r.region&&!regionsRef.current.some(x=>x.slot===r.slot)){const next=[...regionsRef.current,r.region].sort((a,b)=>a.n-b.n);regionsRef.current=next;setRegions(next);}
  bump();
 }
 function removeRegion(slot:number){
  const m=layers.current[slot];m?.getContext("2d")?.clearRect(0,0,m.width,m.height);
  history.current=history.current.filter(h=>h.slot!==slot);redoStack.current=redoStack.current.filter(h=>h.slot!==slot);bump();setRegions(l=>l.filter(r=>r.slot!==slot));if(focus===slot)setFocus(null);
 }
 /** Tapping a region (its pin or row): the next stroke continues it, and its comment is ready to edit. */
 function pick(slot:number){setFocus(slot);setHand(false);}
 function finish(){
  if(!regions.length)return;
  const empty=regions.find(r=>!r.note.trim());
  if(empty){setMissing(true);notes.current.get(empty.slot)?.focus();return;}
  onDone({masks:regions.map(r=>layers.current[r.slot]!),regions:regions.map(r=>({n:r.n,color:REGION_COLORS[r.slot].name,note:r.note.trim().slice(0,MAX_NOTE)}))});
 }
 const brushColor=focus!==null?REGION_COLORS[focus].css:regions.length<MAX_REGIONS?REGION_COLORS[[0,1,2,3,4].find(s=>!regions.some(r=>r.slot===s))!].css:colorCss(REGION_COLORS[regions[regions.length-1].slot].name);
 return <div role="dialog" aria-modal="true" aria-label={BRUSH_EDIT_FA+" "+displayTag(tag)} className="fixed inset-0 z-50 flex flex-col bg-background">
  {/* Top bar: close, title, done. */}
  <div className="flex h-14 shrink-0 items-center gap-2 border-b border-line-primary px-3">
   <Button type="button" size="icon" variant="ghost" onClick={onClose} aria-label="بستن"><Icon icon={X} aria-hidden="true"/></Button>
   <span className="min-w-0 flex-1 truncate type-label text-fg-primary">{BRUSH_EDIT_FA} <bdi className="text-fg-secondary">{displayTag(tag)}</bdi></span>
   <Button type="button" size="sm" onClick={finish} disabled={!regions.length}><Icon icon={Check} aria-hidden="true"/>{BRUSH_DONE_FA}</Button>
  </div>
  {/* The stage: the photo with every region's layer and pin, zoomed and moved by gestures. */}
  <div ref={stage} className="relative min-h-0 flex-1 touch-none overflow-hidden bg-black select-none" style={{cursor:hand?"grab":"none"}}
   onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onWheel={wheel} onPointerLeave={()=>setCursor(null)}>
   <div className="absolute inset-0 flex items-center justify-center p-2">
    <div className="relative" style={{transform:`translate(${view.x}px,${view.y}px) scale(${view.s})`,transformOrigin:"center"}}>
     {/* eslint-disable-next-line @next/next/no-img-element -- a local blob: URL */}
     <img src={photoUrl} alt="" draggable={false} onLoad={e=>setNatural({w:e.currentTarget.naturalWidth,h:e.currentTarget.naturalHeight})}
      className="pointer-events-none block h-auto max-h-[calc(100dvh-15rem)] w-auto max-w-[calc(100vw-1rem)]"/>
     {natural&&REGION_COLORS.map((c,slot)=><canvas key={c.name} width={natural.w} height={natural.h} ref={el=>{layers.current[slot]=el;}} aria-hidden="true"
      className="pointer-events-none absolute inset-0 size-full" style={{opacity:.55}}/>)}
     {/* Pins: each region's tag where it was first painted, the same size on screen at any zoom; the tag picks the region, its ✕ deletes it. */}
     {regions.map(r=><span key={r.slot} onPointerDown={e=>e.stopPropagation()}
      className={"absolute flex items-center rounded-[4px] "+(focus===r.slot?"ring-2 ring-white":"")}
      style={{left:r.pin.x*100+"%",top:r.pin.y*100+"%",background:REGION_COLORS[r.slot].css,color:REGION_COLORS[r.slot].ink,boxShadow:NEON_SHADOW,transform:`translate(-50%,-115%) scale(${1/view.s})`,transformOrigin:"bottom center"}}>
      <button type="button" onClick={()=>{pick(r.slot);notes.current.get(r.slot)?.focus({preventScroll:true});}} aria-pressed={focus===r.slot} aria-label={regionTagFa(r.n)+(r.note?": "+r.note:"")}
       className="hit-area py-0.5 ps-2 pe-1 type-caption font-medium"><bdi>{regionTagFa(r.n)}</bdi></button>
      <button type="button" onClick={()=>removeRegion(r.slot)} aria-label={"حذف "+regionTagFa(r.n)} className="hit-area flex size-5 items-center justify-center rounded-[4px] hover:bg-black/20">
       <Icon icon={X} size={16} aria-hidden="true" className="size-3"/></button>
     </span>)}
    </div>
   </div>
   {/* The brush cursor: a see-through neon dot the size of the brush, no border, lifted by a hard shadow. */}
   {cursor&&!hand&&<span aria-hidden="true" className="pointer-events-none absolute block aspect-square rounded-full"
    style={{left:cursor.x,top:cursor.y,width:BRUSH_SIZES[size].px,height:BRUSH_SIZES[size].px,transform:"translate(-50%,-50%)",background:brushColor,opacity:.6,boxShadow:NEON_SHADOW}}/>}
   {view.s>1&&<button type="button" onPointerDown={e=>e.stopPropagation()} onClick={()=>setView({s:1,x:0,y:0})} className="absolute start-2 top-2 rounded-full bg-background/80 px-3 py-1 type-caption text-fg-primary">اندازهٔ اصلی</button>}
   {/* Tools: a vertical card on the photo's left (the end side in RTL), see-through, 8px corners; padding keeps the selected ring whole (nothing clips it). */}
   <div role="toolbar" aria-orientation="vertical" aria-label="ابزار قلم" onPointerDown={e=>e.stopPropagation()} onPointerMove={()=>setCursor(null)}
    className="absolute end-4 top-1/2 flex -translate-y-1/2 flex-col items-center gap-1.5 rounded-[8px] border border-white/15 bg-background/75 p-2 shadow-lg backdrop-blur-md md:end-6" style={{cursor:"default"}}>
    {BRUSH_SIZES.map((b,i)=><button key={b.id} type="button" onClick={()=>{setSize(i);setHand(false);}} aria-pressed={size===i&&!hand} aria-label={"قلم "+b.labelFa} title={"قلم "+b.labelFa}
     className={"flex size-10 shrink-0 items-center justify-center rounded-[8px] motion-hover hover:bg-white/10 "+(size===i&&!hand?"bg-white/15 ring-2 ring-primary":"")}>
     <span className="block aspect-square shrink-0 grow-0 rounded-full" style={{width:Math.round(Math.min(26,4+b.px*.35)),height:Math.round(Math.min(26,4+b.px*.35)),minWidth:Math.round(Math.min(26,4+b.px*.35)),background:brushColor}}/></button>)}
    <span className="my-0.5 h-px w-6 bg-white/25" aria-hidden="true"/>
    <button type="button" onClick={()=>setHand(h=>!h)} aria-pressed={hand} aria-label="جابه‌جایی عکس" title="جابه‌جایی عکس"
     className={"flex size-10 items-center justify-center rounded-[8px] text-fg-primary motion-hover hover:bg-white/10 "+(hand?"bg-white/15 ring-2 ring-primary":"")}><Icon icon={Hand} aria-hidden="true"/></button>
    <button type="button" onClick={undo} disabled={!steps.u} aria-label="برگرد" title="برگرد" className="flex size-10 items-center justify-center rounded-[8px] text-fg-primary motion-hover hover:bg-white/10 disabled:opacity-40"><Icon icon={Undo2} aria-hidden="true"/></button>
    <button type="button" onClick={redo} disabled={!steps.r} aria-label="دوباره انجام بده" title="دوباره انجام بده" className="flex size-10 items-center justify-center rounded-[8px] text-fg-primary motion-hover hover:bg-white/10 disabled:opacity-40"><Icon icon={Redo2} aria-hidden="true"/></button>
   </div>
  </div>
  {/* The bottom sheet: one comment per region. Thumb-reachable on a phone. */}
  <div className="flex max-h-[45dvh] shrink-0 flex-col gap-2 overflow-y-auto border-t border-line-primary bg-surface-subtle p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
   {!regions.length&&<p className="type-caption text-fg-secondary">{BRUSH_HINT_FA}</p>}
   {regions.length>0&&focus===null&&regions.length<MAX_REGIONS&&<p className="type-caption text-fg-secondary">{CONTINUE_FA}</p>}
   {missing&&regions.some(r=>!r.note.trim())&&<p role="alert" className="type-caption text-error">{BRUSH_MISSING_NOTE_FA}</p>}
   <ul className="flex flex-col gap-2">
    {regions.map(r=><li key={r.slot} onClick={()=>pick(r.slot)} className={"flex items-start gap-2 rounded-control border p-2 "+(focus===r.slot?"border-primary bg-background":"border-line-primary")}>
     <div className="flex min-w-0 flex-1 flex-col gap-1">
      <bdi className="w-fit rounded-[4px] px-1.5 py-0.5 type-caption font-medium" style={{background:REGION_COLORS[r.slot].css,color:REGION_COLORS[r.slot].ink,boxShadow:NEON_SHADOW}}>{regionTagFa(r.n)}</bdi>
      <textarea ref={el=>{if(el)notes.current.set(r.slot,el);else notes.current.delete(r.slot);}} value={r.note} rows={1} maxLength={MAX_NOTE} placeholder={BRUSH_NOTE_PLACEHOLDER_FA}
       aria-label={"توضیح "+regionTagFa(r.n)} onChange={e=>{const v=e.target.value;setRegions(l=>l.map(x=>x.slot===r.slot?{...x,note:v}:x));}}
       className="w-full resize-none bg-transparent type-body text-fg-primary outline-none placeholder:text-fg-secondary [field-sizing:content]"/>
     </div>
     <button type="button" onClick={e=>{e.stopPropagation();removeRegion(r.slot);}} aria-label={"حذف "+regionTagFa(r.n)} className="hit-area flex size-8 shrink-0 items-center justify-center rounded-control text-fg-secondary hover:bg-surface-hover"><Icon icon={Trash2} size={16} aria-hidden="true"/></button>
    </li>)}
   </ul>
  </div>
 </div>;
}
