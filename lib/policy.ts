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
// These environment flags do not replace counsel/provider approval or user-level policy checks.
