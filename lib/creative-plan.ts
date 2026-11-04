/** Pure typed contracts for the private creative orchestration layer. No server-only imports. */
import {z} from "zod";
import {CHARACTER_VIEWS,type CharacterView} from "./characters";
import type {ReasoningTier} from "./types";
const VIEW_IDS=CHARACTER_VIEWS.map(v=>v.id) as [CharacterView,...CharacterView[]];
const accent=z.enum(["tehrani","original","unspecified"]);
export const CreativeTurnInputSchema=z.object({
 text:z.string().trim().min(1).max(4000),
 preference:z.enum(["quality","speed","cost"]).default("quality"),
 task:z.enum(["generate","edit","character"]).optional(),
 visualStyle:z.enum(["photoreal","stylized","auto"]).optional(),
 characterRef:z.object({
  id:z.string().regex(/^[a-z0-9-]{8,80}$/i),name:z.string().trim().min(2).max(80),
  angles:z.array(z.enum(VIEW_IDS)).min(1).max(6).refine(a=>new Set(a).size===a.length,"angles must be unique"),
  version:z.number().int().min(1)
 }).strict().optional(),
 audio:z.object({hasAudioReference:z.boolean(),hasSpeech:z.boolean(),language:z.enum(["fa","other","unknown"]),accent}).strict().optional()
}).strict();
export type CreativeTurnInput=z.infer<typeof CreativeTurnInputSchema>;
const s=(n=400)=>z.string().min(1).max(n);
const list=(n=20,len=400)=>z.array(s(len)).max(n);
/** Proposed creative direction, not EXIF or verified model controls. */
const CameraSchema=z.object({look:s(200),focalLengthMm:z.number().int().min(8).max(600),aperture:s(12),shutter:s(24),iso:z.number().int().min(50).max(25600),whiteBalanceK:z.number().int().min(2000).max(12000),framing:s(300),lighting:s(400),focus:s(300),aspectRatio:s(12)});
/** Proposed shot design, not verified provider parameters. */
const ShotSchema=z.object({shotSize:s(120),cameraMovement:s(300),lens:s(120),targetFps:z.number().int().min(8).max(120),shutterAngle:z.number().int().min(1).max(360),durationSeconds:z.number().min(1).max(60),blocking:s(500),continuityNotes:list(12)});
export const CreativePlanSchema=z.object({
 intentSummaryFa:s(500),mediaKind:z.enum(["image","video"]),mediaPrompt:s(3000),
 hardConstraints:list(),softPreferences:list(),negative:list(),
 camera:CameraSchema.optional(),shot:ShotSchema.optional(),
 identityLock:z.object({characterId:s(80),version:z.number().int().min(1),providedAngles:z.array(s(40)).max(6),lockedAttributes:list(12),allowedChanges:list(12)}).optional(),
 continuity:z.object({locks:list(),antiTeleport:list()}),
 realism:z.object({mode:z.enum(["photoreal","stylized"]),directives:list()}),
 speech:z.object({lipSync:z.object({status:z.enum(["needs_audio","planned_from_audio","not_requested"]),notes:list(8)}),accent}).optional(),
 qaChecklist:z.array(s(300)).min(3).max(20),clarifyingQuestionFa:s(400).optional()
});
export type CreativePlan=z.infer<typeof CreativePlanSchema>;
/** Whitelisted customer projection; never carries skills, tier, model/provider, usage or mediaPrompt. */
export type PublicCreativePlan=Pick<CreativePlan,"intentSummaryFa"|"mediaKind"|"hardConstraints"|"softPreferences"|"camera"|"shot"|"continuity"|"speech"|"qaChecklist"|"clarifyingQuestionFa">&{
 identityLock?:Pick<NonNullable<CreativePlan["identityLock"]>,"characterId"|"providedAngles"|"lockedAttributes"|"allowedChanges">;realism:{mode:CreativePlan["realism"]["mode"]};
};
export function toPublicPlan(p:CreativePlan):PublicCreativePlan{
 const il=p.identityLock;
 return {intentSummaryFa:p.intentSummaryFa,mediaKind:p.mediaKind,hardConstraints:p.hardConstraints,softPreferences:p.softPreferences,camera:p.camera,shot:p.shot,
  identityLock:il&&{characterId:il.characterId,providedAngles:il.providedAngles,lockedAttributes:il.lockedAttributes,allowedChanges:il.allowedChanges},
  continuity:p.continuity,realism:{mode:p.realism.mode},speech:p.speech,qaChecklist:p.qaChecklist,clarifyingQuestionFa:p.clarifyingQuestionFa};
}
/** Planner contract. `req` carries private data (system instructions, tier, route): never serialize it to customers. */
export type PlannerRequest={systemInstructions:string;userText:string;activeSkillIds:readonly string[];privateReasoningTier:ReasoningTier;privateRoute:{provider:string;modelId:string}|null;kind:"image"|"video";input:CreativeTurnInput};
export type PlannerResult={plan:unknown;usage?:unknown;modelId?:string};
export type PrivatePlanner=(req:PlannerRequest)=>Promise<PlannerResult>|PlannerResult;
export class PlannerUnavailableError extends Error{constructor(message="planner unavailable"){super(message);this.name="PlannerUnavailableError";}}
export class PlannerRefusedError extends Error{constructor(message="planner refused"){super(message);this.name="PlannerRefusedError";}}
export class PlannerInvalidOutputError extends Error{constructor(message="planner returned invalid output"){super(message);this.name="PlannerInvalidOutputError";}}
