/**
 * The areas Whoush marked on a photo (boxes in 0..1, lib/edit-card.ts) as brush masks, one canvas per area at the photo's own size: what the editor
 * opens with, and what «بساز» on the edit card sends without opening the editor. Browser only.
 */
import {MAX_NOTE,MAX_REGIONS,REGION_COLORS,type Region} from "./region-edit";
import {maskInBox,paintMask,prepare,type Mask} from "./segment";
import {analyzeFaces,facePartMasks} from "./face-parts";
import {refineMask} from "./mask-refine";

export type SuggestedArea={note:string;boxes:readonly (readonly [number,number,number,number])[]};

/** Paints one area's boxes onto its layer, in its colour. */
export function paintSuggested(ctx:CanvasRenderingContext2D,slot:number,boxes:SuggestedArea["boxes"],w:number,h:number){
 ctx.fillStyle=REGION_COLORS[slot].css;
 for(const [x0,y0,x1,y1] of boxes){const x=x0*w,y=y0*h,bw=(x1-x0)*w,bh=(y1-y0)*h;
  ctx.beginPath();ctx.ellipse(x+bw/2,y+bh/2,Math.max(2,bw/2),Math.max(2,bh/2),0,0,Math.PI*2);ctx.fill();}
}

/** Overlap of two boxes (intersection over union), 0..1. */
const iou=(a:readonly number[],b:readonly number[])=>{const ix=Math.max(0,Math.min(a[2],b[2])-Math.max(a[0],b[0])),iy=Math.max(0,Math.min(a[3],b[3])-Math.max(a[1],b[1])),i=ix*iy;
 const u=(a[2]-a[0])*(a[3]-a[1])+(b[2]-b[0])*(b[3]-b[1])-i;return u>0?i/u:0;};
const exactCache=new Map<string,Promise<(Mask|null)[]>>();
/**
 * The exact area for each of Whoush's marked areas (owner, 2026-11-08: "use the accurate selecting in the widget too… not inaccurate circles"), the same
 * for the widget's preview, the editor and «بساز»: a face part when a box matches one (the skin, the lips, the eyes…, by overlap), else the object in
 * the box (lib/segment.ts), else null (the soft oval is then used). Remembered per photo and areas; the model waits at most `waitMs`.
 */
export function exactAreas(photoUrl:string,areas:readonly SuggestedArea[],waitMs=10_000):Promise<(Mask|null)[]>{
 const key=photoUrl+"|"+JSON.stringify(areas.map(a=>a.boxes));
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
    const plane=new Uint8Array(w*h);let any=false;
    for(const box of a.boxes){
     const best=parts.map(p=>({p,o:iou(p.box,box)})).sort((x,y)=>y.o-x.o)[0];
     let m:Mask|null=best&&best.o>=0.45?best.p.mask:null;
     if(!m&&samReady){try{m=await maskInBox(photoUrl,[box[0]*w,box[1]*h,box[2]*w,box[3]*h]);}catch{m=null;}}
     if(!m)continue;
     // Masks may come at another size (the segmenter's photo size equals this one; SAM's too): sampled to this photo's size.
     for(let y=0;y<h;y++){const sy=Math.min(m.h-1,Math.floor(y*m.h/h));for(let x=0;x<w;x++)if(m.plane[sy*m.w+Math.min(m.w-1,Math.floor(x*m.w/w))]){plane[y*w+x]=1;any=true;}}
    }
    out.push(any?{w,h,score:1,plane:refineMask(plane,w,h,{maxHole:0.002,minIsland:0.05,smooth:0.002})}:null);
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
  masks.push(c);regions.push({n:slot+1,color:REGION_COLORS[slot].name,note:a.note.trim().slice(0,MAX_NOTE)});
 }
 return {masks,regions};
}
