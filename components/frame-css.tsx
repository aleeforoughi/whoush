"use client";
/**
 * «بوم»'s frame in CSS 3D (Plan A; the three.js frame, Plan B, is parked in components/scene-3d.tsx and on archive/plan-b-3d). The same camera as the
 * prompt (lib/frame-css.ts): CSS perspective is the lens, the ground and walls are planes in perspective, every prop is the pack's image for the height
 * stop and side the camera sees it from, and the aperture blurs each thing by its distance from the focus. Same props as the 3D view, so the frame and its
 * full-screen view use either.
 */
import {useEffect,useLayoutEffect,useRef,useState,type CSSProperties,type PointerEvent} from "react";
import type {Scene3DProps} from "./scene-3d";
import {SCENE_COLORS} from "@/lib/scene3d";
import {cssView,toScreen,horizonY,billboard,plane,nearZ,blurPx,boxFaces,shade,propSprites,stageAt,gridLines,type CssView,type V3} from "@/lib/frame-css";
import {propTints} from "@/lib/staging";
import {VISUALS} from "@/lib/visual-assets";

const C=SCENE_COLORS;
/** A thing placed by its CSS transform about the perspective origin (its local origin), drawn back to front. */
type Layer={key:string;depth:number;style:CSSProperties;src?:string;prop?:number};
const rnd=(i:number)=>((Math.sin(i*12.9898)*43758.5453)%1+1)%1;
const at=(v:CssView):CSSProperties=>({position:"absolute",left:v.pp[0],top:v.pp[1],transformOrigin:"0 0",pointerEvents:"none"});

/** The place behind the props, at its real distance: floors and walls as planes, far things as the pack's images (hazed, blurred by the lens). */
function placeLayers(v:CssView,env:string,D:number):Layer[]{
 const out:Layer[]=[],K=10,z0=Math.min(nearZ(v,0),nearZ(v,3));
 const sheet=(key:string,o:V3,ex:V3,ey:V3,w:number,h:number,bg:string,depth:number,extra:CSSProperties={})=>{if(w>0&&h>0)out.push({key,depth,style:{...at(v),width:w,height:h,background:bg,transform:plane(v,o,ex,ey),...extra}});};
 const far=(key:string,src:string,iw:number,ih:number,centre:V3,mpp:number,haze=1,sx=1,mirror=false)=>{const b=billboard(v,centre,mpp,mirror,0.3,sx);if(!b)return;const bl=blurPx(v,b.depth)/b.px;
  out.push({key,depth:b.depth,src,style:{...at(v),width:iw,height:ih,opacity:haze,transform:b.transform+" translate(-50%,-50%)",filter:bl>0.4?"blur("+bl.toFixed(1)+"px)":undefined}});};
 const thing=(key:string,fam:"tree"|"building",x:number,z:number,h:number,haze:number)=>{const wd=fam==="tree"?h*0.5:6+h*0.3,b=boxFaces(v,[x,0,z],{w:wd,h,d:wd},0);
  if(b)for(const f of b.faces)out.push({key:key+f.key,depth:b.depth,style:{...at(v),width:f.w,height:f.h,opacity:haze,transform:f.transform,background:shade(C.clay,f.shade*0.8),filter:b.blur>0.4?"blur("+b.blur.toFixed(1)+"px)":undefined}});};
 if(env==="room"){
  const Wd=4.5,Hc=3,zEnd=Math.min(-D+12,z0);
  sheet("floor",[-Wd,0,-D],[1/K,0,0],[0,0,1/K],Wd*2*K,(zEnd+D)*K,C.wall,1e6+3,{opacity:0.55});
  sheet("back",[-Wd,Hc,-D],[1/K,0,0],[0,-1/K,0],Wd*2*K,Hc*K,C.wall,1e6+2);
  sheet("window",[0.7,2.35,-D+0.02],[1/K,0,0],[0,-1/K,0],14,15,C.window,1e6+1,{opacity:0.6});
  for(const s of [-1,1])sheet("wall"+s,[s*Wd,Hc,-D],[0,0,1/K],[0,-1/K,0],(zEnd+D)*K,Hc*K,C.wall,1e6,{filter:"brightness(0.8)"});
  if(v.pos[1]<Hc-0.1)sheet("ceiling",[-Wd,Hc,-D],[1/K,0,0],[0,0,1/K],Wd*2*K,(zEnd+D)*K,C.wall,1e6,{filter:"brightness(0.6)"});
  return out;
 }
 if(env==="studio"){sheet("backdrop",[-20,12,-D],[1/K,0,0],[0,-1/K,0],400,120,C.wall,1e6+2);sheet("floor",[-20,0,-D],[1/K,0,0],[0,0,1/K],400,Math.max(0,(Math.min(z0,40)+D)*K),C.wall,1e6+3,{opacity:0.7});return out;}
 if(env==="street")for(let i=0;i<18;i++)thing("b"+i,"building",(i-9)*11,-D-rnd(i)*8,10+rnd(i+3)*18,0.8);
 if(env==="forest")for(let i=0;i<40;i++)thing("t"+i,"tree",(rnd(i)-0.5)*120,-D-rnd(i+7)*25,5+rnd(i+11)*5,0.8);
 if(env==="beach"){const zs=-Math.max(30,D*0.1);sheet("sea",[-1500,0.01,-3000],[1,0,0],[0,0,1],3000,3000+zs,C.sea,1e6+1);}
 if(env==="desert")for(let i=0;i<14;i++){const h=10+rnd(i+2)*14,b=billboard(v,[(i-7)*90,0,-D-rnd(i)*80],1);
  if(b)out.push({key:"d"+i,depth:b.depth,style:{...at(v),width:140,height:h,background:C.clay,opacity:0.22,borderRadius:"50% 50% 0 0 / 100% 100% 0 0",transform:b.transform+" translate(-50%,-100%)"}});}
 if(env==="landscape"||env==="desert"||env==="beach"){const m=VISUALS["env-mountains"];
  // A wide range along the whole horizon: each massif stretched wide, a near row and a taller, hazier far row behind it, overlapping edge to edge, their
  // bases sunk a little into the ground so no gap ever shows between a mountain and the horizon.
  if(m){for(let i=0;i<25;i++){const h=60+rnd(i+7)*70,z=-D-260-rnd(i+3)*200;far("m"+i,m.src,m.width,m.height,[(i-12)*260+(rnd(i)-0.5)*90,h*0.44,z],h/m.height,0.75,2.4,i%2===1);}
   for(let i=0;i<17;i++){const h=180+rnd(i+31)*160,z=-D-1400-rnd(i+23)*600;far("M"+i,m.src,m.width,m.height,[(i-8)*900+(rnd(i+5)-0.5)*300,h*0.44,z],h/m.height,0.4,2.6,i%2===0);}}}
 return out;
}

export default function FrameCSS({staging,anchor,aspect,editable,sel,onSelect,onProp,onPropTap,onPropDown,onProject,wide,onFrameRect,lockedTo,within}:Scene3DProps){
 const root=useRef<HTMLDivElement>(null),[[w,h],setSize]=useState<[number,number]>([0,0]);
 useLayoutEffect(()=>{const el=root.current;if(!el)return;const ro=new ResizeObserver(()=>setSize([el.clientWidth,el.clientHeight]));ro.observe(el);setSize([el.clientWidth,el.clientHeight]);return ()=>ro.disconnect();},[]);
 const [moving,setMoving]=useState<{i:number;x:number;z:number}|null>(null);
 const grab=useRef<{i:number;feet:[number,number];from:[number,number];lift:number;far:boolean}|null>(null);
 const base=(staging.props??[]).map((p,i)=>moving?.i===i?{...p,x:moving.x,z:moving.z}:p);
 // The camera comes from the scene as it is (a prop being dragged moves only itself).
 const v=w>0&&h>0?cssView(staging,anchor,aspect,w,h,wide):undefined;
 const sprites=v?propSprites(v,base,staging,anchor):[];
 const tints=propTints(base);
 // Where the centre point and the top of the selected prop land, for the frame's overlays; where the frame lies in the wide view.
 const proj:Record<string,[number,number]>={};
 if(v){const c=toScreen(v,v.cam.target as V3);if(c)proj.center=[c[0]/w,c[1]/h];
  const sp=sel!=null?sprites.find(s=>s.i===sel):undefined;const t=sp&&toScreen(v,sp.top);if(t)proj.sel=[t[0]/w,t[1]/h];}
 const projKey=JSON.stringify(proj),rectKey=JSON.stringify(v?.frame??null);
 useEffect(()=>{if(v)onProject?.(JSON.parse(projKey));
  // eslint-disable-next-line react-hooks/exhaustive-deps -- reported when the points change
 },[projKey]);
 useEffect(()=>{const r=JSON.parse(rectKey);if(r)onFrameRect?.(r);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- reported when the frame moves
 },[rectKey]);
 if(!v)return <div ref={root} className="absolute inset-0"/>;
 const local=(e:PointerEvent):[number,number]=>{const b=root.current!.getBoundingClientRect();return [e.clientX-b.left,e.clientY-b.top];};
 const layers:Layer[]=[...placeLayers(v,staging.environment??"landscape",v.cam.backdrop),
  ...sprites.filter(s=>s.faces).flatMap(s=>s.faces!.map(f=>({key:"p"+s.i+f.key,depth:s.depth,prop:s.i,style:{...at(v),width:f.w,height:f.h,transform:f.transform,
   background:shade(sel===s.i?C.selected:tints[s.i]??C.clay,f.shade),boxShadow:"inset 0 0 0 1px "+C.edge,pointerEvents:editable?"auto":"none",cursor:editable?(moving?.i===s.i?"grabbing":"grab"):undefined,
   filter:s.blur>0.4?"blur("+s.blur.toFixed(1)+"px)":undefined} as CSSProperties}))),
  ...sprites.filter(s=>!s.faces).map(s=>({key:"p"+s.i,depth:s.depth,src:s.src,prop:s.i,style:{...at(v),width:s.w,height:s.h,transform:s.transform,pointerEvents:editable?"auto":"none",
   cursor:editable?(moving?.i===s.i?"grabbing":"grab"):undefined,
   filter:[tints[s.i]||sel===s.i?"url(#fc-t"+s.i+")":"",s.blur>0.4?"blur("+s.blur.toFixed(1)+"px)":""].filter(Boolean).join(" ")||undefined} as CSSProperties}))]
  .sort((a,b)=>b.depth-a.depth);
 const hz=Math.max(-h*3,Math.min(h*4,horizonY(v)));
 // The ground's grid, in front of the camera only: it shows the lens's perspective (a wide lens close up runs it steeply to the horizon).
 const grid=gridLines(v);
 const down=(i:number)=>(e:PointerEvent<HTMLElement>)=>{
  if(!editable||e.button>0||(lockedTo!==undefined&&lockedTo!==i))return;e.stopPropagation();onPropDown?.();onSelect?.(i);
  const s=sprites.find(x=>x.i===i);if(!s)return;const f=toScreen(v,s.ground);if(!f)return;
  try{e.currentTarget.setPointerCapture(e.pointerId);}catch{ /* not capturable */ }
  grab.current={i,feet:f,from:local(e),lift:s.ground[1],far:false};
 };
 const move=(i:number)=>(e:PointerEvent<HTMLElement>)=>{const g=grab.current;if(!g||g.i!==i)return;e.stopPropagation();
  const [x,y]=local(e);if(!g.far&&Math.hypot(x-g.from[0],y-g.from[1])<5)return;g.far=true;
  const st=stageAt(v,g.feet[0]+x-g.from[0],g.feet[1]+y-g.from[1],g.lift,staging,anchor);if(!st)return;
  const p=base[i],c=within?within(p,st):st;if(Number.isFinite(c.x)&&Number.isFinite(c.z))setMoving({i,...c});};
 const up=(i:number)=>(e:PointerEvent<HTMLElement>)=>{const g=grab.current;if(!g||g.i!==i)return;e.stopPropagation();grab.current=null;
  if(moving&&moving.i===i)onProp?.(i,moving.x,moving.z);else if(!g.far)onPropTap?.(i);setMoving(null);};
 return <div ref={root} className="absolute inset-0 overflow-hidden" style={{background:C.sky,touchAction:"none"}}>
  <svg aria-hidden="true" width={0} height={0} className="absolute">
   <defs>{base.map((_,i)=>(tints[i]||sel===i)&&<filter key={i} id={"fc-t"+i} colorInterpolationFilters="sRGB">
    <feFlood style={{floodColor:sel===i?"var(--color-primary)":tints[i]}}/><feComposite in2="SourceAlpha" operator="in"/><feBlend in2="SourceGraphic" mode="multiply"/></filter>)}</defs>
  </svg>
  <div className="absolute inset-0" style={{transform:"rotate("+v.roll+"deg)",transformOrigin:"50% 50%"}}>
   {/* The sky down to the horizon (lighter toward it), the ground below it; the planes and images in perspective on top. */}
   <div className="absolute" style={{left:-w,width:w*3,top:-h*3,height:hz+h*3,background:"linear-gradient(to bottom,"+C.sky+" 70%,"+C.horizon+")"}}/>
   <div className="absolute" style={{left:-w,width:w*3,top:hz,height:h*5,background:C.ground}}/>
   <svg aria-hidden="true" className="pointer-events-none absolute overflow-visible" style={{left:0,top:0}} width={w} height={h}>
    {grid.map((g,k)=><line key={k} x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} stroke={C.grid} strokeWidth={1} strokeOpacity={1-g.far*0.8}/>)}
   </svg>
   <div className="absolute inset-0" style={{perspective:v.D+"px",perspectiveOrigin:v.pp[0]+"px "+v.pp[1]+"px"}}>
    {layers.map(l=>l.src
     // eslint-disable-next-line @next/next/no-img-element -- pack images placed by CSS 3D transforms, not page content
     ?<img key={l.key} src={l.src} alt="" draggable={false} style={l.style}
      {...(l.prop!==undefined&&editable?{onPointerDown:down(l.prop),onPointerMove:move(l.prop),onPointerUp:up(l.prop),onPointerCancel:()=>{grab.current=null;setMoving(null);}}:{})}/>
     :<div key={l.key} aria-hidden="true" style={l.style}
      {...(l.prop!==undefined&&editable?{onPointerDown:down(l.prop),onPointerMove:move(l.prop),onPointerUp:up(l.prop),onPointerCancel:()=>{grab.current=null;setMoving(null);}}:{})}/>)}
   </div>
  </div>
 </div>;
}
