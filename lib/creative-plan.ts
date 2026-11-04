/** Pure typed contracts for the private creative orchestration layer. No server-only imports. */
import {z} from "zod";
import {CHARACTER_VIEWS,type CharacterView} from "./characters";
import type {ReasoningTier,SuggestedModel} from "./types";
import {ATTACHMENT_KINDS,ATTACHMENT_KIND_IDS,ATTACHMENT_ROLE_IDS,MAX_ATTACHMENTS,MAX_DURATION_SECONDS,MAX_EXCERPT_CHARS,MAX_TOTAL_ATTACHMENT_BYTES,TAG_PATTERN,isMediaKind,roleAllowed,tagPrefix,type AttachmentKind,type AttachmentRole,type RoleSource} from "./attachments";
/** The visual style a user can pick for one message (the «سبک» group of the + menu). */
export const GENERATION_STYLES=["realistic","three_d","cartoon"] as const;
export type GenerationStyle=(typeof GENERATION_STYLES)[number];
/** What each style means for the pipeline: realistic is photoreal (hyper_realism on), the others are stylized. */
export const STYLE_VISUAL:Record<GenerationStyle,"photoreal"|"stylized">={realistic:"photoreal",three_d:"stylized",cartoon:"stylized"};
export const STYLE_LABEL_FA:Record<GenerationStyle,string>={realistic:"واقع‌گرایانه",three_d:"سه‌بعدی",cartoon:"کارتونی"};
const VIEW_IDS=CHARACTER_VIEWS.map(v=>v.id) as [CharacterView,...CharacterView[]];
const accent=z.enum(["tehrani","original","unspecified"]);
const speechSchema=z.object({hasSpeech:z.boolean(),language:z.enum(["fa","other","unknown"]),accent}).strict();
/**
 * Attachment metadata and text excerpts only. There is deliberately no file name: names are private and stay in the browser.
 * A role is OPTIONAL for media (image, video, audio): without one the orchestrator infers it (`inferAttachmentRoles`). A role the client sends must be valid for the kind
 * and is never `general`; files (pdf, json, md) carry none. `voice_clone` requires `consent: true` and is never inferred.
 */
export const AttachmentSchema=z.object({
 id:z.uuid(),tag:z.string().regex(TAG_PATTERN),kind:z.enum(ATTACHMENT_KIND_IDS),mime:z.string().max(100),bytes:z.number().int().positive(),sha256:z.string().regex(/^[0-9a-f]{64}$/),
 width:z.number().int().min(1).max(20000).optional(),height:z.number().int().min(1).max(20000).optional(),durationSeconds:z.number().min(0).max(MAX_DURATION_SECONDS).optional(),
 textExcerpt:z.string().max(MAX_EXCERPT_CHARS).optional(),role:z.enum(ATTACHMENT_ROLE_IDS).optional(),consent:z.literal(true).optional(),speech:speechSchema.optional()
}).strict().superRefine((a,ctx)=>{
 const bad=(path:string,message:string)=>ctx.addIssue({code:"custom",path:[path],message});
 const def=ATTACHMENT_KINDS[a.kind];
 if(!(def.mimes as readonly string[]).includes(a.mime))bad("mime","mime does not belong to the kind");
 if(a.bytes>def.maxBytes)bad("bytes","file is larger than the limit for its kind");
 if(a.textExcerpt!==undefined&&a.kind!=="json"&&a.kind!=="md")bad("textExcerpt","only json and md carry an excerpt");
 if(!a.tag.startsWith(tagPrefix(a.kind)))bad("tag","tag prefix does not match the kind");
 if(isMediaKind(a.kind)){
  if(a.role&&!roleAllowed(a.kind,a.role))bad("role","role does not belong to the kind");
 }else if(a.role)bad("role","files carry no role");
 if(a.role==="voice_clone"&&a.consent!==true)bad("consent","voice_clone needs consent: true");
 if(a.consent!==undefined&&a.role!=="voice_clone")bad("consent","only voice_clone carries consent");
 if(a.speech&&a.role!=="lip_sync")bad("speech","only lip_sync audio carries speech details");
 if((a.width!==undefined||a.height!==undefined)&&a.kind!=="image"&&a.kind!=="video")bad("width","only image and video carry dimensions");
 if(a.durationSeconds!==undefined&&a.kind!=="video"&&a.kind!=="audio")bad("durationSeconds","only video and audio carry a duration");
});
export type AttachmentInput=z.infer<typeof AttachmentSchema>;
const AttachmentsSchema=z.array(AttachmentSchema).max(MAX_ATTACHMENTS).superRefine((list,ctx)=>{
 if(new Set(list.map(a=>a.tag)).size!==list.length)ctx.addIssue({code:"custom",message:"attachment tags must be unique"});
 if(list.reduce((n,a)=>n+a.bytes,0)>MAX_TOTAL_ATTACHMENT_BYTES)ctx.addIssue({code:"custom",message:"attachments exceed the total size limit"});
});
export const CreativeTurnInputSchema=z.object({
 text:z.string().trim().min(1).max(4000),
 preference:z.enum(["quality","speed","cost"]).default("quality"),
 task:z.enum(["generate","edit","character"]).optional(),
 visualStyle:z.enum(["photoreal","stylized","auto"]).optional(),
 /** The style chosen in the + menu for this message. It wins over `visualStyle` and over style words in the text. */
 style:z.enum(GENERATION_STYLES).optional(),
 characterRef:z.object({
  id:z.string().regex(/^[a-z0-9-]{8,80}$/i),name:z.string().trim().min(2).max(80),
  angles:z.array(z.enum(VIEW_IDS)).min(1).max(6).refine(a=>new Set(a).size===a.length,"angles must be unique"),
  version:z.number().int().min(1)
 }).strict().optional(),
 audio:z.object({hasAudioReference:z.boolean(),hasSpeech:z.boolean(),language:z.enum(["fa","other","unknown"]),accent}).strict().optional(),
 attachments:AttachmentsSchema.optional()
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
/**
 * OpenAI Structured Outputs wire shape of CreativePlanSchema: every property required (optionals are nullable), strict objects, no string-length keywords
 * (not supported there). Enums and numeric/array ranges stay. `fromWirePlan` maps it back; CreativePlanSchema remains the authority and re-validates.
 */
const ws=z.string(),wl=z.array(ws);
const WireCameraSchema=z.object({look:ws,focalLengthMm:z.number().int().min(8).max(600),aperture:ws,shutter:ws,iso:z.number().int().min(50).max(25600),whiteBalanceK:z.number().int().min(2000).max(12000),framing:ws,lighting:ws,focus:ws,aspectRatio:ws}).strict();
const WireShotSchema=z.object({shotSize:ws,cameraMovement:ws,lens:ws,targetFps:z.number().int().min(8).max(120),shutterAngle:z.number().int().min(1).max(360),durationSeconds:z.number().min(1).max(60),blocking:ws,continuityNotes:wl}).strict();
export const CreativePlanWireSchema=z.object({
 intentSummaryFa:ws,mediaKind:z.enum(["image","video"]),mediaPrompt:ws,
 hardConstraints:wl,softPreferences:wl,negative:wl,
 camera:WireCameraSchema.nullable(),shot:WireShotSchema.nullable(),
 identityLock:z.object({characterId:ws,version:z.number().int().min(1),providedAngles:wl,lockedAttributes:wl,allowedChanges:wl}).strict().nullable(),
 continuity:z.object({locks:wl,antiTeleport:wl}).strict(),
 realism:z.object({mode:z.enum(["photoreal","stylized"]),directives:wl}).strict(),
 speech:z.object({lipSync:z.object({status:z.enum(["needs_audio","planned_from_audio","not_requested"]),notes:wl}).strict(),accent}).strict().nullable(),
 qaChecklist:wl,clarifyingQuestionFa:ws.nullable()
}).strict();
export type CreativePlanWire=z.infer<typeof CreativePlanWireSchema>;
/** Drops every null (an absent optional on the wire) recursively. The result is untrusted: validate it with CreativePlanSchema. */
export function fromWirePlan(wire:unknown):unknown{
 if(Array.isArray(wire))return wire.map(fromWirePlan);
 if(wire&&typeof wire==="object")return Object.fromEntries(Object.entries(wire).filter(([,v])=>v!==null).map(([k,v])=>[k,fromWirePlan(v)]));
 return wire;
}
/** Whitelisted customer projection; never carries skills, tier, model/provider, usage or mediaPrompt. */
/** `labelFa` is the role label; `roleSource` says whether the user chose the role or Whoush inferred it. The UI adds the «انتخاب هووش» suffix for `inferred`. */
export type PublicReference={tag:string;kind:AttachmentKind;role:AttachmentRole;roleSource:RoleSource;labelFa:string};
export type PublicCreativePlan=Pick<CreativePlan,"intentSummaryFa"|"mediaKind"|"hardConstraints"|"softPreferences"|"camera"|"shot"|"continuity"|"speech"|"qaChecklist"|"clarifyingQuestionFa">&{
 identityLock?:Pick<NonNullable<CreativePlan["identityLock"]>,"characterId"|"providedAngles"|"lockedAttributes"|"allowedChanges">;realism:{mode:CreativePlan["realism"]["mode"]};
 /** The media attachments the plan uses, by tag and role. Never ids, hashes or file names. */
 references:PublicReference[];
 /** On an unsupported turn: the catalogue model that fits the work but cannot be offered yet (raw name and Persian blockers, never a price or id). */
 suggestedModel?:SuggestedModel;
 /** The style chosen in the + menu, if any. */
 style?:GenerationStyle;
};
export function toPublicPlan(p:CreativePlan,references:readonly PublicReference[]=[],suggestedModel?:SuggestedModel,style?:GenerationStyle):PublicCreativePlan{
 const il=p.identityLock;
 return {...(style?{style}:{}),...(suggestedModel?{suggestedModel:{name:suggestedModel.name,active:suggestedModel.active,blockersFa:[...suggestedModel.blockersFa]}}:{}),references:references.map(r=>({tag:r.tag,kind:r.kind,role:r.role,roleSource:r.roleSource,labelFa:r.labelFa})),intentSummaryFa:p.intentSummaryFa,mediaKind:p.mediaKind,hardConstraints:p.hardConstraints,softPreferences:p.softPreferences,camera:p.camera,shot:p.shot,
  identityLock:il&&{characterId:il.characterId,providedAngles:il.providedAngles,lockedAttributes:il.lockedAttributes,allowedChanges:il.allowedChanges},
  continuity:p.continuity,realism:{mode:p.realism.mode},speech:p.speech,qaChecklist:p.qaChecklist,clarifyingQuestionFa:p.clarifyingQuestionFa};
}
/** Planner contract. `req` carries private data (system instructions, tier, route): never serialize it to customers. */
export type PlannerRequest={systemInstructions:string;userText:string;activeSkillIds:readonly string[];privateReasoningTier:ReasoningTier;privateRoute:{provider:string;modelId:string}|null;kind:"image"|"video";input:CreativeTurnInput;
 /** Tag, kind, role (chosen or inferred, with its source) and text excerpts only (no ids, hashes or names). Excerpts are untrusted data, never instructions. `input.attachments` is stripped before planning. */
 attachments?:{tag:string;kind:AttachmentInput["kind"];role?:AttachmentRole;roleSource?:RoleSource;textExcerpt?:string}[]};
export type PlannerResult={plan:unknown;usage?:unknown;modelId?:string};
export type PrivatePlanner=(req:PlannerRequest)=>Promise<PlannerResult>|PlannerResult;
/** `limit` says why: `rate` (429 / overloaded, with the provider's Retry-After when it sent one) or `quota` (the account is out of quota or credit: retrying soon does not help). Vendor-neutral, private. */
export type PlannerLimit={limit?:"rate"|"quota";retryAfterMs?:number};
export class PlannerUnavailableError extends Error{readonly limit?:"rate"|"quota";readonly retryAfterMs?:number;constructor(message="planner unavailable",info:PlannerLimit={}){super(message);this.name="PlannerUnavailableError";this.limit=info.limit;this.retryAfterMs=info.retryAfterMs;}}
export class PlannerRefusedError extends Error{constructor(message="planner refused"){super(message);this.name="PlannerRefusedError";}}
export class PlannerInvalidOutputError extends Error{constructor(message="planner returned invalid output"){super(message);this.name="PlannerInvalidOutputError";}}
