import { MEDIA_CATALOG } from "./catalog";
import type { AgentPreference, MediaKind, MediaModel, ReasoningTier } from "./types";
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
export function recommendMediaModels(prompt:string, preference:AgentPreference="quality"){
 const kind=detectMediaKind(prompt);
 const candidates=MEDIA_CATALOG.filter(x=>x.kind===kind);
 const explicit=explicitMediaModel(prompt,kind);
 const ranked=[...candidates].sort((a,b)=> {
  if(explicit){if(a.id===explicit.id) return -1;if(b.id===explicit.id) return 1;}
  if(preference==="cost") return a.neurons-b.neurons;
  if(preference==="speed") return Number(b.tags.includes("speed"))-Number(a.tags.includes("speed"));
  return Number(b.tags.includes("quality"))-Number(a.tags.includes("quality"));
 });
 return {kind,explicit:explicit?.id,ranked};
}
export function reasoningTier(prompt:string,hasReferences:boolean):ReasoningTier{
 const complex=/storyboard|multiple scenes|multi-shot|identity lock|preserve motion|سناریو|استوری‌بورد|چند سکانس|حفظ چهره/i.test(prompt);
 if(complex||prompt.length>1000) return "deep";
 if(hasReferences||prompt.length>180) return "balanced";
 return "fast";
}
// Never serialize reasoningTier or underlying provider/model identifiers to consumer responses.
