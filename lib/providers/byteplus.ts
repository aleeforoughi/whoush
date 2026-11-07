import "server-only";
import {findMediaModel,type MediaConfiguration} from "../catalog";
import {mirrorMedia} from "../media-store";
import {REFERENCE_PROMPT_NOTE} from "../media-provider";
import type {MediaProvider,ProviderJob,ProviderOutput,ProviderState,ProviderStatus} from "../media-provider";
import {NotCancelableError,SubmissionUnknownError} from "../provider-errors";
import {runStatus,startRun} from "./sync-runner";
import type {MediaModel} from "../types";
import {markModelNotOpen} from "../model-availability";
import {audioCheckAvailable} from "../audio-check";
/**
 * BytePlus ModelArk (ByteDance), docs/evidence/BYTEPLUS.md. Base https://ark.ap-southeast.bytepluses.com/api/v3, `Authorization: Bearer <key>`.
 * Seedream images: POST /images/generations, synchronous, result URL valid 24 h (mirrored at once). Seedance video: POST /contents/generations/tasks,
 * then GET …/{id}; DELETE cancels only while queued. No idempotency anywhere: never resent.
 */
const BASE="https://ark.ap-southeast.bytepluses.com/api/v3";
const auth=()=>{const k=process.env.BYTEPLUS_API_KEY;if(!k)throw new Error("BytePlus credentials missing");return {"Authorization":"Bearer "+k,"Content-Type":"application/json"};};
export class BytePlusHttpError extends Error{constructor(readonly status:number,readonly code:string){super("BytePlus request failed: "+status+(code?" "+code:""));this.name="BytePlusHttpError";}}
const ratioOf=(a?:string)=>{const m=/^(\d+):(\d+)$/.exec(a??"");return m?Number(m[1])/Number(m[2]):1;};
/** Explicit pixel size for the SKU's pixel budget at the canvas aspect ratio (the size keyword alone cannot carry a ratio), in multiples of 16. */
export function seedreamSize(pixels:number,aspect?:string):string{
 const r=Math.min(16,Math.max(1/16,ratioOf(aspect))),w=Math.round(Math.sqrt(pixels*r)/16)*16,h=Math.round(Math.sqrt(pixels/r)/16)*16;
 return w+"x"+h;
}
/** With references, `image` carries them as base64 data URLs (docs/evidence/BYTEPLUS.md, image request fields). */
export function buildSeedreamRequest(model:MediaModel,prompt:string,c:MediaConfiguration,references:readonly {bytes:Uint8Array;mime:string}[]=[]):Record<string,unknown>{
 if(model.provider!=="byteplus"||model.kind!=="image"||!model.providerModel)throw new Error("Not a Seedream model");
 const px=model.providerParams?.pixels;if(typeof px!=="number")throw new Error("SKU has no pixel budget");
 // `watermark` defaults to true at BytePlus (a visible «AI-generated» mark); kept until the owner decides (docs/PROVIDERS.md).
 const max=model.capabilities.referenceImages.supported?model.capabilities.referenceImages.max??0:0;
 if(references.length>max)throw new Error("Too many reference images for this model");
 const image=references.map(r=>"data:"+r.mime+";base64,"+Buffer.from(r.bytes).toString("base64"));
 return {model:model.providerModel,prompt:references.length?prompt+REFERENCE_PROMPT_NOTE:prompt,size:seedreamSize(px,c.aspectRatio),response_format:"url",output_format:"png",watermark:true,...(image.length?{image}:{})};
}
const SEEDANCE_RATIOS=["16:9","4:3","1:1","3:4","9:16","21:9"];
/** `withAudio`: only when the soundtrack check can run (lib/audio-check.ts) and the SKU has sound at its approved price; otherwise silent. */
export function buildSeedanceRequest(model:MediaModel,prompt:string,c:MediaConfiguration,withAudio=false):Record<string,unknown>{
 if(model.provider!=="byteplus"||model.kind!=="video"||!model.providerModel)throw new Error("Not a Seedance model");
 const res=model.providerParams?.resolution,dur=c.durationSeconds??model.durationSeconds;
 if(typeof res!=="string"||!dur)throw new Error("SKU has no resolution or duration");
 return {model:model.providerModel,content:[{type:"text",text:prompt}],resolution:res,ratio:c.aspectRatio&&SEEDANCE_RATIOS.includes(c.aspectRatio)?c.aspectRatio:"16:9",
  duration:dur,generate_audio:withAudio&&model.capabilities.audio,watermark:false}; // sound only when it will be checked before it is shown
}
/** `modelId`: a refusal as not open for the account stops Whoush offering that model (lib/model-availability.ts). */
async function call(method:string,path:string,body?:unknown,modelId?:string):Promise<unknown>{
 const r=await fetch(BASE+path,{method,headers:auth(),body:body===undefined?undefined:JSON.stringify(body),cache:"no-store",signal:AbortSignal.timeout(120_000)});
 const json=await r.json().catch(()=>undefined) as {error?:{code?:string}}|undefined;
 if(!r.ok){const code=json?.error?.code??"";if(code==="ModelNotOpen"&&modelId)markModelNotOpen(modelId);throw new BytePlusHttpError(r.status,code);}
 return json;
}
const TASK_STATE:Record<string,ProviderState>={queued:"queued",running:"running",succeeded:"completed",failed:"failed",cancelled:"canceled",expired:"failed"};
export class BytePlusMediaProvider implements MediaProvider{
 async submit(job:ProviderJob):Promise<{providerRequestId:string}>{
  const model=findMediaModel(job.modelId);if(!model)throw new Error("Unknown model");auth();
  if(model.kind==="image"){
   const body=buildSeedreamRequest(model,job.prompt,job.configuration,job.references);
   return {providerRequestId:"img_"+startRun(async()=>{
    const r=await call("POST","/images/generations",body,model.id) as {data?:{url?:string;error?:unknown}[]};
    const outputs:ProviderOutput[]=[];
    for(const d of r?.data??[])if(typeof d.url==="string"){const m=await mirrorMedia(d.url,undefined,"image/png");outputs.push({kind:"image",url:m.url,needsMirroring:true,mime:m.mime});}
    return outputs;
   })};
  }
  const body=buildSeedanceRequest(model,job.prompt,job.configuration,model.capabilities.audio&&job.configuration.audio!==false&&await audioCheckAvailable()); // the card's sound toggle
  let r:{id?:unknown};
  try{r=await call("POST","/contents/generations/tasks",body,model.id) as {id?:unknown};}
  catch(e){
   if(e instanceof BytePlusHttpError&&e.status<500)throw e; // a 4xx refusal: nothing was created
   throw new SubmissionUnknownError(e instanceof BytePlusHttpError?"http_"+e.status:"network"); // may exist: never resent (no idempotency)
  }
  if(typeof r?.id!=="string"||!r.id)throw new SubmissionUnknownError("malformed_response");
  return {providerRequestId:"task_"+r.id};
 }
 async status(id:string):Promise<ProviderStatus>{
  if(id.startsWith("img_"))return runStatus(id.slice(4));
  const t=await call("GET","/contents/generations/tasks/"+encodeURIComponent(id.replace(/^task_/,""))) as {status?:string;content?:{video_url?:string}};
  const state=TASK_STATE[t?.status??""];if(!state)throw new Error("Unknown provider status"); // never guess an undocumented status
  if(state!=="completed")return {state,outputs:[]};
  const url=t.content?.video_url;if(typeof url!=="string")return {state:"failed",outputs:[]};
  const m=await mirrorMedia(url,undefined,"video/mp4");return {state,outputs:[{kind:"video",url:m.url,needsMirroring:true,mime:m.mime}]};
 }
 async cancel(id:string):Promise<void>{
  if(id.startsWith("img_"))throw new NotCancelableError();
  try{await call("DELETE","/contents/generations/tasks/"+encodeURIComponent(id.replace(/^task_/,"")));}
  catch(e){if(e instanceof BytePlusHttpError&&e.status<500)throw new NotCancelableError();throw e;} // only a queued task can be canceled
 }
 resendSafe():boolean{return false;}
}
