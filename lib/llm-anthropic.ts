import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import {zodOutputFormat} from "@anthropic-ai/sdk/helpers/zod";
import {CreativePlanSchema,PlannerInvalidOutputError,PlannerRefusedError,PlannerUnavailableError,type CreativePlan} from "./creative-plan";
/** Removes brief and attachment tags so user or document text cannot close or forge the data blocks it sits in. */
export function stripBriefTags(text:string):string{
 let s=text,prev;
 do{prev=s;s=s.replace(/<\/?\s*(?:attachment|user_brief)\b[^>]*>?/gi,"");}while(s!==prev);
 return s;
}
/** The single user message: the brief, then each text attachment as data inside it. */
export function buildBriefMessage(userText:string,attachments:readonly {kind:string;textExcerpt?:string}[]=[]):string{
 const docs=attachments.filter(a=>a.textExcerpt).map(a=>"\n<attachment kind=\""+(a.kind==="json"?"json":"md")+"\">\n"+stripBriefTags(a.textExcerpt as string)+"\n</attachment>").join("");
 return "<user_brief>\n"+stripBriefTags(userText)+docs+"\n</user_brief>";
}
/** Live private planner. Errors are mapped to vendor-neutral types; usage is for the private audit only. */
export async function planWithAnthropic(req:{systemInstructions:string;userText:string;attachments?:readonly {kind:string;textExcerpt?:string}[]},modelId:string):Promise<{plan:CreativePlan;usage:Anthropic.Usage;modelId:string}>{
 const client=new Anthropic({apiKey:process.env.ANTHROPIC_API_KEY});
 let response;
 try{
  response=await client.messages.parse({
   model:modelId,max_tokens:16000,
   system:[{type:"text",text:req.systemInstructions,cache_control:{type:"ephemeral"}}],
   messages:[{role:"user",content:buildBriefMessage(req.userText,req.attachments)}],
   output_config:{format:zodOutputFormat(CreativePlanSchema)}
  });
 }catch(e){
  if(e instanceof Anthropic.RateLimitError||e instanceof Anthropic.APIConnectionError||e instanceof Anthropic.APIError)throw new PlannerUnavailableError();
  if(e instanceof Anthropic.AnthropicError&&/^Failed to parse structured output/.test(e.message))throw new PlannerInvalidOutputError();
  throw e;
 }
 if(response.stop_reason==="refusal")throw new PlannerRefusedError();
 if(!response.parsed_output)throw new PlannerInvalidOutputError();
 return {plan:response.parsed_output,usage:response.usage,modelId};
}
