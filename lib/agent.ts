import { recommendMediaModels } from "./router";
import { assertSafeText } from "./safety";
import type { AgentPreference, GenerationProposal, MediaRequirements } from "./types";
/** Shared proposal builder: callers MUST have passed safety first (createDemoProposal and the orchestrator both do). */
export class NoCompatibleModelError extends Error{constructor(){super("No media model satisfies the requirements");this.name="NoCompatibleModelError";}}
/** `requirements` are hard filters (reference images, aspect ratio, duration, lip sync). lib/orchestrator.ts derives them from the character reference and lip-sync skill. */
export function buildProposal(trimmed:string,preference:AgentPreference="quality",requirements?:MediaRequirements):GenerationProposal{
 const {kind,ranked,explicit,explicitRejected}=recommendMediaModels(trimmed,preference,requirements);
 if(!ranked.length) throw new NoCompatibleModelError();
 const selected=ranked[0];
 return {
  operation:kind==="image"?"generate_image":"generate_video",
  intentSummary:trimmed,
  suggestions:ranked.slice(0,3).map((m,i)=>({modelId:m.id,name:m.name,neurons:m.neurons,reason:explicit===m.id?"انتخاب شما":explicitRejected?"جایگزین سازگار":i===0?"پیشنهاد هووش":"گزینه جایگزین"})),
  recommendedModelId:ranked[0].id,selectedModelId:selected.id,fixedNeurons:selected.neurons,
  explicitRejected:explicitRejected?{modelId:explicitRejected.id,reasonFa:explicitRejected.reasonFa}:undefined,
  requiresApproval:true,quoteMode:"demo",
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
