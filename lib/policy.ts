import type { MediaModel } from "./types";
export interface LaunchPolicy { liveGeneration:boolean; reason:string; }
export function providerPolicy():LaunchPolicy {
 const authorized=process.env.PROVIDER_END_USER_AUTHORIZED==="true" && process.env.PROVIDER_RESELLER_AUTHORIZED==="true";
 const flag=process.env.ALLOW_LIVE_GENERATION==="true";
 const secret=Boolean(process.env.HIGGSFIELD_API_KEY);
 if(!authorized) return {liveGeneration:false,reason:"Provider and end-user authorization pending"};
 if(!flag) return {liveGeneration:false,reason:"Live generation switch disabled"};
 if(!secret) return {liveGeneration:false,reason:"Higgsfield credentials missing"};
 return {liveGeneration:true,reason:"Permitted by configured gates; enforce per-user region eligibility server-side"};
}
/** Live submission gate. Blockers are internal codes; never return them to consumers. Every condition must hold. */
export function generationGate(model?:MediaModel):{live:boolean;blockers:string[]} {
 const e=process.env,b:string[]=[];
 if(e.PROVIDER_END_USER_AUTHORIZED!=="true"||e.PROVIDER_RESELLER_AUTHORIZED!=="true") b.push("provider_authorization");
 if(e.ALLOW_LIVE_GENERATION!=="true") b.push("live_switch");
 if(!e.HIGGSFIELD_API_KEY) b.push("provider_credentials");
 if(e.PRODUCTION_MODERATION_VERIFIED!=="true") b.push("production_moderation_unverified");
 if(e.BILLING_LEDGER_VERIFIED!=="true") b.push("billing_ledger_unverified");
 if((e.QUOTE_SIGNING_SECRET??"").length<32) b.push("quote_signing_secret");
 if(!model) b.push("model_unspecified"); else if(!model.capabilities.verified||!model.verifiedApiPath) b.push("model_unverified");
 return {live:b.length===0&&providerPolicy().liveGeneration,blockers:b};
}
// These environment flags do not replace counsel/provider approval or user-level policy checks.
