import "server-only";
import {createHash,randomUUID} from "node:crypto";
import {findMediaModel,MEDIA_CATALOG_VERSION,type MediaConfiguration} from "./catalog";
import {ReservationLedger} from "./ledger";
import {NotCancelableError,providerForMode,SubmissionUnknownError,type MediaProvider,type ProviderOutput,type ProviderStatus} from "./media-provider";
import {getPrivateMediaPrompt,privatePromptCompilerVersion} from "./orchestrator";
import {isStoredMediaUrl} from "./media-store";
import {evaluateOutputQA,type OutputQA} from "./output-qa";
import {claimDevSubmit,devGenerationGate,generationGate,type GenerationMode} from "./policy";
import {verifyQuote,verifyQuoteSignature,QuoteError,type CharacterRefDigest} from "./quotes";
import {evaluatePlanTextSafety} from "./safety";
/**
 * `submission_unknown`: the provider may have received the request (docs/CANVAS_TO_IMAGE.md section 8). The reservation stays, and the same request is
 * resent with the same idempotency key until the provider answers; it is never released as "not sent" on a guess, and never becomes a new paid job.
 */
export type JobState="quoted"|"approved"|"reserved"|"submission_unknown"|"submitted"|"running"|"completed"|"completed_demo"|"failed"|"canceled"|"released";
export const JOB_TRANSITIONS:Readonly<Record<JobState,readonly JobState[]>>={
 quoted:["approved"],approved:["reserved","released"],reserved:["submitted","submission_unknown","released"],submission_unknown:["submitted","released"],
 submitted:["running","completed","completed_demo","failed","canceled"],running:["completed","completed_demo","failed","canceled"],
 completed:[],completed_demo:[],failed:[],canceled:[],released:[]
};
export const isTerminal=(s:JobState)=>JOB_TRANSITIONS[s].length===0;
export type Job={id:string;ownerId:string;idempotencyKey:string;quoteId:string;turnId:string;modelId:string;mode:GenerationMode;configuration:MediaConfiguration;characterRef?:CharacterRefDigest;
 neurons:number;chargedNeurons:number;state:JobState;providerRequestId?:string;
 /** Private provenance (docs/CANVAS_TO_IMAGE.md section 8): what was asked for and sent, so every result can be traced. Never public. */provenance?:JobProvenance;
 /** Private, only while `submission_unknown`: the exact request to resend with the same key (the same key with other parameters is refused), and how the
  reconciliation is going. Cleared once the provider answers. */unknownSubmission?:{prompt:string;attempts:number;lastAttemptAt:string;reason:string};outputs:ProviderOutput[];qa:OutputQA;createdAt:string;updatedAt:string};
/**
 * What a job asked for and sent: the requested model, the endpoint called, the catalog and prompt-compiler versions, and the SHA-256 of the exact prompt
 * (so a result is traced to it without keeping the prompt on the job). `reportedModelId` is filled only when a provider reports which model ran; the
 * documented Higgsfield status response has no such field, so it stays empty there. A reported model that differs from the requested one sets
 * `modelMismatch`: that result says nothing about the requested model.
 */
export type JobProvenance={requestedModelId:string;endpoint:string;catalogVersion:string;compilerVersion?:string;promptSha256:string;reportedModelId?:string;modelMismatch?:boolean};
export interface JobStore{get(id:string):Job|undefined;byIdempotency(ownerId:string,key:string):Job|undefined;byQuote(quoteId:string):Job|undefined;insert(j:Job):void;save(j:Job):void}
export class InMemoryJobStore implements JobStore{
 private readonly jobs=new Map<string,Job>();
 get(id:string){return this.jobs.get(id);}
 byIdempotency(o:string,k:string){for(const j of this.jobs.values())if(j.ownerId===o&&j.idempotencyKey===k)return j;return undefined;}
 byQuote(q:string){for(const j of this.jobs.values())if(j.quoteId===q)return j;return undefined;}
 insert(j:Job){if(this.jobs.has(j.id))throw new Error("Duplicate job");this.jobs.set(j.id,j);}
 save(j:Job){if(!this.jobs.has(j.id))throw new Error("Unknown job");this.jobs.set(j.id,j);}
}
export type JobErrorCode="not_approved"|"moderation_blocked"|"idempotency_conflict"|"quote_already_used"|"illegal_transition"|"insufficient_balance";
const JSTATUS:Record<JobErrorCode,number>={not_approved:400,moderation_blocked:422,idempotency_conflict:409,quote_already_used:409,illegal_transition:409,insufficient_balance:402};
export class JobError extends Error{readonly status:number;constructor(readonly code:JobErrorCode){super(code);this.name="JobError";this.status=JSTATUS[code];}}
export type Moderation={decision:"allow"|"block"|"review";source?:"lexical_demo"|"production"};
export type JobDeps={store?:JobStore;ledger?:ReservationLedger;provider?:MediaProvider;now?:()=>Date};
const G=globalThis as {__whoushJobStore?:JobStore;__whoushLedger?:ReservationLedger};
// TODO(plan phase 02/03): durable DB store and transactional wallet ledger; these in-memory singletons are demo-only.
const dStore=()=>(G.__whoushJobStore??=new InMemoryJobStore());
const dLedger=()=>(G.__whoushLedger??=new ReservationLedger());
export function transition(j:Job,to:JobState,now:Date):void{
 if(!JOB_TRANSITIONS[j.state].includes(to))throw new JobError("illegal_transition");
 j.state=to;j.updatedAt=now.toISOString();
}
/** Pre-submission recheck for demo mode: lexical preflight only, labeled as such. Live mode requires a production moderator (source "production"). */
export function moderateAtExecution(token:string):Moderation{
 const prompt=getPrivateMediaPrompt(verifyQuoteSignature(token).quote.turnId);
 return {decision:prompt===undefined?"block":evaluatePlanTextSafety(prompt).decision,source:"lexical_demo"}; // the media prompt is planner text
}
export async function executeApprovedQuote(i:{token:string;approved:boolean;idempotencyKey:string;ownerId:string;moderation:Moderation},deps:JobDeps={}):Promise<Job>{
 const store=deps.store??dStore(),ledger=deps.ledger??dLedger(),now=deps.now?.()??new Date();
 if(i.approved!==true)throw new JobError("not_approved");
 // Idempotent replay is resolved from the signature alone, so it survives quote expiry.
 const sig=verifyQuoteSignature(i.token).quote;
 const prior=store.byIdempotency(i.ownerId,i.idempotencyKey);
 if(prior){if(prior.quoteId!==sig.quoteId)throw new JobError("idempotency_conflict");return prior;}
 if(store.byQuote(sig.quoteId))throw new JobError("quote_already_used"); // a quote funds exactly one job
 const q=verifyQuote(i.token,now),model=findMediaModel(q.modelId);if(!model)throw new QuoteError("stale_quote");
 if(i.moderation.decision!=="allow")throw new JobError("moderation_blocked"); // fail closed
 if(q.mode==="live"&&i.moderation.source!=="production")throw new JobError("moderation_blocked");
 if(q.mode==="live"&&!ledger.checksBalance)throw new JobError("insufficient_balance"); // live spend needs a real wallet balance source
 // dev_live (owner-only local testing) accepts the lexical pre-submission check and never charges Neurons; see devLiveTest in lib/policy.ts.
 const prompt=getPrivateMediaPrompt(q.turnId);if(prompt===undefined)throw new QuoteError("unknown_turn");
 const t=now.toISOString();
 const job:Job={id:randomUUID(),ownerId:i.ownerId,idempotencyKey:i.idempotencyKey,quoteId:q.quoteId,turnId:q.turnId,modelId:q.modelId,mode:q.mode,configuration:q.configuration,characterRef:q.characterRef,neurons:q.neurons,chargedNeurons:0,state:"quoted",outputs:[],qa:{status:"not_applicable",checks:[]},createdAt:t,updatedAt:t};
 const compilerVersion=privatePromptCompilerVersion(q.turnId);
 job.provenance={requestedModelId:q.modelId,endpoint:q.mode==="demo"?"mock":findMediaModel(q.modelId)?.verifiedApiPath??"unverified",catalogVersion:MEDIA_CATALOG_VERSION,
  ...(compilerVersion?{compilerVersion}:{}),promptSha256:createHash("sha256").update(prompt).digest("hex")};
 // Everything up to the provider call is synchronous, so a concurrent replay always finds this job.
 store.insert(job);transition(job,"approved",now);
 try{ledger.reserve(job.id,job.ownerId,job.neurons);}catch{transition(job,"released",now);store.save(job);throw new JobError("insufficient_balance");}
 transition(job,"reserved",now);store.save(job);
 const provider=deps.provider??providerForMode(job.mode);
 try{
  if(job.mode==="live"&&!generationGate(model).live)throw new Error("gate closed");
  if(job.mode==="dev_live"&&!(devGenerationGate(model).live&&claimDevSubmit()))throw new Error("dev gate closed or cap reached");
  const r=await provider.submit({modelId:job.modelId,prompt,configuration:job.configuration,idempotencyKey:job.id});
  job.providerRequestId=r.providerRequestId;transition(job,"submitted",deps.now?.()??new Date());
  if(job.mode==="dev_live")console.info("[whoush dev-live] media submit",job.modelId,r.providerRequestId); // never the prompt
 }catch(e){
  if(job.mode==="dev_live")console.warn("[whoush dev-live] media submit failed:",e instanceof Error?e.message:"unknown"); // message only: no key, no prompt
  const at=deps.now?.()??new Date();
  // The provider may have it: keep the reservation and reconcile with the same key (pollJob). Only a definite failure releases.
  if(e instanceof SubmissionUnknownError){job.unknownSubmission={prompt,attempts:1,lastAttemptAt:at.toISOString(),reason:e.reason};transition(job,"submission_unknown",at);}
  else{ledger.release(job.id);transition(job,"released",at);}
 }
 store.save(job);return job;
}
function finish(job:Job,ledger:ReservationLedger,to:"completed"|"completed_demo"|"failed"|"canceled",now:Date,outputs:ProviderOutput[]=[]){
 transition(job,to,now);
 if(to==="completed"&&job.mode==="dev_live"){ledger.release(job.id);job.chargedNeurons=0;job.outputs=outputs;job.qa=evaluateOutputQA(job,outputs);} // dev testing never charges
 else if(to==="completed"){ledger.settle(job.id);job.chargedNeurons=job.neurons;job.outputs=outputs;job.qa=evaluateOutputQA(job,outputs);} // settle only with verified output
 else{ledger.release(job.id);job.chargedNeurons=0;}
}
const httpsUrl=(u:string)=>{if(isStoredMediaUrl(u))return true;try{return new URL(u).protocol==="https:";}catch{return false;}}; // a provider https link, or Whoush's own stored copy
/** How many times an unknown submission is resent, and the shortest wait between tries (doubling: 2 s, 4 s, 8 s…). Then it waits for the owner. */
export const RECONCILE_MAX_ATTEMPTS=6;
const RECONCILE_BASE_MS=2000;
/**
 * Resends an unknown submission exactly as it was, with the same idempotency key (errors.md: repeat the same request with the same key after an ambiguous
 * timeout or 5xx; the provider returns the request it already has instead of making a second). An answer settles it: a request id means submitted, a
 * definite refusal means nothing was made and the reservation is released. Another unknown outcome waits for the next try; after the last try the job stays
 * unknown with its reservation, for the owner to reconcile. No gate re-claims the dev cap: this is the same request, not a new one.
 */
async function reconcile(job:Job,ledger:ReservationLedger,provider:MediaProvider,now:Date):Promise<void>{
 const u=job.unknownSubmission;if(!u||u.attempts>=RECONCILE_MAX_ATTEMPTS)return;
 if(now.getTime()-new Date(u.lastAttemptAt).getTime()<RECONCILE_BASE_MS*2**(u.attempts-1))return;
 const model=findMediaModel(job.modelId);
 if(!model||(job.mode==="live"&&!generationGate(model).live)||(job.mode==="dev_live"&&!devGenerationGate(model).live))return; // gate closed: keep waiting
 // A provider without idempotency could make (and bill) a second job: the job waits for the owner instead (docs/evidence/BYTEPLUS.md, GOOGLE.md).
 if(provider.resendSafe&&!provider.resendSafe(job.modelId))return;
 job.unknownSubmission={...u,attempts:u.attempts+1,lastAttemptAt:now.toISOString()};
 try{
  const r=await provider.submit({modelId:job.modelId,prompt:u.prompt,configuration:job.configuration,idempotencyKey:job.id});
  job.providerRequestId=r.providerRequestId;delete job.unknownSubmission;transition(job,"submitted",now);
 }catch(e){
  if(e instanceof SubmissionUnknownError){job.unknownSubmission={...job.unknownSubmission!,reason:e.reason};return;}
  delete job.unknownSubmission;ledger.release(job.id);transition(job,"released",now);
 }
}
/** Owner-scoped: another owner's job is indistinguishable from a missing one (returns undefined). */
export async function pollJob(id:string,ownerId:string,deps:JobDeps={}):Promise<Job|undefined>{
 const store=deps.store??dStore(),ledger=deps.ledger??dLedger();
 const job=store.get(id);if(!job||job.ownerId!==ownerId)return undefined;
 if(job.state==="submission_unknown"){await reconcile(job,ledger,deps.provider??providerForMode(job.mode),deps.now?.()??new Date());store.save(job);return job;}
 if(isTerminal(job.state)||!job.providerRequestId)return job;
 const provider=deps.provider??providerForMode(job.mode);
 let s:ProviderStatus;
 try{s=await provider.status(job.providerRequestId);}catch{return job;} // transient: state unchanged
 const cur=store.get(id)!;if(isTerminal(cur.state))return cur; // another poll finished it while we awaited
 const now=deps.now?.()??new Date();
 if(s.reportedModelId&&cur.provenance&&!cur.provenance.reportedModelId){cur.provenance={...cur.provenance,reportedModelId:s.reportedModelId,modelMismatch:s.reportedModelId!==cur.provenance.requestedModelId};}
 switch(s.state){
  case "queued":break;
  case "running":if(cur.state==="submitted")transition(cur,"running",now);break;
  case "completed_demo":if(cur.mode==="demo"){if(cur.state==="submitted")transition(cur,"running",now);finish(cur,ledger,"completed_demo",now);}break;
  case "completed":{
   if(cur.mode==="demo")break;
   if(cur.state==="submitted")transition(cur,"running",now);
   const ok=s.outputs.length>0&&s.outputs.every(o=>httpsUrl(o.url));
   finish(cur,ledger,ok?"completed":"failed",now,ok?s.outputs:[]);break;
  }
  case "failed":case "nsfw":finish(cur,ledger,"failed",now);break;
  case "canceled":finish(cur,ledger,"canceled",now);break;
 }
 store.save(cur);return cur;
}
/** Cancel is only honored by the provider while queued; otherwise state is unchanged and canceled=false. */
export async function cancelJob(id:string,ownerId:string,deps:JobDeps={}):Promise<{job:Job;canceled:boolean}|undefined>{
 const store=deps.store??dStore(),ledger=deps.ledger??dLedger();
 const job=store.get(id);if(!job||job.ownerId!==ownerId)return undefined;
 if(isTerminal(job.state)||!job.providerRequestId)return {job,canceled:false};
 const provider=deps.provider??providerForMode(job.mode);
 try{await provider.cancel(job.providerRequestId);}catch(e){if(e instanceof NotCancelableError)return {job,canceled:false};throw e;}
 const cur=store.get(id)!;if(isTerminal(cur.state))return {job:cur,canceled:false};
 finish(cur,ledger,"canceled",deps.now?.()??new Date());store.save(cur);return {job:cur,canceled:true};
}
const MSG:Record<JobState,string>={
 quoted:"درخواست ثبت شد.",approved:"درخواست تأیید شد.",reserved:"نورون رزرو شد و درخواست در حال ارسال است.",
 submission_unknown:"ارسال درخواست قطعی نشد؛ داریم با سرویس بررسی می‌کنیم که رسیده یا نه. دوباره نزن: هیچ نورونی دوبار کسر نمی‌شود.",
 submitted:"درخواست در صف پردازش است.",running:"در حال تولید…",completed:"تولید کامل شد. خروجی باید بازبینی شود.",
 completed_demo:"نسخه آزمایشی: هیچ رسانه واقعی تولید نشد و هیچ نورونی کسر نشد.",
 failed:"تولید ناموفق بود؛ نورونی کسر نشد.",canceled:"درخواست لغو شد؛ نورونی کسر نشد.",released:"درخواست ارسال نشد؛ نورون رزروشده آزاد شد و نورونی کسر نشد."
};
/** Consumer projection: no provider ids/keys/costs/evidence/turn or quote internals. Output URLs only for completed live jobs. */
const DEV_COMPLETED_FA="تست توسعه: خروجی واقعی ساخته شد و هیچ نورونی کسر نشد. خروجی باید بازبینی شود.";
export function toPublicJob(j:Job){
 const typical=findMediaModel(j.modelId)?.typicalSeconds;
 return {id:j.id,state:j.state,mode:j.mode,modelId:j.modelId,neurons:j.neurons,chargedNeurons:j.chargedNeurons,...(typical?{typicalMs:typical*1000}:{}),
  outputs:j.state==="completed"?j.outputs.map(o=>({kind:o.kind,url:o.url})):[],qa:j.qa,messageFa:j.mode==="dev_live"&&j.state==="completed"?DEV_COMPLETED_FA:MSG[j.state]};
}
