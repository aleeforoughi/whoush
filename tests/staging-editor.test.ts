import {test,beforeEach,afterEach} from "node:test";
import assert from "node:assert/strict";
import {describeStagingChangesFa,describeStagingEn,describeStagingFa,detectSubject,snapDirection,snapElevation,stepAngle,stepDirection,SUBJECT_ASSETS,LIGHT_ASSETS} from "../lib/staging";
import {orchestrateCreativeTurn,getPrivateMediaPrompt,type OrchestratorResult} from "../lib/orchestrator";
import {resetRouterStateForTests} from "../lib/llm-routing";
import {buildBriefMessage} from "../lib/planner-brief";
import {CreativeTurnInputSchema,type Staging} from "../lib/creative-plan";
import {VISUALS} from "../lib/visual-assets";
import {normalizePersian} from "../lib/safety";

const ENV_KEYS=["LLM_PROVIDER_AUTHORIZED","ALLOW_LIVE_LLM","ANTHROPIC_API_KEY","OPENAI_API_KEY"];
let saved:Record<string,string|undefined>={};
beforeEach(()=>{resetRouterStateForTests();saved=Object.fromEntries(ENV_KEYS.map(k=>[k,process.env[k]]));for(const k of ENV_KEYS)delete process.env[k];});
afterEach(()=>{for(const k of ENV_KEYS){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}});

test("dragging snaps: the camera to the nearest of five angles, a light to the nearest of eight directions; arrow keys step and clamp",()=>{
 assert.equal(snapElevation(3),"eye_level");assert.equal(snapElevation(28),"high");assert.equal(snapElevation(70),"birds_eye");assert.equal(snapElevation(-18),"low");assert.equal(snapElevation(-80),"worms_eye");
 assert.equal(stepAngle("eye_level",1),"high");assert.equal(stepAngle("birds_eye",1),"birds_eye");assert.equal(stepAngle("dutch",-1),"low");
 assert.equal(snapDirection(100),"front");assert.equal(snapDirection(-170),"left");assert.equal(snapDirection(300),"back_right");assert.equal(snapDirection(359),"right");
 assert.equal(stepDirection("front",1),"front_left");assert.equal(stepDirection("right",-1),"back_right");assert.equal(stepDirection("top",1),"top");
});
test("the scene follows the subject: people, animals, vehicles, objects, or the environment alone",()=>{
 const s=(t:string)=>detectSubject(normalizePersian(t));
 assert.equal(s("portrait of an old fisherman"),"person");assert.equal(s("یه گربه روی پشت‌بوم"),"animal");assert.equal(s("a red car on a coastal road"),"vehicle");
 assert.equal(s("عکس محصول از یه بطری عطر"),"object");assert.equal(s("a mountain lake at sunrise"),"environment");assert.equal(detectSubject("a lake",true),"person","a character means a person");
});
test("every subject and light source has its assets in the pack",()=>{
 for(const v of Object.values(SUBJECT_ASSETS))for(const id of Object.values(v))assert.ok(VISUALS[id],id);
 for(const id of Object.values(LIGHT_ASSETS))assert.ok(VISUALS[id],id);
 assert.ok(VISUALS["camera-side"]&&VISUALS["camera-top"]&&VISUALS["env-tree"]&&VISUALS["env-building"]);
 for(const a of Object.values(VISUALS))assert.match(a.src,/^\/visuals\/[a-z-]+\.png$/);
});

const base:Staging={subject:"person",cameraAngle:"eye_level",shotSize:"medium_close_up",lights:[{role:"key",direction:"front_left",height:"high",quality:"soft",source:"softbox",colorTemperatureK:5600},{role:"fill",direction:"front_right",height:"eye",quality:"soft",source:"softbox",colorTemperatureK:5600}]};
const edited:Staging={...base,cameraAngle:"low",shotSize:"full",lights:[{...base.lights[0],direction:"left",colorTemperatureK:3200,quality:"hard"},{role:"rim",direction:"back_right",height:"high",quality:"hard",source:"neon",colorTemperatureK:6500,colorHex:"#4f8cff"}]};
test("what the user changed is written out for the chat and for Whoush",()=>{
 const lines=describeStagingChangesFa(base,edited,"4:5","9:16");
 assert.deepEqual(lines.slice(0,3),["زاویهٔ دوربین: هم‌سطح چشم ← زاویهٔ پایین","کادر: نزدیک متوسط ← تمام‌قد","نسبت تصویر: 4:5 ← 9:16"]);
 assert.ok(lines[3].startsWith("نور اصلی: جهت جلو، چپ ← از چپ")&&lines[3].includes("5600 ← 3200 کلوین"),lines[3]);
 assert.ok(lines[4].startsWith("نور پشت: نقش نور پرکننده ← نور پشت"),lines[4]);
 assert.deepEqual(describeStagingChangesFa(base,base),[]);
 assert.match(describeStagingEn(edited),/^Staging: low angle camera, full shot, centred in frame; key light: hard softbox from left/);
 assert.ok(describeStagingFa(edited).includes("زاویهٔ پایین"));
});
const planned=(r:OrchestratorResult)=>{assert.equal(r.status,"planned",JSON.stringify(r));return r as Extract<OrchestratorResult,{status:"planned"}>;};
test("an arranged scene is applied exactly: staging, a hard constraint, the provider prompt and the aspect ratio",async()=>{
 const r=planned(await orchestrateCreativeTurn({text:"portrait of an old fisherman by the sea",stagingOverride:edited,aspectOverride:"9:16"}));
 assert.deepEqual(r.plan.staging,edited);assert.equal(r.plan.camera?.aspectRatio,"9:16");
 assert.ok(r.plan.hardConstraints.some(c=>c.startsWith("صحنهٔ تنظیم‌شده:")&&c.includes("زاویهٔ پایین")));
 const prompt=getPrivateMediaPrompt(r.turnId)!;assert.ok(prompt.includes("Staging: low angle camera, full shot")&&prompt.includes("Aspect ratio 9:16."),prompt);
 assert.ok(!CreativeTurnInputSchema.safeParse({text:"x",aspectOverride:"7:3"}).success);
 assert.ok(!CreativeTurnInputSchema.safeParse({text:"x",stagingOverride:{...edited,cameraAngle:"sideways"}}).success);
 assert.ok(buildBriefMessage("x",[],[],[],"fa",edited).endsWith("<staging_override>"+JSON.stringify(edited)+"</staging_override>"));
});

test("the crop: where the subject sits in the frame, in words for Whoush and the provider, and as a change line",async()=>{
 const {placementFa,placementEn}=await import("../lib/staging");
 assert.equal(placementFa(undefined),"وسط قاب");assert.equal(placementFa({x:0.05,y:-0.05}),"وسط قاب");
 assert.equal(placementFa({x:-1/3,y:1/3}),"سمت چپ قاب، یک‌سوم پایین");assert.equal(placementFa({x:0,y:-0.4}),"وسط افقی، یک‌سوم بالا");
 assert.equal(placementEn({x:1/3,y:0}),"subject placed on the right third");
 const moved={...base,framing:{x:-1/3,y:0}};
 assert.deepEqual(describeStagingChangesFa(base,moved),["جای سوژه: وسط قاب ← سمت چپ قاب"]);
 assert.ok(describeStagingEn(moved).includes("subject placed on the left third"));
 const r=planned(await orchestrateCreativeTurn({text:"portrait of a woman in a garden",stagingOverride:moved}));
 assert.deepEqual(r.plan.staging?.framing,{x:-1/3,y:0});assert.ok(getPrivateMediaPrompt(r.turnId)!.includes("subject placed on the left third"));
});
