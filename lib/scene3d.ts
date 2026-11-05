/**
 * «بوم» in real 3D: the scene in metres and a real perspective camera, from the same staging the 2D canvas and the provider prompt use. Pure maths (no
 * three.js here): safe on the server and in tests. The 3D view (components/scene-3d.tsx) only draws what this computes.
 *
 * World: metres, y up, the main subject standing at the origin; the stage's depth runs away from the camera along −z (three.js looks down −z). The scene
 * is kept as the camera sees it (an orbit has already turned the props), so the camera always stands in front, on +z, raised by its height angle.
 */
import type {Staging} from "./creative-plan";
import {DETAIL_HEIGHT,METERS_PER_Z,SENSOR_H_MM,backdropM,centerOnSubject,elevationOf,facingOf,focusDepth,frameSize,genderOf,physicalCamera,rollOf,scaleOf,type SceneProp} from "./staging";

/** Metres per stage unit sideways (the stage's ±1 is a 6 m wide set). */
export const X_M=3;
/** Real sizes, in metres: height, and for the long things their length. */
export function propSize(p:Pick<SceneProp,"kind"|"label">):{h:number;len:number}{
 switch(p.kind){
  case "person":return {h:genderOf(p)==="female"?1.65:1.75,len:0.4};
  case "vehicle":return {h:1.5,len:4};
  case "animal":return {h:0.45,len:0.5};
  case "object":return {h:0.35,len:0.12};
  case "tree":return {h:6,len:3};
  case "building":return {h:14,len:10};
 }
}
const mainOf=(s:Staging)=>(s.props??[]).find(p=>p.main)??(s.props??[])[0];
/**
 * The world's origin on the stage: the dominant subject where it stood when the camera last moved (the anchor, as in the 2D frame), so moving any prop (the
 * dominant subject too) moves only that prop, never the camera.
 */
export function worldOrigin(s:Staging,anchor?:Staging):{x:number;z:number}{const m=mainOf(anchor??s);return {x:m?.x??0,z:m?.z??0};}
/** A prop's place in the world (its ground point; `y` is its lift) and its turn about y (facing 0 looks at the camera; positive turns its front to frame right). */
export function propWorld(p:SceneProp,s:Staging,anchor?:Staging):{pos:[number,number,number];rotY:number}{
 const o=worldOrigin(s,anchor);
 return {pos:[(p.x-o.x)*X_M,p.y*1.2,-(p.z-o.z)*METERS_PER_Z],rotY:facingOf(p)*Math.PI/180};
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
};
/**
 * The camera, as the 2D canvas and the prompt see it: the lens and aperture (Whoush's or the user's), the distance solved from the shot size (on the frame's
 * vertical sensor side), aimed at the frame's centre point on the subject (its face by default), raised by the height angle, rolled by the Dutch angle.
 */
export function camera3D(s:Staging,anchor:Staging|undefined,aspect:string):Camera3D{
 const c=physicalCamera(s),{W,H}=frameSize(aspect),portrait=H>W,sensorV=portrait?36:SENSOR_H_MM;
 const m=mainOf(s),subjectH=m?propSize(m).h:1.7;
 const d=Math.max(0.12,scaleOf(s)*subjectH*c.f/sensorV);
 // Aimed at the anchor (the dominant subject where the camera last framed it): its face for a person, or the detail the brief names; or at the centre
 // point the user placed, measured on the dominant subject where it stands now.
 const am=mainOf(anchor??s);
 let target:[number,number,number]=[0,subjectH*0.5,0];
 if(s.focusPoint&&m){const {height,lateral}=centerOnSubject(s,anchor,aspect),w=propWorld(m,s,anchor).pos;target=[w[0]+lateral*X_M,w[1]+height*subjectH,w[2]];}
 else if(am){const w=propWorld(am,s,anchor).pos,h=propSize(am).h;target=[w[0],w[1]+h*(am.kind==="person"?DETAIL_HEIGHT[s.focusDetail??"face"]:0.5),w[2]];}
 const e=elevationOf(s)*Math.PI/180;
 const position:[number,number,number]=[target[0],target[1]+d*Math.sin(e),target[2]+d*Math.cos(e)];
 const fov=2*Math.atan((sensorV/2)/c.f)*180/Math.PI;
 const fr=s.framing??{x:0,y:0};
 // Focus: on the centre point, or on whatever the user moved it onto (a prop, the ground, the far background).
 const fz=focusDepth(s,anchor,W,H),dist=(p:[number,number,number])=>Math.hypot(p[0]-position[0],p[1]-position[1],p[2]-position[2]);
 const focusOn=fz===undefined?dist(target):fz==="backdrop"?d+backdropM(s):(()=>{const p=(s.props??[]).find(x=>x.z===fz);
  if(!p)return dist([target[0],0,-(fz-worldOrigin(s,anchor).z)*METERS_PER_Z]);const w=propWorld(p,s,anchor).pos;return dist([w[0],w[1]+propSize(p).h*0.6,w[2]]);})();
 return {position,target,fov,roll:rollOf(s)*Math.PI/180,shift:[-fr.x/2,-fr.y/2],fisheye:Math.max(0,Math.min(1,(15-c.f)/7)),
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
export const SCENE_COLORS={clay:"#d9dadd",hair:"#8a8d93",dark:"#2b2d31",glass:"#3c4048",tail:"#c4453f",ground:"#17181b",sky:"#0b0b0c",wall:"#25272b",window:"#6d7480",sea:"#2a3340",horizon:"#202227",foliage:"#9fa3a8",bark:"#7c7f84",selected:"#1d4ed8",black:"#000000",grid:"rgba(255,255,255,0.13)"} as const;
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
