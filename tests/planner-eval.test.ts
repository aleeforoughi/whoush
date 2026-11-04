import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {EvalPromptsSchema,applyEnv,cameraComplete,completeness,estimateCostUsd,mean,normalizeUsage,parseEnvFile,percentile,persianRatio,publicStrings,classTable,compareRows,suggestClassOverrides,renderReport,scoreMentions,shotComplete,summarize,type EvalRun} from "../scripts/planner-eval-lib";
import {CreativeTurnInputSchema,type PublicCreativePlan} from "../lib/creative-plan";

const camera={look:"ظاهر",focalLengthMm:35,aperture:"f/2.8",shutter:"1/125s",iso:200,whiteBalanceK:5600,framing:"کادر",lighting:"نور",focus:"فوکوس",aspectRatio:"3:2"};
const shot={shotSize:"متوسط",cameraMovement:"دالی",lens:"35mm",targetFps:24,shutterAngle:180,durationSeconds:5,blocking:"حرکت",continuityNotes:["یکسان"]};

test("persianRatio counts strings with Persian letters; Latin-only camera tokens are not counted",()=>{
 assert.equal(persianRatio([]),0);assert.equal(persianRatio(["سلام","hello","ok سلام","123"]),0.5);
 const pl={intentSummaryFa:"خلاصه",mediaKind:"image",hardConstraints:["قید"],softPreferences:[],camera,continuity:{locks:[],antiTeleport:[]},realism:{mode:"photoreal"},qaChecklist:["الف"],references:[]} as unknown as PublicCreativePlan;
 const s=publicStrings(pl);
 assert.ok(!s.includes("f/2.8")&&!s.includes("3:2")&&!s.includes("photoreal")&&!s.includes("image"));
 assert.equal(persianRatio(s),1);
});
test("camera and shot completeness",()=>{
 assert.equal(cameraComplete(camera),true);assert.equal(cameraComplete({...camera,iso:undefined}),false);assert.equal(cameraComplete({...camera,look:" "}),false);assert.equal(cameraComplete(undefined),false);
 assert.equal(shotComplete(shot),true);assert.equal(shotComplete({...shot,continuityNotes:undefined}),false);assert.equal(shotComplete({...shot,targetFps:Number.NaN}),false);
 const base={intentSummaryFa:"x",mediaKind:"image",hardConstraints:[],softPreferences:[],continuity:{locks:[],antiTeleport:[]},realism:{mode:"photoreal"},qaChecklist:[],references:[]};
 assert.equal(completeness({...base,camera} as unknown as PublicCreativePlan,"image"),true);
 assert.equal(completeness({...base,camera} as unknown as PublicCreativePlan,"video"),false);
 assert.equal(completeness(undefined,"image"),null);
});
test("mustMention scoring folds Arabic letters, ZWNJ and case; mustNotMention reports violations",()=>{
 const r=scoreMentions(["نور طبیعی در بازار وکیل","هفت‌سین"],["بازار","هفت سین","كباب"],["سیاسی"]);
 assert.deepEqual(r.hits,["بازار","هفت سین"]);assert.deepEqual(r.misses,["كباب"]);assert.ok(Math.abs(r.hitRate!-2/3)<1e-9);assert.deepEqual(r.violations,[]);
 assert.equal(scoreMentions(["x"],undefined,undefined).hitRate,null);
 assert.deepEqual(scoreMentions(["متن سیاسی"],[],["سیاسی","ورزشی"]).violations,["سیاسی"]);
 assert.deepEqual(scoreMentions(["Saffron"],["saffron"],[]).misses,[]);
});
test("cost estimate uses the price table and is null for unknown models or missing usage",()=>{
 assert.ok(Math.abs(estimateCostUsd("gpt-6.1-sol",{input_tokens:1_000_000,output_tokens:1_000_000})!-12)<1e-9);
 assert.ok(Math.abs(estimateCostUsd("claude-haiku-5-5",{input_tokens:10000,output_tokens:2000})!-(0.001+0.001))<1e-9);
 assert.equal(estimateCostUsd("mystery",{input_tokens:1,output_tokens:1}),null);assert.equal(estimateCostUsd("gpt-6-luna",null),null);
 assert.deepEqual(normalizeUsage({input_tokens:5,output_tokens:7,cache_read_input_tokens:3}),{input_tokens:8,output_tokens:7});
 assert.equal(normalizeUsage(undefined),null);assert.equal(normalizeUsage({foo:1}),null);
});
test("percentile and mean",()=>{
 assert.equal(percentile([],50),null);assert.equal(percentile([5,1,3,2,4],50),3);assert.equal(percentile([1,2,3,4,5,6,7,8,9,10],95),10);assert.equal(mean([1,2,3]),2);assert.equal(mean([]),null);
});
test("env parser handles comments, export, quotes; applyEnv never overrides and returns only names",()=>{
 const parsed=parseEnvFile("# c\nA=1\nexport B=\"two words\"\nC='x' \nD=val # trailing\n\nbad line\nE=\n");
 assert.deepEqual(parsed,{A:"1",B:"two words",C:"x",D:"val",E:""});
 const env:Record<string,string|undefined>={A:"keep"};
 const names=applyEnv(parsed,env);
 assert.deepEqual(names.sort(),["B","C","D"]);assert.equal(env.A,"keep");assert.equal(env.E,undefined);
 assert.ok(!JSON.stringify(names).includes("two words"),"values are never returned as names");
});
test("the prompt file is valid: 30 unique prompts, accepted by the turn schema, no political terms",()=>{
 const prompts=EvalPromptsSchema.parse(JSON.parse(readFileSync(new URL("../evals/planner/prompts.fa.json",import.meta.url),"utf8")));
 assert.equal(prompts.length,30);for(const p of prompts)CreativeTurnInputSchema.parse(p.input);
 assert.ok(prompts.some(p=>p.expect.kind==="video")&&prompts.some(p=>p.input.characterRef)&&prompts.some(p=>p.input.style==="cartoon"));
});
const run=(o:Partial<EvalRun>):EvalRun=>({promptId:"p",model:"m1",provider:"x",ok:true,status:"planned",latencyMs:100,usage:{input_tokens:100,output_tokens:50},costUsdEstimate:0.01,corrections:0,leakFiltered:false,persianRatio:1,complete:true,mentionHitRate:1,mentionMisses:[],mustNotViolations:[],planChars:10,...o});
test("summaries count failures separately and the report is self-contained RTL HTML with escaped text",()=>{
 const runs=[run({latencyMs:100}),run({latencyMs:300,promptId:"q"}),run({ok:false,latencyMs:9999,promptId:"r",fallbackReason:"invalid_output"}),run({model:"m2",costUsdEstimate:null})];
 const [a,b]=summarize(runs);
 assert.equal(a.runs,3);assert.equal(a.ok,2);assert.equal(a.failures,1);assert.equal(a.latencyP95Ms,300,"failed run latency is excluded");assert.ok(Math.abs(a.costUsdEstimateTotal!-0.03)<1e-9);
 assert.equal(b.costUsdEstimateTotal,null);
 const html=renderReport(runs,[{id:"p",input:{text:"<script>alert(1)</script> مثال"},expect:{kind:"image"}}],{generatedAt:"t",models:["m1","m2"]});
 assert.match(html,/dir="rtl"/);assert.match(html,/prefers-color-scheme: ?dark/);assert.ok(!html.includes("<script"),"no scripts and prompt text is escaped");assert.ok(!/https?:\/\//.test(html),"no external assets");
 assert.equal((html.match(/type="number"/g)??[]).length,2,"a rating box per model per prompt");
});
test("per-class table and suggested overrides rank by ok-rate, corrections, Persian, mentions, then cost; nothing is written",()=>{
 const r=(model:string,taskClass:string,o:Partial<EvalRun>={})=>run({model,taskClass,promptId:model+taskClass+Math.random(),...o});
 const runs=[
  r("claude-haiku-5-5","video",{ok:false,fallbackReason:"invalid_output"}),r("claude-haiku-5-5","video"),
  r("gpt-6-luna","video"),r("gpt-6-luna","video"),
  r("claude-sonnet-5-5","video",{corrections:2}),r("claude-sonnet-5-5","video",{corrections:2}),
  r("gpt-6.1-sol","edit",{costUsdEstimate:0.02}),r("claude-sonnet-5-5","edit",{costUsdEstimate:0.01}),r("claude-opus-5-5","edit",{ok:false}),
  run({model:"router",chosenModel:"gpt-6-luna",taskClass:"lip_sync"}),run({model:"router",chosenModel:null,ok:false,taskClass:"lip_sync"})
 ];
 const t=classTable(runs),row=(c:string,m:string)=>t.find(x=>x.taskClass===c&&x.model===m)!;
 assert.equal(row("video","claude-haiku-5-5").okRate,0.5);assert.equal(row("video","gpt-6-luna").okRate,1);assert.equal(row("lip_sync","gpt-6-luna").runs,1,"route runs are grouped by the model that produced the plan");
 const sug=suggestClassOverrides(runs);
 assert.deepEqual(sug.video,["gpt-6-luna","claude-sonnet-5-5"],"ok-rate first, then fewer corrections");
 assert.deepEqual(sug.edit,["claude-sonnet-5-5","gpt-6.1-sol"],"equal quality: cheaper first; the failed model is excluded");
 assert.deepEqual(sug.lip_sync,["gpt-6-luna"],"a routed run counts for the model that produced the plan; the unrouted fallback row is never a model");
 assert.ok(compareRows(row("video","gpt-6-luna"),row("video","claude-haiku-5-5"))<0);
 const html=renderReport(runs,[],{generatedAt:"t",models:["router"]});
 assert.match(html,/classOverrides/);assert.match(html,/به تفکیک نوع کار/);
});
