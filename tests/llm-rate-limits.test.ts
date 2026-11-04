import {test,beforeEach,afterEach} from "node:test";
import assert from "node:assert/strict";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import {acquireProviderSlot,createRouterState,loadRoutingConfig,markProviderCooldown,parseRoutingConfig,resetRouterStateForTests,retryAfterMsFrom} from "../lib/llm-routing";
import {openAIUnavailable} from "../lib/llm-openai";
import {anthropicUnavailable} from "../lib/llm-anthropic";
import {orchestrateCreativeTurn,deterministicPlanner} from "../lib/orchestrator";
import {PlannerUnavailableError,type PlannerRequest,type PrivatePlanner} from "../lib/creative-plan";
import {readPrivateAuditForTests,type PrivateAuditRecord} from "../lib/private-audit";
import defaultJson from "../config/llm-routing.json";

const KEYS=["LLM_PROVIDER_AUTHORIZED","ALLOW_LIVE_LLM","LLM_FAST_MODEL","LLM_BALANCED_MODEL","LLM_DEEP_MODEL","ANTHROPIC_API_KEY","OPENAI_API_KEY","LLM_ASTRA_ENABLED"];
let saved:Record<string,string|undefined>={};
beforeEach(()=>{resetRouterStateForTests();saved=Object.fromEntries(KEYS.map(k=>[k,process.env[k]]));for(const k of KEYS)delete process.env[k];Object.assign(process.env,{LLM_PROVIDER_AUTHORIZED:"true",ALLOW_LIVE_LLM:"true",ANTHROPIC_API_KEY:"k",OPENAI_API_KEY:"k"});});
afterEach(()=>{for(const k of KEYS){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}});
const withLimits=(providers:Record<string,{maxConcurrent:number;maxQueueWaitMs:number}>)=>parseRoutingConfig({...structuredClone(defaultJson),rateLimits:{...defaultJson.rateLimits,providers}});
const H=(h:Record<string,string>)=>new Headers(h);
const last=():PrivateAuditRecord=>{const a=readPrivateAuditForTests();return a[a.length-1];};
const good:PrivatePlanner=r=>({plan:deterministicPlanner(r).plan,usage:{input_tokens:10,output_tokens:10}});
const limited=(limit:"rate"|"quota",retryAfterMs?:number):PrivatePlanner=>()=>{throw new PlannerUnavailableError(undefined,{limit,retryAfterMs});};

test("shipped rate-limit settings are valid and conservative",()=>{
 const rl=loadRoutingConfig().rateLimits;
 assert.deepEqual(rl.providers.openai,{maxConcurrent:4,maxQueueWaitMs:5000});assert.equal(rl.quotaCooldownSeconds,900);assert.equal(rl.maxRetryAfterSeconds,600);
 assert.throws(()=>withLimits({openai:{maxConcurrent:0,maxQueueWaitMs:0}}));
 assert.throws(()=>withLimits({mystery:{maxConcurrent:1,maxQueueWaitMs:0}} as never));
});
test("retryAfterMsFrom reads retry-after-ms, retry-after seconds and an HTTP date, and ignores junk",()=>{
 const now=Date.parse("2026-11-04T10:00:00Z");
 assert.equal(retryAfterMsFrom(H({"retry-after-ms":"1500.2"}),now),1501);
 assert.equal(retryAfterMsFrom(H({"retry-after":"30"}),now),30_000);
 assert.equal(retryAfterMsFrom(H({"retry-after":"Wed, 04 Nov 2026 10:02:00 GMT"}),now),120_000);
 for(const v of ["0","-3","soon","Wed, 04 Nov 2026 09:00:00 GMT"])assert.equal(retryAfterMsFrom(H({"retry-after":v}),now),undefined,v);
 assert.equal(retryAfterMsFrom(H({}),now),undefined);assert.equal(retryAfterMsFrom(undefined,now),undefined);
});
test("cooldown honours Retry-After within the cap, uses the quota cooldown for quota limits, and never shortens",()=>{
 const cfg=loadRoutingConfig(),now=new Date("2026-11-04T10:00:00Z"),t=now.getTime();
 const cd=(info:Parameters<typeof markProviderCooldown>[4])=>{const s=createRouterState();markProviderCooldown("openai",now,cfg,s,info);return s.cooldowns.get("openai")!-t;};
 assert.equal(cd({}),60_000,"plain unavailable: default");
 assert.equal(cd({limit:"rate",retryAfterMs:5_000}),60_000,"a short Retry-After keeps the default");
 assert.equal(cd({limit:"rate",retryAfterMs:180_000}),180_000);
 assert.equal(cd({limit:"rate",retryAfterMs:9_999_999}),600_000,"capped");
 assert.equal(cd({limit:"quota"}),900_000);
 const s=createRouterState();markProviderCooldown("openai",now,cfg,s,{limit:"quota"});markProviderCooldown("openai",now,cfg,s,{});assert.equal(s.cooldowns.get("openai")!-t,900_000,"not shortened");
});
test("provider slots: limit in flight, FIFO hand-off on release, null after the wait, release is idempotent",async()=>{
 const cfg=withLimits({openai:{maxConcurrent:1,maxQueueWaitMs:200}}),s=createRouterState();
 const r1=(await acquireProviderSlot("openai",cfg,s))!;assert.equal(s.inFlight.get("openai"),1);
 const order:string[]=[];
 const p2=acquireProviderSlot("openai",cfg,s).then(r=>{order.push("2");return r;}),p3=acquireProviderSlot("openai",cfg,s).then(r=>{order.push("3");return r;});
 r1();r1();
 const r2=(await p2)!;assert.ok(r2);assert.equal(s.inFlight.get("openai"),1,"a double release frees one slot only");
 r2();const r3=(await p3)!;assert.ok(r3);assert.deepEqual(order,["2","3"]);r3();assert.equal(s.inFlight.get("openai"),0);
 const hold=(await acquireProviderSlot("openai",cfg,s))!;
 const t0=Date.now();assert.equal(await acquireProviderSlot("openai",cfg,s),null);assert.ok(Date.now()-t0>=190,"waited");assert.equal(s.waiters.get("openai")!.length,0,"timed-out waiter removed");
 hold();
 assert.equal(await acquireProviderSlot("openai",withLimits({openai:{maxConcurrent:1,maxQueueWaitMs:0}}),(()=>{const x=createRouterState();x.inFlight.set("openai",1);return x;})()),null,"no wait: immediately busy");
 const free=await acquireProviderSlot("anthropic",withLimits({}),s);assert.equal(typeof free,"function","an unlisted provider is not limited");
});
test("SDK errors map to vendor-neutral limits",()=>{
 const rate=openAIUnavailable(OpenAI.APIError.generate(429,{error:{code:"rate_limit_exceeded",message:"x"}},undefined,H({"retry-after":"20"})) as InstanceType<typeof OpenAI.APIError>);
 assert.equal(rate.limit,"rate");assert.equal(rate.retryAfterMs,20_000);assert.ok(!/openai|gpt/i.test(rate.message));
 const quota=openAIUnavailable(OpenAI.APIError.generate(429,{error:{code:"insufficient_quota",message:"x",type:"insufficient_quota"}},undefined,H({})) as InstanceType<typeof OpenAI.APIError>);
 assert.equal(quota.limit,"quota");assert.equal(quota.retryAfterMs,undefined);
 const five=openAIUnavailable(OpenAI.APIError.generate(503,{message:"x"},undefined,H({})) as InstanceType<typeof OpenAI.APIError>);assert.equal(five.limit,undefined);
 const over=anthropicUnavailable(Anthropic.APIError.generate(529,{type:"error",error:{type:"overloaded_error",message:"x"}},undefined,H({"retry-after":"7"})) as InstanceType<typeof Anthropic.APIError>);
 assert.equal(over.limit,"rate");assert.equal(over.retryAfterMs,7_000);assert.ok(!/anthropic|claude/i.test(over.message));
 assert.equal(anthropicUnavailable(Anthropic.APIError.generate(500,undefined,undefined,H({})) as InstanceType<typeof Anthropic.APIError>).limit,undefined);
});

// ---- through the orchestrator (stub planners, no network). Shipped quick ladder: Luna, then Haiku. ----
const calls:string[]=[];
const hook=(m:Record<string,PrivatePlanner>)=>(id:string)=>{const p=m[id];if(!p)throw new Error("unexpected model "+id);return (async(r:PlannerRequest)=>{calls.push(id);return p(r);}) as PrivatePlanner;};
const turn=(m:Record<string,PrivatePlanner>,extra:Record<string,unknown>={})=>{calls.length=0;return orchestrateCreativeTurn({text:"a photo of a lake"},{plannerFor:hook(m),...extra});};

test("a rate-limited rung escalates, is audited with its limit, and cools down for the Retry-After",async()=>{
 const st=createRouterState(),now=new Date("2026-11-04T10:00:00Z");
 const r=await turn({"gpt-6-luna":limited("rate",240_000),"claude-haiku-5-5":good},{routerState:st,now:()=>now});
 assert.equal(r.status,"planned");assert.deepEqual(calls,["gpt-6-luna","claude-haiku-5-5"]);
 const a=last().routing!.attempts[0];assert.equal(a.outcome,"planner_unavailable");assert.equal(a.limit,"rate");assert.equal(a.retryAfterMs,240_000);
 assert.equal(st.cooldowns.get("openai"),now.getTime()+240_000);
 assert.ok(!/"limit"|quota|retryAfter|rate.?limit/i.test(JSON.stringify(r)),"nothing about limits reaches the customer");
 await turn({"claude-haiku-5-5":good},{routerState:st,now:()=>new Date(now.getTime()+200_000)});assert.deepEqual(calls,["claude-haiku-5-5"],"still cooling down after the default 60 s");
});
test("a quota limit cools the provider down for the quota cooldown",async()=>{
 const st=createRouterState(),now=new Date("2026-11-04T10:00:00Z");
 await turn({"gpt-6-luna":limited("quota"),"claude-haiku-5-5":good},{routerState:st,now:()=>now});
 assert.equal(last().routing!.attempts[0].limit,"quota");assert.equal(st.cooldowns.get("openai"),now.getTime()+900_000);
});
test("a busy provider is skipped without spending the attempt budget; when every provider is busy the deterministic planner answers",async()=>{
 const cfg=withLimits({openai:{maxConcurrent:1,maxQueueWaitMs:0},anthropic:{maxConcurrent:1,maxQueueWaitMs:0}});
 const st=createRouterState();st.inFlight.set("openai",1);
 let r=await turn({"claude-haiku-5-5":good},{routing:cfg,routerState:st});
 assert.equal(r.status,"planned");assert.deepEqual(calls,["claude-haiku-5-5"]);
 const ro=last().routing!;assert.deepEqual(ro.skipped.filter(x=>x.why==="provider_busy").map(x=>x.modelId),["gpt-6-luna"]);assert.equal(ro.attempts.length,1);assert.equal(ro.chosenModelId,"claude-haiku-5-5");
 assert.equal(st.inFlight.get("anthropic"),0,"the slot is released after the call");
 st.inFlight.set("anthropic",1);
 r=await turn({},{routing:cfg,routerState:st});
 assert.equal(r.status,"planned");assert.deepEqual(calls,[]);assert.equal(last().planner,"deterministic");assert.equal(last().fallbackReason,"provider busy");
});
test("concurrent turns never exceed a provider's in-flight limit, and a throwing planner still releases its slot",async()=>{
 const cfg=withLimits({openai:{maxConcurrent:2,maxQueueWaitMs:5000},anthropic:{maxConcurrent:2,maxQueueWaitMs:5000}});
 const st=createRouterState();let live=0,peak=0;
 const slow:PrivatePlanner=async r=>{live++;peak=Math.max(peak,live);await new Promise(x=>setTimeout(x,20));live--;return good(r);};
 await Promise.all(Array.from({length:6},()=>orchestrateCreativeTurn({text:"a photo of a lake"},{plannerFor:()=>slow,routing:cfg,routerState:st})));
 assert.equal(peak,2);assert.equal(st.inFlight.get("openai"),0);
 const boom:PrivatePlanner=()=>{throw new Error("unexpected");};
 await orchestrateCreativeTurn({text:"a photo of a lake"},{plannerFor:()=>boom,routing:cfg,routerState:st});
 assert.equal(st.inFlight.get("openai"),0);
});
