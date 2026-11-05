"use client";
/**
 * «بوم»'s frame (Plan A; the three.js frame, Plan B, is parked in components/scene-3d.tsx and on archive/plan-b-3d). The same camera as the prompt
 * (lib/frame-css.ts): every flat thing (a prop's picture, a box face, a wall, a mountain) is placed by an exact projective map from where its corners land
 * through the lens, in small pieces under a fisheye so it follows the bulge; the ground's grid and the horizon are curves through the same lens. Each piece
 * is drawn at the px it covers on screen, so the frame stays sharp at any focal length and pixel density (no raster filter). The aperture blurs each
 * thing by its distance from the focus. Same props as the 3D view, so the frame and its full-screen view use either.
 */
import {useEffect,useLayoutEffect,useRef,useState,type CSSProperties,type PointerEvent} from "react";
import type {Scene3DProps} from "./scene-3d";
import {SCENE_COLORS} from "@/lib/scene3d";
import {cssView,toScreen,nearZ,blurPx,boxFaces,shade,propSprites,stageAt,gridBands,focusWorld,horizonPaths,tilesFor,toCam,type CssView,type Tile,type V3} from "@/lib/frame-css";
import {propTints} from "@/lib/staging";
import {VISUALS} from "@/lib/visual-assets";

const C=SCENE_COLORS;
/**
 * One thing to draw, back to front: its pieces on screen, what fills them (a colour, or an image shown across all of them), and what applies to it as a
 * whole (haze, the lens's blur, a tint, a rounded outline).
 */
type Layer={key:string;depth:number;tiles:Tile[];fill:{color:string}|{src:string};opacity?:number;blur?:number;tint?:string;round?:boolean;prop?:number};
const rnd=(i:number)=>((Math.sin(i*12.9898)*43758.5453)%1+1)%1;
const blurOf=(px:number)=>px>0.4?"blur("+px.toFixed(1)+"px)":"";

/** The place behind the props, at its real distance: floors and walls as planes, far things as the pack's images (hazed, blurred by the lens). */
function placeLayers(v:CssView,env:string,D:number):Layer[]{
 const out:Layer[]=[],K=10,z0=Math.min(nearZ(v,0),nearZ(v,3));
 // A wall or floor, blurred by the lens at the distance of its middle.
 const sheet=(key:string,o:V3,ex:V3,ey:V3,w:number,h:number,color:string,depth:number,opacity=1,dim=1)=>{if(!(w>0&&h>0))return;
  const mid:V3=[o[0]+ex[0]*w/2+ey[0]*h/2,o[1]+ex[1]*w/2+ey[1]*h/2,o[2]+ex[2]*w/2+ey[2]*h/2],dep=toCam(v,mid)[2],tiles=tilesFor(v,o,ex,ey,w,h);
  if(tiles)out.push({key,depth,tiles,fill:{color:dim===1?color:shade(color,dim)},opacity,blur:dep>0.1?blurPx(v,dep):0});};
 // A far picture square to the lens (the mountains, the dunes).
 const facing=(centre:V3,wm:number,hm:number,mirror=false)=>{const depth=toCam(v,centre)[2];if(depth<0.3)return undefined;
  const sx=mirror?-1:1,o:V3=[centre[0]-v.r[0]*sx*wm/2+v.u[0]*hm/2,centre[1]-v.r[1]*sx*wm/2+v.u[1]*hm/2,centre[2]-v.r[2]*sx*wm/2+v.u[2]*hm/2];
  const tiles=tilesFor(v,o,[v.r[0]*sx*wm/100,v.r[1]*sx*wm/100,v.r[2]*sx*wm/100],[-v.u[0]*hm/100,-v.u[1]*hm/100,-v.u[2]*hm/100],100,100);
  return tiles?{tiles,depth}:undefined;};
 const far=(key:string,src:string,iw:number,ih:number,centre:V3,mpp:number,haze=1,sx=1,mirror=false)=>{const b=facing(centre,iw*mpp*sx,ih*mpp,mirror);if(!b)return;
  out.push({key,depth:b.depth,tiles:b.tiles,fill:{src},opacity:haze,blur:blurPx(v,b.depth)});};
 const thing=(key:string,fam:"tree"|"building",x:number,z:number,h:number,haze:number)=>{const wd=fam==="tree"?h*0.5:6+h*0.3,b=boxFaces(v,[x,0,z],{w:wd,h,d:wd},0);
  if(b)for(const f of b.faces)out.push({key:key+f.key,depth:b.depth,tiles:f.tiles,fill:{color:shade(C.clay,f.shade*0.8)},opacity:haze,blur:b.blur});};
 if(env==="room"){
  const Wd=4.5,Hc=3,zEnd=Math.min(-D+12,z0);
  sheet("floor",[-Wd,0,-D],[1/K,0,0],[0,0,1/K],Wd*2*K,(zEnd+D)*K,C.wall,1e6+3,0.55);
  sheet("back",[-Wd,Hc,-D],[1/K,0,0],[0,-1/K,0],Wd*2*K,Hc*K,C.wall,1e6+2);
  sheet("window",[0.7,2.35,-D+0.02],[1/K,0,0],[0,-1/K,0],14,15,C.window,1e6+1,0.6);
  for(const s of [-1,1])sheet("wall"+s,[s*Wd,Hc,-D],[0,0,1/K],[0,-1/K,0],(zEnd+D)*K,Hc*K,C.wall,1e6,1,0.8);
  if(v.pos[1]<Hc-0.1)sheet("ceiling",[-Wd,Hc,-D],[1/K,0,0],[0,0,1/K],Wd*2*K,(zEnd+D)*K,C.wall,1e6,1,0.6);
  return out;
 }
 if(env==="studio"){sheet("backdrop",[-20,12,-D],[1/K,0,0],[0,-1/K,0],400,120,C.wall,1e6+2);sheet("floor",[-20,0,-D],[1/K,0,0],[0,0,1/K],400,Math.max(0,(Math.min(z0,40)+D)*K),C.wall,1e6+3,0.7);return out;}
 if(env==="street")for(let i=0;i<18;i++)thing("b"+i,"building",(i-9)*11,-D-rnd(i)*8,10+rnd(i+3)*18,0.8);
 if(env==="forest")for(let i=0;i<40;i++)thing("t"+i,"tree",(rnd(i)-0.5)*120,-D-rnd(i+7)*25,5+rnd(i+11)*5,0.8);
 if(env==="beach"){const zs=-Math.max(30,D*0.1);sheet("sea",[-1500,0.01,-3000],[1,0,0],[0,0,1],3000,3000+zs,C.sea,1e6+1);}
 if(env==="desert")for(let i=0;i<14;i++){const h=10+rnd(i+2)*14,b=facing([(i-7)*90,h/2,-D-rnd(i)*80],140,h);
  if(b)out.push({key:"d"+i,depth:b.depth,tiles:b.tiles,fill:{color:C.clay},opacity:0.22,round:true});}
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
 if(v){const c=toScreen(v,focusWorld(v));if(c)proj.center=[c[0]/w,c[1]/h];
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
  ...sprites.flatMap((s):Layer[]=>s.faces
   ?s.faces.map(f=>({key:"p"+s.i+f.key,depth:s.depth,tiles:f.tiles,fill:{color:shade(sel===s.i?C.selected:tints[s.i]??C.clay,f.shade)},blur:s.blur,prop:s.i}))
   :[{key:"p"+s.i,depth:s.depth,tiles:s.tiles,fill:{src:s.src},blur:s.blur,tint:tints[s.i]||sel===s.i?"url(#fc-t"+s.i+")":undefined,prop:s.i}])]
  .sort((a,b)=>b.depth-a.depth);
 // The ground's grid, in front of the camera only: it shows the lens's perspective (a wide lens close up runs it steeply to the horizon), each band of it
 // blurred by the lens at its distance. The sky and the far ground are at the horizon's distance (as blurred as the lens makes infinity).
 const bands=gridBands(v),inf=blurPx(v,1e5),hp=horizonPaths(v);
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
 const handlers=(i:number)=>({onPointerDown:down(i),onPointerMove:move(i),onPointerUp:up(i),onPointerCancel:()=>{grab.current=null;setMoving(null);}});
 /** One piece: placed by its projective map, filled with the colour or with its part of the image. */
 const piece=(l:Layer,t:Tile,k:number)=>{
  const fill:CSSProperties="color" in l.fill?{background:l.fill.color,...(l.prop!==undefined?{boxShadow:"inset 0 0 0 1px "+C.edge}:{})}
   :{backgroundImage:"url("+l.fill.src+")",backgroundSize:t.bw+"px "+t.bh+"px",backgroundPosition:(-t.bx)+"px "+(-t.by)+"px",backgroundRepeat:"no-repeat"};
  const live=l.prop!==undefined&&editable;
  return <div key={k} aria-hidden="true" style={{position:"absolute",left:0,top:0,width:t.w,height:t.h,transformOrigin:"0 0",transform:t.transform,...fill,
   ...(l.round&&l.tiles.length===1?{borderRadius:"50% 50% 0 0 / 100% 100% 0 0"}:{}),pointerEvents:live?"auto":"none",cursor:live?(moving?.i===l.prop?"grabbing":"grab"):undefined}}
   {...(live?handlers(l.prop!):{})}/>;};
 /** A thing as a group of pieces: the group carries its haze, blur and tint, so the pieces join seamlessly. */
 const group=(l:Layer)=><div key={l.key} className="pointer-events-none absolute inset-0"
  style={{opacity:l.opacity,filter:[l.tint??"",blurOf(l.blur??0)].filter(Boolean).join(" ")||undefined}}>{l.tiles.map((t,k)=>piece(l,t,k))}</div>;
 return <div ref={root} className="absolute inset-0 overflow-hidden" style={{background:C.sky,touchAction:"none"}}>
  <svg aria-hidden="true" width={0} height={0} className="absolute">
   <defs>{base.map((_,i)=>(tints[i]||sel===i)&&<filter key={i} id={"fc-t"+i} colorInterpolationFilters="sRGB">
    <feFlood style={{floodColor:sel===i?"var(--color-primary)":tints[i]}}/><feComposite in2="SourceAlpha" operator="in"/><feBlend in2="SourceGraphic" mode="multiply"/></filter>)}</defs>
  </svg>
  {/* The sky down to the horizon (lighter toward it) and the ground below it, as curves through the lens, blurred as much as infinity. */}
  <svg aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-visible" width={w} height={h} style={{filter:blurOf(inf)||undefined}}>
   <defs><linearGradient id="fc-band" gradientUnits="userSpaceOnUse" x1={hp.bandTop[0]} y1={hp.bandTop[1]} x2={hp.bandBottom[0]} y2={hp.bandBottom[1]}>
    <stop offset="0" stopColor={C.sky}/><stop offset="1" stopColor={C.horizon}/></linearGradient></defs>
   <path d={hp.band} fill="url(#fc-band)"/><path d={hp.ground} fill={C.ground}/>
  </svg>
  <svg aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-visible" width={w} height={h}>
   <defs>{bands.map((b,k)=>b.blur>0.4&&<filter key={k} id={"fc-g"+k} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation={b.blur.toFixed(2)}/></filter>)}</defs>
   {bands.map((b,k)=><g key={k} filter={b.blur>0.4?"url(#fc-g"+k+")":undefined} stroke={C.grid} strokeWidth={1} strokeOpacity={1-b.fade*0.8} fill="none">
    {b.lines.map((l,j)=><polyline key={j} points={l.map(p=>p[0].toFixed(1)+","+p[1].toFixed(1)).join(" ")}/>)}</g>)}
  </svg>
  {/* The far place first (the mountains...), then the haze along the horizon over their bases and the far ground, then everything nearer. */}
  {layers.filter(l=>l.depth>=HAZE_DEPTH).map(l=>group(l))}
  <svg aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-visible" width={w} height={h} style={{filter:blurOf(inf)||undefined}}>
   <defs>
    <linearGradient id="fc-hu" gradientUnits="userSpaceOnUse" x1={hp.hazeUp[1][0]} y1={hp.hazeUp[1][1]} x2={hp.hazeUp[2][0]} y2={hp.hazeUp[2][1]}>
     <stop offset="0" stopColor={C.horizon} stopOpacity="0"/><stop offset="1" stopColor={C.haze}/></linearGradient>
    <linearGradient id="fc-hd" gradientUnits="userSpaceOnUse" x1={hp.hazeDown[1][0]} y1={hp.hazeDown[1][1]} x2={hp.hazeDown[2][0]} y2={hp.hazeDown[2][1]}>
     <stop offset="0" stopColor={C.haze}/><stop offset="1" stopColor={C.ground} stopOpacity="0"/></linearGradient>
   </defs>
   <path d={hp.hazeUp[0]} fill="url(#fc-hu)"/><path d={hp.hazeDown[0]} fill="url(#fc-hd)"/>
  </svg>
  {layers.filter(l=>l.depth<HAZE_DEPTH).map(l=>group(l))}
 </div>;
}
/** Things farther than this (metres) sit behind the horizon's haze: the mountains, the far rows of the place. */
const HAZE_DEPTH=150;
