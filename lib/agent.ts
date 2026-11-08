import { recommendMediaModels } from "./router";
import { assertSafeText } from "./safety";
import { generationModeFor } from "./policy";
import type { AgentPreference, GenerationProposal, MediaKind, MediaRequirements } from "./types";
/** A model's family: its name before « · » («Seedance 2.5 · 5s» is «Seedance 2.5»). */
export const familyOf=(name:string)=>name.split(" · ")[0].trim();
/** The ranked models of the first `n` families, in rank order, each family with all its eligible versions. */
function withFamilies<T extends {name:string}>(ranked:readonly T[],n:number):T[]{
 const fams:string[]=[];for(const m of ranked){const f=familyOf(m.name);if(!fams.includes(f))fams.push(f);if(fams.length===n)break;}
 return ranked.filter(m=>fams.includes(familyOf(m.name)));
}
/** Shared proposal builder: callers MUST have passed safety first (createDemoProposal and the orchestrator both do). */
export class NoCompatibleModelError extends Error{constructor(){super("No media model satisfies the requirements");this.name="NoCompatibleModelError";}}
/** `requirements` are hard filters (reference images, aspect ratio, duration, lip sync). lib/orchestrator.ts derives them from the character reference and lip-sync skill. */
export function buildProposal(trimmed:string,preference:AgentPreference="quality",requirements?:MediaRequirements,mediaKind?:MediaKind):GenerationProposal{
 const {kind,ranked,explicit,explicitRejected}=recommendMediaModels(trimmed,preference,requirements,mediaKind);
 if(!ranked.length) throw new NoCompatibleModelError();
 const selected=ranked[0];
 return {
  operation:kind==="image"?"generate_image":"generate_video",
  intentSummary:trimmed,
  // Up to three model families, each with all its eligible versions (resolutions, durations), so the card can offer them as settings.
  suggestions:withFamilies(ranked,3).map((m,i)=>({modelId:m.id,name:m.name,neurons:m.neurons,resolution:m.resolution,...(m.durationSeconds?{durationSeconds:m.durationSeconds}:{}),aspectRatios:[...m.capabilities.aspectRatios],...(m.kind==="video"&&m.capabilities.audio?{audio:true}:{}),reason:explicit===m.id?"انتخاب شما":explicitRejected?"جایگزین سازگار":i===0?"پیشنهاد هووش":"گزینه جایگزین"})),
  recommendedModelId:ranked[0].id,selectedModelId:selected.id,fixedNeurons:selected.neurons,
  explicitRejected:explicitRejected?{modelId:explicitRejected.id,reasonFa:explicitRejected.reasonFa}:undefined,
  requiresApproval:true,quoteMode:generationModeFor(selected),
  message:explicitRejected?"مدل درخواستی شما با این تنظیمات سازگار نیست: "+explicitRejected.reasonFa+" گزینه‌های سازگار پیشنهاد شده‌اند.":"مدل پیشنهادی و هزینه نورون آماده است. قبل از تولید، جزئیات را بررسی کنید."
 };
}
export function createDemoProposal(text:string,preference:AgentPreference="quality"):GenerationProposal{
 const trimmed=text.trim();
 if(!trimmed||trimmed.length>4000) throw new Error("Prompt must be between 1 and 4000 characters.");
 assertSafeText(trimmed);
 return buildProposal(trimmed,preference);
}
export function selectProposalModel(proposal:GenerationProposal,modelId:string):GenerationProposal{
 const selected=proposal.suggestions.find(x=>x.modelId===modelId);
 if(!selected) throw new Error("Selected model is not in eligible recommendations.");
 return {...proposal,selectedModelId:selected.modelId,fixedNeurons:selected.neurons};
}
