import "server-only";
import { providerPolicy } from "./policy";
const BASE="https://api.higgsfield.ai";
export type HiggsfieldSubmission={request_id:string;status_url?:string;cancel_url?:string};
export type HiggsfieldStatus={status:"queued"|"processing"|"completed"|"failed"|"nsfw"|"canceled";images?:{url:string}[];video?:{url:string};error?:unknown};
function auth(){const key=process.env.HIGGSFIELD_API_KEY;if(!key) throw new Error("Missing credentials");return {"Authorization":"Key "+key,"Content-Type":"application/json"};}
function requireEnabled(){if(!providerPolicy().liveGeneration) throw new Error("Live API disabled by deployment policy");}
export async function submitHiggsfieldVerifiedPath(verifiedPath:string,payload:Record<string,unknown>):Promise<HiggsfieldSubmission>{
 requireEnabled();
 if(!/^\/[a-z0-9-]+\/[a-z0-9-]+(?:\/[a-z0-9-]+)*$/.test(verifiedPath)) throw new Error("Invalid configured model path");
 // Paths and payload MUST be loaded from verified model-specific Higgsfield API schemas, never user-supplied.
 const response=await fetch(BASE+verifiedPath,{method:"POST",headers:auth(),body:JSON.stringify(payload),cache:"no-store"});
 if(!response.ok) throw new Error("Higgsfield submission failed: "+response.status);
 return response.json();
}
export async function getHiggsfieldStatus(requestId:string):Promise<HiggsfieldStatus>{
 requireEnabled();if(!/^[a-zA-Z0-9_-]+$/.test(requestId))throw new Error("Invalid request ID");
 const response=await fetch(BASE+"/requests/"+encodeURIComponent(requestId)+"/status",{headers:auth(),cache:"no-store"});
 if(!response.ok)throw new Error("Higgsfield status failed: "+response.status);
 return response.json();
}
export async function cancelHiggsfield(requestId:string):Promise<void>{
 requireEnabled();if(!/^[a-zA-Z0-9_-]+$/.test(requestId)) throw new Error("Invalid request ID");
 const r=await fetch(BASE+"/requests/"+encodeURIComponent(requestId)+"/cancel",{method:"POST",headers:auth(),cache:"no-store"});
 if(!r.ok)throw new Error("Higgsfield cancellation failed: "+r.status);
}
// This adapter is intentionally NOT wired to consumer routes. No verified model paths,
// estimate endpoint schemas, webhook verification or regional authorization yet.
