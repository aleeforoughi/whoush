"use client";
import {useEffect,useId,useRef,useState,type KeyboardEvent,type PointerEvent,type ReactNode} from "react";
import {Box,ChevronDown,Lock,LockOpen,Plus,RotateCcw,Trash2,X} from "lucide-react";
import {Button,Icon} from "@aleeforoughi/feather-react";
import {FOCUS_DETAILS,LIGHT_HEIGHTS,LIGHT_ROLES,LIGHT_SOURCES,type Staging,type StagingLight} from "@/lib/creative-plan";
import {ANGLE_ORDER,CAMERA_ANGLE_FA,CAMERA_ELEVATION,GEL_COLORS,LIGHT_ANGLE,LIGHT_ASSETS,LIGHT_DIRECTION_FA,LIGHT_HEIGHT_FA,LIGHT_QUALITY_FA,LIGHT_ROLE_FA,LIGHT_SOURCE_FA,PROP_ASSETS,PROP_HEIGHT,
 SHOT_BODY_FRACTION,SHOT_SIZE_FA,SUBJECT_FA,TEMPERATURE_GRADIENT,lightHex,placementFa,polar,propPlaceFa,snapDirection,snapElevation,tidyProps,propInView,groundFromView,frameCamera,frameSize,propReach,propWidth,withFrameCuts,orbitCamera,orbitFa,facingOf,FOCUS_DETAIL_FA,ZOOM_RANGE,intensityOf,intensityFa,facingFa,propTags,lightTags,wrap180,elevationOf,scaleOf,lightAngleOf,nearestShot,scaleFromSlider,sliderFromScale,zoomFactor,type SceneProp} from "@/lib/staging";
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
export function StagingEditor({staging,aspectRatio,mediaKind,onChange}:{staging:Staging;aspectRatio?:string;/** For the wording («این عکس», «این ویدیو»). */mediaKind?:"image"|"video";
 /** Live: every adjustment is reported (with whether it differs from Whoush's scene), so the generation card below uses it directly; without it, read-only. */
 onChange?:(s:Staging,aspect:string,changed:boolean)=>void}){
 const initial=withProps(staging);
 const [draft,setDraft]=useState<Staging>(initial),[aspect,setAspect]=useState(aspectRatio??"16:9");
 // The frame shows its own settings (zoom, aspect, crop) until a prop is selected; then only that prop's settings, until it is deselected. Lights select apart.
 const [propSel,setPropSel]=useState<number|null>(null),[lightSel,setLightSel]=useState(0),[locked,setLocked]=useState(false);
 // The zoom's anchor: Whoush's original layout (so dragging never moves the zoom), with the main subject and its detail as now chosen (they can change).
 const mainIdx=(draft.props??[]).findIndex(p=>p.main);
 const anchor:Staging={...initial,focusDetail:draft.focusDetail,props:initial.props?.map((p,i)=>{const {main:_m,...q}=p;void _m;return i===mainIdx?{...q,main:true}:q;})};
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
 const setDominant=(i:number,detail?:Staging["focusDetail"])=>{setConfirmed(true);
  setDraft(d=>{const {focusDetail:_f,...rest}=d;void _f;return {...rest,...(detail?{focusDetail:detail}:{}),props:(d.props??[]).map((p,j)=>{const {main:_m,...q}=p;void _m;return j===i?{...q,main:true}:q;})};});};
 // The camera: height, orbit around the main subject (everything in the frame turns to match) and distance (the same value as the frame's zoom).
 const setElevation=(e:number)=>setDraft(d=>({...d,cameraElevation:e,cameraAngle:d.cameraAngle==="dutch"?"dutch":snapElevation(e)}));
 const orbitTo=(az:number)=>setDraft(d=>orbitCamera(d,wrap180(az-(d.cameraAzimuth??0))));
 const setDistance=(v:number)=>setDraft(d=>{const sc=scaleFromSlider(v);return {...d,shotScale:sc,shotSize:nearestShot(sc)};});
 const setProp=(i:number,p:Partial<SceneProp>)=>setDraft(d=>({...d,props:(d.props??[]).map((x,j)=>j===i?{...x,...p}:x)}));
 // Collapsed by default: «بوم» is advanced settings. The card shows the scene in one line; opening it shows the canvas and its controls.
 const [open,setOpen]=useState(false),bodyId=useId();
 // Collapsed: three live snapshots of the scene as it is now (frame, camera, lighting), read-only; opening it shows the canvas and its controls.
 const cap=viewCaptions(draft,aspect);

 return <div role="group" aria-label="بوم" className="@container flex min-w-0 flex-col gap-3">
  {props.length>0&&mainIdx>=0&&<Dominant tags={propTags(props)} props={props} main={mainIdx} detail={draft.focusDetail} mediaKind={mediaKind} confirmed={confirmed}
   editable={editable} onConfirm={()=>setConfirmed(true)} onChoose={setDominant}/>}
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
    <Snap c={cap.frame}><FrameView staging={draft} anchor={anchor} aspect={aspect}/></Snap>
    <Snap c={cap.camera}><CameraView staging={draft} editable={false} onCamera={()=>{}}/></Snap>
    <Snap c={cap.light}><LightView staging={draft} editable={false} selected={-1} onSelect={()=>{}} onLight={()=>{}}/></Snap>
   </span>}
  </button>
  <div id={bodyId} hidden={!open} className="flex min-w-0 flex-col gap-3">
  <div className="flex min-w-0 flex-col gap-3">
   <div><Viewport {...cap.frame}>
    <FrameView staging={draft} anchor={anchor} aspect={aspect} editable={editable} onFraming={f=>set({framing:f})} sel={propSel} onSelect={setPropSel} onProp={(i,x,z)=>setProp(i,{x,z})} onZoom={setDistance} locked={locked} onLock={setLocked}/>
    {editable&&propSel!==null&&props[propSel]&&<PropInspector prop={withFrameCuts(draft,anchor,aspect).props![propSel]} tag={propTags(props,true)[propSel]} reach={propReach(props[propSel],draft,anchor,aspect)}
     onChange={p=>setProp(propSel,p)} onClose={()=>{setPropSel(null);setLocked(false);}}/>}
    {editable&&(propSel===null||!props[propSel])&&<>
     <input type="range" min={0} max={1} step={0.001} value={1-distanceOf(draft)} onChange={e=>setDistance(1-Number(e.target.value))}
      aria-label="زوم (اندازهٔ نما، همون فاصلهٔ دوربین)" aria-valuetext={SHOT_SIZE_FA[draft.shotSize]+"، زوم "+zoomFactor(draft)+"×"} className="h-8 w-full cursor-pointer accent-primary"/>
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
    {/* The two camera views side by side, each its own tile: from the side (height and distance) and from above (the orbit), synced through one scene. */}
    <div className="grid grid-cols-2 gap-2">
     <Tile label="نمای کنار · ارتفاع">
      <CameraView staging={draft} editable={editable} onCamera={c=>setDraft(d=>{const n=c.flip?orbitCamera(d,180):d,sc=scaleFromSlider(c.distance);
       return {...n,cameraElevation:c.elevation,cameraAngle:n.cameraAngle==="dutch"?"dutch":snapElevation(c.elevation),shotScale:sc,shotSize:nearestShot(sc)};})}/>
     </Tile>
     <Tile label="نمای بالا · چرخش ۳۶۰°">
      <OrbitView staging={draft} editable={editable} onOrbit={c=>{orbitTo(c.azimuth);setDistance(c.distance);}}/>
     </Tile>
    </div>
    {editable&&<SliderRow label="ارتفاع دوربین" valueText={CAMERA_ANGLE_FA[draft.cameraAngle]+" · "+fa(Math.round(elevationOf(draft)))+"°"} min={-60} max={85} step={1} value={elevationOf(draft)}
     onChange={setElevation}/>}
    {editable&&<SliderRow label="چرخش دور سوژه (۳۶۰°)" valueText={orbitFa(draft.cameraAzimuth??0)} min={-180} max={180} step={1} value={draft.cameraAzimuth??0} onChange={orbitTo}/>}
    {editable&&<SliderRow label="فاصلهٔ دوربین (همون زوم کادر)" valueText={"زوم "+fa(zoomFactor(draft))+"×"} min={0} max={1} step={0.001} value={distanceOf(draft)} onChange={setDistance}/>}
    {editable&&<div className="flex justify-center"><Chip on={draft.cameraAngle==="dutch"} onClick={()=>set({cameraAngle:draft.cameraAngle==="dutch"?snapElevation(elevationOf(draft)):"dutch"})}>زاویهٔ کج</Chip></div>}
   </Viewport></div>
   <div>
    <Viewport {...cap.light}>
     <LightView staging={draft} editable={editable} selected={lightSel} onSelect={setLightSel} onLight={(i,deg)=>setLight(i,{angle:deg,direction:snapDirection(deg)})}/>
    </Viewport>
    {editable&&draft.lights[lightSel]&&<div className="mt-2"><LightInspector light={draft.lights[lightSel]} tag={lightTags(draft.lights)[lightSel]} canRemove={draft.lights.length>1}
     onChange={p=>setLight(lightSel,p)}
     onRemove={()=>{const i=lightSel;setDraft(d=>({...d,lights:d.lights.filter((_,j)=>j!==i)}));setLightSel(0);}}
     onAdd={draft.lights.length<4?()=>{setDraft(d=>({...d,lights:[...d.lights,{role:"fill",direction:"front_right",height:"eye",quality:"soft",source:"softbox",colorTemperatureK:5600}]}));setLightSel(draft.lights.length);}:undefined}/></div>}
   </div>
  </div>
  {!editable&&<ul className="flex flex-col gap-1">{draft.lights.map((l,i)=><LightRow key={i} l={l}/>)}</ul>}
  {editable&&changed&&<div className="flex flex-wrap items-center gap-2">
   <Button type="button" variant="ghost" size="sm" onClick={()=>{setDraft(initial);setAspect(aspectRatio??"16:9");setPropSel(null);setLightSel(0);setLocked(false);}}><Icon icon={RotateCcw} aria-hidden="true"/>برگرد به پیشنهاد هووش</Button>
   <p className="type-caption text-fg-secondary">با «بساز» همین صحنه ساخته می‌شه.</p>
  </div>}
  </div>
 </div>;
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
function Asset({id,x,y,h,mirror,sx=1,rotate=0,opacity=1}:{id:string;x:number;y:number;h:number;mirror?:boolean;
 /** Horizontal scale about its centre (a side view turned toward or away from the camera is narrower). */sx?:number;rotate?:number;opacity?:number}){
 const a=VISUALS[id];if(!a)return null;
 const w=h*a.width/a.height,cx=x,cy=y-h/2,f=(mirror?-1:1)*sx;
 return <image href={a.src} x={x-w/2} y={y-h} width={w} height={h} opacity={opacity} preserveAspectRatio="xMidYMid meet"
  transform={"rotate("+rotate+" "+cx+" "+cy+")"+(f!==1?" translate("+cx+" 0) scale("+f+" 1) translate("+(-cx)+" 0)":"")}/>;
}
/**
 * How a prop looks from the camera, by which way it faces (lib/staging.ts, facingOf): a person from the front (or back) or in profile; a vehicle or animal
 * side on, narrower as it turns toward or away from the camera; mirrored when it faces frame left. Trees, buildings and objects look the same all round.
 */
/** A sprite's width on screen at height h. */
const spriteW=(sp:{id:string;sx:number},h:number)=>{const v=VISUALS[sp.id];return v?h*sp.sx*v.width/v.height:h;};
function sprite(p:SceneProp):{id:string;mirror:boolean;sx:number}{
 const f=wrap180(facingOf(p)),a=Math.abs(f),mirror=f<0;
 if(p.kind==="person")return a<45||a>135?{id:"person-front",mirror:false,sx:1}:{id:"person-side",mirror,sx:1};
 if(p.kind==="vehicle"||p.kind==="animal")return {id:SIDE[p.kind],mirror,sx:Math.max(0.42,Math.abs(Math.sin(f*Math.PI/180)))};
 return {id:PROP_ASSETS[p.kind].front,mirror:false,sx:1};
}

/** The main prop (or the first), whose side view the camera view shows; an environment-only scene shows the landscape. */
const mainProp=(s:Staging)=>(s.props??[]).find(p=>p.main)??(s.props??[])[0];
const SIDE:Record<SceneProp["kind"],string>={person:"person-side",object:"object-side",animal:"animal-side",vehicle:"vehicle-side",tree:"env-tree",building:"env-building"};

/** The camera's distance on the diagrams: the zoom slider's position (0 closest), so moving the camera closer or further is the same as zooming the frame. */
const distanceOf=(s:Staging)=>sliderFromScale(scaleOf(s));
const radiusOf=(v:number,min:number,span:number)=>min+span*Math.max(0,Math.min(1,v));
/**
 * Side view, 360°: the main subject on the ground and the camera on a full circle around its focus point, in the camera's own vertical plane. Drag the camera
 * around for its height; carry it over the top and it goes behind the subject (the orbit turns 180°, the same as in the top view); drag in or out for its
 * distance (the frame's zoom follows). The subject is drawn the way it faces the camera (its face toward the camera, its back, or side on), like the frame
 * and the top view. Sized so the whole circle stays inside at any distance.
 */
function CameraView({staging,editable,onCamera}:{staging:Staging;editable:boolean;onCamera:(c:{elevation:number;distance:number;flip?:boolean})=>void}){
 const svg=useRef<SVGSVGElement>(null),[dragging,setDragging]=useState(false);
 // Which side of the subject the camera is drawn on (1: right). It changes when a drag carries the camera over the top, so nothing jumps.
 const [side,setSide]=useState<1|-1>(1);
 const VW=220,VH=190,RMIN=30,RSPAN=52,focus:[number,number]=[110,90];
 const m=mainProp(staging),kind=m?.kind;
 const size=kind?Math.min(92,PROP_HEIGHT[kind]*92):58,ground=Math.min(VH-8,focus[1]+(kind==="person"?size*0.9:size*0.55));
 const elev=elevationOf(staging),dist=distanceOf(staging),R=radiusOf(dist,RMIN,RSPAN);
 const phi=side===1?elev:180-elev,[cx,cy]=polar(focus[0],focus[1],R,-phi);
 const aim=Math.atan2(focus[1]-cy,focus[0]-cx)*180/Math.PI,roll=staging.cameraAngle==="dutch"?14:0,camLeft=cx<focus[0];
 // The subject as this diagram's viewer sees it: facing the camera's side when it faces the camera (sprite: 90 faces right, 0 faces the viewer).
 const sp=m?sprite({...m,facing:wrap180(side*90-facingOf(m))}):undefined;
 const at=(e:PointerEvent)=>{const r=svg.current!.getBoundingClientRect();const x=(e.clientX-r.left)*VW/r.width-focus[0],y=(e.clientY-r.top)*VH/r.height-focus[1];
  const psi=Math.atan2(-y,x)*180/Math.PI,s2:1|-1=x>=0?1:-1;
  return {side:s2,elevation:Math.round(Math.max(-60,Math.min(85,wrap180(s2===1?psi:180-psi)))),distance:Math.max(0,Math.min(1,(Math.hypot(x,y)-RMIN)/RSPAN))};};
 const key=(e:KeyboardEvent)=>{
  const d={ArrowUp:[5,0],ArrowDown:[-5,0],ArrowRight:[0,0.05],ArrowLeft:[0,-0.05]}[e.key as "ArrowUp"];if(!d)return;e.preventDefault();
  onCamera({elevation:Math.max(-60,Math.min(85,Math.round(elev+d[0]))),distance:Math.max(0,Math.min(1,dist+d[1]))});};
 // Live while dragging, so the frame and the top view follow the camera as it moves.
 const move=(e:PointerEvent)=>{if(!dragging)return;const c=at(e);if(!Number.isFinite(c.elevation)||!Number.isFinite(c.distance))return;
  const flip=c.side!==side;if(flip)setSide(c.side);onCamera({elevation:c.elevation,distance:c.distance,...(flip?{flip}:{})});};
 return <svg ref={svg} viewBox={"0 0 "+VW+" "+VH} className="mx-auto block aspect-[22/19] w-full max-w-sm touch-pan-y select-none text-fg-primary" aria-hidden={!editable}
  onPointerMove={move} onPointerUp={()=>setDragging(false)} onPointerCancel={()=>setDragging(false)}>
  <circle cx={focus[0]} cy={focus[1]} r={R} fill="none" stroke="currentColor" strokeOpacity=".4" strokeWidth={1} strokeDasharray="3 4" vectorEffect="non-scaling-stroke"/>
  <line x1={6} x2={VW-6} y1={ground} y2={ground} stroke="currentColor" strokeOpacity=".3" strokeWidth={1} vectorEffect="non-scaling-stroke"/>
  {kind&&sp?<Asset id={sp.id} x={focus[0]} y={ground} h={size} mirror={sp.mirror} sx={sp.sx}/>:<><Asset id="env-mountains" x={focus[0]} y={ground} h={52}/><Asset id="env-tree" x={focus[0]+44} y={ground} h={30}/></>}
  {/* Which way the subject faces, as an arrow at chest height (the same facing as the top view's arrow): toward the camera, away from it, or toward the
      viewer (a dot) when the camera sees it side on. The faceless figure alone does not say it clearly. */}
  {kind&&m&&(()=>{const g=wrap180(side*90-facingOf(m)),dx=Math.sin(g*Math.PI/180),y=ground-size*(kind==="person"?0.62:0.5),x0=focus[0]+dx*size*0.14,x1=focus[0]+dx*size*0.42;
   return <g className="pointer-events-none" aria-hidden="true">{Math.abs(dx)<0.35?<circle cx={focus[0]} cy={y} r={2.6} className="fill-primary"/>
    :<><line x1={x0} y1={y} x2={x1} y2={y} className="stroke-primary" strokeWidth={1.4} vectorEffect="non-scaling-stroke"/>
     <path d={"M"+(x1+Math.sign(dx)*3)+" "+y+" L"+(x1-Math.sign(dx)*3)+" "+(y-3.5)+" L"+(x1-Math.sign(dx)*3)+" "+(y+3.5)+"Z"} className="fill-primary"/></>}</g>;})()}
  <line x1={cx} y1={cy} x2={focus[0]} y2={focus[1]} className="stroke-primary" strokeWidth={1.2} strokeDasharray="4 3" vectorEffect="non-scaling-stroke"/>
  <g role={editable?"slider":undefined} tabIndex={editable?0:undefined} aria-label="ارتفاع و فاصلهٔ دوربین (۳۶۰ درجه)" aria-valuetext={CAMERA_ANGLE_FA[staging.cameraAngle]+"، "+Math.round(elev)+" درجه، "+orbitFa(staging.cameraAzimuth??0)+"، زوم "+zoomFactor(staging)+"×"}
   aria-valuemin={-60} aria-valuemax={85} aria-valuenow={Math.round(elev)}
   onKeyDown={editable?key:undefined} onPointerDown={editable?e=>{capture(svg.current,e.pointerId);setDragging(true);}:undefined}
   className={editable?(dragging?"cursor-grabbing":"cursor-grab")+" touch-none outline-none focus-visible:[&>circle]:stroke-primary":""}>
   <circle cx={cx} cy={cy} r={24} fill="transparent" strokeWidth={2}/>
   <Asset id="camera-side" x={cx} y={cy+11} h={22} mirror={camLeft} rotate={(camLeft?aim:aim-180)+roll}/>
  </g>
 </svg>;
}

/**
 * Top view (the camera's orbit, 360°): only the target, the main subject, in the middle turned the way it faces (no other props),
 * and the camera on a circle around it. Drag the camera around for its orbit (front, sides, behind) and in or out for its distance; the frame above turns
 * and zooms to match, live.
 */
function OrbitView({staging,editable,onOrbit}:{staging:Staging;editable:boolean;onOrbit:(c:{azimuth:number;distance:number})=>void}){
 const svg=useRef<SVGSVGElement>(null),[dragging,setDragging]=useState(false);
 const VW=220,VH=200,C:[number,number]=[110,100],RMIN=34,RSPAN=52,U=44;
 const az=staging.cameraAzimuth??0,dist=distanceOf(staging),R=radiusOf(dist,RMIN,RSPAN),rad=az*Math.PI/180,c=Math.cos(rad),n=Math.sin(rad);
 const props=staging.props??[],m=mainProp(staging),px=m?.x??0,pz=m?.z??0;
 // The scene is kept as the camera sees it; turning it back by the orbit draws it as laid out, with the camera moving around it.
 const place=(p:SceneProp):[number,number]=>{const vx=p.x-px,vz=p.z-pz;return [C[0]+(vx*c-vz*n)*U,C[1]-(vx*n+vz*c)*U];};
 const cam:[number,number]=[C[0]+R*n,C[1]+R*c];
 const at=(e:PointerEvent)=>{const r=svg.current!.getBoundingClientRect();const x=(e.clientX-r.left)*VW/r.width-C[0],y=(e.clientY-r.top)*VH/r.height-C[1];
  return {azimuth:Math.round(Math.atan2(x,y)*180/Math.PI),distance:Math.max(0,Math.min(1,(Math.hypot(x,y)-RMIN)/RSPAN))};};
 const key=(e:KeyboardEvent)=>{
  const d={ArrowRight:[5,0],ArrowLeft:[-5,0],ArrowUp:[0,0.05],ArrowDown:[0,-0.05]}[e.key as "ArrowUp"];if(!d)return;e.preventDefault();
  onOrbit({azimuth:wrap180(az+d[0]),distance:Math.max(0,Math.min(1,dist+d[1]))});};
 const move=(e:PointerEvent)=>{if(!dragging)return;const v=at(e);if(Number.isFinite(v.azimuth)&&Number.isFinite(v.distance))onOrbit(v);};
 return <svg ref={svg} viewBox={"0 0 "+VW+" "+VH} className="mx-auto block aspect-[22/20] w-full max-w-sm touch-pan-y select-none text-fg-primary" aria-hidden={!editable}
  onPointerMove={move} onPointerUp={()=>setDragging(false)} onPointerCancel={()=>setDragging(false)}>
  <circle cx={C[0]} cy={C[1]} r={R} fill="none" stroke="currentColor" strokeOpacity=".4" strokeWidth={1} strokeDasharray="3 4" vectorEffect="non-scaling-stroke"/>
  {/* Whoush's original camera position, for reference */}
  <circle cx={C[0]} cy={C[1]+R} r={2} fill="currentColor" fillOpacity=".35"/>
  {/* Only the target (the main subject): the camera views are about the camera around it, not the rest of the scene. */}
  {m&&<Asset id={PROP_ASSETS[m.kind].top} x={C[0]} y={C[1]+14} h={28} rotate={-(facingOf(m)+az)}/>}
  {!props.length&&<Asset id="env-top" x={C[0]} y={C[1]+22} h={44}/>}
  {/* The main subject's facing, the same as in the frame and the side view: an arrow from it the way it faces. */}
  {m&&(()=>{const fw=(facingOf(m)+az)*Math.PI/180,[x,y]=place(m),d:[number,number]=[Math.sin(fw),Math.cos(fw)],r0=17,r1=31,tip:[number,number]=[x+d[0]*r1,y+d[1]*r1];
   const side:[number,number]=[-d[1],d[0]];
   return <g className="pointer-events-none" aria-hidden="true">
    <line x1={x+d[0]*r0} y1={y+d[1]*r0} x2={tip[0]} y2={tip[1]} className="stroke-primary" strokeWidth={1.4} vectorEffect="non-scaling-stroke"/>
    <path d={"M"+tip[0]+" "+tip[1]+" L"+(tip[0]-d[0]*6+side[0]*4)+" "+(tip[1]-d[1]*6+side[1]*4)+" L"+(tip[0]-d[0]*6-side[0]*4)+" "+(tip[1]-d[1]*6-side[1]*4)+"Z"} className="fill-primary"/>
   </g>;})()}
  <line x1={cam[0]} y1={cam[1]} x2={C[0]} y2={C[1]} className="stroke-primary" strokeWidth={1.2} strokeDasharray="4 3" vectorEffect="non-scaling-stroke"/>
  <g role={editable?"slider":undefined} tabIndex={editable?0:undefined} aria-label="چرخش و فاصلهٔ دوربین دور سوژه" aria-valuetext={orbitFa(az)+"، زوم "+zoomFactor(staging)+"×"}
   aria-valuemin={-180} aria-valuemax={180} aria-valuenow={Math.round(az)}
   onKeyDown={editable?key:undefined} onPointerDown={editable?e=>{capture(svg.current,e.pointerId);setDragging(true);}:undefined}
   className={editable?(dragging?"cursor-grabbing":"cursor-grab")+" touch-none outline-none focus-visible:[&>circle]:stroke-primary":""}>
   <circle cx={cam[0]} cy={cam[1]} r={20} fill="transparent" strokeWidth={2}/>
   <Asset id="camera-top" x={cam[0]} y={cam[1]+11} h={22} rotate={-az}/>
  </g>
 </svg>;
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
/** A framing offset, clamped and rounded; smooth (no snapping), the thirds lines only light up when the subject is on one. */
const snapAxis=(v:number)=>Math.max(-1,Math.min(1,Math.round(v*100)/100));
/**
 * The camera's view at the aspect ratio with thirds, and where props are arranged: the fixed environment backdrop, then each prop in depth (further back
 * stands higher on the ground plane and is smaller; drawn back to front), scaled by the shot size around the main subject.
 * - Drag a prop: sideways moves it left and right, up moves it back, down brings it forward (its lift above the ground is in the inspector).
 * - Drag the empty background: slides the crop like a crop tool, snapping to the thirds and the centre.
 * - Keyboard: arrow keys move the selected prop (or the crop when the frame itself has focus).
 */
function FrameView({staging,anchor,aspect,editable,onFraming,sel,onSelect,onProp,onZoom,locked=false,onLock}:{staging:Staging;
 /** The scene whose main subject anchors the zoom (Whoush's original layout): fixed while props move, so moving the main subject moves only it. */anchor?:Staging;
 aspect:string;editable?:boolean;onFraming?:(f:{x:number;y:number}|undefined)=>void;
 /** The selected prop (null: none, the frame's own settings show). */sel?:number|null;onSelect?:(i:number|null)=>void;onProp?:(i:number,x:number,z:number)=>void;
 /** Pinch to zoom (phones): the new camera distance, 0 closest (the zoom slider's value). */onZoom?:(distance:number)=>void;
 /** The selection is locked (the lock beside its tag): clicks never select anything else, and a drag anywhere moves the locked prop (or the crop). */locked?:boolean;onLock?:(on:boolean)=>void}){
 const clip=useId(),svg=useRef<SVGSVGElement>(null),{W,H}=frameSize(aspect);
 const [drag,setDrag]=useState<{px:number;py:number;x:number;y:number;cur:{x:number;y:number}}|null>(null);
 const [move,setMove]=useState<{i:number;px:number;py:number;x0:number;z0:number;x:number;z:number}|null>(null);
 const fr=drag?.cur??staging.framing??{x:0,y:0};
 // Pinch: spreading two fingers zooms in (the camera comes closer), pinching zooms out; any one-finger drag stops.
 const pinchFrom=useRef(0);
 const pinch=usePinch(sp=>onZoom?.(Math.max(0,Math.min(1,pinchFrom.current-Math.log(sp)/Math.log(ZOOM_RANGE[1]/ZOOM_RANGE[0])))),()=>{pinchFrom.current=sliderFromScale(scaleOf(staging));setMove(null);setDrag(null);});
 const base=(staging.props??[]).map((p,i)=>move?.i===i?{...p,x:move.x,z:move.z}:p);
 const order=base.map((p,i)=>({p,i})).sort((a,b)=>b.p.z-a.p.z);
 // Each prop's place in words, with the frame's cuts as drawn (for screen readers; the same words Whoush and the provider get).
 const placed=withFrameCuts({...staging,props:base,framing:drag?.cur??staging.framing},anchor,aspect).props??[];
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
 const tag=!editable?undefined:sel!=null&&base[sel]?(()=>{const p=base[sel],a=at(p),wf=spriteW(sprite(p),a.h);
  const [rx,ty]=cam.toScreen(a.x+wf/2+1,a.y-a.h-1);return {x:Math.max(52,Math.min(W-1,rx)),y:Math.max(0,Math.min(H-2,ty)),above:ty>12,text:propTags(base,true)[sel]};})()
  :{x:W-3,y:3,above:false,text:"#کادر"};
 const svgEl=<svg ref={svg} viewBox={"-2 -2 "+(W+4)+" "+(H+4)} {...(editable&&onZoom?pinch:{})} className="mx-auto block w-full touch-none select-none text-fg-primary" style={{aspectRatio:String((W+4)/(H+4)),maxWidth:Math.round(320*(W+4)/(H+4))+"px"}} aria-hidden={!editable}
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
    onPointerDown={e=>{capture(svg.current,e.pointerId);if(locked&&sel!=null&&base[sel]){moveLocked(e);return;}if(!locked)onSelect?.(null);cropDrag(e);}}/>}
   <g transform={world} className="pointer-events-none">
    <rect x={-W*4} y={horizon} width={W*9} height={H*4} fill={"url(#"+clip+"g)"}/>
    <line x1={-W*4} x2={W*5} y1={horizon} y2={horizon} stroke="currentColor" strokeOpacity=".3" strokeWidth={1} vectorEffect="non-scaling-stroke"/>
    {/* The environment is the fixed backdrop behind every prop, in the same world: it zooms with the scene and never moves on its own. */}
    {/* Orbiting the camera turns the backdrop: it slides past, wrapping around once per full turn. */}
    {[-1,0,1].map(n=><Asset key={n} id="env-mountains" x={W*0.5-wrap180(staging.cameraAzimuth??0)/180*W*1.2+n*W*2.4} y={horizon+1} h={H*0.32} opacity={0.7}/>)}
   </g>
   <g transform={world}>
    {order.map(({p,i})=>{const a=at(p),sp=sprite(p),w=spriteW(sp,a.h),on=sel===i;
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
      {(()=>{const sp=sprite(p);return <Asset id={sp.id} x={a.x} y={a.y} h={a.h} mirror={sp.mirror} sx={sp.sx}/>;})()}
      {on&&<rect x={a.x-w/2-1} y={a.y-a.h-1} width={w+2} height={a.h+2} rx={2} fill="none" className="stroke-primary" strokeWidth={1} vectorEffect="non-scaling-stroke" strokeDasharray="3 2"/>}
     </g>;})}
   </g>
   {[1,2].map(i=><g key={i} strokeDasharray="3 3" strokeWidth={1} className="pointer-events-none">
    <line vectorEffect="non-scaling-stroke" x1={W*i/3} x2={W*i/3} y1={0} y2={H} className={third(onX,fr.x<0,i)?"stroke-primary":""} stroke={third(onX,fr.x<0,i)?undefined:"currentColor"} strokeOpacity={third(onX,fr.x<0,i)?1:.3}/>
    <line vectorEffect="non-scaling-stroke" x1={0} x2={W} y1={H*i/3} y2={H*i/3} className={third(onY,fr.y<0,i)?"stroke-primary":""} stroke={third(onY,fr.y<0,i)?undefined:"currentColor"} strokeOpacity={third(onY,fr.y<0,i)?1:.3}/>
   </g>)}
  </g>
  {/* With no prop selected, the frame itself is: a blue outline and its «#کادر» tag, and the controls below are the frame's. */}
  {editable&&(sel==null||!base[sel])
   ?<><rect width={W} height={H} rx={6} fill="none" className="pointer-events-none stroke-primary" strokeWidth={1.6} vectorEffect="non-scaling-stroke"/>
</>
   :<rect width={W} height={H} rx={6} fill="none" stroke="currentColor" strokeOpacity=".75" strokeWidth={1.2} vectorEffect="non-scaling-stroke" className="pointer-events-none"/>}
 </svg>;
 if(!tag)return svgEl;
 return <div className="relative mx-auto w-full" style={{maxWidth:maxW+"px"}}>
  {svgEl}
  {/* Tag text, then (on its right) the lock in a small button: outline when unlocked, filled blue with a white lock when locked. On touch screens the
      button is larger and its tap area reaches about 44px around it (an invisible ::before), so it is easy to hit with a finger. */}
  <div dir="rtl" className={"pointer-events-none absolute flex items-center gap-1.5 "+(tag.above?"-translate-y-full pb-0.5":"pt-0.5")}
   style={{right:((W+2-tag.x)/(W+4)*100)+"%",top:((tag.y+2)/(H+4)*100)+"%"}}>
   {onLock&&<button type="button" aria-pressed={locked} aria-label={(locked?"باز کردن قفل انتخاب ":"قفل کردن انتخاب ")+tag.text} onClick={()=>onLock(!locked)}
    className={"pointer-events-auto relative flex size-6 items-center justify-center rounded-[4px] before:absolute before:-inset-2.5 before:content-[''] pointer-coarse:size-7 border border-primary motion-hover focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring "+(locked?"bg-primary text-primary-foreground":"bg-transparent text-primary")}>
    <Icon icon={locked?Lock:LockOpen} size={16} aria-hidden="true" className={"size-3.5! "+(locked?"[&_rect]:fill-current":"")}/></button>}
   <bdi className="whitespace-nowrap text-xs font-medium leading-none text-primary pointer-coarse:text-[13px]">{tag.text}</bdi>
  </div>
 </div>;
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
function PropInspector({prop:p,tag,reach:r,onChange,onClose}:{prop:SceneProp;tag:string;
 /** How far it may go at this zoom and crop (lib/staging.ts, propReach): the same as dragging it, partly out of the frame on either side. */reach:{xMin:number;xMax:number;zMin:number;zMax:number};
 onChange:(x:Partial<SceneProp>)=>void;onClose:()=>void}){
 return <div className="flex flex-col gap-3">
  <div className="flex flex-wrap items-center gap-2"><SourceIcon id={PROP_ASSETS[p.kind].front}/><bdi className="type-label text-primary">{tag}</bdi><span className="type-caption text-fg-secondary">{propPlaceFa(p)}</span>
   <Button type="button" variant="ghost" size="sm" className="ms-auto" onClick={onClose} aria-label="برگشت به تنظیمات کادر"><Icon icon={X} aria-hidden="true" className="size-4"/>کادر</Button></div>
  <SliderRow label="چپ ↔ راست (تا بیرون از کادر)" valueText={pct(p.x)} min={Math.min(r.xMin,p.x)} max={Math.max(r.xMax,p.x)} step={0.01} value={p.x} onChange={x=>onChange({x})}/>
  <SliderRow label="جلو ↔ عقب (تا بریده از پایین)" valueText={pct(p.z)} min={Math.min(r.zMin,p.z)} max={r.zMax} step={0.01} value={p.z} onChange={z=>onChange({z})}/>
  <SliderRow label="چرخش رو به دوربین" valueText={facingFa(facingOf(p))+" · "+fa(Math.round(facingOf(p)))+"°"} min={-180} max={180} step={1} value={facingOf(p)} onChange={f=>onChange({facing:f})}/>
  <SliderRow label="ارتفاع از زمین" valueText={p.y>0.01?pct(p.y):"روی زمین"} min={0} max={1} step={0.01} value={p.y} onChange={y=>onChange({y})}/>
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
   <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="زاویهٔ نور">{LIGHT_HEIGHTS.map(h=>{const on=l.direction==="top"?h==="ceiling":l.height===h;
    return <Chip key={h} role="radio" on={on} onClick={()=>onChange({height:h,...(l.direction==="top"?{direction:snapDirection(90),angle:90}:{})})}>{LIGHT_HEIGHT_FA[h]}</Chip>;})}</div>
  </div>
  <SliderRow label="شدت نور" valueText={intensityFa(intensityOf(l))} min={0} max={1} step={0.01} value={intensityOf(l)} onChange={v=>onChange({intensity:v})}/>
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
