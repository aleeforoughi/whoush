export type MediaKind = "image" | "video";
export type AgentPreference = "quality" | "speed" | "cost";
export type ApprovalMode = "ask" | "auto";
export type ReasoningTier = "fast" | "balanced" | "deep";

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
  verifiedApiPath?: string; // absent until schema is verified
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
