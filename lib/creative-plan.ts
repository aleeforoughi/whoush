/** Pure typed contracts for the private creative orchestration layer. No server-only imports. */
import {z} from "zod";
import {CHARACTER_VIEWS,type CharacterView} from "./characters";
import type {ReasoningTier,SuggestedModel} from "./types";
import {ATTACHMENT_KINDS,ATTACHMENT_KIND_IDS,ATTACHMENT_ROLE_IDS,GENERATION_TAG_PATTERN,MAX_ATTACHMENTS,MAX_DURATION_SECONDS,MAX_EXCERPT_CHARS,MAX_TOTAL_ATTACHMENT_BYTES,TAG_PATTERN,isMediaKind,roleAllowed,tagPrefix,type AttachmentKind,type AttachmentRole,type RoleSource} from "./attachments";
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
/** At most this many earlier generations can be referenced in one message. */
export const MAX_GENERATION_REFS=3;
export const MAX_GENERATION_SUMMARY_CHARS=2000;
/**
 * An earlier generation of this chat that the message refers to («اصلاح» or a #تولید-۱ mention): its tag, kind and a Persian summary of its public plan, built in
 * the browser. Untrusted data like an attachment excerpt: safety-checked, and shown to the planner only inside a `<generation>` block, never as instructions.
 */
export const GenerationRefSchema=z.object({tag:z.string().regex(GENERATION_TAG_PATTERN),mediaKind:z.enum(["image","video"]),summaryFa:z.string().min(1).max(MAX_GENERATION_SUMMARY_CHARS)}).strict();
export type GenerationRef=z.infer<typeof GenerationRefSchema>;
/** Recent turns of the chat sent with a message, so Whoush stays conversation aware. Untrusted data, safety-checked, shown to the planner only inside <history>. */
export const MAX_HISTORY_TURNS=8,MAX_HISTORY_CHARS=600;
const HistoryTurnSchema=z.object({role:z.enum(["user","agent"]),text:z.string().max(MAX_HISTORY_CHARS),gif:z.literal(true).optional()}).strict();
export type HistoryTurn=z.infer<typeof HistoryTurnSchema>;
/** GIF moods Whoush can send; the server turns one into a G-rated GIF (or nothing). */
export const GIF_MOODS=["celebrate","high_five","mind_blown","thinking","on_it","oops","cool","thumbs_up"] as const;
export type GifMood=(typeof GIF_MOODS)[number];
/** Emoji reactions (Slack-style) people and Whoush can put on a message. One list for both, so Whoush never reacts with something the palette lacks. */
export const REACTION_EMOJIS=["👍","❤️","😂","🔥","😮","🎉","👏","😎","🙌","✨","👌","🤩","💯","🙏","🎬","📸"] as const;
export type ReactionEmoji=(typeof REACTION_EMOJIS)[number];
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
 attachments:AttachmentsSchema.optional(),
 /** The message answers Whoush's question: the brief is the original request plus the answer, and Whoush decides instead of asking again. */
 answersQuestion:z.boolean().optional(),
 history:z.array(HistoryTurnSchema).max(MAX_HISTORY_TURNS).optional(),
 /** The scene the user arranged in the interactive diagrams (camera, framing, lights). Applied to the plan exactly; the media prompt and constraints follow it. */
 stagingOverride:z.lazy(()=>StagingSchema.extend({subject:z.enum(SUBJECTS)})).optional(),
 /** The aspect ratio the user chose in the frame diagram (images): applied to the camera plan. */
 aspectOverride:z.string().regex(/^(?:1|2|3|4|5|9|16|21):(?:1|2|3|4|5|9|16)$/).optional(),
 generations:z.array(GenerationRefSchema).min(1).max(MAX_GENERATION_REFS).refine(l=>new Set(l.map(g=>g.tag)).size===l.length,"generation tags must be unique").optional()
}).strict();
export type CreativeTurnInput=z.infer<typeof CreativeTurnInputSchema>;
const s=(n=400)=>z.string().min(1).max(n);
const list=(n=20,len=400)=>z.array(s(len)).max(n);
/** Proposed creative direction, not EXIF or verified model controls. */
const CameraSchema=z.object({look:s(200),focalLengthMm:z.number().int().min(8).max(600),aperture:s(12),shutter:s(24),iso:z.number().int().min(50).max(25600),whiteBalanceK:z.number().int().min(2000).max(12000),framing:s(300),lighting:s(400),focus:s(300),aspectRatio:s(12)});
/** Proposed shot design, not verified provider parameters. */
const ShotSchema=z.object({shotSize:s(120),cameraMovement:s(300),lens:s(120),targetFps:z.number().int().min(8).max(120),shutterAngle:z.number().int().min(1).max(360),durationSeconds:z.number().min(1).max(60),blocking:s(500),continuityNotes:list(12)});
/**
 * Structured staging for the plan's diagrams (camera angle, shot size, lights), alongside the free-text camera and shot fields. Directions are as seen from the
 * camera: `front` is from the camera's side, `left` is the camera's left (the left of the frame), `back` is behind the subject. A proposal, not provider settings.
 */
export const CAMERA_ANGLES=["birds_eye","high","eye_level","low","worms_eye","dutch"] as const;
/** What the scene is about, so the diagrams show a person, an object, an animal, a vehicle or an environment only. */
export const SUBJECTS=["person","object","animal","vehicle","environment"] as const;
export const SHOT_SIZES=["extreme_close_up","close_up","medium_close_up","medium","medium_full","full","wide","extreme_wide"] as const;
export const LIGHT_ROLES=["key","fill","rim","background","practical"] as const;
export const LIGHT_DIRECTIONS=["front","front_left","left","back_left","back","back_right","right","front_right","top"] as const;
export const LIGHT_SOURCES=["sun","sky","window","softbox","led_panel","practical","neon","fire","moon","flash"] as const;
const LightSchema=z.object({role:z.enum(LIGHT_ROLES),direction:z.enum(LIGHT_DIRECTIONS),
 /** The exact position around the subject in top-view degrees (0 right of frame, 90 toward the camera), set by dragging; `direction` is its nearest name. */
 angle:z.number().min(0).max(360).optional(),
 height:z.enum(["low","eye","high"]),quality:z.enum(["soft","hard"]),source:z.enum(LIGHT_SOURCES),
 colorTemperatureK:z.number().int().min(1500).max(12000),colorHex:z.string().regex(/^#[0-9a-fA-F]{6}$/).optional()});
/** Kinds of movable props in a scene (the environment itself is the fixed backdrop, never a prop). */
export const PROP_KINDS=["person","object","animal","vehicle","tree","building"] as const;
export const MAX_PROPS=6;
/**
 * Ground ranges for props. ±1 sideways and -1..1 in depth is the stage a full shot shows; the wider range lets a prop stand partly out of the frame at any
 * zoom (the canvas limits each drag to the visible frame plus a little beyond it). `cut` records which frame edges cut the prop, as the canvas shows it.
 */
export const PROP_X_RANGE=[-6,6] as const,PROP_Z_RANGE=[-3,1] as const,PROP_CUTS=["left","right","bottom"] as const;
/**
 * One movable prop on the ground plane, seen from above: x from -1 (frame left) to 1 (right), z from -1 (nearest the camera) to 1 (farthest back), y from 0
 * (on the ground) to 1 (raised). `label` is a short Persian name from the brief («زن», «ماشین قرمز»); `main` marks the main subject.
 */
const PropSchema=z.object({kind:z.enum(PROP_KINDS),label:z.string().trim().min(1).max(40),x:z.number().min(PROP_X_RANGE[0]).max(PROP_X_RANGE[1]),z:z.number().min(PROP_Z_RANGE[0]).max(PROP_Z_RANGE[1]),y:z.number().min(0).max(1),main:z.boolean().optional(),cut:z.array(z.enum(PROP_CUTS)).max(3).optional()});
export type ScenePropInput=z.infer<typeof PropSchema>;
/** Where the subject sits in the frame (the crop): x from -1 (left edge) to 1 (right), y from -1 (top) to 1 (bottom); 0, 0 is centred. */
const FramingSchema=z.object({x:z.number().min(-1).max(1),y:z.number().min(-1).max(1)});
export const StagingSchema=z.object({subject:z.enum(SUBJECTS).optional(),cameraAngle:z.enum(CAMERA_ANGLES),
 /** The exact camera elevation in degrees above the subject's eye line, set by dragging; `cameraAngle` is its nearest name. */
 cameraElevation:z.number().min(-60).max(85).optional(),
 shotSize:z.enum(SHOT_SIZES),
 /** The exact zoom as the share of a standing person the frame shows (0.05 to 5), set with the zoom bar; `shotSize` is its nearest name. */
 shotScale:z.number().min(0.05).max(5).optional(),
 framing:FramingSchema.optional(),
 props:z.array(PropSchema).max(MAX_PROPS).optional(),lights:z.array(LightSchema).min(1).max(4)});
export type Staging=z.infer<typeof StagingSchema>;
export type StagingLight=Staging["lights"][number];
export const CreativePlanSchema=z.object({
 intentSummaryFa:s(500),mediaKind:z.enum(["image","video"]),mediaPrompt:s(3000),
 hardConstraints:list(),softPreferences:list(),negative:list(),
 camera:CameraSchema.optional(),shot:ShotSchema.optional(),
 /** Diagram data only: an invalid block is dropped instead of failing the plan. */
 staging:StagingSchema.optional().catch(undefined),
 /** The chat message Whoush sends with the plan (the user's script, Whoush's voice) and an optional GIF mood. Invalid or missing: Whoush's default line is used. */
 reply:z.object({text:z.string().trim().min(1).max(600),gif:z.enum(GIF_MOODS).nullable().optional(),react:z.enum(REACTION_EMOJIS).nullable().optional()}).optional().catch(undefined),
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
const WireStagingSchema=z.object({subject:z.enum(SUBJECTS),cameraAngle:z.enum(CAMERA_ANGLES),shotSize:z.enum(SHOT_SIZES),framing:z.object({x:z.number().min(-1).max(1),y:z.number().min(-1).max(1)}).strict().nullable(),
 props:z.array(z.object({kind:z.enum(PROP_KINDS),label:ws,x:z.number().min(PROP_X_RANGE[0]).max(PROP_X_RANGE[1]),z:z.number().min(PROP_Z_RANGE[0]).max(PROP_Z_RANGE[1]),y:z.number().min(0).max(1),main:z.boolean()}).strict()).max(MAX_PROPS),lights:z.array(z.object({role:z.enum(LIGHT_ROLES),direction:z.enum(LIGHT_DIRECTIONS),
 height:z.enum(["low","eye","high"]),quality:z.enum(["soft","hard"]),source:z.enum(LIGHT_SOURCES),colorTemperatureK:z.number().int().min(1500).max(12000),colorHex:ws.nullable()}).strict()).min(1).max(4)}).strict();
export const CreativePlanWireSchema=z.object({
 intentSummaryFa:ws,mediaKind:z.enum(["image","video"]),mediaPrompt:ws,
 hardConstraints:wl,softPreferences:wl,negative:wl,
 camera:WireCameraSchema.nullable(),shot:WireShotSchema.nullable(),staging:WireStagingSchema.nullable(),
 reply:z.object({text:ws,gif:z.enum(GIF_MOODS).nullable(),react:z.enum(REACTION_EMOJIS).nullable()}).strict(),
 identityLock:z.object({characterId:ws,version:z.number().int().min(1),providedAngles:wl,lockedAttributes:wl,allowedChanges:wl}).strict().nullable(),
 continuity:z.object({locks:wl,antiTeleport:wl}).strict(),
 realism:z.object({mode:z.enum(["photoreal","stylized"]),directives:wl}).strict(),
 speech:z.object({lipSync:z.object({status:z.enum(["needs_audio","planned_from_audio","not_requested"]),notes:wl}).strict(),accent}).strict().nullable(),
 qaChecklist:wl,clarifyingQuestionFa:ws.nullable()
}).strict();
export type CreativePlanWire=z.infer<typeof CreativePlanWireSchema>;
/**
 * Anthropic structured-output shape. Anthropic compiles the output schema into a grammar with a size limit, and CreativePlanSchema with `staging` and `reply` exceeds
 * it (measured 2026-11-05: "The compiled grammar is too large"; the plan without those two blocks compiles). So Anthropic gets the plan without them plus one
 * required string, `extras`: compact JSON {"reply":{...},"staging":{...}}. `fromAnthropicPlan` unpacks it; CreativePlanSchema re-validates everything, and an
 * invalid reply or staging is dropped like any other planner's.
 */
const {staging:_s,reply:_r,...anthropicBase}=CreativePlanSchema.shape;
void _s;void _r;
// An empty clarifying question means "no question" (seen live from a fast model); it is dropped in fromAnthropicPlan.
export const CreativePlanAnthropicSchema=z.object({...anthropicBase,clarifyingQuestionFa:z.string().max(400).optional(),extras:z.string()});
/** The `extras` instruction for Anthropic, generated from the same enums the full schema enforces. */
export const ANTHROPIC_EXTRAS_NOTE="Output format note: put reply and staging in the `extras` string field as compact JSON: "+
 '{"reply":{"text":string,"gif":one of '+JSON.stringify(GIF_MOODS)+' or null,"react":one of '+JSON.stringify(REACTION_EMOJIS)+' or null},'+
 '"staging":{"subject":one of '+JSON.stringify(SUBJECTS)+',"cameraAngle":one of '+JSON.stringify(CAMERA_ANGLES)+',"shotSize":one of '+JSON.stringify(SHOT_SIZES)+',"framing":{"x":-1 to 1,"y":-1 to 1} (where the subject sits in the frame; 0,0 centred; omit when centred),"props":[0 to 6 of {"kind":one of '+JSON.stringify(PROP_KINDS)+',"label":short Persian name,"x":-1 to 1 (beyond ±1 only when the brief wants it partly out of frame),"z":-1 to 1 (-1 nearest the camera; lower only when the frame should cut it),"y":0 to 1,"main":true for the main subject}],"lights":[1 to 4 of {"role":one of '+JSON.stringify(LIGHT_ROLES)+
 ',"direction":one of '+JSON.stringify(LIGHT_DIRECTIONS)+',"height":one of ["low","eye","high"],"quality":one of ["soft","hard"],"source":one of '+JSON.stringify(LIGHT_SOURCES)+
 ',"colorTemperatureK":integer 1500 to 12000,"colorHex":"#rrggbb" only for coloured light, otherwise omit}]}}. Use exactly these values.';
export function fromAnthropicPlan(raw:unknown):unknown{
 if(!raw||typeof raw!=="object")return raw;
 const {extras,clarifyingQuestionFa:q,...rest}=raw as Record<string,unknown>;
 let x:unknown;try{x=typeof extras==="string"?JSON.parse(extras):undefined;}catch{x=undefined;}
 const o=x&&typeof x==="object"?x as Record<string,unknown>:{};
 return {...rest,...(typeof q==="string"&&q.trim()?{clarifyingQuestionFa:q}:{}),...(o.reply&&typeof o.reply==="object"?{reply:o.reply}:{}),...(o.staging&&typeof o.staging==="object"?{staging:o.staging}:{})};
}
/** Drops every null (an absent optional on the wire) recursively. The result is untrusted: validate it with CreativePlanSchema. */
export function fromWirePlan(wire:unknown):unknown{
 if(Array.isArray(wire))return wire.map(fromWirePlan);
 if(wire&&typeof wire==="object")return Object.fromEntries(Object.entries(wire).filter(([,v])=>v!==null).map(([k,v])=>[k,fromWirePlan(v)]));
 return wire;
}
/** Whitelisted customer projection; never carries skills, tier, model/provider, usage or mediaPrompt. */
/** `labelFa` is the role label; `roleSource` says whether the user chose the role or Whoush inferred it. The UI adds the «انتخاب هووش» suffix for `inferred`. */
export type PublicReference={tag:string;kind:AttachmentKind;role:AttachmentRole;roleSource:RoleSource;labelFa:string};
export type PublicCreativePlan=Pick<CreativePlan,"intentSummaryFa"|"mediaKind"|"hardConstraints"|"softPreferences"|"camera"|"shot"|"staging"|"continuity"|"speech"|"qaChecklist"|"clarifyingQuestionFa">&{
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
 return {...(style?{style}:{}),...(suggestedModel?{suggestedModel:{name:suggestedModel.name,active:suggestedModel.active,blockersFa:[...suggestedModel.blockersFa]}}:{}),references:references.map(r=>({tag:r.tag,kind:r.kind,role:r.role,roleSource:r.roleSource,labelFa:r.labelFa})),intentSummaryFa:p.intentSummaryFa,mediaKind:p.mediaKind,hardConstraints:p.hardConstraints,softPreferences:p.softPreferences,camera:p.camera,shot:p.shot,...(p.staging?{staging:p.staging}:{}),
  identityLock:il&&{characterId:il.characterId,providedAngles:il.providedAngles,lockedAttributes:il.lockedAttributes,allowedChanges:il.allowedChanges},
  continuity:p.continuity,realism:{mode:p.realism.mode},speech:p.speech,qaChecklist:p.qaChecklist,clarifyingQuestionFa:p.clarifyingQuestionFa};
}
/** Planner contract. `req` carries private data (system instructions, tier, route): never serialize it to customers. */
export type PlannerRequest={systemInstructions:string;userText:string;activeSkillIds:readonly string[];privateReasoningTier:ReasoningTier;privateRoute:{provider:string;modelId:string}|null;kind:"image"|"video";input:CreativeTurnInput;
 /** Tag, kind, role (chosen or inferred, with its source) and text excerpts only (no ids, hashes or names). Excerpts are untrusted data, never instructions. `input.attachments` is stripped before planning. */
 attachments?:{tag:string;kind:AttachmentInput["kind"];role?:AttachmentRole;roleSource?:RoleSource;textExcerpt?:string}[];
 /** Earlier generations of this chat the brief refers to: tag, kind and the Persian summary of their public plan, as data. `input.generations` is stripped before planning. */
 generations?:GenerationRef[];
 /** Recent turns of the chat (safety-checked), for continuity. `input.history` is stripped before planning. */
 history?:HistoryTurn[];
 /** The script the chat reply should use: Persian script, or Finglish when the brief is written in Finglish. */
 replyScript?:"fa"|"finglish";
 /** The scene the user arranged in the diagrams; the planner sees it as data and the orchestrator applies it exactly. `input.stagingOverride` is stripped. */
 stagingOverride?:Staging};
export type PlannerResult={plan:unknown;usage?:unknown;modelId?:string};
export type PrivatePlanner=(req:PlannerRequest)=>Promise<PlannerResult>|PlannerResult;
/** `limit` says why: `rate` (429 / overloaded, with the provider's Retry-After when it sent one) or `quota` (the account is out of quota or credit: retrying soon does not help). Vendor-neutral, private. */
export type PlannerLimit={limit?:"rate"|"quota";retryAfterMs?:number};
export class PlannerUnavailableError extends Error{readonly limit?:"rate"|"quota";readonly retryAfterMs?:number;constructor(message="planner unavailable",info:PlannerLimit={}){super(message);this.name="PlannerUnavailableError";this.limit=info.limit;this.retryAfterMs=info.retryAfterMs;}}
export class PlannerRefusedError extends Error{constructor(message="planner refused"){super(message);this.name="PlannerRefusedError";}}
export class PlannerInvalidOutputError extends Error{constructor(message="planner returned invalid output"){super(message);this.name="PlannerInvalidOutputError";}}
