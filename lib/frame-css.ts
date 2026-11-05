/**
 * «بوم»'s frame in CSS 3D (Plan A): one pinhole camera, the same as the prompt's and the 3D view's (lib/scene3d.ts, camera3D), drawn with CSS perspective.
 * The lens is the perspective distance (a 15 mm lens close up stretches depth, an 85 mm far back flattens it), the height angle tilts the ground plane,
 * the aperture is a blur by each thing's distance from the focus, and every prop is the pack's image for the height stop and side the camera sees it
 * from (lib/sprites.ts). Pure maths: safe on the server and in tests; components/frame-css.tsx only draws what this computes.
 *
 * Camera space: x right, y up, depth forward (in front is positive). A CSS element placed at (x·s, −y·s, D − depth·s) around the perspective origin is
 * projected by the browser exactly where the camera sees that point, for any s; s = D / (the aim point's depth) keeps the aim point on the screen plane.
 */
import type {Staging} from "./creative-plan";
import {camera3D,propSize,propWorld,stageFromWorld,wideFrameRect,type Camera3D,type FrameRect} from "./scene3d";
import {VERTICAL_STOPS,facingOf,frameSize,verticalIndex,wrap180,type SceneProp,type VerticalStop} from "./staging";
import {familyOf,spanM,spriteFor,type SpriteSide} from "./sprites";
import {VISUALS} from "./visual-assets";

export type V3=[number,number,number];
const sub=(a:V3,b:V3):V3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],add=(a:V3,b:V3):V3=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],mul=(a:V3,k:number):V3=>[a[0]*k,a[1]*k,a[2]*k];
const dot=(a:V3,b:V3)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],cross=(a:V3,b:V3):V3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=(a:V3):V3=>{const l=Math.hypot(...a)||1;return [a[0]/l,a[1]/l,a[2]/l];};

export type CssView={cam:Camera3D;
 /** Where the camera really is (it may be below the ground for a worm's-eye angle): the angle each thing is seen from is measured from here. */eye:V3;
 /** The camera's place (kept above the ground) and its right, up and forward directions. */pos:V3;r:V3;u:V3;f:V3;
 /** The view's size, px. */w:number;h:number;
 /** The focal length in px: the CSS perspective distance. */D:number;
 /** Where the optical axis meets the view, px, before the roll (the crop shifts it in the frame; the wide view keeps it centred and moves the frame). */pp:[number,number];
 /** The Dutch roll, degrees clockwise about the view's centre. */roll:number;
 /** The scale that keeps the aim point on the screen plane (px per metre there). */s:number;
 /** The frame inside a wide view, as fractions of it. */frame?:FrameRect;
 /** The frame's height in px and the sensor side it shows, mm (for the blur). */frameH:number;sensorV:number};

/** The camera for a frame (or a wide view around it) of w×h px. A worm's-eye camera below the ground is lifted onto it along its sight line (same aim). */
export function cssView(s:Staging,anchor:Staging|undefined,aspect:string,w:number,h:number,wide=false):CssView{
 const cam=camera3D(s,anchor,aspect),t=cam.target as V3;
 let pos=cam.position as V3;
 const MIN_Y=0.05;
 if(pos[1]<MIN_Y&&t[1]>MIN_Y){const k=(MIN_Y-pos[1])/(t[1]-pos[1]);pos=add(pos,mul(sub(t,pos),k));}
 const f=norm(sub(t,pos));let r=cross(f,[0,1,0]);r=Math.hypot(...r)<1e-6?[1,0,0]:norm(r);const u=cross(r,f);
 const {W,H}=frameSize(aspect),frame=wide?wideFrameRect(cam,W/H,w,h):undefined,frameH=frame?frame.h*h:h;
 const D=(frameH/2)/Math.tan(cam.fov*Math.PI/360);
 const pp:[number,number]=frame?[w/2,h/2]:[w/2-cam.shift[0]*w,h/2-cam.shift[1]*h];
 const depthT=Math.max(0.05,dot(sub(t,pos),f));
 return {cam,eye:cam.position as V3,pos,r,u,f,w,h,D,pp,roll:cam.roll*180/Math.PI,s:D/depthT,frame,frameH,sensorV:H>W?36:24};
}
/** A world point in camera space: [right, up, depth]. */
export const toCam=(v:CssView,p:V3):V3=>{const d=sub(p,v.pos);return [dot(d,v.r),dot(d,v.u),dot(d,v.f)];};
const rot=(v:CssView,x:number,y:number,dir=1):[number,number]=>{const a=dir*v.roll*Math.PI/180,c=Math.cos(a),n=Math.sin(a),cx=v.w/2,cy=v.h/2;return [cx+(x-cx)*c-(y-cy)*n,cy+(x-cx)*n+(y-cy)*c];};
/** Where a world point lands in the view, px (undefined behind the camera). */
export function toScreen(v:CssView,p:V3):[number,number]|undefined{
 const c=toCam(v,p);if(c[2]<0.02)return undefined;
 return rot(v,v.pp[0]+v.D*c[0]/c[2],v.pp[1]-v.D*c[1]/c[2]);
}
/** The world point on the horizontal plane at height `lift` under a view point (px), or undefined when that ray never meets it in front. */
export function groundAt(v:CssView,sx:number,sy:number,lift=0):V3|undefined{
 const [x,y]=rot(v,sx,sy,-1),dir=add(v.f,add(mul(v.r,(x-v.pp[0])/v.D),mul(v.u,-(y-v.pp[1])/v.D)));
 if(Math.abs(dir[1])<1e-9)return undefined;const k=(lift-v.pos[1])/dir[1];
 return k>0?add(v.pos,mul(dir,k)):undefined;
}
/** The ground's horizon line in the view, px (y before the roll), and whether the camera looks up at it (the sky fills the rest). */
export function horizonY(v:CssView):number{const c=[dot([0,0,-1],v.r),dot([0,0,-1],v.u),dot([0,0,-1],v.f)];return c[2]<=1e-6?-1e6:v.pp[1]-v.D*c[1]/c[2];}
const n3=(x:number)=>Number.isFinite(x)?Math.round(x*1e4)/1e4:0;
/** A CSS transform placing an element's local origin at a world point, at `scale` metres per local px (a billboard: it faces the camera). */
export function billboard(v:CssView,p:V3,mpp:number,mirror=false,minDepth=0.3):{transform:string;depth:number;px:number;at:"centre"|"look"}|undefined{
 const c=toCam(v,p);if(c[2]<minDepth)return undefined;
 const k=mpp*v.s;
 return {transform:"translate3d("+n3(c[0]*v.s)+"px,"+n3(-c[1]*v.s)+"px,"+n3(v.D-c[2]*v.s)+"px) scale("+n3(mirror?-k:k)+","+n3(k)+")",depth:c[2],px:mpp*v.D/c[2],at:minDepth===0.3?"centre":"look"};
}
/** A CSS matrix3d for a flat plane: local px (x, y) maps to the world point o + x·ex + y·ey (metres). */
export function plane(v:CssView,o:V3,ex:V3,ey:V3):string{
 const lin=(e:V3):V3=>[dot(e,v.r)*v.s,-dot(e,v.u)*v.s,-dot(e,v.f)*v.s];
 const c=toCam(v,o),A:V3=[c[0]*v.s,-c[1]*v.s,v.D-c[2]*v.s],a=lin(ex),b=lin(ey),nz=norm(cross(a,b));
 return "matrix3d("+[...a,0,...b,0,...nz,0,...A,1].map(n3).join(",")+")";
}
/** How far toward the camera a wall or floor may come at height y and stay in front of it (world z), so no plane passes behind the eye. */
export function nearZ(v:CssView,y:number,margin=0.3):number{
 const f2=v.f[2];if(f2>-1e-3)return v.pos[2]+300;
 return Math.min(v.pos[2]+300,v.pos[2]+(margin-(y-v.pos[1])*v.f[1])/f2);
}
/**
 * Depth-of-field blur at a distance (metres from the camera), px on screen: the thin-lens circle of confusion f²/(N(S−f))·|x−S|/x on the sensor side the
 * frame shows, at the frame's height, capped as the 2D frame does.
 */
export function blurPx(v:CssView,dist:number):number{
 const f=v.cam.focalMm,N=v.cam.aperture,S=Math.max(f*1.01,v.cam.focusDistance*1000),x=Math.max(f*1.01,dist*1000);
 const coc=(f*f)/(N*(S-f))*Math.abs(x-S)/x;
 return Math.min(0.08,coc/v.sensorV)*v.frameH;
}
/** The height stop and apparent facing the camera sees a thing from, at its centre: a prop far back is seen flatter than the one the camera looks down at. */
export function viewOf(v:CssView,centre:V3,facing:number):{stop:VerticalStop;apparent:number;elevation:number}{
 const d=sub(v.eye,centre),el=Math.atan2(d[1],Math.hypot(d[0],d[2]))*180/Math.PI,bearing=Math.atan2(d[0],d[2])*180/Math.PI;
 return {stop:VERTICAL_STOPS[verticalIndex(el)].id,apparent:wrap180(facing-bearing),elevation:el};
}
export type PropSprite={i:number;id:string;src:string;w:number;h:number;transform:string;depth:number;
 /** The blur, px in the image's own pixels (CSS blurs before projecting). */blur:number;side:SpriteSide;stop:VerticalStop;
 /** The ground point under it (its lift included) and a point just above it, world. */ground:V3;top:V3};
/**
 * A thing standing at `ground` (world, its lift included), `h` metres tall, turned `facing`: the pack's image for the height and side the camera sees it
 * from, centred on its middle at its real size, blurred by the lens.
 */
export function thingSprite(v:CssView,p:Pick<SceneProp,"kind"|"label">,ground:V3,h:number,facing:number,/** Where on it the angle is measured, as a share of its height. */look=0.5){
 const centre:V3=[ground[0],ground[1]+h/2,ground[2]];
 const view=viewOf(v,[ground[0],ground[1]+h*look,ground[2]],facing),sp=spriteFor(p,view.stop,view.apparent),a=VISUALS[sp.id];if(!a)return undefined;
 const fam=familyOf(p),stopDeg=VERTICAL_STOPS.find(x=>x.id===sp.height)!.deg;
 // The image's height in metres: the thing's height foreshortened plus its depth seen from above or below, at its real size.
 const mpp=spanM(fam,stopDeg,sp.side)*(h/spanM(fam,0,"front"))/a.height;
 // Placed by its middle; a camera so close that its middle is beside or behind the lens (a worm's-eye close-up) places it by the point it looks at.
 const lookAt:V3=[ground[0],ground[1]+h*look,ground[2]],b=billboard(v,centre,mpp,sp.mirror)??billboard(v,lookAt,mpp,sp.mirror,0.05);if(!b)return undefined;
 const yShare=b.at==="centre"?50:Math.round((1-look)*100);
 return {id:sp.id,src:a.src,w:a.width,h:a.height,transform:b.transform+" translate(-50%,-"+yShare+"%)",depth:b.depth,blur:blurPx(v,b.depth)/b.px,side:sp.side,stop:sp.height};
}
/**
 * Each prop as the camera sees it (lib/scene3d.ts places and sizes it). The angle is measured where the camera aims (the face of a person by default), so
 * the main subject shows exactly the height stop chosen even up close, where its feet are seen from above and its face from below; props of the same kind
 * are measured at the same share of their height, others at their middle.
 */
export function propSprites(v:CssView,props:readonly SceneProp[],s:Staging,anchor?:Staging):PropSprite[]{
 const m=(anchor??s).props?.find(p=>p.main)??props.find(p=>p.main)??props[0];
 const aim=m?Math.max(0,Math.min(1,(v.cam.target[1]-propWorld(m,s,anchor).pos[1])/propSize(m).h)):0.5;
 return props.flatMap((p,i)=>{
  const g=propWorld(p,s,anchor).pos as V3,size=propSize(p),t=thingSprite(v,p,g,size.h,facingOf(p),m&&p.kind===m.kind?aim:0.5);
  return t?[{i,...t,ground:g,top:[g[0],g[1]+size.h*1.05,g[2]] as V3}]:[];
 });
}
/** A view point back to the stage: the ground point (at the prop's lift) under it, in stage units. */
export function stageAt(v:CssView,sx:number,sy:number,lift:number,s:Staging,anchor?:Staging):{x:number;z:number}|undefined{
 const g=groundAt(v,sx,sy,lift);return g?stageFromWorld(g[0],g[2],s,anchor):undefined;
}
/**
 * The ground's grid in perspective, as straight lines on screen (a straight line stays straight through a pinhole, so its two ends are enough): every
 * `step` metres out to `reach`, only in front of the camera. Crisp at any distance; a wide lens close up runs it steeply to the horizon.
 */
export function gridLines(v:CssView,step=1,reach=50):{x1:number;y1:number;x2:number;y2:number;far:number}[]{
 const zN=nearZ(v,0),cx=Math.round(v.pos[0]/step)*step,out:{x1:number;y1:number;x2:number;y2:number;far:number}[]=[];
 const seg=(a:V3,b:V3)=>{const p=toScreenRaw(v,a),q=toScreenRaw(v,b);if(p&&q)out.push({x1:p[0],y1:p[1],x2:q[0],y2:q[1],far:Math.min(1,Math.max(toCam(v,a)[2],toCam(v,b)[2])/reach)});};
 const zFar=zN-reach*2;
 for(let x=cx-reach;x<=cx+reach;x+=step)seg([x,0,zN],[x,0,zFar]);
 for(let z=Math.floor(zN/step)*step;z>=zFar;z-=step)seg([cx-reach,0,z],[cx+reach,0,z]);
 return out;
}
/** Where a world point lands before the roll (for drawing inside the rolled layer). */
function toScreenRaw(v:CssView,p:V3):[number,number]|undefined{const c=toCam(v,p);if(c[2]<0.02)return undefined;return [v.pp[0]+v.D*c[0]/c[2],v.pp[1]-v.D*c[1]/c[2]];}
