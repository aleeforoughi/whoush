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
import {camera3D,closeShare,propSize,propWorld,stageFromWorld,wideFrameRect,worldOrigin,type Camera3D,type FrameRect} from "./scene3d";
import {PROP_X_RANGE,PROP_Z_RANGE} from "./creative-plan";
import {DETAIL_HEIGHT,METERS_PER_Z,elevationOf,VERTICAL_STOPS,cubeDims,facingOf,frameSize,isCharacter,isCube,nearestShot,scaleFromSlider,scaleOf,sliderFromScale,supportOf,verticalIndex,wrap180,type SceneProp,type VerticalStop} from "./staging";
import {sizeOf,spanM,spriteFor,widthM,familyOf,type SpriteSide} from "./sprites";
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
 /** The fisheye's centre and reach (px): the frame's centre and half diagonal (in the wide view, the crop's), so the crop bulges as the photo will. */fc:[number,number];fR:number;
 /** The scale that keeps the aim point on the screen plane (px per metre there). */s:number;
 /** The frame inside a wide view, as fractions of it. */frame?:FrameRect;
 /** The frame's height in px and the sensor side it shows, mm (for the blur). */frameH:number;sensorV:number;
 /** Barrel distortion of an ultra-wide lens (0 none): the picture bulges from the centre and straight lines bow (fisheye, under 15 mm). */fish:number};

/** The camera for a frame (or a wide view around it) of w×h px. A worm's-eye camera below the ground is lifted onto it along its sight line (same aim). */
export function cssView(s:Staging,anchor:Staging|undefined,aspect:string,w:number,h:number,wide=false,/** The wide view: how much of its height the frame takes (wideFrameRect). */fill?:number):CssView{
 const cam=camera3D(s,anchor,aspect),t=cam.target as V3;
 let pos=cam.position as V3;
 const MIN_Y=0.05;
 if(pos[1]<MIN_Y&&t[1]>MIN_Y){const k=(MIN_Y-pos[1])/(t[1]-pos[1]);pos=add(pos,mul(sub(t,pos),k));}
 const f=norm(sub(t,pos));let r=cross(f,[0,1,0]);r=Math.hypot(...r)<1e-6?[1,0,0]:norm(r);const u=cross(r,f);
 const {W,H}=frameSize(aspect),frame=wide?wideFrameRect(cam,W/H,w,h,fill):undefined,frameH=frame?frame.h*h:h;
 const D=(frameH/2)/Math.tan(cam.fov*Math.PI/360);
 const pp:[number,number]=frame?[w/2,h/2]:[w/2-cam.shift[0]*w,h/2-cam.shift[1]*h];
 const depthT=Math.max(0.05,dot(sub(t,pos),f));
 const fc:[number,number]=frame?[frame.x*w,frame.y*h]:[w/2,h/2],fR=frame?Math.hypot(frame.w*w,frame.h*h)/2:Math.hypot(w,h)/2;
 return {cam,eye:cam.position as V3,pos,r,u,f,w,h,D,pp,roll:cam.roll*180/Math.PI,s:D/depthT,frame,frameH,sensorV:H>W?36:24,fish:cam.fisheye*0.6,fc,fR};
}
/** A world point in camera space: [right, up, depth]. */
export const toCam=(v:CssView,p:V3):V3=>{const d=sub(p,v.pos);return [dot(d,v.r),dot(d,v.u),dot(d,v.f)];};
const rot=(v:CssView,x:number,y:number,dir=1):[number,number]=>{const a=dir*v.roll*Math.PI/180,c=Math.cos(a),n=Math.sin(a),cx=v.w/2,cy=v.h/2;return [cx+(x-cx)*c-(y-cy)*n,cy+(x-cx)*n+(y-cy)*c];};
/** Where a world point lands in the view, px (undefined behind the camera), through the fisheye when the lens has one. */
export function toScreen(v:CssView,p:V3):[number,number]|undefined{
 const c=toCam(v,p);if(c[2]<0.02)return undefined;
 const [x,y]=rot(v,v.pp[0]+v.D*c[0]/c[2],v.pp[1]-v.D*c[1]/c[2]);return fish(v,x,y);
}
// ---- the fisheye: the picture bulges from the frame's centre and straight lines bow; the corners stay at the corners ----
/** The radius a point of the distorted picture shows from the straight one (both as shares of the half diagonal): r(1 + k r²)/(1 + k). */
const sourceR=(k:number,r:number)=>r*(1+k*r*r)/(1+k);
/** A point of the distorted picture back to the straight picture (for pointers and the SVG displacement map). */
export function unfish(v:CssView,x:number,y:number):[number,number]{
 if(!v.fish)return [x,y];
 const [cx,cy]=v.fc,R=v.fR,dx=(x-cx)/R,dy=(y-cy)/R,r=Math.hypot(dx,dy);if(r<1e-9)return [x,y];
 const q=sourceR(v.fish,r)/r;return [cx+dx*q*R,cy+dy*q*R];
}
/** A point of the straight picture to where the fisheye shows it (the inverse, by Newton's method). */
export function fish(v:CssView,x:number,y:number):[number,number]{
 if(!v.fish)return [x,y];
 const [cx,cy]=v.fc,R=v.fR,dx=(x-cx)/R,dy=(y-cy)/R,rs=Math.hypot(dx,dy);if(rs<1e-9)return [x,y];
 const k=v.fish;let r=rs;for(let i=0;i<8;i++){const g=sourceR(k,r)-rs,dg=(1+3*k*r*r)/(1+k);r-=g/dg;}
 return [cx+dx/rs*r*R,cy+dy/rs*r*R];
}
/** The world point on the horizontal plane at height `lift` under a view point (px), or undefined when that ray never meets it in front. */
export function groundAt(v:CssView,sx0:number,sy0:number,lift=0):V3|undefined{
 const [sx,sy]=unfish(v,sx0,sy0),[x,y]=rot(v,sx,sy,-1),dir=add(v.f,add(mul(v.r,(x-v.pp[0])/v.D),mul(v.u,-(y-v.pp[1])/v.D)));
 if(Math.abs(dir[1])<1e-9)return undefined;const k=(lift-v.pos[1])/dir[1];
 return k>0?add(v.pos,mul(dir,k)):undefined;
}
/** The ground's horizon line in the view, px (y before the roll), and whether the camera looks up at it (the sky fills the rest). */
export function horizonY(v:CssView):number{const c=[dot([0,0,-1],v.r),dot([0,0,-1],v.u),dot([0,0,-1],v.f)];return c[2]<=1e-6?-1e6:v.pp[1]-v.D*c[1]/c[2];}
const n3=(x:number)=>Number.isFinite(x)?Math.round(x*1e4)/1e4:0;
/** A CSS transform placing an element's local origin at a world point, at `scale` metres per local px (a billboard: it faces the camera). */
export function billboard(v:CssView,p:V3,mpp:number,mirror=false,minDepth=0.3,/** Stretches it sideways (a cube made as wide as the object it stands for). */sx=1):{transform:string;depth:number;px:number}|undefined{
 const c=toCam(v,p);if(c[2]<minDepth)return undefined;
 const k=mpp*v.s;
 return {transform:"translate3d("+n3(c[0]*v.s)+"px,"+n3(-c[1]*v.s)+"px,"+n3(v.D-c[2]*v.s)+"px) scale("+n3(k*sx*(mirror?-1:1))+","+n3(k)+")",depth:c[2],px:mpp*v.D/c[2]};
}
/**
 * A picture standing for a character, placed by where the camera sees two of its real points, so it never floats, sinks or jumps at any lens,
 * distance or height. Its point (ax, ay) (shares of its width and height: the face, or a pet's middle) sits exactly where `A` is seen; it hangs toward
 * where the camera sees its ground point `G` (or toward where that line leaves the view, when `G` is beside or behind the lens); and it is scaled
 * uniformly: its bottom exactly on `G` while that is in view, its head at its real size (`mppHead`, metres per pixel at A's distance; a pet: its body,
 * `mppBody`) once `G` is well out of view, easing between, and never so short that its bottom ends inside the view, where the feet would float. It lies
 * on a plane parallel to the lens at A's distance, so no part of it reaches beside or behind the lens. Undefined when `A` is not in front of it.
 */
export function anchoredStandee(v:CssView,A:V3,G:V3,wpx:number,hpx:number,ax:number,ay:number,mirror:boolean,mppHead:number|undefined,mppBody:number):{o:V3;ex:V3;ey:V3;depth:number;quad:V3[];feetInView:boolean}|undefined{
 const zA=toCam(v,A)[2];if(!(zA>0.05)||!(ay<1))return undefined;
 const a=toScreen(v,A);if(!a)return undefined;
 const zG=toCam(v,G)[2],NEAR=0.06;
 // Where the body is seen to run: to the ground point, or to where its line comes within a few centimetres of the lens.
 const P=zG>NEAR?G:add(A,mul(sub(G,A),(zA-NEAR)/(zA-zG))),pp=toScreen(v,P);
 let u:[number,number]=[0,1],L=Infinity;
 if(pp){const dx=pp[0]-a[0],dy=pp[1]-a[1],l=Math.hypot(dx,dy);if(l>1e-6){u=[dx/l,dy/l];if(zG>NEAR)L=l;}}
 // How far the ground point is out of view (a share of the view's height; beside or behind the lens: far), and how much the head's size takes over.
 const out=zG>NEAR&&pp?Math.max(0,-pp[0],pp[0]-v.w,-pp[1],pp[1]-v.h)/v.h:Infinity,t=Math.min(1,out/0.5),kh=t*t*(3-2*t);
 const perM=v.D/zA,k2=L/((1-ay)*hpx),kOwn=(mppHead??mppBody)*perM;
 let k=Number.isFinite(k2)?k2+(kOwn-k2)*kh:kOwn;
 // Its bottom never ends inside the view (unless on the ground): at least as long as the way out along its line.
 if(kh>0){let exit=Infinity;for(const [c,lo,hi] of [[0,0,v.w],[1,0,v.h]] as const){const d=u[c];if(Math.abs(d)<1e-9)continue;const tt=((d>0?hi:lo)-a[c])/d;if(tt>0)exit=Math.min(exit,tt);}
  if(Number.isFinite(exit))k=Math.max(k,Math.min(Number.isFinite(k2)?k2:Infinity,exit*1.02/((1-ay)*hpx)));}
 // The picture on screen: its down along the body's line, its right square to it (mirrored: flipped), turned and scaled about the anchor.
 const right:[number,number]=[-u[1]*(mirror?-1:1),u[0]*(mirror?-1:1)];
 const at=(x:number,y:number):[number,number]=>{const X=k*(x-ax*wpx),Y=k*(y-ay*hpx);return [a[0]+right[0]*X+u[0]*Y,a[1]+right[1]*X+u[1]*Y];};
 // …placed in the world at A's distance (where the lens sees exactly that).
 const world=(q:[number,number]):V3=>add(v.pos,mul(rayAt(v,q[0],q[1]),zA));
 const o=world(at(0,0)),ex=mul(sub(world(at(wpx,0)),o),1/wpx),ey=mul(sub(world(at(0,hpx)),o),1/hpx);
 const quad=[o,add(o,mul(ex,wpx)),add(add(o,mul(ex,wpx)),mul(ey,hpx)),add(o,mul(ey,hpx))];
 return {o,ex,ey,depth:zA,quad,feetInView:kh===0};
}
/**
 * A picture of a thing as a real plane at `at`: square to the camera's line of sight to it and upright to the world (its up is the world's vertical seen
 * along that line; the camera's own up when it looks almost straight down at it). CSS perspective then draws it as a real rectilinear lens would:
 * stretched toward the frame's edges by a wide lens close up, leaning in when the camera tilts. `above` is the share of the picture above `at`.
 */
export function standee(v:CssView,at:V3,wpx:number,hpx:number,mppX:number,mppY:number,mirror:boolean,above:number,/** The height the picture was drawn from, degrees. */drawnFrom:number,
 /** The picture turned in its own plane, degrees clockwise (an overhead plan view turned to the way the thing faces). */spin=0,
 /** The share of the picture left of `at`. */across=0.5):{o:V3;ex:V3;ey:V3;depth:number;quad:V3[]}|undefined{
 // Square to the line of sight across the ground, tilted by the height the picture shows (not the exact line to the camera): an eye-level picture
 // stands straight up, so a level camera keeps verticals vertical; only a tilted camera makes them lean.
 const ray=sub(at,v.pos),flat=Math.hypot(ray[0],ray[2]),e=drawnFrom*Math.PI/180;
 const n:V3=flat>1e-6?norm([ray[0]/flat*Math.cos(e),-Math.sin(e),ray[2]/flat*Math.cos(e)]):norm(ray),vert=sub([0,1,0],mul(n,n[1])),lv=Math.hypot(...vert);
 // Looking down (or up) steeply, the world's vertical along the line of sight vanishes: blend toward the camera's up.
 const t=Math.min(1,lv/0.35),up=norm(add(mul(lv>1e-6?norm(vert):v.u,t),mul(v.u,1-t)));
 const R=norm(cross(n,up)),U=norm(cross(R,n)),sp=spin*Math.PI/180,c=Math.cos(sp),sn=Math.sin(sp);
 // The picture's own right and down, turned clockwise by `spin` within the plane (mirrored: its right flipped).
 const ex=mul(add(mul(R,c),mul(U,-sn)),(mirror?-1:1)*mppX),ey=mul(add(mul(R,-sn),mul(U,-c)),mppY);
 const o=add(add(at,mul(ex,-wpx*across)),mul(ey,-hpx*above));
 const quad=[o,add(o,mul(ex,wpx)),add(add(o,mul(ex,wpx)),mul(ey,hpx)),add(o,mul(ey,hpx))];
 if(quad.some(q=>toCam(v,q)[2]<0.05))return undefined;
 const depth=toCam(v,at)[2];
 if(!(depth>0.05))return undefined;
 return {o,ex,ey,depth,quad};
}
// ---- drawing a flat thing: an exact projective map from its corners on screen, in tiles under a fisheye ----
/** One piece of a flat thing on screen: a `w`×`h` px element mapped by `transform` (from the view's top-left), showing its picture at `bw`×`bh` px offset by `bx`, `by`. */
export type Tile={transform:string;w:number;h:number;bx:number;by:number;bw:number;bh:number};
const n9=(x:number)=>Number.isFinite(x)?Number(x.toPrecision(9)):0;
/** The projective map of a `tw`×`th` rectangle onto a quad on screen (its corners clockwise from the top-left), as a CSS matrix3d (Heckbert's square-to-quad). */
export function quadMatrix(tw:number,th:number,q:[number,number][]):string|undefined{
 const [[x0,y0],[x1,y1],[x2,y2],[x3,y3]]=q,dx1=x1-x2,dx2=x3-x2,dx3=x0-x1+x2-x3,dy1=y1-y2,dy2=y3-y2,dy3=y0-y1+y2-y3,den=dx1*dy2-dx2*dy1;
 if(Math.abs(den)<1e-12)return undefined;
 const g=(dx3*dy2-dx2*dy3)/den,h=(dx1*dy3-dx3*dy1)/den;
 // The map must stay in front of the eye over the whole rectangle (its homogeneous weight positive at every corner).
 if([1,1+g,1+g+h,1+h].some(wt=>wt<=1e-6))return undefined;
 const a=x1-x0+g*x1,b=x3-x0+h*x3,d=y1-y0+g*y1,e=y3-y0+h*y3;
 return "matrix3d("+[a/tw,d/tw,0,g/tw,b/th,e/th,0,h/th,0,0,1,0,x0,y0,0,1].map(n9).join(",")+")";
}
/**
 * A flat thing in the scene (`wpx`×`hpx` px spanning the plane from `o` along `ex`, `ey`, metres per px) as pieces on screen: one exact projective map,
 * or, through a fisheye, a grid of small ones that follow the bulge. Each piece is sized to the px it covers on screen, so it is drawn as sharp as it is
 * seen at any focal length and any pixel density (no raster filter, nothing stretched). Undefined when it reaches behind the camera.
 */
export function tilesFor(v:CssView,o:V3,ex:V3,ey:V3,wpx:number,hpx:number,split=true):Tile[]|undefined{
 const at=(x:number,y:number)=>toScreen(v,add(add(o,mul(ex,x)),mul(ey,y)));
 const c=[at(0,0),at(wpx,0),at(wpx,hpx),at(0,hpx)];if(c.some(p=>!p))return undefined;
 const len=(p:[number,number],q:[number,number])=>Math.hypot(p[0]-q[0],p[1]-q[1]),[c0,c1,c2,c3]=c as [number,number][];
 const sw=Math.max(len(c0,c1),len(c3,c2),1e-3),sh=Math.max(len(c0,c3),len(c1,c2),1e-3);
 const nx=split&&v.fish>0?Math.min(12,Math.max(1,Math.ceil(sw/70))):1,ny=split&&v.fish>0?Math.min(12,Math.max(1,Math.ceil(sh/70))):1;
 // Neighbouring pieces overlap by under a pixel so no seam shows between them.
 const ox=nx>1?0.7*wpx/sw:0,oy=ny>1?0.7*hpx/sh:0,out:Tile[]=[];
 for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
  const x0=Math.max(0,wpx*i/nx-ox),x1=Math.min(wpx,wpx*(i+1)/nx+ox),y0=Math.max(0,hpx*j/ny-oy),y1=Math.min(hpx,hpx*(j+1)/ny+oy);
  const q=[at(x0,y0),at(x1,y0),at(x1,y1),at(x0,y1)];if(q.some(p=>!p))return undefined;
  const [q0,q1,q2,q3]=q as [number,number][],k=Math.min(4096/Math.max(x1-x0,y1-y0),Math.max(len(q0,q1)/(x1-x0),len(q3,q2)/(x1-x0),len(q0,q3)/(y1-y0),len(q1,q2)/(y1-y0),1e-3));
  const tw=Math.max(1,(x1-x0)*k),th=Math.max(1,(y1-y0)*k),m=quadMatrix(tw,th,q as [number,number][]);if(!m)return undefined;
  out.push({transform:m,w:tw,h:th,bx:x0*k,by:y0*k,bw:wpx*k,bh:hpx*k});
 }
 return out;
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
export type PropSprite={i:number;id:string;src:string;
 /** The image's pieces on screen (empty for a cube, whose faces carry theirs). */tiles:Tile[];depth:number;
 /** Its outline in the world (an image's corners, or each visible face's), for picking what is under a point. */quad?:V3[];quads?:V3[][];
 /** A cube (anything but a character): its faces instead of an image. */faces?:BoxFace[];
 /** The lens's blur, screen px. */blur:number;side:SpriteSide;stop:VerticalStop;
 /** The ground point under it (its lift included) and a point just above it, world. */ground:V3;top:V3};
/**
 * A thing standing at `ground` (world, its lift included), `h` metres tall, turned `facing`: the pack's image for the height and side the camera sees it
 * from, centred on its middle at its real size, blurred by the lens.
 */
export function thingSprite(v:CssView,p:Pick<SceneProp,"kind"|"label">,ground:V3,size:{h:number;len:number;wid:number},facing:number,/** Where on it the angle is measured, as a share of its height. */look=0.5,
 /** How close the shot is, 0 (full length and wider) to 1 (a ۳/۴ shot and closer, lib/scene3d.ts closeShare): a close shot places a person by the face. */close=0,
 /** The height stop to draw it at, when not the one measured (the main subject is drawn at the angle the user chose). */stop?:VerticalStop){
 const h=size.h,centre:V3=[ground[0],ground[1]+h/2,ground[2]];
 const measured=viewOf(v,[ground[0],ground[1]+h*look,ground[2]],facing),view=stop?{...measured,stop}:measured,sp=spriteFor(p,view.stop,view.apparent),a=VISUALS[sp.id];if(!a)return undefined;
 const stopDeg=VERTICAL_STOPS.find(x=>x.id===sp.height)!.deg;
 // The image's height in metres: the thing's height foreshortened plus its depth seen from above or below, at its real size. A cube also takes the
 // object's width (a desk is wide and low, a phone thin and tall), so it is stretched sideways to it.
 // Sized to how tall the thing really looks from where the camera is (not from the height its picture was drawn at), so crossing from one angle's
 // picture to the next never changes its size; an overhead plan view is the thing's footprint, the same size whichever way it faces.
 const mpp=(sp.height==="top"?spanM(size,stopDeg,"front"):spanM(size,view.elevation,sp.side))/a.height,sx=familyOf(p)==="cube"?(widthM(size,sp.side)/a.width)/mpp:1;
 // Placed by its middle; a camera so close that its middle is beside or behind the lens (a worm's-eye close-up) places it by the point it looks at.
 const lookAt:V3=[ground[0],ground[1]+h*look,ground[2]],mppX=mpp*sx;
 // Tilted toward the height the camera sees it from: an image from another height (the pack lacks this one yet) still faces the camera instead of
 // lying foreshortened (an eye-level picture seen from overhead would shrink to a sliver).
 const seenDeg=VERTICAL_STOPS.find(x=>x.id===view.stop)!.deg;
 // A person's pictures differ in how big and where the head is drawn (from below the legs are long and the head small): a close shot places each by its
 // face at the face's real place and size, so the face stays put whichever angle's picture is drawn; a full-length shot places it by its body, so the
 // feet stay on the ground. Between, it blends with the zoom.
 // An overhead plan view (no head to measure) is placed at the head's height up close, where the camera looks down onto the head, not the waist.
 const head=a.head,ref=VISUALS[familyOf(p)+"-front"]?.head,person=Boolean(ref)&&(Boolean(head)||sp.height==="top"),k=person?Math.max(0,Math.min(1,close)):0;
 const faceAt:V3=[ground[0],ground[1]+h*DETAIL_HEIGHT.face,ground[2]],mppHead=head&&ref?(ref.neck-ref.top)*h/((head.neck-head.top)*a.height):mpp;
 // An overhead plan view lies at the head's height at any zoom (from above, the camera looks down onto the head).
 const m2=mpp+(mppHead-mpp)*k,at:V3=person&&sp.height==="top"?faceAt:k?add(centre,mul(sub(faceAt,centre),k)):centre;
 // The picture faces the camera squarely, tilted to the camera's real height (it is drawn as seen from about there): nothing of it is foreshortened or
 // reaches toward the lens, and as the camera rises or sinks it turns smoothly with it, so crossing from one angle's picture to the next never jumps.
 // An overhead plan view lies flat.
 const toCamDir=sub(v.pos,at),realDeg=Math.asin(Math.max(-1,Math.min(1,toCamDir[1]/(Math.hypot(...toCamDir)||1))))*180/Math.PI;
 const tilt=sp.height==="top"?seenDeg:realDeg;
 // An overhead plan view is placed and turned about its head (`pivot`), so the head stays where the camera aims whichever way the person faces.
 const pv=a.pivot;
 // Every other picture is anchored by two points: its face (a person) or its middle (a pet) where the camera sees that point, and its bottom on the
 // ground point as the camera sees it, so it never floats or sinks, at any lens, distance or height. A person up to a ۳/۴ shot keeps the head's real size
 // instead (the face stays put between the angles' pictures; the feet are out of the frame), blending into the two-point scale toward full length.
 if(sp.height!=="top"&&familyOf(p)!=="cube"){
  const anchorAt:V3=head&&ref?faceAt:centre,ax=head?.x??0.5,ay=head?(head.top+head.neck)/2:0.5;
  const st2=anchoredStandee(v,anchorAt,ground,a.width,a.height,ax,ay,sp.mirror,head&&ref?mppHead:undefined,mpp);
  if(st2){const tiles=tilesFor(v,st2.o,st2.ex,st2.ey,a.width,a.height);
   if(tiles){const big=Math.max(...tiles.map(t=>t.bh))>a.height*0.75;
    return {id:sp.id,src:big&&a.hd?a.hd:a.src,tiles,depth:st2.depth,blur:blurPx(v,st2.depth),side:sp.side,stop:sp.height,quad:st2.quad};}}
 }
 const st=standee(v,at,a.width,a.height,mppX*m2/mpp,m2,sp.mirror,pv?pv.y:0.5+((head?(head.top+head.neck)/2:0.5)-0.5)*k,tilt,sp.spin,pv?pv.x:0.5+((head?.x??0.5)-0.5)*k)
  ??standee(v,lookAt,a.width,a.height,mppX,mpp,sp.mirror,1-look,seenDeg,sp.spin);if(!st)return undefined;
 const tiles=tilesFor(v,st.o,st.ex,st.ey,a.width,a.height);if(!tiles)return undefined;
 // Drawn at the px it covers on screen, so the lens's blur (screen px) applies as it is; drawn larger than its 640 px image (a close-up), from its HD version.
 const big=Math.max(...tiles.map(t=>t.bh))>a.height*0.75;
 return {id:sp.id,src:big&&a.hd?a.hd:a.src,tiles,depth:st.depth,blur:blurPx(v,st.depth),side:sp.side,stop:sp.height,quad:st.quad};
}
/**
 * Each prop as the camera sees it (lib/scene3d.ts places and sizes it). The angle is measured where the camera aims (the face of a person by default), so
 * the main subject shows exactly the height stop chosen even up close, where its feet are seen from above and its face from below; props of the same kind
 * are measured at the same share of their height, others at their middle.
 */
export function propSprites(v:CssView,props:readonly SceneProp[],s:Staging,anchor?:Staging):PropSprite[]{
 const m=(anchor??s).props?.find(p=>p.main)??props.find(p=>p.main)??props[0];
 const aim=m?Math.max(0,Math.min(1,(v.cam.target[1]-propWorld(m,s,anchor).pos[1])/propSize(m).h)):0.5;
 // How close the shot is: a ۳/۴ shot and closer places a person by the face, a full-length one by the body (thingSprite).
 const close=closeShare(s);
 // The dominant subject is drawn at the height the user chose: a camera that cannot go lower (a worm's-eye view of a whole figure rests on the ground
 // and looks up less steeply) still shows the worm's-eye picture, so every stop looks different.
 const chosen=VERTICAL_STOPS[verticalIndex(elevationOf(s))].id;
 return props.flatMap((p,i):PropSprite[]=>{
  const g=propWorld(p,s,anchor,props).pos as V3,size=sizeOf(p);
  if(isCube(p)){const b=boxFaces(v,g,cubeDims(p),facingOf(p));if(!b)return [];
   return [{i,id:"box",src:"",tiles:[],depth:supportOf(p,props)?b.depth-0.01:b.depth,blur:(s.pivot?s.pivot.on===i:Boolean(p.main))?0:b.blur,side:"front" as SpriteSide,stop:"eye" as VerticalStop,faces:b.faces,
    quads:b.faces.map(f=>f.quad),ground:g,top:[g[0],g[1]+size.h*1.05,g[2]] as V3}];}
  const t=thingSprite(v,p,g,size,facingOf(p),m&&p.kind===m.kind?aim:0.5,close,p.main?chosen:undefined);
  // Something resting on another (a phone on a desk) is drawn after it.
  const under=supportOf(p,props);
  // The prop the camera focuses on is sharp: its picture is one flat plane through its middle, but the focus sits on it (its face, or where the user
  // placed the point), so it is drawn as sharp as that point.
  const focused=s.pivot?s.pivot.on===i:Boolean(p.main);
  return t?[{i,...t,blur:focused?0:t.blur,depth:under?t.depth-0.01:t.depth,ground:g,top:[g[0],g[1]+size.h*1.05,g[2]] as V3}]:[];
 });
}
/** A view point back to the stage: the ground point (at the prop's lift) under it, in stage units. */
export function stageAt(v:CssView,sx:number,sy:number,lift:number,s:Staging,anchor?:Staging):{x:number;z:number}|undefined{
 const g=groundAt(v,sx,sy,lift);return g?stageFromWorld(g[0],g[2],s,anchor):undefined;
}
/**
 * The ground's grid in perspective, as straight segments on screen (a straight line stays straight through a pinhole, so its two ends are enough): every
 * `step` metres out to `reach`, only in front of the camera, in bands by distance so each band blurs with the lens like everything else at that
 * distance. Crisp at any zoom; a wide lens close up runs it steeply to the horizon.
 */
export function gridBands(v:CssView,step=1,reach=50):{blur:number;fade:number;lines:[number,number][][]}[]{
 const zN=nearZ(v,0),cx=Math.round(v.pos[0]/step)*step,zFar=zN-reach*2;
 // Band edges along the ground (world z), doubling with distance from the camera.
 const edges=[zN];for(let d=1;v.pos[2]-d>zFar;d*=1.8)if(v.pos[2]-d<zN)edges.push(v.pos[2]-d);edges.push(zFar);
 const bands=edges.slice(1).map((z1,i)=>{const z0=edges[i],mid:V3=[v.pos[0],0,(z0+z1)/2],dep=Math.max(0.1,toCam(v,mid)[2]);
  return {z0,z1,blur:blurPx(v,dep),fade:Math.min(1,dep/reach),lines:[] as [number,number][][]};});
 // Straight through a pinhole (two ends), bowed through a fisheye (sampled along it).
 const n=v.fish>0?16:1;
 const seg=(a:V3,b:V3,band:(typeof bands)[number])=>{const pts:[number,number][]=[];
  for(let i=0;i<=n;i++){const p=toScreen(v,add(a,mul(sub(b,a),i/n)));if(!p)return;pts.push(p);}band.lines.push(pts);};
 for(const band of bands){
  for(let x=cx-reach;x<=cx+reach;x+=step)seg([x,0,band.z0],[x,0,band.z1],band);
  for(let z=Math.floor(band.z0/step)*step;z>band.z1;z-=step)seg([cx-reach,0,z],[cx+reach,0,z],band);
 }
 return bands.map(({blur,fade,lines})=>({blur,fade,lines}));
}
// ---- the cube: everything but the characters, drawn as a real box of its exact size (vector, no image) ----
export type BoxFace={key:string;tiles:Tile[];quad:V3[];
 /** Clay shading, 0 to 1 (the light comes from above and to the upper left of the camera, as on the pack's images). */shade:number};
/**
 * A box w×h×d metres standing at `ground` (world, its lift included), turned `facing` (its front toward frame right for positive angles): the faces the
 * camera sees, as CSS planes (at most three, which never overlap, so they need no sorting among themselves). Undefined when any of them would reach
 * behind the camera.
 */
export function boxFaces(v:CssView,ground:V3,dims:{w:number;h:number;d:number},facing:number):{faces:BoxFace[];depth:number;blur:number}|undefined{
 const a=facing*Math.PI/180,R:V3=[Math.cos(a),0,-Math.sin(a)],F:V3=[Math.sin(a),0,Math.cos(a)],U:V3=[0,1,0];
 const {w,h,d}=dims,c=add(ground,mul(U,h/2)),K=400/Math.max(w,h,d);
 // Each face: its outward normal, its top-left corner, its two edges (across, down) and their lengths.
 const faces:[string,V3,V3,V3,V3,number,number][]=[
  ["front",F,add(add(add(c,mul(F,d/2)),mul(R,-w/2)),mul(U,h/2)),R,mul(U,-1),w,h],
  ["back",mul(F,-1),add(add(add(c,mul(F,-d/2)),mul(R,w/2)),mul(U,h/2)),mul(R,-1),mul(U,-1),w,h],
  ["right",R,add(add(add(c,mul(R,w/2)),mul(F,d/2)),mul(U,h/2)),mul(F,-1),mul(U,-1),d,h],
  ["left",mul(R,-1),add(add(add(c,mul(R,-w/2)),mul(F,-d/2)),mul(U,h/2)),F,mul(U,-1),d,h],
  ["top",U,add(add(add(c,mul(U,h/2)),mul(R,-w/2)),mul(F,-d/2)),R,F,w,d],
  ["bottom",mul(U,-1),add(add(add(c,mul(U,-h/2)),mul(R,-w/2)),mul(F,d/2)),R,mul(F,-1),w,d]
 ];
 const L=norm(add(add(mul(v.r,-0.45),mul(v.u,0.8)),mul(v.f,-0.4))),out:BoxFace[]=[];
 for(const [key,n,o,ex,ey,lw,lh] of faces){
  const centre=add(add(o,mul(ex,lw/2)),mul(ey,lh/2));
  if(dot(n,sub(v.pos,centre))<=1e-6)continue;
  // Its corners in order around the face (for picking).
  const corners=[o,add(o,mul(ex,lw)),add(add(o,mul(ex,lw)),mul(ey,lh)),add(o,mul(ey,lh))];
  if(corners.some(p=>toCam(v,p)[2]<0.05))return undefined;
  const tiles=tilesFor(v,o,mul(ex,1/K),mul(ey,1/K),lw*K,lh*K);if(!tiles)return undefined;
  out.push({key,tiles,shade:0.6+0.4*Math.max(0,dot(n,L)),quad:corners});
 }
 const depth=toCam(v,c)[2];
 return depth>0.05?{faces:out,depth,blur:blurPx(v,depth)}:undefined;
}
/** A colour (#rrggbb) at a share of its brightness, as CSS rgb(): the clay box's faces, lit and in shade. */
export function shade(hex:string,k:number):string{
 const n=parseInt(hex.slice(1),16),c=(x:number)=>Math.round(Math.min(255,Math.max(0,x*k)));
 return "rgb("+c((n>>16)&255)+","+c((n>>8)&255)+","+c(n&255)+")";
}

// ---- the focus point: the dot the user places; the camera focuses there and zooms toward it, and never moves when it is placed ----
/** Whether a screen point is inside a convex outline (its corners in order). */
function inside(pt:[number,number],poly:[number,number][]):boolean{
 let sign=0;for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],c=(b[0]-a[0])*(pt[1]-a[1])-(b[1]-a[1])*(pt[0]-a[0]);
  if(Math.abs(c)<1e-9)continue;const sg=Math.sign(c);if(sign&&sg!==sign)return false;sign=sg;}
 return true;
}
/**
 * The focus point under a point of the frame (fractions of its width and height): the frontmost prop drawn there (its image or one of its faces), else
 * the ground, else the far background, as the scene point it sits on and its line from the camera. The camera stays exactly where it is.
 */
export function pickPivot(s:Staging,anchor:Staging|undefined,aspect:string,fx:number,fy:number):NonNullable<Staging["pivot"]>{
 const {W,H}=frameSize(aspect),w=1000,h=1000*H/W,v=cssView(s,anchor,aspect,w,h),pt:[number,number]=[fx*w,fy*h];
 const [ux,uy]=unfish(v,pt[0],pt[1]),[x,y]=rot(v,ux,uy,-1),a=(x-v.pp[0])/v.D,b=-(y-v.pp[1])/v.D;
 const dir=add(v.f,add(mul(v.r,a),mul(v.u,b)));
 // Only what the frame draws can be picked (in the beta, the characters).
 const sprites=propSprites(v,s.props??[],s,anchor).filter(sp=>isCharacter((s.props??[])[sp.i]));
 const screen=(q:V3[])=>q.map(c=>toScreen(v,c)).filter((c):c is [number,number]=>Boolean(c));
 const hit=sprites.filter(sp=>(sp.quads??(sp.quad?[sp.quad]:[])).some(q=>{const poly=screen(q);return poly.length===4&&inside(pt,poly);})).sort((p,q)=>p.depth-q.depth)[0];
 const g=groundAt(v,pt[0],pt[1],0),gDepth=g?toCam(v,g)[2]:Infinity,far=v.cam.backdrop+toCam(v,v.cam.target as V3)[2];
 const depth=hit?hit.depth:gDepth<far?gDepth:far,P=add(v.eye,mul(dir,depth));
 const st=stageFromWorld(P[0],P[2],s,anchor),camDist=Math.hypot(...sub(v.cam.target as V3,v.eye));
 // Kept at full precision: the camera is rebuilt from it on every move of the dot, so any rounding would shake the whole picture as the dot moves.
 // On a prop: where on it, so the focus follows it when it moves.
 const rel=hit?sub(P,propWorld((s.props??[])[hit.i],s,anchor,s.props??[]).pos as V3):undefined;
 return {x:st.x,y:P[1],z:st.z,a,b,k:Math.hypot(...sub(P,v.eye))/Math.max(0.05,camDist),on:hit?hit.i:gDepth<far?"ground":"backdrop",...(rel?{rel}:{})};
}
/** Where the focus point is in the world (the aim point when none was placed). */
export const focusWorld=(v:CssView):V3=>(v.cam.focus??v.cam.target) as V3;

/**
 * The horizon on screen, as a curve (straight through a pinhole, bowed through a fisheye): the ground below it, the sky above with a lighter band down
 * to it. Paths in the view's px.
 */
export function horizonPaths(v:CssView):{ground:string;band:string;bandTop:[number,number];bandBottom:[number,number];
 /** The haze along the horizon: a soft light band just above it (over the far place's bases) and below it (the far ground fading into it): each its path and its gradient's ends. */
 hazeUp:[string,[number,number],[number,number]];hazeDown:[string,[number,number],[number,number]]}{
 const hz=Math.max(-v.h*3,Math.min(v.h*4,horizonY(v))),n=v.fish>0?48:2,line=(y:number)=>Array.from({length:n+1},(_,i)=>{const [x,yy]=rot(v,-v.w*1.5+i/n*v.w*4,y);return fish(v,x,yy);});
 const hl=line(hz),up=line(hz-v.h*0.35),far=v.h*6;
 const corner=(x:number,y:number)=>fish(v,...rot(v,x,y));
 const path=(pts:[number,number][])=>"M"+pts.map(p=>p[0].toFixed(1)+" "+p[1].toFixed(1)).join("L")+"Z";
 const hu=line(hz-v.h*0.07),hd=line(hz+v.h*0.22);
 return {ground:path([...hl,corner(v.w*2.5,far),corner(-v.w*1.5,far)]),band:path([...up,...hl.slice().reverse()]),
  bandTop:corner(v.w/2,hz-v.h*0.35),bandBottom:corner(v.w/2,hz),
  hazeUp:[path([...hu,...hl.slice().reverse()]),corner(v.w/2,hz-v.h*0.07),corner(v.w/2,hz)],
  hazeDown:[path([...hl,...hd.slice().reverse()]),corner(v.w/2,hz),corner(v.w/2,hz+v.h*0.22)]};
}

// ---- limits: every control stays where the frame makes sense (never inside the subject, never lost off the edge or behind the lens) ----
/** The view at a reference size: limits are about fractions of the frame, not its pixels. */
const refView=(s:Staging,anchor:Staging|undefined,aspect:string)=>{const {W,H}=frameSize(aspect);return cssView(s,anchor,aspect,1000,1000*H/W);};
/** How close the camera may come to the focus point, metres (a real lens has a near limit; nearer, the picture would be inside the subject). */
export const NEAREST_M=0.3;
/** How far a character's picture may be blown up (screen px per px of its sharpest image, on a frame 600 px tall): past this a close-up turns soft. */
export const MAX_MAGNIFY=3;
/**
 * The zoom's range for this scene, as zoom-slider positions (0 tightest, 1 widest): the tightest keeps the camera at least NEAREST_M from the focus
 * point and the dominant subject wholly in front of the lens, at this lens, angle and focus; the widest is the slider's own end.
 */
export function zoomLimits(s:Staging,anchor:Staging|undefined,aspect:string):[number,number]{
 const props=s.props??[],main=props.findIndex(p=>p.main);
 // Measured on a frame 600 px tall: about a phone's or a laptop's frame in device pixels.
 const {W,H}=frameSize(aspect),fw=600*W/H,nearest=main<0?NEAREST_M:Math.min(NEAREST_M,Math.max(0.12,sizeOf(props[main]).h*0.6));
 const ok=(sl:number)=>{const sc=scaleFromSlider(sl),t:Staging={...s,shotScale:sc,shotSize:nearestShot(sc)},v=cssView(t,anchor,aspect,fw,600);
  // A small thing (a product) may be shot closer than a person: the near limit scales with the subject, down to 12 cm.
  if(v.cam.atNearest||Math.hypot(...sub(focusWorld(v),v.pos))<nearest)return false;
  if(main<0)return true;
  const sp=propSprites(v,props,t,anchor).find(x=>x.i===main);if(!sp)return false;
  if(sp.faces)return true;
  if(!sp.quad!.every(q=>toCam(v,q)[2]>0.05))return false;
  // Never blown up past what its sharpest image holds.
  const a=VISUALS[sp.id],q=sp.quad!.map(c=>toScreen(v,c)),len=(i:number,j:number)=>q[i]&&q[j]?Math.hypot(q[i]![0]-q[j]![0],q[i]![1]-q[j]![1]):Infinity;
  // Its height on screen along its own edges (a picture tilted toward a high camera is still that tall).
  const onScreen=Math.max(len(0,3),len(1,2));
  return !a||onScreen/(a.hdHeight??a.height)<=MAX_MAGNIFY;};
 if(ok(0))return [0,1];
 if(!ok(1))return [0,1];
 let lo=0,hi=1;for(let i=0;i<24;i++){const mid=(lo+hi)/2;if(ok(mid))hi=mid;else lo=mid;}
 return [Math.ceil(hi*1000)/1000,1];
}
/**
 * Where a prop may be dragged, in stage units, as the frame shows it: sideways until its middle is a third of the frame past either edge (partly out
 * of frame, never lost); toward the camera until it is about to reach the lens; back until just before the background (and the stage's end).
 */
export function propReach3D(p:SceneProp,s:Staging,anchor:Staging|undefined,aspect:string):{xMin:number;xMax:number;zMin:number;zMax:number}{
 const v=refView(s,anchor,aspect),props=s.props??[],size=sizeOf(p);
 const world=(x:number,z:number)=>propWorld({...p,x,z},{...s,props:props.map(q=>q===p?{...q,x,z}:q)},anchor).pos as V3;
 const mid=(x:number,z:number):V3=>{const g=world(x,z);return [g[0],g[1]+size.h/2,g[2]];};
 const solve=(f:(t:number)=>boolean,lo:number,hi:number)=>{for(let i=0;i<24;i++){const m=(lo+hi)/2;if(f(m))hi=m;else lo=m;}return hi;};
 // Toward the camera: its nearest side stays NEAREST_M in front of the lens.
 const inFront=(z:number)=>toCam(v,mid(p.x,z))[2]-size.len/2>=NEAREST_M;
 const zMin=inFront(PROP_Z_RANGE[0])?PROP_Z_RANGE[0]:inFront(PROP_Z_RANGE[1])?solve(inFront,PROP_Z_RANGE[0],PROP_Z_RANGE[1]):p.z;
 // Back: in front of the background (a room's wall, a studio's backdrop), within the stage.
 const o=worldOrigin(s,anchor),zWall=o.z+(v.cam.backdrop-Math.max(0.5,size.len))/METERS_PER_Z,zMax=Math.max(zMin,Math.min(PROP_Z_RANGE[1],zWall));
 // Sideways: its middle a third of the frame past either edge, at its depth.
 const z=Math.min(zMax,Math.max(zMin,p.z)),sx=(x:number)=>toScreen(v,mid(x,z))?.[0]??NaN;
 const left=(x:number)=>sx(x)>=-v.w/3,right=(x:number)=>!(sx(x)<=v.w*4/3);
 const xMin=left(PROP_X_RANGE[0])?PROP_X_RANGE[0]:solve(left,PROP_X_RANGE[0],p.x);
 const xMax=!right(PROP_X_RANGE[1])?PROP_X_RANGE[1]:solve(right,p.x,PROP_X_RANGE[1]);
 const r2=(n:number)=>Math.round(n*100)/100;
 return {xMin:r2(Math.min(xMin,p.x)),xMax:r2(Math.max(xMax,p.x)),zMin:r2(Math.min(zMin,p.z)),zMax:r2(Math.max(zMax,p.z))};
}

// ---- the camera-distance diagram: what the frame covers on the subject, and how high the camera may go ----
/** The camera's line through a point of the view (px). */
function rayAt(v:CssView,sx:number,sy:number):V3{const [ux,uy]=unfish(v,sx,sy),[x,y]=rot(v,ux,uy,-1);return add(v.f,add(mul(v.r,(x-v.pp[0])/v.D),mul(v.u,-(y-v.pp[1])/v.D)));}
/**
 * What the frame covers on the main subject: where the frame's top, bottom, left and right edges (through its middle) cross the upright plane through
 * the subject square to the camera, in metres from the subject's ground point (up, and toward the frame's right). The crop, the angle, the lens and the
 * camera's height all count, exactly as the frame draws them. Undefined without a subject.
 */
export function cropOnSubject(s:Staging,anchor:Staging|undefined,aspect:string):{top:number;bottom:number;left:number;right:number}|undefined{
 const props=s.props??[],m=props.find(p=>p.main)??props[0];if(!m)return undefined;
 const {W,H}=frameSize(aspect),w=1000,h=1000*H/W,v=cssView(s,anchor,aspect,w,h),g=propWorld(m,s,anchor,props).pos as V3;
 const flat=Math.hypot(v.f[0],v.f[2]),n:V3=flat>1e-3?[v.f[0]/flat,0,v.f[2]/flat]:[0,0,-1],side=norm(cross(n,[0,1,0]));
 const hit=(sx:number,sy:number)=>{const d=rayAt(v,sx,sy),den=dot(d,n);if(Math.abs(den)<1e-6)return undefined;const t=dot(sub(g,v.pos),n)/den;return t>0?add(v.pos,mul(d,t)):undefined;};
 const T=hit(w/2,0),B=hit(w/2,h),L=hit(0,h/2),R=hit(w,h/2);
 return {top:T?T[1]-g[1]:Infinity,bottom:B?B[1]-g[1]:-Infinity,left:L?dot(sub(L,g),side):-Infinity,right:R?dot(sub(R,g),side):Infinity};
}
/** Where the camera aims on the main subject: metres above its ground point (the frame's aim, which comes down from the face as the shot widens). */
export function aimOnSubject(s:Staging,anchor:Staging|undefined,aspect:string):number|undefined{
 const props=s.props??[],m=props.find(p=>p.main)??props[0];if(!m)return undefined;
 return camera3D(s,anchor,aspect).target[1]-(propWorld(m,s,anchor,props).pos as V3)[1];
}
/** How high above its usual place the camera may be raised, metres (a tall stand or a short crane). */
export const LIFT_MAX=3;
/** How far the camera may be lowered (it stays above the ground) or raised, metres, at its current angle and distance. */
export function liftLimits(s:Staging,anchor:Staging|undefined,aspect:string):[number,number]{
 const v=cssView({...s,cameraLift:0},anchor,aspect,100,100);return [Math.min(0,Math.ceil((0.05-v.pos[1])*20)/20),LIFT_MAX];
}

// ---- an extreme close-up past what the frame can draw ----
/** The tightest frame drawn for a character: its head's height times this (the head with a little room above and below). */
export const HEAD_ROOM=1.5;
/** The frame's four corners as drawn (px, clockwise from top-left): the whole view, or the frame's rectangle in the wide view. */
function frameCorners(v:CssView):[number,number][]{
 if(!v.frame)return [[0,0],[v.w,0],[v.w,v.h],[0,v.h]];
 const cx=v.frame.x*v.w,cy=v.frame.y*v.h,hw=v.frame.w*v.w/2,hh=v.frame.h*v.h/2;
 return [[cx-hw,cy-hh],[cx+hw,cy-hh],[cx+hw,cy+hh],[cx-hw,cy+hh]];
}
/**
 * An extreme close-up of a character (its eyes, its mouth) is allowed past the zoom the frame can draw (zoomLimits: the character's picture would be
 * blown up past MAX_MAGNIFY, softer than its image). Past that point the frame stays at its tightest and shows, as `guide`, where the real crop falls on
 * the subject: the real frame's corners where they cross the plane through the focus point square to the lens, in the drawn view's px. `draw` is the
 * staging to draw; with no guide it is `s` itself.
 */
export function closeUp(s:Staging,anchor:Staging|undefined,aspect:string,w:number,h:number,wide=false,fill?:number):{draw:Staging;guide?:[number,number][]}{
 const props=s.props??[],m=props.find(p=>p.main);
 if(!m||!isCharacter(m))return {draw:s};
 // The frame draws down to the whole head with a little room around it (its picture never blown up past what it holds); tighter is the guide.
 const ref=VISUALS[familyOf(m)+"-front"]?.head,headCrop=ref?sliderFromScale((ref.neck-ref.top)*HEAD_ROOM):0;
 const lo=Math.max(zoomLimits(s,anchor,aspect)[0],headCrop),at=sliderFromScale(scaleOf(s));
 if(at>=lo-1e-3)return {draw:s};
 // The drawn frame holds the whole face, so the guide lands on the eyes or the mouth.
 const sc=scaleFromSlider(lo),draw:Staging={...s,shotScale:sc,shotSize:nearestShot(sc),...(s.focusDetail==="eyes"||s.focusDetail==="mouth"?{focusDetail:"face" as const}:{})};
 const real=cssView(s,anchor,aspect,w,h,wide,fill),shown=cssView(draw,anchor,aspect,w,h,wide,fill),f=focusWorld(real),n=real.f;
 const guide:[number,number][]=[];
 for(const [x,y] of frameCorners(real)){
  const d=rayAt(real,x,y),den=dot(d,n);if(den<1e-6)return {draw};
  const p=toScreen(shown,add(real.pos,mul(d,dot(sub(f,real.pos),n)/den)));if(!p)return {draw};guide.push(p);
 }
 return {draw,guide};
}

// ---- the focus point in words, for the prompt (the frame shows it; the image model has to be told) ----
/** Which part of a person a height on it is (a share of its height). */
const PART:{min:number;en:string;fa:string}[]=[{min:0.82,en:"face",fa:"صورت"},{min:0.62,en:"chest",fa:"سینه"},{min:0.42,en:"waist and hands",fa:"کمر و دست‌ها"},
 {min:0.15,en:"legs",fa:"پاها"},{min:-Infinity,en:"feet",fa:"کف پاها و کفش"}];
/**
 * The focus point the user placed, in words for the image model: on which part of the main subject it sits (another prop, the ground or the background
 * are already named by the scene's description), and where it is in the frame (thirds), with what that means for the depth of field. Empty while the
 * focus is Whoush's own (the dominant subject's face or the detail the brief names).
 */
export function describeFocus(s:Staging,anchor:Staging|undefined,aspect:string):{en:string;fa:string}{
 if(!s.pivot&&!s.focusPoint)return {en:"",fa:""};
 const {W,H}=frameSize(aspect),v=cssView(s,anchor,aspect,1000,1000*H/W),p=toScreen(v,focusWorld(v));if(!p)return {en:"",fa:""};
 const fx=p[0]/v.w,fy=p[1]/v.h;
 const col=fx<1/3?0:fx>2/3?2:1,row=fy<1/3?0:fy>2/3?2:1;
 const en=(row===1&&col===1?"the centre":["upper","middle","lower"][row]+(col===1?" centre":["-left"," "," -right"][col].trim()))+" of the frame";
 const fa=row===1&&col===1?"وسط کادر":["بالای","وسط","پایین"][row]+(col===1?" کادر":" سمت "+(col===0?"چپ":"راست")+" کادر");
 const props=s.props??[],m=props.find(q=>q.main)??props[0],on=s.pivot?.on;
 let partEn="",partFa="";
 if(m&&typeof on==="number"&&props[on]===m&&isCharacter(m)){
  const g=propWorld(m,s,anchor,props).pos as V3,share=(focusWorld(v)[1]-g[1])/propSize(m).h,part=PART.find(x=>share>=x.min)!;
  partEn=" on the main subject's "+part.en;partFa=" روی "+part.fa+(part.fa.endsWith("ه")?"ٔ ":"ِ ")+m.label;
 }
 return {en:" Focus point"+partEn+", at the "+en.replace(/^the /,"")+": that plane is in sharp focus; nearer and farther fall off with the aperture.",
  fa:"نقطهٔ فوکوس"+partFa+"، "+fa};
}
