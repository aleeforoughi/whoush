/**
 * Face-aware selection for the wand (owner, 2026-11-08: "Whoush needs to understand facial objects… tap the skin selects the whole skin, tap the
 * nose selects only the nose"). Runs on the device with two Google MediaPipe models (Apache-2.0, docs/evidence/SEGMENTATION.md), served from
 * /models/mediapipe:
 * - Face Landmarker, 478 points per face: the outlines of the lips, the mouth, each eye, each eyebrow, the nose and the face;
 * - the multiclass selfie segmenter, a class per pixel: hair, face skin, body skin (the neck), clothes.
 * A tap names the part under it; anything that is not a face part (a cup, a shirt, a necklace) goes to the general wand (lib/segment.ts). Browser only.
 */
import {FaceLandmarker,FilesetResolver,ImageSegmenter} from "@mediapipe/tasks-vision";
import type {Mask} from "./segment";
import {refineHairEdge} from "./hair-matte";

export type FacePart="lips"|"mouth"|"left_iris"|"right_iris"|"left_eye"|"right_eye"|"left_brow"|"right_brow"|"nose"|"skin"|"ear"|"hair"|"neck";
export const FACE_PART_FA:Record<FacePart,string>={lips:"لب‌ها",mouth:"داخل دهان",left_iris:"عنبیه",right_iris:"عنبیه",left_eye:"چشم",right_eye:"چشم",left_brow:"ابرو",right_brow:"ابرو",nose:"بینی",skin:"پوست صورت",ear:"گوش",hair:"مو",neck:"گردن و پوست بدن"};
/** The segmenter's classes (model card): 0 background, 1 hair, 2 body skin, 3 face skin, 4 clothes, 5 others. */
const HAIR=1,BODY=2,FACE=3;
/** Nose points of the face mesh (bridge, tip, wings, base); the outline is their convex hull. */
const NOSE=[168,6,197,195,5,4,1,19,94,2,98,97,326,327,64,294,48,278,49,279,129,358,219,439,218,438,237,457,115,344,131,360,198,420,236,456,3,248,196,419,122,351,193,417];

type Pt={x:number;y:number};
type Face={lipsOuter:Pt[];lipsInner:Pt[];leftEye:Pt[];rightEye:Pt[];/** The coloured ring of each eye (iris and pupil) as a circle, clipped to the eye's lids. */leftIris:Pt[];rightIris:Pt[];leftBrow:Pt[];rightBrow:Pt[];nose:Pt[];oval:Pt[]};
export type FaceAnalysis={w:number;h:number;cls:Uint8Array;faces:Face[];/** The photo's pixels (RGBA), for the hair's strand edge. */rgba?:Uint8ClampedArray};

let tasks:Promise<{face:FaceLandmarker;seg:ImageSegmenter}>|null=null;
function load(){
 return tasks??=(async()=>{
  const files=await FilesetResolver.forVisionTasks("/models/mediapipe/wasm");
  const face=await FaceLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:"/models/mediapipe/face_landmarker.task",delegate:"CPU"},runningMode:"IMAGE",numFaces:4});
  const seg=await ImageSegmenter.createFromOptions(files,{baseOptions:{modelAssetPath:"/models/mediapipe/selfie_multiclass_256x256.tflite",delegate:"CPU"},runningMode:"IMAGE",outputCategoryMask:false,outputConfidenceMasks:true});
  return {face,seg};
 })();
}

/** Chains a set of edges (start → end) into closed loops of points, the longest first. */
function loops(edges:{start:number;end:number}[],pts:Pt[]):Pt[][]{
 const next=new Map<number,number[]>();
 for(const e of edges){next.set(e.start,[...(next.get(e.start)??[]),e.end]);next.set(e.end,[...(next.get(e.end)??[]),e.start]);}
 const seen=new Set<string>(),out:Pt[][]=[];
 for(const e of edges){
  const k=e.start+"-"+e.end;if(seen.has(k))continue;
  const ring=[e.start];let prev=e.start,cur=e.end;seen.add(k);seen.add(e.end+"-"+e.start);
  while(cur!==e.start&&ring.length<200){ring.push(cur);const n=(next.get(cur)??[]).find(x=>x!==prev&&!seen.has(cur+"-"+x));if(n===undefined)break;seen.add(cur+"-"+n);seen.add(n+"-"+cur);prev=cur;cur=n;}
  out.push(ring.map(i=>pts[i]));
 }
 return out.sort((a,b)=>b.length-a.length);
}
const area=(p:Pt[])=>Math.abs(p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a.x*b.y-b.x*a.y;},0)/2);
function hull(p:Pt[]):Pt[]{
 const s=[...p].sort((a,b)=>a.x-b.x||a.y-b.y),cross=(o:Pt,a:Pt,b:Pt)=>(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x),lo:Pt[]=[],up:Pt[]=[];
 for(const q of s){while(lo.length>=2&&cross(lo[lo.length-2],lo[lo.length-1],q)<=0)lo.pop();lo.push(q);}
 for(const q of [...s].reverse()){while(up.length>=2&&cross(up[up.length-2],up[up.length-1],q)<=0)up.pop();up.push(q);}
 return [...lo.slice(0,-1),...up.slice(0,-1)];
}
/** An eyebrow's edges are two lines (top and bottom): joined into one outline, top forward and bottom back. */
function browOutline(edges:{start:number;end:number}[],pts:Pt[]):Pt[]{
 const lines=loops(edges,pts);if(lines.length<2)return hull(lines.flat());
 const [a,b]=lines,d=(p:Pt,q:Pt)=>Math.hypot(p.x-q.x,p.y-q.y);
 return [...a,...(d(a[a.length-1],b[0])<d(a[a.length-1],b[b.length-1])?b:[...b].reverse())];
}
/**
 * The iris (with the pupil) of one eye: a circle through the face mesh's four iris points, its centre their middle (owner, 2026-11-08: "change
 * pupil colours"), as a polygon; the eyelids cut it later (it is only ever used inside the eye's outline). Empty when the mesh has no iris points.
 */
function irisCircle(edges:{start:number;end:number}[],pts:Pt[]):Pt[]{
 const ring=[...new Set(edges.flatMap(e=>[e.start,e.end]))].map(i=>pts[i]).filter(Boolean);if(ring.length<3)return [];
 const c={x:ring.reduce((s,p)=>s+p.x,0)/ring.length,y:ring.reduce((s,p)=>s+p.y,0)/ring.length},r=ring.reduce((s,p)=>s+Math.hypot(p.x-c.x,p.y-c.y),0)/ring.length;
 return Array.from({length:36},(_,k)=>({x:c.x+r*Math.cos(k*Math.PI/18),y:c.y+r*Math.sin(k*Math.PI/18)}));
}
export function inside(p:Pt,poly:Pt[]):boolean{
 let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)c=!c;}return c;
}

/** Finds the faces and the hair and skin classes of a photo (once per photo; ~0.1–0.3 s after the first load). Null when the models cannot run. */
export async function analyzeFaces(img:HTMLImageElement):Promise<FaceAnalysis|null>{
 try{
  const {face,seg}=await load(),w=img.naturalWidth,h=img.naturalHeight;
  const fr=face.detect(img),sr=seg.segment(img),ms=sr.confidenceMasks;
  if(!ms?.length){sr.close?.();return null;}
  // Each class's confidence, sampled smoothly (bilinear) at the photo's own size, and the most likely class per pixel: smooth edges, not the
  // model's 256-pixel steps.
  const mw=ms[0].width,mh=ms[0].height,conf=ms.map(m=>m.getAsFloat32Array()),cls=new Uint8Array(w*h);
  for(let y=0;y<h;y++){
   const fy=Math.max(0,Math.min(mh-1,(y+0.5)*mh/h-0.5)),y0=Math.floor(fy),y1=Math.min(mh-1,y0+1),ty=fy-y0;
   for(let x=0;x<w;x++){
    const fx=Math.max(0,Math.min(mw-1,(x+0.5)*mw/w-0.5)),x0=Math.floor(fx),x1=Math.min(mw-1,x0+1),tx=fx-x0;
    let best=0,bv=-1;
    for(let k=0;k<conf.length;k++){const c=conf[k],v=(c[y0*mw+x0]*(1-tx)+c[y0*mw+x1]*tx)*(1-ty)+(c[y1*mw+x0]*(1-tx)+c[y1*mw+x1]*tx)*ty;if(v>bv){bv=v;best=k;}}
    cls[y*w+x]=best;
   }
  }
  sr.close?.();
  let rgba:Uint8ClampedArray|undefined;
  try{const c=document.createElement("canvas");c.width=w;c.height=h;const x=c.getContext("2d",{willReadFrequently:true});if(x){x.drawImage(img,0,0,w,h);rgba=x.getImageData(0,0,w,h).data;}}catch{rgba=undefined;}
  const faces=fr.faceLandmarks.map(lm=>{
   const pts=lm.map(p=>({x:p.x*w,y:p.y*h}));
   const lips=loops(FaceLandmarker.FACE_LANDMARKS_LIPS,pts).sort((a,b)=>area(b)-area(a));
   return {lipsOuter:lips[0]??[],lipsInner:lips[1]??[],leftEye:loops(FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,pts)[0]??[],rightEye:loops(FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,pts)[0]??[],
    leftIris:irisCircle(FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS,pts),rightIris:irisCircle(FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS,pts),
    leftBrow:browOutline(FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW,pts),rightBrow:browOutline(FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW,pts),
    nose:hull(NOSE.filter(i=>pts[i]).map(i=>pts[i])),oval:loops(FaceLandmarker.FACE_LANDMARKS_FACE_OVAL,pts)[0]??[]};
  });
  return {w,h,cls,faces,...(rgba?{rgba}:{})};
 }catch(e){if(process.env.NODE_ENV!=="production")console.warn("[whoush] face parts unavailable:",e instanceof Error?e.message:e);return null;}
}

/**
 * All the hair, with its strands (owner, 2026-11-08: "even thin hairs on the edge"): the segmenter's hair class, then the soft edge and flyaway strands
 * added from the photo's colours (lib/hair-matte.ts), never over skin.
 */
export function hairPlane(a:FaceAnalysis):Uint8Array{
 const {w,h,cls}=a,m=new Uint8Array(w*h);for(let i=0;i<m.length;i++)m[i]=cls[i]===HAIR?1:0;
 if(!a.rgba)return m;
 const skin=new Uint8Array(w*h);for(let i=0;i<skin.length;i++)skin[i]=cls[i]===FACE||cls[i]===BODY?1:0;
 return refineHairEdge(a.rgba,4,w,h,m,skin);
}
/** Fills polygons into a 0/1 plane (w×h). */
function rasterize(w:number,h:number,polys:Pt[][]):Uint8Array{
 const c=document.createElement("canvas");c.width=w;c.height=h;const ctx=c.getContext("2d",{willReadFrequently:true})!;
 ctx.fillStyle="#fff";for(const p of polys){if(p.length<3)continue;ctx.beginPath();ctx.moveTo(p[0].x,p[0].y);for(const q of p.slice(1))ctx.lineTo(q.x,q.y);ctx.closePath();ctx.fill();}
 const d=ctx.getImageData(0,0,w,h).data,out=new Uint8Array(w*h);for(let i=0;i<out.length;i++)out[i]=d[i*4+3]>127?1:0;return out;
}
/** An iris clipped to its eye's outline (the lids cover part of it). */
function irisMask(w:number,h:number,iris:Pt[],eye:Pt[]):Uint8Array{
 const m=rasterize(w,h,[iris]),e=rasterize(w,h,[eye]);for(let i=0;i<m.length;i++)m[i]&=e[i];return m;
}
/** The pixels of class `k` connected to (x,y), optionally limited to `allow`. */
function component(a:FaceAnalysis,x:number,y:number,ok:(i:number)=>boolean):Uint8Array{
 const {w,h}=a,out=new Uint8Array(w*h),st=[y*w+x];if(!ok(st[0]))return out;out[st[0]]=1;
 while(st.length){const i=st.pop()!,px=i%w;for(const j of [px>0?i-1:-1,px<w-1?i+1:-1,i-w,i+w])if(j>=0&&j<w*h&&!out[j]&&ok(j)){out[j]=1;st.push(j);}}
 return out;
}

/**
 * The face part under a tap (photo pixels), as a mask the size of the photo, or null when the tap is not on a face part (the general wand then
 * decides). Lips, the inside of the mouth, each eye, each eyebrow and the nose come from the outlines; the skin of the face (without the eyes,
 * eyebrows and lips), an ear (face skin beside the face outline), the hair and the neck come from the classes.
 */
export function facePartAt(a:FaceAnalysis,x:number,y:number):{part:FacePart;mask:Mask}|null{
 const {w,h,cls,faces}=a,p={x,y};
 if(x<0||y<0||x>=w||y>=h)return null;
 const out=(part:FacePart,plane:Uint8Array)=>({part,mask:{w,h,score:1,plane}});
 for(const f of faces){
  if(inside(p,f.lipsInner))return out("mouth",rasterize(w,h,[f.lipsInner]));
  if(inside(p,f.lipsOuter)){const m=rasterize(w,h,[f.lipsOuter]),hole=rasterize(w,h,[f.lipsInner]);for(let i=0;i<m.length;i++)if(hole[i])m[i]=0;return out("lips",m);}
  // A tap on the coloured part of an eye picks the iris (for its colour); a tap on the white picks the whole eye.
  if(inside(p,f.leftIris)&&inside(p,f.leftEye))return out("left_iris",irisMask(w,h,f.leftIris,f.leftEye));
  if(inside(p,f.rightIris)&&inside(p,f.rightEye))return out("right_iris",irisMask(w,h,f.rightIris,f.rightEye));
  for(const [part,poly] of [["left_eye",f.leftEye],["right_eye",f.rightEye],["left_brow",f.leftBrow],["right_brow",f.rightBrow],["nose",f.nose]] as [FacePart,Pt[]][])
   if(inside(p,poly))return out(part,rasterize(w,h,[poly]));
 }
 const k=cls[Math.floor(y)*w+Math.floor(x)];
 if(k===HAIR)return out("hair",hairPlane(a));
 if(k===BODY)return out("neck",component(a,Math.floor(x),Math.floor(y),i=>cls[i]===BODY));
 if(k===FACE){
  const ovals=rasterize(w,h,faces.map(f=>f.oval));
  // Face skin beside the face outline is an ear.
  if(faces.length&&!ovals[Math.floor(y)*w+Math.floor(x)])return out("ear",component(a,Math.floor(x),Math.floor(y),i=>cls[i]===FACE&&!ovals[i]));
  // The face's skin follows the face outline from the landmarks (an exact jaw and cheeks), without the hair over it and without the eyes,
  // eyebrows and lips; with no face found, the face-skin class alone.
  const features=rasterize(w,h,faces.flatMap(f=>[f.lipsOuter,f.leftEye,f.rightEye,f.leftBrow,f.rightBrow]));
  const m=new Uint8Array(w*h);for(let i=0;i<m.length;i++)m[i]=(faces.length?ovals[i]&&cls[i]!==HAIR:cls[i]===FACE)&&!features[i]?1:0;
  return out("skin",m);
 }
 return null;
}

/**
 * Every face part of the photo's faces, each with its mask and its bounding box (0..1): for matching the areas Whoush marked itself (a box per area) to
 * the exact part they mean (lib/suggested-masks.ts): the skin of a face, the lips, the eyes (each and both), the irises (each and both), the eyebrows (each and both), the nose,
 * the hair, the neck.
 */
export function facePartMasks(a:FaceAnalysis):{part:FacePart|"eyes"|"brows"|"irises"|"all_skin";mask:Mask;box:[number,number,number,number]}[]{
 const {w,h,cls,faces}=a,out:{part:FacePart|"eyes"|"brows"|"irises"|"all_skin";mask:Mask;box:[number,number,number,number]}[]=[];
 const add=(part:FacePart|"eyes"|"brows"|"irises"|"all_skin",plane:Uint8Array)=>{
  let x0=w,y0=h,x1=-1,y1=-1;for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(plane[y*w+x]){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}
  if(x1>=0)out.push({part,mask:{w,h,score:1,plane},box:[x0/w,y0/h,(x1+1)/w,(y1+1)/h]});
 };
 const ovals=rasterize(w,h,faces.map(f=>f.oval));
 for(const f of faces){
  const lips=rasterize(w,h,[f.lipsOuter]),hole=rasterize(w,h,[f.lipsInner]);for(let i=0;i<lips.length;i++)if(hole[i])lips[i]=0;
  add("lips",lips);add("left_eye",rasterize(w,h,[f.leftEye]));add("right_eye",rasterize(w,h,[f.rightEye]));add("eyes",rasterize(w,h,[f.leftEye,f.rightEye]));
  const li=irisMask(w,h,f.leftIris,f.leftEye),ri=irisMask(w,h,f.rightIris,f.rightEye),both=li.map((v,i)=>v|ri[i]);
  add("left_iris",li);add("right_iris",ri);add("irises",both);
  add("left_brow",rasterize(w,h,[f.leftBrow]));add("right_brow",rasterize(w,h,[f.rightBrow]));add("brows",rasterize(w,h,[f.leftBrow,f.rightBrow]));
  add("nose",rasterize(w,h,[f.nose]));
 }
 if(faces.length){
  const features=rasterize(w,h,faces.flatMap(f=>[f.lipsOuter,f.leftEye,f.rightEye,f.leftBrow,f.rightBrow]));
  const skin=new Uint8Array(w*h);for(let i=0;i<skin.length;i++)skin[i]=ovals[i]&&cls[i]!==HAIR&&!features[i]?1:0;add("skin",skin);
 }
 // All visible skin (owner, 2026-11-08: "change the skin colour"): the face's skin, the forehead above the face outline, the ears, the neck, arms and
 // hands, without the eyes, eyebrows and lips, so a new tone never stops at the jaw.
 {const features=rasterize(w,h,faces.flatMap(f=>[f.lipsOuter,f.leftEye,f.rightEye,f.leftBrow,f.rightBrow]));
  const all=new Uint8Array(w*h);for(let i=0;i<all.length;i++)all[i]=(cls[i]===FACE||cls[i]===BODY||(ovals[i]&&cls[i]!==HAIR))&&!features[i]?1:0;add("all_skin",all);}
 add("hair",hairPlane(a));
 const body=new Uint8Array(w*h);for(let i=0;i<body.length;i++)body[i]=cls[i]===BODY?1:0;add("neck",body);
 return out;
}
