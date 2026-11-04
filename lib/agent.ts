import { recommendMediaModels } from "./router";
import { assertSafeText } from "./safety";
import type { AgentPreference, GenerationProposal } from "./types";
export function createDemoProposal(text:string,preference:AgentPreference="quality"):GenerationProposal{
 const trimmed=text.trim();
 if(!trimmed||trimmed.length>4000) throw new Error("Prompt must be between 1 and 4000 characters.");
 assertSafeText(trimmed);
 const {kind,ranked,explicit}=recommendMediaModels(trimmed,preference);
 const selected=ranked[0];
 return {
  operation:kind==="image"?"generate_image":"generate_video",
  intentSummary:trimmed,
  suggestions:ranked.slice(0,3).map((m,i)=>({modelId:m.id,name:m.name,neurons:m.neurons,reason:explicit===m.id?"انتخاب شما":i===0?"پیشنهاد هووش":"گزینه جایگزین"})),
  recommendedModelId:ranked[0].id,selectedModelId:selected.id,fixedNeurons:selected.neurons,
  requiresApproval:true,quoteMode:"demo",
  message:"مدل پیشنهادی و هزینه نورون آماده است. قبل از تولید، جزئیات را بررسی کنید."
 };
}
export function selectProposalModel(proposal:GenerationProposal,modelId:string):GenerationProposal{
 const selected=proposal.suggestions.find(x=>x.modelId===modelId);
 if(!selected) throw new Error("Selected model is not in eligible recommendations.");
 return {...proposal,selectedModelId:selected.modelId,fixedNeurons:selected.neurons};
}
