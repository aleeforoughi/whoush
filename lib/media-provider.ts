import "server-only";
import {randomUUID} from "node:crypto";
import {findMediaModel,type MediaConfiguration} from "./catalog";
import {cancelHiggsfield,getHiggsfieldStatus,HiggsfieldHttpError,NotCancelableError,submitHiggsfieldVerifiedPath,type HiggsfieldStatus} from "./higgsfield";
import {devGenerationGate,generationGate,type GenerationMode} from "./policy";
import type {MediaModel,MediaProviderId} from "./types";
/** Provider outputs are provider-hosted URLs that expire (>= 7 days); mirroring to owned storage is NOT implemented (docs/LAUNCH_GATES.md gate 8). */
export type ProviderOutput={kind:"image"|"video"|"audio";url:string;needsMirroring:true;mime?:string;width?:number;height?:number;durationSeconds?:number};
export type ProviderState="queued"|"running"|"completed"|"completed_demo"|"failed"|"nsfw"|"canceled";
/** `reportedModelId`: the model the provider says ran, only when it reports one (the documented Higgsfield status has no such field). */
export type ProviderStatus={state:ProviderState;outputs:ProviderOutput[];expiresAt?:string;reportedModelId?:string};
/** Appended to the prompt when research references go with it: what they are for, so the model takes details from them and not their composition. */
export const REFERENCE_PROMPT_NOTE=" Reference images are attached: open-licensed photos of the real subjects (artifacts, places, period dress). Follow them for authentic details of clothing, architecture and objects; do not copy their composition, framing or any text in them.";
/** `references`: inspected, Whoush-owned research reference images the user kept (docs/RESEARCH_PIPELINE.md), for models that take them inline. */
export type ProviderJob={modelId:string;prompt:string;configuration:MediaConfiguration;idempotencyKey:string;references?:{bytes:Uint8Array;mime:string}[]};
/**
 * `resendSafe(modelId)`: whether resending the same request after an unclear outcome is safe, because the provider honors an idempotency key (Higgsfield).
 * Absent means safe. Providers with no idempotency (Google, BytePlus, docs/evidence) answer false, and an unknown submission then waits for the owner.
 */
export interface MediaProvider{submit(job:ProviderJob):Promise<{providerRequestId:string}>;status(providerRequestId:string):Promise<ProviderStatus>;cancel(providerRequestId:string):Promise<void>;resendSafe?(modelId:string):boolean}
export {NotCancelableError};
import {SubmissionUnknownError} from "./provider-errors";
import {BytePlusMediaProvider} from "./providers/byteplus";
import {isStoredMediaUrl,mirrorMedia} from "./media-store";
import {GoogleMediaProvider} from "./providers/google";
import {KlingMediaProvider} from "./providers/kling";
export {SubmissionUnknownError};
/** Deterministic, offline: queued -> running -> completed_demo over polls. It never returns media URLs. */
export class MockMediaProvider implements MediaProvider{
 private readonly polls=new Map<string,number>();
 private readonly canceled=new Set<string>();
 async submit():Promise<{providerRequestId:string}>{const id="mock-"+randomUUID();this.polls.set(id,0);return {providerRequestId:id};}
 async status(id:string):Promise<ProviderStatus>{
  const n=this.polls.get(id);if(n===undefined)throw new Error("Unknown mock request");
  if(this.canceled.has(id))return {state:"canceled",outputs:[]};
  this.polls.set(id,n+1);
  return {state:n===0?"queued":n===1?"running":"completed_demo",outputs:[]};
 }
 async cancel(id:string):Promise<void>{
  const n=this.polls.get(id);if(n===undefined)throw new Error("Unknown mock request");
  if(n>1)throw new NotCancelableError(); // mirrors "only while queued"
  this.canceled.add(id);
 }
}
/**
 * Payloads only for models whose per-model input schema was read (docs/HIGGSFIELD_EVIDENCE.md). Every field is set explicitly so the billed
 * configuration is the SKU's, never a provider default. Anything else throws, including models that need hosted media inputs (Genjutsu).
 */
export function buildHiggsfieldPayload(model:MediaModel,prompt:string,c:MediaConfiguration):Record<string,unknown>{
 const aspect=c.aspectRatio?{aspect_ratio:c.aspectRatio}:{};
 if(model.verifiedApiPath==="/higgsfield-ai/soul/standard"){
  if(model.resolution!=="720p"&&model.resolution!=="1080p")throw new Error("Unsupported SKU resolution");
  return {prompt,resolution:model.resolution,batch_size:1,...aspect};
 }
 if(model.verifiedApiPath==="/bytedance/seedance-2.5/text-to-video"){
  const duration=c.durationSeconds??model.durationSeconds;
  if(!duration||!(model.capabilities.durationsSeconds??[]).includes(duration))throw new Error("Unsupported SKU duration");
  if(!["480p","720p","1080p"].includes(model.resolution))throw new Error("Unsupported SKU resolution");
  return {prompt,duration,resolution:model.resolution,generate_audio:false,...aspect}; // audio off: generated audio is not moderated yet
 }
 throw new Error("No verified payload mapping for model");
}
function mapOutputs(r:HiggsfieldStatus):ProviderOutput[]{
 const o:ProviderOutput[]=[],seen=new Set<string>();
 const add=(kind:ProviderOutput["kind"],u?:{url:string}|null)=>{if(u&&typeof u.url==="string"&&!seen.has(u.url)){seen.add(u.url);o.push({kind,url:u.url,needsMirroring:true});}};
 for(const i of r.images??[])add("image",i);add("video",r.video);add("audio",r.audio);for(const a of r.audios??[])add("audio",a);
 return o;
}
/** Copies each image and video output into Whoush's store; a failed copy throws, so the status check is tried again rather than finishing without media. */
export async function mirrorOutputs(outputs:ProviderOutput[]):Promise<ProviderOutput[]>{
 const out:ProviderOutput[]=[];
 for(const o of outputs){
  if(o.kind==="audio"||isStoredMediaUrl(o.url)){out.push(o);continue;}
  const m=await mirrorMedia(o.url,undefined,o.kind==="video"?"video/mp4":"image/png");
  out.push({...o,url:m.url,mime:m.mime});
 }
 return out;
}
/** Only usable when generationGate(model).live, or devGenerationGate for owner-only dev testing; re-checked on every submit. */
export class HiggsfieldMediaProvider implements MediaProvider{
 constructor(private readonly mode:"live"|"dev_live"="live"){}
 async submit(job:ProviderJob):Promise<{providerRequestId:string}>{
  const model=findMediaModel(job.modelId);
  if(!model||!model.verifiedApiPath||!(this.mode==="live"?generationGate(model).live:devGenerationGate(model).live))throw new Error("Live generation blocked");
  const payload=buildHiggsfieldPayload(model,job.prompt,job.configuration); // a mapping error happens before anything is sent: definite
  let r:Awaited<ReturnType<typeof submitHiggsfieldVerifiedPath>>;
  try{r=await submitHiggsfieldVerifiedPath(model.verifiedApiPath,payload,job.idempotencyKey);}
  catch(e){
   // errors.md: a 4xx is a definite refusal (bad input, credentials, balance, validation, blocked model, queue full): nothing was created.
   if(e instanceof HiggsfieldHttpError&&e.status<500)throw e;
   throw new SubmissionUnknownError(e instanceof HiggsfieldHttpError?"http_"+e.status:e instanceof Error&&(e.name==="TimeoutError"||e.name==="AbortError")?"timeout":"network");
  }
  // A 2xx was accepted: without a readable request id the request may exist, so it is unknown, not failed.
  if(!r||typeof r.request_id!=="string"||!r.request_id)throw new SubmissionUnknownError("malformed_response");
  return {providerRequestId:r.request_id};
 }
 async status(id:string):Promise<ProviderStatus>{
  const r=await getHiggsfieldStatus(id);
  const m:Record<string,ProviderState>={queued:"queued",in_progress:"running",completed:"completed",failed:"failed",nsfw:"nsfw",canceled:"canceled"};
  const state=m[r.status];if(!state)throw new Error("Unknown provider status"); // never guess an undocumented status
  // Finished images and videos are copied into Whoush's own store (as the direct providers do): the studio shows only Whoush-owned media (launch gate 8),
  // and provider links can expire. Audio is not stored yet (it is never requested: generated audio is not moderated).
  return {state,outputs:state==="completed"?await mirrorOutputs(mapOutputs(r)):[],expiresAt:r.expires_at??undefined};
 }
 async cancel(id:string):Promise<void>{await cancelHiggsfield(id);}
}
const g=globalThis as {__whoushMockProvider?:MediaProvider};
export const sharedMockProvider=():MediaProvider=>(g.__whoushMockProvider??=new MockMediaProvider());
/** Each direct provider's adapter (docs/PROVIDERS.md). One is added only with its API evidence recorded; a model whose provider has none is never submitted. */
export type AdapterFactory=(mode:"live"|"dev_live")=>MediaProvider;
const adapters=():Partial<Record<MediaProviderId,AdapterFactory>>=>((globalThis as {__whoushAdapters?:Partial<Record<MediaProviderId,AdapterFactory>>}).__whoushAdapters??={higgsfield:m=>new HiggsfieldMediaProvider(m),google:()=>new GoogleMediaProvider(),byteplus:()=>new BytePlusMediaProvider(),kling:()=>new KlingMediaProvider()});
export function registerAdapter(p:MediaProviderId,f:AdapterFactory){adapters()[p]=f;}
/**
 * A provider request id names its provider, so status and cancel reach the same API later: «google:…», «byteplus:…», «kling:…». Higgsfield ids keep their
 * original form (no prefix), so jobs created before other providers existed still resolve.
 */
const PREFIXED=/^(google|byteplus|kling):(.+)$/s;
export const tagRequestId=(p:MediaProviderId,id:string)=>p==="higgsfield"?id:p+":"+id;
export function splitRequestId(id:string):{provider:MediaProviderId;id:string}{const m=PREFIXED.exec(id);return m?{provider:m[1] as MediaProviderId,id:m[2]}:{provider:"higgsfield",id};}
/** Routes each call to the adapter of the model's provider. */
export class RoutingMediaProvider implements MediaProvider{
 constructor(private readonly mode:"live"|"dev_live"){}
 private adapter(p:MediaProviderId):MediaProvider{const f=adapters()[p];if(!f)throw new Error("No adapter for provider");return f(this.mode);}
 async submit(job:ProviderJob):Promise<{providerRequestId:string}>{
  const model=findMediaModel(job.modelId);if(!model)throw new Error("Unknown model");
  const r=await this.adapter(model.provider).submit(job);return {providerRequestId:tagRequestId(model.provider,r.providerRequestId)};
 }
 async status(id:string):Promise<ProviderStatus>{const s=splitRequestId(id);return this.adapter(s.provider).status(s.id);}
 async cancel(id:string):Promise<void>{const s=splitRequestId(id);return this.adapter(s.provider).cancel(s.id);}
 resendSafe(modelId:string):boolean{const m=findMediaModel(modelId);if(!m)return false;const a=this.adapter(m.provider);return a.resendSafe?a.resendSafe(modelId):true;}
}
export const providerForMode=(mode:GenerationMode):MediaProvider=>mode==="demo"?sharedMockProvider():new RoutingMediaProvider(mode);
