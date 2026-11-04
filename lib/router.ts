import { MEDIA_CATALOG } from "./catalog";
import { isPriced, type AgentPreference, type MediaKind, type MediaModel, type MediaRequirements, type PricedMediaModel, type ReasoningTier, type SuggestedModel } from "./types";
const videoWords=["video","animate","animation","motion","clip","ویدیو","فیلم","متحرک","انیمیشن","حرکت"];
const imageWords=["image","photo","picture","portrait","عکس","تصویر","پوستر"];
const norm=(s:string)=>s.toLocaleLowerCase("en-US").trim();
export function detectMediaKind(prompt:string):MediaKind {
 const p=norm(prompt);
 if(videoWords.some(x=>p.includes(x))) return "video";
 if(imageWords.some(x=>p.includes(x))) return "image";
 for(const m of MEDIA_CATALOG){if(m.aliases.some(a=>p.includes(norm(a)))) return m.kind;}
 return "image";
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
 if(r.referenceImages&&(!c.referenceImages.supported||(max===null?!opts.assumeUnknownMax:r.referenceImages>max))) return "این مدل از تصویر مرجع به این تعداد پشتیبانی نمی‌کند.";
 if(r.aspectRatio&&!c.aspectRatios.includes(r.aspectRatio)) return "این مدل نسبت تصویر درخواستی را پشتیبانی نمی‌کند.";
 if(r.durationSeconds!==undefined&&!(c.durationsSeconds??[]).includes(r.durationSeconds)) return "این مدل مدت‌زمان درخواستی را پشتیبانی نمی‌کند.";
 if(r.lipSync&&!c.lipSync) return "این مدل همگام‌سازی لب را پشتیبانی نمی‌کند.";
 if(r.motionReference&&!c.motionReference) return "این مدل الگوی حرکت از ویدیوی مرجع را پشتیبانی نمی‌کند.";
 if(r.videoReference&&!c.videoReference) return "این مدل ادیت روی ویدیوی مرجع را پشتیبانی نمی‌کند.";
 return undefined;
}
/** A model can be proposed and quoted only with an approved Neuron SKU and for plain generation. Operation models (lip sync, replace, motion transfer) are suggestions only. */
const proposable=(m:MediaModel):m is PricedMediaModel=>isPriced(m)&&m.operations.includes("generate");
const FA_NOT_ACTIVE="این مدل هنوز در هووش فعال نشده است.";
export function recommendMediaModels(prompt:string, preference:AgentPreference="quality", requirements?:MediaRequirements){
 const kind=detectMediaKind(prompt);
 const candidates=MEDIA_CATALOG.filter(proposable).filter(x=>x.kind===kind&&!(requirements&&modelIneligibility(x,requirements)));
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
export const FA_BLOCKER_API="مسیر API تأیید نشده";
export const FA_BLOCKER_PRICE="قیمت نورون هنوز تأیید نشده";
export const FA_BLOCKER_REVIEW="بررسی ایمنی رسانه هنوز فعال نیست";
/**
 * Pure. The catalogue model that best fits a specialised need (lip sync, replace, motion transfer), even when it is unverified or price-pending, with the Persian
 * reasons it cannot be offered yet. Never a proposal: `active` is true only when nothing blocks it. Undefined for plain generation and when no model fits.
 */
export function bestModelFor(r:MediaRequirements,kind:MediaKind):{model:MediaModel;active:boolean;blockersFa:string[]}|undefined {
 const operation=r.operation??(r.lipSync?"lip_sync":undefined);
 if(!operation) return undefined;
 const blockers=(m:MediaModel)=>[...(m.capabilities.verified?[]:[FA_BLOCKER_API]),...(isPriced(m)?[]:[FA_BLOCKER_PRICE]),...(MEDIA_REVIEW_ACTIVE?[]:[FA_BLOCKER_REVIEW])];
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
export function reasoningTier(prompt:string,hasReferences:boolean):ReasoningTier{
 const complex=/storyboard|multiple scenes|multi-shot|identity lock|preserve motion|سناریو|استوری‌بورد|چند سکانس|حفظ چهره/i.test(prompt);
 if(complex||prompt.length>1000) return "deep";
 if(hasReferences||prompt.length>180) return "balanced";
 return "fast";
}
// Never serialize reasoningTier or underlying provider/model identifiers to consumer responses.
