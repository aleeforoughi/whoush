import "server-only";
import {findMediaModel,type MediaConfiguration} from "../catalog";
import {storeMedia,type StoredMime} from "../media-store";
import type {MediaProvider,ProviderJob,ProviderOutput,ProviderStatus} from "../media-provider";
import {NotCancelableError} from "../provider-errors";
import {runStatus,startRun} from "./sync-runner";
import type {MediaModel} from "../types";
/**
 * Google Gemini API, Nano Banana images (docs/evidence/GOOGLE.md): POST /v1beta/interactions, key in the x-goog-api-key header (never the URL),
 * synchronous, base64 image in steps[].content[]. No idempotency: never resent. The model and size are the SKU's; the canvas aspect ratio is used when the
 * model lists it.
 */
const BASE="https://generativelanguage.googleapis.com/v1beta/interactions";
const IMAGE_MIME:readonly string[]=["image/png","image/jpeg","image/webp"];
export class GoogleHttpError extends Error{constructor(readonly status:number,readonly code:string){super("Google request failed: "+status+(code?" "+code:""));this.name="GoogleHttpError";}}
export function buildGoogleImageRequest(model:MediaModel,prompt:string,c:MediaConfiguration):Record<string,unknown>{
 if(model.provider!=="google"||model.kind!=="image"||!model.providerModel)throw new Error("Not a Google image model");
 const size=model.providerParams?.image_size;if(typeof size!=="string")throw new Error("SKU has no image size");
 const aspect=c.aspectRatio&&model.capabilities.aspectRatios.includes(c.aspectRatio)?{aspect_ratio:c.aspectRatio}:{};
 return {model:model.providerModel,input:prompt,response_format:{type:"image",image_size:size,...aspect},store:false};
}
type Block={type?:string;mime_type?:string;data?:string};
/** The generated image blocks of a completed interaction (the model_output steps). */
export function googleImages(body:unknown):{mime:StoredMime;bytes:Uint8Array}[]{
 const b=body as {status?:string;steps?:{type?:string;content?:Block[]}[]};
 if(b?.status&&b.status!=="completed")throw new Error("Interaction not completed: "+b.status);
 const out:{mime:StoredMime;bytes:Uint8Array}[]=[];
 for(const step of b?.steps??[])if(step.type==="model_output")for(const c of step.content??[])
  if(c.type==="image"&&typeof c.data==="string"&&IMAGE_MIME.includes(c.mime_type??""))out.push({mime:c.mime_type as StoredMime,bytes:Buffer.from(c.data,"base64")});
 return out;
}
export class GoogleMediaProvider implements MediaProvider{
 async submit(job:ProviderJob):Promise<{providerRequestId:string}>{
  const model=findMediaModel(job.modelId),key=process.env.GEMINI_API_KEY;
  if(!model||!key)throw new Error("Google generation unavailable");
  const body=buildGoogleImageRequest(model,job.prompt,job.configuration); // a mapping error is definite: nothing was sent
  return {providerRequestId:startRun(async()=>{
   const r=await fetch(BASE,{method:"POST",headers:{"x-goog-api-key":key,"Content-Type":"application/json","Api-Revision":"2026-05-20"},body:JSON.stringify(body),cache:"no-store",signal:AbortSignal.timeout(180_000)});
   const json=await r.json().catch(()=>undefined) as {error?:{code?:string;message?:string}}|undefined;
   // Google's own reason (quota, billing, region) goes to the server log only: it names no prompt and no key.
   if(!r.ok){console.warn("[whoush] google error",r.status,json?.error?.code??"",(json?.error?.message??"").slice(0,400));throw new GoogleHttpError(r.status,json?.error?.code??"");}
   const outputs:ProviderOutput[]=[];
   for(const img of googleImages(json)){const s=await storeMedia(img.bytes,img.mime);outputs.push({kind:"image",url:s.url,needsMirroring:true,mime:img.mime});}
   return outputs;
  })};
 }
 async status(id:string):Promise<ProviderStatus>{return runStatus(id);}
 async cancel():Promise<void>{throw new NotCancelableError();} // a synchronous call cannot be withdrawn once sent
 resendSafe():boolean{return false;}
}
