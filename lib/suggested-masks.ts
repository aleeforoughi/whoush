/**
 * The areas Whoush marked on a photo (boxes in 0..1, lib/edit-card.ts) as brush masks, one canvas per area at the photo's own size: what the editor
 * opens with, and what «بساز» on the edit card sends without opening the editor. Browser only.
 */
import {MAX_NOTE,MAX_REGIONS,REGION_COLORS,TARGET_OF_PART,type Region} from "./region-edit";
import {maskInBox,paintMask,prepare,type Mask} from "./segment";
import {analyzeFaces,facePartMasks} from "./face-parts";
import {refineMask,withRoom} from "./mask-refine";

export type SuggestedArea={note:string;boxes:readonly (readonly [number,number,number,number])[];/** The part the vision step named (lib/edit-card.ts). */part?:string;/** Room for a new size or shape (lib/edit-card.ts). */grow?:true};
/** A named part (lib/edit-card.ts EDIT_PARTS) as the face-part masks call it (lib/face-parts.ts). */
const PART_MASK:Record<string,string>={lips:"lips",eyes:"eyes",irises:"irises",eyebrows:"brows",nose:"nose","face skin":"skin","all skin":"all_skin",hair:"hair",neck:"neck"};

/** Face parts an area that grows never spreads over unless it is that part (fuller lips do not cover the nose; new hair leaves the eyes). */
const KEEP_CLEAR=new Set(["lips","mouth","left_eye","right_eye","left_brow","right_brow","nose","left_iris","right_iris"]);


/** Paints one area's boxes onto its layer, in its colour. */
export function paintSuggested(ctx:CanvasRenderingContext2D,slot:number,boxes:SuggestedArea["boxes"],w:number,h:number){
 ctx.fillStyle=REGION_COLORS[slot].css;
 for(const [x0,y0,x1,y1] of boxes){const x=x0*w,y=y0*h,bw=(x1-x0)*w,bh=(y1-y0)*h;
  ctx.beginPath();ctx.ellipse(x+bw/2,y+bh/2,Math.max(2,bw/2),Math.max(2,bh/2),0,0,Math.PI*2);ctx.fill();}
}

/** Overlap of two boxes (intersection over union), 0..1. */
const iou=(a:readonly number[],b:readonly number[])=>{const ix=Math.max(0,Math.min(a[2],b[2])-Math.max(a[0],b[0])),iy=Math.max(0,Math.min(a[3],b[3])-Math.max(a[1],b[1])),i=ix*iy;
 const u=(a[2]-a[0])*(a[3]-a[1])+(b[2]-b[0])*(b[3]-b[1])-i;return u>0?i/u:0;};
/** The inner face of each face found: an oval around its eyebrows, eyes, nose and lips, a little larger (identity: what a hair edit never touches). */
function innerFace(parts:ReturnType<typeof facePartMasks>,w:number,h:number):Uint8Array|null{
 const out=new Uint8Array(w*h);let any=false;
 // One oval per face: its eyebrows (both) are the top, its lips the bottom.
 for(const brows of parts.filter(p=>p.part==="brows")){
  const lips=parts.filter(p=>p.part==="lips").sort((a,b)=>Math.abs((a.box[0]+a.box[2])-(brows.box[0]+brows.box[2]))-Math.abs((b.box[0]+b.box[2])-(brows.box[0]+brows.box[2])))[0];
  const x0=Math.min(brows.box[0],lips?.box[0]??1)*w,x1=Math.max(brows.box[2],lips?.box[2]??0)*w,y0=brows.box[1]*h,y1=(lips?.box[3]??brows.box[3])*h;
  const cx=(x0+x1)/2,cy=(y0+y1)/2,rx=(x1-x0)/2*1.12,ry=(y1-y0)/2*1.22;
  for(let y=Math.max(0,Math.floor(cy-ry));y<Math.min(h,Math.ceil(cy+ry));y++)for(let x=Math.max(0,Math.floor(cx-rx));x<Math.min(w,Math.ceil(cx+rx));x++)
   if(((x+.5-cx)/rx)**2+((y+.5-cy)/ry)**2<=1){out[y*w+x]=1;any=true;}
 }
 return any?out:null;
}
const exactCache=new Map<string,Promise<(Mask|null)[]>>();
/**
 * The exact area for each of Whoush's marked areas (owner, 2026-11-08: "use the accurate selecting in the widget too… not inaccurate circles"), the same
 * for the widget's preview, the editor and «بساز»: a face part when a box matches one (the skin, the lips, the eyes…, by overlap), else the object in
 * the box (lib/segment.ts), else null (the soft oval is then used). Remembered per photo and areas; the model waits at most `waitMs`.
 */
export function exactAreas(photoUrl:string,areas:readonly SuggestedArea[],waitMs=10_000):Promise<(Mask|null)[]>{
 const key=photoUrl+"|"+JSON.stringify(areas.map(a=>[a.boxes,a.part??"",a.grow??false]));
 let p=exactCache.get(key);
 if(!p){
  p=(async()=>{
   const img=new Image();img.src=photoUrl;await img.decode();
   const w=img.naturalWidth,h=img.naturalHeight,timeout=<T,>(x:Promise<T>,fb:T)=>Promise.race([x,new Promise<T>(r=>setTimeout(()=>r(fb),waitMs))]);
   const [faces,samReady]=await Promise.all([
    timeout(analyzeFaces(img),null),
    timeout((async()=>{try{await prepare(photoUrl,await (await fetch(photoUrl)).blob());return true;}catch{return false;}})(),false)]);
   const parts=faces?facePartMasks(faces):[];
   const out:(Mask|null)[]=[];
   for(const a of areas.slice(0,MAX_REGIONS)){
    const plane=new Uint8Array(w*h);let any=false;const used=new Set<string>();
    for(const box of a.boxes){
     // The part the vision step named, on the face its box is on (owner, 2026-11-08: eye colour marked the hair when matched by box overlap alone);
     // else the face part whose box matches this one well.
     const named=a.part?PART_MASK[a.part]:undefined,overlap=(p:{box:readonly number[]})=>Math.max(0,Math.min(p.box[2],box[2])-Math.max(p.box[0],box[0]))*Math.max(0,Math.min(p.box[3],box[3])-Math.max(p.box[1],box[1]));
     const byName=named?parts.filter(p=>p.part===named&&overlap(p)>0).sort((x,y)=>overlap(y)-overlap(x))[0]:undefined;
     const byBox=parts.map(p=>({p,o:iou(p.box,box)})).sort((x,y)=>y.o-x.o)[0];
     const best=byName?{p:byName,o:1}:byBox;
     let m:Mask|null=best&&best.o>=0.45?best.p.mask:null;if(m)used.add(best!.p.part);else used.add("object");
     if(!m&&samReady){try{m=await maskInBox(photoUrl,[box[0]*w,box[1]*h,box[2]*w,box[3]*h]);}catch{m=null;}}
     if(!m)continue;
     // Masks may come at another size (the segmenter's photo size equals this one; SAM's too): sampled to this photo's size.
     let one:Uint8Array=new Uint8Array(w*h);
     for(let y=0;y<h;y++){const sy=Math.min(m.h-1,Math.floor(y*m.h/h));for(let x=0;x<w;x++)if(m.plane[sy*m.w+Math.min(m.w-1,Math.floor(x*m.w/w))])one[y*w+x]=1;}
     const self=best&&best.o>=0.45?best.p.part:"";
     // Hair (owner, 2026-11-08: a new hairstyle or colour) takes in the thin strands along its edge, which the segmenter calls skin, so none keeps
     // its old colour; the inner face (eyebrows to mouth) is never part of it.
     const inner=self==="hair"?innerFace(parts,w,h):null;
     if(self==="hair")one=withRoom(one,w,h,[0,0,1,1],inner?[inner]:[],0.012*Math.max(w,h));
     if(a.grow){const clear=parts.filter(p=>KEEP_CLEAR.has(p.part)&&p.part!==self&&!(self==="lips"&&p.part==="mouth")).map(p=>p.mask.plane);
      if(self==="hair"){
       // A new hairstyle (owner, 2026-11-08) keeps the inner face exactly; the model redraws the hairline and the edges of the forehead and jaw, and
       // the alignment in lib/region-restore.ts lines its result up with the kept inner face. Its room is the box widened a little and carried down to
       // the bottom of the photo: longer hair falls onto the shoulders and the clothes under it are redrawn as one piece. Tried and dropped: keeping all
       // the skin (a cut-out edge, old strands left), keeping nothing (a second pair of eyebrows), a room ending at the shoulders (the hair cut off
       // in a curve, and a second neckline where the model's clothes met the photo's).
       if(inner)clear.push(inner);
       const bw=box[2]-box[0],x0=Math.floor(Math.max(0,box[0]-0.1*bw)*w),x1=Math.ceil(Math.min(1,box[2]+0.1*bw)*w),y0=Math.floor(box[1]*h);
       for(let y=y0;y<h;y++)for(let x=x0;x<x1;x++){const i=y*w+x;if(!clear.some(k=>k[i]))one[i]=1;}
      }else one=withRoom(one,w,h,box,clear);}
     for(let i=0;i<one.length;i++)if(one[i]){plane[i]=1;any=true;}
    }
    out.push(any?{w,h,score:1,plane:refineMask(plane,w,h,{maxHole:0.002,minIsland:0.05,smooth:used.has("hair")?0:0.002}),...(used.size===1&&!used.has("object")?{part:[...used][0]}:{})}:null);
   }
   return out;
  })();
  exactCache.set(key,p);if(exactCache.size>8)exactCache.delete(exactCache.keys().next().value!);
  p.catch(()=>exactCache.delete(key));
 }
 return p;
}

/**
 * Loads the photo and returns one mask per area (at most five) with its region (#ادیت-n, colour, comment): the exact area (exactAreas above), or the
 * soft oval when the device cannot find it.
 */
export async function suggestedMasks(photoUrl:string,areas:readonly SuggestedArea[],waitMs=10_000):Promise<{masks:HTMLCanvasElement[];regions:Region[]}>{
 const img=new Image();img.src=photoUrl;await img.decode();
 const w=img.naturalWidth,h=img.naturalHeight,masks:HTMLCanvasElement[]=[],regions:Region[]=[];
 const exact=await exactAreas(photoUrl,areas,waitMs).catch(()=>[] as (Mask|null)[]);
 for(const [slot,a] of areas.slice(0,MAX_REGIONS).entries()){
  const c=document.createElement("canvas");c.width=w;c.height=h;
  const ctx=c.getContext("2d");if(!ctx)continue;
  const m=exact[slot];
  if(m)paintMask(ctx,m,REGION_COLORS[slot].css);else paintSuggested(ctx,slot,a.boxes,w,h);
  const target=m?.part?TARGET_OF_PART[m.part]:undefined;
  masks.push(c);regions.push({n:slot+1,color:REGION_COLORS[slot].name,note:a.note.trim().slice(0,MAX_NOTE),...(target?{target}:{}),...(a.grow?{grow:true as const}:{})});
 }
 return {masks,regions};
}
