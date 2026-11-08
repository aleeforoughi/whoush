/// <reference lib="webworker" />
/**
 * On-device segmentation for the magic wand and Whoush's exact masks (owner, 2026-11-08; docs/evidence/SEGMENTATION.md). Runs SlimSAM-77 (Apache-2.0)
 * through transformers.js in this worker, off the main thread. The model and its WebAssembly runtime are served by Whoush from /models (npm run
 * models); nothing is fetched from elsewhere and the photo never leaves the device.
 *
 * Messages: {kind:"embed", key, blob} encodes a photo once (~1-3 s); {kind:"mask", key, points, labels, box?} returns its best mask in ~0.1 s, in the
 * photo's own pixels. A box always comes with its centre as a point (transformers.js 4.3.2 reads input_points even for a box).
 */
import {AutoProcessor,RawImage,SamModel,env,type Processor,type Tensor} from "@huggingface/transformers";
import {refineMask} from "./mask-refine";

env.allowRemoteModels=false;env.allowLocalModels=true;env.localModelPath="/models/";
if(env.backends.onnx.wasm)env.backends.onnx.wasm.wasmPaths="/models/ort/";
const ID="Xenova/slimsam-77-uniform";

type Embedded={sizes:{original:[number,number][];reshaped:[number,number][]};emb:Record<string,Tensor>};
type Req={id:number}&({kind:"embed";key:string;blob:Blob}|{kind:"mask";key:string;points:[number,number][];labels:number[];box?:[number,number,number,number];detail?:boolean});

let loaded:Promise<{model:SamModel;processor:Processor}>|null=null;
const load=()=>loaded??=(async()=>({model:await SamModel.from_pretrained(ID,{dtype:"q8"}) as SamModel,processor:await AutoProcessor.from_pretrained(ID)}))();
/** The last few photos' encodings (a photo is encoded once, however many taps). */
const photos=new Map<string,Promise<Embedded>>();

async function embed(key:string,blob:Blob):Promise<Embedded>{
 const {model,processor}=await load();
 const raw=await RawImage.fromBlob(blob);
 const base=await processor(raw) as {original_sizes:[number,number][];reshaped_input_sizes:[number,number][]};
 const emb=await (model as unknown as {get_image_embeddings:(x:unknown)=>Promise<Record<string,Tensor>>}).get_image_embeddings(base);
 return {sizes:{original:base.original_sizes,reshaped:base.reshaped_input_sizes},emb};
}

async function mask(key:string,points:[number,number][],labels:number[],box?:[number,number,number,number],detail=false){
 const photo=photos.get(key);if(!photo)throw new Error("not embedded");
 const {sizes,emb}=await photo,{model,processor}=await load();
 const ip=processor.image_processor as unknown as {reshape_input_points:(p:unknown,o:unknown,r:unknown,b?:boolean)=>Tensor;add_input_labels:(l:unknown,p:Tensor)=>Tensor;
  post_process_masks:(m:Tensor,o:unknown,r:unknown)=>Promise<Tensor[]>};
 const input_points=ip.reshape_input_points([[points]],sizes.original,sizes.reshaped);
 const input_labels=ip.add_input_labels([[labels]],input_points);
 const input_boxes=box?ip.reshape_input_points([[box]],sizes.original,sizes.reshaped,true):undefined;
 const out=await (model as unknown as (x:unknown)=>Promise<{pred_masks:Tensor;iou_scores:Tensor}>)({...emb,input_points,input_labels,...(input_boxes?{input_boxes}:{})});
 const masks=await ip.post_process_masks(out.pred_masks,sizes.original,sizes.reshaped);
 const iou=Array.from(out.iou_scores.data as Float32Array),top=Math.max(...iou);
 const m=masks[0],[, ,h,w]=m.dims as number[],data=m.data as Uint8Array;
 // SAM answers each tap with three masks, from a small part to the whole object. A tap («the mustache») takes the smallest one that is nearly as
 // confident as the best (owner, 2026-11-08: the finest detail); a box takes the most confident (the whole object in it).
 const area=(i:number)=>{let n=0;for(let j=i*w*h,e=(i+1)*w*h;j<e;j++)n+=data[j]?1:0;return n;};
 const best=detail?iou.map((v,i)=>({i,v})).filter(c=>c.v>=top-0.04).map(c=>({...c,a:area(c.i)})).filter(c=>c.a>0).sort((a,b)=>a.a-b.a)[0]?.i??iou.indexOf(top):iou.indexOf(top);
 // Cleaned before it is drawn: small holes filled, specks dropped, edges smoothed (lib/mask-refine.ts).
 const plane=refineMask(data.subarray(best*w*h,(best+1)*w*h),w,h);
 return {w,h,score:iou[best],plane};
}

self.onmessage=async(e:MessageEvent<Req>)=>{
 const r=e.data;
 try{
  if(r.kind==="embed"){
   if(!photos.has(r.key)){photos.set(r.key,embed(r.key,r.blob));while(photos.size>3)photos.delete(photos.keys().next().value!);}
   await photos.get(r.key);self.postMessage({id:r.id,ok:true});
  }else{
   const m=await mask(r.key,r.points,r.labels,r.box,r.detail);
   self.postMessage({id:r.id,ok:true,...m},{transfer:[m.plane.buffer]});
  }
 }catch(err){
  if(r.kind==="embed")photos.delete(r.key);
  self.postMessage({id:r.id,ok:false,error:err instanceof Error?err.name+": "+err.message.slice(0,200):"error"});
 }
};
