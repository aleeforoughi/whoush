import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import {zodOutputFormat} from "@anthropic-ai/sdk/helpers/zod";
import {CreativePlanSchema,PlannerInvalidOutputError,PlannerRefusedError,PlannerUnavailableError,type CreativePlan} from "./creative-plan";
/** Live private planner. Errors are mapped to vendor-neutral types; usage is for the private audit only. */
export async function planWithAnthropic(req:{systemInstructions:string;userText:string},modelId:string):Promise<{plan:CreativePlan;usage:Anthropic.Usage;modelId:string}>{
 const client=new Anthropic({apiKey:process.env.ANTHROPIC_API_KEY});
 let response;
 try{
  response=await client.messages.parse({
   model:modelId,max_tokens:16000,
   system:[{type:"text",text:req.systemInstructions,cache_control:{type:"ephemeral"}}],
   messages:[{role:"user",content:"<user_brief>\n"+req.userText.replace(/<\/?user_brief>/gi,"")+"\n</user_brief>"}],
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
