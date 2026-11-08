import type { MediaModel } from "./types";
import {hasProviderCredentials} from "./provider-credentials";
/**
 * Models whose media inputs (a source video, reference images, audio) the provider fetches from public URLs: Higgsfield. Whoush has no public hosted media
 * yet (docs/LAUNCH_GATES.md). Google and BytePlus take reference images inline in the request (docs/evidence/GOOGLE.md, BYTEPLUS.md), so they need none.
 */
export const needsHostedMedia=(m:MediaModel)=>m.provider==="higgsfield"&&(m.operations.some(o=>o!=="generate")||m.capabilities.referenceImages.supported);
export interface LaunchPolicy { liveGeneration:boolean; reason:string; }
export function providerPolicy():LaunchPolicy {
 const authorized=process.env.PROVIDER_END_USER_AUTHORIZED==="true" && process.env.PROVIDER_RESELLER_AUTHORIZED==="true";
 const flag=process.env.ALLOW_LIVE_GENERATION==="true";
 // Credentials are checked per model, for the provider that runs it (generationGate).
 if(!authorized) return {liveGeneration:false,reason:"Provider and end-user authorization pending"};
 if(!flag) return {liveGeneration:false,reason:"Live generation switch disabled"};
 return {liveGeneration:true,reason:"Permitted by configured gates; enforce per-user region eligibility server-side"};
}
/** Live submission gate. Blockers are internal codes; never return them to consumers. Every condition must hold. */
export function generationGate(model?:MediaModel):{live:boolean;blockers:string[]} {
 const e=process.env,b:string[]=[];
 if(e.PROVIDER_END_USER_AUTHORIZED!=="true"||e.PROVIDER_RESELLER_AUTHORIZED!=="true") b.push("provider_authorization");
 if(e.ALLOW_LIVE_GENERATION!=="true") b.push("live_switch");
 if(model&&!hasProviderCredentials(model.provider)) b.push("provider_credentials");
 if(e.PRODUCTION_MODERATION_VERIFIED!=="true") b.push("production_moderation_unverified");
 if(e.BILLING_LEDGER_VERIFIED!=="true") b.push("billing_ledger_unverified");
 if((e.QUOTE_SIGNING_SECRET??"").length<32) b.push("quote_signing_secret");
 // Outputs are kept in Whoush's own storage (provider links expire; some providers return bytes): owned object storage must be verified first (gate 8).
 if(e.OWNED_MEDIA_STORAGE_VERIFIED!=="true") b.push("owned_media_storage");
 if(!model) b.push("model_unspecified"); else if(!model.capabilities.verified||!model.verifiedApiPath) b.push("model_unverified");
 if(model&&needsHostedMedia(model)) b.push("needs_hosted_media");
 return {live:b.length===0&&providerPolicy().liveGeneration,blockers:b};
}
/** Generation modes: `demo` (mock, no media), `live` (every launch gate passed) and `dev_live` (owner-only local testing, below). */
export type GenerationMode="demo"|"live"|"dev_live";
/**
 * Owner-only local testing against the real providers. On only under `next dev` (NODE_ENV=development) with WHOUSH_DEV_LIVE_TEST=true, so a production
 * build can never enable it. It does not assert any launch authorization: the production gates above stay closed. It never charges Neurons, only
 * verified model paths are callable, and real media submissions are capped per server process (WHOUSH_DEV_LIVE_MAX_SUBMITS, default 5, at most 50).
 */
export function devLiveTest():{enabled:boolean;maxSubmits:number}{
 const e=process.env,n=Number(e.WHOUSH_DEV_LIVE_MAX_SUBMITS??"5");
 return {enabled:e.WHOUSH_DEV_LIVE_TEST==="true"&&e.NODE_ENV==="development",maxSubmits:Number.isSafeInteger(n)&&n>0&&n<=50?n:5};
}
const devSubmits=()=>((globalThis as {__whoushDevSubmits?:{n:number}}).__whoushDevSubmits??={n:0});
export const devSubmitCount=()=>devSubmits().n;
/** Takes one slot of the per-process cap; false when the cap is reached or dev testing is off. */
export function claimDevSubmit():boolean{const d=devLiveTest(),s=devSubmits();if(!d.enabled||s.n>=d.maxSubmits)return false;s.n++;return true;}
/** Gives a claimed submission back when it definitely never reached the provider (nothing was created, so it used none of the cap). */
export function releaseDevSubmit():void{const s=devSubmits();if(s.n>0)s.n--;}
/**
 * The dev gate for a job that has already claimed its submission (owner live test, 2026-11-08: the 20th of 20 allowed submissions was refused because
 * the provider checked the cap again after the claim had counted it): every other blocker still applies.
 */
export const devGateOpenForClaimed=(model:MediaModel):boolean=>devGenerationGate(model).blockers.every(b=>b==="dev_cap_reached");
/** The dev_live gate: dev testing on, credentials present, a verified model path, and cap headroom. */
export function devGenerationGate(model?:MediaModel):{live:boolean;blockers:string[]}{
 const d=devLiveTest(),b:string[]=[];
 if(!d.enabled)b.push("dev_live_test_off");
 if(model&&!hasProviderCredentials(model.provider))b.push("provider_credentials");
 if(!model)b.push("model_unspecified");else if(!model.capabilities.verified||!model.verifiedApiPath)b.push("model_unverified");
 if(model&&needsHostedMedia(model))b.push("needs_hosted_media");
 if(devSubmits().n>=d.maxSubmits)b.push("dev_cap_reached");
 return {live:b.length===0,blockers:b};
}
/** The mode a quote for this model gets right now. */
export const generationModeFor=(model?:MediaModel):GenerationMode=>generationGate(model).live?"live":devGenerationGate(model).live?"dev_live":"demo";
// These environment flags do not replace counsel/provider approval or user-level policy checks.
