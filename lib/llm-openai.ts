import "server-only";
import {devLiveTest} from "./policy";
import OpenAI from "openai";
import {ZodError} from "zod";
import {zodTextFormat} from "openai/helpers/zod";
import {CreativePlanSchema,CreativePlanWireSchema,fromWirePlan,PlannerInvalidOutputError,PlannerRefusedError,PlannerUnavailableError,type CreativePlan} from "./creative-plan";
import {buildBriefMessage,type BriefAttachment} from "./planner-brief";
import {loadRoutingConfig,retryAfterMsFrom} from "./llm-routing";
/** Vendor-neutral mapping of an SDK API error. 429 with `insufficient_quota` is a quota limit (retrying soon does not help); any other 429 is a rate limit with the provider's Retry-After. */
export function openAIUnavailable(e:InstanceType<typeof OpenAI.APIError>):PlannerUnavailableError{
 if(e.status===429){
  const quota=e.code==="insufficient_quota"||(e.error as {code?:string}|undefined)?.code==="insufficient_quota";
  if(quota)return new PlannerUnavailableError(undefined,{limit:"quota"});
  return new PlannerUnavailableError(undefined,{limit:"rate",retryAfterMs:retryAfterMsFrom(e.headers)});
 }
 return new PlannerUnavailableError();
}
/** Live private planner (OpenAI Responses API, Structured Outputs). Errors map to vendor-neutral types; usage is normalized for the private audit only. */
export async function planWithOpenAI(req:{systemInstructions:string;userText:string;attachments?:readonly BriefAttachment[]},modelId:string):Promise<{plan:CreativePlan;usage:{input_tokens:number;output_tokens:number};modelId:string}>{
 const rl=loadRoutingConfig().rateLimits;
 // The SDK retries 408/409/429/5xx and connection errors itself (exponential backoff, honouring Retry-After up to 60 s) before we see the error.
 const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY,maxRetries:rl.sdkMaxRetries,timeout:rl.requestTimeoutMs});
 let response;
 try{
  response=await client.responses.parse({
   model:modelId,max_output_tokens:16000,
   instructions:req.systemInstructions,
   input:buildBriefMessage(req.userText,req.attachments),
   text:{format:zodTextFormat(CreativePlanWireSchema,"creative_plan")}
  });
 }catch(e){
  if(e instanceof OpenAI.APIError)throw openAIUnavailable(e); // rate limit, quota, connection, timeout, auth, 5xx
  if(e instanceof OpenAI.OpenAIError||e instanceof SyntaxError||e instanceof ZodError)throw new PlannerInvalidOutputError(); // unparseable structured output
  throw e;
 }
 if(response.output.some(o=>o.type==="message"&&o.content.some(c=>c.type==="refusal")))throw new PlannerRefusedError();
 if(response.status==="incomplete"||response.status==="failed"||!response.output_parsed)throw new PlannerInvalidOutputError();
 const v=CreativePlanSchema.safeParse(fromWirePlan(response.output_parsed));
 if(!v.success)throw new PlannerInvalidOutputError();
 const usage={input_tokens:response.usage?.input_tokens??0,output_tokens:response.usage?.output_tokens??0};
 if(devLiveTest().enabled)console.info("[whoush dev-live] planner",modelId,"in",usage.input_tokens,"out",usage.output_tokens); // never the prompt
 return {plan:v.data,usage,modelId};
}
