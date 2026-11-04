import "server-only";
import type { ReasoningTier, MediaKind } from "./types";
import {assertSafeText} from "./safety";
import {resolveCreativeSkills,compileSkillInstructions,type CreativeSkillId} from "./skills";
import {reasoningTier,detectMediaKind} from "./router";
export type PrivateRouting={tier:ReasoningTier;modelId:string;provider:"anthropic"|"openai"};
export function resolvePrivateRouting(tier:ReasoningTier):PrivateRouting|null{
 const key=tier==="fast"?"LLM_FAST_MODEL":tier==="balanced"?"LLM_BALANCED_MODEL":"LLM_DEEP_MODEL";
 const id=process.env[key];if(!id)return null;
 return {tier,modelId:id,provider:id.startsWith("claude-")?"anthropic":"openai"};
}
/** Every real private LLM request MUST go through this builder. Never export the
 * generated system prompt, model/provider identifier or token accounting to consumers.
 * This is a prepared request contract, NOT a live model call. */
export function preparePrivateCreativeRequest(args:{
 prompt:string;kind?:MediaKind;task?:"generate"|"edit";hasReferences?:boolean;hasAudioReference?:boolean;
}):{
 systemInstructions:string;userText:string;activeSkillIds:CreativeSkillId[];
 privateReasoningTier:ReasoningTier;privateRoute:PrivateRouting|null;
}{
 assertSafeText(args.prompt); // fail before LLM spend or any media proposal
 const kind=args.kind??detectMediaKind(args.prompt);
 const skillContext={prompt:args.prompt,kind,task:args.task,hasAudioReference:args.hasAudioReference};
 const tier=reasoningTier(args.prompt,Boolean(args.hasReferences));
 return {
  systemInstructions:compileSkillInstructions(skillContext),
  userText:args.prompt,
  activeSkillIds:resolveCreativeSkills(skillContext),
  privateReasoningTier:tier,
  privateRoute:resolvePrivateRouting(tier)
 };
}
// Model names, providers, token costs and route changes belong only in privileged logs.
// Never return this object to the frontend. Live LLM calls are deferred until
// provider eligibility, model IDs, usage metering and privacy requirements are verified.
