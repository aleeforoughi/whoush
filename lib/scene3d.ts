/**
 * «بوم» in real 3D: the scene in metres and a real perspective camera, from the same staging the 2D canvas and the provider prompt use. Pure maths (no
 * three.js here): safe on the server and in tests. The 3D view (components/scene-3d.tsx) only draws what this computes.
 *
 * World: metres, y up, the main subject standing at the origin; the stage's depth runs away from the camera along −z (three.js looks down −z). The scene
 * is kept as the camera sees it (an orbit has already turned the props), so the camera always stands in front, on +z, raised by its height angle.
 */
import type {Staging} from "./creative-plan";
import {sizeOf,spanM} from "./sprites";
import {DETAIL_HEIGHT,METERS_PER_Z,SENSOR_H_MM,backdropM,centerOnSubject,elevationOf,facingOf,focusDepth,frameSize,genderOf,cubeDims,physicalCamera,stackLift,STAGE_X_M,rollOf,scaleOf,type SceneProp} from "./staging";

/** Metres per stage unit sideways (the stage's ±1 is a 6 m wide set). */
export const X_M=STAGE_X_M;
/**
 * How strongly the frame bows: none for an ordinary (rectilinear) lens at any focal length, as real ultra-wides keep lines straight; a fisheye lens bows
 * more the wider it is (strong at 12 mm, gentle toward 30 mm).
 */
export const fisheyeOf=(s:Staging,focalMm:number)=>s.fisheye?Math.max(0.25,Math.min(1,(30-focalMm)/18)):0;
/** Real sizes, in metres: height, and for the long things their length. */
export function propSize(p:Pick<SceneProp,"kind"|"label">&{size?:SceneProp["size"]}):{h:number;len:number}{
 // People and the pets by their figures; everything else (a cube in the 2D frame) by its own size: Whoush's estimate or the everyday size of what it is.
 const s=sizeOf(p);return {h:s.h,len:p.kind==="person"?0.4:s.len};
}
const mainOf=(s:Staging)=>(s.props??[]).find(p=>p.main)??(s.props??[])[0];
/**
 * The world's origin on the stage: the dominant subject where it stood when the camera last moved (the anchor, as in the 2D frame), so moving any prop (the
 * dominant subject too) moves only that prop, never the camera.
 */
export function worldOrigin(s:Staging,anchor?:Staging):{x:number;z:number}{const m=mainOf(anchor??s);return {x:m?.x??0,z:m?.z??0};}
/** A prop's place in the world (its ground point; `y` is its lift) and its turn about y (facing 0 looks at the camera; positive turns its front to frame right). */
export function propWorld(p:SceneProp,s:Staging,anchor?:Staging,/** The props as they are now (a prop being dragged), for what rests on what. */props:readonly SceneProp[]=s.props??[]):{pos:[number,number,number];rotY:number}{
 const o=worldOrigin(s,anchor);
 // Lifted by its own lift, plus whatever it rests on (a phone on a desk stands on the desk's top).
 return {pos:[(p.x-o.x)*X_M,p.y*1.2+stackLift(p,props),-(p.z-o.z)*METERS_PER_Z],rotY:facingOf(p)*Math.PI/180};
}
/** A world point on the ground back to the stage (the inverse of propWorld's place). */
export function stageFromWorld(wx:number,wz:number,s:Staging,anchor?:Staging):{x:number;z:number}{const o=worldOrigin(s,anchor);return {x:o.x+wx/X_M,z:o.z-wz/METERS_PER_Z};}
export type Camera3D={
 position:[number,number,number];target:[number,number,number];
 /** Vertical field of view in degrees (from the focal length on a full-frame sensor; a portrait frame has the 36 mm side vertical). */fov:number;
 /** The Dutch roll, radians. */roll:number;
 /** The crop pan as a film shift (the frame window's offset), in frame widths and heights, y down: content follows the crop as in 2D. */shift:[number,number];
 /** Barrel distortion for ultra-wide and fisheye lenses (0 none, 1 strong), from about 15 mm down. */fisheye:number;
 /** Depth of field: where the focus is (metres from the camera), the lens and the aperture. */focusDistance:number;focalMm:number;aperture:number;
 /** The background's distance behind the subject, metres (a room's wall, mountains...). */backdrop:number;
 /** Where the camera focuses, in the world: the point the user placed, else the dominant subject (unset: the aim point). */focus?:[number,number,number];
 /** The camera is as near as it can come (over a figure's head): zooming in further would change nothing. */atNearest?:boolean;
};
/**
 * The camera, as the 2D canvas and the prompt see it: the lens and aperture (Whoush's or the user's), the distance solved from the shot size (on the frame's
 * vertical sensor side), aimed at the frame's centre point on the subject (its face by default), raised by the height angle, rolled by the Dutch angle.
 */
/** How close the shot is, 0 (full length and wider) to 1 (a ۳/۴ shot and closer): a close shot is framed and drawn by the face, not the whole figure. */
export function closeShare(s:Staging):number{return Math.max(0,Math.min(1,Math.log(1.1/scaleOf(s))/Math.log(1.1/0.75)));}
export function camera3D(s:Staging,anchor:Staging|undefined,aspect:string):Camera3D{
 const c=physicalCamera(s),{W,H}=frameSize(aspect),portrait=H>W,sensorV=portrait?36:SENSOR_H_MM;
 const m=mainOf(s),subjectH=m?propSize(m).h:1.7;
 // The shot size frames the subject as it looks from this angle (its height foreshortened plus its depth seen from above or below), so a full shot
 // from overhead is as full as one at eye level: the camera comes closer, as a photographer would, instead of the subject shrinking in the frame.
 // A close shot is about the face, which does not foreshorten like a whole figure: from a medium shot in, the distance no longer depends on the angle
 // (lib/frame-css.ts places a person's picture by its face as closely), so turning the camera never zooms it.
 const close=closeShare(s);
 const span=m?spanM(sizeOf(m),elevationOf(s),"front")*(1-close)+subjectH*close:subjectH,eRad=elevationOf(s)*Math.PI/180;
 // That distance is to the subject's middle (where its picture stands); the camera aims at its face, which from above is nearer the lens and from below
 // farther. A close-up is about the face itself, so the correction fades in with how much of the body the shot shows.
 const aimShare=m?.kind==="person"?DETAIL_HEIGHT[s.focusDetail??"face"]:0.5,offset=(aimShare-0.5)*subjectH*Math.sin(eRad)*Math.min(1,scaleOf(s))*(1-close);
 // Looking down on a whole figure, the camera stays above its head (a full overhead shot cannot be framed tighter than that).
 const floor=m?.kind==="person"&&eRad>0.5?Math.max(0.12,(subjectH*(1-aimShare)+0.15)/Math.sin(eRad)*(1-close)):0.12,free=scaleOf(s)*span*c.f/sensorV-offset;
 const d=Math.max(floor,free);
 // Aimed at the anchor (the dominant subject where the camera last framed it): its face for a person, or the detail the brief names; or at the centre
 // point the user placed, measured on the dominant subject where it stands now.
 const am=mainOf(anchor??s);
 let target:[number,number,number]=[0,subjectH*0.5,0];
 if(s.focusPoint&&m){const {height,lateral}=centerOnSubject(s,anchor,aspect),w=propWorld(m,s,anchor).pos;target=[w[0]+lateral*X_M,w[1]+height*subjectH,w[2]];}
 else if(am){const w=propWorld(am,s,anchor).pos,h=propSize(am).h;target=[w[0],w[1]+h*(am.kind==="person"?DETAIL_HEIGHT[s.focusDetail??"face"]:0.5),w[2]];}
 let e=elevationOf(s)*Math.PI/180;
 // A camera never goes under the ground: looking up from below (a worm's-eye view), once a wider shot would put it underground it stays on the ground
 // and backs away along it, so zooming out keeps working and the angle up eases off smoothly (a real camera lying on the floor).
 const minY=0.05;if(target[1]+d*Math.sin(e)<minY&&d>0)e=-Math.asin(Math.min(1,Math.max(0,(target[1]-minY)/d)));
 const position:[number,number,number]=[target[0],target[1]+d*Math.sin(e),target[2]+d*Math.cos(e)];
 const fov=2*Math.atan((sensorV/2)/c.f)*180/Math.PI;
 const fr=s.framing??{x:0,y:0};
 const f:[number,number,number]=[0,-Math.sin(e),-Math.cos(e)];
 // A focus point the user placed and its zoom anchor: the camera keeps its direction and stands on the line through that point, its distance scaled
 // with the shot's, so placing it changes nothing and a zoom dollies toward it (it stays where it is in the frame). Without the anchor (the camera's
 // angle changed since), the camera frames as usual and only the focus stays on the point.
 let pos=position,aim=target;
 const pv=s.pivot;
 if(pv&&pv.a!==undefined&&pv.b!==undefined&&pv.k!==undefined){
  const o=worldOrigin(s,anchor),P0:[number,number,number]=[(pv.x-o.x)*X_M,pv.y,-(pv.z-o.z)*METERS_PER_Z];
  const r:[number,number,number]=[1,0,0],u:[number,number,number]=[0,Math.cos(e),-Math.sin(e)];
  const ray=[f[0]+r[0]*pv.a+u[0]*pv.b,f[1]+r[1]*pv.a+u[1]*pv.b,f[2]+r[2]*pv.a+u[2]*pv.b],len=Math.hypot(...ray),t=pv.k*d;
  pos=[P0[0]-ray[0]/len*t,P0[1]-ray[1]/len*t,P0[2]-ray[2]/len*t];aim=[pos[0]+f[0]*d,pos[1]+f[1]*d,pos[2]+f[2]*d];
 }
 // What the camera focuses on, locked through every re-frame, angle change and prop move (the camera never moves for it): the point the user placed,
 // following the prop it sits on; else the dominant subject where it stands now (its face, or the detail the brief names).
 let focus:[number,number,number]|undefined;
 if(pv){const prop=typeof pv.on==="number"?(s.props??[])[pv.on]:undefined;
  if(prop&&pv.rel){const w=propWorld(prop,s,anchor).pos;focus=[w[0]+pv.rel[0],w[1]+pv.rel[1],w[2]+pv.rel[2]];}
  else{const o=worldOrigin(s,anchor);focus=[(pv.x-o.x)*X_M,pv.y,-(pv.z-o.z)*METERS_PER_Z];}}
 else if(m&&!s.focusPoint){const w=propWorld(m,s,anchor).pos,h=propSize(m).h;focus=[w[0],w[1]+h*(m.kind==="person"?DETAIL_HEIGHT[s.focusDetail??"face"]:0.5),w[2]];}
 if(focus){
  const depth=(focus[0]-pos[0])*f[0]+(focus[1]-pos[1])*f[1]+(focus[2]-pos[2])*f[2];
  // Raised or lowered with its aim (a pedestal), never under the ground.
  const lift=Math.max(0.05-pos[1],s.cameraLift??0);pos=[pos[0],pos[1]+lift,pos[2]];aim=[aim[0],aim[1]+lift,aim[2]];
  const depthL=(focus[0]-pos[0])*f[0]+(focus[1]-pos[1])*f[1]+(focus[2]-pos[2])*f[2];void depth;
  return {position:pos,target:aim,fov,roll:rollOf(s)*Math.PI/180,shift:[-fr.x/2,-fr.y/2],fisheye:fisheyeOf(s,c.f),
   focusDistance:Math.max(0.05,depthL),focalMm:c.f,aperture:c.N,backdrop:backdropM(s),focus,atNearest:free<floor};
 }
 // The 2D canvas's own centre point (an older scene): focus on whatever it was moved onto (a prop, the ground, the far background).
 const fz=focusDepth(s,anchor,W,H),dist=(p:[number,number,number])=>Math.hypot(p[0]-position[0],p[1]-position[1],p[2]-position[2]);
 const focusOn=fz===undefined?dist(target):fz==="backdrop"?d+backdropM(s):(()=>{const p=(s.props??[]).find(x=>x.z===fz);
  if(!p)return dist([target[0],0,-(fz-worldOrigin(s,anchor).z)*METERS_PER_Z]);const w=propWorld(p,s,anchor).pos;return dist([w[0],w[1]+propSize(p).h*0.6,w[2]]);})();
 return {position,target,fov,roll:rollOf(s)*Math.PI/180,shift:[-fr.x/2,-fr.y/2],fisheye:fisheyeOf(s,c.f),
  focusDistance:focusOn,focalMm:c.f,aperture:c.N,backdrop:backdropM(s)};
}
/**
 * Depth of field from the lens, aperture and focus distance (thin lens, full-frame circle of confusion 0.03 mm): the nearest and farthest sharp distances,
 * metres (far is Infinity beyond the hyperfocal distance). The 3D view blurs everything outside them, more the further outside.
 */
export function depthOfField(c:Pick<Camera3D,"focalMm"|"aperture"|"focusDistance">):{near:number;far:number}{
 const f=c.focalMm/1000,N=c.aperture,coc=0.00003,s=c.focusDistance,Hd=f*f/(N*coc)+f;
 return {near:s*(Hd-f)/(Hd+s-2*f),far:s>=Hd?Infinity:s*(Hd-f)/(Hd-s)};
}
/** Where the frame lies in the wide (full-screen) view, as fractions of the view: its size and centre, the crop moving the frame, not the picture. */
export type FrameRect={x:number;y:number;w:number;h:number};
/** The frame's rectangle in a wide view of `vw`×`vh` pixels: as large as fits with room around it (to see past the frame), moved by the crop. */
export function wideFrameRect(cam:Pick<Camera3D,"shift">,frameAspect:number,vw:number,vh:number):FrameRect{
 const fh=Math.min(vh*0.62,vw*0.84/frameAspect),fw=fh*frameAspect;
 return {w:fw/vw,h:fh/vh,x:0.5+cam.shift[0]*fw/vw,y:0.5+cam.shift[1]*fh/vh};
}
/** The clay look of the asset pack, for the 3D figures, and the dark set they stand in (colours live here: TSX holds no hex values). */
export const SCENE_COLORS={clay:"#d9dadd",hair:"#8a8d93",dark:"#2b2d31",glass:"#3c4048",tail:"#c4453f",ground:"#17181b",sky:"#0b0b0c",wall:"#25272b",window:"#6d7480",sea:"#2a3340",horizon:"#202227",foliage:"#9fa3a8",bark:"#7c7f84",selected:"#1d4ed8",black:"#000000",grid:"rgba(255,255,255,0.13)",edge:"rgba(0,0,0,0.12)",haze:"#3a3d43",closeUp:"#34d399"} as const;
/**
 * The frame's centre point from a point on the subject (the inverse of centerOnSubject): `lateral` stage units sideways, `height` as a share of its height.
 * Used when the user drags the centre point in the 3D view.
 */
export function focusPointFrom(s:Staging,anchor:Staging|undefined,aspect:string,lateral:number,height:number):{x:number;y:number}{
 const {W,H}=frameSize(aspect),m=mainOf(s);
 if(!m)return {x:0.5,y:0.5};
 const base=centerOnSubject(s,anchor,aspect),cur=s.focusPoint;
 // centerOnSubject is linear in the centre point: two probes give the mapping, so the inverse needs no knowledge of the 2D drawing's internals.
 const probe=(fp:{x:number;y:number})=>centerOnSubject({...s,focusPoint:fp},anchor,aspect);
 const o=cur??{x:0.5,y:0.5},a=probe(o),bx=probe({x:o.x+0.1,y:o.y}),by=probe({x:o.x,y:o.y+0.1});
 const dLx=(bx.lateral-a.lateral)/0.1,dHy=(by.height-a.height)/0.1;
 void base;void W;void H;
 return {x:o.x+(lateral-a.lateral)/(dLx||1),y:o.y+(height-a.height)/(dHy||1)};
}

// ---- the 3D figures as models (glTF), matching the 2D asset pack ----
/**
 * Each prop kind's 3D model, in `public/visuals/3d/<id>.glb`, made to match the 2D pack (public/visuals, docs/VISUAL_ASSETS.md): the same matte light
 * clay, the same grey hair. Built from silhouettes measured on the pack's PNGs, modelled in Spline, fused, rigged and exported with Blender
 * (scripts/models-3d/README.md, which also records each model's measured match). Conventions every model follows (the frame relies on them; it also
 * re-measures each prop, so small slips are corrected):
 * - glTF 2.0 binary, y up, metres; its front (face, windscreen, label) toward +z; standing on y = 0, centred on x = 0, z = 0;
 * - real size (man 1.75 m, woman 1.65 m, car 1.5 m high, cat 0.45 m high...), as lib/scene3d.ts propSize says; the mountains at their own scale (a 160 m
 *   massif) since the place is not fitted;
 * - materials named `clay` (tinted when several props of the same kind need telling apart) and `hair`, `glass`, `dark`, `tail` as needed;
 * - the people carry a humanoid skeleton (hips, spine, chest, neck, head, left/right upper arm, lower arm, hand, upper leg, lower leg, foot) with smooth
 *   weights, in the rest pose of the 2D figures, so they can be posed later.
 */
export const MODEL_3D_IDS=["man","woman","car","cat","bottle","tree","building","mountains"] as const;
export type Model3DId=typeof MODEL_3D_IDS[number];
/** The models that exist and were checked in the frame (`version` busts the browser's cache when one is replaced); the others use the procedural figures. */
export const MODELS_3D:Partial<Record<Model3DId,{version:string}>>={
 man:{version:"2"},woman:{version:"1"},car:{version:"1"},cat:{version:"1"},bottle:{version:"1"},tree:{version:"1"},building:{version:"1"},mountains:{version:"2"}
};
/** Which model draws a prop. */
export function modelIdOf(p:Pick<SceneProp,"kind"|"label">):Model3DId{
 switch(p.kind){
  case "person":return genderOf(p)==="female"?"woman":"man";
  case "vehicle":return "car";
  case "animal":return "cat";
  case "object":return "bottle";
  case "tree":return "tree";
  case "building":return "building";
 }
}
/** The model's URL, when it exists. */
export function modelSrc(id:Model3DId):string|undefined{const m=MODELS_3D[id];return m?"/visuals/3d/"+id+".glb?v="+encodeURIComponent(m.version):undefined;}
