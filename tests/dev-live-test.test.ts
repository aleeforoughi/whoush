import {test} from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {claimDevSubmit,devGenerationGate,devLiveTest,devSubmitCount,generationGate,generationModeFor} from "../lib/policy";
import {llmPolicy} from "../lib/llm";
import {findMediaModel} from "../lib/catalog";
import {createQuote,FA_DEV_CAP_REACHED,QuoteError} from "../lib/quotes";
import {InMemoryJobStore,executeApprovedQuote,pollJob,toPublicJob} from "../lib/jobs";
import {ReservationLedger} from "../lib/ledger";
import type {MediaProvider,ProviderStatus} from "../lib/media-provider";
import {orchestrateCreativeTurn} from "../lib/orchestrator";

const KEYS=["NODE_ENV","WHOUSH_DEV_LIVE_TEST","WHOUSH_DEV_LIVE_MAX_SUBMITS","HIGGSFIELD_API_KEY","ANTHROPIC_API_KEY","OPENAI_API_KEY","LLM_FAST_MODEL","LLM_BALANCED_MODEL","LLM_DEEP_MODEL",
 "PROVIDER_END_USER_AUTHORIZED","PROVIDER_RESELLER_AUTHORIZED","ALLOW_LIVE_GENERATION","PRODUCTION_MODERATION_VERIFIED","BILLING_LEDGER_VERIFIED","QUOTE_SIGNING_SECRET","LLM_PROVIDER_AUTHORIZED","ALLOW_LIVE_LLM"];
async function withEnv<T>(vars:Record<string,string|undefined>,fn:()=>Promise<T>|T):Promise<T>{
 const saved=Object.fromEntries(KEYS.map(k=>[k,process.env[k]])),env=process.env as Record<string,string|undefined>;
 for(const k of KEYS)delete env[k];
 for(const [k,v] of Object.entries(vars))if(v!==undefined)env[k]=v;
 try{return await fn();}finally{for(const k of KEYS){if(saved[k]===undefined)delete env[k];else env[k]=saved[k];}}
}
const resetCap=()=>{(globalThis as {__whoushDevSubmits?:{n:number}}).__whoushDevSubmits={n:0};};
const DEV={NODE_ENV:"development",WHOUSH_DEV_LIVE_TEST:"true",HIGGSFIELD_API_KEY:"test-key"};
const soul=findMediaModel("soul-image")!,seedance=findMediaModel("seedance-2-5-5s")!,kling=findMediaModel("kling-4-0-5s")!,genjutsu=findMediaModel("genjutsu-replace")!;

test("dev live test can never switch on outside `next dev`",async()=>{
 for(const NODE_ENV of ["production","test",undefined])await withEnv({...DEV,NODE_ENV},()=>{
  assert.equal(devLiveTest().enabled,false,String(NODE_ENV));
  assert.equal(generationModeFor(soul),"demo");
  assert.ok(devGenerationGate(soul).blockers.includes("dev_live_test_off"));
 });
 await withEnv({...DEV,WHOUSH_DEV_LIVE_TEST:"1"},()=>assert.equal(devLiveTest().enabled,false,"only the literal string true"));
});
test("dev live test asserts no launch authorization and only allows verified model paths",async()=>{
 await withEnv(DEV,()=>{
  resetCap();
  assert.equal(generationGate(soul).live,false,"production gates stay closed");
  assert.equal(generationModeFor(soul),"dev_live");
  assert.equal(generationModeFor(seedance),"dev_live","Seedance 2.5 text-to-video is verified from its API reference");
  assert.equal(generationModeFor(kling),"demo","unverified models stay mock");
  assert.ok(devGenerationGate(kling).blockers.includes("model_unverified"));
  assert.deepEqual(devGenerationGate(genjutsu).blockers,["needs_hosted_media"],"verified, but its media inputs cannot be hosted yet");
 });
 await withEnv({...DEV,HIGGSFIELD_API_KEY:undefined},()=>{resetCap();assert.ok(devGenerationGate(soul).blockers.includes("provider_credentials"));});
});
test("dev live submissions are capped per process",async()=>{
 await withEnv({...DEV,WHOUSH_DEV_LIVE_MAX_SUBMITS:"2"},()=>{
  resetCap();
  assert.equal(claimDevSubmit(),true);assert.equal(claimDevSubmit(),true);assert.equal(claimDevSubmit(),false);
  assert.equal(devSubmitCount(),2);assert.ok(devGenerationGate(soul).blockers.includes("dev_cap_reached"));
  assert.equal(generationModeFor(soul),"demo","cap reached falls back to mock");
 });
 for(const bad of ["0","-1","51","abc"])await withEnv({...DEV,WHOUSH_DEV_LIVE_MAX_SUBMITS:bad},()=>assert.equal(devLiveTest().maxSubmits,5,bad));
});
test("a used-up dev cap refuses the quote with the reason instead of a silent demo that makes nothing",async()=>{
 await withEnv({...DEV,WHOUSH_DEV_LIVE_MAX_SUBMITS:"1"},async()=>{
  resetCap();
  const t=await orchestrateCreativeTurn({text:"یک عکس از دریاچه در غروب با soul"});assert.equal(t.status,"planned");
  const turnId=(t as {turnId:string}).turnId;
  assert.equal(createQuote({modelId:"soul-image",turnId}).mode,"dev_live");
  assert.equal(claimDevSubmit(),true);
  assert.throws(()=>createQuote({modelId:"soul-image",turnId}),(e:unknown)=>e instanceof QuoteError&&e.code==="dev_cap_reached"&&e.status===429);
  assert.match(FA_DEV_CAP_REACHED,/سقف تولید آزمایشی/);
  assert.equal(createQuote({modelId:"kling-4-0-5s",turnId:(await orchestrateCreativeTurn({text:"یک ویدیو از دریاچه در غروب با kling"}) as {turnId:string}).turnId}).mode,"demo","an unverified model is still a demo, as before");
 });
 await withEnv({...DEV,NODE_ENV:"test"},async()=>{resetCap();assert.equal(devLiveTest().enabled,false);});
});
test("a dev_live job submits to the real provider once, returns outputs, and never charges Neurons",async()=>{
 await withEnv(DEV,async()=>{
  resetCap();
  const t=await orchestrateCreativeTurn({text:"یک عکس از دریاچه در غروب با soul"});assert.equal(t.status,"planned");
  const q=createQuote({modelId:"soul-image",turnId:(t as {turnId:string}).turnId});assert.equal(q.mode,"dev_live");
  let submits=0,status:ProviderStatus={state:"queued",outputs:[]};
  const provider:MediaProvider={async submit(){submits++;return {providerRequestId:"req-dev-1"};},async status(){return status;},async cancel(){}};
  const deps={store:new InMemoryJobStore(),ledger:new ReservationLedger(),provider};
  const job=await executeApprovedQuote({token:q.token,approved:true,idempotencyKey:randomUUID(),ownerId:"o",moderation:{decision:"allow",source:"lexical_demo"}},deps);
  assert.equal(job.mode,"dev_live");assert.equal(job.state,"submitted");assert.equal(submits,1);assert.equal(devSubmitCount(),1);
  status={state:"completed",outputs:[{kind:"image",url:"https://cdn.example/out.png",needsMirroring:true}]};
  const done=(await pollJob(job.id,"o",deps))!;
  assert.equal(done.state,"completed");assert.equal(done.chargedNeurons,0,"dev testing never charges");assert.equal(deps.ledger.get(job.id)?.state,"released");
  const pub=toPublicJob(done);assert.equal(pub.outputs.length,1);assert.match(pub.messageFa,/تست توسعه/);
 });
});
test("dev live test enables the real planner only with a Claude model id and a key",async()=>{
 await withEnv({...DEV,ANTHROPIC_API_KEY:"k",LLM_FAST_MODEL:"claude-haiku-5-5"},()=>assert.deepEqual(llmPolicy("fast"),{live:true,reason:"dev_live_test"}));
 await withEnv({...DEV,LLM_FAST_MODEL:"claude-haiku-5-5"},()=>assert.equal(llmPolicy("fast").live,false));
 await withEnv({...DEV,ANTHROPIC_API_KEY:"k",LLM_FAST_MODEL:"gpt-x"},()=>assert.equal(llmPolicy("fast").live,false,"gpt id needs OPENAI_API_KEY"));
 await withEnv({...DEV,OPENAI_API_KEY:"k",LLM_FAST_MODEL:"gpt-6.1-sol"},()=>assert.deepEqual(llmPolicy("fast"),{live:true,reason:"dev_live_test"}));
 await withEnv({...DEV,ANTHROPIC_API_KEY:"k",LLM_FAST_MODEL:"mystery-1"},()=>assert.equal(llmPolicy("fast").live,false));
 await withEnv({...DEV,NODE_ENV:"production",ANTHROPIC_API_KEY:"k",LLM_FAST_MODEL:"claude-haiku-5-5"},()=>assert.equal(llmPolicy("fast").reason,"provider not authorized"));
});
