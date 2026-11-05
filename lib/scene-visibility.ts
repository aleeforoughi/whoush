import type {Staging} from "./creative-plan";
import {cssView,toCam,toScreen,type CssView,type V3} from "./frame-css";
import {propWorld} from "./scene3d";
import {sizeOf} from "./sprites";
import {DETAIL_HEIGHT,elevationOf,orbitCamera,wrap180,type SceneProp} from "./staging";

/**
 * What the camera can actually see in the arranged scene (docs/CANVAS_TO_IMAGE.md section 5): which props fall inside the output crop, and whether the main
 * subject's key point (a person's face, or the detail the shot is about; the middle of anything else) is in the crop and in clear line of sight, or hidden
 * behind another prop (a table in front of a floor-level camera). It uses the canvas's own camera and crop (lib/frame-css.ts), so it agrees with what the
 * frame shows. Props are boxes of their real size; this is a proxy for the scene, not a render.
 */
export type SubjectSight="visible"|"occluded"|"out_of_frame"|"none";
export type SceneVisibility={inFrame:boolean[];subject:SubjectSight;
 /** The prop that hides the subject's key point, by index. */occluder?:number};

const W=1000;
type Box={c:V3;h:number;len:number;wid:number;rot:number};
function boxOf(p:SceneProp,s:Staging,props:readonly SceneProp[]):Box{
 const w=propWorld(p,s,undefined,props),z=sizeOf(p);
 return {c:w.pos as V3,h:z.h,len:z.len,wid:z.wid,rot:w.rotY};
}
/** The box's eight corners: across (wid) and along its facing (len), turned by its facing, from its ground point up to its height. */
function corners(b:Box):V3[]{
 const c=Math.cos(b.rot),n=Math.sin(b.rot),out:V3[]=[];
 for(const x of [-b.wid/2,b.wid/2])for(const z of [-b.len/2,b.len/2])for(const y of [0,b.h])out.push([b.c[0]+x*c+z*n,b.c[1]+y,b.c[2]-x*n+z*c]);
 return out;
}
/** Whether any part of the box lands inside the frame (the box is clipped to what is in front of the camera). */
function boxInFrame(v:CssView,b:Box):boolean{
 const pts=corners(b),front=pts.filter(p=>toCam(v,p)[2]>0.05);
 if(!front.length)return false;
 // A box the camera stands inside, or that reaches behind it, is treated as in frame when its front part is.
 const scr=front.map(p=>toScreen(v,p)).filter((p):p is [number,number]=>Boolean(p));
 if(!scr.length)return false;
 const xs=scr.map(p=>p[0]),ys=scr.map(p=>p[1]);
 return Math.max(...xs)>=0&&Math.min(...xs)<=v.w&&Math.max(...ys)>=0&&Math.min(...ys)<=v.h;
}
/** Where a ray from `o` along `d` first enters the box (as a multiple of d), or undefined: the ray turned into the box's frame, then the slab test. */
function rayHitsBox(o:V3,d:V3,b:Box):number|undefined{
 const c=Math.cos(b.rot),n=Math.sin(b.rot);
 const lx=(p:V3)=>(p[0]-b.c[0])*c-(p[2]-b.c[2])*n,lz=(p:V3)=>(p[0]-b.c[0])*n+(p[2]-b.c[2])*c;
 const O:V3=[lx(o),o[1]-b.c[1],lz(o)],D:V3=[d[0]*c-d[2]*n,d[1],d[0]*n+d[2]*c];
 const lo:V3=[-b.wid/2,0,-b.len/2],hi:V3=[b.wid/2,b.h,b.len/2];
 let t0=-Infinity,t1=Infinity;
 for(let i=0;i<3;i++){
  if(Math.abs(D[i])<1e-9){if(O[i]<lo[i]||O[i]>hi[i])return undefined;continue;}
  const a=(lo[i]-O[i])/D[i],e=(hi[i]-O[i])/D[i];t0=Math.max(t0,Math.min(a,e));t1=Math.min(t1,Math.max(a,e));
 }
 return t1>=Math.max(t0,0)?Math.max(t0,0):undefined;
}
const mainIndex=(props:readonly SceneProp[])=>{const i=props.findIndex(p=>p.main);return i>=0?i:props.length?0:-1;};
/** The subject's key point: a person's face (or the detail the shot is about), the middle of anything else. */
function keyPoint(s:Staging,b:Box,p:SceneProp):V3{
 const k=p.kind==="person"?DETAIL_HEIGHT[s.focusDetail??"face"]:0.5;
 return [b.c[0],b.c[1]+b.h*k,b.c[2]];
}
export function sceneVisibility(s:Staging,aspect:string):SceneVisibility{
 const props=s.props??[],r=aspect.split(":").map(Number),ratio=r.length===2&&r[0]>0&&r[1]>0?r[0]/r[1]:16/9;
 const v=cssView(s,undefined,aspect,W,Math.round(W/ratio));
 const boxes=props.map(p=>boxOf(p,s,props)),inFrame=boxes.map(b=>boxInFrame(v,b));
 const m=mainIndex(props);if(m<0)return {inFrame,subject:"none"};
 const key=keyPoint(s,boxes[m],props[m]),sp=toScreen(v,key);
 if(!sp||sp[0]<0||sp[0]>v.w||sp[1]<0||sp[1]>v.h)return {inFrame,subject:"out_of_frame"};
 const d:V3=[key[0]-v.pos[0],key[1]-v.pos[1],key[2]-v.pos[2]];
 // Anything between the camera and the key point hides it (a little short of the point, so the subject's own surroundings do not count).
 let occluder:number|undefined,nearest=Infinity;
 boxes.forEach((b,i)=>{if(i===m)return;const t=rayHitsBox(v.pos,d,b);if(t!==undefined&&t>0.02&&t<0.97&&t<nearest){nearest=t;occluder=i;}});
 return occluder===undefined?{inFrame,subject:"visible"}:{inFrame,subject:"occluded",occluder};
}

// ---- the smallest useful adjustment (section 5: «move the camera to the table's open side, widen the shot, or relax a conflicting requirement») ----
export type SightFix={kind:"raise";elevation:number}|{kind:"orbit";azimuth:number};
/**
 * The smallest camera change that brings the subject back into clear view: the least raise of the camera's angle, else the least turn around the subject.
 * Undefined when neither works within reach (the user then moves or removes what is in the way).
 */
export function sightFix(s:Staging,aspect:string):SightFix|undefined{
 const clear=(x:Staging)=>sceneVisibility(x,aspect).subject==="visible";
 const e0=elevationOf(s);
 for(let e=Math.ceil(e0/5)*5+5;e<=60;e+=5){if(clear({...s,cameraElevation:e}))return {kind:"raise",elevation:e};}
 const a0=s.cameraAzimuth??0;
 // An orbit turns the canvas's props and lights with the camera (lib/staging.ts orbitCamera), exactly as the orbit slider does.
 for(const step of [30,45,60,90,120,150,180])for(const sign of [1,-1]){const o=orbitCamera(s,sign*step);if(clear(o))return {kind:"orbit",azimuth:wrap180(a0+sign*step)};}
 return undefined;
}

/**
 * A scene Whoush arranged itself (the planner's props, no user arrangement) whose subject is hidden: the prop in the way is moved sideways, the least
 * that clears the line of sight. The camera stays as the brief asked. The user's own arrangement is never changed this way: it is refused with a fix.
 */
export function clearSightByMovingProp(s:Staging,aspect:string):Staging{
 const v=sceneVisibility(s,aspect);if(v.subject!=="occluded"||v.occluder===undefined)return s;
 const props=s.props??[],i=v.occluder,p=props[i];
 for(let d=0.1;d<=3;d+=0.1)for(const sign of [1,-1]){
  const x=Math.round((p.x+sign*d)*100)/100;if(x<-6||x>6)continue;
  const next={...s,props:props.map((q,j)=>j===i?{...q,x}:q)};
  if(sceneVisibility(next,aspect).subject!=="occluded")return next;
 }
 return s;
}
const fa=(n:number)=>String(n).replace(/-/g,"−").replace(/\d/g,d=>"۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
/** Persian: what hides the subject, and the smallest change that shows it again. */
export function occlusionMessageFa(s:Staging,aspect:string):string{
 const v=sceneVisibility(s,aspect),props=s.props??[],m=props.find(p=>p.main)??props[0],o=v.occluder!==undefined?props[v.occluder]:undefined;
 const what=o?"«"+o.label+"»":"یه چیزی",who=m?"«"+m.label+"»":"سوژه",part=m?.kind==="person"?"صورتِ "+who:who;
 const fix=sightFix(s,aspect);
 const how=!fix?"اون رو جابه‌جا کن یا از صحنه برش دار.":fix.kind==="raise"?"دوربین رو کمی بالاتر ببر (زاویهٔ حدود "+fa(fix.elevation)+" درجه)، یا "+what+" رو جابه‌جا کن.":"دوربین رو حدود "+fa(Math.abs(Math.round(wrap180(fix.azimuth-(s.cameraAzimuth??0)))))+" درجه دور سوژه بچرخون، یا "+what+" رو جابه‌جا کن.";
 return what+" از این زاویه جلوی "+part+" رو گرفته و توی عکس دیده نمی‌شه. "+how;
}
