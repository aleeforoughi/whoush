"use client";
import {useEffect,useId,useRef,useState,type KeyboardEvent,type PointerEvent,type ReactNode} from "react";
import {Box,ChevronDown,Plus,RotateCcw,Trash2,X} from "lucide-react";
import {Button,Icon} from "@aleeforoughi/feather-react";
import {LIGHT_ROLES,LIGHT_SOURCES,type Staging,type StagingLight} from "@/lib/creative-plan";
import {ANGLE_ORDER,CAMERA_ANGLE_FA,CAMERA_ELEVATION,GEL_COLORS,LIGHT_ANGLE,LIGHT_ASSETS,LIGHT_DIRECTION_FA,LIGHT_HEIGHT_FA,LIGHT_QUALITY_FA,LIGHT_ROLE_FA,LIGHT_SOURCE_FA,PROP_ASSETS,PROP_HEIGHT,
 SHOT_BODY_FRACTION,SHOT_SIZE_FA,SUBJECT_FA,TEMPERATURE_GRADIENT,lightHex,placementFa,polar,propPlaceFa,snapDirection,snapElevation,tidyProps,propInView,groundFromView,frameCamera,frameSize,propReach,propWidth,withFrameCuts,elevationOf,scaleOf,lightAngleOf,nearestShot,scaleFromSlider,sliderFromScale,zoomFactor,type SceneProp} from "@/lib/staging";
import {VISUALS} from "@/lib/visual-assets";
import {fa} from "@/lib/format";

/**
 * «بوم» (Canvas): the plan's scene as a small, adjustable lo-fi 3D viewport ("a little Blender") built from the pre-rendered asset pack (public/visuals, docs/VISUAL_ASSETS.md):
 * nothing is generated here. Three views share one draft staging:
 * - camera (side view): drag the camera smoothly along its arc around the main subject (any elevation); the dutch tilt is a toggle;
 * - frame (the camera's view): the props Whoush found in the conversation, laid out in depth (further back is higher and smaller) in front of the fixed environment backdrop; the shot size
 *   (slider) and aspect ratio (chips) crop it; dragging inside the frame slides the crop and snaps to thirds;
 * - scene (top view): drag props on the ground (left and right, front and back) and lights around the scene (eight directions); select one to adjust it
 *   (a prop's height above the ground, removing it; a light's role, source, softness, height, colour temperature and gel); add props and lights.
 * What is in the scene (subject, props, environment) comes from the conversation: Whoush builds it; here the user only arranges it. The environment is the
 * backdrop and never moves; props do. Everything works with touch, mouse and keyboard. All content stays inside each viewport.
 * With `onChange`, every adjustment flows to the generation card below, which builds exactly this scene; without it, read-only. The viewports are always dark, like a 3D app.
 */
/** The three views' captions (title pill and value), shared by the open canvas and the collapsed snapshots so both always say the same thing. */
function viewCaptions(s:Staging,aspect:string){
 const n=(s.props??[]).length;
 return {
  frame:{title:"کادر و چیدمان",value:SHOT_SIZE_FA[s.shotSize]+" · "+aspect+(n?" · "+fa(n)+" وسیله":"")},
  camera:{title:"زاویهٔ دوربین",value:CAMERA_ANGLE_FA[s.cameraAngle]+" · "+fa(Math.round(elevationOf(s)))+"°"},
  light:{title:"نورپردازی",value:s.lights.length===1?"یک منبع نور":fa(s.lights.length)+" منبع نور"}
 };
}
/** A plan without props (older plans) gets one: its subject, centre front. A planner's crowded layout is tidied for display (lib/staging.ts, tidyProps). */
function withProps(s:Staging):Staging{
 const subject=s.subject??"person";
 if(s.props||subject==="environment")return {...s,subject,props:tidyProps(s.props)??[]};
 return {...s,subject,props:[{kind:subject,label:SUBJECT_FA[subject],x:0,z:-0.25,y:0,main:true}]};
}
export function StagingEditor({staging,aspectRatio,onChange}:{staging:Staging;aspectRatio?:string;
 /** Live: every adjustment is reported (with whether it differs from Whoush's scene), so the generation card below uses it directly; without it, read-only. */
 onChange?:(s:Staging,aspect:string,changed:boolean)=>void}){
 const initial=withProps(staging);
 const [draft,setDraft]=useState<Staging>(initial),[aspect,setAspect]=useState(aspectRatio??"16:9");
 // The frame shows its own settings (zoom, aspect, crop) until a prop is selected; then only that prop's settings, until it is deselected. Lights select apart.
 const [propSel,setPropSel]=useState<number|null>(null),[lightSel,setLightSel]=useState(0);
 // All three views in one scroll, in this order: framing and layout, camera, lighting; each view's controls right under it.
 const editable=Boolean(onChange);
 const changed=JSON.stringify(draft)!==JSON.stringify(initial)||aspect!==(aspectRatio??"16:9");
 // Report every adjustment upward; the card below builds with it (no separate apply step).
 const report=useRef(onChange);
 useEffect(()=>{report.current=onChange;});
 const key=JSON.stringify(draft)+"|"+aspect;
 useEffect(()=>{report.current?.(withFrameCuts(draft,initial,aspect),aspect,changed);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- report when the draft or aspect actually changes
 },[key]);
 const set=(p:Partial<Staging>)=>setDraft(d=>({...d,...p}));
 const setLight=(i:number,p:Partial<StagingLight>)=>setDraft(d=>({...d,lights:d.lights.map((l,j)=>j===i?{...l,...p}:l)}));
 const props=draft.props??[];
 const setProp=(i:number,p:Partial<SceneProp>)=>setDraft(d=>({...d,props:(d.props??[]).map((x,j)=>j===i?{...x,...p}:x)}));
 // Collapsed by default: «بوم» is advanced settings. The card shows the scene in one line; opening it shows the canvas and its controls.
 const [open,setOpen]=useState(false),bodyId=useId();
 // Collapsed: three live snapshots of the scene as it is now (frame, camera, lighting), read-only; opening it shows the canvas and its controls.
 const cap=viewCaptions(draft,aspect);

 return <div role="group" aria-label="بوم" className="@container flex min-w-0 flex-col gap-3">
  <button type="button" aria-expanded={open} aria-controls={bodyId} onClick={()=>setOpen(o=>!o)}
   aria-label={"بوم، تنظیمات پیشرفته: "+CAMERA_ANGLE_FA[draft.cameraAngle]+"، "+SHOT_SIZE_FA[draft.shotSize]+"، "+(draft.lights.length===1?"یک نور":fa(draft.lights.length)+" نور")+(changed?"، تغییر کرده":"")}
   className="flex w-full flex-col gap-2 rounded-card border border-line-secondary bg-surface-subtle p-2 text-start motion-hover hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
   <span className="flex items-center gap-2 px-1">
    <Icon icon={Box} size={16} aria-hidden="true" className="size-4 shrink-0 text-fg-secondary"/>
    <span className="type-label text-fg-primary">بوم</span><span className="type-caption text-fg-secondary">تنظیمات پیشرفته</span>
    {changed&&<span className="rounded-control bg-surface-selected px-2 py-0.5 type-caption text-fg-primary">تغییر کرده</span>}
    <Icon icon={ChevronDown} size={16} aria-hidden="true" className={"ms-auto size-4 shrink-0 text-fg-secondary transition-transform motion-reduce:transition-none "+(open?"rotate-180":"")}/>
   </span>
   {!open&&<span className="grid grid-cols-1 gap-2">
    <Snap c={cap.frame}><FrameView staging={draft} anchor={initial} aspect={aspect}/></Snap>
    <Snap c={cap.camera}><CameraView staging={draft} editable={false} onElevation={()=>{}}/></Snap>
    <Snap c={cap.light}><LightView staging={draft} editable={false} selected={-1} onSelect={()=>{}} onLight={()=>{}}/></Snap>
   </span>}
  </button>
  <div id={bodyId} hidden={!open} className="flex min-w-0 flex-col gap-3">
  <div className="flex min-w-0 flex-col gap-3">
   <div><Viewport {...cap.frame}>
    <FrameView staging={draft} anchor={initial} aspect={aspect} editable={editable} onFraming={f=>set({framing:f})} sel={propSel} onSelect={setPropSel} onProp={(i,x,z)=>setProp(i,{x,z})}/>
    {editable&&propSel!==null&&props[propSel]&&<PropInspector prop={withFrameCuts(draft,initial,aspect).props![propSel]} reach={propReach(props[propSel],draft,initial,aspect)}
     onChange={p=>setProp(propSel,p)} onClose={()=>setPropSel(null)}/>}
    {editable&&(propSel===null||!props[propSel])&&<>
     <input type="range" min={0} max={1} step={0.001} value={1-sliderFromScale(scaleOf(draft))} onChange={e=>{const sc=scaleFromSlider(1-Number(e.target.value));set({shotScale:sc,shotSize:nearestShot(sc)});}}
      aria-label="زوم (اندازهٔ نما)" aria-valuetext={SHOT_SIZE_FA[draft.shotSize]+"، زوم "+zoomFactor(draft)+"×"} className="h-8 w-full cursor-pointer accent-primary"/>
     <div className="flex flex-wrap justify-center gap-1">{["16:9","3:2","4:5","1:1","9:16"].map(r=><Chip key={r} on={aspect===r} onClick={()=>setAspect(r)}><bdi>{r}</bdi></Chip>)}</div>
     <SliderRow label="جابه‌جایی کادر: چپ ↔ راست" valueText={pct(draft.framing?.x??0)} min={-1} max={1} step={0.01} value={draft.framing?.x??0}
      onChange={x=>{const y=draft.framing?.y??0;set({framing:x===0&&y===0?undefined:{x,y}});}}/>
     <SliderRow label="جابه‌جایی کادر: بالا ↔ پایین" valueText={pct(draft.framing?.y??0)} min={-1} max={1} step={0.01} value={draft.framing?.y??0}
      onChange={y=>{const x=draft.framing?.x??0;set({framing:x===0&&y===0?undefined:{x,y}});}}/>
     <p className="text-center type-caption text-fg-secondary">{props.length?"روی یه وسیله بزن تا تنظیماتش بیاد و بکشیش (بالا عقب، پایین جلو، حتی تا بیرون کادر)؛ ":""}پس‌زمینه رو بکشی، کادر جابه‌جا می‌شه.</p>
    </>}
   </Viewport>
   </div>
   <div><Viewport {...cap.camera}>
    <CameraView staging={draft} editable={editable} onElevation={e=>set({cameraElevation:e,cameraAngle:draft.cameraAngle==="dutch"?"dutch":snapElevation(e)})}/>
    {editable&&<SliderRow label="ارتفاع دوربین" valueText={CAMERA_ANGLE_FA[draft.cameraAngle]+" · "+fa(Math.round(elevationOf(draft)))+"°"} min={-60} max={85} step={1} value={elevationOf(draft)}
     onChange={e=>set({cameraElevation:e,cameraAngle:draft.cameraAngle==="dutch"?"dutch":snapElevation(e)})}/>}
    {editable&&<div className="flex justify-center"><Chip on={draft.cameraAngle==="dutch"} onClick={()=>set({cameraAngle:draft.cameraAngle==="dutch"?snapElevation(elevationOf(draft)):"dutch"})}>زاویهٔ کج</Chip></div>}
   </Viewport></div>
   <div>
    <Viewport {...cap.light}>
     <LightView staging={draft} editable={editable} selected={lightSel} onSelect={setLightSel} onLight={(i,deg)=>setLight(i,{angle:deg,direction:snapDirection(deg)})}/>
    </Viewport>
    {editable&&draft.lights[lightSel]&&<div className="mt-2"><LightInspector light={draft.lights[lightSel]} canRemove={draft.lights.length>1}
     onChange={p=>setLight(lightSel,p)}
     onRemove={()=>{const i=lightSel;setDraft(d=>({...d,lights:d.lights.filter((_,j)=>j!==i)}));setLightSel(0);}}
     onAdd={draft.lights.length<4?()=>{setDraft(d=>({...d,lights:[...d.lights,{role:"fill",direction:"front_right",height:"eye",quality:"soft",source:"softbox",colorTemperatureK:5600}]}));setLightSel(draft.lights.length);}:undefined}/></div>}
   </div>
  </div>
  {!editable&&<ul className="flex flex-col gap-1">{draft.lights.map((l,i)=><LightRow key={i} l={l}/>)}</ul>}
  {editable&&changed&&<div className="flex flex-wrap items-center gap-2">
   <Button type="button" variant="ghost" size="sm" onClick={()=>{setDraft(initial);setAspect(aspectRatio??"16:9");setPropSel(null);setLightSel(0);}}><Icon icon={RotateCcw} aria-hidden="true"/>برگرد به پیشنهاد هووش</Button>
   <p className="type-caption text-fg-secondary">با «بساز» همین صحنه ساخته می‌شه.</p>
  </div>}
  </div>
 </div>;
}

/**
 * One collapsed snapshot, as a row of the vertical list: the same view drawing (same component, same scene) in the same dark tile as the open canvas, with the
 * same caption (title pill and value) beside it.
 */
function Snap({c,children}:{c:{title:string;value:string};children:ReactNode}){
 return <span className="flex min-w-0 items-center gap-3">
  <span className="dark flex h-24 w-40 shrink-0 items-center justify-center overflow-hidden rounded-card bg-background p-1.5 text-fg-primary [&_svg]:h-full! [&_svg]:max-h-full! [&_svg]:w-auto! [&_svg]:max-w-full! [&_svg]:pointer-events-none">{children}</span>
  <span className="flex min-w-0 flex-col items-start gap-1">
   <span className="rounded-control bg-surface-hover px-2 py-0.5 type-caption text-fg-secondary">{c.title}</span>
   <span className="type-label text-fg-primary">{c.value}</span>
  </span>
 </span>;
}
/** A dark viewport tile with a caption pill and the value, as in the design reference. */
function Viewport({title,value,children}:{title:string;value:string;children:ReactNode}){
 return <figure className="dark flex min-w-0 flex-col gap-2 overflow-hidden rounded-card bg-background p-3 text-fg-primary">
  <div className="flex flex-col gap-2">{children}</div>
  <figcaption className="flex flex-col items-center gap-1 pt-1">
   <span className="rounded-control bg-surface-hover px-3 py-0.5 type-caption text-fg-secondary">{title}</span>
   <span className="type-label text-fg-primary">{value}</span>
  </figcaption>
 </figure>;
}
function Chip({on,onClick,children,role}:{on:boolean;onClick:()=>void;children:ReactNode;role?:"radio"}){
 return <button type="button" role={role} aria-pressed={role?undefined:on} aria-checked={role?on:undefined} onClick={onClick}
  className={"h-7 rounded-control border px-2 type-caption motion-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring "+(on?"border-primary bg-surface-selected text-fg-primary":"border-line-secondary text-fg-secondary hover:bg-surface-hover")}>{children}</button>;
}
/** An asset from the pack, placed by its bottom centre (x, y) at a given height, optionally mirrored or rotated about its centre. */
function Asset({id,x,y,h,mirror,rotate=0,opacity=1}:{id:string;x:number;y:number;h:number;mirror?:boolean;rotate?:number;opacity?:number}){
 const a=VISUALS[id];if(!a)return null;
 const w=h*a.width/a.height,cx=x,cy=y-h/2;
 return <image href={a.src} x={x-w/2} y={y-h} width={w} height={h} opacity={opacity} preserveAspectRatio="xMidYMid meet"
  transform={"rotate("+rotate+" "+cx+" "+cy+")"+(mirror?" translate("+2*cx+" 0) scale(-1 1)":"")}/>;
}

/** The main prop (or the first), whose side view the camera view shows; an environment-only scene shows the landscape. */
const mainProp=(s:Staging)=>(s.props??[]).find(p=>p.main)??(s.props??[])[0];
const SIDE:Record<SceneProp["kind"],string>={person:"person-side",object:"object-side",animal:"animal-side",vehicle:"vehicle-side",tree:"env-tree",building:"env-building"};

/** Side view: the main subject on the ground, the camera on an arc around its focus point. Sized so the whole arc (bird's-eye to worm's-eye) stays inside. */
function CameraView({staging,editable,onElevation}:{staging:Staging;editable:boolean;onElevation:(deg:number)=>void}){
 const svg=useRef<SVGSVGElement>(null),[drag,setDrag]=useState<number|null>(null);
 const VW=220,VH=190,R=72,focus:[number,number]=[72,92];
 const m=mainProp(staging),kind=m?.kind;
 const size=kind?Math.min(92,PROP_HEIGHT[kind]*92):58,ground=Math.min(VH-8,focus[1]+(kind==="person"?size*0.9:size*0.55));
 const elev=drag??elevationOf(staging),[cx,cy]=polar(focus[0],focus[1],R,-elev);
 const aim=Math.atan2(focus[1]-cy,focus[0]-cx)*180/Math.PI,roll=staging.cameraAngle==="dutch"?14:0;
 const elevAt=(e:PointerEvent)=>{const r=svg.current!.getBoundingClientRect();const x=(e.clientX-r.left)*VW/r.width,y=(e.clientY-r.top)*VH/r.height;
  return Math.max(-60,Math.min(85,-Math.atan2(y-focus[1],x-focus[0])*180/Math.PI));};
 const key=(e:KeyboardEvent)=>{const step=e.key==="ArrowUp"||e.key==="ArrowRight"?5:e.key==="ArrowDown"||e.key==="ArrowLeft"?-5:0;if(!step)return;e.preventDefault();onElevation(Math.max(-60,Math.min(85,Math.round(elev+step))));};
 return <svg ref={svg} viewBox={"0 0 "+VW+" "+VH} className="mx-auto block aspect-[22/19] w-full max-w-sm touch-none select-none text-fg-primary" aria-hidden={!editable}
  onPointerMove={e=>{if(drag!==null){const v=elevAt(e);if(Number.isFinite(v))setDrag(v);}}} onPointerUp={()=>{if(drag!==null){if(Number.isFinite(drag))onElevation(Math.round(drag));setDrag(null);}}} onPointerCancel={()=>setDrag(null)}>
  <path d={"M"+polar(focus[0],focus[1],R,-85).join(" ")+" A"+R+" "+R+" 0 0 1 "+polar(focus[0],focus[1],R,60).join(" ")} fill="none" stroke="currentColor" strokeOpacity=".4" strokeWidth={1} strokeDasharray="3 4" vectorEffect="non-scaling-stroke"/>
  <line x1={6} x2={VW-6} y1={ground} y2={ground} stroke="currentColor" strokeOpacity=".3" strokeWidth={1} vectorEffect="non-scaling-stroke"/>
  {kind?<Asset id={SIDE[kind]} x={focus[0]} y={ground} h={size}/>:<><Asset id="env-mountains" x={focus[0]} y={ground} h={52}/><Asset id="env-tree" x={focus[0]+44} y={ground} h={30}/></>}
  <line x1={cx} y1={cy} x2={focus[0]} y2={focus[1]} className="stroke-primary" strokeWidth={1.2} strokeDasharray="4 3" vectorEffect="non-scaling-stroke"/>
  <g role={editable?"slider":undefined} tabIndex={editable?0:undefined} aria-label="زاویهٔ دوربین" aria-valuetext={CAMERA_ANGLE_FA[staging.cameraAngle]+"، "+Math.round(elev)+" درجه"}
   aria-valuemin={-60} aria-valuemax={85} aria-valuenow={Math.round(elev)}
   onKeyDown={editable?key:undefined} onPointerDown={editable?e=>{capture(svg.current,e.pointerId);setDrag(elevAt(e));}:undefined}
   className={editable?"cursor-grab outline-none focus-visible:[&>circle]:stroke-primary":""}>
   <circle cx={cx} cy={cy} r={24} fill="transparent" strokeWidth={2}/>
   <Asset id="camera-side" x={cx+6} y={cy+11} h={22} rotate={aim-180+roll}/>
  </g>
 </svg>;
}

/** Captures the pointer for a drag; some pointers cannot be captured (it throws), and the drag still works without it. */
function capture(el:Element|null,id:number){try{el?.setPointerCapture(id);}catch{ /* not capturable */ }}
/** "w:h" as a number, 16:9 when unreadable. */
function ratioOf(aspect:string):number{const m=/^(\d+(?:\.\d+)?)[:x×/](\d+(?:\.\d+)?)$/.exec(aspect.trim());const r=m?Number(m[1])/Number(m[2]):16/9;return r>0.2&&r<5?r:16/9;}
const THIRD=1/3;
/** A framing offset, clamped and rounded; smooth (no snapping), the thirds lines only light up when the subject is on one. */
const snapAxis=(v:number)=>Math.max(-1,Math.min(1,Math.round(v*100)/100));
/**
 * The camera's view at the aspect ratio with thirds, and where props are arranged: the fixed environment backdrop, then each prop in depth (further back
 * stands higher on the ground plane and is smaller; drawn back to front), scaled by the shot size around the main subject.
 * - Drag a prop: sideways moves it left and right, up moves it back, down brings it forward (its lift above the ground is in the inspector).
 * - Drag the empty background: slides the crop like a crop tool, snapping to the thirds and the centre.
 * - Keyboard: arrow keys move the selected prop (or the crop when the frame itself has focus).
 */
function FrameView({staging,anchor,aspect,editable,onFraming,sel,onSelect,onProp}:{staging:Staging;
 /** The scene whose main subject anchors the zoom (Whoush's original layout): fixed while props move, so moving the main subject moves only it. */anchor?:Staging;
 aspect:string;editable?:boolean;onFraming?:(f:{x:number;y:number}|undefined)=>void;
 /** The selected prop (null: none, the frame's own settings show). */sel?:number|null;onSelect?:(i:number|null)=>void;onProp?:(i:number,x:number,z:number)=>void}){
 const clip=useId(),svg=useRef<SVGSVGElement>(null),{W,H}=frameSize(aspect);
 const [drag,setDrag]=useState<{px:number;py:number;x:number;y:number;cur:{x:number;y:number}}|null>(null);
 const [move,setMove]=useState<{i:number;px:number;py:number;x0:number;z0:number;x:number;z:number}|null>(null);
 const fr=drag?.cur??staging.framing??{x:0,y:0};
 const base=(staging.props??[]).map((p,i)=>move?.i===i?{...p,x:move.x,z:move.z}:p);
 const order=base.map((p,i)=>({p,i})).sort((a,b)=>b.p.z-a.p.z);
 // The scene is laid out once, in fixed world positions; the shot size is a pure zoom of that world about the original main subject, which the frame
 // centres (lib/staging.ts, frameCamera): zooming never moves anything relative to anything else, and moving any prop (the main subject too) moves only it.
 const cam=frameCamera({...staging,framing:fr},anchor,W,H),{unitH,k}=cam,horizon=H*0.5;
 const at=(p:SceneProp)=>{const v=propInView(p,W,H,unitH);return {x:v.x,ground:v.groundY,y:v.y,h:v.h};};
 const world="matrix("+k+" 0 0 "+k+" "+cam.toScreen(0,0).join(" ")+")";
 const onX=Math.abs(Math.abs(fr.x)-THIRD)<0.03,onY=Math.abs(Math.abs(fr.y)-THIRD)<0.03;
 const unit=()=>{const b=svg.current!.getBoundingClientRect();return {sx:(W+4)/b.width,sy:(H+4)/b.height};};
 const commit=(v:{x:number;y:number})=>onFraming?.(v.x===0&&v.y===0?undefined:v);
 /** A ground point limited to where the prop may go at this zoom and crop: as far out of the frame on the left as on the right, and into the bottom edge. */
 const within=(p:SceneProp,g:{x:number;z:number})=>{const r=propReach(p,staging,anchor,aspect);const c=(v:number,lo:number,hi:number)=>Math.round(Math.max(lo,Math.min(hi,v))*100)/100;return {x:c(g.x,r.xMin,r.xMax),z:c(g.z,r.zMin,r.zMax)};};
 /** The ground point (x, z) under a world point: the inverse of `at` on the ground plane. */
 const ground=(gx:number,gy:number)=>groundFromView(gx,gy,W,H);
 const key=(e:KeyboardEvent)=>{
  const d={ArrowLeft:[-0.05,0],ArrowRight:[0.05,0],ArrowUp:[0,-0.05],ArrowDown:[0,0.05]}[e.key as "ArrowLeft"];if(!d)return;e.preventDefault();
  commit({x:snapAxis(fr.x+d[0]),y:snapAxis(fr.y+d[1])});
 };
 const third=(on:boolean,neg:boolean,i:number)=>on&&(i===1)===neg;
 return <svg ref={svg} viewBox={"-2 -2 "+(W+4)+" "+(H+4)} className="mx-auto block w-full touch-none select-none text-fg-primary" style={{aspectRatio:String((W+4)/(H+4)),maxWidth:Math.round(320*(W+4)/(H+4))+"px"}} aria-hidden={!editable}
  onPointerMove={e=>{
   const u=unit();
   if(move){const p0=at({...base[move.i],x:move.x0,z:move.z0,y:0});const g=ground(p0.x+(e.clientX-move.px)*u.sx/k,p0.ground+(e.clientY-move.py)*u.sy/k);if(Number.isFinite(g.x)&&Number.isFinite(g.z))setMove({...move,...within({...base[move.i],z:g.z},g)});return;}
   if(drag){const c={x:snapAxis(drag.x+(e.clientX-drag.px)*u.sx/(W/2)),y:snapAxis(drag.y+(e.clientY-drag.py)*u.sy/(H/2))};if(Number.isFinite(c.x)&&Number.isFinite(c.y))setDrag({...drag,cur:c});}}}
  onPointerUp={()=>{if(move){onProp?.(move.i,move.x,move.z);setMove(null);}if(drag){commit(drag.cur);setDrag(null);}}} onPointerCancel={()=>{setDrag(null);setMove(null);}}>
  <defs><clipPath id={clip}><rect width={W} height={H} rx={6}/></clipPath>
   <linearGradient id={clip+"g"} x1="0" y1="0" x2="0" y2="1"><stop offset=".5" stopColor="currentColor" stopOpacity="0"/><stop offset="1" stopColor="currentColor" stopOpacity=".14"/></linearGradient></defs>
  <g clipPath={"url(#"+clip+")"}>
   <rect width={W} height={H} className="fill-background"/>
   {editable&&<rect width={W} height={H} fill="transparent" role="slider" tabIndex={0} aria-label={"جای سوژه در کادر: "+placementFa(staging.framing)} aria-valuetext={placementFa(staging.framing)}
    aria-valuenow={Math.round(fr.x*100)} aria-valuemin={-100} aria-valuemax={100} onKeyDown={key} className={"outline-none "+(drag?"cursor-grabbing":"cursor-grab")}
    onPointerDown={e=>{onSelect?.(null);capture(svg.current,e.pointerId);setDrag({px:e.clientX,py:e.clientY,x:fr.x,y:fr.y,cur:fr});}}/>}
   <g transform={world} className="pointer-events-none">
    <rect x={-W*4} y={horizon} width={W*9} height={H*4} fill={"url(#"+clip+"g)"}/>
    <line x1={-W*4} x2={W*5} y1={horizon} y2={horizon} stroke="currentColor" strokeOpacity=".3" strokeWidth={1} vectorEffect="non-scaling-stroke"/>
    {/* The environment is the fixed backdrop behind every prop, in the same world: it zooms with the scene and never moves on its own. */}
    <Asset id="env-mountains" x={W*0.5} y={horizon+1} h={H*0.32} opacity={0.7}/>
   </g>
   <g transform={world}>
    {order.map(({p,i})=>{const a=at(p),w=propWidth(p.kind,a.h),on=sel===i;
     const pkey=(e:KeyboardEvent)=>{if(e.key==="Escape"&&on){e.preventDefault();e.stopPropagation();onSelect?.(null);return;}
      const d={ArrowLeft:[-0.1,0],ArrowRight:[0.1,0],ArrowUp:[0,0.1],ArrowDown:[0,-0.1]}[e.key as "ArrowLeft"];if(!d)return;e.preventDefault();e.stopPropagation();onSelect?.(i);const g=within(p,{x:p.x+d[0],z:p.z+d[1]});onProp?.(i,g.x,g.z);};
     return <g key={i} role={editable?"button":undefined} tabIndex={editable?0:undefined} aria-label={p.label+"، "+propPlaceFa(p)} aria-pressed={editable?on:undefined}
      onKeyDown={editable?pkey:undefined} onClick={editable?()=>onSelect?.(i):undefined}
      onPointerDown={editable?e=>{e.stopPropagation();onSelect?.(i);capture(svg.current,e.pointerId);setMove({i,px:e.clientX,py:e.clientY,x0:p.x,z0:p.z,x:p.x,z:p.z});}:undefined}
      className={editable?(move?.i===i?"cursor-grabbing outline-none":"cursor-grab outline-none"):""}>
      {p.y>0.05&&<ellipse cx={a.x} cy={a.ground} rx={w*0.35} ry={Math.max(1,a.h*0.04)} fill="currentColor" fillOpacity=".18"/>}
      <rect x={a.x-Math.max(w,12/k)/2} y={a.y-Math.max(a.h,12/k)} width={Math.max(w,12/k)} height={Math.max(a.h,12/k)} fill="transparent"/>
      <Asset id={PROP_ASSETS[p.kind].front} x={a.x} y={a.y} h={a.h}/>
      {on&&<rect x={a.x-w/2-1} y={a.y-a.h-1} width={w+2} height={a.h+2} rx={2} fill="none" className="stroke-primary" strokeWidth={1} vectorEffect="non-scaling-stroke" strokeDasharray="3 2"/>}
     </g>;})}
   </g>
   {[1,2].map(i=><g key={i} strokeDasharray="3 3" strokeWidth={1} className="pointer-events-none">
    <line vectorEffect="non-scaling-stroke" x1={W*i/3} x2={W*i/3} y1={0} y2={H} className={third(onX,fr.x<0,i)?"stroke-primary":""} stroke={third(onX,fr.x<0,i)?undefined:"currentColor"} strokeOpacity={third(onX,fr.x<0,i)?1:.3}/>
    <line vectorEffect="non-scaling-stroke" x1={0} x2={W} y1={H*i/3} y2={H*i/3} className={third(onY,fr.y<0,i)?"stroke-primary":""} stroke={third(onY,fr.y<0,i)?undefined:"currentColor"} strokeOpacity={third(onY,fr.y<0,i)?1:.3}/>
   </g>)}
  </g>
  {/* The selected prop's name in a blue tag above it, at a constant size on screen (outside the zoom), kept inside the frame. */}
  {editable&&sel!=null&&base[sel]&&(()=>{const p=base[sel],a=at(p),[tx,ty0]=cam.toScreen(a.x,a.y-a.h),tw=Math.min(W-4,p.label.length*3.6+10);
   const x=Math.max(2,Math.min(W-2-tw,tx-tw/2)),y=Math.max(2,Math.min(H-12,ty0-13));
   return <g className="pointer-events-none" aria-hidden="true"><rect x={x} y={y} width={tw} height={10} rx={3} className="fill-primary"/>
    <text x={x+tw/2} y={y+7.2} textAnchor="middle" fontSize={6.5} className="fill-primary-foreground font-medium">{p.label}</text></g>;})()}
  <rect width={W} height={H} rx={6} fill="none" stroke="currentColor" strokeOpacity=".75" strokeWidth={1.2} vectorEffect="non-scaling-stroke" className="pointer-events-none"/>
 </svg>;
}

/**
 * Lighting, seen from above: only the target (the main subject; the environment when there is none) in the middle facing the camera at the bottom, and the
 * lights around it with their colour, softness and beam. Drag a light around the circle (it snaps to eight directions); arrow keys turn the selected light.
 */
function LightView({staging,editable,selected,onSelect,onLight}:{staging:Staging;editable:boolean;selected:number;onSelect:(i:number)=>void;onLight:(i:number,deg:number)=>void}){
 const svg=useRef<SVGSVGElement>(null),uid=useId(),[drag,setDrag]=useState<{i:number;deg:number}|null>(null);
 const VW=240,VH=230,C:[number,number]=[120,104],R=76;
 const pt=(e:PointerEvent)=>{const r=svg.current!.getBoundingClientRect();return [(e.clientX-r.left)*VW/r.width,(e.clientY-r.top)*VH/r.height] as const;};
 const target=mainProp(staging);
 return <svg ref={svg} viewBox={"0 0 "+VW+" "+VH} className="mx-auto block aspect-[240/230] w-full max-w-sm touch-none select-none text-fg-primary"
  onPointerMove={e=>{if(drag){const [x,y]=pt(e),deg=Math.atan2(y-C[1],x-C[0])*180/Math.PI;if(Number.isFinite(deg))setDrag({...drag,deg});}}}
  onPointerUp={()=>{if(drag){if(Number.isFinite(drag.deg))onLight(drag.i,Math.round(((drag.deg%360)+360)%360));setDrag(null);}}} onPointerCancel={()=>setDrag(null)}>
  <circle cx={C[0]} cy={C[1]} r={R} fill="none" stroke="currentColor" strokeOpacity=".35" strokeWidth={1} strokeDasharray="2 4" vectorEffect="non-scaling-stroke"/>
  <line x1={C[0]} y1={C[1]+24} x2={C[0]} y2={VH-34} stroke="currentColor" strokeOpacity=".35" strokeWidth={1} strokeDasharray="3 4" vectorEffect="non-scaling-stroke"/>
  {staging.lights.map((l,i)=>{
   const isDrag=drag?.i===i,top=l.direction==="top";
   const [x,y]=isDrag?polar(C[0],C[1],R,drag!.deg):top?[C[0]+(i%2?20:-20),C[1]-32]:polar(C[0],C[1],R,lightAngleOf(l)??LIGHT_ANGLE.front);
   const color=lightHex(l),soft=l.quality==="soft",g=uid+"-l"+i,toward=Math.atan2(C[1]-y,C[0]-x),spread=soft?0.5:0.22,len=Math.hypot(C[0]-x,C[1]-y)-14;
   const [ax,ay]=[x+len*Math.cos(toward-spread),y+len*Math.sin(toward-spread)],[bx,by]=[x+len*Math.cos(toward+spread),y+len*Math.sin(toward+spread)];
   const on=selected===i,deg=Math.atan2(y-C[1],x-C[0])*180/Math.PI;
   const [ox,oy]=top?[x,y-20]:polar(C[0],C[1],R+19,deg),[lx,ly]=top?[x,y+21]:polar(C[0],C[1],R-22,deg);
   const key=(e:KeyboardEvent)=>{const step=e.key==="ArrowRight"||e.key==="ArrowDown"?10:e.key==="ArrowLeft"||e.key==="ArrowUp"?-10:0;if(!step||top)return;e.preventDefault();onSelect(i);onLight(i,(((lightAngleOf(l)??90)+step)%360+360)%360);};
   return <g key={i} role={editable?"button":undefined} tabIndex={editable?0:undefined} aria-label={LIGHT_ROLE_FA[l.role]+"، "+LIGHT_DIRECTION_FA[l.direction]+(l.angle!==undefined?" ("+Math.round(l.angle)+" درجه)":"")} aria-pressed={editable?on:undefined}
    onKeyDown={editable?key:undefined} onClick={editable?()=>onSelect(i):undefined}
    onPointerDown={editable&&!top?e=>{onSelect(i);capture(svg.current,e.pointerId);const [px,py]=pt(e);setDrag({i,deg:Math.atan2(py-C[1],px-C[0])*180/Math.PI});}:undefined}
    className={editable?"cursor-grab outline-none":""}>
    <defs><radialGradient id={g}><stop offset="0%" stopColor={color} stopOpacity={1}/><stop offset={soft?"35%":"70%"} stopColor={color} stopOpacity={.85}/><stop offset="100%" stopColor={color} stopOpacity={0}/></radialGradient>
     <linearGradient id={g+"b"} x1={x} y1={y} x2={C[0]} y2={C[1]} gradientUnits="userSpaceOnUse"><stop offset="0" stopColor={color} stopOpacity={soft?.45:.6}/><stop offset="1" stopColor={color} stopOpacity="0"/></linearGradient></defs>
    {!top&&<path d={"M"+x+" "+y+" L"+ax.toFixed(1)+" "+ay.toFixed(1)+" L"+bx.toFixed(1)+" "+by.toFixed(1)+" Z"} fill={"url(#"+g+"b)"}/>}
    <circle cx={x} cy={y} r={22} fill="transparent"/>
    <circle cx={x} cy={y} r={soft?15:10} fill={"url(#"+g+")"}/>
    <circle cx={x} cy={y} r={soft?6.5:5} fill={color} className={on?"stroke-primary":"stroke-background"} strokeWidth={on?1.2:0.6}/>
    {/* The source's icon sits outside the circle, the role label inside, so neither covers the other. */}
    <Asset id={LIGHT_ASSETS[l.source]} x={ox} y={oy+8} h={16} opacity={.95}/>
    <text x={lx} y={ly+3} textAnchor="middle" fill="currentColor" fillOpacity=".8" fontSize={9}>{LIGHT_ROLE_FA[l.role].replace("نور ","")}</text>
   </g>;
  })}
  {target?<Asset id={PROP_ASSETS[target.kind].top} x={C[0]} y={C[1]+20} h={target.kind==="building"?44:target.kind==="vehicle"?48:40}/>:<Asset id="env-top" x={C[0]} y={C[1]+26} h={52}/>}
  <Asset id="camera-top" x={C[0]} y={VH-4} h={28}/>
 </svg>;
}

/** One labelled smooth slider (the second way to adjust, synced with the canvas). The value text is spoken and shown; the bar has a 32px tall touch area. */
function SliderRow({label,valueText,min,max,step,value,onChange,disabled}:{label:string;valueText:string;min:number;max:number;step:number;value:number;onChange:(v:number)=>void;disabled?:boolean}){
 return <label className={"flex flex-col gap-1 type-caption text-fg-secondary "+(disabled?"opacity-disabled":"")}>
  <span className="flex items-center justify-between gap-2"><span>{label}</span><bdi className="text-fg-primary">{valueText}</bdi></span>
  <input type="range" min={min} max={max} step={step} value={Number.isFinite(value)?value:min} disabled={disabled} onChange={e=>{const v=Number(e.target.value);if(Number.isFinite(v))onChange(v);}}
   aria-valuetext={valueText} className="h-8 w-full cursor-pointer accent-primary disabled:cursor-not-allowed"/>
 </label>;
}
const pct=(v:number)=>fa(Math.round(v*100));
/** The selected prop: its place on the ground (left–right, front–back) and its lift, as sliders synced with dragging it in the frame. */
function PropInspector({prop:p,reach:r,onChange,onClose}:{prop:SceneProp;
 /** How far it may go at this zoom and crop (lib/staging.ts, propReach): the same as dragging it, partly out of the frame on either side. */reach:{xMin:number;xMax:number;zMin:number;zMax:number};
 onChange:(x:Partial<SceneProp>)=>void;onClose:()=>void}){
 return <div className="flex flex-col gap-3">
  <div className="flex flex-wrap items-center gap-2"><SourceIcon id={PROP_ASSETS[p.kind].front}/><span className="type-label text-fg-primary">{p.label}</span><span className="type-caption text-fg-secondary">{propPlaceFa(p)}</span>
   <Button type="button" variant="ghost" size="sm" className="ms-auto" onClick={onClose} aria-label="برگشت به تنظیمات کادر"><Icon icon={X} aria-hidden="true" className="size-4"/>کادر</Button></div>
  <SliderRow label="چپ ↔ راست (تا بیرون از کادر)" valueText={pct(p.x)} min={Math.min(r.xMin,p.x)} max={Math.max(r.xMax,p.x)} step={0.01} value={p.x} onChange={x=>onChange({x})}/>
  <SliderRow label="جلو ↔ عقب (تا بریده از پایین)" valueText={pct(p.z)} min={Math.min(r.zMin,p.z)} max={r.zMax} step={0.01} value={p.z} onChange={z=>onChange({z})}/>
  <SliderRow label="ارتفاع از زمین" valueText={p.y>0.01?pct(p.y):"روی زمین"} min={0} max={1} step={0.01} value={p.y} onChange={y=>onChange({y})}/>
 </div>;
}

/** The selected light's settings. */
function LightInspector({light:l,canRemove,onChange,onRemove,onAdd}:{light:StagingLight;canRemove:boolean;onChange:(p:Partial<StagingLight>)=>void;onRemove:()=>void;onAdd?:()=>void}){
 const ang=lightAngleOf(l)??90;
 return <div className="flex flex-col gap-3 rounded-card border border-line-secondary bg-surface-subtle p-3">
  <SliderRow label={"جهت نور ("+LIGHT_ROLE_FA[l.role]+")"} valueText={l.direction==="top"?"از بالا":LIGHT_DIRECTION_FA[l.direction]+" · "+fa(Math.round(ang))+"°"} min={0} max={359} step={1} value={ang}
   disabled={l.direction==="top"} onChange={v=>onChange({angle:v,direction:snapDirection(v)})}/>
  <div className="flex flex-wrap items-center gap-1" role="radiogroup" aria-label="نقش نور">{LIGHT_ROLES.map(r=><Chip key={r} role="radio" on={l.role===r} onClick={()=>onChange({role:r})}>{LIGHT_ROLE_FA[r]}</Chip>)}</div>
  <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="منبع نور">{LIGHT_SOURCES.map(s=><button key={s} type="button" role="radio" aria-checked={l.source===s} onClick={()=>onChange({source:s})} title={LIGHT_SOURCE_FA[s]}
   className={"flex h-9 items-center gap-1 rounded-control border px-2 type-caption motion-hover "+(l.source===s?"border-primary bg-surface-selected text-fg-primary":"border-line-secondary text-fg-secondary hover:bg-surface-hover")}>
   <SourceIcon id={LIGHT_ASSETS[s]}/>{LIGHT_SOURCE_FA[s]}</button>)}</div>
  <div className="flex flex-wrap items-center gap-3">
   <div className="flex gap-1" role="radiogroup" aria-label="کیفیت نور">{(["soft","hard"] as const).map(q=><Chip key={q} role="radio" on={l.quality===q} onClick={()=>onChange({quality:q})}>{LIGHT_QUALITY_FA[q]}</Chip>)}</div>
   <div className="flex gap-1" role="radiogroup" aria-label="ارتفاع نور">{(["low","eye","high"] as const).map(h=><Chip key={h} role="radio" on={l.height===h} onClick={()=>onChange({height:h})}>{LIGHT_HEIGHT_FA[h]}</Chip>)}</div>
   <Chip on={l.direction==="top"} onClick={()=>onChange({direction:l.direction==="top"?"front_left":"top"})}>از بالا</Chip>
  </div>
  <label className="flex flex-col gap-1 type-caption text-fg-secondary">
   <span>دمای رنگ: <bdi>{fa(l.colorTemperatureK)}</bdi> کلوین</span>
   <input type="range" min={1500} max={12000} step={100} value={l.colorTemperatureK} onChange={e=>onChange({colorTemperatureK:Number(e.target.value),colorHex:undefined})}
    className="h-3 w-full cursor-pointer appearance-none rounded-control" style={{background:TEMPERATURE_GRADIENT}}/>
  </label>
  <div className="flex flex-wrap items-center gap-1" role="radiogroup" aria-label="رنگ ژل">
   <Chip role="radio" on={!l.colorHex} onClick={()=>onChange({colorHex:undefined})}>بدون ژل</Chip>
   {GEL_COLORS.map(c=><button key={c} type="button" role="radio" aria-checked={l.colorHex===c} aria-label={"ژل "+c} onClick={()=>onChange({colorHex:c})}
    className={"size-7 rounded-control border-2 "+(l.colorHex===c?"border-fg-primary":"border-transparent")} style={{background:c}}/>)}
  </div>
  <div className="flex flex-wrap gap-2">
   {onAdd&&<Button type="button" variant="outline" size="sm" onClick={onAdd}><Icon icon={Plus} aria-hidden="true"/>نور جدید</Button>}
   {canRemove&&<Button type="button" variant="ghost" size="sm" onClick={onRemove}><Icon icon={Trash2} aria-hidden="true"/>حذف این نور</Button>}
  </div>
 </div>;
}
/** A light source's small asset next to its name. */
function SourceIcon({id}:{id:string}){
 const a=VISUALS[id];if(!a)return null;
 // eslint-disable-next-line @next/next/no-img-element -- a small local asset from the pack, already sized
 return <img src={a.src} alt="" className="size-5 object-contain"/>;
}
function LightRow({l}:{l:StagingLight}){
 return <li className="flex items-start gap-2 type-caption text-fg-secondary">
  <span aria-hidden="true" className="mt-0.5 size-3 shrink-0 rounded-control border border-line-primary" style={{background:lightHex(l)}}/>
  <span className="min-w-0"><span className="text-fg-primary">{LIGHT_ROLE_FA[l.role]}</span> · {LIGHT_SOURCE_FA[l.source]} · {LIGHT_QUALITY_FA[l.quality]} · {LIGHT_DIRECTION_FA[l.direction]}، ارتفاع {LIGHT_HEIGHT_FA[l.height]} · {fa(l.colorTemperatureK)} کلوین</span>
 </li>;
}
