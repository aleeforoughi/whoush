import "server-only";
import { devLiveTest, providerPolicy } from "./policy";
const BASE="https://api.higgsfield.ai";
export type HiggsfieldSubmission={request_id:string;status_url?:string;cancel_url?:string};
// Status values and response fields as documented (docs/HIGGSFIELD_EVIDENCE.md): in_progress is the only non-terminal state besides queued.
export type HiggsfieldStatusValue="queued"|"in_progress"|"completed"|"failed"|"nsfw"|"canceled";
export type HiggsfieldStatus={status:HiggsfieldStatusValue;request_id?:string;images?:{url:string}[];video?:{url:string};audio?:{url:string};audios?:{url:string}[];error?:string|null;expires_at?:string|null};
export class NotCancelableError extends Error{constructor(){super("Request can no longer be canceled");this.name="NotCancelableError";}}
/** A non-2xx answer from the API, with its status (errors.md: 4xx are definite refusals; 5xx may have been accepted and are retried with the same key). */
export class HiggsfieldHttpError extends Error{constructor(readonly status:number,what:string){super("Higgsfield "+what+" failed: "+status);this.name="HiggsfieldHttpError";}}
/** Per-request timeout (polling.md example: 30 s per HTTP request). A timeout is an ambiguous outcome for a submission, never a definite failure. */
const REQUEST_TIMEOUT_MS=30_000;
function auth(){const key=process.env.HIGGSFIELD_API_KEY;if(!key) throw new Error("Missing credentials");return {"Authorization":"Key "+key,"Content-Type":"application/json"};}
// Production gate, or owner-only local dev testing (devLiveTest: next dev + WHOUSH_DEV_LIVE_TEST, capped and never charged; see lib/policy.ts).
function requireEnabled(){if(!providerPolicy().liveGeneration&&!devLiveTest().enabled) throw new Error("Live API disabled by deployment policy");}
export async function submitHiggsfieldVerifiedPath(verifiedPath:string,payload:Record<string,unknown>,idempotencyKey?:string):Promise<HiggsfieldSubmission>{
 requireEnabled();
 // Documented paths have 2+ segments of lowercase letters and digits joined by single dots or dashes (seedance-2.5, v1.0). No "..", no empty segment.
 if(!/^(?:\/[a-z0-9]+(?:[.-][a-z0-9]+)*){2,}$/.test(verifiedPath)) throw new Error("Invalid configured model path");
 // Paths and payload MUST be loaded from verified model-specific Higgsfield API schemas, never user-supplied.
 const response=await fetch(BASE+verifiedPath,{method:"POST",headers:{...auth(),...(idempotencyKey?{"Idempotency-Key":idempotencyKey}:{})},body:JSON.stringify(payload),cache:"no-store",signal:AbortSignal.timeout(REQUEST_TIMEOUT_MS)});
 if(!response.ok) throw new HiggsfieldHttpError(response.status,"submission");
 return response.json();
}
export async function getHiggsfieldStatus(requestId:string):Promise<HiggsfieldStatus>{
 requireEnabled();if(!/^[a-zA-Z0-9_-]+$/.test(requestId))throw new Error("Invalid request ID");
 const response=await fetch(BASE+"/requests/"+encodeURIComponent(requestId)+"/status",{headers:auth(),cache:"no-store",signal:AbortSignal.timeout(REQUEST_TIMEOUT_MS)});
 if(!response.ok)throw new Error("Higgsfield status failed: "+response.status);
 return response.json();
}
/** 202 => canceled (queued only). 400 => processing already started: NotCancelableError. */
export async function cancelHiggsfield(requestId:string):Promise<void>{
 requireEnabled();if(!/^[a-zA-Z0-9_-]+$/.test(requestId)) throw new Error("Invalid request ID");
 const r=await fetch(BASE+"/requests/"+encodeURIComponent(requestId)+"/cancel",{method:"POST",headers:auth(),cache:"no-store"});
 if(r.status===400)throw new NotCancelableError();
 if(!r.ok)throw new Error("Higgsfield cancellation failed: "+r.status);
}
// Reached only through lib/media-provider.ts after generationGate(model).live. Estimate endpoint, webhook
// verification and regional authorization are NOT verified (see docs/HIGGSFIELD_EVIDENCE.md).
