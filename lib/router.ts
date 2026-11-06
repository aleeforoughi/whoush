import { MEDIA_CATALOG } from "./catalog";
import { hasApprovedPrice, isPriced, type AgentPreference, type MediaKind, type MediaModel, type MediaRequirements, type PricedMediaModel, type ReasoningTier, type SuggestedModel } from "./types";
import {needsHostedMedia} from "./policy";
import {mediaIntent,type MediaIntent} from "./media-intent";
import {offerable} from "./model-availability";
const norm=(s:string)=>s.toLocaleLowerCase("en-US").trim();
/** What the prompt asks to make (lib/media-intent.ts), else the kind of a model it names («با کلینگ»), else undefined: nothing says. */
export function requestedMediaKind(prompt:string):MediaIntent|undefined {
 const said=mediaIntent(prompt);
 if(said) return said;
 const p=norm(prompt);
 for(const m of MEDIA_CATALOG){if(m.aliases.some(a=>p.includes(norm(a)))) return m.kind;}
 return undefined;
}
/** The kind to make: «both» is made as a video (its opening frame is the photo), and nothing said is a photo. The orchestrator asks instead of guessing. */
export function detectMediaKind(prompt:string):MediaKind {
 const k=requestedMediaKind(prompt);
 return k==="both"?"video":k??"image";
}
export function explicitMediaModel(prompt:string,kind:MediaKind):MediaModel|undefined {
 const p=norm(prompt);
 const matching=MEDIA_CATALOG.filter(m=>m.kind===kind).flatMap(m=>m.aliases.map(a=>({model:m,alias:norm(a)}))).filter(x=>p.includes(x.alias));
 return matching.sort((a,b)=>b.alias.length-a.alias.length)[0]?.model;
}
/** Persian reason when the model cannot satisfy the requirements, else undefined. Unverified capabilities never satisfy a requirement. */
export function modelIneligibility(m:MediaModel,r:MediaRequirements={},opts:{assumeUnknownMax?:boolean}={}):string|undefined {
 const c=m.capabilities,max=c.referenceImages.max;
 if(!m.operations.includes(r.operation??"generate")) return "این مدل این نوع کار را پشتیبانی نمی‌کند.";
 // `max: null` = supported with an unknown count: it cannot satisfy a hard requirement, but a suggestion ("coming soon") may assume it.
 // The user's own photos (a person) need a model documented to keep identity from them: Nano Banana 2 and 2.1 take up to 4 people (docs/evidence/GOOGLE.md).
 // Seedance rejects real faces (docs/evidence/BYTEPLUS.md finding 5); Seedream documents no person references, so it is not offered for them.
 if((r.savedCharacter||(r.identityReference&&!c.identityReferences))&&m.provider!=="higgsfield") return "این مدل هنوز چهره یا ظاهر را از عکس‌های خودت نگه نمی‌دارد.";
 if(r.referenceImages&&(!c.referenceImages.supported||(max===null?!opts.assumeUnknownMax:r.referenceImages>max))) return "این مدل از تصویر مرجع به این تعداد پشتیبانی نمی‌کند.";
 if(r.aspectRatio&&!c.aspectRatios.includes(r.aspectRatio)) return "این مدل نسبت تصویر درخواستی را پشتیبانی نمی‌کند.";
 if(r.durationSeconds!==undefined&&!(c.durationsSeconds??[]).includes(r.durationSeconds)) return "این مدل مدت‌زمان درخواستی را پشتیبانی نمی‌کند.";
 if(r.lipSync&&!c.lipSync) return "این مدل همگام‌سازی لب را پشتیبانی نمی‌کند.";
 if(r.motionReference&&!c.motionReference) return "این مدل الگوی حرکت از ویدیوی مرجع را پشتیبانی نمی‌کند.";
 if(r.videoReference&&!c.videoReference) return "این مدل ادیت روی ویدیوی مرجع را پشتیبانی نمی‌کند.";
 if(r.startImage&&!c.startImage) return "این مدل ساخت ویدیو از روی فریم اول را پشتیبانی نمی‌کند.";
 if(r.endImage&&!c.endImage) return "این مدل پایان ویدیو روی فریم آخر را پشتیبانی نمی‌کند.";
 if(r.videoContinuation&&!c.videoContinuation) return "این مدل ادامهٔ ویدیوی موجود را پشتیبانی نمی‌کند.";
 return undefined;
}
/** A model can be proposed and quoted only with an approved Neuron SKU and for plain generation. Operation models (lip sync, replace, motion transfer) are suggestions only. */
const proposable=(m:MediaModel):m is PricedMediaModel=>isPriced(m)&&m.operations.includes("generate");
const FA_NOT_ACTIVE="این مدل هنوز در هووش فعال نشده است.";
/** `kind`: the kind the orchestrator decided (it wins over the prompt's words, which a follow-up may not repeat). */
export function recommendMediaModels(prompt:string, preference:AgentPreference="quality", requirements?:MediaRequirements, kind:MediaKind=detectMediaKind(prompt)){
 // While real generation is on, only models that can run now (lib/model-availability.ts): a card never offers one that would fail or fall back to a demo.
 const candidates=offerable(MEDIA_CATALOG.filter(proposable).filter(x=>x.kind===kind&&!(requirements&&modelIneligibility(x,requirements))));
 const named=explicitMediaModel(prompt,kind);
 const reasonFa=named&&!proposable(named)?FA_NOT_ACTIVE:named&&requirements?modelIneligibility(named,requirements):undefined;
 const explicitRejected=named&&reasonFa?{id:named.id,reasonFa}:undefined;
 const explicit=explicitRejected?undefined:named;
 const ranked=[...candidates].sort((a,b)=> {
  if(explicit){if(a.id===explicit.id) return -1;if(b.id===explicit.id) return 1;}
  if(preference==="cost") return a.neurons-b.neurons;
  if(preference==="speed") return Number(b.tags.includes("speed"))-Number(a.tags.includes("speed"));
  return Number(b.tags.includes("quality"))-Number(a.tags.includes("quality"));
 });
 // A rejected explicit model is never selected; offer 1-3 compatible alternatives instead.
 return {kind,explicit:explicit?.id,explicitRejected,ranked,alternatives:explicitRejected?ranked.slice(0,3):[]};
}
// Mirrors the fail-closed media review in lib/orchestrator.ts: no inspector for image, video or audio exists yet (docs/MODERATION_POLICY.md step 4).
const MEDIA_REVIEW_ACTIVE=false;
// Mirrors the needs_hosted_media blocker in lib/policy.ts: user media is browser-local, so a provider cannot fetch it yet.
const HOSTED_MEDIA_ACTIVE=false;
export const FA_BLOCKER_API="مسیر API تأیید نشده";
export const FA_BLOCKER_PRICE="قیمت نورون هنوز تأیید نشده";
export const FA_BLOCKER_REVIEW="بررسی ایمنی رسانه هنوز فعال نیست";
export const FA_BLOCKER_HOSTING="بارگذاری رسانه روی سرور هنوز فعال نیست";
/**
 * Pure. The catalogue model that best fits a specialised need (lip sync, replace, motion transfer), even when it is unverified or price-pending, with the Persian
 * reasons it cannot be offered yet. Never a proposal: `active` is true only when nothing blocks it. Undefined for plain generation and when no model fits.
 */
export function bestModelFor(r:MediaRequirements,kind:MediaKind):{model:MediaModel;active:boolean;blockersFa:string[]}|undefined {
 const operation=r.operation??(r.lipSync?"lip_sync":undefined);
 if(!operation) return undefined;
 const blockers=(m:MediaModel)=>[...(m.capabilities.verified?[]:[FA_BLOCKER_API]),...(hasApprovedPrice(m)?[]:[FA_BLOCKER_PRICE]),...(MEDIA_REVIEW_ACTIVE?[]:[FA_BLOCKER_REVIEW]),...(HOSTED_MEDIA_ACTIVE||!needsHostedMedia(m)?[]:[FA_BLOCKER_HOSTING])];
 const fits=MEDIA_CATALOG.filter(m=>m.kind===kind&&!modelIneligibility(m,{...r,operation},{assumeUnknownMax:true}));
 const ranked=fits.map(model=>({model,blockersFa:blockers(model)})).sort((a,b)=>a.blockersFa.length-b.blockersFa.length);
 const best=ranked[0];
 return best&&{model:best.model,active:best.blockersFa.length===0,blockersFa:best.blockersFa};
}
/** The public projection of `bestModelFor`: the raw model name and the reasons, never a price or an id. */
export function suggestModel(r:MediaRequirements,kind:MediaKind):SuggestedModel|undefined {
 const b=bestModelFor(r,kind);
 return b&&{name:b.model.name,active:b.active,blockersFa:b.blockersFa};
}
/** Wording that marks a multi-shot or identity-critical brief (also a routing signal, lib/llm-routing.ts). */
export const COMPLEX_BRIEF=/storyboard|multiple scenes|multi-shot|identity lock|preserve motion|سناریو|استوری‌بورد|چند سکانس|حفظ چهره/i;
export function reasoningTier(prompt:string,hasReferences:boolean):ReasoningTier{
 const complex=COMPLEX_BRIEF.test(prompt);
 if(complex||prompt.length>1000) return "deep";
 if(hasReferences||prompt.length>180) return "balanced";
 return "fast";
}
// Never serialize reasoningTier or underlying provider/model identifiers to consumer responses.
