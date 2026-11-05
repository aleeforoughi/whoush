"use client";
import {useId,type ReactNode} from "react";
import type {Staging,StagingLight} from "@/lib/creative-plan";
import {CAMERA_ANGLE_FA,CAMERA_ELEVATION,LIGHT_ANGLE,LIGHT_DIRECTION_FA,LIGHT_HEIGHT_FA,LIGHT_QUALITY_FA,LIGHT_ROLE_FA,LIGHT_SOURCE_FA,SHOT_BODY_FRACTION,SHOT_SIZE_FA,lightHex,lightToneFa,polar} from "@/lib/staging";
import {fa} from "@/lib/format";

/**
 * Plan diagrams, drawn locally as SVG from the plan's structured staging (nothing generated, nothing fetched): where the camera sits relative to the subject, how
 * the frame cuts the subject, and where the lights are with their colour and softness. They illustrate Whoush's proposal; they are not provider settings.
 * Colours come from theme tokens (fill-*, stroke-*), except each light, drawn in its own colour.
 */

/** One diagram in a small framed tile with its caption. */
function Tile({title,value,label,wide,children}:{title:string;value:string;label:string;wide?:boolean;children:ReactNode}){
 return <figure className="flex min-w-0 flex-col gap-2 rounded-card bg-surface-subtle p-3">
  <div role="img" aria-label={label} className={"flex items-center justify-center text-fg-secondary "+(wide?"mx-auto aspect-[17/16] w-full max-w-64":"aspect-[16/11]")}>{children}</div>
  <figcaption className="flex flex-col">
   <span className="type-caption text-fg-secondary">{title}</span>
   <span className="type-label text-fg-primary">{value}</span>
  </figcaption>
 </figure>;
}

/** A small camera glyph pointing along +x from its origin (body, lens and viewfinder bump), to be placed with a transform. */
const CameraGlyph=()=><g className="fill-fg-primary">
 <rect x={-9} y={-5} width={13} height={10} rx={2}/>
 <rect x={-6} y={-8} width={5} height={3} rx={1}/>
 <path d="M4 -3.5 L10 -6 L10 6 L4 3.5 Z"/>
</g>;

/** Side view: the subject standing on the ground, the camera on an arc around the head at the planned elevation, aiming at the eyes. */
export function CameraAngleDiagram({angle}:{angle:Staging["cameraAngle"]}){
 const head:[number,number]=[56,52],[cx,cy]=polar(head[0],head[1],50,-CAMERA_ELEVATION[angle]);
 const aim=Math.atan2(head[1]-cy,head[0]-cx)*180/Math.PI+(angle==="dutch"?18:0);
 return <svg viewBox="0 0 160 110" className="h-full w-full" aria-hidden="true">
  <path d={"M"+head[0]+" "+(head[1]-50)+" A50 50 0 0 1 "+polar(head[0],head[1],50,60).join(" ")} className="fill-none stroke-line-secondary" strokeDasharray="2 3"/>
  <line x1={8} x2={152} y1={100} y2={100} className="stroke-line-primary"/>
  <line x1={head[0]} x2={150} y1={head[1]} y2={head[1]} className="stroke-line-secondary" strokeDasharray="1 3"/>
  <g className="fill-surface-hover stroke-line-primary">
   <circle cx={head[0]} cy={head[1]} r={7}/>
   <rect x={head[0]-9} y={head[1]+9} width={18} height={22} rx={6}/>
   <rect x={head[0]-6} y={head[1]+30} width={12} height={18} rx={3}/>
  </g>
  <line x1={cx} y1={cy} x2={head[0]} y2={head[1]} className="stroke-primary" strokeDasharray="3 2"/>
  {/* The camera faces left, towards the subject: mirrored rather than turned upside down (a mirrored glyph rotated by 180-aim points along aim). */}
  <g transform={"translate("+cx+" "+cy+") scale(-1 1) rotate("+(180-aim).toFixed(1)+")"}><CameraGlyph/></g>
 </svg>;
}

/** "w:h" as a ratio, 16:9 when missing or unreadable. */
function ratio(aspect?:string):number{
 const m=/^\s*(\d+(?:\.\d+)?)\s*[:x×/]\s*(\d+(?:\.\d+)?)\s*$/.exec(aspect??"");
 const r=m?Number(m[1])/Number(m[2]):16/9;
 return Number.isFinite(r)&&r>0.2&&r<5?r:16/9;
}
/** A standing person, 100 units from the top of the head (y 0) to the feet (y 100), centred on x 0. */
const Person=()=><g className="fill-surface-hover stroke-line-primary" strokeWidth={0.8} vectorEffect="non-scaling-stroke">
 <circle cx={0} cy={7} r={7}/>
 <path d="M-13 18 Q0 14 13 18 L11 52 L-11 52 Z"/>
 <rect x={-17} y={19} width={5} height={30} rx={2.5}/>
 <rect x={12} y={19} width={5} height={30} rx={2.5}/>
 <rect x={-10} y={51} width={9} height={49} rx={3}/>
 <rect x={1} y={51} width={9} height={49} rx={3}/>
</g>;

/** The frame at the planned aspect ratio with thirds, and the subject cut as the shot size cuts it: a close-up shows head and shoulders, a wide shot a small figure. */
export function FramingDiagram({shotSize,aspectRatio}:{shotSize:Staging["shotSize"];aspectRatio?:string}){
 const clip=useId(),r=ratio(aspectRatio),W=r>=1?150:Math.round(100*r),H=r>=1?Math.round(150/r):100;
 const f=SHOT_BODY_FRACTION[shotSize];
 // Under one body height the head sits near the top with a little headroom; from full body on, the feet stand on a ground line and the figure shrinks.
 const s=f<1?H/(f*100*1.08):H/(f*100),ty=f<0.15?H*0.5-s*7:f<1?H*0.06:H*0.88-s*100,tx=f<0.6?W/2:W*0.62;
 return <svg viewBox={"-2 -2 "+(W+4)+" "+(H+4)} className="h-full max-h-28 w-full" aria-hidden="true">
  <defs><clipPath id={clip}><rect width={W} height={H} rx={3}/></clipPath></defs>
  <g clipPath={"url(#"+clip+")"}>
   <rect width={W} height={H} className="fill-background"/>
   {f>=1&&<line x1={0} x2={W} y1={H*0.88} y2={H*0.88} className="stroke-line-secondary"/>}
   <g transform={"translate("+tx+" "+ty+") scale("+s+")"}><Person/></g>
   {[1,2].map(i=><g key={i} className="stroke-line-secondary" strokeDasharray="2 3">
    <line x1={W*i/3} x2={W*i/3} y1={0} y2={H}/><line x1={0} x2={W} y1={H*i/3} y2={H*i/3}/>
   </g>)}
  </g>
  <rect width={W} height={H} rx={3} className="fill-none stroke-fg-secondary" strokeWidth={1.5}/>
 </svg>;
}

const ROLE_SHORT_FA:Record<StagingLight["role"],string>={key:"اصلی",fill:"پرکننده",rim:"پشت",background:"پس‌زمینه",practical:"صحنه"};
/** Top view: the subject in the middle facing the camera at the bottom, each light around it in its direction, colour and softness (soft lights glow wide, hard ones are small and crisp), with its beam. */
export function LightingDiagram({lights}:{lights:readonly StagingLight[]}){
 const uid=useId(),C:[number,number]=[85,78];
 return <svg viewBox="0 0 170 160" className="h-full w-full" aria-hidden="true">
  <circle cx={C[0]} cy={C[1]} r={56} className="fill-none stroke-line-secondary" strokeDasharray="1 3"/>
  {lights.map((l,i)=>{
   const top=l.direction==="top",[x,y]=l.direction==="top"?[C[0]+(i%2?14:-14),C[1]-22]:polar(C[0],C[1],56,LIGHT_ANGLE[l.direction]);
   const color=lightHex(l),soft=l.quality==="soft",g=uid+"-l"+i;
   const toward=Math.atan2(C[1]-y,C[0]-x),spread=soft?0.5:0.22,len=Math.hypot(C[0]-x,C[1]-y)-10;
   const [ax,ay]=[x+len*Math.cos(toward-spread),y+len*Math.sin(toward-spread)],[bx,by]=[x+len*Math.cos(toward+spread),y+len*Math.sin(toward+spread)];
   return <g key={i}>
    <defs><radialGradient id={g}><stop offset="0%" stopColor={color} stopOpacity={1}/><stop offset={soft?"35%":"70%"} stopColor={color} stopOpacity={0.85}/><stop offset="100%" stopColor={color} stopOpacity={0}/></radialGradient></defs>
    {!top&&<path d={"M"+x+" "+y+" L"+ax.toFixed(1)+" "+ay.toFixed(1)+" L"+bx.toFixed(1)+" "+by.toFixed(1)+" Z"} fill={color} fillOpacity={soft?0.16:0.26}/>}
    <circle cx={x} cy={y} r={soft?13:9} fill={"url(#"+g+")"}/>
    <circle cx={x} cy={y} r={soft?6:4.5} fill={color} className="stroke-background" strokeWidth={1}/>
    <text x={x} y={y+(top?-11:y>C[1]+30?-12:20)} textAnchor="middle" className="fill-fg-secondary" fontSize={9}>{ROLE_SHORT_FA[l.role]}</text>
   </g>;
  })}
  <g className="fill-surface-hover stroke-line-primary">
   <circle cx={C[0]} cy={C[1]} r={11}/>
   <path d={"M"+(C[0]-4)+" "+(C[1]+9)+" L"+C[0]+" "+(C[1]+15)+" L"+(C[0]+4)+" "+(C[1]+9)}/>
  </g>
  <line x1={C[0]} y1={C[1]+17} x2={C[0]} y2={142} className="stroke-line-secondary" strokeDasharray="2 3"/>
  <g transform={"translate("+C[0]+" 150) rotate(-90)"}><CameraGlyph/></g>
 </svg>;
}

/** One light in the legend: its colour, role, source, softness, direction and colour temperature. */
function LightRow({l}:{l:StagingLight}){
 return <li className="flex items-start gap-2 type-caption text-fg-secondary">
  <span aria-hidden="true" className="mt-0.5 size-3 shrink-0 rounded-full border border-line-primary" style={{background:lightHex(l)}}/>
  <span className="min-w-0"><span className="text-fg-primary">{LIGHT_ROLE_FA[l.role]}</span> · {LIGHT_SOURCE_FA[l.source]} · {LIGHT_QUALITY_FA[l.quality]} · {LIGHT_DIRECTION_FA[l.direction]}، ارتفاع {LIGHT_HEIGHT_FA[l.height]} · {fa(l.colorTemperatureK)} کلوین ({lightToneFa(l)})</span>
 </li>;
}

/** The three diagrams of a plan with their Persian captions, and the lights listed under them. */
export function StagingDiagrams({staging,aspectRatio}:{staging:Staging;aspectRatio?:string}){
 const lightsFa=staging.lights.map(l=>LIGHT_ROLE_FA[l.role]+" "+LIGHT_DIRECTION_FA[l.direction]).join("، ");
 return <div className="flex flex-col gap-3">
  <div className="grid grid-cols-2 gap-2">
   <Tile title="زاویهٔ دوربین" value={CAMERA_ANGLE_FA[staging.cameraAngle]} label={"نمودار زاویهٔ دوربین: "+CAMERA_ANGLE_FA[staging.cameraAngle]}><CameraAngleDiagram angle={staging.cameraAngle}/></Tile>
   <Tile title="کادر" value={SHOT_SIZE_FA[staging.shotSize]+(aspectRatio?" · "+aspectRatio:"")} label={"نمودار کادر: "+SHOT_SIZE_FA[staging.shotSize]}><FramingDiagram shotSize={staging.shotSize} aspectRatio={aspectRatio}/></Tile>
   <div className="col-span-2"><Tile wide title="نورپردازی (از بالا)" value={staging.lights.length===1?"یک منبع نور":fa(staging.lights.length)+" منبع نور"} label={"نمودار نورپردازی از بالا: "+lightsFa}><LightingDiagram lights={staging.lights}/></Tile></div>
  </div>
  <ul className="flex flex-col gap-1">{staging.lights.map((l,i)=><LightRow key={i} l={l}/>)}</ul>
 </div>;
}
