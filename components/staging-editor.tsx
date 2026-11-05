"use client";
import {useEffect,useId,useRef,useState,useSyncExternalStore,type KeyboardEvent,type PointerEvent,type ReactNode} from "react";
import dynamic from "next/dynamic";
import {Dialog as DialogPrimitive} from "@base-ui/react/dialog";
import {Box,ChevronDown,ChevronLeft,ChevronRight,ChevronUp,Lock,LockOpen,Maximize2,Plus,RotateCcw,Trash2,Undo2,X} from "lucide-react";
import {Button,Dialog,DialogBody,DialogContent,DialogHeader,DialogPortal,DialogTitle,Icon} from "@aleeforoughi/feather-react";
import {FOCUS_DETAILS,LIGHT_HEIGHTS,LIGHT_ROLES,LIGHT_SOURCES,type Staging,type StagingLight} from "@/lib/creative-plan";
import {ANGLE_ORDER,CAMERA_ANGLE_FA,CAMERA_ELEVATION,GEL_COLORS,LIGHT_ANGLE,LIGHT_ASSETS,LIGHT_DIRECTION_FA,LIGHT_HEIGHT_FA,LIGHT_QUALITY_FA,LIGHT_ROLE_FA,LIGHT_SOURCE_FA,PROP_ASSETS,PROP_HEIGHT,
 SHOT_BODY_FRACTION,SHOT_SIZE_FA,SUBJECT_FA,TEMPERATURE_GRADIENT,lightHex,placementFa,polar,propPlaceFa,snapDirection,snapElevation,tidyProps,propInView,groundFromView,frameCamera,frameSize,propReach,propWidth,withFrameCuts,orbitCamera,orbitFa,facingOf,FOCUS_DETAIL_FA,ZOOM_RANGE,genderOf,topAssetOf,propTints,moveFocusPoint,lensFor,centerOnSubject,rollOf,lensSizeFactor,backdropFactor,wallDepth,blurAt,horizonShift,focusDepth,CANVAS_SECTION_FA,type CanvasSection,intensityOf,intensityFa,facingFa,propTags,lightTags,wrap180,elevationOf,scaleOf,lightAngleOf,nearestShot,scaleFromSlider,sliderFromScale,zoomFactor,VERTICAL_STOPS,verticalIndex,snapVertical,SIDE_STEP,snapSide,sideStopFa,isCube,cubeDims,isCharacter,showsFrame,liftFa,type SceneProp} from "@/lib/staging";
import {VISUALS} from "@/lib/visual-assets";
import {fa} from "@/lib/format";
import type {FrameRect} from "./scene-3d";
import FrameCSS from "./frame-css";
import {ClayBox,ClayFootprint} from "./clay-box";
import {spriteFor,sizeOf} from "@/lib/sprites";
import {SCENE_COLORS} from "@/lib/scene3d";
import {shade,pickPivot,zoomLimits,propReach3D,cropOnSubject,liftLimits} from "@/lib/frame-css";

/** The frame in real 3D (three.js), loaded only in the browser and only when «بوم» is open; the 2D drawing stays as the collapsed snapshot and the fallback. */
const Scene3D=dynamic(()=>import("./scene-3d"),{ssr:false,loading:()=>null});
/**
 * Which renderer draws the open frame: "css" (Plan A: the pack's images at the camera's height and side stops, CSS 3D perspective for the lens, blur for
 * the aperture; components/frame-css.tsx) or "webgl" (Plan B, parked: three.js models; archive/plan-b-3d). Both take the same props.
 */
const FRAME_RENDERER:"css"|"webgl"="css";
const FrameScene=FRAME_RENDERER==="css"?FrameCSS:Scene3D;
let webglOk:boolean|undefined;
/** Whether this browser can draw WebGL (checked once; the test context is released at once). */
function hasWebGL():boolean{
 if(webglOk===undefined){try{const c=document.createElement("canvas"),gl=c.getContext("webgl2")??c.getContext("webgl");webglOk=Boolean(gl);gl?.getExtension("WEBGL_lose_context")?.loseContext();}catch{webglOk=false;}}
 return webglOk;
}
const noSubscribe=()=>()=>{};
/** The 3D frame is used when the browser can draw it (never on the server). */
const useWebGL=()=>useSyncExternalStore(noSubscribe,hasWebGL,()=>false);
/** Whether an element is on screen (or near it), so heavy views draw only while they can be seen. */
function useOnScreen(el:Element|null):boolean{
 const [on,setOn]=useState(false);
 useEffect(()=>{if(!el||typeof IntersectionObserver==="undefined")return;
  const io=new IntersectionObserver(es=>setOn(es.some(e=>e.isIntersecting)),{rootMargin:"200px"});io.observe(el);return ()=>io.disconnect();},[el]);
 return Boolean(el)&&on;
}
/** Sets a state only when its value really changed (the 3D view reports on every draw). */
const sameJSON=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);

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
  frame:{title:"کادر و چیدمان",value:SHOT_SIZE_FA[s.shotSize]+" · "+aspect+(n?" · "+fa(n)+" پراپ":"")},
  camera:{title:"دوربین",value:CAMERA_ANGLE_FA[s.cameraAngle]+" · "+fa(Math.round(elevationOf(s)))+"°"+(Math.abs(s.cameraAzimuth??0)>=1?" · "+orbitFa(s.cameraAzimuth!):"")+" · زوم "+fa(zoomFactor(s))+"×"},
  light:{title:"نورپردازی",value:s.lights.length===1?"یک منبع نور":fa(s.lights.length)+" منبع نور"}
 };
}
/** A plan without props (older plans) gets one: its subject, centre front. A planner's crowded layout is tidied for display (lib/staging.ts, tidyProps). */
function withProps(s:Staging):Staging{
 const subject=s.subject??"person";
 if(s.props||subject==="environment")return {...s,subject,props:tidyProps(s.props)??[]};
 return {...s,subject,props:[{kind:subject,label:SUBJECT_FA[subject],x:0,z:-0.25,y:0,main:true}]};
}
export function StagingEditor({staging,aspectRatio,mediaKind,onChange,focus}:{staging:Staging;aspectRatio?:string;
 /** A follow-up about one or two parts: «بوم» opens on just those parts (less is more), with «همهٔ تنظیمات بوم» to show everything. */focus?:readonly CanvasSection[];/** For the wording («این عکس», «این ویدیو»). */mediaKind?:"image"|"video";
 /** Live: every adjustment is reported (with whether it differs from Whoush's scene), so the generation card below uses it directly; without it, read-only. */
 onChange?:(s:Staging,aspect:string,changed:boolean)=>void}){
 const initial=withProps(staging);
 const [draft,setDraft]=useState<Staging>(initial),[aspect,setAspect]=useState(aspectRatio??"16:9");
 // The frame shows its own settings (zoom, aspect, crop) until a prop is selected; then only that prop's settings, until it is deselected. Lights select apart.
 const [propSel,setPropSel]=useState<number|null>(null),[lightSel,setLightSel]=useState(0),[locked,setLocked]=useState(false);
 // The zoom's centre: the dominant subject where it stands when the camera last moved (zoom, height, orbit) or the dominant subject was chosen. Dragging
 // props never moves it (so moving one prop moves only that prop); the next camera move re-centres on the dominant subject. The user's crop pan stays on top.
 const mainIdx=(draft.props??[]).findIndex(p=>p.main);
 const [focusProps,setFocusProps]=useState(initial.props);
 // Whoush Autopilot (on by default): Whoush keeps the camera's lens and aperture right for the scene and re-centres on the dominant subject when the
 // camera moves. Off: fully manual, nothing changes by itself.
 const autopilot=draft.autopilot!==false;
 const aim=()=>{if(autopilot&&focusProps!==draft.props)setFocusProps(draft.props);};
 /** Hand-setting the lens or aperture turns Autopilot off and freezes the other at its current value, so nothing changes behind the user's back. */
 const setManual=(p:Partial<Staging>)=>setDraft(d=>{const l=lensFor(d);return fitZoom({...d,autopilot:false,lensMm:d.lensMm??l.focalLengthMm,apertureF:d.apertureF??l.apertureF,...p});});
 const setAutopilot=(on:boolean)=>{
  if(on){setFocusProps(draft.props);setDraft(d=>{const {lensMm:_l,apertureF:_a,autopilot:_p,...rest}=d;void _l;void _a;void _p;return rest;});}
  else setManual({});
 };
 const anchor:Staging={...initial,focusDetail:draft.focusDetail,props:focusProps?.map((p,i)=>{const {main:_m,...q}=p;void _m;return i===mainIdx?{...q,main:true}:q;})};
 // All three views in one scroll, in this order: framing and layout, camera, lighting; each view's controls right under it.
 const editable=Boolean(onChange);
 const changed=JSON.stringify(draft)!==JSON.stringify(initial)||aspect!==(aspectRatio??"16:9");
 // Report every adjustment upward; the card below builds with it (no separate apply step).
 const report=useRef(onChange);
 useEffect(()=>{report.current=onChange;});
 const key=JSON.stringify(draft)+"|"+aspect;
 useEffect(()=>{report.current?.(withFrameCuts(draft,anchor,aspect),aspect,changed);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- report when the draft or aspect actually changes
 },[key]);
 const set=(p:Partial<Staging>)=>setDraft(d=>({...d,...p}));
 const setLight=(i:number,p:Partial<StagingLight>)=>setDraft(d=>({...d,lights:d.lights.map((l,j)=>j===i?{...l,...p}:l)}));
 const props=draft.props??[];
 const [confirmed,setConfirmed]=useState(false);
 /** The dominant subject: one prop (the main one) and, for a person, the part the shot is about. */
 const setDominant=(i:number,detail?:Staging["focusDetail"])=>{setConfirmed(true);setFocusProps(draft.props);
  // A new dominant subject: the centre point goes back onto it.
  setDraft(d=>{const {focusDetail:_f,focusPoint:_p,pivot:_v,...rest}=d;void _f;void _p;void _v;return {...rest,...(detail?{focusDetail:detail}:{}),props:(d.props??[]).map((p,j)=>{const {main:_m,...q}=p;void _m;return j===i?{...q,main:true}:q;})};});};
 // The camera: height, orbit around the main subject (everything in the frame turns to match) and distance (the same value as the frame's zoom).
 const setElevation=(e:number)=>{aim();setElevationOnly(e);};
 // A new height or side: a focus point the user placed keeps the focus (on a prop it follows the prop around); only its zoom anchor, which belonged to
 // the old view, goes. Orbiting swings the ground around, so a point on the ground or the far background goes back to the dominant subject.
 const dropPivot=(d:Staging):Staging=>{if(!d.pivot)return d;const {pivot,...rest}=d;const {a:_a,b:_b,k:_k,...focus}=pivot;void _a;void _b;void _k;return {...rest,pivot:focus};};
 /** An orbit swings the scene around the main subject (lib/staging.ts, orbitCamera): a focus point the user placed swings with it, so it stays on the same spot. */
 const orbitPivot=(d:Staging,delta:number):Staging=>{const pv=d.pivot;if(!pv)return d;
  const props=d.props??[],m=props.find(p=>p.main)??props[0],px=m?.x??0,pz=m?.z??0,a=delta*Math.PI/180,c=Math.cos(a),n=Math.sin(a),dx=pv.x-px,dz=pv.z-pz;
  const rel=pv.rel?[pv.rel[0]*c-pv.rel[2]*n,pv.rel[1],pv.rel[0]*n+pv.rel[2]*c]:undefined;
  return {...d,pivot:{...pv,x:px+dx*c+dz*n,z:pz-dx*n+dz*c,...(rel?{rel}:{})}};};
 // Changing the angle never changes the zoom, the lens, the aperture or the focus: only the camera's height or side moves.
 const setElevationOnly=(e:number)=>setDraft(d=>({...dropPivot(d),cameraElevation:e,cameraAngle:d.cameraAngle==="dutch"?"dutch":snapElevation(e)}));
 const orbitTo=(az:number)=>{aim();orbitOnly(az);};
 // A drag of the camera re-centres once, when it starts (not on every move).
 const orbitDrag=(az:number)=>orbitOnly(snapSide(az));
 const orbitOnly=(az:number)=>setDraft(d=>{const delta=wrap180(az-(d.cameraAzimuth??0));return orbitCamera(orbitPivot(dropPivot(d),delta),delta);});
 const setDistance=(v:number)=>{aim();setDistanceOnly(v);};
 // The zoom stays within what this scene allows (the camera never inside or past the subject: lib/frame-css.ts, zoomLimits); a new lens or angle that
 // would put it there pulls the zoom back to the nearest allowed.
 // A character may be zoomed past what the frame can draw, down to an extreme close-up of its eyes or mouth: the frame then stays at its tightest and shows
 // the real crop as a green guide on the face (lib/frame-css.ts, closeUp).
 const tightest=(d:Staging)=>{const m=(d.props??[]).find(p=>p.main);return m&&isCharacter(m)?0:zoomLimits(d,anchor,aspect)[0];};
 const zoomTo=(d:Staging,v:number):Staging=>{const lo=tightest(d),sc=scaleFromSlider(Math.max(lo,Math.min(1,v)));return {...d,shotScale:sc,shotSize:nearestShot(sc)};};
 const fitZoom=(d:Staging):Staging=>{const v=sliderFromScale(scaleOf(d)),lo=tightest(d);return v<lo?zoomTo(d,lo):d;};
 const setDistanceOnly=(v:number)=>setDraft(d=>zoomTo(d,v));
 // The camera raised or lowered on its stand, in 5 cm steps, within what keeps it above the ground.
 const setLift=(v:number)=>setDraft(d=>{const [lo,hi]=liftLimits(d,anchor,aspect),l=Math.round(Math.max(lo,Math.min(hi,v))*20)/20;const {cameraLift:_l,...rest}=d;void _l;return Math.abs(l)<0.025?rest:{...rest,cameraLift:l};});
 const setProp=(i:number,p:Partial<SceneProp>)=>setDraft(d=>({...d,props:(d.props??[]).map((x,j)=>j===i?{...x,...p}:x)}));
 // Collapsed by default: «بوم» is advanced settings. The card shows the scene in one line; opening it shows the canvas and its controls.
 // Collapsed by default. A focused follow-up (one part, e.g. the camera's distance) shows just that part's controls in the collapsed card, live; expanding shows
 // every setting (frame, camera, lighting...), and collapsing goes back to just that part.
 const [open,setOpen]=useState(false),bodyId=useId(),focused=Boolean(focus?.length);
 const full=open,show=(sec:CanvasSection)=>full||!focused||Boolean(focus?.includes(sec));
 // A press anywhere outside the frame and its controls (elsewhere in the canvas, or outside it) deselects the prop: the frame is selected again. Not while
 // the selection is locked.
 // The centre point can be selected too (its dot): its own settings show, and the badge reads «تنظیم مرکز».
 const [centerSel,setCenterSel]=useState(false);
 // The frame in 3D when the browser can draw it, and its full-screen view.
 const webgl=useWebGL(),[fullscreen,setFullscreen]=useState(false);
 // One WebGL view per open, visible frame (browsers allow only a few at once): hidden or scrolled-away cards draw nothing in 3D.
 const frameArea=useRef<HTMLDivElement|null>(null),[frameEl,setFrameEl]=useState<HTMLDivElement|null>(null),onScreen=useOnScreen(frameEl);
 /** Back to Whoush's own choice: the centre point on the dominant subject where it stands now, with Whoush's original framing (the crop pan). */
 const resetFocus=()=>{
  setFocusProps(draft.props);
  setDraft(d=>{const {focusPoint:_p,framing:_f,pivot:_v,...rest}=d;void _p;void _f;void _v;return {...rest,...(initial.framing?{framing:initial.framing}:{})};});
 };
 useEffect(()=>{
  if((propSel===null&&!centerSel)||locked||fullscreen)return;
  const off=(e:Event)=>{const t=e.target as Node|null;if(t&&frameArea.current&&!frameArea.current.contains(t)){setPropSel(null);setCenterSel(false);}};
  document.addEventListener("pointerdown",off,true);
  return ()=>document.removeEventListener("pointerdown",off,true);
 },[propSel,centerSel,locked,fullscreen]);
 // Collapsed: three live snapshots of the scene as it is now (frame, camera, lighting), read-only; opening it shows the canvas and its controls.
 const cap=viewCaptions(draft,aspect);
 // Beta: the frame shows only characters; a scene with props but none of them a character has no frame (the camera and the lighting still show).
 const frameShown=showsFrame(draft.props);

 return <>
 <div role="group" aria-label="بوم" className="@container flex min-w-0 flex-col gap-3">
  {/* One card holds everything: the header, then (collapsed) the snapshots or a focused follow-up's part, or (expanded) every setting, so the layout never splits. */}
  <div className="flex min-w-0 flex-col gap-3 rounded-card border border-line-secondary bg-surface-subtle p-2">
  <button type="button" aria-expanded={open} aria-controls={bodyId} onClick={()=>setOpen(o=>!o)}
   aria-label={"بوم، تنظیمات پیشرفته: "+CAMERA_ANGLE_FA[draft.cameraAngle]+"، "+SHOT_SIZE_FA[draft.shotSize]+"، "+(draft.lights.length===1?"یک نور":fa(draft.lights.length)+" نور")+(changed?"، تغییر کرده":"")}
   className="flex w-full flex-col gap-2 rounded-control p-1 text-start motion-hover hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
   <span className="flex items-center gap-2 px-1">
    <Icon icon={Box} size={16} aria-hidden="true" className="size-4 shrink-0 text-fg-secondary"/>
    <span className="type-label text-fg-primary">بوم</span><span className="type-caption text-fg-secondary">{full||!focused?"تنظیمات پیشرفته":"تنظیم "+focus!.map(f=>CANVAS_SECTION_FA[f]).join(" و ")}</span>
    {changed&&<span className="rounded-control bg-surface-selected px-2 py-0.5 type-caption text-fg-primary">تغییر کرده</span>}
    <Icon icon={ChevronDown} size={16} aria-hidden="true" className={"ms-auto size-4 shrink-0 text-fg-secondary transition-transform motion-reduce:transition-none "+(open?"rotate-180":"")}/>
   </span>
   {!open&&!focused&&<span className="grid grid-cols-1 gap-2">
    {show("frame")&&frameShown&&<Snap c={cap.frame}><FrameView staging={draft} anchor={anchor} aspect={aspect}/></Snap>}
    {(show("angle")||show("distance")||show("lens"))&&<Snap c={cap.camera}><CameraView staging={draft} anchor={anchor} aspect={aspect} editable={false} onCamera={()=>{}}/></Snap>}
    {show("light")&&<Snap c={cap.light}><LightView staging={draft} editable={false} selected={-1} onSelect={()=>{}} onLight={()=>{}}/></Snap>}
   </span>}
  </button>
  <div id={bodyId} hidden={!open&&!focused} className="flex min-w-0 flex-col gap-3">
  <div className="flex min-w-0 flex-col gap-3">
   {show("frame")&&frameShown&&<div ref={el=>{frameArea.current=el;setFrameEl(el);}}><Viewport {...cap.frame}>
    <FrameView staging={draft} anchor={anchor} aspect={aspect} editable={editable} onFraming={f=>set({framing:f})} sel={propSel} onSelect={i=>{setPropSel(i);setCenterSel(false);}} centerSel={centerSel} onSelectCenter={()=>{setCenterSel(true);setPropSel(null);}} onProp={(i,x,z)=>setProp(i,{x,z})} onZoom={setDistance} locked={locked} onLock={setLocked} onBack={()=>{setPropSel(null);setCenterSel(false);setLocked(false);}}
     onFocus={f=>{if(f)set(f);else resetFocus();}} onAngle={c=>{if(c.elevation!==undefined)setElevation(c.elevation);if(c.azimuth!==undefined)orbitTo(c.azimuth);}} three={(FRAME_RENDERER==="css"||webgl)&&onScreen&&(open||focused)&&!fullscreen} onFullscreen={()=>{setCenterSel(false);setFullscreen(true);}}/>
    {fullscreen&&<FrameFullscreen staging={draft} anchor={anchor} aspect={aspect} sel={propSel} onSelect={i=>{setPropSel(i);setCenterSel(false);setLocked(false);}}
     onProp={(i,x,z)=>setProp(i,{x,z})} onFraming={f=>set({framing:f})} distance={distanceOf(draft)} onZoom={setDistance} onClose={()=>setFullscreen(false)}
     inspector={i=>props[i]?<PropInspector prop={withFrameCuts(draft,anchor,aspect).props![i]} tag={propTags(props,true)[i]} reach={reachOf(props[i],draft,anchor,aspect)} onChange={p=>setProp(i,p)}/>:null}/>}
    {/* The centre point's own settings, while its dot is selected. */}
    {editable&&centerSel&&<div className="flex flex-col items-center gap-2 py-1 text-center">
     <p className="type-body-sm text-fg-primary">{draft.focusPoint||draft.pivot?"نقطهٔ فوکوس جابه‌جا شده؛ فوکوس و زوم روی همین نقطه‌ست.":"مرکز کادر روی سوژهٔ اصلیه"+(props[mainIdx]?" ("+propTags(props)[mainIdx]+")":"")+"؛ زوم دور همین نقطه انجام می‌شه."}</p>
     <p className="type-caption text-fg-secondary">نقطه رو روی بوم بکش تا جابه‌جا بشه (تصویر تکون نمی‌خوره).</p>
    </div>}
    {editable&&propSel!==null&&props[propSel]&&<PropInspector prop={withFrameCuts(draft,anchor,aspect).props![propSel]} tag={propTags(props,true)[propSel]} reach={reachOf(props[propSel],draft,anchor,aspect)}
     onChange={p=>setProp(propSel,p)}/>}
    {editable&&(propSel===null||!props[propSel])&&!centerSel&&<>
     <input type="range" dir="ltr" min={0} max={1} step={0.001} value={1-distanceOf(draft)} onChange={e=>setDistance(1-Number(e.target.value))}
      aria-label="زوم (اندازهٔ نما، همون فاصلهٔ دوربین)" aria-valuetext={SHOT_SIZE_FA[draft.shotSize]+"، زوم "+zoomFactor(draft)+"×"} className="h-8 w-full cursor-pointer accent-primary"/>
     <span dir="ltr" className="-mt-2 flex justify-between type-caption text-fg-secondary" aria-hidden="true"><span>باز</span><span>نزدیک</span></span>
     <div className="flex flex-wrap justify-center gap-1">{["16:9","3:2","4:5","1:1","9:16"].map(r=><Chip key={r} on={aspect===r} onClick={()=>setAspect(r)}><bdi>{r}</bdi></Chip>)}</div>
     <SliderRow label="جابه‌جایی کادر، افقی" ends={["چپ","راست"]} valueText={pct(draft.framing?.x??0)} min={-1} max={1} step={0.01} value={draft.framing?.x??0}
      onChange={x=>{const y=draft.framing?.y??0;set({framing:x===0&&y===0?undefined:{x,y}});}}/>
     <SliderRow label="جابه‌جایی کادر، عمودی" ends={["بالا","پایین"]} valueText={pct(draft.framing?.y??0)} min={-1} max={1} step={0.01} value={draft.framing?.y??0}
      onChange={y=>{const x=draft.framing?.x??0;set({framing:x===0&&y===0?undefined:{x,y}});}}/>
     <p className="text-center type-caption text-fg-secondary">{props.length?"روی یه پراپ بزن تا تنظیماتش بیاد و بکشیش (بالا عقب، پایین جلو، حتی تا بیرون کادر)؛ ":""}پس‌زمینه رو بکشی، کادر جابه‌جا می‌شه.</p>
    </>}
   </Viewport>
   </div>}
   {(show("angle")||show("distance")||show("lens"))&&<div><Viewport {...cap.camera}>
    {show("angle")&&<>
    {/* The two camera views side by side, each its own tile: from the side (height and distance) and from above (the orbit), synced through one scene. */}
    <div className="grid grid-cols-2 gap-2">
     <Tile label="زاویه دوربین / عمودی">
      <CameraView staging={draft} anchor={anchor} aspect={aspect} editable={editable} onStart={aim} onCamera={c=>{setDraft(d=>{const n=c.flip?orbitCamera(orbitPivot(dropPivot(d),180),180):dropPivot(d);
       const e=snapVertical(c.elevation);return {...n,cameraElevation:e,cameraAngle:n.cameraAngle==="dutch"?"dutch":snapElevation(e)};});}}/>
     </Tile>
     <Tile label="زاویه دوربین / افقی">
      <OrbitView staging={draft} anchor={anchor} aspect={aspect} editable={editable} onStart={aim} onOrbit={c=>orbitDrag(c.azimuth)}/>
     </Tile>
    </div>
    {/* The height and the orbit snap to the stops the pack is drawn at: five heights, eight sides (lib/staging.ts, VERTICAL_STOPS, SIDE_STEP). */}
    {editable&&<SliderRow label="ارتفاع دوربین" ends={["پایین","بالا"]} valueText={VERTICAL_STOPS[verticalIndex(elevationOf(draft))].fa+" · "+fa(Math.round(elevationOf(draft)))+"°"} min={0} max={VERTICAL_STOPS.length-1} step={1} value={verticalIndex(elevationOf(draft))}
     onChange={i=>setElevation(VERTICAL_STOPS[i].deg)}/>}
    {editable&&<SliderRow label="چرخش دور سوژه (۳۶۰°)" ends={["چپ","راست"]} valueText={orbitFa(draft.cameraAzimuth??0)} min={-180} max={180} step={SIDE_STEP} value={snapSide(draft.cameraAzimuth??0)} onChange={v=>orbitTo(snapSide(v))}/>}
    {/* The Dutch (canted) angle as a smooth tilt, and the two shot types that change how the camera relates to the subject. */}
    {editable&&<SliderRow label="زاویهٔ کج (داچ)" ends={["به چپ","به راست"]} valueText={rollOf(draft)?fa(Math.abs(Math.round(rollOf(draft))))+"° "+(rollOf(draft)>0?"به راست":"به چپ"):"صاف"}
     min={-30} max={30} step={1} value={rollOf(draft)} onChange={v=>setDraft(d=>{const {cameraRoll:_r,...rest}=d;void _r;
      return v===0?{...rest,cameraAngle:d.cameraAngle==="dutch"?snapElevation(elevationOf(d)):d.cameraAngle}:{...rest,cameraRoll:v,cameraAngle:"dutch"};})}/>}
    {editable&&<div className="flex flex-wrap justify-center gap-1" role="radiogroup" aria-label="نوع نما">
     {([[undefined,"معمولی"],["ots","روی شانه (OTS)"],["pov","دید سوژه (POV)"]] as const).map(([v,l])=><Chip key={l} role="radio" on={draft.shotStyle===v}
      onClick={()=>setDraft(d=>{const {shotStyle:_s,...rest}=d;void _s;return v?{...rest,shotStyle:v}:rest;})}>{l}</Chip>)}</div>}
    </>}
    {show("distance")&&<>
    {/* The camera's distance on its own tile, after the angles: drag the camera nearer or farther (the frame's zoom follows), or use the slider. */}
    <Tile label="فاصله دوربین">
     <DistanceView staging={draft} anchor={anchor} aspect={aspect} editable={editable} onDistance={v=>{aim();setDistanceOnly(v);}} onLift={setLift}/>
    </Tile>
    {editable&&<SliderRow label="فاصلهٔ دوربین (همون زوم کادر)" ends={["نزدیک","دور"]} valueText={SHOT_SIZE_FA[draft.shotSize]+" · زوم "+fa(zoomFactor(draft))+"×"} min={0} max={1} step={0.001} value={distanceOf(draft)} onChange={setDistance}/>}
    {/* The camera's stand: raised or lowered with its aim, the angle unchanged (a pedestal move); never under the ground (lib/frame-css.ts, liftLimits). */}
    {editable&&(()=>{const [lo,hi]=liftLimits(draft,anchor,aspect);return <SliderRow label="بالا و پایین بردن دوربین (پایه)" ends={["پایین‌تر","بالاتر"]} valueText={liftFa(draft.cameraLift)}
     min={lo} max={hi} step={0.05} value={Math.max(lo,Math.min(hi,draft.cameraLift??0))} onChange={setLift}/>;})()}
    </>}
    {/* Lens and aperture: Whoush's pick for the scene (lib/staging.ts, lensFor) until the user moves a slider; bokeh is the aperture opened wide. */}
    {editable&&show("lens")&&(()=>{const l=lensFor(draft),auto=(on:boolean)=>on?" · خودکار":"";
     return <>
      {/* Right after the distance: Whoush Autopilot (on: Whoush keeps the lens and aperture right for the scene; off: fully manual). The bokeh toggle is
          off the canvas for now (the aperture slider still sets the background blur). */}
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1">
       <Toggle label="اتوپایلوت هووش" on={autopilot} onChange={setAutopilot}/>
      </div>
      <p className="-mt-1 text-center type-caption text-fg-secondary">{autopilot?"هووش بهترین لنز و دیافراگم رو خودش انتخاب می‌کنه.":"دستی: هر چی تنظیم کنی همون می‌مونه."}</p>
      <SliderRow label="لنز (فاصلهٔ کانونی)" ends={["واید","تله"]} valueText={fa(l.focalLengthMm)+" میلی‌متر"+auto(l.auto.lens)} min={0} max={1} step={0.001} value={lensSlider(l.focalLengthMm)}
       onChange={v=>setManual({lensMm:lensFromSlider(v)})}/>
      {/* An ordinary lens keeps straight lines straight at any focal length, as the photo will; a fisheye is a choice of its own. */}
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1">
       <Toggle label="لنز چشم‌ماهی (فیش‌آی)" on={Boolean(draft.fisheye)} onChange={on=>setDraft(d=>{const {fisheye:_f,...rest}=d;void _f;return on?{...rest,fisheye:true}:rest;})}/>
      </div>
      <SliderRow label="دیافراگم" ends={["باز، محو","بسته، واضح"]} valueText={l.aperture+auto(l.auto.aperture)} min={0} max={1} step={0.001} value={apertureSlider(l.apertureF)}
       onChange={v=>setManual({apertureF:apertureFromSlider(v)})}/>
     </>;})()}
   </Viewport></div>}
   {show("light")&&<div>
    <Viewport {...cap.light}>
     <LightView staging={draft} editable={editable} selected={lightSel} onSelect={setLightSel} onLight={(i,deg)=>setLight(i,{angle:deg,direction:snapDirection(deg)})}/>
    </Viewport>
    {editable&&draft.lights[lightSel]&&<div className="mt-2"><LightInspector light={draft.lights[lightSel]} tag={lightTags(draft.lights)[lightSel]} canRemove={draft.lights.length>1}
     onChange={p=>setLight(lightSel,p)}
     onRemove={()=>{const i=lightSel;setDraft(d=>({...d,lights:d.lights.filter((_,j)=>j!==i)}));setLightSel(0);}}
     onAdd={draft.lights.length<4?()=>{setDraft(d=>({...d,lights:[...d.lights,{role:"fill",direction:"front_right",height:"eye",quality:"soft",source:"softbox",colorTemperatureK:5600}]}));setLightSel(draft.lights.length);}:undefined}/></div>}
   </div>}
   {!full&&<Button type="button" variant="ghost" size="sm" className="self-center" onClick={()=>setOpen(true)}><Icon icon={ChevronDown} aria-hidden="true"/>همهٔ تنظیمات بوم</Button>}
  </div>
  </div>
  {!editable&&<ul className="flex flex-col gap-1">{draft.lights.map((l,i)=><LightRow key={i} l={l}/>)}</ul>}
  {editable&&changed&&<div className="flex flex-wrap items-center gap-2">
   <Button type="button" variant="ghost" size="sm" onClick={()=>{setDraft(initial);setAspect(aspectRatio??"16:9");setPropSel(null);setLightSel(0);setLocked(false);setFocusProps(initial.props);}}><Icon icon={RotateCcw} aria-hidden="true"/>برگرد به پیشنهاد هووش</Button>
   <p className="type-caption text-fg-secondary">با «بساز» همین صحنه ساخته می‌شه.</p>
  </div>}
  </div>
 </div>
 {/* Whoush's reading of the dominant subject is part of the conversation, not of the advanced settings: under «بوم», before the card and any question. */}
 {props.length>0&&mainIdx>=0&&show("frame")&&<Dominant tags={propTags(props)} props={props} main={mainIdx} detail={draft.focusDetail} mediaKind={mediaKind} confirmed={confirmed}
  editable={editable} onConfirm={()=>setConfirmed(true)} onChoose={setDominant}/>}
 </>;
}

/**
 * What Whoush took as the dominant subject («فهمیدم سوژهٔ اصلی این عکس صورتِ #زن است»), said in the conversation so the user can confirm it or pick another:
 * another prop, or (for a person) another part. Not a blocking question: the plan stands as it is until they change it, and a change flows like any canvas edit.
 */
function Dominant({tags,props,main,detail,mediaKind,confirmed,editable,onConfirm,onChoose}:{tags:string[];props:readonly SceneProp[];main:number;detail?:Staging["focusDetail"];
 mediaKind?:"image"|"video";confirmed:boolean;editable:boolean;onConfirm:()=>void;onChoose:(i:number,detail?:Staging["focusDetail"])=>void}){
 const [picking,setPicking]=useState(false);
 const m=props[main],what=(m.kind==="person"&&detail?FOCUS_DETAIL_FA[detail]+"ِ ":"");
 const sentence=(confirmed?"سوژهٔ اصلی: ":"فهمیدم سوژهٔ اصلی "+(mediaKind==="video"?"این ویدیو ":"این عکس "))+what;
 return <div className="flex flex-col gap-2 rounded-card border border-line-secondary p-3">
  <p className="type-body-sm text-fg-primary">{sentence}<bdi className="text-primary">{tags[main]}</bdi>{confirmed?"":" است."}</p>
  {editable&&!confirmed&&!picking&&<div className="flex flex-wrap gap-2">
   <Button type="button" size="sm" variant="secondary" onClick={onConfirm}>درسته</Button>
   <Button type="button" size="sm" variant="ghost" onClick={()=>setPicking(true)}>یه چیز دیگه‌ست</Button>
  </div>}
  {editable&&(picking||confirmed)&&<div className="flex flex-col gap-2">
   <div className="flex flex-wrap items-center gap-1" role="radiogroup" aria-label="سوژهٔ اصلی">{props.map((p,i)=><Chip key={i} role="radio" on={i===main} onClick={()=>{onChoose(i,p.kind==="person"?detail:undefined);setPicking(false);}}><bdi>{tags[i]}</bdi></Chip>)}</div>
   {m.kind==="person"&&<div className="flex flex-wrap items-center gap-1" role="radiogroup" aria-label="کدوم بخشش">
    <Chip role="radio" on={!detail} onClick={()=>{onChoose(main,undefined);setPicking(false);}}>کل سوژه</Chip>
    {FOCUS_DETAILS.map(d=><Chip key={d} role="radio" on={detail===d} onClick={()=>{onChoose(main,d);setPicking(false);}}>{FOCUS_DETAIL_FA[d]}</Chip>)}</div>}
  </div>}
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
function Asset({id,x,y,h,mirror,sx=1,rotate=0,opacity=1,tint}:{id:string;x:number;y:number;h:number;mirror?:boolean;/** A tint filter's id (BlueTint): the camera is drawn blue. */tint?:string;
 /** Horizontal scale about its centre (a side view turned toward or away from the camera is narrower). */sx?:number;rotate?:number;opacity?:number}){
 const a=VISUALS[id];if(!a)return null;
 const w=h*a.width/a.height,cx=x,cy=y-h/2,f=(mirror?-1:1)*sx;
 return <image href={a.src} x={x-w/2} y={y-h} width={w} height={h} opacity={opacity} preserveAspectRatio="xMidYMid meet" filter={tint?"url(#"+tint+")":undefined}
  transform={"rotate("+rotate+" "+cx+" "+cy+")"+(f!==1?" translate("+cx+" 0) scale("+f+" 1) translate("+(-cx)+" 0)":"")}/>;
}
/**
 * How a prop looks from the camera, by which way it faces (lib/staging.ts, facingOf): a person from the front (or back) or in profile; a vehicle or animal
 * side on, narrower as it turns toward or away from the camera; mirrored when it faces frame left. Trees, buildings and objects look the same all round.
 */
/** A sprite's width on screen at height h. */
const spriteW=(sp:Fig,h:number)=>{if(sp.box){const c=VISUALS["cube-3q"];return c?h*c.width/c.height:h;}const v=VISUALS[sp.id];return v?h*sp.sx*v.width/v.height:h;};
/** The eye-level image for a prop, by which way it faces (lib/sprites.ts): the 2D drawings (the collapsed frame, the camera's side view). */
type Fig={id:string;mirror:boolean;sx:number;/** A cube (anything but a character): its real size, drawn as a vector box. */box?:{w:number;h:number;d:number}};
function sprite(p:SceneProp):Fig{if(isCube(p))return {id:"",mirror:false,sx:1,box:cubeDims(p)};const sp=spriteFor(p,"eye",facingOf(p));return {id:sp.id,mirror:sp.mirror,sx:1};}
/** A prop in a side or camera view: its figure from the pack, or a cube drawn as a box of its size (front face, a little of its top and side). */
function PropFig({sp,x,y,h,tint}:{sp:Fig;x:number;y:number;h:number;tint?:string}){
 if(!sp.box)return <Asset id={sp.id} x={x} y={y} h={h} mirror={sp.mirror} sx={sp.sx} tint={tint}/>;
 return <Cube x={x} y={y} h={h} tint={tint}/>;
}
/** A prop from above (the camera's orbit, the lighting): a character's pack image, or the cube from above for anything else. */
function PropTop({p,x,y,h,rotate=0,tint}:{p:SceneProp;x:number;y:number;h:number;rotate?:number;tint?:string}){
 if(isCharacter(p))return <Asset id={topAssetOf(p)} x={x} y={y} h={h} rotate={rotate} tint={tint}/>;
 return <CubeTop x={x} y={y} h={h} rotate={rotate} tint={tint}/>;
}
/**
 * Anything but a character (a product, a car, a tree, a place alone) in the camera and lighting diagrams: one smooth, minimal cube, the same small size
 * whatever it stands for (beta): in a three-quarter view from the side, only its top from above. A vector clay box until the pictures are there.
 */
const CUBE_SIDE=44;
function Cube({x,y,h,tint}:{x:number;y:number;h:number;tint?:string}){
 return VISUALS["cube-3q"]?<Asset id="cube-3q" x={x} y={y} h={h} tint={tint}/>:<ClayBox x={x} y={y} h={h} box={{w:1,h:1,d:1}} tint={tint}/>;
}
/** The cube from above: its top turned 45° (a diamond), as the three-quarter view sees it from the side, corner first. */
function CubeTop({x,y,h,rotate=0,tint}:{x:number;y:number;h:number;rotate?:number;tint?:string}){
 return VISUALS["cube-top"]?<Asset id="cube-top" x={x} y={y} h={h} rotate={rotate+45} tint={tint}/>:<ClayFootprint cx={x} cy={y-h/2} size={h} box={{w:1,d:1}} rotate={rotate+45} tint={tint}/>;
}

/** The main prop (or the first), whose side view the camera view shows; an environment-only scene shows the landscape. */
const mainProp=(s:Staging)=>(s.props??[]).find(p=>p.main)??(s.props??[])[0];

/**
 * The camera's distance, its own tile: the dominant subject on the left and the camera on its stand to its right, its lens on the line to the subject's
 * focus (the face for a person). Drag the camera sideways for its distance (the frame's zoom follows) or up and down for its height on the stand (the
 * angle stays; lib/scene3d.ts, cameraLift). For a character, a blue dotted rectangle on the subject shows what the frame covers: its crop, from the
 * frame's real view (lens, angle, crop and height all count; lib/frame-css.ts, cropOnSubject).
 */
function DistanceView({staging,anchor,aspect,editable,onDistance,onLift}:{staging:Staging;anchor?:Staging;aspect?:string;editable:boolean;onDistance:(v:number)=>void;onLift:(m:number)=>void}){
 const svg=useRef<SVGSVGElement>(null),[dragging,setDragging]=useState(false),tint=useId();
 const grab=useRef<{x:number;y:number;dist:number;lift:number;axis?:"x"|"y";only?:"y"}|null>(null);
 // Laid out so the subject and the camera at its farthest are evenly inside the tile (the camera's body reaches CAMERA_SIZE behind its lens).
 const VW=440,VH=150,X0=46,NEAR=140,FAR=VW-24-CAMERA_SIZE,ground=VH-12,asp=aspect??"16:9";
 const m=mainProp(staging),kind=m?.kind,character=Boolean(m&&isCharacter(m)),size=m&&character?Math.min(116,PROP_HEIGHT[m.kind]*116):CUBE_SIDE;
 // Screen units per metre: the character at its real height; a cube (not to scale) as if a person stood there.
 const perM=m&&character?size/sizeOf(m).h:116/1.75;
 // The camera's track runs at the height of the frame's centre point on the subject (its face by default), raised or lowered with the camera's stand.
 const lift=staging.cameraLift??0;
 const focusY=kind?Math.max(14,Math.min(ground-4,ground-size*centerOnSubject(staging,anchor,asp).height)):ground-30;
 const camY=Math.min(ground-14,focusY-lift*perM);
 const dist=distanceOf(staging),camX=NEAR+(FAR-NEAR)*dist;
 // The subject as the camera sees it, the same image as the frame and the vertical angle tile.
 const sp=m?sprite(m):undefined,mTint=m?propTints(staging.props??[])[(staging.props??[]).indexOf(m)]:undefined;
 // What the frame covers on a character, as a rectangle on it (kept within reach of the tile: a wide shot's crop runs off it).
 const crop=character?cropOnSubject(staging,anchor,asp):undefined;
 const subjectTop=ground-(kind&&sp?size:CUBE_SIDE);
 const cropBox=crop&&Number.isFinite(crop.top)&&Number.isFinite(crop.bottom)?(()=>{const y1=Math.max(subjectTop-size*0.35,ground-crop.top*perM),y2=Math.min(ground+8,ground-crop.bottom*perM),
  cx=X0+Math.max(-30,Math.min(30,(crop.left+crop.right)/2*perM)),half=Math.min(cx-6,Math.max(4,(crop.right-crop.left)/2*perM));return y2>y1?{x:cx-half,y:y1,w:half*2,h:y2-y1}:undefined;})():undefined;
 // The tile is as tall as what it shows: from just above the tallest of the subject, the camera and the crop down to just under the ground, so a short
 // subject (a cat) leaves no empty band above it.
 const top=Math.max(-60,Math.min(subjectTop,camY-CAMERA_SIZE*0.55,cropBox?cropBox.y-4:Infinity)-10),viewH=VH-top;
 const at=(e:PointerEvent):[number,number]=>{const r=svg.current!.getBoundingClientRect();return [(e.clientX-r.left)*VW/r.width,(e.clientY-r.top)*viewH/r.height+top];};
 const move=(e:PointerEvent)=>{const g=grab.current;if(!g)return;const [x,y]=at(e),dx=x-g.x,dy=y-g.y;
  // A drag moves one thing: its first clear direction decides (sideways the distance, up and down the height); the stand's arrows move only the height.
  if(!g.axis){if(Math.hypot(dx,dy)<5)return;g.axis=g.only??(Math.abs(dx)>=Math.abs(dy)?"x":"y");}
  if(g.axis==="x"){const v=g.dist+dx/(FAR-NEAR);onDistance(Math.max(0,Math.min(1,v)));}else onLift(g.lift-dy/perM);};
 const begin=(e:PointerEvent,only?:"y")=>{capture(svg.current,e.pointerId);const [x,y]=at(e);grab.current={x,y,dist,lift,only};setDragging(true);e.stopPropagation();};
 const end=()=>{grab.current=null;setDragging(false);};
 const key=(e:KeyboardEvent)=>{const d={ArrowRight:0.05,ArrowLeft:-0.05}[e.key as "ArrowRight"],l={ArrowUp:0.1,ArrowDown:-0.1}[e.key as "ArrowUp"];
  if(d){e.preventDefault();onDistance(Math.max(0,Math.min(1,dist+d)));}else if(l){e.preventDefault();onLift(lift+l);}};
 const poleX=camX+CAMERA_SIZE*0.45,arrowsY=(camY+ground)/2;
 return <svg ref={svg} viewBox={"0 "+top+" "+VW+" "+viewH} className="mx-auto block w-full touch-pan-y select-none text-fg-primary" style={{aspectRatio:VW+"/"+viewH}} aria-hidden={!editable}
  onPointerMove={dragging?move:undefined} onPointerUp={end} onPointerCancel={end}>
  <BlueTint id={tint}/>{mTint&&<Tint id={tint+"-m"} color={mTint}/>}
  <line x1={8} x2={VW-8} y1={ground} y2={ground} stroke="currentColor" strokeOpacity=".3" strokeWidth={1} vectorEffect="non-scaling-stroke"/>
  {/* The track: from nearest to farthest, with a tick at each end, at the camera's height. */}
  <line x1={NEAR} x2={FAR} y1={camY} y2={camY} stroke="currentColor" strokeOpacity=".35" strokeWidth={1} strokeDasharray="3 4" vectorEffect="non-scaling-stroke"/>
  {[NEAR,FAR].map(x=><line key={x} x1={x} x2={x} y1={camY-5} y2={camY+5} stroke="currentColor" strokeOpacity=".35" strokeWidth={1} vectorEffect="non-scaling-stroke"/>)}
  {kind&&sp?<PropFig sp={sp} x={X0} y={ground} h={size} tint={mTint?tint+"-m":undefined}/>:<Cube x={X0} y={ground} h={CUBE_SIDE}/>}
  {cropBox&&<rect x={cropBox.x} y={cropBox.y} width={cropBox.w} height={cropBox.h} rx={2} fill="none" className="stroke-primary" strokeWidth={1.4} strokeDasharray="4 3" vectorEffect="non-scaling-stroke"/>}
  <line x1={camX} y1={camY} x2={X0} y2={camY} className="stroke-primary" strokeWidth={1.2} strokeDasharray="4 3" vectorEffect="non-scaling-stroke"/>
  {/* The stand: a pole down to the ground on a small foot, with arrows to raise or lower the camera. */}
  <line x1={poleX} x2={poleX} y1={camY+8} y2={ground} stroke="currentColor" strokeOpacity=".45" strokeWidth={1.5} vectorEffect="non-scaling-stroke"/>
  <line x1={poleX-10} x2={poleX+10} y1={ground} y2={ground} stroke="currentColor" strokeOpacity=".45" strokeWidth={2} strokeLinecap="round" vectorEffect="non-scaling-stroke"/>
  {editable&&<g role="slider" tabIndex={-1} aria-label="بالا و پایین بردن دوربین" aria-valuetext={liftFa(lift)} className={(dragging?"cursor-grabbing":"cursor-ns-resize")+" touch-none"} onPointerDown={e=>begin(e,"y")}>
   <circle cx={poleX} cy={arrowsY} r={11} fill="var(--color-bg-primary,transparent)" stroke="currentColor" strokeOpacity=".35" strokeWidth={1} vectorEffect="non-scaling-stroke"/>
   <path d={"M"+(poleX-4)+" "+(arrowsY-2)+"L"+poleX+" "+(arrowsY-7)+"L"+(poleX+4)+" "+(arrowsY-2)+"M"+(poleX-4)+" "+(arrowsY+2)+"L"+poleX+" "+(arrowsY+7)+"L"+(poleX+4)+" "+(arrowsY+2)} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
  </g>}
  <g role={editable?"slider":undefined} tabIndex={editable?0:undefined} aria-label="فاصلهٔ دوربین" aria-valuetext={SHOT_SIZE_FA[staging.shotSize]+"، زوم "+zoomFactor(staging)+"×"+"، پایه: "+liftFa(lift)}
   aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(dist*100)} onKeyDown={editable?key:undefined} onPointerDown={editable?e=>begin(e):undefined}
   className={editable?(dragging?"cursor-grabbing":"cursor-grab")+" touch-none outline-none focus-visible:[&>circle]:stroke-primary":""}>
   <circle cx={camX+CAMERA_SIZE/2} cy={camY} r={36} fill="transparent" strokeWidth={2}/>
   <CameraGlyph view="side" x={camX} y={camY} rotate={0} tint={tint}/>
  </g>
 </svg>;
}

/** The camera's distance on the diagrams: the zoom slider's position (0 closest), so moving the camera closer or further is the same as zooming the frame. */
const distanceOf=(s:Staging)=>sliderFromScale(scaleOf(s));
/** Where a prop may be dragged: measured in the frame as it is drawn (the CSS frame's real view), or in the 2D drawing. */
const reachOf=(p:SceneProp,s:Staging,anchor:Staging|undefined,aspect:string)=>FRAME_RENDERER==="css"?propReach3D(p,s,anchor,aspect):propReach(p,s,anchor,aspect);
const radiusOf=(v:number,min:number,span:number)=>min+span*Math.max(0,Math.min(1,v));
/**
 * Side view, 360°: the main subject on the ground and the camera on a full circle around its focus point, in the camera's own vertical plane. Drag the camera
 * around for its height; carry it over the top and it goes behind the subject (the orbit turns 180°, the same as in the top view); drag in or out for its
 * distance (the frame's zoom follows). The subject is drawn the way it faces the camera (its face toward the camera, its back, or side on), like the frame
 * and the top view. Sized so the whole circle stays inside at any distance.
 */
function CameraView({staging,anchor,aspect,editable,onCamera,onStart}:{staging:Staging;/** A drag begins. */onStart?:()=>void;/** For the sight line: the frame's centre point (see FrameView). */anchor?:Staging;aspect?:string;editable:boolean;onCamera:(c:{elevation:number;flip?:boolean})=>void}){
 const svg=useRef<SVGSVGElement>(null),[dragging,setDragging]=useState(false),tint=useId();
 // Which side of the subject the camera is drawn on (1: right). It changes when a drag carries the camera over the top, so nothing jumps.
 const [dragSide,setSide]=useState<1|-1>(1);
 // The camera stays on its side of this diagram (the right, unless a drag carried it over the top): orbiting never makes it jump; the subject turns instead.
 const side:1|-1=dragSide;
 const VW=220,VH=210,focus:[number,number]=[110,104];
 const m=mainProp(staging),kind=m?.kind;
 const size=m&&isCharacter(m)?Math.min(92,PROP_HEIGHT[m.kind]*92):CUBE_SIDE*0.8;
 // The camera circles the frame's centre point on the subject (its face by default, the detail, or where the user moved the dot): that point is the
 // circle's centre, kept far enough from the edges for the whole circle to show; the subject stands under it.
 const R=56,h=kind?centerOnSubject(staging,anchor,aspect??"16:9").height:0.5,ground0=Math.min(VH-8,focus[1]+(kind==="person"?size*0.9:size*0.55));
 const pivot:[number,number]=[focus[0],kind?ground0-size*h:focus[1]],ground=kind?pivot[1]+size*h:ground0;
 // Everything (the circle with the camera on it, the subject and its ground) is fitted and centred in the tile: never cut, never off to one side.
 const reach=R+CAMERA_SIZE*0.75,top=Math.min(pivot[1]-reach,ground-size-4),bottom=Math.max(pivot[1]+reach,ground+4);
 const fit=Math.min(1,(VH-12)/(bottom-top),(VW-12)/(2*reach)),tx=VW/2-fit*pivot[0],ty=VH/2-fit*(top+bottom)/2;
 // Angle only: the camera stays at one distance here (the distance has its own tile).
 const elev=elevationOf(staging);
 const phi=side===1?elev:180-elev,[cx,cy]=polar(pivot[0],pivot[1],R,-phi);
 // The sight line ends at the frame's centre point on the subject (its face by default, the detail the shot is about, or where the user moved the dot).
 const target=pivot;
 const aim=Math.atan2(target[1]-cy,target[0]-cx)*180/Math.PI,roll=rollOf(staging),camLeft=cx<pivot[0];
 // The subject as this diagram's viewer sees it: facing the camera's side when it faces the camera (sprite: 90 faces right, 0 faces the viewer).
 // The subject as the camera sees it (front, three-quarter, profile, rear three-quarter or back), the same image as the frame: orbiting behind it shows its back.
 const sp=m?sprite(m):undefined;
 const mTint=m?propTints(staging.props??[])[(staging.props??[]).indexOf(m)]:undefined;
 const at=(e:PointerEvent)=>{const r=svg.current!.getBoundingClientRect();const x=((e.clientX-r.left)*VW/r.width-tx)/fit-pivot[0],y=((e.clientY-r.top)*VH/r.height-ty)/fit-pivot[1];
  const psi=Math.atan2(-y,x)*180/Math.PI,s2:1|-1=x>=0?1:-1;
  return {side:s2,elevation:Math.round(Math.max(-60,Math.min(85,wrap180(s2===1?psi:180-psi))))};};
 const key=(e:KeyboardEvent)=>{
  const d={ArrowUp:1,ArrowDown:-1,ArrowRight:1,ArrowLeft:-1}[e.key as "ArrowUp"];if(!d)return;e.preventDefault();
  onCamera({elevation:VERTICAL_STOPS[Math.max(0,Math.min(VERTICAL_STOPS.length-1,verticalIndex(elev)+d))].deg});};
 // Live while dragging, so the frame and the top view follow the camera as it moves.
 const move=(e:PointerEvent)=>{if(!dragging)return;const c=at(e);if(!Number.isFinite(c.elevation))return;
  const flip=c.side!==side;if(flip)setSide(c.side);onCamera({elevation:c.elevation,...(flip?{flip}:{})});};
 return <svg ref={svg} viewBox={"0 0 "+VW+" "+VH} className="mx-auto block aspect-[22/21] w-full max-w-sm touch-pan-y select-none text-fg-primary" aria-hidden={!editable}
  onPointerMove={move} onPointerUp={()=>setDragging(false)} onPointerCancel={()=>setDragging(false)}>
  <BlueTint id={tint}/>
  <g transform={"translate("+tx+" "+ty+") scale("+fit+")"}>
  <circle cx={pivot[0]} cy={pivot[1]} r={R} fill="none" stroke="currentColor" strokeOpacity=".4" strokeWidth={1} strokeDasharray="3 4" vectorEffect="non-scaling-stroke"/>
  <line x1={-VW} x2={VW*2} y1={ground} y2={ground} stroke="currentColor" strokeOpacity=".3" strokeWidth={1} vectorEffect="non-scaling-stroke"/>
  {mTint&&<Tint id={tint+"-m"} color={mTint}/>}
  {kind&&sp?<PropFig sp={sp} x={focus[0]} y={ground} h={size} tint={mTint?tint+"-m":undefined}/>:<Cube x={focus[0]} y={ground} h={size}/>}
  <circle cx={target[0]} cy={target[1]} r={2.2} className="fill-primary"/>
  <line x1={cx} y1={cy} x2={target[0]} y2={target[1]} className="stroke-primary" strokeWidth={1.2} strokeDasharray="4 3" vectorEffect="non-scaling-stroke"/>
  <g role={editable?"slider":undefined} tabIndex={editable?0:undefined} aria-label="ارتفاع و فاصلهٔ دوربین (۳۶۰ درجه)" aria-valuetext={CAMERA_ANGLE_FA[staging.cameraAngle]+"، "+Math.round(elev)+" درجه، "+orbitFa(staging.cameraAzimuth??0)+"، زوم "+zoomFactor(staging)+"×"}
   aria-valuemin={-60} aria-valuemax={85} aria-valuenow={Math.round(elev)}
   onKeyDown={editable?key:undefined} onPointerDown={editable?e=>{capture(svg.current,e.pointerId);onStart?.();setDragging(true);}:undefined}
   className={editable?(dragging?"cursor-grabbing":"cursor-grab")+" touch-none outline-none focus-visible:[&>circle]:stroke-primary":""}>
   {/* A large, finger-sized grab area around the camera (about 50px on a phone), the camera itself drawn blue. */}
   {(()=>{const away=(aim+180)*Math.PI/180,L=CAMERA_SIZE/2;return <circle cx={cx+Math.cos(away)*L} cy={cy+Math.sin(away)*L} r={36} fill="transparent" strokeWidth={2}/>;})()}
   <CameraGlyph view="side" x={cx} y={cy} rotate={aim-180+(camLeft?-roll:roll)} flip={camLeft} tint={tint}/>
  </g>
  </g>
 </svg>;
}

/**
 * Top view (the camera's orbit, 360°): only the target, the main subject, in the middle turned the way it faces (no other props),
 * and the camera on a circle around it. Drag the camera around for its orbit (front, sides, behind) and in or out for its distance; the frame above turns
 * and zooms to match, live.
 */
function OrbitView({staging,anchor,aspect,editable,onOrbit,onStart}:{staging:Staging;/** A drag begins. */onStart?:()=>void;anchor?:Staging;aspect?:string;editable:boolean;onOrbit:(c:{azimuth:number})=>void}){
 const svg=useRef<SVGSVGElement>(null),[dragging,setDragging]=useState(false),tint=useId();
 const VW=220,VH=210,C:[number,number]=[110,105],U=44;
 // Angle only: the camera stays at one distance here (the distance has its own tile).
 const az=staging.cameraAzimuth??0,R=50,rad=az*Math.PI/180,c=Math.cos(rad),n=Math.sin(rad);
 const props=staging.props??[],m=mainProp(staging);
 const cam:[number,number]=[C[0]+R*n,C[1]+R*c];
 // The camera circles the frame's centre point: it is the circle's centre (C), and the subject stands where it is relative to that point (sideways of it
 // when the user moved the dot; kept inside the tile).
 const lat=Math.max(-1.1,Math.min(1.1,centerOnSubject(staging,anchor,aspect??"16:9").lateral)),target:[number,number]=C,S:[number,number]=[C[0]-lat*c*U,C[1]+lat*n*U];
 const at=(e:PointerEvent)=>{const r=svg.current!.getBoundingClientRect();const x=(e.clientX-r.left)*VW/r.width-C[0],y=(e.clientY-r.top)*VH/r.height-C[1];
  return {azimuth:Math.round(Math.atan2(x,y)*180/Math.PI)};};
 const key=(e:KeyboardEvent)=>{
  const d={ArrowRight:SIDE_STEP,ArrowLeft:-SIDE_STEP,ArrowUp:SIDE_STEP,ArrowDown:-SIDE_STEP}[e.key as "ArrowUp"];if(!d)return;e.preventDefault();
  onOrbit({azimuth:snapSide(az+d)});};
 const move=(e:PointerEvent)=>{if(!dragging)return;const v=at(e);if(Number.isFinite(v.azimuth))onOrbit(v);};
 return <svg ref={svg} viewBox={"0 0 "+VW+" "+VH} className="mx-auto block aspect-[22/21] w-full max-w-sm touch-pan-y select-none text-fg-primary" aria-hidden={!editable}
  onPointerMove={move} onPointerUp={()=>setDragging(false)} onPointerCancel={()=>setDragging(false)}>
  <BlueTint id={tint}/>
  <circle cx={C[0]} cy={C[1]} r={R} fill="none" stroke="currentColor" strokeOpacity=".4" strokeWidth={1} strokeDasharray="3 4" vectorEffect="non-scaling-stroke"/>
  {/* Whoush's original camera position, for reference */}
  <circle cx={C[0]} cy={C[1]+R} r={2} fill="currentColor" fillOpacity=".35"/>
  {/* Only the target (the main subject): the camera views are about the camera around it, not the rest of the scene. */}
  {m&&(()=>{const t=propTints(props)[props.indexOf(m)];return <>{t&&<Tint id={tint+"-m"} color={t}/>}<PropTop p={m} x={S[0]} y={S[1]+14} h={28} rotate={-(facingOf(m)+az)} tint={t?tint+"-m":undefined}/></>;})()}
  {!props.length&&<CubeTop x={C[0]} y={C[1]+14} h={28}/>}
  {/* The main subject's facing, the same as in the frame and the side view: an arrow from it the way it faces. */}
  {m&&(()=>{const fw=(facingOf(m)+az)*Math.PI/180,[x,y]=S,d:[number,number]=[Math.sin(fw),Math.cos(fw)],r0=17,r1=31,tip:[number,number]=[x+d[0]*r1,y+d[1]*r1];
   const side:[number,number]=[-d[1],d[0]];
   return <g className="pointer-events-none" aria-hidden="true">
    <line x1={x+d[0]*r0} y1={y+d[1]*r0} x2={tip[0]} y2={tip[1]} className="stroke-primary" strokeWidth={1.4} vectorEffect="non-scaling-stroke"/>
    <path d={"M"+tip[0]+" "+tip[1]+" L"+(tip[0]-d[0]*6+side[0]*4)+" "+(tip[1]-d[1]*6+side[1]*4)+" L"+(tip[0]-d[0]*6-side[0]*4)+" "+(tip[1]-d[1]*6-side[1]*4)+"Z"} className="fill-primary"/>
   </g>;})()}
  {/* The sight line ends at the frame's centre point (sideways of the subject when the user moved it). */}
  <circle cx={target[0]} cy={target[1]} r={2.2} className="fill-primary"/>
  <line x1={cam[0]} y1={cam[1]} x2={target[0]} y2={target[1]} className="stroke-primary" strokeWidth={1.2} strokeDasharray="4 3" vectorEffect="non-scaling-stroke"/>
  <g role={editable?"slider":undefined} tabIndex={editable?0:undefined} aria-label="چرخش و فاصلهٔ دوربین دور سوژه" aria-valuetext={orbitFa(az)+"، زوم "+zoomFactor(staging)+"×"}
   aria-valuemin={-180} aria-valuemax={180} aria-valuenow={Math.round(az)}
   onKeyDown={editable?key:undefined} onPointerDown={editable?e=>{capture(svg.current,e.pointerId);onStart?.();setDragging(true);}:undefined}
   className={editable?(dragging?"cursor-grabbing":"cursor-grab")+" touch-none outline-none focus-visible:[&>circle]:stroke-primary":""}>
   <circle cx={cam[0]+n*CAMERA_SIZE/2} cy={cam[1]+c*CAMERA_SIZE/2} r={36} fill="transparent" strokeWidth={2}/>
   <CameraGlyph view="top" x={cam[0]} y={cam[1]} rotate={Math.atan2(target[0]-cam[0],-(target[1]-cam[1]))*180/Math.PI} tint={tint}/>
  </g>
 </svg>;
}

/** The camera's size in both camera views (its longest side, large enough to see and grab with a finger). */
const CAMERA_SIZE=44;
/**
 * Where the lens is on each camera image, as a share of its width and height: the side image's lens points left with its axis at 64% of the height; the top
 * image's lens points up with its axis at 31% of the width.
 */
const LENS={side:{id:"camera-side",x:0,y:0.64},top:{id:"camera-top",x:0.31,y:0}} as const;
/**
 * The camera drawn with its lens tip exactly at (x, y), the lens on the line toward the subject and the body behind it: `rotate` turns the lens's own
 * direction (left for the side image, up for the top one) toward the subject; `flip` keeps the side camera upright when it is on the subject's left.
 */
function CameraGlyph({view,x,y,rotate,flip,tint}:{view:"side"|"top";x:number;y:number;rotate:number;flip?:boolean;tint?:string}){
 const l=LENS[view],a=VISUALS[l.id];if(!a)return null;
 const k=CAMERA_SIZE/Math.max(a.width,a.height),w=a.width*k,h=a.height*k;
 return <g transform={"translate("+x+" "+y+") rotate("+rotate+")"+(flip?" scale(1 -1)":"")}>
  <image href={a.src} x={-l.x*w} y={-l.y*h} width={w} height={h} preserveAspectRatio="xMidYMid meet" filter={tint?"url(#"+tint+")":undefined}/>
 </g>;
}
/** A filter that tints a drawing with the brand blue, keeping its shading (the camera is blue in the camera views; the lighting view keeps it white). */
function BlueTint({id}:{id:string}){return <Tint id={id} color="var(--color-primary)"/>;}
/** A filter that tints a drawing with a colour, keeping its shading (props of the same kind, each its own colour). */
function Tint({id,color}:{id:string;color:string}){
 return <defs><filter id={id} colorInterpolationFilters="sRGB">
  <feFlood style={{floodColor:color}} result="blue"/><feComposite in="blue" in2="SourceAlpha" operator="in" result="tint"/>
  <feBlend in="tint" in2="SourceGraphic" mode="multiply"/>
 </filter></defs>;
}
/**
 * The place behind the props, drawn from the pack and simple shapes (no image per place), at its real distance (it scales with the lens and blurs with the
 * focus through the group it is drawn in). Open places have a sky horizon at eye level; a room has a back wall meeting the floor (no horizon), side walls
 * converging toward it and a window; a studio has a seamless backdrop with no line at all; streets and forests hide the horizon behind buildings and trees.
 */
function Backdrop({env,W,H,horizon,bf,slide,wallY,gradient}:{env:NonNullable<Staging["environment"]>;W:number;H:number;horizon:number;bf:number;slide:number;wallY:number;gradient:string}){
 const line=(y:number,o=".3")=><line x1={-W*4} x2={W*5} y1={y} y2={y} stroke="currentColor" strokeOpacity={o} strokeWidth={1} vectorEffect="non-scaling-stroke"/>;
 // A row of one pack asset along the horizon, varied in size and mirrored every other time, sliding with the camera's orbit.
 // A row of boxes along the horizon (buildings, trees: everything but the characters is a cube), varied in size, sliding with the camera's orbit.
 const boxes=(h:number,step:number,ratio:number,count=9)=>Array.from({length:count*2+1},(_,k)=>k-count).map(n=>{const vary=0.78+0.44*(((n*37)%7+7)%7)/6,bh=h*bf*vary;
  return <g key={n} opacity={0.7}><PropFig sp={{id:"",mirror:false,sx:1,box:{w:ratio,h:1,d:ratio}}} x={W*0.5+slide+n*step*bf} y={horizon+1} h={bh}/></g>;});
 if(env==="room"){
  const top=-H*3,floor=wallY;
  return <>
   {/* The back wall down to the floor, the floor below it, side walls running from the frame's lower corners to the wall's corners. */}
   <rect x={-W*4} y={top} width={W*9} height={floor-top} fill="currentColor" fillOpacity=".07"/>
   <rect x={-W*4} y={floor} width={W*9} height={H*4} fill={gradient}/>
   {line(floor,".35")}
   <line x1={W*0.5-W*0.62*bf} y1={floor} x2={-W*1.2} y2={H*1.6} stroke="currentColor" strokeOpacity=".25" strokeWidth={1} vectorEffect="non-scaling-stroke"/>
   <line x1={W*0.5+W*0.62*bf} y1={floor} x2={W*2.2} y2={H*1.6} stroke="currentColor" strokeOpacity=".25" strokeWidth={1} vectorEffect="non-scaling-stroke"/>
   <line x1={W*0.5-W*0.62*bf} y1={floor} x2={W*0.5-W*0.62*bf} y2={top} stroke="currentColor" strokeOpacity=".18" strokeWidth={1} vectorEffect="non-scaling-stroke"/>
   <line x1={W*0.5+W*0.62*bf} y1={floor} x2={W*0.5+W*0.62*bf} y2={top} stroke="currentColor" strokeOpacity=".18" strokeWidth={1} vectorEffect="non-scaling-stroke"/>
   <Asset id="light-window" x={W*0.5+slide*0.6+W*0.22*bf} y={floor-H*0.14*bf} h={H*0.42*bf} opacity={0.55}/>
  </>;
 }
 if(env==="studio")return <>
  {/* A seamless backdrop: one soft sweep from wall to floor, no horizon. */}
  <rect x={-W*4} y={-H*3} width={W*9} height={H*8} fill="currentColor" fillOpacity=".05"/>
  <rect x={-W*4} y={wallY-H*0.12} width={W*9} height={H*4} fill={gradient}/>
 </>;
 const ground=<rect x={-W*4} y={horizon} width={W*9} height={H*4} fill={gradient}/>;
 if(env==="street")return <>{ground}{line(horizon,".2")}{boxes(H*0.42,W*0.2,0.7)}</>;
 if(env==="forest")return <>{ground}{line(horizon,".2")}{boxes(H*0.34,W*0.14,0.5,12)}</>;
 if(env==="beach")return <>
  {ground}
  {/* The sea: a flat band from the horizon down to the shore. */}
  <rect x={-W*4} y={horizon} width={W*9} height={H*0.07*bf} fill="currentColor" fillOpacity=".14"/>
  {line(horizon,".45")}{line(horizon+H*0.07*bf,".2")}
 </>;
 if(env==="desert"){
  // Low dunes: a soft wave along the horizon.
  const amp=H*0.035*bf,len=W*0.55*bf,x0=-W*4+((slide%len)+len)%len-len;
  let d="M"+x0+" "+(horizon+1);for(let x=x0;x<W*5;x+=len)d+=" Q"+(x+len/4)+" "+(horizon-amp*2)+" "+(x+len/2)+" "+(horizon-amp*0.6)+" T"+(x+len)+" "+(horizon+1);
  return <>{ground}<path d={d+" L"+W*5+" "+(horizon+2)+" L"+(-W*4)+" "+(horizon+2)+"Z"} fill="currentColor" fillOpacity=".16"/>{line(horizon,".25")}</>;
 }
 // Open landscape: a wide mountain range repeated edge to edge along the horizon.
 const mh=H*0.3*bf,v=VISUALS["env-mountains"],mw=(v?mh*v.width/v.height:mh*1.7)*2.2;
 return <>{ground}{line(horizon)}
  {[-3,-2,-1,0,1,2,3].map(n=><Asset key={n} id="env-mountains" x={W*0.5+slide+n*mw*0.9} y={horizon+1} h={mh} sx={2.2} mirror={n%2!==0} opacity={0.7}/>)}</>;
}

/** A labelled on/off switch (Autopilot, bokeh): the label, then the switch, which runs left to right like every control here (on: knob on the right). */
function Toggle({label,on,onChange}:{label:string;on:boolean;onChange:(on:boolean)=>void}){
 return <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={()=>onChange(!on)}
  className="flex min-h-9 items-center gap-2 rounded-control px-1 type-label text-fg-primary outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
  <span>{label}</span>
  <span dir="ltr" className={"relative inline-block h-5 w-9 shrink-0 rounded-full transition-colors motion-reduce:transition-none "+(on?"bg-primary":"bg-surface-hover")}><span className={"absolute top-0.5 size-4 rounded-full transition-[inset-inline-start] motion-reduce:transition-none "+(on?"start-4.5 bg-primary-foreground":"start-0.5 bg-fg-secondary")}/></span>
 </button>;
}
/** One labelled view tile (the camera's side and top views): bordered, the label above the drawing. */
function Tile({label,children}:{label:string;children:ReactNode}){
 return <div className="flex min-w-0 flex-col gap-1 rounded-card border border-line-secondary p-2">
  <span className="text-center type-caption text-fg-secondary">{label}</span>{children}
 </div>;
}
/**
 * Two-finger pinch on a view: `onPinch` gets the spread since the pinch began (2 is twice as far apart). While two fingers are down, single-finger drags on
 * the view are stopped (the capture-phase handlers run first) and `onStart` lets the view drop any drag it had begun with the first finger.
 */
function usePinch(onPinch:(spread:number)=>void,onStart?:()=>void){
 const pts=useRef(new Map<number,[number,number]>()),start=useRef(0);
 const dist=()=>{const [a,b]=[...pts.current.values()];return a&&b?Math.hypot(a[0]-b[0],a[1]-b[1]):0;};
 const end=(e:PointerEvent)=>{pts.current.delete(e.pointerId);if(pts.current.size<2)start.current=0;};
 return {
  onPointerDownCapture:(e:PointerEvent)=>{if(e.pointerType!=="touch")return;pts.current.set(e.pointerId,[e.clientX,e.clientY]);if(pts.current.size===2){start.current=dist();onStart?.();e.stopPropagation();}},
  onPointerMoveCapture:(e:PointerEvent)=>{if(!pts.current.has(e.pointerId))return;pts.current.set(e.pointerId,[e.clientX,e.clientY]);
   if(pts.current.size>=2&&start.current>0){e.stopPropagation();const d=dist();if(d>0)onPinch(d/start.current);}},
  onPointerUpCapture:end,onPointerCancelCapture:end
 };
}
/** Captures the pointer for a drag; some pointers cannot be captured (it throws), and the drag still works without it. */
function capture(el:Element|null,id:number){try{el?.setPointerCapture(id);}catch{ /* not capturable */ }}
/** "w:h" as a number, 16:9 when unreadable. */
function ratioOf(aspect:string):number{const m=/^(\d+(?:\.\d+)?)[:x×/](\d+(?:\.\d+)?)$/.exec(aspect.trim());const r=m?Number(m[1])/Number(m[2]):16/9;return r>0.2&&r<5?r:16/9;}
const THIRD=1/3;
/** A share of the frame kept inside it (the focus dot never leaves the frame). */
const inFrame=(t:number)=>Math.max(0.03,Math.min(0.97,t));
/** A framing offset, clamped and rounded; smooth (no snapping), the thirds lines only light up when the subject is on one. */
const snapAxis=(v:number)=>Math.max(-1,Math.min(1,Math.round(v*100)/100));
/**
 * The camera's view at the aspect ratio with thirds, and where props are arranged: the fixed environment backdrop, then each prop in depth (further back
 * stands higher on the ground plane and is smaller; drawn back to front), scaled by the shot size around the main subject.
 * - Drag a prop: sideways moves it left and right, up moves it back, down brings it forward (its lift above the ground is in the inspector).
 * - Drag the empty background: slides the crop like a crop tool, snapping to the thirds and the centre.
 * - Keyboard: arrow keys move the selected prop (or the crop when the frame itself has focus).
 */
function FrameView({staging,anchor,aspect,editable,onFraming,sel,onSelect,onProp,onZoom,locked=false,onLock,onFocus,onBack,centerSel=false,onSelectCenter,three=false,onFullscreen,onAngle}:{staging:Staging;
 /** The scene whose main subject anchors the zoom (Whoush's original layout): fixed while props move, so moving the main subject moves only it. */anchor?:Staging;
 aspect:string;editable?:boolean;onFraming?:(f:{x:number;y:number}|undefined)=>void;
 /** The selected prop (null: none, the frame's own settings show). */sel?:number|null;onSelect?:(i:number|null)=>void;onProp?:(i:number,x:number,z:number)=>void;
 /** Pinch to zoom (phones): the new camera distance, 0 closest (the zoom slider's value). */onZoom?:(distance:number)=>void;
 /** The selection is locked (the lock beside its tag): clicks never select anything else, and a drag anywhere moves the locked prop (or the crop). */locked?:boolean;onLock?:(on:boolean)=>void;
 /** The centre-point dot: dragged to a new place (its new centre point and the crop that keeps the picture still), or double-clicked back to the dominant subject. */
 onFocus?:(f:Partial<Staging>|null)=>void;
 /** Back to the frame's own settings (the badge's ×). */onBack?:()=>void;
 /** The centre point's dot is selected (its settings show), and selecting it. */centerSel?:boolean;onSelectCenter?:()=>void;
 /** Draw the frame in real 3D (the lens's perspective, any height angle, fisheye, depth of field); the 2D drawing's overlays stay on top. */three?:boolean;
 /** Opens the frame full screen. */onFullscreen?:()=>void;
 /** The angle joystick: a new camera height (a stop) or orbit (a side). */onAngle?:(c:{elevation?:number;azimuth?:number})=>void}){
 // In 3D: where the centre point and the selected prop land on screen (fractions of the frame), and whether a press just landed on a prop.
 const [proj,setProjRaw]=useState<Record<string,[number,number]>>({});
 const setProj=(p:Record<string,[number,number]>)=>setProjRaw(o=>sameJSON(o,p)?o:p);
 const propHit=useRef(false);
 const clip=useId(),svg=useRef<SVGSVGElement>(null),{W,H}=frameSize(aspect);
 const [drag,setDrag]=useState<{px:number;py:number;x:number;y:number;cur:{x:number;y:number}}|null>(null);
 const [move,setMove]=useState<{i:number;px:number;py:number;x0:number;z0:number;x:number;z:number}|null>(null);
 const [pivot,setPivot]=useState(false);
 /** Taking the centre point's dot: selects it (unless the selection is locked) and starts dragging it. */
 const pivotDown=(e:PointerEvent)=>{e.stopPropagation();capture(svg.current,e.pointerId);if(!locked)onSelectCenter?.();setPivot(true);};
 /** A pointer position in the frame's own coordinates (the viewBox). */
 const svgPt=(e:PointerEvent):[number,number]=>{const b=svg.current!.getBoundingClientRect();return [(e.clientX-b.left)*(W+4)/b.width-2,(e.clientY-b.top)*(H+4)/b.height-2];};
 const fr=drag?.cur??staging.framing??{x:0,y:0};
 // Pinch: spreading two fingers zooms in (the camera comes closer), pinching zooms out; any one-finger drag stops.
 const pinchFrom=useRef(0);
 const pinch=usePinch(sp=>onZoom?.(Math.max(0,Math.min(1,pinchFrom.current-Math.log(sp)/Math.log(ZOOM_RANGE[1]/ZOOM_RANGE[0])))),()=>{pinchFrom.current=sliderFromScale(scaleOf(staging));setMove(null);setDrag(null);});
 const base=(staging.props??[]).map((p,i)=>move?.i===i?{...p,x:move.x,z:move.z}:p);
 // In the beta the frame draws only the characters (people and the pets); the other props stay in the scene and the prompt.
 const order=base.map((p,i)=>({p,i})).filter(({p})=>isCharacter(p)).sort((a,b)=>b.p.z-a.p.z);
 // Props of the same kind (several people...) each get their own tint so they read apart.
 const tints=propTints(base);
 // Each prop's place in words, with the frame's cuts as drawn (for screen readers; the same words Whoush and the provider get).
 const placed=withFrameCuts({...staging,props:base,framing:drag?.cur??staging.framing},anchor,aspect).props??[];
 // The scene is laid out once, in fixed world positions; the shot size is a pure zoom of that world about the original main subject, which the frame
 // centres (lib/staging.ts, frameCamera): zooming never moves anything relative to anything else, and moving any prop (the main subject too) moves only it.
 const cam=frameCamera({...staging,framing:fr},anchor,W,H),{unitH,k}=cam,horizon=H*0.5;
 // The lens's perspective: a prop's size against the main subject follows the focal length (lib/staging.ts, lensSizeFactor); its place on the ground does not,
 // so dragging stays exact.
 // Measured against the scene as it is right now (a prop being dragged included), so nothing jumps in size while it moves.
 const live:Staging={...staging,props:base};
 const at=(p:SceneProp)=>{const v=propInView(p,W,H,unitH),lf=lensSizeFactor(live,p.z);return {x:v.x,ground:v.groundY,y:v.groundY-(v.groundY-v.y)*lf,h:v.h*lf};};
 // Screen = roll(base + k·world): the Dutch angle rolls the whole picture about the frame's centre.
 const world="rotate("+cam.rot+" "+W/2+" "+H/2+") matrix("+k+" 0 0 "+k+" "+cam.base.join(" ")+")";
 // The backdrop: the horizon moves as the camera tilts to keep the subject framed; a longer lens magnifies the far landscape, a wider one shows more of it.
 const backdrop="rotate("+cam.rot+" "+W/2+" "+H/2+") translate(0 "+horizonShift(staging)*H+") matrix("+k+" 0 0 "+k+" "+cam.base.join(" ")+")";
 const bf=backdropFactor(staging);
 // Depth of field, in the scaled world's own units (a blur of n screen units is n/k there).
 // Focus follows the centre point: on the main subject, or on whatever sits where the user moved it.
 const focusZ=focusDepth({...live,framing:fr},anchor,W,H);
 const blurStd=(z:number|"backdrop")=>{const v=blurAt(live,z,focusZ)*H;return v>0.06?v/k:0;};
 const onX=Math.abs(Math.abs(fr.x)-THIRD)<0.03,onY=Math.abs(Math.abs(fr.y)-THIRD)<0.03;
 const unit=()=>{const b=svg.current!.getBoundingClientRect();return {sx:(W+4)/b.width,sy:(H+4)/b.height};};
 const commit=(v:{x:number;y:number})=>onFraming?.(v.x===0&&v.y===0?undefined:v);
 /** A ground point limited to where the prop may go at this zoom and crop: as far out of the frame on the left as on the right, and into the bottom edge. */
 const within=(p:SceneProp,g:{x:number;z:number})=>{const r=reachOf(p,staging,anchor,aspect);const c=(v:number,lo:number,hi:number)=>Math.round(Math.max(lo,Math.min(hi,v))*100)/100;return {x:c(g.x,r.xMin,r.xMax),z:c(g.z,r.zMin,r.zMax)};};
 const cropDrag=(e:PointerEvent)=>setDrag({px:e.clientX,py:e.clientY,x:fr.x,y:fr.y,cur:fr});
 const moveLocked=(e:PointerEvent)=>{const q=base[sel!];setMove({i:sel!,px:e.clientX,py:e.clientY,x0:q.x,z0:q.z,x:q.x,z:q.z});};
 /** The ground point (x, z) under a world point: the inverse of `at` on the ground plane. */
 const ground=(gx:number,gy:number)=>groundFromView(gx,gy,W,H);
 const key=(e:KeyboardEvent)=>{
  const d={ArrowLeft:[-0.05,0],ArrowRight:[0.05,0],ArrowUp:[0,-0.05],ArrowDown:[0,0.05]}[e.key as "ArrowLeft"];if(!d)return;e.preventDefault();
  commit({x:snapAxis(fr.x+d[0]),y:snapAxis(fr.y+d[1])});
 };
 const third=(on:boolean,neg:boolean,i:number)=>on&&(i===1)===neg;
 // The selection's tag (on the top-right of the selected prop's box, or inside the frame's top-right for «#کادر»; right-aligned, as Persian reads) with its lock, as HTML over the drawing.
 const maxW=Math.round(320*(W+4)/(H+4));
 // The centre point selected: neither a prop nor the frame is (no tag, no frame outline).
 const tag=!editable||centerSel?undefined:sel!=null&&base[sel]?(()=>{const p=base[sel],a=at(p),wf=spriteW(sprite(p),a.h);
  const [rx,ty]=three?(proj.sel?[proj.sel[0]*W+8,proj.sel[1]*H]:[W-3,3]):cam.toScreen(a.x+wf/2+1,a.y-a.h-1);return {x:Math.max(52,Math.min(W-1,rx)),y:Math.max(0,Math.min(H-2,ty)),above:ty>12,text:propTags(base,true)[sel]};})()
  :{x:W-3,y:3,above:false,text:"#کادر"};
 const svgEl=<svg ref={svg} viewBox={"-2 -2 "+(W+4)+" "+(H+4)} {...(editable&&onZoom&&!three?pinch:{})} className={"mx-auto block w-full touch-none select-none text-fg-primary"+(three?" pointer-events-none relative z-[1]":"")} style={{aspectRatio:String((W+4)/(H+4)),maxWidth:Math.round(320*(W+4)/(H+4))+"px"}} aria-hidden={!editable}
  onPointerMove={e=>{
   if(pivot){const [sx,sy]=svgPt(e);if(Number.isFinite(sx)&&Number.isFinite(sy))onFocus?.(three?{pivot:pickPivot({...staging,framing:fr},anchor,aspect,inFrame(sx/W),inFrame(sy/H))}:moveFocusPoint({...staging,framing:fr},anchor,W,H,sx,sy));return;}
   const u=unit();
   if(move){const p0=propInView({...base[move.i],x:move.x0,z:move.z0,y:0},W,H,unitH),[ddx,ddy]=cam.unroll((e.clientX-move.px)*u.sx,(e.clientY-move.py)*u.sy);const g=ground(p0.x+ddx/k,p0.groundY+ddy/k);if(Number.isFinite(g.x)&&Number.isFinite(g.z))setMove({...move,...within({...base[move.i],z:g.z},g)});return;}
   if(drag){const [ddx,ddy]=cam.unroll((e.clientX-drag.px)*u.sx,(e.clientY-drag.py)*u.sy);const c={x:snapAxis(drag.x+ddx/(W/2)),y:snapAxis(drag.y+ddy/(H/2))};if(Number.isFinite(c.x)&&Number.isFinite(c.y))setDrag({...drag,cur:c});}}}
  onPointerUp={()=>{setPivot(false);if(move){onProp?.(move.i,move.x,move.z);setMove(null);}if(drag){commit(drag.cur);setDrag(null);}}} onPointerCancel={()=>{setDrag(null);setMove(null);setPivot(false);}}>
  <defs><clipPath id={clip}><rect width={W} height={H} rx={6}/></clipPath>
   <linearGradient id={clip+"g"} x1="0" y1="0" x2="0" y2="1"><stop offset=".5" stopColor="currentColor" stopOpacity="0"/><stop offset="1" stopColor="currentColor" stopOpacity=".14"/></linearGradient></defs>
  <g clipPath={"url(#"+clip+")"}>
   {!three&&<rect width={W} height={H} className="fill-background"/>}
   {editable&&!three&&<rect width={W} height={H} fill="transparent" role="slider" tabIndex={0} aria-label={"جای سوژه در کادر: "+placementFa(staging.framing)} aria-valuetext={placementFa(staging.framing)}
    aria-valuenow={Math.round(fr.x*100)} aria-valuemin={-100} aria-valuemax={100} onKeyDown={key} className={"outline-none "+(drag?"cursor-grabbing":"cursor-grab")}
    onPointerDown={e=>{capture(svg.current,e.pointerId);if(locked&&sel!=null&&base[sel]){moveLocked(e);return;}if(!locked)onSelect?.(null);cropDrag(e);}}/>}
   {!three&&<>{blurStd("backdrop")>0&&<defs><filter id={clip+"-bd"} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation={blurStd("backdrop")}/></filter></defs>}
   <g transform={backdrop} className="pointer-events-none" filter={blurStd("backdrop")>0?"url(#"+clip+"-bd)":undefined}>
    <Backdrop env={staging.environment??"landscape"} W={W} H={H} horizon={horizon} bf={bf} gradient={"url(#"+clip+"g)"}
     slide={-wrap180(staging.cameraAzimuth??0)/180*W*1.2*bf} wallY={propInView({kind:"object",x:0,z:Math.min(3,wallDepth(live)),y:0},W,H,unitH).groundY}/>
   </g>
   <g transform={world}>
    {!three&&order.map(({p,i})=>{const a=at(p),sp=sprite(p),w=spriteW(sp,a.h),on=sel===i;
     const pkey=(e:KeyboardEvent)=>{if(e.key==="Escape"&&on){e.preventDefault();e.stopPropagation();if(!locked)onSelect?.(null);return;}
      if(locked&&!on)return;
      const d={ArrowLeft:[-0.1,0],ArrowRight:[0.1,0],ArrowUp:[0,0.1],ArrowDown:[0,-0.1]}[e.key as "ArrowLeft"];if(!d)return;e.preventDefault();e.stopPropagation();onSelect?.(i);const g=within(p,{x:p.x+d[0],z:p.z+d[1]});onProp?.(i,g.x,g.z);};
     return <g key={i} role={editable?"button":undefined} tabIndex={editable?0:undefined} aria-label={propTags(base)[i]+"، "+propPlaceFa(placed[i]??p)} aria-pressed={editable?on:undefined}
      onKeyDown={editable?pkey:undefined} onClick={editable?()=>{if(!locked)onSelect?.(i);}:undefined}
      onPointerDown={editable?e=>{e.stopPropagation();capture(svg.current,e.pointerId);
       // Locked: this prop is not selected; the drag goes to the locked prop, or to the crop when the frame is locked.
       if(locked&&!on){if(sel!=null&&base[sel])moveLocked(e);else cropDrag(e);return;}
       onSelect?.(i);setMove({i,px:e.clientX,py:e.clientY,x0:p.x,z0:p.z,x:p.x,z:p.z});}:undefined}
      className={editable?(move?.i===i?"cursor-grabbing outline-none":"cursor-grab outline-none"):""}>
      {p.y>0.05&&<ellipse cx={a.x} cy={a.ground} rx={w*0.35} ry={Math.max(1,a.h*0.04)} fill="currentColor" fillOpacity=".18"/>}
      <rect x={a.x-Math.max(w,18/k)/2} y={a.y-Math.max(a.h,18/k)} width={Math.max(w,18/k)} height={Math.max(a.h,18/k)} fill="transparent"/>
      {tints[i]&&<Tint id={clip+"-t"+i} color={tints[i]!}/>}
      {(()=>{const sp=sprite(p),bs=blurStd(p.z),id=clip+"-p"+i;
       return <g filter={bs>0?"url(#"+id+"-b)":undefined}>
        {bs>0&&<defs><filter id={id+"-b"} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation={bs}/></filter></defs>}
        <PropFig sp={sp} x={a.x} y={a.y} h={a.h} tint={tints[i]?clip+"-t"+i:undefined}/>
       </g>;})()}
      {on&&<rect x={a.x-w/2-1} y={a.y-a.h-1} width={w+2} height={a.h+2} rx={2} fill="none" className="stroke-primary" strokeWidth={1} vectorEffect="non-scaling-stroke" strokeDasharray="3 2"/>}
     </g>;})}
   </g></>}
   {editable&&<text x={W-3} y={H-3} direction="rtl" textAnchor="start" fontSize={3.6} fill="currentColor" fillOpacity=".55" className="pointer-events-none" aria-hidden="true">پیش‌نمایش تقریبی</text>}
   {[1,2].map(i=><g key={i} strokeDasharray="3 3" strokeWidth={1} className="pointer-events-none">
    <line vectorEffect="non-scaling-stroke" x1={W*i/3} x2={W*i/3} y1={0} y2={H} className={third(onX,fr.x<0,i)?"stroke-primary":""} stroke={third(onX,fr.x<0,i)?undefined:"currentColor"} strokeOpacity={third(onX,fr.x<0,i)?1:.3}/>
    <line vectorEffect="non-scaling-stroke" x1={0} x2={W} y1={H*i/3} y2={H*i/3} className={third(onY,fr.y<0,i)?"stroke-primary":""} stroke={third(onY,fr.y<0,i)?undefined:"currentColor"} strokeOpacity={third(onY,fr.y<0,i)?1:.3}/>
   </g>)}
  </g>
  {/* The centre point: the zoom pivots around it. On the dominant subject (its face for a person) unless the user moved it; drag to move it (the picture
      stays still), double-click to bring it back to the dominant subject. A large invisible ring makes it easy to take with a finger. */}
  {editable&&onFocus&&(()=>{const [dx,dy]=three?(proj.center?[proj.center[0]*W,proj.center[1]*H]:[NaN,NaN]):cam.toScreen(cam.F[0],cam.F[1]);if(!(dx>=-1&&dx<=W+1&&dy>=-1&&dy<=H+1))return null;
   return <g role="slider" tabIndex={0} aria-label={"نقطهٔ مرکز کادر"+(staging.focusPoint||staging.pivot?" (جابه‌جا شده؛ دوبار بزن تا برگرده روی سوژهٔ اصلی)":" (روی سوژهٔ اصلی)")}
    aria-valuetext={staging.focusPoint||staging.pivot?"جابه‌جا شده":"روی سوژهٔ اصلی"} className={"pointer-events-auto touch-none outline-none "+(pivot?"cursor-grabbing":"cursor-move")}
    onPointerDown={pivotDown} onDoubleClick={e=>{e.stopPropagation();onFocus(null);}}
    onKeyDown={e=>{const d={ArrowLeft:[-2,0],ArrowRight:[2,0],ArrowUp:[0,-2],ArrowDown:[0,2]}[e.key as "ArrowLeft"];if(e.key==="Enter"){e.preventDefault();onFocus(null);return;}if(!d)return;e.preventDefault();e.stopPropagation();
     onFocus(three?{pivot:pickPivot({...staging,framing:fr},anchor,aspect,inFrame((dx+d[0])/W),inFrame((dy+d[1])/H))}:moveFocusPoint({...staging,framing:fr},anchor,W,H,dx+d[0],dy+d[1]));}}>
    <circle cx={dx} cy={dy} r={10} fill="transparent"/>
    {centerSel&&<circle cx={dx} cy={dy} r={7} fill="none" className="stroke-primary" strokeWidth={1} strokeDasharray="2 2" vectorEffect="non-scaling-stroke"/>}
    <circle cx={dx} cy={dy} r={4.2} fill="none" className="stroke-primary" strokeWidth={centerSel?1.8:1.2} vectorEffect="non-scaling-stroke"/>
    <circle cx={dx} cy={dy} r={1.8} className={staging.focusPoint||staging.pivot?"fill-primary":"fill-primary-foreground stroke-primary"} strokeWidth={0.8} vectorEffect="non-scaling-stroke"/>
   </g>;})()}
  {/* With no prop selected, the frame itself is: a blue outline and its «#کادر» tag, and the controls below are the frame's. */}
  {editable&&(sel==null||!base[sel])&&!centerSel
   ?<><rect width={W} height={H} rx={6} fill="none" className="pointer-events-none stroke-primary" strokeWidth={1.6} vectorEffect="non-scaling-stroke"/>
</>
   :<rect width={W} height={H} rx={6} fill="none" stroke="currentColor" strokeOpacity=".75" strokeWidth={1.2} vectorEffect="non-scaling-stroke" className="pointer-events-none"/>}
 </svg>;
 if(!editable)return svgEl;
 /** Arrow keys move a prop (the 3D view's keyboard access: one hidden button per prop). */
 const propKey=(i:number)=>(e:KeyboardEvent)=>{const p=base[i];if(!p||(locked&&sel!==i))return;
  const d={ArrowLeft:[-0.1,0],ArrowRight:[0.1,0],ArrowUp:[0,0.1],ArrowDown:[0,-0.1]}[e.key as "ArrowLeft"];if(!d)return;e.preventDefault();onSelect?.(i);const g=within(p,{x:p.x+d[0],z:p.z+d[1]});onProp?.(i,g.x,g.z);};
 return <div className="relative mx-auto w-full" style={{maxWidth:maxW+"px"}}>
  {/* The 3D frame under the drawing's overlays (thirds, outline, centre point, tags): a press on a prop picks and drags it on the ground; a press on the empty
      set slides the crop, as in 2D. */}
  {three&&<div role="slider" tabIndex={0} aria-label={"جای سوژه در کادر: "+placementFa(staging.framing)} aria-valuetext={placementFa(staging.framing)} aria-valuenow={Math.round(fr.x*100)} aria-valuemin={-100} aria-valuemax={100}
   onKeyDown={key} {...(onZoom?pinch:{})} className={"absolute touch-none overflow-hidden bg-background outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring "+(drag?"cursor-grabbing":"cursor-grab")}
   style={{insetInlineStart:(2/(W+4)*100)+"%",top:(2/(H+4)*100)+"%",width:(W/(W+4)*100)+"%",height:(H/(H+4)*100)+"%",borderRadius:(6/W*100)+"% / "+(6/H*100)+"%"}}
   onPointerDown={e=>{if(propHit.current){propHit.current=false;return;}if(e.button>0)return;capture(e.currentTarget,e.pointerId);if(!locked)onSelect?.(null);cropDrag(e);}}
   onPointerMove={e=>{if(!drag)return;const u=unit(),[ddx,ddy]=cam.unroll((e.clientX-drag.px)*u.sx,(e.clientY-drag.py)*u.sy);const c={x:snapAxis(drag.x+ddx/(W/2)),y:snapAxis(drag.y+ddy/(H/2))};if(Number.isFinite(c.x)&&Number.isFinite(c.y))setDrag({...drag,cur:c});}}
   onPointerUp={()=>{if(drag){commit(drag.cur);setDrag(null);}}} onPointerCancel={()=>setDrag(null)}>
   <FrameScene staging={{...staging,framing:fr}} anchor={anchor} aspect={aspect} editable sel={centerSel?null:sel} lockedTo={locked&&sel!=null?sel:undefined}
    onSelect={i=>{if(!locked)onSelect?.(i);}} onProp={onProp} onPropDown={()=>{propHit.current=true;}} onProject={setProj} within={within}/>
  </div>}
  {three&&<div className="sr-only">{base.map((p,i)=>isCharacter(p)&&<button key={i} type="button" aria-pressed={sel===i} onClick={()=>{if(!locked)onSelect?.(i);}} onKeyDown={propKey(i)}>{propTags(base)[i]+"، "+propPlaceFa(placed[i]??p)}</button>)}</div>}
  {svgEl}
  {onAngle&&<AngleJoystick staging={staging} onAngle={onAngle} inset={(2/(W+4)*100)+"%"} insetY={(2/(H+4)*100)+"%"}/>}
  {three&&onFullscreen&&<button type="button" onClick={onFullscreen} aria-label="نمایش تمام‌صفحهٔ کادر"
   className="absolute top-3 end-3 z-10 flex size-8 items-center justify-center rounded-control bg-background/70 text-fg-primary shadow-1 backdrop-blur-sm motion-hover hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
   <Icon icon={Maximize2} size={16} aria-hidden="true"/></button>}
  {/* What the controls below are adjusting, while a prop is selected: a blue badge in the frame's top-right corner, «تنظیم #آدم ×»; × goes back to the
      frame's own settings (and unlocks). */}
  {((sel!=null&&base[sel])||centerSel)&&onBack&&<div className="absolute top-3 start-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-1.5">
   {/* Each badge hugs its text in full (never cut); when two do not fit side by side, the second wraps under the first. */}
   <button type="button" onClick={onBack} aria-label={"تنظیم "+(centerSel?"مرکز":propTags(base)[sel!])+"، برگشت به تنظیمات کادر"}
   className="flex h-7 w-max shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-primary ps-2.5 pe-1.5 text-xs font-medium text-primary-foreground shadow-1 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring pointer-coarse:h-8">
   <span>تنظیم {centerSel?"مرکز":<bdi>{propTags(base)[sel!]}</bdi>}</span><Icon icon={X} size={16} aria-hidden="true" className="size-3.5! shrink-0"/>
   </button>
   {/* With the centre point selected: back to Whoush's default centre (on the dominant subject, Whoush's framing); white badge, blue text. */}
   {centerSel&&<button type="button" onClick={()=>onFocus?.(null)} aria-label="بازگشت به مرکز سوژه"
    className="flex h-7 w-max shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-white ps-2 pe-2.5 text-xs font-medium text-primary shadow-1 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60 pointer-coarse:h-8">
    <Icon icon={Undo2} size={16} aria-hidden="true" className="size-3.5! shrink-0"/>بازگشت به مرکز سوژه</button>}
  </div>}
  {/* Tag text, then (on its right) the lock in a small button: outline when unlocked, filled blue with a white lock when locked. On touch screens the
      button is larger and its tap area reaches about 44px around it (an invisible ::before), so it is easy to hit with a finger. */}
  {tag&&<div dir="rtl" className={"pointer-events-none absolute flex items-center gap-1.5 "+(tag.above?"-translate-y-full pb-0.5":"pt-0.5")}
   style={{right:((W+2-tag.x)/(W+4)*100)+"%",top:((tag.y+2)/(H+4)*100)+"%"}}>
   {onLock&&<button type="button" aria-pressed={locked} aria-label={(locked?"باز کردن قفل انتخاب ":"قفل کردن انتخاب ")+tag.text} onClick={()=>onLock(!locked)}
    className={"pointer-events-auto relative flex size-6 items-center justify-center rounded-[4px] before:absolute before:-inset-2.5 before:content-[''] pointer-coarse:size-7 border border-primary motion-hover focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring "+(locked?"bg-primary text-primary-foreground":"bg-transparent text-primary")}>
    <Icon icon={locked?Lock:LockOpen} size={16} aria-hidden="true" className={"size-3.5! "+(locked?"[&_rect]:fill-current":"")}/></button>}
   <bdi className="whitespace-nowrap text-xs font-medium leading-none text-primary pointer-coarse:text-[13px]">{tag.text}</bdi>
  </div>}
 </div>;
}

/**
 * The angle joystick, in the frame's bottom-left corner: up and down move the camera through the five height stops, left and right orbit it 45° around the
 * subject (the sides the pack is drawn at). The centre shows the angle as a small gizmo (the camera on its ring around the subject, raised by its height);
 * tapping it goes back to eye level, from the front.
 */
function AngleJoystick({staging,onAngle,inset,insetY}:{staging:Staging;onAngle:(c:{elevation?:number;azimuth?:number})=>void;inset:string;insetY:string}){
 const vi=verticalIndex(elevationOf(staging)),az=snapSide(staging.cameraAzimuth??0),stop=VERTICAL_STOPS[vi];
 const btn="absolute flex size-6 items-center justify-center rounded-full bg-background/80 text-fg-primary shadow-1 backdrop-blur-sm motion-hover hover:bg-background disabled:opacity-40 outline-none focus-visible:outline-2 focus-visible:outline-ring before:absolute before:-inset-2 before:content-[''] pointer-coarse:size-7";
 const at=(x:string,y:string,t:string)=>({left:x,top:y,transform:t});
 const now=stop.fa+"، "+sideStopFa(az)+(Math.abs(az)%180?(az>0?" از راست":" از چپ"):"");
 // The gizmo: the subject in the middle, its ground ring seen from a little above, the camera on it at the orbit, raised by the height.
 const e=stop.deg*Math.PI/180,a=az*Math.PI/180,R=8,cx=12,cy=13,cam:[number,number]=[cx+R*Math.sin(a)*Math.cos(e),cy+R*0.38*Math.cos(a)*Math.cos(e)-R*Math.sin(e)];
 return <div dir="ltr" role="group" aria-label={"زاویهٔ دوربین: "+now} className="absolute z-10 size-[76px] pointer-coarse:size-[84px]" style={{left:"calc("+inset+" + 6px)",bottom:"calc("+insetY+" + 6px)"}}
  onPointerDown={e=>e.stopPropagation()}>
  <button type="button" className={btn} style={at("50%","0","translateX(-50%)")} disabled={vi>=VERTICAL_STOPS.length-1} aria-label={"دوربین بالاتر"+(VERTICAL_STOPS[vi+1]?": "+VERTICAL_STOPS[vi+1].fa:"")}
   onClick={()=>onAngle({elevation:VERTICAL_STOPS[Math.min(VERTICAL_STOPS.length-1,vi+1)].deg})}><Icon icon={ChevronUp} size={16} aria-hidden="true" className="size-3.5!"/></button>
  <button type="button" className={btn} style={at("50%","100%","translate(-50%,-100%)")} disabled={vi<=0} aria-label={"دوربین پایین‌تر"+(VERTICAL_STOPS[vi-1]?": "+VERTICAL_STOPS[vi-1].fa:"")}
   onClick={()=>onAngle({elevation:VERTICAL_STOPS[Math.max(0,vi-1)].deg})}><Icon icon={ChevronDown} size={16} aria-hidden="true" className="size-3.5!"/></button>
  <button type="button" className={btn} style={at("0","50%","translateY(-50%)")} aria-label="چرخش دوربین دور سوژه، به چپ"
   onClick={()=>onAngle({azimuth:snapSide(az-SIDE_STEP)})}><Icon icon={ChevronLeft} size={16} aria-hidden="true" className="size-3.5!"/></button>
  <button type="button" className={btn} style={at("100%","50%","translate(-100%,-50%)")} aria-label="چرخش دوربین دور سوژه، به راست"
   onClick={()=>onAngle({azimuth:snapSide(az+SIDE_STEP)})}><Icon icon={ChevronRight} size={16} aria-hidden="true" className="size-3.5!"/></button>
  <button type="button" title={now} aria-label={"زاویهٔ فعلی: "+now+". برگشت به هم‌سطح چشم، روبه‌رو"} onClick={()=>onAngle({elevation:0,azimuth:0})}
   className="absolute flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-1 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" style={at("50%","50%","translate(-50%,-50%)")}>
   <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.2}>
    <ellipse cx={cx} cy={cy} rx={R} ry={R*0.38} strokeOpacity={0.5}/>
    <circle cx={cx} cy={cy-4.2} r={1.6} fill="currentColor" stroke="none"/><path d={"M"+cx+" "+(cy-2.4)+"V"+cy} strokeWidth={1.6} strokeLinecap="round"/>
    <path d={"M"+cam[0]+" "+cam[1]+"L"+cx+" "+(cy-3)} strokeDasharray="1.5 1.2"/>
    <circle cx={cam[0]} cy={cam[1]} r={2.1} fill="currentColor" stroke="none"/>
   </svg>
  </button>
 </div>;
}

/**
 * The frame full screen, to look around and check: the same camera seeing past the frame, the frame itself outlined in green with everything outside it
 * darkened. Drag a prop to move it on the ground; tap one to adjust it in a modal; drag anywhere else to move the frame (the crop); pinch or scroll to zoom.
 */
function FrameFullscreen({staging,anchor,aspect,sel,onSelect,onProp,onFraming,distance,onZoom,onClose,inspector}:{staging:Staging;anchor?:Staging;aspect:string;
 sel:number|null;onSelect:(i:number|null)=>void;onProp:(i:number,x:number,z:number)=>void;onFraming:(f:{x:number;y:number}|undefined)=>void;
 /** The camera's distance (0 closest) and zooming it. */distance:number;onZoom:(v:number)=>void;onClose:()=>void;
 /** A prop's settings, for the modal. */inspector:(i:number)=>ReactNode}){
 const [rect,setRectRaw]=useState<FrameRect|null>(null);
 const setRect=(r:FrameRect)=>setRectRaw(o=>sameJSON(o,r)?o:r);
 const [inspect,setInspect]=useState<number|null>(null);
 const [drag,setDrag]=useState<{px:number;py:number;x:number;y:number;cur:{x:number;y:number}}|null>(null);
 const box=useRef<HTMLDivElement>(null),propHit=useRef(false),pinchFrom=useRef(0);
 const fr=drag?.cur??staging.framing??{x:0,y:0};
 const props=staging.props??[];
 const within=(p:SceneProp,g:{x:number;z:number})=>{const r=reachOf(p,staging,anchor,aspect);const c=(v:number,lo:number,hi:number)=>Math.round(Math.max(lo,Math.min(hi,v))*100)/100;return {x:c(g.x,r.xMin,r.xMax),z:c(g.z,r.zMin,r.zMax)};};
 const pinch=usePinch(sp=>onZoom(Math.max(0,Math.min(1,pinchFrom.current-Math.log(sp)/Math.log(ZOOM_RANGE[1]/ZOOM_RANGE[0])))),()=>{pinchFrom.current=distance;setDrag(null);});
 const pct=(v:number)=>(v*100)+"%";
 return <Dialog open onOpenChange={o=>{if(!o)onClose();}}>
  <DialogPortal>
   <DialogPrimitive.Popup aria-label="کادر، تمام‌صفحه" aria-modal="true"
    className="dark fixed inset-0 z-50 m-0 h-dvh w-screen max-w-none overflow-hidden border-0 bg-background p-0 text-fg-primary outline-none">
    {/* The set: a press on a prop takes it (the 3D view handles it first); anywhere else moves the frame under the finger. */}
    <div ref={box} className={"absolute inset-0 touch-none "+(drag?"cursor-grabbing":"cursor-grab")} {...pinch}
     onPointerDown={e=>{if(propHit.current){propHit.current=false;return;}if(e.button>0)return;capture(e.currentTarget,e.pointerId);onSelect(null);setDrag({px:e.clientX,py:e.clientY,x:fr.x,y:fr.y,cur:fr});}}
     onPointerMove={e=>{if(!drag||!rect||!box.current)return;const b=box.current.getBoundingClientRect(),fw=rect.w*b.width,fh=rect.h*b.height;
      // The frame follows the finger: its centre is offset by −crop/2 of its size, so the crop moves by −2× the drag over the frame's size.
      const c={x:snapAxis(drag.x-2*(e.clientX-drag.px)/fw),y:snapAxis(drag.y-2*(e.clientY-drag.py)/fh)};if(Number.isFinite(c.x)&&Number.isFinite(c.y))setDrag({...drag,cur:c});}}
     onPointerUp={()=>{if(drag){onFraming(drag.cur.x===0&&drag.cur.y===0?undefined:drag.cur);setDrag(null);}}} onPointerCancel={()=>setDrag(null)}
     onWheel={e=>onZoom(Math.max(0,Math.min(1,distance+e.deltaY*0.0015)))}>
     <FrameScene staging={{...staging,framing:fr}} anchor={anchor} aspect={aspect} editable wide sel={sel} onSelect={onSelect} onProp={onProp}
      onPropTap={i=>setInspect(i)} onPropDown={()=>{propHit.current=true;}} onFrameRect={setRect} within={within}/>
    </div>
    {/* The frame: a green outline with its thirds; everything outside it is darkened (a wide shadow around it). */}
    {/* Everything outside the frame is darkened: a veil over the whole view with the frame cut out of it. */}
    {rect&&<svg aria-hidden="true" className="pointer-events-none absolute inset-0 size-full" viewBox="0 0 1 1" preserveAspectRatio="none">
     <path fillRule="evenodd" fill="black" fillOpacity={0.65} d={"M0 0H1V1H0Z M"+(rect.x-rect.w/2)+" "+(rect.y-rect.h/2)+"h"+rect.w+"v"+rect.h+"h"+(-rect.w)+"Z"}/></svg>}
    {rect&&<div aria-hidden="true" className="pointer-events-none absolute border-2 border-success"
     style={{left:pct(rect.x-rect.w/2),top:pct(rect.y-rect.h/2),width:pct(rect.w),height:pct(rect.h)}}>
     {[1,2].map(i=><span key={i}><span className="absolute inset-y-0 border-s border-dashed border-success/40" style={{insetInlineStart:pct(i/3)}}/>
      <span className="absolute inset-x-0 border-t border-dashed border-success/40" style={{top:pct(i/3)}}/></span>)}
     <span className="absolute -top-7 start-0 rounded-control bg-success px-2 py-0.5 text-xs font-medium text-success-foreground"><bdi>{aspect}</bdi> · کادر</span>
    </div>}
    <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3">
     <p className="max-w-md rounded-control bg-background/70 px-3 py-2 type-caption text-fg-secondary backdrop-blur-sm">
      {props.length?"پراپ‌ها رو بکش؛ روی هر کدوم بزن تا تنظیماتش بیاد. ":""}جای خالی رو بکشی کادر جابه‌جا می‌شه؛ با دو انگشت یا اسکرول زوم کن.</p>
     <DialogPrimitive.Close aria-label="بستن تمام‌صفحه"
      className="pointer-events-auto flex size-10 shrink-0 items-center justify-center rounded-control bg-background/70 text-fg-primary shadow-1 backdrop-blur-sm motion-hover hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
      <Icon icon={X} size={20} aria-hidden="true"/></DialogPrimitive.Close>
    </div>
    {/* The tapped prop's settings, in a modal over the set. */}
    <Dialog open={inspect!==null&&Boolean(props[inspect])} onOpenChange={o=>{if(!o)setInspect(null);}}>
     <DialogContent className="dark">
      <DialogHeader className="ps-12"><DialogTitle>تنظیم <bdi>{inspect!==null?propTags(props)[inspect]:""}</bdi></DialogTitle></DialogHeader>
      <DialogBody>{inspect!==null&&inspector(inspect)}</DialogBody>
     </DialogContent>
    </Dialog>
   </DialogPrimitive.Popup>
  </DialogPortal>
 </Dialog>;
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
 const targetTint=target?propTints(staging.props??[])[(staging.props??[]).indexOf(target)]:undefined;
 return <svg ref={svg} viewBox={"0 0 "+VW+" "+VH} className="mx-auto block aspect-[240/230] w-full max-w-sm touch-pan-y select-none text-fg-primary"
  onPointerMove={e=>{if(drag){const [x,y]=pt(e),deg=Math.atan2(y-C[1],x-C[0])*180/Math.PI;if(Number.isFinite(deg))setDrag({...drag,deg});}}}
  onPointerUp={()=>{if(drag){if(Number.isFinite(drag.deg))onLight(drag.i,Math.round(((drag.deg%360)+360)%360));setDrag(null);}}} onPointerCancel={()=>setDrag(null)}>
  <circle cx={C[0]} cy={C[1]} r={R} fill="none" stroke="currentColor" strokeOpacity=".35" strokeWidth={1} strokeDasharray="2 4" vectorEffect="non-scaling-stroke"/>
  <line x1={C[0]} y1={C[1]+24} x2={C[0]} y2={VH-34} stroke="currentColor" strokeOpacity=".35" strokeWidth={1} strokeDasharray="3 4" vectorEffect="non-scaling-stroke"/>
  {staging.lights.map((l,i)=>{
   const isDrag=drag?.i===i,top=l.direction==="top";
   const [x,y]=isDrag?polar(C[0],C[1],R,drag!.deg):top?[C[0]+(i%2?20:-20),C[1]-32]:polar(C[0],C[1],R,lightAngleOf(l)??LIGHT_ANGLE.front);
   // Strength: a brighter, larger glow and a longer, stronger beam (a very weak light is faint, never gone).
   const power=intensityOf(l),color=lightHex(l),soft=l.quality==="soft",g=uid+"-l"+i,toward=Math.atan2(C[1]-y,C[0]-x),spread=soft?0.5:0.22,len=(Math.hypot(C[0]-x,C[1]-y)-14)*(0.45+0.55*power);
   const [ax,ay]=[x+len*Math.cos(toward-spread),y+len*Math.sin(toward-spread)],[bx,by]=[x+len*Math.cos(toward+spread),y+len*Math.sin(toward+spread)];
   const on=selected===i,deg=Math.atan2(y-C[1],x-C[0])*180/Math.PI;
   const [ox,oy]=top?[x,y-20]:polar(C[0],C[1],R+19,deg),[lx,ly]=top?[x,y+21]:polar(C[0],C[1],R-22,deg);
   const key=(e:KeyboardEvent)=>{const step=e.key==="ArrowRight"||e.key==="ArrowDown"?10:e.key==="ArrowLeft"||e.key==="ArrowUp"?-10:0;if(!step||top)return;e.preventDefault();onSelect(i);onLight(i,(((lightAngleOf(l)??90)+step)%360+360)%360);};
   return <g key={i} role={editable?"button":undefined} tabIndex={editable?0:undefined} aria-label={lightTags(staging.lights)[i]+"، "+LIGHT_DIRECTION_FA[l.direction]+(l.angle!==undefined?" ("+Math.round(l.angle)+" درجه)":"")} aria-pressed={editable?on:undefined}
    onKeyDown={editable?key:undefined} onClick={editable?()=>onSelect(i):undefined}
    onPointerDown={editable&&!top?e=>{onSelect(i);capture(svg.current,e.pointerId);const [px,py]=pt(e);setDrag({i,deg:Math.atan2(py-C[1],px-C[0])*180/Math.PI});}:undefined}
    className={editable?"cursor-grab touch-none outline-none":""}>
    <defs><radialGradient id={g}><stop offset="0%" stopColor={color} stopOpacity={1}/><stop offset={soft?"35%":"70%"} stopColor={color} stopOpacity={.85}/><stop offset="100%" stopColor={color} stopOpacity={0}/></radialGradient>
     <linearGradient id={g+"b"} x1={x} y1={y} x2={C[0]} y2={C[1]} gradientUnits="userSpaceOnUse"><stop offset="0" stopColor={color} stopOpacity={(soft?.45:.6)*(0.25+0.75*power)}/><stop offset="1" stopColor={color} stopOpacity="0"/></linearGradient></defs>
    {!top&&<path d={"M"+x+" "+y+" L"+ax.toFixed(1)+" "+ay.toFixed(1)+" L"+bx.toFixed(1)+" "+by.toFixed(1)+" Z"} fill={"url(#"+g+"b)"}/>}
    <circle cx={x} cy={y} r={22} fill="transparent"/>
    <circle cx={x} cy={y} r={(soft?15:10)*(0.6+0.5*power)} fill={"url(#"+g+")"} opacity={0.35+0.65*power}/>
    <circle cx={x} cy={y} r={soft?6.5:5} fill={color} className={on?"stroke-primary":"stroke-background"} strokeWidth={on?1.2:0.6}/>
    {/* The source's icon sits outside the circle, its number (#نور-N) inside, so neither covers the other. */}
    <Asset id={LIGHT_ASSETS[l.source]} x={ox} y={oy+8} h={16} opacity={.95}/>
    <text x={lx} y={ly+3} textAnchor="middle" fill="currentColor" fillOpacity=".8" fontSize={9}>{fa(i+1)}</text>
   </g>;
  })}
  {target&&targetTint&&<Tint id={uid+"-m"} color={targetTint}/>}
  {target?<PropTop tint={targetTint?uid+"-m":undefined} p={target} x={C[0]} y={C[1]+20} h={isCharacter(target)?40:28}/>:<CubeTop x={C[0]} y={C[1]+14} h={28}/>}
  <Asset id="camera-top" x={C[0]} y={VH-4} h={28}/>
 </svg>;
}

/** The camera's roll (Dutch angle) in degrees: set, or the planner's «dutch» at 14°. */

/** Lens and aperture sliders run on log scales (a lens from 12 to 200mm, f/1.4 to f/16), smooth, the way photographers feel the steps. */
const LENS_RANGE=[12,200] as const,F_RANGE=[1.4,16] as const;
const lensSlider=(mm:number)=>Math.max(0,Math.min(1,Math.log(mm/LENS_RANGE[0])/Math.log(LENS_RANGE[1]/LENS_RANGE[0])));
const lensFromSlider=(v:number)=>Math.round(LENS_RANGE[0]*Math.pow(LENS_RANGE[1]/LENS_RANGE[0],v));
const apertureSlider=(f:number)=>Math.max(0,Math.min(1,Math.log(f/F_RANGE[0])/Math.log(F_RANGE[1]/F_RANGE[0])));
const apertureFromSlider=(v:number)=>Math.round(F_RANGE[0]*Math.pow(F_RANGE[1]/F_RANGE[0],v)*10)/10;
/** One labelled smooth slider (the second way to adjust, synced with the canvas). The value text is spoken and shown; the bar has a 32px tall touch area. */
function SliderRow({label,valueText,min,max,step,value,onChange,disabled,ends}:{label:string;valueText:string;min:number;max:number;step:number;value:number;onChange:(v:number)=>void;disabled?:boolean;
 /** What the left and right ends mean («چپ», «راست»), shown under the bar. */ends?:[string,string]}){
 return <label className={"flex flex-col gap-1 type-caption text-fg-secondary "+(disabled?"opacity-disabled":"")}>
  <span className="flex items-center justify-between gap-2"><span>{label}</span><bdi className="text-fg-primary">{valueText}</bdi></span>
  {/* Sliders work left to right even in the RTL page (the pattern people know): the minimum is on the left. */}
  <input type="range" dir="ltr" min={min} max={max} step={step} value={Number.isFinite(value)?value:min} disabled={disabled} onChange={e=>{const v=Number(e.target.value);if(Number.isFinite(v))onChange(v);}}
   aria-valuetext={valueText} className="h-8 w-full cursor-pointer accent-primary disabled:cursor-not-allowed"/>
  {ends&&<span dir="ltr" className="-mt-1 flex justify-between" aria-hidden="true"><span>{ends[0]}</span><span>{ends[1]}</span></span>}
 </label>;
}
const pct=(v:number)=>fa(Math.round(v*100));
/** The selected prop: its place on the ground (left–right, front–back) and its lift, as sliders synced with dragging it in the frame. */
function PropInspector({prop:p,tag,reach:r,onChange}:{prop:SceneProp;tag:string;
 /** How far it may go at this zoom and crop (lib/staging.ts, propReach): the same as dragging it, partly out of the frame on either side. */reach:{xMin:number;xMax:number;zMin:number;zMax:number};
 onChange:(x:Partial<SceneProp>)=>void}){
 return <div className="flex flex-col gap-3">
  <div className="flex flex-wrap items-center gap-2">{PROP_ASSETS[p.kind]&&!isCube(p)?<SourceIcon id={sprite(p).id}/>:<Icon icon={Box} size={16} aria-hidden="true" className="size-5 text-fg-secondary"/>}<bdi className="type-label text-primary">{tag}</bdi><span className="type-caption text-fg-secondary">{propPlaceFa(p)}</span>
</div>
  <SliderRow label="جای افقی (تا بیرون از کادر)" ends={["چپ","راست"]} valueText={pct(p.x)} min={Math.min(r.xMin,p.x)} max={Math.max(r.xMax,p.x)} step={0.01} value={p.x} onChange={x=>onChange({x})}/>
  <SliderRow label="عمق (تا بریده از پایین)" ends={["جلو","عقب"]} valueText={pct(p.z)} min={Math.min(r.zMin,p.z)} max={r.zMax} step={0.01} value={p.z} onChange={z=>onChange({z})}/>
  <SliderRow label="چرخش رو به دوربین" valueText={facingFa(facingOf(p))+" · "+fa(Math.round(facingOf(p)))+"°"} min={-180} max={180} step={SIDE_STEP} value={snapSide(facingOf(p))} onChange={f=>onChange({facing:snapSide(f)})}/>
  <SliderRow label="ارتفاع از زمین" ends={["زمین","بالا"]} valueText={p.y>0.01?pct(p.y):"روی زمین"} min={0} max={1} step={0.01} value={p.y} onChange={y=>onChange({y})}/>
 </div>;
}

/** The selected light's settings. */
function LightInspector({light:l,tag,canRemove,onChange,onRemove,onAdd}:{light:StagingLight;tag:string;canRemove:boolean;onChange:(p:Partial<StagingLight>)=>void;onRemove:()=>void;onAdd?:()=>void}){
 const ang=lightAngleOf(l)??90;
 return <div className="flex flex-col gap-3 rounded-card border border-line-secondary bg-surface-subtle p-3">
  <div className="flex items-center gap-2"><SourceIcon id={LIGHT_ASSETS[l.source]}/><bdi className="type-label text-primary">{tag}</bdi><span className="type-caption text-fg-secondary">{LIGHT_SOURCE_FA[l.source]}</span></div>
  <SliderRow label="جهت نور" valueText={l.direction==="top"?"از بالا":LIGHT_DIRECTION_FA[l.direction]+" · "+fa(Math.round(ang))+"°"} min={0} max={359} step={1} value={ang}
   disabled={l.direction==="top"} onChange={v=>onChange({angle:v,direction:snapDirection(v)})}/>
  <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="منبع نور">{LIGHT_SOURCES.map(s=><button key={s} type="button" role="radio" aria-checked={l.source===s} onClick={()=>onChange({source:s})} title={LIGHT_SOURCE_FA[s]}
   className={"flex h-9 items-center gap-1 rounded-control border px-2 type-caption motion-hover "+(l.source===s?"border-primary bg-surface-selected text-fg-primary":"border-line-secondary text-fg-secondary hover:bg-surface-hover")}>
   <SourceIcon id={LIGHT_ASSETS[s]}/>{LIGHT_SOURCE_FA[s]}</button>)}</div>
  <div className="flex flex-wrap items-center gap-3">
   <div className="flex gap-1" role="radiogroup" aria-label="کیفیت نور">{(["soft","hard"] as const).map(q=><Chip key={q} role="radio" on={l.quality===q} onClick={()=>onChange({quality:q})}>{LIGHT_QUALITY_FA[q]}</Chip>)}</div>
  </div>
  {/* The light's height, floor to ceiling, on its own line. A planner's light «from above» (direction top) shows as the ceiling. */}
  <div className="flex flex-wrap items-center gap-2"><span className="type-caption text-fg-secondary">زاویهٔ نور</span>
   <div dir="ltr" className="flex flex-wrap gap-1" role="radiogroup" aria-label="زاویهٔ نور">{LIGHT_HEIGHTS.map(h=>{const on=l.direction==="top"?h==="ceiling":l.height===h;
    return <Chip key={h} role="radio" on={on} onClick={()=>onChange({height:h,...(l.direction==="top"?{direction:snapDirection(90),angle:90}:{})})}>{LIGHT_HEIGHT_FA[h]}</Chip>;})}</div>
  </div>
  <SliderRow label="شدت نور" ends={["کم","زیاد"]} valueText={intensityFa(intensityOf(l))} min={0} max={1} step={0.01} value={intensityOf(l)} onChange={v=>onChange({intensity:v})}/>
  <label className="flex flex-col gap-1 type-caption text-fg-secondary">
   <span>دمای رنگ: <bdi>{fa(l.colorTemperatureK)}</bdi> کلوین</span>
   <input type="range" dir="ltr" min={1500} max={12000} step={100} value={l.colorTemperatureK} onChange={e=>onChange({colorTemperatureK:Number(e.target.value),colorHex:undefined})}
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
