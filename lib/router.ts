import { MEDIA_CATALOG } from "./catalog";
import type { AgentPreference, MediaKind, MediaModel, MediaRequirements, ReasoningTier } from "./types";
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
export function modelIneligibility(m:MediaModel,r:MediaRequirements={}):string|undefined {
 const c=m.capabilities;
 if(r.referenceImages&&(!c.referenceImages.supported||r.referenceImages>c.referenceImages.max)) return "این مدل از تصویر مرجع به این تعداد پشتیبانی نمی‌کند.";
 if(r.aspectRatio&&!c.aspectRatios.includes(r.aspectRatio)) return "این مدل نسبت تصویر درخواستی را پشتیبانی نمی‌کند.";
 if(r.durationSeconds!==undefined&&!(c.durationsSeconds??[]).includes(r.durationSeconds)) return "این مدل مدت‌زمان درخواستی را پشتیبانی نمی‌کند.";
 if(r.lipSync&&!c.lipSync) return "این مدل همگام‌سازی لب را پشتیبانی نمی‌کند.";
 return undefined;
}
export function recommendMediaModels(prompt:string, preference:AgentPreference="quality", requirements?:MediaRequirements){
 const kind=detectMediaKind(prompt);
 const candidates=MEDIA_CATALOG.filter(x=>x.kind===kind&&!(requirements&&modelIneligibility(x,requirements)));
 const named=explicitMediaModel(prompt,kind);
 const reasonFa=named&&requirements?modelIneligibility(named,requirements):undefined;
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
export function reasoningTier(prompt:string,hasReferences:boolean):ReasoningTier{
 const complex=/storyboard|multiple scenes|multi-shot|identity lock|preserve motion|سناریو|استوری‌بورد|چند سکانس|حفظ چهره/i.test(prompt);
 if(complex||prompt.length>1000) return "deep";
 if(hasReferences||prompt.length>180) return "balanced";
 return "fast";
}
// Never serialize reasoningTier or underlying provider/model identifiers to consumer responses.
