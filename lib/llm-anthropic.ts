import "server-only";
import {devLiveTest} from "./policy";
import Anthropic from "@anthropic-ai/sdk";
import {zodOutputFormat} from "@anthropic-ai/sdk/helpers/zod";
import {ANTHROPIC_EXTRAS_NOTE,CreativePlanAnthropicSchema,CreativePlanSchema,fromAnthropicPlan,PlannerInvalidOutputError,PlannerRefusedError,PlannerUnavailableError,type CreativePlan} from "./creative-plan";
export {buildBriefMessage,stripBriefTags,type BriefAttachment,type BriefGeneration,type BriefTurn} from "./planner-brief";
import {buildBriefMessage,type BriefAttachment,type BriefGeneration,type BriefTurn} from "./planner-brief";
import {loadRoutingConfig,retryAfterMsFrom} from "./llm-routing";
/** Vendor-neutral mapping: 429 and 529 (overloaded) are rate limits with the provider's Retry-After; anything else is plain unavailable. */
export function anthropicUnavailable(e:InstanceType<typeof Anthropic.APIError>):PlannerUnavailableError{
 if(e.status===429||e.status===529)return new PlannerUnavailableError(undefined,{limit:"rate",retryAfterMs:retryAfterMsFrom(e.headers)});
 return new PlannerUnavailableError();
}
/** Live private planner. Errors are mapped to vendor-neutral types; usage is for the private audit only. */
export async function planWithAnthropic(req:{systemInstructions:string;userText:string;attachments?:readonly BriefAttachment[];generations?:readonly BriefGeneration[];history?:readonly BriefTurn[];replyScript?:"fa"|"finglish"},modelId:string):Promise<{plan:CreativePlan;usage:Anthropic.Usage;modelId:string}>{
 const rl=loadRoutingConfig().rateLimits;
 const client=new Anthropic({apiKey:process.env.ANTHROPIC_API_KEY,maxRetries:rl.sdkMaxRetries,timeout:rl.requestTimeoutMs});
 let response;
 try{
  response=await client.messages.parse({
   model:modelId,max_tokens:16000,
   messages:[{role:"user",content:buildBriefMessage(req.userText,req.attachments,req.generations,req.history,req.replyScript)}],
   // The full plan schema is too large for Anthropic's grammar compiler: reply and staging travel as JSON in `extras` (see CreativePlanAnthropicSchema).
   system:[{type:"text",text:req.systemInstructions+"\n\n"+ANTHROPIC_EXTRAS_NOTE,cache_control:{type:"ephemeral"}}],
   output_config:{format:zodOutputFormat(CreativePlanAnthropicSchema)}
  });
 }catch(e){
  if(e instanceof Anthropic.APIError)throw anthropicUnavailable(e); // rate limit, overloaded, connection, timeout, auth, 5xx (RateLimitError and APIConnectionError are subclasses)
  if(e instanceof Anthropic.AnthropicError&&/^Failed to parse structured output/.test(e.message))throw new PlannerInvalidOutputError();
  throw e;
 }
 if(response.stop_reason==="refusal")throw new PlannerRefusedError();
 if(!response.parsed_output)throw new PlannerInvalidOutputError();
 if(devLiveTest().enabled)console.info("[whoush dev-live] planner",modelId,"in",response.usage.input_tokens,"out",response.usage.output_tokens); // never the prompt
 const v=CreativePlanSchema.safeParse(fromAnthropicPlan(response.parsed_output));
 if(!v.success)throw new PlannerInvalidOutputError();
 return {plan:v.data,usage:response.usage,modelId};
}
