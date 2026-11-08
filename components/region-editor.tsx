"use client";
import {useEffect,useRef,useState} from "react";
import {Check,Hand,LoaderCircle,Pencil,Redo2,Trash2,Undo2,WandSparkles,X} from "lucide-react";
import {Button,Icon} from "@aleeforoughi/feather-react";
import {BRUSH_DONE_FA,BRUSH_EDIT_FA,BRUSH_HINT_FA,BRUSH_MISSING_NOTE_FA,BRUSH_NOTE_PLACEHOLDER_FA,BRUSH_SIZES,MAX_NOTE,MAX_REGIONS,NEON_SHADOW,REGION_COLORS,
 maskHasPaint,regionTagFa,type Region} from "@/lib/region-edit";
import {displayTag} from "@/lib/attachments";
import {paintSuggested} from "@/lib/suggested-masks";
import {maskAt,maskInBox,paintMask,prepare} from "@/lib/segment";
import {maskTop} from "@/lib/mask-refine";

/** A region: its colour slot (0..4, one layer each), its number (#ادیت-n), its comment, whether the comment was submitted (✓), and where its pin sits. */
type Draft={slot:number;n:number;note:string;done:boolean;pin:{x:number;y:number}};
type View={s:number;x:number;y:number};
/** Regions Whoush painted itself (boxes in 0..1 of the photo), opened for the user to confirm or change. */
export type SuggestedRegion={note:string;boxes:readonly (readonly [number,number,number,number])[]};
const MIN_S=1,MAX_S=8;
export const COMMENT_ADDED_FA="کامنت ثبت شد";
export const SUBMIT_COMMENT_FA="ثبت کامنت";
/** The wand's cursor, as in photo editors: a wand whose tip is a sparkle (the hotspot), white with a dark outline (readable on any photo), with its + or −. */
const wandCursor=(sign:"+"|"-")=>"url(\"data:image/svg+xml,"+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><g stroke-linecap="round"><path d="M7 1.5v3.2M7 9.3v3.2M1.5 7h3.2M9.3 7h3.2M3.1 3.1l2 2M8.9 8.9l2 2M10.9 3.1l-2 2M3.1 10.9l2-2" stroke="#111" stroke-width="3"/><path d="M7 1.5v3.2M7 9.3v3.2M1.5 7h3.2M9.3 7h3.2M3.1 3.1l2 2M8.9 8.9l2 2M10.9 3.1l-2 2M3.1 10.9l2-2" stroke="#fff" stroke-width="1.3"/><path d="M12.5 12.5l16 16" stroke="#111" stroke-width="5"/><path d="M12.5 12.5l16 16" stroke="#fff" stroke-width="2.6"/><path d="M12.5 12.5l3.2 3.2" stroke="#111" stroke-width="2.6"/></g><circle cx="24.5" cy="7.5" r="6" fill="#fff" stroke="#111" stroke-width="1.4"/><path d="'+(sign==="+"?"M21.3 7.5h6.4M24.5 4.3v6.4":"M21.3 7.5h6.4")+'" stroke="#111" stroke-width="1.8" stroke-linecap="round"/></svg>')+"\") 7 7, crosshair";
/** Outside a selection the wand adds (+); inside one it removes that object (−). */
const WAND_CURSOR={add:wandCursor("+"),remove:wandCursor("-")};
export const WAND_FA="انتخاب خودکار",WAND_HINT_FA="روی هر چیزی بزن تا دقیق انتخاب بشه؛ برای اضافه کردن، روی بقیه هم بزن.",WAND_LOADING_FA="انتخاب خودکار داره آماده می‌شه…",
 WAND_BUSY_FA="دارم انتخابش می‌کنم…",WAND_FAILED_FA="انتخاب خودکار روی این دستگاه کار نکرد؛ با قلم روش بکش.";

/**
 * The full-screen photo editor for «ادیت» (lib/region-edit.ts), mobile first (owner, 2026-11-06):
 * - the photo is fixed full screen and nothing scrolls while brushing (the whole editor takes every touch; only the comment field types);
 * - one region at a time: every touch paints the open region, in its colour, until its comment is submitted with ✓;
 * - when a stroke ends, the comment card appears fixed at the bottom over the photo; ✓ submits it, the card closes and the region shows as a badge
 *   «کامنت ثبت شد» (its pin on the photo too); tapping either opens it again to edit or paint more. Only then does a new touch start the next colour;
 * - two fingers pinch to zoom and move; on a computer the wheel zooms and the hand tool moves; undo and redo, five brush sizes.
 * Regions Whoush painted itself (`suggested`) open already submitted, for the user to confirm with «ثبت» or change.
 */
export function RegionEditor({tag,photoUrl,onClose,onDone,suggested}:{tag:string;photoUrl:string;onClose:()=>void;
 onDone:(r:{masks:HTMLCanvasElement[];regions:Region[]})=>void;suggested?:readonly SuggestedRegion[]}){
 const [regions,setRegions]=useState<Draft[]>([]);
 const [open,setOpen]=useState<number|null>(null);
 const [size,setSize]=useState(2);
 const [hand,setHand]=useState(false);
 // The magic wand (owner, 2026-11-08): a tap selects the object under it on the device (lib/segment.ts); more taps add to the same area.
 // The wand is the tool the editor opens with (owner, 2026-11-08); the photo starts encoding as soon as it opens.
 const [wand,setWand]=useState(true);
 const [wandState,setWandState]=useState<"idle"|"loading"|"ready"|"failed">("loading");
 const [wandBusy,setWandBusy]=useState(false);
 const [overSelection,setOverSelection]=useState(false);
 const tap=useRef<{x:number;y:number}|null>(null);
 const seg=useRef<Promise<string|null>|null>(null);
 const [view,setView]=useState<View>({s:1,x:0,y:0});
 const [natural,setNatural]=useState<{w:number;h:number}|null>(null);
 const [missing,setMissing]=useState(false);
 const [cursor,setCursor]=useState<{x:number;y:number}|null>(null);
 const [painting,setPainting]=useState<number|null>(null);
 const [steps,setSteps]=useState({u:0,r:0});
 const stage=useRef<HTMLDivElement>(null);
 const layers=useRef<(HTMLCanvasElement|null)[]>([]);
 const history=useRef<{slot:number;data:ImageData;created:boolean}[]>([]);
 const redoStack=useRef<{slot:number;before:ImageData;after:ImageData;created:boolean;region?:Draft}[]>([]);
 const pointers=useRef(new Map<number,{x:number;y:number}>());
 const stroke=useRef<{slot:number;last:{x:number;y:number};created:boolean}|null>(null);
 const pinch=useRef<{d:number;mx:number;my:number;view:View}|null>(null);
 const pan=useRef<{x:number;y:number;view:View}|null>(null);
 const viewRef=useRef(view),regionsRef=useRef(regions),openRef=useRef(open),seeded=useRef(false);
 useEffect(()=>{viewRef.current=view;regionsRef.current=regions;openRef.current=open;},[view,regions,open]);
 const bump=()=>setSteps({u:history.current.length,r:redoStack.current.length});
 // Nothing behind the editor scrolls or zooms while it is open (a phone would otherwise scroll the page under a stroke).
 useEffect(()=>{
  const html=document.documentElement,prev={b:document.body.style.overflow,h:html.style.overscrollBehavior};
  document.body.style.overflow="hidden";html.style.overscrollBehavior="none";
  const key=(e:KeyboardEvent)=>{if(e.key==="Escape")onClose();};window.addEventListener("keydown",key);
  return()=>{document.body.style.overflow=prev.b;html.style.overscrollBehavior=prev.h;window.removeEventListener("keydown",key);};
 },[onClose]);
 // Whoush's own regions: painted once the layers exist, submitted, ready to confirm or change.
 useEffect(()=>{
  if(!natural||seeded.current||!suggested?.length)return;
  seeded.current=true;
  const made:Draft[]=[];
  suggested.slice(0,MAX_REGIONS).forEach((sg,slot)=>{
   const ctx=layers.current[slot]?.getContext("2d");if(!ctx)return;
   paintSuggested(ctx,slot,sg.boxes,natural.w,natural.h);
   const b=sg.boxes[0];made.push({slot,n:slot+1,note:sg.note.slice(0,MAX_NOTE),done:true,pin:b?{x:(b[0]+b[2])/2,y:b[1]}:{x:.5,y:.5}});
  });
  regionsRef.current=made;
  // Seeding is a one-time sync with the canvases (an outside resource), so its state is set here once.
  setRegions(made);
  // Then each area becomes the exact object in its box (owner, 2026-11-08: no oval spilling over the photo), unless the user has touched it already.
  void (async()=>{
   const key=await ensureSeg(false);if(!key)return;
   for(const [slot,sg] of suggested.slice(0,MAX_REGIONS).entries()){
    const masks=[];
    for(const [x0,y0,x1,y1] of sg.boxes){try{masks.push(await maskInBox(key,[x0*natural.w,y0*natural.h,x1*natural.w,y1*natural.h]));}catch{masks.length=0;break;}}
    const layer=layers.current[slot],ctx=layer?.getContext("2d");
    if(!masks.length||!layer||!ctx||history.current.some(h=>h.slot===slot))continue;
    ctx.clearRect(0,0,layer.width,layer.height);for(const m of masks)paintMask(ctx,m,REGION_COLORS[slot].css);
   }
  })();
 },[natural,suggested]);
 // eslint-disable-next-line react-hooks/exhaustive-deps -- encode once per photo; ensureSeg keeps its own promise
 useEffect(()=>{void ensureSeg(false);},[photoUrl]);
 /** The photo encoded for the wand, once (null when the device cannot run it: the brush still works). */
 function ensureSeg(show:boolean):Promise<string|null>{
  if(show&&wandState==="idle")setWandState("loading");
  seg.current??=(async()=>{
   try{const blob=await (await fetch(photoUrl)).blob();await prepare(photoUrl,blob);setWandState("ready");return photoUrl;}
   catch(e){if(process.env.NODE_ENV!=="production")console.warn("[whoush] wand unavailable:",e instanceof Error?e.message:e);setWandState("failed");return null;}
  })();
  return seg.current;
 }
 /** The area painted under this point (the open one first), if any. */
 function selectedAt(cx:number,cy:number):number|null{
  const order=[...(openRef.current!==null?[openRef.current]:[]),...regionsRef.current.map(r=>r.slot).filter(s=>s!==openRef.current)];
  for(const slot of order){
   const m=layers.current[slot],ctx=m?.getContext("2d",{willReadFrequently:true});if(!m||!ctx)continue;
   const p=toPhoto(cx,cy,slot);if(p.x<0||p.y<0||p.x>=m.width||p.y>=m.height)continue;
   if(ctx.getImageData(Math.floor(p.x),Math.floor(p.y),1,1).data[3]>0)return slot;
  }
  return null;
 }
 /**
  * A wand tap (owner, 2026-11-08): outside a selection, the object under it joins the open area (a new area when none is open); on an object already
  * selected, that object is removed from its area. One step to undo either way.
  */
 async function wandTap(cx:number,cy:number){
  const key=await ensureSeg(true);if(!key)return;
  const hit=selectedAt(cx,cy);
  if(hit!==null){
   const m=layers.current[hit],ctx=m?.getContext("2d");if(!m||!ctx)return;
   const p=toPhoto(cx,cy,hit);
   setWandBusy(true);
   let mask;try{mask=await maskAt(key,[[p.x,p.y]]);}catch{setWandBusy(false);setWandState("failed");return;}
   setWandBusy(false);
   history.current.push({slot:hit,data:ctx.getImageData(0,0,m.width,m.height),created:false});if(history.current.length>30)history.current.shift();redoStack.current=[];bump();
   paintMask(ctx,mask,REGION_COLORS[hit].css,true);setOverSelection(false);
   openRef.current=hit;setOpen(hit);return;
  }
  const list=regionsRef.current,current=openRef.current;
  let slot:number,created=false;
  if(current!==null&&list.some(r=>r.slot===current))slot=current;
  else if(list.length<MAX_REGIONS){slot=[0,1,2,3,4].find(s=>!list.some(r=>r.slot===s))!;created=true;}
  else slot=list[list.length-1].slot;
  const m=layers.current[slot],ctx=m?.getContext("2d");if(!m||!ctx)return;
  const p=toPhoto(cx,cy,slot);if(p.x<0||p.y<0||p.x>m.width||p.y>m.height)return;
  setWandBusy(true);
  let mask;try{mask=await maskAt(key,[[p.x,p.y]]);}catch{setWandBusy(false);setWandState("failed");return;}
  setWandBusy(false);
  history.current.push({slot,data:ctx.getImageData(0,0,m.width,m.height),created});if(history.current.length>30)history.current.shift();redoStack.current=[];bump();
  paintMask(ctx,mask,REGION_COLORS[slot].css);setOverSelection(true);
  // The badge sits on the selection's top edge, never on the object (a second tap there removes it).
  if(created){const n=Math.max(0,...regionsRef.current.map(r=>r.n))+1,next=[...regionsRef.current,{slot,n,note:"",done:false,pin:maskTop(mask.plane,mask.w,mask.h)??{x:p.x/m.width,y:p.y/m.height}}];regionsRef.current=next;setRegions(next);}
  openRef.current=slot;setOpen(slot);
 }

 function toPhoto(cx:number,cy:number,slot:number){const m=layers.current[slot]!,r=m.getBoundingClientRect();return {x:(cx-r.left)*m.width/r.width,y:(cy-r.top)*m.height/r.height,k:m.width/r.width};}
 function paint(slot:number,from:{x:number;y:number},to:{x:number;y:number},k:number){
  const ctx=layers.current[slot]?.getContext("2d");if(!ctx)return;
  ctx.strokeStyle=REGION_COLORS[slot].css;ctx.lineCap="round";ctx.lineJoin="round";ctx.lineWidth=Math.max(2,BRUSH_SIZES[size].px*k);
  ctx.beginPath();ctx.moveTo(from.x,from.y);ctx.lineTo(to.x,to.y);ctx.stroke();
 }
 /** A touch paints the open region; with none open, it starts the next one (the last one again when all five are used). */
 function startStroke(cx:number,cy:number){
  const list=regionsRef.current,current=openRef.current;
  let slot:number,created=false;
  if(current!==null&&list.some(r=>r.slot===current))slot=current;
  else if(list.length<MAX_REGIONS){slot=[0,1,2,3,4].find(s=>!list.some(r=>r.slot===s))!;created=true;}
  else slot=list[list.length-1].slot;
  const m=layers.current[slot],ctx=m?.getContext("2d");if(!m||!ctx)return;
  history.current.push({slot,data:ctx.getImageData(0,0,m.width,m.height),created});if(history.current.length>30)history.current.shift();redoStack.current=[];bump();
  const p=toPhoto(cx,cy,slot);stroke.current={slot,last:p,created};paint(slot,p,p,p.k);setPainting(slot);
  if(created){const n=Math.max(0,...list.map(r=>r.n))+1,next=[...list,{slot,n,note:"",done:false,pin:{x:p.x/m.width,y:p.y/m.height}}];regionsRef.current=next;setRegions(next);}
  openRef.current=slot;setOpen(slot);
 }
 function cancelStroke(){
  const s=stroke.current;if(!s)return;stroke.current=null;setPainting(null);
  const last=history.current.pop(),ctx=layers.current[s.slot]?.getContext("2d");if(last&&ctx)ctx.putImageData(last.data,0,0);
  if(s.created){const next=regionsRef.current.filter(r=>r.slot!==s.slot);regionsRef.current=next;setRegions(next);openRef.current=null;setOpen(null);}
  bump();
 }
 const dist=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);
 function down(e:React.PointerEvent<HTMLDivElement>){
  e.preventDefault();
  try{e.currentTarget.setPointerCapture(e.pointerId);}catch{/* no capture */}
  pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
  const pts=[...pointers.current.values()];
  if(pts.length===2){tap.current=null;cancelStroke();pan.current=null;pinch.current={d:dist(pts[0],pts[1]),mx:(pts[0].x+pts[1].x)/2,my:(pts[0].y+pts[1].y)/2,view:viewRef.current};return;}
  if(pts.length===1){if(hand||e.button===1)pan.current={x:e.clientX,y:e.clientY,view:viewRef.current};else if(wand)tap.current={x:e.clientX,y:e.clientY};else startStroke(e.clientX,e.clientY);}
 }
 function move(e:React.PointerEvent<HTMLDivElement>){
  const box=stage.current?.getBoundingClientRect();if(box)setCursor(pointers.current.size>1?null:{x:e.clientX-box.left,y:e.clientY-box.top});
  if(wand&&!pointers.current.size&&e.pointerType==="mouse"){const over=selectedAt(e.clientX,e.clientY)!==null;if(over!==overSelection)setOverSelection(over);}
  if(!pointers.current.has(e.pointerId))return;pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
  const pts=[...pointers.current.values()];
  if(pinch.current&&pts.length>=2){
   const p=pinch.current,d=dist(pts[0],pts[1]),mx=(pts[0].x+pts[1].x)/2,my=(pts[0].y+pts[1].y)/2;
   setView({s:Math.min(MAX_S,Math.max(MIN_S,p.view.s*d/p.d)),x:p.view.x+(mx-p.mx),y:p.view.y+(my-p.my)});return;
  }
  if(tap.current&&Math.hypot(e.clientX-tap.current.x,e.clientY-tap.current.y)>10)tap.current=null;
  if(pan.current){const p=pan.current;setView({...p.view,x:p.view.x+e.clientX-p.x,y:p.view.y+e.clientY-p.y});return;}
  const s=stroke.current;if(s){const p=toPhoto(e.clientX,e.clientY,s.slot);paint(s.slot,s.last,p,p.k);s.last=p;}
 }
 function up(e:React.PointerEvent<HTMLDivElement>){
  pointers.current.delete(e.pointerId);
  if(pointers.current.size<2)pinch.current=null;
  if(!pointers.current.size){pan.current=null;stroke.current=null;setPainting(null);const t=tap.current;tap.current=null;if(t&&wand&&!wandBusy)void wandTap(t.x,t.y);}
 }
 function wheel(e:React.WheelEvent<HTMLDivElement>){
  const v=viewRef.current,s=Math.min(MAX_S,Math.max(MIN_S,v.s*(e.deltaY<0?1.15:1/1.15)));setView(s===1?{s:1,x:0,y:0}:{...v,s});
 }
 function undo(){
  const last=history.current.pop();if(!last)return;
  const m=layers.current[last.slot],ctx=m?.getContext("2d");if(!m||!ctx)return;
  const after=ctx.getImageData(0,0,m.width,m.height);ctx.putImageData(last.data,0,0);
  let region:Draft|undefined;
  if(last.created&&!maskHasPaint(m)){region=regionsRef.current.find(r=>r.slot===last.slot);const next=regionsRef.current.filter(r=>r.slot!==last.slot);regionsRef.current=next;setRegions(next);if(openRef.current===last.slot){openRef.current=null;setOpen(null);}}
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
  history.current=history.current.filter(h=>h.slot!==slot);redoStack.current=redoStack.current.filter(h=>h.slot!==slot);bump();
  const next=regionsRef.current.filter(r=>r.slot!==slot);regionsRef.current=next;setRegions(next);if(open===slot){openRef.current=null;setOpen(null);}
 }
 const setNote=(slot:number,note:string)=>setRegions(l=>l.map(r=>r.slot===slot?{...r,note}:r));
 /** ✓: the comment is in; the card closes, the region becomes a badge, and the next touch starts a new colour. */
 function submit(slot:number){const r=regions.find(x=>x.slot===slot);if(!r?.note.trim())return;setRegions(l=>l.map(x=>x.slot===slot?{...x,done:true}:x));openRef.current=null;setOpen(null);setMissing(false);}
 /** A badge or pin: open that region again (its comment to edit, its brush to paint more). */
 function reopen(slot:number){openRef.current=slot;setOpen(slot);setHand(false);}
 function finish(){
  if(!regions.length)return;
  const empty=regions.find(r=>!r.note.trim());
  if(empty){setMissing(true);reopen(empty.slot);return;}
  onDone({masks:regions.map(r=>layers.current[r.slot]!),regions:regions.map(r=>({n:r.n,color:REGION_COLORS[r.slot].name,note:r.note.trim().slice(0,MAX_NOTE)}))});
 }
 const nextSlot=[0,1,2,3,4].find(s=>!regions.some(r=>r.slot===s));
 const brushColor=painting!==null?REGION_COLORS[painting].css:open!==null?REGION_COLORS[open].css:nextSlot!==undefined?REGION_COLORS[nextSlot].css:REGION_COLORS[regions[regions.length-1].slot].css;
 const card=open!==null?regions.find(r=>r.slot===open):undefined;
 return <div role="dialog" aria-modal="true" aria-label={BRUSH_EDIT_FA+" "+displayTag(tag)} className="fixed inset-0 z-50 flex touch-none flex-col overscroll-none bg-black">
  {/* Top bar: close, title, done. */}
  <div className="flex h-14 shrink-0 items-center gap-2 border-b border-white/10 bg-background px-3">
   <Button type="button" size="icon" variant="ghost" onClick={onClose} aria-label="بستن"><Icon icon={X} aria-hidden="true"/></Button>
   <span className="min-w-0 flex-1 truncate type-label text-fg-primary">{BRUSH_EDIT_FA} <bdi className="text-fg-secondary">{displayTag(tag)}</bdi></span>
   <Button type="button" size="sm" onClick={finish} disabled={!regions.length}><Icon icon={Check} aria-hidden="true"/>{BRUSH_DONE_FA}</Button>
  </div>
  {/* The stage: the photo fixed full screen, every region's layer and pin, zoomed and moved by gestures; the tools and the comment card lie over it. */}
  <div ref={stage} className="relative min-h-0 flex-1 overflow-hidden select-none" style={{cursor:hand?"grab":wand?(wandBusy?"progress":WAND_CURSOR[overSelection?"remove":"add"]):"none"}}
   onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onWheel={wheel} onPointerLeave={()=>setCursor(null)}>
   <div className="absolute inset-0 flex items-center justify-center p-2">
    <div className="relative" style={{transform:`translate(${view.x}px,${view.y}px) scale(${view.s})`,transformOrigin:"center"}}>
     {/* eslint-disable-next-line @next/next/no-img-element -- a local blob: URL */}
     <img src={photoUrl} alt="" draggable={false} onLoad={e=>setNatural({w:e.currentTarget.naturalWidth,h:e.currentTarget.naturalHeight})}
      className="pointer-events-none block h-auto max-h-[calc(100dvh_-_4.5rem)] w-auto max-w-[calc(100vw-1rem)]"/>
     {natural&&REGION_COLORS.map((c,slot)=><canvas key={c.name} width={natural.w} height={natural.h} ref={el=>{layers.current[slot]=el;}} aria-hidden="true"
      className="pointer-events-none absolute inset-0 size-full" style={{opacity:.55}}/>)}
     {/* Pins: each region's tag where it was first painted (✓ once its comment is in), the same size on screen at any zoom; tap to open, ✕ to delete. */}
     {regions.map(r=><span key={r.slot} onPointerDown={e=>e.stopPropagation()} className={"absolute flex items-center rounded-[4px] "+(open===r.slot?"ring-2 ring-white":"")}
      style={{left:r.pin.x*100+"%",top:r.pin.y*100+"%",background:REGION_COLORS[r.slot].css,color:REGION_COLORS[r.slot].ink,boxShadow:NEON_SHADOW,transform:`translate(-50%,-115%) scale(${1/view.s})`,transformOrigin:"bottom center"}}>
      <button type="button" onClick={()=>reopen(r.slot)} aria-label={regionTagFa(r.n)+(r.note?": "+r.note:"")} className="hit-area flex items-center gap-0.5 rounded-[4px] py-0.5 ps-2 pe-1 type-caption font-medium hover:bg-black/20">
       {r.done&&<Icon icon={Check} size={16} aria-hidden="true" className="size-3"/>}<bdi>{regionTagFa(r.n)}</bdi></button>
      <button type="button" onClick={()=>removeRegion(r.slot)} aria-label={"حذف "+regionTagFa(r.n)} className="hit-area flex size-5 items-center justify-center rounded-[4px] hover:bg-black/20">
       <Icon icon={X} size={16} aria-hidden="true" className="size-3"/></button>
     </span>)}
    </div>
   </div>
   {cursor&&!hand&&!wand&&<span aria-hidden="true" className="pointer-events-none absolute block aspect-square rounded-full"
    style={{left:cursor.x,top:cursor.y,width:BRUSH_SIZES[size].px,height:BRUSH_SIZES[size].px,transform:"translate(-50%,-50%)",background:brushColor,opacity:.6,boxShadow:NEON_SHADOW}}/>}
   {wand&&(wandState!=="ready"||wandBusy)&&<p role="status" aria-live="polite" className="pointer-events-none absolute inset-x-0 top-3 mx-auto w-fit max-w-[80%] rounded-control bg-background/85 px-3 py-1.5 text-center type-caption text-fg-primary shadow-lg">
    {wandState==="failed"?WAND_FAILED_FA:wandState==="ready"?(wandBusy?WAND_BUSY_FA:WAND_HINT_FA):WAND_LOADING_FA}</p>}
   {view.s>1&&<button type="button" onPointerDown={e=>e.stopPropagation()} onClick={()=>setView({s:1,x:0,y:0})} className="absolute start-2 top-2 rounded-full bg-background/80 px-3 py-1 type-caption text-fg-primary motion-hover hover:bg-surface-pressed">اندازهٔ اصلی</button>}
   {/* Tools: a vertical card on the photo's left (the end side in RTL), 8px corners; padding keeps the selected ring whole. */}
   <div role="toolbar" aria-orientation="vertical" aria-label="ابزار قلم" onPointerDown={e=>e.stopPropagation()} onPointerMove={()=>setCursor(null)}
    className="absolute end-4 top-1/2 flex -translate-y-1/2 flex-col items-center gap-1.5 rounded-[8px] border border-white/15 bg-background/75 p-2 shadow-lg backdrop-blur-md md:end-6" style={{cursor:"default"}}>
    <button type="button" onClick={()=>{const on=!wand;setWand(on);if(on){setHand(false);void ensureSeg(true);}}} aria-pressed={wand} aria-label={WAND_FA} title={WAND_FA}
     className={"flex size-10 items-center justify-center rounded-[8px] text-fg-primary motion-hover hover:bg-white/10 "+(wand?"bg-white/15 ring-2 ring-primary":"")}>
     <Icon icon={wand&&(wandBusy||wandState==="loading")?LoaderCircle:WandSparkles} aria-hidden="true" className={wand&&(wandBusy||wandState==="loading")?"animate-spin motion-reduce:animate-none":undefined}/></button>
    <span className="my-0.5 h-px w-6 bg-white/25" aria-hidden="true"/>
    {BRUSH_SIZES.map((b,i)=><button key={b.id} type="button" onClick={()=>{setSize(i);setHand(false);setWand(false);}} aria-pressed={size===i&&!hand&&!wand} aria-label={"قلم "+b.labelFa} title={"قلم "+b.labelFa}
     className={"flex size-10 shrink-0 items-center justify-center rounded-[8px] motion-hover hover:bg-white/10 "+(size===i&&!hand&&!wand?"bg-white/15 ring-2 ring-primary":"")}>
     <span className="block aspect-square shrink-0 grow-0 rounded-full" style={{width:Math.round(Math.min(26,4+b.px*.35)),height:Math.round(Math.min(26,4+b.px*.35)),minWidth:Math.round(Math.min(26,4+b.px*.35)),background:brushColor}}/></button>)}
    <span className="my-0.5 h-px w-6 bg-white/25" aria-hidden="true"/>
    <button type="button" onClick={()=>{setHand(h=>!h);setWand(false);}} aria-pressed={hand} aria-label="جابه‌جایی عکس" title="جابه‌جایی عکس"
     className={"flex size-10 items-center justify-center rounded-[8px] text-fg-primary motion-hover hover:bg-white/10 "+(hand?"bg-white/15 ring-2 ring-primary":"")}><Icon icon={Hand} aria-hidden="true"/></button>
    <button type="button" onClick={undo} disabled={!steps.u} aria-label="برگرد" title="برگرد" className="flex size-10 items-center justify-center rounded-[8px] text-fg-primary motion-hover hover:bg-white/10 disabled:opacity-40"><Icon icon={Undo2} aria-hidden="true"/></button>
    <button type="button" onClick={redo} disabled={!steps.r} aria-label="دوباره انجام بده" title="دوباره انجام بده" className="flex size-10 items-center justify-center rounded-[8px] text-fg-primary motion-hover hover:bg-white/10 disabled:opacity-40"><Icon icon={Redo2} aria-hidden="true"/></button>
   </div>
   {/* The bottom, fixed over the photo: the comment card of the open region, or the submitted regions as badges (tap to open again), or the hint. */}
   <div onPointerDown={e=>e.stopPropagation()} onPointerMove={()=>setCursor(null)} className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]" style={{cursor:"default"}}>
    {card
     ?<div className="flex w-full max-w-md items-start gap-2 rounded-[8px] border border-white/15 bg-background/95 p-2 shadow-xl">
      <bdi className="mt-1 shrink-0 rounded-[4px] px-1.5 py-0.5 type-caption font-medium" style={{background:REGION_COLORS[card.slot].css,color:REGION_COLORS[card.slot].ink,boxShadow:NEON_SHADOW}}>{regionTagFa(card.n)}</bdi>
      <textarea value={card.note} rows={1} maxLength={MAX_NOTE} placeholder={BRUSH_NOTE_PLACEHOLDER_FA} aria-label={"توضیح "+regionTagFa(card.n)}
       onChange={e=>setNote(card.slot,e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();submit(card.slot);}}}
       className="min-w-0 flex-1 touch-auto resize-none bg-transparent py-1 type-body text-fg-primary outline-none placeholder:text-fg-secondary [field-sizing:content]"/>
      <button type="button" onClick={()=>removeRegion(card.slot)} aria-label={"حذف "+regionTagFa(card.n)} className="hit-area flex size-8 shrink-0 items-center justify-center rounded-[4px] text-fg-secondary hover:bg-surface-hover"><Icon icon={Trash2} size={16} aria-hidden="true"/></button>
      <Button type="button" size="icon" onClick={()=>submit(card.slot)} disabled={!card.note.trim()} aria-label={SUBMIT_COMMENT_FA}><Icon icon={Check} aria-hidden="true"/></Button>
     </div>
     :regions.length
      ?<ul className="flex max-w-full flex-wrap justify-center gap-1.5">{regions.map(r=><li key={r.slot}><button type="button" onClick={()=>reopen(r.slot)}
        className="flex items-center gap-1 rounded-[4px] bg-background/90 px-2 py-1 type-caption text-fg-primary shadow-md motion-hover hover:bg-surface-pressed" aria-label={regionTagFa(r.n)+": "+r.note+" — باز کردن"}>
        <span className="size-2.5 rounded-full" style={{background:REGION_COLORS[r.slot].css}} aria-hidden="true"/><bdi>{regionTagFa(r.n)}</bdi>
        <span className="text-fg-secondary">{r.done?COMMENT_ADDED_FA:"بدون کامنت"}</span><Icon icon={Pencil} size={16} aria-hidden="true" className="size-3 text-fg-secondary"/></button></li>)}</ul>
      :<p className="rounded-[8px] bg-background/85 px-3 py-2 text-center type-caption text-fg-secondary">{wand&&wandState!=="failed"?WAND_HINT_FA:BRUSH_HINT_FA}</p>}
    {missing&&regions.some(r=>!r.note.trim())&&<p role="alert" className="rounded-[8px] bg-background/90 px-3 py-1.5 type-caption text-error">{BRUSH_MISSING_NOTE_FA}</p>}
   </div>
  </div>
 </div>;
}
