import "server-only";
import type { ReasoningTier, MediaKind } from "./types";
import type {AttachmentRole} from "./attachments";
import {assertSafeText} from "./safety";
import {resolveCreativeSkills,compileSkillInstructions,type SkillId} from "./skills";
import {reasoningTier,detectMediaKind} from "./router";
export type PrivateRouting={tier:ReasoningTier;modelId:string;provider:"anthropic"|"openai"};
export function resolvePrivateRouting(tier:ReasoningTier):PrivateRouting|null{
 const key=tier==="fast"?"LLM_FAST_MODEL":tier==="balanced"?"LLM_BALANCED_MODEL":"LLM_DEEP_MODEL";
 const id=process.env[key];if(!id)return null;
 return {tier,modelId:id,provider:id.startsWith("claude-")?"anthropic":"openai"};
}
/** Every real private LLM request MUST go through this builder. Never export the
 * generated system prompt, model/provider identifier or token accounting to consumers.
 * This is a prepared request contract, NOT a live model call; lib/orchestrator.ts runs it. */
export function preparePrivateCreativeRequest(args:{
 prompt:string;kind?:MediaKind;task?:"generate"|"edit"|"character";hasReferences?:boolean;hasAudioReference?:boolean;hasSpeechAudio?:boolean;speechLanguage?:"fa"|"other"|"unknown";accent?:"tehrani"|"original"|"unspecified";hasCharacterReference?:boolean;characterRef?:{id:string;angles:readonly string[];version:number};visualStyle?:"photoreal"|"stylized"|"auto";attachmentRoles?:readonly AttachmentRole[];
}):{
 systemInstructions:string;userText:string;activeSkillIds:SkillId[];
 privateReasoningTier:ReasoningTier;privateRoute:PrivateRouting|null;
}{
 assertSafeText(args.prompt); // fail before LLM spend or any media proposal
 const kind=args.kind??detectMediaKind(args.prompt);
 const skillContext={prompt:args.prompt,kind,task:args.task,hasAudioReference:args.hasAudioReference,hasSpeechAudio:args.hasSpeechAudio,speechLanguage:args.speechLanguage,accent:args.accent,hasCharacterReference:args.hasCharacterReference,characterRef:args.characterRef,visualStyle:args.visualStyle,attachmentRoles:args.attachmentRoles};
 const tier=reasoningTier(args.prompt,Boolean(args.hasReferences||args.characterRef));
 return {
  systemInstructions:compileSkillInstructions(skillContext),
  userText:args.prompt,
  activeSkillIds:resolveCreativeSkills(skillContext),
  privateReasoningTier:tier,
  privateRoute:resolvePrivateRouting(tier)
 };
}
/** Fail-closed live-call gate: every condition must hold. Only the Anthropic adapter exists; other providers never go live. */
export function llmPolicy(tier:ReasoningTier):{live:boolean;reason:string}{
 const e=process.env;
 if(e.LLM_PROVIDER_AUTHORIZED!=="true")return {live:false,reason:"provider not authorized"};
 if(e.ALLOW_LIVE_LLM!=="true")return {live:false,reason:"live llm disabled"};
 const r=resolvePrivateRouting(tier);
 if(!r)return {live:false,reason:"model id not configured"};
 if(r.provider!=="anthropic"||!r.modelId.startsWith("claude-"))return {live:false,reason:"adapter not implemented"};
 if(!e.ANTHROPIC_API_KEY)return {live:false,reason:"api key not configured"};
 return {live:true,reason:"live"};
}
// Model names, providers, token costs and route changes belong only in privileged logs.
// Never return this object to the frontend. Live LLM calls are deferred until
// the llmPolicy gate (authorization flags, model IDs, key) passes.
