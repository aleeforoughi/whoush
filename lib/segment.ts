/**
 * The studio's side of on-device segmentation (lib/segment.worker.ts): one worker for the page, started on first use. A photo is encoded once
 * (`prepare`), then each tap or box returns a mask in the photo's own pixels. Browser only. Everything degrades: when the worker or the model cannot
 * run, callers fall back to the brush (wand) or to the soft ovals (Whoush's marked areas).
 */
import {spillsOut} from "./mask-refine";
/** `part`: the face part it is, when it came from lib/face-parts.ts (it names the region in the edit prompt). */
export type Mask={w:number;h:number;score:number;plane:Uint8Array;part?:string};
type Pending={resolve:(v:unknown)=>void;reject:(e:Error)=>void};

let worker:Worker|null=null,seq=0;
const pending=new Map<number,Pending>();
function get():Worker{
 if(worker)return worker;
 worker=new Worker(new URL("./segment.worker.ts",import.meta.url),{type:"module"});
 worker.onmessage=(e:MessageEvent<{id:number;ok:boolean;error?:string}&Partial<Mask>>)=>{
  const p=pending.get(e.data.id);if(!p)return;pending.delete(e.data.id);
  if(e.data.ok)p.resolve(e.data);else p.reject(new Error(e.data.error??"segment"));
 };
 worker.onerror=e=>{for(const p of pending.values())p.reject(new Error("worker: "+(e.message||"failed to start")));pending.clear();worker?.terminate();worker=null;};
 return worker;
}
function call<T>(msg:object,ms:number):Promise<T>{
 const id=++seq;
 return new Promise<T>((resolve,reject)=>{
  pending.set(id,{resolve:resolve as (v:unknown)=>void,reject});
  get().postMessage({id,...msg});
  setTimeout(()=>{if(pending.delete(id))reject(new Error("timeout"));},ms);
 });
}
/** Encodes a photo for the taps that follow (the first call also loads the model, ~14 MB, cached by the browser after). */
export const prepare=(key:string,blob:Blob)=>call<void>({kind:"embed",key,blob},60_000);
/** The object under these points (label 1 adds, 0 excludes), in the photo's pixels. */
export const maskAt=(key:string,points:[number,number][],labels:number[]=points.map(()=>1))=>call<Mask>({kind:"mask",key,points,labels,detail:true},20_000);
/**
 * The object inside this box (photo pixels). The box goes to SAM as its two corners with SAM's box labels (2 top-left, 3 bottom-right): this model file
 * has no box input (it ignored one, and the box's centre alone picked the hair for a box around both eyes; 2026-11-08). An answer that spills well
 * outside the box is not the object in it, and comes back as null.
 */
export const maskInBox=async(key:string,box:[number,number,number,number]):Promise<Mask|null>=>{
 const m=await call<Mask>({kind:"mask",key,points:[[box[0],box[1]],[box[2],box[3]]],labels:[2,3]},20_000);
 return spillsOut(m,box,0.1)>0.25?null:m;
};


/** Paints a mask onto a region's layer in its colour (added to what is there), or erases it from the layer (`erase`). */
export function paintMask(ctx:CanvasRenderingContext2D,m:Mask,css:string,erase=false){
 const c=document.createElement("canvas");c.width=m.w;c.height=m.h;
 const cx=c.getContext("2d")!,img=cx.createImageData(m.w,m.h);
 for(let i=0;i<m.plane.length;i++)if(m.plane[i])img.data[i*4+3]=255;
 cx.putImageData(img,0,0);
 cx.globalCompositeOperation="source-in";cx.fillStyle=css;cx.fillRect(0,0,m.w,m.h);
 ctx.save();if(erase)ctx.globalCompositeOperation="destination-out";
 ctx.drawImage(c,0,0,ctx.canvas.width,ctx.canvas.height);ctx.restore();
}
