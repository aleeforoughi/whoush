/**
 * A product (any object, vehicle, building or tree) as a smooth clay box in the pack's style, drawn in vector so it takes the thing's exact size:
 * rounded edges, a lit top, a shaded side, a soft gradient down the front and a soft shadow under it. Used by «بوم»'s camera and lighting diagrams.
 */
import {useId} from "react";
import {SCENE_COLORS} from "@/lib/scene3d";
import {shade} from "@/lib/frame-css";

type Pt=[number,number];
/** A closed outline through `pts` with each corner rounded by up to `r` (never more than half of either neighbouring edge). */
function rounded(pts:Pt[],r:number):string{
 const n=pts.length,len=(a:Pt,b:Pt)=>Math.hypot(b[0]-a[0],b[1]-a[1]),toward=(a:Pt,b:Pt,d:number):Pt=>{const l=len(a,b)||1;return [a[0]+(b[0]-a[0])*d/l,a[1]+(b[1]-a[1])*d/l];};
 let d="";
 for(let i=0;i<n;i++){
  const p=pts[i],prev=pts[(i+n-1)%n],next=pts[(i+1)%n],k=Math.min(r,len(prev,p)/2,len(p,next)/2);
  const a=toward(p,prev,k),b=toward(p,next,k),f=(q:Pt)=>q[0].toFixed(2)+" "+q[1].toFixed(2);
  d+=(i===0?"M":"L")+f(a)+"Q"+f(p)+" "+f(b);
 }
 return d+"Z";
}
/**
 * The box from the side (a little from above and to the right, like the pack's pictures): its bottom centre at (x, y), `h` tall on screen, as wide as
 * `box` says against its height, with its depth showing on the top and the right side.
 */
export function ClayBox({x,y,h,box,tint}:{x:number;y:number;h:number;box:{w:number;h:number;d:number};/** A tint filter's id. */tint?:string}){
 const id=useId().replace(/:/g,""),C=SCENE_COLORS.clay;
 const W=h*box.w/box.h,dd=Math.min(h*0.4,W*0.45,Math.max(h*0.06,h*box.d/box.h*0.35)),up=dd*0.6,l=x-W/2,r=x+W/2,t=y-h;
 const R=Math.min(W,h,dd*2)*0.16;
 const outline:Pt[]=[[l,y],[l,t],[l+dd,t-up],[r+dd,t-up],[r+dd,y-up],[r,y]];
 const top:Pt[]=[[l,t],[l+dd,t-up],[r+dd,t-up],[r,t]],side:Pt[]=[[r,t],[r+dd,t-up],[r+dd,y-up],[r,y]];
 const poly=(p:Pt[])=>"M"+p.map(q=>q[0].toFixed(2)+" "+q[1].toFixed(2)).join("L")+"Z";
 return <g filter={tint?"url(#"+tint+")":undefined}>
  <defs>
   <clipPath id={id+"c"}><path d={rounded(outline,R)}/></clipPath>
   <linearGradient id={id+"f"} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={shade(C,0.96)}/><stop offset="1" stopColor={shade(C,0.8)}/></linearGradient>
   <linearGradient id={id+"t"} x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor={shade(C,1.04)}/><stop offset="1" stopColor={shade(C,0.97)}/></linearGradient>
   <linearGradient id={id+"s"} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor={shade(C,0.76)}/><stop offset="1" stopColor={shade(C,0.62)}/></linearGradient>
   <radialGradient id={id+"g"}><stop offset="0" stopColor={SCENE_COLORS.black} stopOpacity="0.35"/><stop offset="1" stopColor={SCENE_COLORS.black} stopOpacity="0"/></radialGradient>
  </defs>
  {/* A soft shadow on the ground under it. */}
  <ellipse cx={x+dd/2} cy={y-up/2} rx={W/2+dd*0.8} ry={Math.max(1.5,up*0.9+h*0.04)} fill={"url(#"+id+"g)"}/>
  <g clipPath={"url(#"+id+"c)"}>
   <rect x={l-1} y={t-up-1} width={W+dd+2} height={h+up+2} fill={"url(#"+id+"f)"}/>
   <path d={poly(top)} fill={"url(#"+id+"t)"}/>
   <path d={poly(side)} fill={"url(#"+id+"s)"}/>
   {/* The rounded edges catch the light: a soft highlight along the front's top edge and its right edge. */}
   <path d={"M"+l+" "+t+"L"+r+" "+t} stroke={shade(C,1.12)} strokeOpacity={0.7} strokeWidth={Math.max(0.6,R*0.7)} strokeLinecap="round"/>
   <path d={"M"+r+" "+t+"L"+r+" "+y} stroke={shade(C,0.98)} strokeOpacity={0.45} strokeWidth={Math.max(0.5,R*0.55)} strokeLinecap="round"/>
  </g>
 </g>;
}
/** The box from above (its footprint, width across and depth down), centred at (cx, cy), `size` across its longer side, turned `rotate` degrees. */
export function ClayFootprint({cx,cy,size,box,rotate=0,tint}:{cx:number;cy:number;size:number;box:{w:number;d:number};rotate?:number;tint?:string}){
 const id=useId().replace(/:/g,""),C=SCENE_COLORS.clay,k=size/Math.max(box.w,box.d),w=box.w*k,d=box.d*k;
 return <g transform={"rotate("+rotate+" "+cx+" "+cy+")"} filter={tint?"url(#"+tint+")":undefined}>
  <defs><radialGradient id={id+"r"} cx="0.4" cy="0.35" r="0.8"><stop offset="0" stopColor={shade(C,1.04)}/><stop offset="1" stopColor={shade(C,0.8)}/></radialGradient></defs>
  <rect x={cx-w/2} y={cy-d/2} width={w} height={d} rx={Math.min(w,d)*0.16} fill={"url(#"+id+"r)"} stroke={SCENE_COLORS.edge}/>
 </g>;
}
