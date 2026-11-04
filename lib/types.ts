export type MediaKind = "image" | "video";
export type AgentPreference = "quality" | "speed" | "cost";
export type ApprovalMode = "ask" | "auto";
export type ReasoningTier = "fast" | "balanced" | "deep";

/** Public-safe capability facts. `verified` means the model's API path and input schema were read in provider docs (see docs/HIGGSFIELD_EVIDENCE.md); unverified models state only what is NOT promised (empty/false = not verified, never "supported"). */
export interface ModelCapabilities {
  verified: boolean;
  evidence?: string; // private pointer into docs/HIGGSFIELD_EVIDENCE.md; never serialized to consumers
  referenceImages: { supported: boolean; max: number };
  aspectRatios: readonly string[];
  durationsSeconds?: readonly number[]; // video SKU durations
  audio: boolean;
  lipSync: boolean;
}
export interface MediaRequirements { referenceImages?: number; aspectRatio?: string; durationSeconds?: number; lipSync?: boolean; }
export interface MediaModel {
  id: string;
  name: string;
  kind: MediaKind;
  description: string;
  tags: readonly string[];
  aliases: readonly string[];
  neurons: number; // FIXED integer demo SKU until verified
  resolution: string;
  durationSeconds?: number;
  capabilities: ModelCapabilities;
  verifiedApiPath?: string; // absent until schema is verified; private, never serialized to consumers
}
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
