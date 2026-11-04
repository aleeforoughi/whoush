import {test,beforeEach,afterEach} from "node:test";
import assert from "node:assert/strict";
import {bandFor,countAstraCall,createRouterState,loadRoutingConfig,parseRoutingConfig,planRoute,profileTask,resetRouterStateForTests,type RoutingConfig,type TaskProfile} from "../lib/llm-routing";
import {orchestrateCreativeTurn,deterministicPlanner} from "../lib/orchestrator";
import {PlannerInvalidOutputError,PlannerRefusedError,PlannerUnavailableError,type PlannerRequest,type PrivatePlanner} from "../lib/creative-plan";
import {readPrivateAuditForTests,type PrivateAuditRecord} from "../lib/private-audit";
import defaultJson from "../config/llm-routing.json";

const KEYS=["LLM_PROVIDER_AUTHORIZED","ALLOW_LIVE_LLM","LLM_FAST_MODEL","LLM_BALANCED_MODEL","LLM_DEEP_MODEL","ANTHROPIC_API_KEY","OPENAI_API_KEY","LLM_ASTRA_ENABLED"];
let saved:Record<string,string|undefined>={};
beforeEach(()=>{resetRouterStateForTests();saved=Object.fromEntries(KEYS.map(k=>[k,process.env[k]]));for(const k of KEYS)delete process.env[k];});
afterEach(()=>{for(const k of KEYS){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}});
const cfg=()=>loadRoutingConfig();
const withCfg=(over:Record<string,unknown>)=>parseRoutingConfig({...structuredClone(defaultJson),...over});
const BOTH={ANTHROPIC_API_KEY:"k",OPENAI_API_KEY:"k"};
const prof=(score:number,taskClass:TaskProfile["taskClass"]="standard_image"):TaskProfile=>({taskClass,score,signals:[]});

test("the shipped config is valid and its bands cover 0..100 in order",()=>{
 const c=cfg();assert.deepEqual(c.bands.map(b=>b.id),["quick","standard","complex","exceptional"]);assert.deepEqual(c.bands.map(b=>b.maxScore),[24,59,84,100]);
 assert.equal(c.astra.modelId,"gpt-6-astra");assert.ok(!c.escalation.escalateOn.includes("refused"),"refusals never escalate by default");
});
// Owner-approved 2026-11-04 from the 30-prompt Persian planner eval (docs/LLM_ROUTING.md): Luna first for quick, Sonnet first for standard.
test("the shipped ladders are Luna then Haiku for quick and Sonnet then Sol for standard",()=>{
 const c=cfg();assert.deepEqual(c.bands[0].ladder,["gpt-6-luna","claude-haiku-5-5"]);assert.deepEqual(c.bands[1].ladder,["claude-sonnet-5-5","gpt-6.1-sol"]);
});
test("config validation rejects unknown providers, unordered bands, missing prices and bad numbers",()=>{
 const bad=(over:Record<string,unknown>)=>assert.throws(()=>withCfg(over));
 const bands=(f:(b:{id:string;maxScore:number;ladder:string[]}[])=>void)=>{const b=structuredClone(defaultJson.bands) as {id:string;maxScore:number;ladder:string[]}[];f(b);return b;};
 bad({bands:bands(b=>{b[0].ladder=["mystery-1"];})});
 bad({bands:bands(b=>{b[1].maxScore=24;})});
 bad({bands:bands(b=>{b[3].maxScore=90;})});
 bad({bands:bands(b=>{b[0].ladder=["claude-haiku-5-5","claude-haiku-5-5"];})});
 bad({bands:bands(b=>{b[0].ladder=["claude-new-9"];})});
 bad({classOverrides:{video:["claude-unknown-1"]}});
 bad({classOverrides:{notaclass:["claude-haiku-5-5"]}});
 bad({escalation:{maxAttemptsPerTurn:0,escalateOnCorrectionsAtLeast:4,escalateOn:[]}});
 bad({escalation:{maxAttemptsPerTurn:2,escalateOnCorrectionsAtLeast:4,escalateOn:["something"]}});
 bad({maxEstimatedCostUsdPerTurn:0});bad({version:2});bad({extra:1});
 assert.ok(withCfg({classOverrides:{video:["claude-opus-5-5","gpt-6.1-sol"]}}).classOverrides.video);
});
test("profileTask: classes and scores for representative inputs",()=>{
 const p=(input:Record<string,unknown>,kind:"image"|"video"="image",skills:string[]=[],att?:{kind:string;role?:string;textExcerpt?:string}[])=>profileTask({text:"x",...input} as never,kind,skills,att);
 assert.deepEqual(p({text:"a lake"}),{taskClass:"quick_image",score:0,signals:[]});
 assert.equal(p({text:"x".repeat(200)}).taskClass,"quick_image");assert.equal(p({text:"x".repeat(200)}).score,16);
 const long=p({text:"x".repeat(500)},"image",["creative_copywriter","iranian_geography"]);assert.equal(long.score,26+12);assert.equal(long.taskClass,"standard_image");assert.ok(long.signals.includes("skill:creative_copywriter:+6"));
 assert.equal(p({text:"x".repeat(1200)}).score,36);
 const v=p({text:"یک ویدیو"},"video");assert.equal(v.taskClass,"video");assert.equal(v.score,12);
 assert.equal(p({task:"edit"}).taskClass,"edit");assert.equal(p({},"image",[],[{kind:"image",role:"edit_reference"}]).taskClass,"edit");
 const ch=p({characterRef:{id:"char-aref-0001",name:"آرین",angles:["front","three_quarter_left","three_quarter_right","profile_left"],version:1}});assert.equal(ch.taskClass,"character");assert.equal(ch.score,14+4);
 const ls=p({audio:{hasAudioReference:true,hasSpeech:true,language:"fa",accent:"tehrani"}},"video");assert.equal(ls.taskClass,"lip_sync");assert.equal(ls.score,12+16);
 assert.equal(p({},"video",[],[{kind:"audio",role:"lip_sync"}]).taskClass,"lip_sync");
 const ms=p({text:"storyboard با چند سکانس"},"video");assert.equal(ms.taskClass,"multi_shot");assert.equal(ms.score,12+28);
 const doc=p({},"image",[],[{kind:"md",textExcerpt:"y".repeat(3000)}]);assert.equal(doc.taskClass,"document_heavy");assert.equal(doc.score,4+10);
 assert.equal(p({},"image",[],[{kind:"pdf"},{kind:"pdf"},{kind:"json"}]).taskClass,"document_heavy");
 assert.equal(p({style:"cartoon"}).score,3);
 const a=p({},"image",[],[{kind:"image",role:"environment"},{kind:"image",role:"object"}]);assert.equal(a.score,8+6,"2 attachments + 2 distinct roles");
 const huge=p({text:"x".repeat(1500),task:"edit",style:"cartoon",characterRef:{id:"char-aref-0001",name:"آرین",angles:["front"],version:1},audio:{hasAudioReference:true,hasSpeech:true,language:"fa",accent:"tehrani"}},"video",["creative_copywriter","iranian_geography"],[{kind:"md",textExcerpt:"y".repeat(9000)}]);
 assert.equal(huge.score,100,"capped");
});
test("band selection at the edges",()=>{
 const c=cfg(),id=(s:number)=>bandFor(c,s).id;
 assert.deepEqual([0,24,25,59,60,84,85,100].map(id),["quick","quick","standard","standard","complex","complex","exceptional","exceptional"]);
});
test("planRoute: the band's ladder when everything is available, and class overrides win",()=>{
 const env={...BOTH,LLM_ASTRA_ENABLED:"true"},now=new Date("2026-11-04T10:00:00Z");
 assert.deepEqual(planRoute(prof(10),{env,now,state:createRouterState()}).ladder,["gpt-6-luna","claude-haiku-5-5"]);
 assert.deepEqual(planRoute(prof(90),{env,now,state:createRouterState()}).ladder,["claude-opus-5-5","gpt-6-astra"]);
 const c=withCfg({classOverrides:{lip_sync:["gpt-6.1-sol","claude-opus-5-5"]}});
 const r=planRoute(prof(10,"lip_sync"),{cfg:c,env,now,state:createRouterState()});assert.deepEqual(r.ladder,["gpt-6.1-sol","claude-opus-5-5"]);assert.equal(r.band,"quick");assert.match(r.reason,/class_override/);
});
test("planRoute skips: missing key, cooldown (with expiry), Astra disabled and daily cap, cost ceiling",()=>{
 const now=new Date("2026-11-04T10:00:00Z"),c=cfg();
 // missing key
 let r=planRoute(prof(10),{env:{ANTHROPIC_API_KEY:"k"},now,state:createRouterState()});assert.deepEqual(r.ladder,["claude-haiku-5-5"]);assert.deepEqual(r.skipped,[{modelId:"gpt-6-luna",why:"no_key"}]);
 r=planRoute(prof(10),{env:{},now,state:createRouterState()});assert.deepEqual(r.ladder,[]);assert.equal(r.reason,"no_route_available");
 // cooldown
 const st=createRouterState();st.cooldowns.set("anthropic",now.getTime()+60_000);
 r=planRoute(prof(10),{env:BOTH,now,state:st});assert.deepEqual(r.ladder,["gpt-6-luna"]);assert.equal(r.skipped[0].why,"cooldown");
 r=planRoute(prof(10),{env:BOTH,now:new Date(now.getTime()+60_001),state:st});assert.deepEqual(r.ladder,["gpt-6-luna","claude-haiku-5-5"],"cooldown expired");
 // astra
 r=planRoute(prof(95),{env:BOTH,now,state:createRouterState()});assert.deepEqual(r.ladder,["claude-opus-5-5"]);assert.equal(r.skipped[0].why,"astra_disabled");
 r=planRoute(prof(95),{env:{...BOTH,LLM_ASTRA_ENABLED:"1"},now,state:createRouterState()});assert.equal(r.skipped[0].why,"astra_disabled","only the literal true");
 const s2=createRouterState();for(let i=0;i<c.astra.maxCallsPerDay;i++)countAstraCall(now,s2);
 r=planRoute(prof(95),{env:{...BOTH,LLM_ASTRA_ENABLED:"true"},now,state:s2});assert.equal(r.skipped[0].why,"astra_daily_cap");
 r=planRoute(prof(95),{env:{...BOTH,LLM_ASTRA_ENABLED:"true"},now:new Date("2026-11-05T00:00:01Z"),state:s2});assert.deepEqual(r.ladder,["claude-opus-5-5","gpt-6-astra"],"a new UTC day resets the counter");
 // cost ceiling: astra over a tiny ceiling is dropped, the cheapest rung is always kept
 const tight=withCfg({maxEstimatedCostUsdPerTurn:0.03});
 r=planRoute(prof(95),{cfg:tight,env:{...BOTH,LLM_ASTRA_ENABLED:"true"},now,state:createRouterState(),inputChars:40_000});
 assert.deepEqual(r.ladder,["claude-opus-5-5"]);assert.deepEqual(r.skipped.map(x=>x.why),["cost_ceiling"]);
 const tiny=withCfg({maxEstimatedCostUsdPerTurn:0.0001});
 r=planRoute(prof(95),{cfg:tiny,env:{...BOTH,LLM_ASTRA_ENABLED:"true"},now,state:createRouterState(),inputChars:40_000});assert.deepEqual(r.ladder,["claude-opus-5-5"],"cheapest available rung survives");
});
test("legacy LLM_*_MODEL variables replace the first rung of quick, standard and complex only",()=>{
 const base={env:{...BOTH,LLM_FAST_MODEL:"claude-haiku-5-5",LLM_BALANCED_MODEL:"claude-opus-5-5",LLM_DEEP_MODEL:"gpt-6.1-sol"},now:new Date(),state:createRouterState()};
 assert.deepEqual(planRoute(prof(10),base).ladder,["claude-haiku-5-5"],"a duplicate rung collapses");
 assert.deepEqual(planRoute(prof(40),base).ladder,["claude-opus-5-5","gpt-6.1-sol"]);
 assert.deepEqual(planRoute(prof(70),base).ladder,["gpt-6.1-sol"],"a duplicate rung collapses");
 assert.deepEqual(planRoute(prof(10),{...base,env:{...BOTH,LLM_FAST_MODEL:"gpt-6.1-sol"}}).ladder,["gpt-6.1-sol","claude-haiku-5-5"]);
 assert.deepEqual(planRoute(prof(95),{...base,env:{...base.env,LLM_ASTRA_ENABLED:"true"}}).ladder,["claude-opus-5-5","gpt-6-astra"]);
 assert.deepEqual(planRoute(prof(10),{...base,env:{...BOTH,LLM_FAST_MODEL:"mystery-1"}}).ladder,["gpt-6-luna","claude-haiku-5-5"],"an unknown legacy id is ignored (fail closed)");
});

// ---- orchestrator escalation (stub planners, no network) ----
const LIVE={LLM_PROVIDER_AUTHORIZED:"true",ALLOW_LIVE_LLM:"true",...BOTH};
const TEXT="a photo of a lake";
const last=():PrivateAuditRecord=>{const a=readPrivateAuditForTests();return a[a.length-1];};
const usage={input_tokens:1000,output_tokens:500};
const good:PrivatePlanner=r=>({plan:deterministicPlanner(r).plan,usage});
const calls:string[]=[];
const hook=(m:Record<string,PrivatePlanner>)=>(id:string)=>{const p=m[id];if(!p)throw new Error("unexpected model "+id);return (async(r:PlannerRequest)=>{calls.push(id);return p(r);}) as PrivatePlanner;};
// The escalation mechanics below run on a fixed quick ladder (Haiku then Luna), so they do not change when the owner reorders the shipped ladders.
const mech=(over:Record<string,unknown>={})=>withCfg({bands:[{id:"quick",maxScore:24,ladder:["claude-haiku-5-5","gpt-6-luna"]},...defaultJson.bands.slice(1)],...over});
const runTurn=(m:Record<string,PrivatePlanner>,extra:Record<string,unknown>={})=>{calls.length=0;return orchestrateCreativeTurn({text:TEXT},{plannerFor:hook(m),routerState:createRouterState(),routing:mech(),...extra});};
const boom=(E:new()=>Error):PrivatePlanner=>()=>{throw new E();};

test("first rung succeeds: one attempt, audited privately with class, score, band and chosen model",async()=>{
 Object.assign(process.env,LIVE);
 const r=await runTurn({"claude-haiku-5-5":good});
 assert.equal(r.status,"planned");assert.deepEqual(calls,["claude-haiku-5-5"]);
 const a=last();assert.equal(a.planner,"live");assert.deepEqual(a.route,{provider:"anthropic",modelId:"claude-haiku-5-5"});
 const ro=a.routing!;assert.equal(ro.taskClass,"quick_image");assert.equal(ro.score,0);assert.equal(ro.band,"quick");assert.deepEqual(ro.signals,[]);assert.equal(ro.chosenModelId,"claude-haiku-5-5");
 assert.equal(ro.attempts.length,1);assert.equal(ro.attempts[0].outcome,"ok");assert.equal(ro.attempts[0].provider,"anthropic");assert.deepEqual(ro.attempts[0].usage,usage);
 assert.ok(Math.abs(ro.attempts[0].estCostUsd!-(1000*0.1+500*0.5)/1e6)<1e-12);assert.equal(typeof ro.attempts[0].latencyMs,"number");
 assert.ok(!/claude|gpt|haiku|quick_image|attempts/i.test(JSON.stringify(r)),"nothing private reaches the customer result");
});
test("invalid output or unavailable on rung 1 moves to rung 2; the failing provider cools down",async()=>{
 Object.assign(process.env,LIVE);
 for(const [E,outcome] of [[PlannerInvalidOutputError,"invalid_output"],[PlannerUnavailableError,"planner_unavailable"]] as const){
  const st=createRouterState(),now=new Date("2026-11-04T10:00:00Z");
  const r=await runTurn({"claude-haiku-5-5":boom(E),"gpt-6-luna":good},{routerState:st,now:()=>now});
  assert.equal(r.status,"planned");assert.deepEqual(calls,["claude-haiku-5-5","gpt-6-luna"]);
  const ro=last().routing!;assert.deepEqual(ro.attempts.map(x=>x.outcome),[outcome,"ok"]);assert.equal(ro.chosenModelId,"gpt-6-luna");assert.equal(last().planner,"live");assert.equal(last().route?.provider,"openai");
  assert.equal(st.cooldowns.has("anthropic"),outcome==="planner_unavailable");
  if(outcome==="planner_unavailable"){
   assert.equal(st.cooldowns.get("anthropic"),now.getTime()+60_000);
   await runTurn({"gpt-6-luna":good},{routerState:st,now:()=>new Date(now.getTime()+30_000)});assert.deepEqual(calls,["gpt-6-luna"],"still cooling down");
   await runTurn({"claude-haiku-5-5":good,"gpt-6-luna":good},{routerState:st,now:()=>new Date(now.getTime()+61_000)});assert.deepEqual(calls,["claude-haiku-5-5"],"cooldown expired");
  }
 }
});
test("a leaked model name on rung 1 escalates; the leak never reaches the customer",async()=>{
 Object.assign(process.env,LIVE);
 const leaky:PrivatePlanner=r=>({plan:{...deterministicPlanner(r).plan,qaChecklist:["ok one","ok two","made by Sol"]}});
 const r=await runTurn({"claude-haiku-5-5":leaky,"gpt-6-luna":good});
 assert.equal(r.status,"planned");assert.deepEqual(last().routing!.attempts.map(x=>x.outcome),["leak_filtered","ok"]);assert.ok(!JSON.stringify(r).includes("Sol"));
});
test("many invariant corrections on rung 1 escalate to rung 2",async()=>{
 Object.assign(process.env,LIVE);
 const sloppy:PrivatePlanner=r=>({plan:{...deterministicPlanner(r).plan,camera:undefined,qaChecklist:["a one","a two","a three"],hardConstraints:[]},usage});
 const c=mech({escalation:{maxAttemptsPerTurn:2,escalateOnCorrectionsAtLeast:1,escalateOn:["invalid_output"]}});
 await runTurn({"claude-haiku-5-5":sloppy,"gpt-6-luna":good},{routing:c});
 assert.deepEqual(calls,["claude-haiku-5-5","gpt-6-luna"]);assert.equal(last().routing!.chosenModelId,"gpt-6-luna");
 // below the threshold the first answer stands
 await runTurn({"claude-haiku-5-5":sloppy,"gpt-6-luna":good});
 assert.deepEqual(calls,["claude-haiku-5-5"]);
 // if the escalated attempt fails, the first usable plan is kept
 const r=await runTurn({"claude-haiku-5-5":sloppy,"gpt-6-luna":boom(PlannerUnavailableError)},{routing:c});
 assert.equal(r.status,"planned");assert.equal(last().routing!.chosenModelId,"claude-haiku-5-5");assert.equal(last().planner,"live");
});
test("maxAttemptsPerTurn is respected, then the deterministic planner answers",async()=>{
 Object.assign(process.env,LIVE);
 const one=mech({escalation:{maxAttemptsPerTurn:1,escalateOnCorrectionsAtLeast:4,escalateOn:["invalid_output","planner_unavailable"]}});
 let r=await runTurn({"claude-haiku-5-5":boom(PlannerInvalidOutputError),"gpt-6-luna":good},{routing:one});
 assert.equal(r.status,"planned");assert.deepEqual(calls,["claude-haiku-5-5"]);assert.equal(last().planner,"deterministic");assert.equal(last().fallbackReason,"invalid_output");
 // three rungs configured, budget two
 const three=withCfg({bands:[{id:"quick",maxScore:24,ladder:["claude-haiku-5-5","gpt-6-luna","claude-sonnet-5-5"]},...defaultJson.bands.slice(1)]});
 r=await runTurn({"claude-haiku-5-5":boom(PlannerInvalidOutputError),"gpt-6-luna":boom(PlannerInvalidOutputError),"claude-sonnet-5-5":good},{routing:three});
 assert.deepEqual(calls,["claude-haiku-5-5","gpt-6-luna"]);assert.equal(r.status,"planned");assert.equal(last().planner,"deterministic");assert.equal(last().routing!.attempts.length,2);assert.equal(last().routing!.chosenModelId,null);
});
test("a refusal on rung 1 is restricted with no second attempt; only an explicit config escalates it",async()=>{
 Object.assign(process.env,LIVE);
 const r=await runTurn({"claude-haiku-5-5":boom(PlannerRefusedError),"gpt-6-luna":good});
 assert.equal(r.status,"restricted");assert.deepEqual(calls,["claude-haiku-5-5"]);assert.equal(last().fallbackReason,"planner_refused");assert.equal(last().routing!.attempts[0].outcome,"refused");
 // a refusal after an unavailable first rung is still final
 const r2=await runTurn({"claude-haiku-5-5":boom(PlannerUnavailableError),"gpt-6-luna":boom(PlannerRefusedError)});
 assert.equal(r2.status,"restricted");assert.deepEqual(calls,["claude-haiku-5-5","gpt-6-luna"]);
 const opt=mech({escalation:{maxAttemptsPerTurn:2,escalateOnCorrectionsAtLeast:4,escalateOn:["refused"]}});
 const r3=await runTurn({"claude-haiku-5-5":boom(PlannerRefusedError),"gpt-6-luna":good},{routing:opt});
 assert.equal(r3.status,"planned");assert.deepEqual(calls,["claude-haiku-5-5","gpt-6-luna"]);
});
test("Astra is used only when enabled, counted per day, and a route with no key or cooldown falls back with a reason",async()=>{
 Object.assign(process.env,LIVE);
 const text="ویدیو storyboard با چند سکانس و "+"x".repeat(1100);
 const st=createRouterState();
 const run=(m:Record<string,PrivatePlanner>)=>{calls.length=0;return orchestrateCreativeTurn({text,task:"edit",style:"cartoon"},{plannerFor:hook(m),routerState:st});};
 await run({"claude-opus-5-5":boom(PlannerInvalidOutputError),"gpt-6-astra":good});
 assert.equal(last().routing!.band,"exceptional");assert.deepEqual(calls,["claude-opus-5-5"],"Astra disabled: single rung");
 process.env.LLM_ASTRA_ENABLED="true";
 await run({"claude-opus-5-5":boom(PlannerInvalidOutputError),"gpt-6-astra":good});
 assert.deepEqual(calls,["claude-opus-5-5","gpt-6-astra"]);assert.equal(st.astra.n,1);assert.equal(last().routing!.chosenModelId,"gpt-6-astra");
 delete process.env.ANTHROPIC_API_KEY;delete process.env.OPENAI_API_KEY;
 await run({});assert.equal(last().planner,"deterministic");assert.equal(last().fallbackReason,"api key not configured");
 delete process.env.ALLOW_LIVE_LLM;await run({});assert.equal(last().fallbackReason,"live llm disabled");
});
test("legacy env override reaches the orchestrator as the first rung",async()=>{
 Object.assign(process.env,LIVE,{LLM_FAST_MODEL:"gpt-6.1-sol"});
 await runTurn({"gpt-6.1-sol":good});assert.deepEqual(calls,["gpt-6.1-sol"]);assert.equal(last().route?.modelId,"gpt-6.1-sol");
});
test("with the shipped config a quick turn tries Luna first, and Haiku answers when Luna is unavailable",async()=>{
 Object.assign(process.env,LIVE);
 await runTurn({"gpt-6-luna":good},{routing:cfg()});assert.deepEqual(calls,["gpt-6-luna"]);assert.deepEqual(last().route,{provider:"openai",modelId:"gpt-6-luna"});
 await runTurn({"gpt-6-luna":boom(PlannerUnavailableError),"claude-haiku-5-5":good},{routing:cfg()});
 assert.deepEqual(calls,["gpt-6-luna","claude-haiku-5-5"]);assert.equal(last().routing!.chosenModelId,"claude-haiku-5-5");
});
