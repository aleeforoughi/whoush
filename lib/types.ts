export type MediaKind = "image" | "video";
export type AgentPreference = "quality" | "speed" | "cost";
export type ApprovalMode = "ask" | "auto";
export type ReasoningTier = "fast" | "balanced" | "deep";

/** What a media model does. `generate` is text/image-to-image/video; the others take the customer's own media as the main input. */
export type MediaOperation = "generate" | "replace" | "motion_transfer" | "lip_sync";
/** Where the capability facts come from: the public API docs, or the provider's agent platform catalogue (not an API doc; paths and schemas unverified). */
export type EvidenceSource = "api_docs" | "agent_catalogue";
/** Public-safe capability facts. `verified` means the model's API path and input schema were read in provider docs (see docs/HIGGSFIELD_EVIDENCE.md). Unverified models of `api_docs` state only what is NOT promised (empty/false); unverified `agent_catalogue` models state what the provider's catalogue claims, which is never enough to submit or quote. `max: null` = supported, count unknown. */
export interface ModelCapabilities {
  verified: boolean;
  evidence?: string; // private pointer into docs/HIGGSFIELD_EVIDENCE.md; never serialized to consumers
  referenceImages: { supported: boolean; max: number | null };
  aspectRatios: readonly string[];
  durationsSeconds?: readonly number[]; // video SKU durations
  audio: boolean;
  lipSync: boolean;
  /** Follows the motion of a reference video (path, speed, timing) without copying its look. Unverified for every model: false. */
  motionReference: boolean;
  /** Edits a reference video while preserving its frames, cuts and audio. Unverified for every model: false. */
  videoReference: boolean;
}
export interface MediaRequirements { operation?: Exclude<MediaOperation, "generate">; referenceImages?: number; aspectRatio?: string; durationSeconds?: number; lipSync?: boolean; motionReference?: boolean; videoReference?: boolean; }
export interface MediaModel {
  id: string;
  name: string;
  kind: MediaKind;
  description: string;
  tags: readonly string[];
  aliases: readonly string[];
  /** FIXED integer demo SKU until verified. Absent exactly when `pricePending`. */
  neurons?: number;
  /** No Neuron SKU has been approved yet: the model can be suggested as "coming soon" but never quoted or proposed. */
  pricePending?: true;
  operations: readonly MediaOperation[];
  /** Private: where the capability facts were read. Never serialized to consumers. */
  evidenceSource: EvidenceSource;
  resolution: string;
  resolutions?: readonly string[];
  durationSeconds?: number;
  /** Lip-sync / talking-head limits from the provider catalogue (unverified). */
  characterImagesMax?: number;
  audioClipsMax?: number;
  audioSecondsRange?: readonly [number, number];
  locationImage?: boolean;
  capabilities: ModelCapabilities;
  verifiedApiPath?: string; // absent until schema is verified; private, never serialized to consumers
}
/** A model with an approved fixed Neuron SKU. */
export type PricedMediaModel = MediaModel & { neurons: number };
export const isPriced = (m: MediaModel): m is PricedMediaModel => !m.pricePending && Number.isSafeInteger(m.neurons) && (m.neurons as number) > 0;
/** A model Whoush recommends for the work but cannot offer yet. Never carries a price. */
export interface SuggestedModel { name: string; active: boolean; blockersFa: string[]; }
export interface MediaSuggestion {
  modelId: string;
  name: string;
  neurons: number;
  reason: string;
}
export interface GenerationProposal {
  operation: "generate_image" | "generate_video";
  intentSummary: string;
  suggestions: MediaSuggestion[];
  recommendedModelId: string;
  selectedModelId: string;
  fixedNeurons: number;
  explicitRejected?: { modelId: string; reasonFa: string }; // user named a model that cannot satisfy the request
  requiresApproval: true;
  quoteMode: "demo";
  message: string;
}
export interface PackageQuote {
  id: string;
  priceToman: number;
  baseNeurons: number;
  giftNeurons: number;
  totalNeurons: number;
  bonusPercent: number;
}
