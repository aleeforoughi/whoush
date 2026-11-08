import {test} from "node:test";
import assert from "node:assert/strict";
import {soundLineFa,soundWanted} from "../lib/sound-intent";
import {configurationProblem,findMediaModel} from "../lib/catalog";
import {orchestrateCreativeTurn,deterministicPlanner,type OrchestratorResult} from "../lib/orchestrator";

test("owner (2026-11-08): the brief's words about sound set the toggle; silence wins",()=>{
 for(const t of ["یه ویدیوی بی‌صدا از دریا","ویدیو بدون صدا","a silent video of a forest","no sound please","صدا نداشته باشه"])assert.equal(soundWanted(t),false,t);
 for(const t of ["یه ویدیو با صدا از بازار","با دیالوگ","with sound","یه کلیپ با آهنگ شاد"])assert.equal(soundWanted(t),true,t);
 assert.equal(soundWanted("یه ویدیو از شهر"),undefined);
 assert.equal(soundWanted("با آهنگ ولی بی‌صدا"),false);
 assert.match(soundLineFa(undefined,"fa"),/صدا هم داشته باشه؟/);assert.equal(soundLineFa(false,"fa"),"بی‌صدا می‌سازمش.");
});
test("sound in the signed configuration only for SKUs with checked sound",()=>{
 assert.equal(configurationProblem(findMediaModel("seedance-2-5-5s")!,{audio:true}),undefined);
 assert.equal(configurationProblem(findMediaModel("seedance-2-5-5s")!,{audio:false}),undefined);
 assert.ok(configurationProblem(findMediaModel("kling-3-0-720p-5s")!,{audio:true}));
 assert.equal(configurationProblem(findMediaModel("kling-3-0-720p-5s")!,{audio:false}),undefined,"asking for silence is always fine");
});
const video=async(text:string,ready:boolean)=>{const r=await orchestrateCreativeTurn({text},{planner:deterministicPlanner,audioCheckAvailable:async()=>ready});
 assert.equal(r.status,"planned",JSON.stringify(r));return r as Extract<OrchestratorResult,{status:"planned"}>;};
test("a video proposal offers the toggle and Whoush asks about sound, only when the check can run",async()=>{
 const asked=await video("یه ویدیو ۵ ثانیه‌ای از شهر با seedance",true);
 assert.ok(asked.proposal.suggestions.some(s=>s.audio));assert.equal(asked.proposal.soundWanted,undefined);
 assert.ok(asked.proposal.suggestions.find(s=>s.modelId===asked.proposal.selectedModelId)?.audio,"Seedance, as named, has checked sound");
 assert.match(asked.proposal.message,/صدا هم داشته باشه؟/);
 const silent=await video("یه ویدیوی بی‌صدا از شهر با seedance",true);
 assert.equal(silent.proposal.soundWanted,false);
 const off=await video("یه ویدیو ۵ ثانیه‌ای از شهر با seedance",false);
 assert.ok(!off.proposal.suggestions.some(s=>s.audio),"no check here: no toggle, the video stays silent");assert.doesNotMatch(off.proposal.message,/صدا/);
});
