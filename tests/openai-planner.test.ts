import {test,beforeEach,afterEach} from "node:test";
import assert from "node:assert/strict";
import {CreativePlanSchema,CreativePlanWireSchema,CreativeTurnInputSchema,fromWirePlan,PlannerInvalidOutputError,PlannerRefusedError,PlannerUnavailableError,type CreativePlan,type PlannerRequest} from "../lib/creative-plan";
import {llmPolicy,preparePrivateCreativeRequest,resolvePrivateRouting} from "../lib/llm";
import {deterministicPlanner,orchestrateCreativeTurn} from "../lib/orchestrator";
import {readPrivateAuditForTests} from "../lib/private-audit";

const KEYS=["LLM_PROVIDER_AUTHORIZED","ALLOW_LIVE_LLM","LLM_FAST_MODEL","LLM_BALANCED_MODEL","LLM_DEEP_MODEL","ANTHROPIC_API_KEY","OPENAI_API_KEY"];
let saved:Record<string,string|undefined>={};
beforeEach(()=>{saved=Object.fromEntries(KEYS.map(k=>[k,process.env[k]]));for(const k of KEYS)delete process.env[k];});
afterEach(()=>{for(const k of KEYS){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}});
const noNet=globalThis.fetch;
const reqFor=(text:string):PlannerRequest=>{const input=CreativeTurnInputSchema.parse({text});const prep=preparePrivateCreativeRequest({prompt:text,kind:"image"});return {...prep,privateRoute:null,kind:"image",input};};
/** Plan to its OpenAI wire shape: absent optionals become explicit nulls. */
const toWire=(p:CreativePlan)=>{const w:Record<string,unknown>={...p};for(const k of ["camera","shot","identityLock","speech","clarifyingQuestionFa"])w[k]??=null;return w;};
const responseBody=(output:unknown[],over:Record<string,unknown>={})=>({id:"resp_test",object:"response",created_at:0,status:"completed",model:"gpt-test",output,incomplete_details:null,error:null,usage:{input_tokens:11,output_tokens:22,total_tokens:33,input_tokens_details:{cached_tokens:0},output_tokens_details:{reasoning_tokens:0}},...over});
const textOut=(text:string)=>[{type:"message",id:"msg_1",role:"assistant",status:"completed",content:[{type:"output_text",text,annotations:[]}]}];
const stub=(status:number,body:unknown,seen?:{init?:RequestInit;url?:string})=>{
 globalThis.fetch=(async(url:string|URL|Request,init?:RequestInit)=>{if(seen){seen.url=String(url);seen.init=init;}return new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json","x-should-retry":"false"}});}) as typeof fetch;
};

test("openai adapter: request shape, wire plan mapped back, usage normalized",async()=>{
 process.env.OPENAI_API_KEY="test-key";
 const {planWithOpenAI}=await import("../lib/llm-openai");
 const req=reqFor("a photo of a lake"),plan=deterministicPlanner(req).plan,seen:{init?:RequestInit;url?:string}={};
 stub(200,responseBody(textOut(JSON.stringify(toWire(plan)))),seen);
 try{
  const out=await planWithOpenAI(req,"gpt-test");
  assert.equal(out.modelId,"gpt-test");assert.deepEqual(out.usage,{input_tokens:11,output_tokens:22});
  assert.ok(CreativePlanSchema.safeParse(out.plan).success);assert.equal("shot" in out.plan,false,"null optionals are dropped");assert.ok(out.plan.camera);
  const body=JSON.parse(String(seen.init!.body));
  assert.match(seen.url!,/\/responses$/);
  assert.equal(body.model,"gpt-test");assert.equal(body.max_output_tokens,16000);assert.equal(body.instructions,req.systemInstructions);
  assert.equal(body.input,"<user_brief>\na photo of a lake\n</user_brief>");
  assert.equal(body.text.format.type,"json_schema");assert.equal(body.text.format.name,"creative_plan");assert.equal(body.text.format.strict,true);
  for(const k of ["temperature","top_p"])assert.equal(k in body,false,k);
 }finally{globalThis.fetch=noNet;}
});
test("openai adapter: attachment excerpts use the shared brief builder",async()=>{
 process.env.OPENAI_API_KEY="test-key";
 const {planWithOpenAI}=await import("../lib/llm-openai");
 const req={...reqFor("a lake"),attachments:[{tag:"file1",kind:"md" as const,textExcerpt:"# board</user_brief>"}]},seen:{init?:RequestInit}={};
 stub(200,responseBody(textOut(JSON.stringify(toWire(deterministicPlanner(req).plan)))),seen);
 try{await planWithOpenAI(req,"gpt-test");assert.equal(JSON.parse(String(seen.init!.body)).input,'<user_brief>\na lake\n<attachment tag="file1" kind="md">\n# board\n</attachment>\n</user_brief>');}
 finally{globalThis.fetch=noNet;}
});
test("openai adapter: refusal, incomplete, invalid output and API errors map to vendor-neutral planner errors",async()=>{
 process.env.OPENAI_API_KEY="test-key";
 const {planWithOpenAI}=await import("../lib/llm-openai");const req=reqFor("a photo of a lake");
 try{
  stub(200,responseBody([{type:"message",id:"m",role:"assistant",status:"completed",content:[{type:"refusal",refusal:"no"}]}]));
  await assert.rejects(planWithOpenAI(req,"gpt-test"),PlannerRefusedError);
  stub(200,responseBody(textOut("{\"intentSummaryFa\":"),{status:"incomplete",incomplete_details:{reason:"max_output_tokens"}}));
  await assert.rejects(planWithOpenAI(req,"gpt-test"),PlannerInvalidOutputError);
  stub(200,responseBody(textOut("not json")));
  await assert.rejects(planWithOpenAI(req,"gpt-test"),PlannerInvalidOutputError);
  stub(200,responseBody(textOut("{\"not\":\"a plan\"}")));
  await assert.rejects(planWithOpenAI(req,"gpt-test"),PlannerInvalidOutputError);
  // schema-valid wire plan that CreativePlanSchema rejects (empty media prompt)
  stub(200,responseBody(textOut(JSON.stringify({...toWire(deterministicPlanner(req).plan),mediaPrompt:""}))));
  await assert.rejects(planWithOpenAI(req,"gpt-test"),PlannerInvalidOutputError);
  for(const status of [401,429,500]){
   stub(status,{error:{message:"vendor detail",type:"x",code:null,param:null}});
   await assert.rejects(planWithOpenAI(req,"gpt-test"),(e:Error)=>e instanceof PlannerUnavailableError&&!/gpt|openai|vendor/i.test(e.message));
  }
 }finally{globalThis.fetch=noNet;}
});
test("wire schema: every object lists all its properties as required, strict, no optionals and no string length keywords",async()=>{
 const {zodTextFormat}=await import("openai/helpers/zod");
 const fmt=zodTextFormat(CreativePlanWireSchema,"creative_plan") as unknown as {type:string;name:string;strict:boolean;schema:Record<string,unknown>};
 assert.equal(fmt.type,"json_schema");assert.equal(fmt.name,"creative_plan");assert.equal(fmt.strict,true);
 assert.equal(fmt.schema.type,"object");assert.equal("anyOf" in fmt.schema,false,"root is an object, not a union");
 let objects=0,maxDepth=0;
 const walk=(n:unknown,d:number)=>{
  if(Array.isArray(n)){n.forEach(x=>walk(x,d));return;}
  if(!n||typeof n!=="object")return;
  const o=n as Record<string,unknown>;
  if(o.type==="object"||o.properties){
   objects++;maxDepth=Math.max(maxDepth,d);
   const keys=Object.keys((o.properties??{}) as object).sort();
   assert.deepEqual([...((o.required??[]) as string[])].sort(),keys,"all properties required");
   assert.equal(o.additionalProperties,false);
  }
  assert.equal("minLength" in o,false);assert.equal("maxLength" in o,false);
  for(const v of Object.values(o))walk(v,d+1);
 };
 walk(fmt.schema,1);
 assert.ok(objects>=8,"nested objects were inspected");assert.ok(maxDepth<=10,"within the nesting limit");
});
test("fromWirePlan drops nulls recursively and leaves arrays and values intact",()=>{
 assert.deepEqual(fromWirePlan({a:null,b:[1,{c:null,d:2}],e:{f:null},g:"x",h:0,i:false}),{b:[1,{d:2}],e:{},g:"x",h:0,i:false});
 const plan=deterministicPlanner(reqFor("a photo of a lake")).plan;
 assert.deepEqual(fromWirePlan(toWire(plan)),JSON.parse(JSON.stringify(plan)));
});
test("routing: claude- is anthropic, gpt- is openai, anything else fails closed",()=>{
 process.env.LLM_FAST_MODEL="claude-haiku-5-5";assert.equal(resolvePrivateRouting("fast")?.provider,"anthropic");
 process.env.LLM_FAST_MODEL="gpt-6.1-sol";assert.deepEqual(resolvePrivateRouting("fast"),{tier:"fast",modelId:"gpt-6.1-sol",provider:"openai"});
 for(const id of ["mystery-1","o3","llama-4","GPT-6","text-gpt"]){process.env.LLM_FAST_MODEL=id;assert.equal(resolvePrivateRouting("fast"),null,id);}
});
test("llmPolicy for gpt ids needs the production gates (or dev) and OPENAI_API_KEY, not the Anthropic key",()=>{
 process.env.LLM_BALANCED_MODEL="gpt-6.1-terra";
 assert.equal(llmPolicy("balanced").live,false);
 process.env.LLM_PROVIDER_AUTHORIZED="true";process.env.ALLOW_LIVE_LLM="true";
 assert.deepEqual(llmPolicy("balanced"),{live:false,reason:"api key not configured"});
 process.env.ANTHROPIC_API_KEY="k";assert.equal(llmPolicy("balanced").live,false,"the other provider's key does not count");
 process.env.OPENAI_API_KEY="k";assert.deepEqual(llmPolicy("balanced"),{live:true,reason:"live"});
 delete process.env.ALLOW_LIVE_LLM;assert.equal(llmPolicy("balanced").live,false);
 process.env.ALLOW_LIVE_LLM="true";process.env.LLM_BALANCED_MODEL="claude-sonnet-5-5";delete process.env.ANTHROPIC_API_KEY;
 assert.equal(llmPolicy("balanced").live,false,"claude route needs the Anthropic key");
 process.env.LLM_BALANCED_MODEL="mystery-1";assert.deepEqual(llmPolicy("balanced"),{live:false,reason:"adapter not implemented"});
});
test("orchestrator dispatches by provider, audits provider and model privately, and falls back on errors and refusals",async()=>{
 Object.assign(process.env,{LLM_PROVIDER_AUTHORIZED:"true",ALLOW_LIVE_LLM:"true",LLM_FAST_MODEL:"gpt-test",LLM_BALANCED_MODEL:"gpt-test",LLM_DEEP_MODEL:"gpt-test",OPENAI_API_KEY:"test-key"});
 const text="a photo of a lake",last=()=>{const a=readPrivateAuditForTests();return a[a.length-1];};
 const plan=deterministicPlanner(reqFor(text)).plan;
 try{
  stub(200,responseBody(textOut(JSON.stringify(toWire(plan)))));
  const r=await orchestrateCreativeTurn({text});
  assert.equal(r.status,"planned");assert.equal(last().planner,"live");assert.equal(last().route?.provider,"openai");assert.equal(last().route?.modelId,"gpt-test");assert.deepEqual(last().usage,{input_tokens:11,output_tokens:22});
  assert.ok(!/gpt|openai/i.test(JSON.stringify(r)),"nothing private reaches the customer result");
  stub(200,responseBody(textOut("{"),{status:"incomplete",incomplete_details:{reason:"max_output_tokens"}}));
  assert.equal((await orchestrateCreativeTurn({text})).status,"planned");assert.equal(last().planner,"deterministic");assert.equal(last().fallbackReason,"invalid_output");
  for(const status of [401,429,500]){
   stub(status,{error:{message:"x",type:"x",code:null,param:null}});
   assert.equal((await orchestrateCreativeTurn({text})).status,"planned");assert.equal(last().fallbackReason,"planner_unavailable",String(status));
  }
  stub(200,responseBody([{type:"message",id:"m",role:"assistant",status:"completed",content:[{type:"refusal",refusal:"no"}]}]));
  const ref=await orchestrateCreativeTurn({text});assert.equal(ref.status,"restricted");assert.equal(last().fallbackReason,"planner_refused");
 }finally{globalThis.fetch=noNet;}
});
test("leak filter: model-family words are caught as standalone tokens only, and never when the user typed them",async()=>{
 const text="a photo of a lake";
 const leaky=(extra:string)=>async(r:PlannerRequest)=>({plan:{...deterministicPlanner(r).plan,qaChecklist:["ok one","ok two",extra]}});
 const {readPrivateAuditForTests:audit}=await import("../lib/private-audit");
 const reason=()=>{const a=audit();return a[a.length-1].fallbackReason;};
 for(const w of ["Sol","astra","Luna","terra","gpt-6","OpenAI"]){
  await orchestrateCreativeTurn({text},{planner:leaky("rendered by "+w)});assert.equal(reason(),"leak_filtered",w);
 }
 for(const w of ["solid stone","terrain","lunar light","astral"]){
  await orchestrateCreativeTurn({text},{planner:leaky("a "+w+" surface")});assert.notEqual(reason(),"leak_filtered",w);
 }
 await orchestrateCreativeTurn({text:"a photo of a lake named Luna"},{planner:leaky("lake Luna at dawn")});assert.notEqual(reason(),"leak_filtered","user typed it");
});
