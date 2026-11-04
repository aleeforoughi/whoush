import "server-only";
import type { ReasoningTier } from "./types";
export type PrivateRouting={tier:ReasoningTier;modelId:string;provider:"anthropic"|"openai"};
export function resolvePrivateRouting(tier:ReasoningTier):PrivateRouting|null{
 const key=tier==="fast"?"LLM_FAST_MODEL":tier==="balanced"?"LLM_BALANCED_MODEL":"LLM_DEEP_MODEL";
 const id=process.env[key];if(!id)return null;
 return {tier,modelId:id,provider:id.startsWith("claude-")?"anthropic":"openai"};
}
// Model names, providers, token costs and route changes belong only in privileged logs.
// Never return this object to the frontend. Live LLM calls are deferred until
// provider eligibility, model IDs, usage metering and privacy requirements are verified.
