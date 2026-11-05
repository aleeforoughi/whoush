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
 assert.deepEqual(lines.slice(0,3),["زاویهٔ دوربین: هم‌سطح چشم (0°) ← زاویهٔ پایین (-25°)","کادر: نزدیک متوسط (زوم 3.4×) ← تمام‌قد (زوم 1×)","نسبت تصویر: 4:5 ← 9:16"]);
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

test("Whoush finds the main props in the brief and lays them out for the camera; the environment is the backdrop, never a prop",async()=>{
 const {detectProps,describeLayoutFa,describeLayoutEn}=await import("../lib/staging");
 const props=detectProps(normalizePersian("یه زن کنار یه ماشین قرمز زیر یه درخت توی جاده‌ی کوهستانی"),"person");
 assert.deepEqual(props.map(p=>[p.kind,p.label,p.main??false]),[["person","زن",true],["vehicle","ماشین",false],["tree","درخت",false]]);
 assert.deepEqual([props[0].x,props[0].z],[0,-0.25],"the main subject centre front");assert.ok(props[1].x>0&&props[2].x<0,"the others alternate right and left");
 assert.deepEqual(detectProps(normalizePersian("a misty mountain lake at dawn"),"environment"),[],"an environment-only scene has no props");
 assert.equal(detectProps(normalizePersian("a cat next to a bottle"),"animal")[0].kind,"animal");
 assert.equal(describeLayoutFa(props),"چیدمان: زن (اصلی) وسط، وسط عمق؛ ماشین سمت راست، وسط عمق؛ درخت سمت چپ، عقب");
 assert.equal(describeLayoutEn(props),"Layout: person (main subject) centre midground; vehicle right midground; tree left background.");
 const moved=props.map((p,i)=>i===1?{...p,x:-0.7,z:0.8,y:0.4}:p);
 assert.deepEqual(describeStagingChangesFa({...base,props},{...base,props:moved}),["ماشین: سمت راست، وسط عمق ← سمت چپ، عقب، بالاتر از زمین"]);
 assert.deepEqual(describeStagingChangesFa({...base,props},{...base,props:props.slice(0,2)}),["حذف: درخت"]);
 const r=planned(await orchestrateCreativeTurn({text:"a woman next to a red car under a tree",stagingOverride:{...base,props:moved}}));
 assert.ok(getPrivateMediaPrompt(r.turnId)!.includes("Layout: person (main subject) centre midground; vehicle left background, raised; tree left background."));
 assert.ok(r.plan.hardConstraints.some(c=>c.includes("چیدمان: زن (اصلی)")));
 const d=planned(await orchestrateCreativeTurn({text:"a woman next to a red car under a tree"}));
 assert.deepEqual(d.plan.staging?.props?.map(p=>p.kind),["person","vehicle","tree"]);
 assert.ok(!CreativeTurnInputSchema.safeParse({text:"x",stagingOverride:{...base,props:Array.from({length:7},()=>props[0])}}).success,"at most six props");
});

test("a planner's crowded or all-lifted props are tidied; the user's arrangement never is",async()=>{
 const {tidyProps}=await import("../lib/staging");
 const stacked=[{kind:"tree" as const,label:"درخت",x:0,z:0,y:0.6},{kind:"person" as const,label:"زن",x:0,z:0,y:0.5,main:true},{kind:"vehicle" as const,label:"ماشین",x:0.05,z:0,y:0.4}];
 const t=tidyProps(stacked)!;
 assert.deepEqual(t.map(p=>[p.label,p.x,p.z,p.y]),[["زن",0,-0.25,0],["درخت",0.55,0.25,0],["ماشین",-0.55,0.35,0]]);
 const fine=[{kind:"person" as const,label:"زن",x:-0.3,z:-0.4,y:0,main:true},{kind:"animal" as const,label:"پرنده",x:0.5,z:0.2,y:0.8}];
 assert.deepEqual(tidyProps(fine),fine,"spread out, one lifted bird: kept");
});

test("dragging a prop in the camera view: the ground point under the pointer is the exact inverse of where the prop is drawn; up is further back",async()=>{
 const {propInView,groundFromView}=await import("../lib/staging");
 for(const [x,z] of [[0,-0.25],[0.55,0.25],[-0.7,0.8],[1,-1],[-1,1]]){
  const v=propInView({kind:"vehicle",x,z,y:0},150,84,80);
  assert.deepEqual(groundFromView(v.x,v.groundY,150,84),{x,z},x+","+z);
 }
 const a=propInView({kind:"vehicle",x:0,z:0,y:0},150,84,80),up=groundFromView(a.x+20,a.groundY-10,150,84);
 assert.ok(up.x>0.3&&up.z>0,"right and up: to the right and further back "+JSON.stringify(up));
 const lifted=propInView({kind:"person",x:0,z:0,y:0.5},150,84,80);assert.ok(lifted.y<lifted.groundY,"a lifted prop is drawn above its ground point");
});

test("smooth adjustments: exact camera elevation, zoom and light angle; the names are the nearest description; small moves still count as changes",async()=>{
 const {nearestShot,scaleFromSlider,sliderFromScale,zoomFactor}=await import("../lib/staging");
 assert.equal(nearestShot(0.31),"medium_close_up");assert.equal(nearestShot(3),"wide");
 assert.equal(scaleFromSlider(0),0.09);assert.equal(scaleFromSlider(1),5);assert.ok(Math.abs(sliderFromScale(scaleFromSlider(0.37))-0.37)<0.001);
 const smooth={...base,cameraAngle:"high" as const,cameraElevation:22,shotScale:0.7,lights:[{...base.lights[0],angle:150},base.lights[1]]};
 const lines=describeStagingChangesFa(base,smooth);
 assert.ok(lines[0]==="زاویهٔ دوربین: هم‌سطح چشم (0°) ← زاویهٔ بالا (22°)",lines[0]);assert.ok(lines[1].startsWith("کادر: نزدیک متوسط (زوم 3.4×) ← نزدیک متوسط (زوم "+zoomFactor(smooth)+"×)"),lines[1]);
 assert.ok(lines.some(l=>l.includes("(150°)")),JSON.stringify(lines));
 assert.deepEqual(describeStagingChangesFa(smooth,{...smooth,cameraElevation:23}),[],"under two degrees is not a change");
 assert.ok(describeStagingEn(smooth).includes("(22° from eye level)")&&describeStagingEn(smooth).includes("(150° in top view)"));
});
