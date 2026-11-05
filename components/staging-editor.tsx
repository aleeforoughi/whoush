"use client";
import {useId,useRef,useState,type KeyboardEvent,type PointerEvent,type ReactNode} from "react";
import {Plus,RotateCcw,Trash2,Wand2} from "lucide-react";
import {Button,Icon} from "@aleeforoughi/feather-react";
import {LIGHT_ROLES,LIGHT_SOURCES,SHOT_SIZES,SUBJECTS,type Staging,type StagingLight} from "@/lib/creative-plan";
import {ANGLE_ORDER,CAMERA_ANGLE_FA,CAMERA_ELEVATION,GEL_COLORS,LIGHT_ANGLE,LIGHT_ASSETS,LIGHT_DIRECTION_FA,LIGHT_HEIGHT_FA,LIGHT_QUALITY_FA,LIGHT_ROLE_FA,LIGHT_SOURCE_FA,SHOT_BODY_FRACTION,SHOT_SIZE_FA,SUBJECT_ASSETS,SUBJECT_FA,
 TEMPERATURE_GRADIENT,lightHex,placementFa,polar,snapDirection,snapElevation,stepAngle,stepDirection} from "@/lib/staging";
import {VISUALS} from "@/lib/visual-assets";
import {fa} from "@/lib/format";

/**
 * The plan's scene as a small, adjustable lo-fi 3D viewport built from the pre-rendered asset pack (public/visuals, docs/VISUAL_ASSETS.md): nothing is generated
 * here. Three views share one draft staging:
 * - camera (side view): drag the camera along its arc around the subject; it snaps to the five camera angles; the dutch tilt is a toggle;
 * - frame: the shot size (slider) and aspect ratio (chips) crop the subject;
 * - light (top view): drag each light around the subject, snapping to eight directions; select one to set role, source, softness, height, colour temperature
 *   and gel, add up to four, remove.
 * The subject (person, object, animal, vehicle, environment only) chooses which assets appear. Everything works from the keyboard (arrow keys on the camera and
 * lights, native controls in the inspector). With `onApply`, a changed scene can be sent back to Whoush as a revision of the generation; without it, read-only.
 * The viewports are always dark, like a 3D app.
 */
export function StagingEditor({staging,aspectRatio,onApply,disabled}:{staging:Staging;aspectRatio?:string;onApply?:(s:Staging,aspect:string)=>void;disabled?:boolean}){
 const initial:Staging={...staging,subject:staging.subject??"person"};
 const [draft,setDraft]=useState<Staging>(initial),[aspect,setAspect]=useState(aspectRatio??"16:9"),[sel,setSel]=useState(0);
 // Narrow (a phone, or the chat beside the preview): one view at a time behind tabs. Wide (@2xl container): all three together.
 const [view,setView]=useState<"camera"|"frame"|"light">("camera");
 const shown=(k:typeof view)=>(view===k?"block":"hidden")+" @2xl:block";
 const editable=Boolean(onApply);
 const changed=JSON.stringify(draft)!==JSON.stringify(initial)||aspect!==(aspectRatio??"16:9");
 const set=(p:Partial<Staging>)=>setDraft(d=>({...d,...p}));
 const setLight=(i:number,p:Partial<StagingLight>)=>setDraft(d=>({...d,lights:d.lights.map((l,j)=>j===i?{...l,...p}:l)}));
 const subject=draft.subject??"person";
 return <div className="@container flex flex-col gap-3">
  <div role="tablist" aria-label="نماهای صحنه" className="grid grid-cols-3 gap-1 rounded-control bg-surface-subtle p-1 @2xl:hidden">
   {([["camera","دوربین"],["frame","کادر"],["light","نور"]] as const).map(([k,label])=><button key={k} type="button" role="tab" aria-selected={view===k} onClick={()=>setView(k)}
    className={"h-9 rounded-control type-label motion-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring "+(view===k?"bg-background text-fg-primary shadow-1":"text-fg-secondary")}>{label}</button>)}
  </div>
  {editable&&<div role="radiogroup" aria-label="سوژهٔ صحنه" className="flex flex-wrap gap-1">
   {SUBJECTS.map(s=><Chip key={s} on={subject===s} onClick={()=>set({subject:s})} role="radio">{SUBJECT_FA[s]}</Chip>)}
  </div>}
  <div className="grid grid-cols-1 gap-2 @2xl:grid-cols-2">
   <div className={shown("camera")}><Viewport title="زاویهٔ دوربین" value={CAMERA_ANGLE_FA[draft.cameraAngle]}>
    <CameraView staging={draft} editable={editable} onAngle={a=>set({cameraAngle:a})}/>
    {editable&&<div className="flex justify-center"><Chip on={draft.cameraAngle==="dutch"} onClick={()=>set({cameraAngle:draft.cameraAngle==="dutch"?"eye_level":"dutch"})}>زاویهٔ کج</Chip></div>}
   </Viewport></div>
   <div className={shown("frame")}><Viewport title="کادر" value={SHOT_SIZE_FA[draft.shotSize]+" · "+aspect+(draft.framing?" · "+placementFa(draft.framing):"")}>
    <FrameView staging={draft} aspect={aspect} editable={editable} onFraming={f=>set({framing:f})}/>
    {editable&&<>
     <input type="range" min={0} max={SHOT_SIZES.length-1} step={1} value={SHOT_SIZES.indexOf(draft.shotSize)} onChange={e=>set({shotSize:SHOT_SIZES[Number(e.target.value)]})}
      aria-label="اندازهٔ نما" aria-valuetext={SHOT_SIZE_FA[draft.shotSize]} className="h-8 w-full cursor-pointer accent-primary"/>
     <div className="flex flex-wrap justify-center gap-1">{["16:9","3:2","4:5","1:1","9:16"].map(r=><Chip key={r} on={aspect===r} onClick={()=>setAspect(r)}><bdi>{r}</bdi></Chip>)}</div>
    </>}
   </Viewport></div>
   <div className={shown("light")+" @2xl:col-span-2"}>
    <Viewport title="نورپردازی (از بالا)" value={draft.lights.length===1?"یک منبع نور":fa(draft.lights.length)+" منبع نور"}>
     <LightView staging={draft} editable={editable} selected={sel} onSelect={setSel} onDirection={(i,d)=>setLight(i,{direction:d})}/>
    </Viewport>
   </div>
  </div>
  {editable&&draft.lights[sel]&&<div className={shown("light")}><LightInspector light={draft.lights[sel]} canRemove={draft.lights.length>1} onChange={p=>setLight(sel,p)}
   onRemove={()=>{setDraft(d=>({...d,lights:d.lights.filter((_,j)=>j!==sel)}));setSel(0);}}
   onAdd={draft.lights.length<4?()=>{setDraft(d=>({...d,lights:[...d.lights,{role:"fill",direction:"front_right",height:"eye",quality:"soft",source:"softbox",colorTemperatureK:5600}]}));setSel(draft.lights.length);}:undefined}/></div>}
  {!editable&&<ul className="flex flex-col gap-1">{draft.lights.map((l,i)=><LightRow key={i} l={l}/>)}</ul>}
  {editable&&changed&&<div className="flex flex-wrap items-center gap-2">
   <Button type="button" onClick={()=>onApply?.(draft,aspect)} disabled={disabled}><Icon icon={Wand2} aria-hidden="true"/>این صحنه رو بساز</Button>
   <Button type="button" variant="ghost" onClick={()=>{setDraft(initial);setAspect(aspectRatio??"16:9");setSel(0);}}><Icon icon={RotateCcw} aria-hidden="true"/>برگرد به پیشنهاد هووش</Button>
   <p className="w-full type-caption text-fg-secondary">صحنهٔ تازه برای هووش فرستاده می‌شه و یه برنامه و قیمت جدید می‌گیری.</p>
  </div>}
 </div>;
}

/** A dark viewport tile with a caption pill and the value, as in the design reference. */
function Viewport({title,value,children}:{title:string;value:string;children:ReactNode}){
 return <figure className="dark flex min-w-0 flex-col gap-2 rounded-card bg-background p-3 text-fg-primary">
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

/** Side view: the subject on the ground, the camera on an arc around its focus point. */
function CameraView({staging,editable,onAngle}:{staging:Staging;editable:boolean;onAngle:(a:Staging["cameraAngle"])=>void}){
 const svg=useRef<SVGSVGElement>(null),[drag,setDrag]=useState<number|null>(null);
 const subject=staging.subject??"person",ground=124;
 const size={person:92,object:46,animal:48,vehicle:40,environment:58}[subject],sx=subject==="environment"?84:70;
 const focus:[number,number]=[sx,ground-size*(subject==="person"?0.9:0.55)];
 const elev=drag??CAMERA_ELEVATION[staging.cameraAngle],[cx,cy]=polar(focus[0],focus[1],78,-elev);
 const aim=Math.atan2(focus[1]-cy,focus[0]-cx)*180/Math.PI,roll=staging.cameraAngle==="dutch"?14:0;
 const elevAt=(e:PointerEvent)=>{const r=svg.current!.getBoundingClientRect(),p=svg.current!.createSVGPoint();p.x=(e.clientX-r.left)*220/r.width;p.y=(e.clientY-r.top)*150/r.height;
  return Math.max(-60,Math.min(85,-Math.atan2(p.y-focus[1],p.x-focus[0])*180/Math.PI));};
 const key=(e:KeyboardEvent)=>{const step=e.key==="ArrowUp"||e.key==="ArrowRight"?1:e.key==="ArrowDown"||e.key==="ArrowLeft"?-1:0;if(!step)return;e.preventDefault();onAngle(stepAngle(staging.cameraAngle,step));};
 return <svg ref={svg} viewBox="0 0 220 150" className="aspect-[22/15] w-full touch-none select-none text-fg-primary" aria-hidden={!editable}
  onPointerMove={e=>{if(drag!==null)setDrag(elevAt(e));}} onPointerUp={()=>{if(drag!==null){onAngle(staging.cameraAngle==="dutch"?"dutch":snapElevation(drag));setDrag(null);}}} onPointerCancel={()=>setDrag(null)}>
  <defs><linearGradient id="floor" x1="0" x2="1"><stop offset="0" stopColor="currentColor" stopOpacity="0"/><stop offset=".5" stopColor="currentColor" stopOpacity=".35"/><stop offset="1" stopColor="currentColor" stopOpacity="0"/></linearGradient></defs>
  <path d={"M"+polar(focus[0],focus[1],78,-85).join(" ")+" A78 78 0 0 1 "+polar(focus[0],focus[1],78,60).join(" ")} fill="none" stroke="currentColor" strokeOpacity=".45" strokeDasharray="3 4"/>
  {ANGLE_ORDER.map(a=>{const [x,y]=polar(focus[0],focus[1],78,-CAMERA_ELEVATION[a]);return <circle key={a} cx={x} cy={y} r={a===staging.cameraAngle?2.6:1.8} fill="currentColor" opacity={a===staging.cameraAngle?.9:.45}/>;})}
  <rect x={6} y={ground} width={208} height={1.2} fill="url(#floor)"/>
  {subject==="environment"?<><Asset id="env-mountains" x={sx} y={ground} h={58}/><Asset id="env-tree" x={sx+46} y={ground} h={34}/></>:<Asset id={SUBJECT_ASSETS[subject].side} x={sx} y={ground} h={size}/>}
  <line x1={cx} y1={cy} x2={focus[0]} y2={focus[1]} className="stroke-primary" strokeWidth={1.4} strokeDasharray="4 3"/>
  <g role={editable?"slider":undefined} tabIndex={editable?0:undefined} aria-label="زاویهٔ دوربین" aria-valuetext={CAMERA_ANGLE_FA[staging.cameraAngle]}
   aria-valuemin={0} aria-valuemax={ANGLE_ORDER.length-1} aria-valuenow={ANGLE_ORDER.indexOf(staging.cameraAngle==="dutch"?"eye_level":staging.cameraAngle)}
   onKeyDown={editable?key:undefined} onPointerDown={editable?e=>{(e.currentTarget as Element).setPointerCapture?.(e.pointerId);svg.current?.setPointerCapture(e.pointerId);setDrag(elevAt(e));}:undefined}
   className={editable?"cursor-grab outline-none focus-visible:[&>circle]:stroke-primary":""}>
   <circle cx={cx} cy={cy} r={24} fill="transparent"/>
   <Asset id="camera-side" x={cx+6} y={cy+11} h={22} rotate={aim-180+roll}/>
  </g>
 </svg>;
}

/** "w:h" as a number, 16:9 when unreadable. */
function ratioOf(aspect:string):number{const m=/^(\d+(?:\.\d+)?)[:x×/](\d+(?:\.\d+)?)$/.exec(aspect.trim());const r=m?Number(m[1])/Number(m[2]):16/9;return r>0.2&&r<5?r:16/9;}
const THIRD=1/3;
/** Snaps a framing offset to a thirds line or the centre when it is within reach (dragging feels magnetic there). */
const snapAxis=(v:number)=>{for(const t of [-THIRD,0,THIRD])if(Math.abs(v-t)<0.07)return t;return Math.max(-1,Math.min(1,Math.round(v*100)/100));};
/**
 * The frame at the aspect ratio with thirds. The subject is cropped as the shot size crops it (an environment zooms the landscape). Dragging inside the frame
 * slides the shot like a crop: the subject moves with the pointer and snaps to the thirds and the centre; arrow keys move it in small steps.
 */
function FrameView({staging,aspect,editable,onFraming}:{staging:Staging;aspect:string;editable?:boolean;onFraming?:(f:{x:number;y:number}|undefined)=>void}){
 const clip=useId(),svg=useRef<SVGSVGElement>(null),r=ratioOf(aspect),W=r>=1?150:Math.round(110*r),H=r>=1?Math.round(150/r):110;
 const [drag,setDrag]=useState<{px:number;py:number;x:number;y:number;cur:{x:number;y:number}}|null>(null);
 const subject=staging.subject??"person",f=SHOT_BODY_FRACTION[staging.shotSize],env=subject==="environment";
 const fr=drag?.cur??staging.framing??{x:0,y:0};
 // A person is cropped like a body: under one body height the head sits near the top; from full body on the feet stand on the ground line. Objects, animals and
 // vehicles grow towards the frame as the shot tightens, centred; an environment zooms the landscape.
 const h=subject==="person"?(f<1?H/(f*1.08):H*0.9/f):Math.min(H*3,H*0.7/Math.pow(f,0.8));
 const bottom=subject==="person"?(f<1?H*0.06+h:H*0.86):(f<1?H*0.5+h/2:H*0.86);
 const envScale=Math.min(2.6,Math.max(0.5,1/Math.sqrt(f)));
 const dx=fr.x*W/2,dy=fr.y*H/2;
 const onX=Math.abs(Math.abs(fr.x)-THIRD)<0.01,onY=Math.abs(Math.abs(fr.y)-THIRD)<0.01;
 const unit=()=>{const b=svg.current!.getBoundingClientRect();return {sx:(W+4)/b.width,sy:(H+4)/b.height};};
 const commit=(v:{x:number;y:number})=>onFraming?.(v.x===0&&v.y===0?undefined:v);
 const key=(e:KeyboardEvent)=>{
  const d={ArrowLeft:[-0.05,0],ArrowRight:[0.05,0],ArrowUp:[0,-0.05],ArrowDown:[0,0.05]}[e.key as "ArrowLeft"];if(!d)return;e.preventDefault();
  commit({x:snapAxis(fr.x+d[0]),y:snapAxis(fr.y+d[1])});
 };
 return <svg ref={svg} viewBox={"-2 -2 "+(W+4)+" "+(H+4)} className="aspect-[22/15] w-full touch-none select-none text-fg-primary" aria-hidden={!editable}
  onPointerMove={e=>{if(!drag)return;const u=unit();setDrag({...drag,cur:{x:snapAxis(drag.x+(e.clientX-drag.px)*u.sx/(W/2)),y:snapAxis(drag.y+(e.clientY-drag.py)*u.sy/(H/2))}});}}
  onPointerUp={()=>{if(drag){commit(drag.cur);setDrag(null);}}} onPointerCancel={()=>setDrag(null)}>
  <defs><clipPath id={clip}><rect width={W} height={H} rx={6}/></clipPath>
   <linearGradient id={clip+"g"} x1="0" y1="0" x2="0" y2="1"><stop offset=".75" stopColor="currentColor" stopOpacity="0"/><stop offset="1" stopColor="currentColor" stopOpacity=".12"/></linearGradient></defs>
  <g clipPath={"url(#"+clip+")"}>
   <rect width={W} height={H} className="fill-background"/><rect width={W} height={H} fill={"url(#"+clip+"g)"}/>
   <g transform={"translate("+dx+" "+dy+")"}>
    {f>=1&&!env&&<rect x={-W} y={H*0.86} width={W*3} height={1} fill="currentColor" fillOpacity=".35"/>}
    {env
     ?<><Asset id="env-mountains" x={W*0.5} y={H*0.86} h={H*0.55*envScale}/><Asset id="env-tree" x={W*0.78} y={H*0.9} h={H*0.3*envScale}/><Asset id="env-building" x={W*0.22} y={H*0.9} h={H*0.36*envScale}/></>
     :<Asset id={SUBJECT_ASSETS[subject].front} x={W*0.5} y={bottom} h={h}/>}
   </g>
   {[1,2].map(i=><g key={i} strokeDasharray="3 3">
    <line x1={W*i/3} x2={W*i/3} y1={0} y2={H} className={onX&&(i===1)===(fr.x<0)?"stroke-primary":""} stroke={onX&&(i===1)===(fr.x<0)?undefined:"currentColor"} strokeOpacity={onX&&(i===1)===(fr.x<0)?1:.3}/>
    <line x1={0} x2={W} y1={H*i/3} y2={H*i/3} className={onY&&(i===1)===(fr.y<0)?"stroke-primary":""} stroke={onY&&(i===1)===(fr.y<0)?undefined:"currentColor"} strokeOpacity={onY&&(i===1)===(fr.y<0)?1:.3}/>
   </g>)}
   {editable&&<rect width={W} height={H} fill="transparent" role="slider" tabIndex={0} aria-label={"جای سوژه در کادر: "+placementFa(staging.framing)} aria-valuetext={placementFa(staging.framing)}
    aria-valuenow={Math.round(fr.x*100)} aria-valuemin={-100} aria-valuemax={100} onKeyDown={key} className={"outline-none "+(drag?"cursor-grabbing":"cursor-grab")}
    onPointerDown={e=>{svg.current?.setPointerCapture(e.pointerId);setDrag({px:e.clientX,py:e.clientY,x:fr.x,y:fr.y,cur:fr});}}/>}
  </g>
  <rect width={W} height={H} rx={6} fill="none" stroke="currentColor" strokeOpacity=".85" strokeWidth={1.6}/>
 </svg>;
}

/** Top view: the subject in the centre facing the camera (bottom), each light around it, drawn as a coloured glow with its source asset and beam. */
function LightView({staging,editable,selected,onSelect,onDirection}:{staging:Staging;editable:boolean;selected:number;onSelect:(i:number)=>void;onDirection:(i:number,d:StagingLight["direction"])=>void}){
 const svg=useRef<SVGSVGElement>(null),uid=useId(),[drag,setDrag]=useState<{i:number;deg:number}|null>(null);
 const C:[number,number]=[110,92],R=64,subject=staging.subject??"person";
 const degAt=(e:PointerEvent)=>{const r=svg.current!.getBoundingClientRect();const x=(e.clientX-r.left)*220/r.width,y=(e.clientY-r.top)*200/r.height;return Math.atan2(y-C[1],x-C[0])*180/Math.PI;};
 return <svg ref={svg} viewBox="0 0 220 200" className="mx-auto aspect-[22/20] w-full max-w-sm touch-none select-none text-fg-primary"
  onPointerMove={e=>{if(drag)setDrag({...drag,deg:degAt(e)});}} onPointerUp={()=>{if(drag){onDirection(drag.i,snapDirection(drag.deg));setDrag(null);}}} onPointerCancel={()=>setDrag(null)}>
  <circle cx={C[0]} cy={C[1]} r={R} fill="none" stroke="currentColor" strokeOpacity=".35" strokeDasharray="2 4"/>
  <line x1={C[0]} y1={C[1]+20} x2={C[0]} y2={176} stroke="currentColor" strokeOpacity=".35" strokeDasharray="3 4"/>
  {staging.lights.map((l,i)=>{
   const isDrag=drag?.i===i,top=l.direction==="top";
   const [x,y]=isDrag?polar(C[0],C[1],R,drag!.deg):top?[C[0]+(i%2?18:-18),C[1]-26]:polar(C[0],C[1],R,LIGHT_ANGLE[l.direction as Exclude<StagingLight["direction"],"top">]);
   const color=lightHex(l),soft=l.quality==="soft",g=uid+"-"+i,toward=Math.atan2(C[1]-y,C[0]-x),spread=soft?0.5:0.22,len=Math.hypot(C[0]-x,C[1]-y)-12;
   const [ax,ay]=[x+len*Math.cos(toward-spread),y+len*Math.sin(toward-spread)],[bx,by]=[x+len*Math.cos(toward+spread),y+len*Math.sin(toward+spread)];
   const key=(e:KeyboardEvent)=>{const step=e.key==="ArrowRight"||e.key==="ArrowDown"?1:e.key==="ArrowLeft"||e.key==="ArrowUp"?-1:0;if(!step)return;e.preventDefault();onSelect(i);onDirection(i,stepDirection(l.direction,step));};
   return <g key={i} role={editable?"button":undefined} tabIndex={editable?0:undefined} aria-label={LIGHT_ROLE_FA[l.role]+"، "+LIGHT_DIRECTION_FA[l.direction]} aria-pressed={editable?selected===i:undefined}
    onKeyDown={editable?key:undefined} onClick={editable?()=>onSelect(i):undefined}
    onPointerDown={editable&&!top?e=>{onSelect(i);svg.current?.setPointerCapture(e.pointerId);setDrag({i,deg:degAt(e)});}:undefined}
    className={editable?"cursor-grab outline-none":""}>
    <defs><radialGradient id={g}><stop offset="0%" stopColor={color} stopOpacity={1}/><stop offset={soft?"35%":"70%"} stopColor={color} stopOpacity={.85}/><stop offset="100%" stopColor={color} stopOpacity={0}/></radialGradient>
     <linearGradient id={g+"b"} x1={x} y1={y} x2={C[0]} y2={C[1]} gradientUnits="userSpaceOnUse"><stop offset="0" stopColor={color} stopOpacity={soft?.45:.6}/><stop offset="1" stopColor={color} stopOpacity="0"/></linearGradient></defs>
    {!top&&<path d={"M"+x+" "+y+" L"+ax.toFixed(1)+" "+ay.toFixed(1)+" L"+bx.toFixed(1)+" "+by.toFixed(1)+" Z"} fill={"url(#"+g+"b)"}/>}
    <circle cx={x} cy={y} r={22} fill="transparent"/>
    <circle cx={x} cy={y} r={soft?15:10} fill={"url(#"+g+")"}/>
    <circle cx={x} cy={y} r={soft?6.5:5} fill={color} className={editable&&selected===i?"stroke-primary":"stroke-background"} strokeWidth={editable&&selected===i?2:1}/>
    <Asset id={LIGHT_ASSETS[l.source]} x={x+(x<C[0]?-16:16)} y={y-4} h={16} opacity={.95}/>
    <text x={x} y={y+(y>C[1]+30?-14:22)} textAnchor="middle" fill="currentColor" fillOpacity=".8" fontSize={9}>{LIGHT_ROLE_FA[l.role].replace("نور ","")}</text>
   </g>;
  })}
  <Asset id={SUBJECT_ASSETS[subject].top} x={C[0]} y={C[1]+20} h={subject==="vehicle"?46:40}/>
  <Asset id="camera-top" x={C[0]} y={196} h={26}/>
 </svg>;
}

/** The selected light's settings. */
function LightInspector({light:l,canRemove,onChange,onRemove,onAdd}:{light:StagingLight;canRemove:boolean;onChange:(p:Partial<StagingLight>)=>void;onRemove:()=>void;onAdd?:()=>void}){
 return <div className="flex flex-col gap-3 rounded-card border border-line-secondary bg-surface-subtle p-3">
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
