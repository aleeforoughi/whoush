import "server-only";
import {createHash,randomUUID} from "node:crypto";
import {buildProposal,NoCompatibleModelError} from "./agent";
import {CHARACTER_VIEWS,REQUIRED_CHARACTER_VIEWS} from "./characters";
import {CreativePlanSchema,CreativeTurnInputSchema,toPublicPlan,PlannerInvalidOutputError,PlannerRefusedError,PlannerUnavailableError,type CreativePlan,type PlannerRequest,type PlannerResult,type PrivatePlanner,type PublicCreativePlan} from "./creative-plan";
import {llmPolicy,preparePrivateCreativeRequest} from "./llm";
import {defaultAuditSink,type PrivateAuditRecord,type PrivateAuditSink} from "./private-audit";
import {detectMediaKind} from "./router";
import {evaluateTextSafety,normalizePersian,type SafetyCategory} from "./safety";
import {SKILLS,SKILL_REGISTRY_VERSION} from "./skills";
import type {GenerationProposal} from "./types";
export type OrchestratorDeps={planner?:PrivatePlanner;audit?:PrivateAuditSink;now?:()=>Date};
export type OrchestratorResult=
 |{status:"planned";turnId:string;proposal:GenerationProposal;plan:PublicCreativePlan}
 |{status:"unsupported";turnId:string;plan:PublicCreativePlan;message:string}
 |{status:"restricted";decision:"block"|"review";category:SafetyCategory;message:string};
const FA_REFUSED="این درخواست در حال حاضر قابل پردازش نیست. لطفاً آن را با توضیح غیرحساس‌تر دوباره بنویس.";
const FA_NO_REFS="برنامه تولید با کاراکتر انتخاب‌شده آماده است، اما هنوز هیچ مدل تأییدشده‌ای عکس مرجع کاراکتر را نمی‌پذیرد؛ برای همین فعلاً پیشنهاد تولید و هزینه نمایش داده نمی‌شود.";
const lipsMsg="برنامه لیپ‌سینک آماده است، اما هنوز هیچ مدل تأییدشده‌ای هماهنگی لب را پشتیبانی نمی‌کند؛ برای همین فعلاً پیشنهاد تولید و هزینه نمایش داده نمی‌شود.";
// ---- deterministic planner (pure, no network): complete valid plan from the active skills ----
const has=(p:string,w:RegExp)=>w.test(p);
const PORTRAIT=/\b(portrait|headshot|selfie|face|person|people|woman|man|girl|boy|bride|groom|model|child|presenter|speaker|host|singer|actor|actress)\b|lip sync|lipsync|پرتره|چهره|سلفی|عروس|داماد|دختر|پسر|زن|مرد|مدل|شخص|کودک/;
const NIGHT=/\b(night|neon|moonlit)\b|شب|نئون/;
const VERTICAL=/\b(reels?|tiktok|stor(y|ies)|vertical|shorts)\b|استوری|ریلز|تیک تاک|عمودی/;
const MOVES=[[/\b(drone|aerial)\b|پهپاد/,"slow aerial glide forward"],[/\b(orbit|around)\b|چرخش/,"slow orbit around the subject"],[/\b(pan)\b|پن/,"slow horizontal pan"],[/\b(static|locked|still camera)\b|ثابت/,"locked-off tripod, no camera movement"]] as const;
const viewTitles=(ids:readonly string[])=>ids.map(id=>CHARACTER_VIEWS.find(v=>v.id===id)?.title??id).join("، ");
const missingViews=(angles:readonly string[])=>REQUIRED_CHARACTER_VIEWS.filter(v=>!angles.includes(v));
const missingQuestion=(angles:readonly string[])=>{const m=missingViews(angles);return m.length?"زاویه‌های «"+viewTitles(m)+"» هنوز اضافه نشده‌اند و ساخته نمی‌شوند؛ ادامه بدهیم یا اول آن‌ها را اضافه می‌کنی؟":undefined;};
export function deterministicPlanner(req:PlannerRequest):{plan:CreativePlan}{
 const {input,kind,activeSkillIds:ids}=req;const text=input.text;const p=normalizePersian(text);
 const portrait=has(p,PORTRAIT),night=has(p,NIGHT),vertical=has(p,VERTICAL),photoreal=ids.includes("hyper_realism"),ref=input.characterRef;
 const dur=/(\d{1,2})\s*(?:s|sec|secs|second|seconds|ثانیه)\b/.exec(p);
 const camera=portrait
  ?{look:"full-frame mirrorless look, natural color science",focalLengthMm:85,aperture:night?"f/1.8":"f/2.0",shutter:night?"1/125s":"1/200s",iso:night?1600:200,whiteBalanceK:night?3800:5600,framing:"head-and-shoulders, eyes on the upper third, subject slightly off-center",lighting:"soft key about 45 degrees to the camera side, gentle fill, subtle rim separation",focus:"focal plane on the nearest eye, shallow depth of field",aspectRatio:vertical?"9:16":"4:5"}
  :{look:"full-frame mirrorless look, natural color science",focalLengthMm:35,aperture:night?"f/2.8":"f/5.6",shutter:night?"1/60s":"1/250s",iso:night?1600:100,whiteBalanceK:night?4000:5600,framing:"wide environmental framing, horizon on a third, foreground-midground-background layering",lighting:"natural directional light with consistent shadow direction, soft overcast or golden-hour quality",focus:"deep depth of field, focus about one third into the scene",aspectRatio:vertical?"9:16":"3:2"};
 const mv=MOVES.find(([re])=>re.test(p))?.[1]??"slow dolly-in at walking pace";
 const shot={shotSize:portrait?"medium close-up":"wide establishing shot",cameraMovement:mv,lens:portrait?"50mm equivalent":"28mm equivalent",targetFps:24,shutterAngle:180,durationSeconds:dur?Math.min(60,Math.max(1,Number(dur[1]))):5,blocking:"subject action is motivated and readable; camera axis and screen direction stay consistent",continuityNotes:["First, middle and last frames share identity, wardrobe, lighting direction and palette","Natural motion blur from the 180 degree shutter; no FPS drift"]};
 const lips=ids.includes("persian_lip_sync_phonetics"),speech=input.audio?.hasSpeech===true;
 const hard=["Follow the brief exactly; do not add unrequested subjects, text or logos",
  ...(input.task==="edit"?["Preserve all unedited source regions: identity, framing, lighting, color and pixels"]:[]),
  ...(kind==="video"?["Keep people and objects continuous; no teleporting, sudden appearance or unintended cuts"]:[]),
  ...(ref?["Use only the provided reference angles; never invent missing views"]:[])];
 const directives=photoreal
  ?["Natural skin microtexture with visible pores, fine hairs and subtle asymmetry where people appear","No waxy, plastic or over-smoothed skin","Physically accurate materials: fabric weave, metal, glass, wood, stone","No gratuitous film grain, glow, haze or stylistic filters unless requested","Balanced exposure with natural highlight roll-off"]
  :["Respect the requested stylized look; do not impose photographic textures or lens artifacts","Keep line, palette and shading consistent across the whole frame"];
 const plan:CreativePlan={
  intentSummaryFa:(kind==="image"?"ساخت تصویر: ":"ساخت ویدیو: ")+text.replace(/\s+/g," ").slice(0,160)+(text.length>160?"…":""),
  mediaKind:kind,
  mediaPrompt:(text.slice(0,1700)+"\nDirection: "+(kind==="image"?[camera.focalLengthMm+"mm",camera.aperture,camera.shutter,"ISO "+camera.iso,camera.whiteBalanceK+"K",camera.framing,camera.lighting].join(", "):[shot.shotSize,shot.cameraMovement,shot.targetFps+"fps",shot.shutterAngle+" degree shutter",shot.durationSeconds+"s"].join(", "))+". "+directives.join(". ")+". "+hard.join(". ")).slice(0,3000),
  hardConstraints:hard,
  softPreferences:[kind==="image"?"Aspect ratio "+camera.aspectRatio:"Platform-friendly framing with a clear first-second hook",...(night?["Low-light mood with practical light sources"]:[])],
  negative:["extra fingers","distorted anatomy","garbled or misspelled text","watermark",...(photoreal?["waxy or plastic skin","over-smoothing","gratuitous grain, glow or filters"]:[])],
  camera:kind==="image"?camera:undefined,shot:kind==="video"?shot:undefined,
  identityLock:ref?{characterId:ref.id,version:ref.version,providedAngles:[...ref.angles],lockedAttributes:["face geometry","hairstyle and hairline","skin tone and texture","body proportions","age presentation","wardrobe unless changed"],allowedChanges:["pose and expression","environment and lighting as requested","camera angle"]}:undefined,
  continuity:{locks:["Keep identity, wardrobe, hairstyle, props and palette consistent across frames and revisions","Fixed lighting direction and time of day unless the brief changes them","Change nothing the user did not ask to change"],
   antiTeleport:kind==="video"?["Every person and object keeps permanence: no sudden appearance or disappearance","Hand-object contact and trajectories stay physically plausible","No jumps in position between consecutive frames"]:[]},
  realism:{mode:photoreal?"photoreal":"stylized",directives},
  speech:kind==="video"?{lipSync:lips?{status:speech?"planned_from_audio":"needs_audio",notes:speech?["Derive mouth timing from the supplied audio; no text-only timestamps","Keep the source voice, words and accent unchanged",...(ids.includes("tehrani_accent")?["Tehrani accent is a creative target for newly written dialogue only; supplied audio is never altered"]:[])]:["Supply the spoken audio so mouth timing can be aligned; timing is never estimated from text alone"]}:{status:"not_requested",notes:[]},accent:ids.includes("tehrani_accent")?"tehrani":input.audio?.accent==="original"?"original":"unspecified"}:undefined,
  qaChecklist:["Subject, count and composition match the brief","Anatomy, hands and geometry are plausible","Visible Persian or English text is spelled correctly with joined letters",kind==="video"?"First, middle and last frames keep identity and lighting; no teleporting objects; duration and FPS match the plan":"Lighting, exposure and perspective are consistent",...(photoreal?["Skin and materials read as natural, not waxy or over-filtered"]:[])],
  clarifyingQuestionFa:ref?missingQuestion(ref.angles):undefined
 };
 return {plan};
}
// ---- invariants: planner output is untrusted ----
function enforce(raw:CreativePlan,req:PlannerRequest):{plan:CreativePlan;corrections:string[]}{
 const c:string[]=[],det=deterministicPlanner(req).plan as CreativePlan,p:CreativePlan={...raw},{kind,input,activeSkillIds:ids}=req,ref=input.characterRef;
 const note=(n:string,cond:boolean)=>{if(cond)c.push(n);return cond;};
 if(note("media_kind",p.mediaKind!==kind))p.mediaKind=kind;
 if(kind==="image"){if(note("shot_dropped",Boolean(p.shot)))delete p.shot;if(note("camera_filled",!p.camera))p.camera=det.camera;}
 else if(note("shot_filled",!p.shot))p.shot=det.shot;
 if(note("continuity_filled",!p.continuity.locks.length||(kind==="video"&&!p.continuity.antiTeleport.length)))p.continuity={locks:p.continuity.locks.length?p.continuity.locks:det.continuity.locks,antiTeleport:kind==="video"&&!p.continuity.antiTeleport.length?det.continuity.antiTeleport:p.continuity.antiTeleport};
 if(!ref){if(note("identity_dropped",Boolean(p.identityLock)))delete p.identityLock;}
 else{
  const il=p.identityLock??det.identityLock!;
  note("identity_overwritten",!p.identityLock||il.characterId!==ref.id||il.version!==ref.version||il.providedAngles.join()!==ref.angles.join());
  p.identityLock={...il,characterId:ref.id,version:ref.version,providedAngles:[...ref.angles],lockedAttributes:il.lockedAttributes.length?il.lockedAttributes:det.identityLock!.lockedAttributes};
  if(!p.clarifyingQuestionFa)p.clarifyingQuestionFa=missingQuestion(ref.angles);
 }
 const photoreal=ids.includes("hyper_realism");
 if(note("realism_mode",p.realism.mode!==(photoreal?"photoreal":"stylized")||!p.realism.directives.length))p.realism=det.realism;
 if(kind==="image"){if(note("speech_dropped",Boolean(p.speech)))delete p.speech;}
 else{
  const lips=ids.includes("persian_lip_sync_phonetics"),status=!lips?"not_requested":input.audio?.hasSpeech?"planned_from_audio":"needs_audio";
  const accent=ids.includes("tehrani_accent")?"tehrani":input.audio?.accent==="original"?"original":"unspecified";
  const s=p.speech??det.speech!;
  note("speech",!p.speech||s.lipSync.status!==status||s.accent!==accent);
  p.speech={lipSync:{status,notes:s.lipSync.status===status&&s.lipSync.notes.length?s.lipSync.notes:det.speech!.lipSync.notes},accent};
 }
 return {plan:p,corrections:c};
}
// Customer projection must not echo vendor/model names, skill titles/ids or prompt internals unless the user wrote them.
const FORBIDDEN=["claude","anthropic","openai","gpt","sonnet","opus","haiku","systeminstructions","reasoningtier","promptsha256",...Object.entries(SKILLS).flatMap(([id,s])=>[s.title.toLowerCase(),...(id.includes("_")?[id]:[])])];
const leaks=(pub:PublicCreativePlan,userText:string)=>{const j=JSON.stringify(pub).toLowerCase(),u=userText.toLowerCase();return FORBIDDEN.some(t=>j.includes(t)&&!u.includes(t));};
// ---- private prompt store for the generation phase (bounded, server memory only) ----
const MAX_PROMPTS=200;
const store=()=>((globalThis as {__whoushPrompts?:Map<string,string>}).__whoushPrompts??=new Map());
export const getPrivateMediaPrompt=(turnId:string):string|undefined=>store().get(turnId);
function keepPrompt(turnId:string,prompt:string){const m=store();m.set(turnId,prompt);while(m.size>MAX_PROMPTS)m.delete(m.keys().next().value as string);}
// ---- orchestration ----
export async function orchestrateCreativeTurn(rawInput:unknown,deps:OrchestratorDeps={}):Promise<OrchestratorResult>{
 const input=CreativeTurnInputSchema.parse(rawInput),audit=deps.audit??defaultAuditSink,now=deps.now??(()=>new Date());
 const safety=evaluateTextSafety(input.text);
 if(safety.decision!=="allow")return {status:"restricted",decision:safety.decision,category:safety.category,message:safety.message};
 const kind=detectMediaKind(input.text),a=input.audio,ref=input.characterRef;
 const prep=preparePrivateCreativeRequest({prompt:input.text,kind,task:input.task,hasReferences:Boolean(ref||a?.hasAudioReference),hasAudioReference:a?(a.hasAudioReference||a.hasSpeech):undefined,hasSpeechAudio:a?.hasSpeech,speechLanguage:a?.language,accent:a?.accent,characterRef:ref,visualStyle:input.visualStyle});
 const req:PlannerRequest={...prep,privateRoute:prep.privateRoute&&{provider:prep.privateRoute.provider,modelId:prep.privateRoute.modelId},kind,input};
 const turnId=randomUUID();
 const rec=(x:Partial<PrivateAuditRecord>)=>audit.record({turnId,at:now().toISOString(),skillRegistryVersion:SKILL_REGISTRY_VERSION,activeSkillIds:[...prep.activeSkillIds],reasoningTier:prep.privateReasoningTier,route:req.privateRoute,planner:"deterministic",promptSha256:createHash("sha256").update(input.text).digest("hex"),...x});
 let planner=deps.planner,label:PrivateAuditRecord["planner"]=planner&&planner!==deterministicPlanner?"live":"deterministic",fallbackReason:string|undefined;
 if(!planner){
  const pol=llmPolicy(prep.privateReasoningTier);
  if(pol.live&&req.privateRoute){const modelId=req.privateRoute.modelId;label="live";planner=async r=>(await import("./llm-anthropic")).planWithAnthropic(r,modelId);}
  else{planner=deterministicPlanner;fallbackReason=pol.reason;}
 }
 let result:PlannerResult|undefined;
 try{result=await planner(req);}
 catch(e){
  if(e instanceof PlannerRefusedError){rec({planner:label,fallbackReason:"planner_refused"});return {status:"restricted",decision:"review",category:"none",message:FA_REFUSED};}
  label="deterministic";fallbackReason=e instanceof PlannerUnavailableError?"planner_unavailable":e instanceof PlannerInvalidOutputError?"invalid_output":"planner_error";
 }
 const finalize=(raw:unknown)=>{
  const v=CreativePlanSchema.safeParse(raw);if(!v.success)return {reason:"invalid_output"};
  const e=enforce(v.data,req);return leaks(toPublicPlan(e.plan),input.text)?{reason:"leak_filtered"}:{e};
 };
 let fin=result?finalize(result.plan):{reason:fallbackReason??"planner_error"};
 if(!fin.e){label="deterministic";fallbackReason=fin.reason;fin=finalize(deterministicPlanner(req).plan);}
 if(!fin.e)throw new Error("deterministic planner produced an invalid plan");
 const {plan,corrections}=fin.e;
 // plan inspection: LLM output never bypasses the safety layer
 for(const t of [plan.mediaPrompt,...plan.hardConstraints]){
  const r=evaluateTextSafety(t);
  if(r.decision!=="allow"){rec({planner:label,fallbackReason:"plan_restricted",corrections,usage:result?.usage});return {status:"restricted",decision:r.decision,category:r.category,message:r.message};}
 }
 // Hard capability requirements: a character reference needs reference-image input, lip sync needs a lip-sync model.
 const requirements={referenceImages:ref?ref.angles.length:undefined,lipSync:kind==="video"&&prep.activeSkillIds.includes("persian_lip_sync_phonetics")?true:undefined};
 let proposal:GenerationProposal;
 try{proposal=buildProposal(input.text,input.preference,requirements);}
 catch(e){
  if(!(e instanceof NoCompatibleModelError))throw e;
  rec({planner:label,fallbackReason:"no_compatible_model",corrections:corrections.length?corrections:undefined});
  return {status:"unsupported",turnId,plan:toPublicPlan(plan),message:ref?FA_NO_REFS:lipsMsg};
 }
 keepPrompt(turnId,plan.mediaPrompt);
 rec({planner:label,fallbackReason,corrections:corrections.length?corrections:undefined,usage:label==="live"?result?.usage:undefined});
 return {status:"planned",turnId,proposal,plan:toPublicPlan(plan)};
}
