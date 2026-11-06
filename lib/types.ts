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
  /** Takes a still image as the first frame of the video (image-to-video start frame). No API-docs evidence for our ids: false everywhere. */
  startImage: boolean;
  /** Ends the video on a still image (end frame). No API-docs evidence for our ids: false everywhere. */
  endImage: boolean;
  /** Continues a supplied video from its last frame. No API-docs evidence for our ids: false everywhere. */
  videoContinuation: boolean;
}
export interface MediaRequirements { operation?: Exclude<MediaOperation, "generate">; referenceImages?: number; aspectRatio?: string; durationSeconds?: number; lipSync?: boolean; motionReference?: boolean; videoReference?: boolean; startImage?: boolean; endImage?: boolean; videoContinuation?: boolean; }
/** The direct provider whose API runs a model (docs/PROVIDERS.md). Private: never serialized to consumers. */
export type MediaProviderId = "higgsfield" | "google" | "byteplus" | "kling";
export interface MediaModel {
  id: string;
  /** Private: which provider's API runs it. */
  provider: MediaProviderId;
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
  /** Measured submit-to-completion time in seconds (live checks in docs/evidence/). Paces the progress estimate only; never shown as a promise. */
  typicalSeconds?: number;
  /** Lip-sync / talking-head limits from the provider catalogue (unverified). */
  characterImagesMax?: number;
  audioClipsMax?: number;
  audioSecondsRange?: readonly [number, number];
  locationImage?: boolean;
  /** Accepted source-video length in seconds for edit models that take a video (documented limits). */
  sourceVideoSecondsRange?: readonly [number, number];
  /** Fixed integer SKUs by source-video length (ascending `upToSeconds`, the last equal to the range maximum), for models billed per input second. Mutually exclusive with `neurons`. */
  sourceSecondsSkus?: readonly { upToSeconds: number; neurons: number }[];
  capabilities: ModelCapabilities;
  verifiedApiPath?: string; // absent until schema is verified; private, never serialized to consumers
  /** Private: the provider's own model id, exactly as its API reference spells it (docs/evidence). */
  providerModel?: string;
  /** Private: the provider settings this SKU fixes (size, resolution, duration), so the billed configuration is the SKU's, never a provider default. */
  providerParams?: Readonly<Record<string, string | number | boolean>>;
}
/** A model with an approved fixed Neuron SKU. */
export type PricedMediaModel = MediaModel & { neurons: number };
export const isPriced = (m: MediaModel): m is PricedMediaModel => !m.pricePending && Number.isSafeInteger(m.neurons) && (m.neurons as number) > 0;
/** A model with any approved fixed SKU: one Neuron price, or a band table by source-video length. */
export const hasApprovedPrice = (m: MediaModel): boolean => isPriced(m) || (!m.pricePending && Boolean(m.sourceSecondsSkus?.length));
/** A model Whoush recommends for the work but cannot offer yet. Never carries a price. */
export interface SuggestedModel { name: string; active: boolean; blockersFa: string[]; }
export interface MediaSuggestion {
  modelId: string;
  name: string;
  neurons: number;
  reason: string;
  /** Public facts of this SKU from the catalogue, for the generation card's settings (never provider details): its output resolution, its fixed duration
   * for video, and the aspect ratios its verified API schema accepts (empty when unverified). */
  resolution?: string;
  durationSeconds?: number;
  aspectRatios?: readonly string[];
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
