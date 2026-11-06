import "server-only";
import {findMediaModel,type MediaConfiguration} from "../catalog";
import {mirrorMedia} from "../media-store";
import type {MediaProvider,ProviderJob,ProviderState,ProviderStatus} from "../media-provider";
import {NotCancelableError,SubmissionUnknownError} from "../provider-errors";
import type {MediaModel} from "../types";
/**
 * Kling official API, current ("new") design (docs/evidence/KLING.md): base https://api-singapore.klingai.com, `Authorization: Bearer <API key>`.
 * Create: POST /text-to-video/kling-3.0 with {prompt, settings, options}; query: GET /tasks?task_ids=… or ?external_task_ids=…; no cancel endpoint.
 * Every job sends Whoush's idempotency key as `external_task_id` (unique per account), so a resend first looks the key up and returns the task that
 * already exists instead of making a second one.
 */
const BASE="https://api-singapore.klingai.com";
const auth=()=>{const k=process.env.KLING_API_KEY;if(!k)throw new Error("Kling credentials missing");return {"Authorization":"Bearer "+k,"Content-Type":"application/json"};};
export class KlingHttpError extends Error{constructor(readonly status:number,readonly code:number|undefined){super("Kling request failed: "+status+(code!==undefined?" "+code:""));this.name="KlingHttpError";}}
const RATIOS=["16:9","9:16","1:1"];
export function buildKlingVideoRequest(model:MediaModel,prompt:string,c:MediaConfiguration,externalId:string):{path:string;body:Record<string,unknown>}{
 if(model.provider!=="kling"||model.kind!=="video"||!model.verifiedApiPath)throw new Error("Not a Kling video model");
 const res=model.providerParams?.resolution,dur=c.durationSeconds??model.durationSeconds;
 if(typeof res!=="string"||!dur)throw new Error("SKU has no resolution or duration");
 return {path:model.verifiedApiPath,body:{prompt:prompt.slice(0,2500),
  // One continuous shot, no native audio (generated audio is not moderated yet), no Kling watermark; the canvas ratio when Kling has it.
  settings:{resolution:res,aspect_ratio:c.aspectRatio&&RATIOS.includes(c.aspectRatio)?c.aspectRatio:"16:9",duration:dur,audio:"off",multi_shot:false},
  options:{external_task_id:externalId,watermark_info:{enabled:false}}}};
}
type Task={id?:string;status?:string;message?:string;outputs?:{type?:string;url?:string}[]};
async function call(method:string,path:string,body?:unknown):Promise<{code?:number;data?:unknown}>{
 const r=await fetch(BASE+path,{method,headers:auth(),body:body===undefined?undefined:JSON.stringify(body),cache:"no-store",signal:AbortSignal.timeout(60_000)});
 const json=await r.json().catch(()=>undefined) as {code?:number;data?:unknown}|undefined;
 if(!r.ok||!json||json.code!==0)throw new KlingHttpError(r.status,json?.code);
 return json;
}
const firstTask=(d:unknown):Task|undefined=>Array.isArray(d)?d[0] as Task|undefined:(d as {result?:Task[]})?.result?.[0];
const STATE:Record<string,ProviderState>={submitted:"queued",processing:"running",succeeded:"completed",failed:"failed"};
export class KlingMediaProvider implements MediaProvider{
 async submit(job:ProviderJob):Promise<{providerRequestId:string}>{
  const model=findMediaModel(job.modelId);if(!model)throw new Error("Unknown model");auth();
  const {path,body}=buildKlingVideoRequest(model,job.prompt,job.configuration,job.idempotencyKey);
  // A job this key already made (an earlier send whose answer was lost) is returned as is.
  try{const known=firstTask((await call("GET","/tasks?external_task_ids="+encodeURIComponent(job.idempotencyKey))).data);if(known?.id)return {providerRequestId:known.id};}
  catch(e){if(!(e instanceof KlingHttpError&&e.status<500))throw new SubmissionUnknownError("lookup_failed");}
  let r:{data?:unknown};
  try{r=await call("POST",path,body);}
  catch(e){
   if(e instanceof KlingHttpError&&e.status<500&&e.status!==429)throw e; // a refusal (parameters, policy, balance): nothing was created
   throw new SubmissionUnknownError(e instanceof KlingHttpError?"http_"+e.status:"network");
  }
  const id=(r.data as {id?:unknown})?.id;if(typeof id!=="string"||!id)throw new SubmissionUnknownError("malformed_response");
  return {providerRequestId:id};
 }
 async status(id:string):Promise<ProviderStatus>{
  const t=firstTask((await call("GET","/tasks?task_ids="+encodeURIComponent(id))).data);
  const state=STATE[t?.status??""];if(!state)throw new Error("Unknown provider status"); // never guess an undocumented status
  if(state!=="completed")return {state,outputs:[]};
  const url=t?.outputs?.find(o=>o.type==="video"&&typeof o.url==="string")?.url;if(!url)return {state:"failed",outputs:[]};
  const m=await mirrorMedia(url,undefined,"video/mp4");return {state,outputs:[{kind:"video",url:m.url,needsMirroring:true,mime:m.mime}]};
 }
 async cancel():Promise<void>{throw new NotCancelableError();} // no cancel endpoint is documented
 resendSafe():boolean{return true;} // the external_task_id lookup above makes a resend find the first task
}
