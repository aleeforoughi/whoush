import {test,beforeEach,afterEach} from "node:test";
import assert from "node:assert/strict";
import {faText} from "../lib/format";
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
 for(const v of Object.values(SUBJECT_ASSETS))for(const id of Object.values(v!))assert.ok(VISUALS[id],id);
 for(const id of Object.values(LIGHT_ASSETS))assert.ok(VISUALS[id],id);
 assert.ok(VISUALS["camera-side"]&&VISUALS["camera-top"]&&VISUALS["env-mountains"]);
 for(const a of Object.values(VISUALS))assert.match(a.src,/^\/visuals\/[a-z0-9-]+\.png$/);
});

const base:Staging={subject:"person",cameraAngle:"eye_level",shotSize:"medium_close_up",lights:[{role:"key",direction:"front_left",height:"high",quality:"soft",source:"softbox",colorTemperatureK:5600},{role:"fill",direction:"front_right",height:"eye",quality:"soft",source:"softbox",colorTemperatureK:5600}]};
const edited:Staging={...base,cameraAngle:"low",shotSize:"full",lights:[{...base.lights[0],direction:"left",colorTemperatureK:3200,quality:"hard"},{role:"rim",direction:"back_right",height:"high",quality:"hard",source:"neon",colorTemperatureK:6500,colorHex:"#4f8cff"}]};
test("what the user changed is written out for the chat and for Whoush",()=>{
 const lines=describeStagingChangesFa(base,edited,"4:5","9:16");
 assert.deepEqual(lines.slice(0,3),["زاویهٔ دوربین: هم‌سطح چشم (0°) ← زاویهٔ پایین (-25°)","کادر: نزدیک متوسط (زوم 3.4×) ← تمام‌قد (زوم 1×)","نسبت تصویر: 4:5 ← 9:16"].map(faText));
 assert.ok(lines[3].startsWith("نور اصلی: جهت جلو، چپ ← از چپ")&&lines[3].includes("۵۶۰۰ ← ۳۲۰۰ کلوین"),lines[3]);
 assert.ok(lines[4].startsWith("نور پشت: نقش نور پرکننده ← نور پشت"),lines[4]);
 assert.deepEqual(describeStagingChangesFa(base,base),[]);
 assert.match(describeStagingEn(edited),/^Staging: low angle camera, full shot, centred in frame; key light: hard softbox from frame left, level with the subject/);
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
 assert.equal(scaleFromSlider(0),0.04);assert.equal(scaleFromSlider(1),5);assert.ok(Math.abs(sliderFromScale(scaleFromSlider(0.37))-0.37)<0.001);
 const smooth={...base,cameraAngle:"high" as const,cameraElevation:22,shotScale:0.7,lights:[{...base.lights[0],angle:150},base.lights[1]]};
 const lines=describeStagingChangesFa(base,smooth);
 assert.ok(lines[0]===faText("زاویهٔ دوربین: هم‌سطح چشم (0°) ← زاویهٔ بالا (22°)"),lines[0]);assert.ok(lines[1].startsWith(faText("کادر: نزدیک متوسط (زوم 3.4×) ← نزدیک متوسط (زوم "+zoomFactor(smooth)+"×)")),lines[1]);
 assert.ok(lines.some(l=>l.includes("(۱۵۰°)")),JSON.stringify(lines));
 assert.deepEqual(describeStagingChangesFa(smooth,{...smooth,cameraElevation:23}),[],"under two degrees is not a change");
 assert.ok(describeStagingEn(smooth).includes("(22° from eye level)")&&describeStagingEn(smooth).includes("(60° around from the camera, toward frame left)"));
});

test("the user's own words win: angle, shot size, side and lighting cues override the planner's staging, and the scene always reaches the provider",async()=>{
 const {applyStagingCues}=await import("../lib/staging");
 const t=(x:string)=>applyStagingCues(base,normalizePersian(x));
 assert.equal(t("یه عکس از بالا از یه دریاچه").cameraAngle,"birds_eye");assert.equal(t("a low angle portrait").cameraAngle,"low");
 assert.equal(t("کلوزآپ از صورت").shotSize,"close_up");assert.equal(t("full body shot of a dancer").shotSize,"full");
 assert.deepEqual(t("زن سمت چپ کادر").framing,{x:-1/3,y:0});
 const back=t("پرتره ضدنور با نور طلایی غروب");assert.equal(back.lights[0].direction,"back");assert.equal(back.lights[0].source,"sun");assert.equal(back.lights[0].colorTemperatureK,3500);
 assert.equal(t("نور پنجره و حس آرام").lights[0].source,"window");
 assert.deepEqual(t("یه گربه"),{...base},"no cue, no change");
 assert.equal(applyStagingCues({...base,framing:{x:0.33,y:-0.2}},normalizePersian("یه گربه")).framing,undefined,"the frame is centred unless the user asks");
 // A planner that ignored «از بالا» is corrected, and the provider prompt carries the scene.
 const ignoring:import("../lib/creative-plan").PrivatePlanner=r=>{const {deterministicPlanner:d}=require("../lib/orchestrator") as typeof import("../lib/orchestrator");const p=structuredClone(d(r).plan);p.staging={...p.staging!,cameraAngle:"eye_level"};return {plan:p};};
 const r=planned(await orchestrateCreativeTurn({text:"یه عکس از بالا از یه دریاچه"},{planner:ignoring}));
 assert.equal(r.plan.staging?.cameraAngle,"birds_eye");assert.match(getPrivateMediaPrompt(r.turnId)!,/Scene \(must match\): Staging: bird's-eye \(top-down\) camera/);
});
test("«بساز» with an arranged scene: a new private turn with that scene, quoted on that turn; the original turn and unknown turns are safe",async()=>{
 const {deriveTurnWithStaging}=await import("../lib/orchestrator");
 const {POST:quote}=await import("../app/api/generation/quote/route");
 const r=planned(await orchestrateCreativeTurn({text:"portrait of a woman in a garden"}));
 const before=getPrivateMediaPrompt(r.turnId)!;
 const id=deriveTurnWithStaging(r.turnId,{...base,cameraAngle:"low",cameraElevation:-20},"9:16")!;
 assert.ok(id&&id!==r.turnId);assert.equal(getPrivateMediaPrompt(r.turnId),before,"the original turn is untouched");
 const derived=getPrivateMediaPrompt(id)!;
 // Compiled again from the turn's content: one scene, the new one; the planner's own camera and light words and the old scene are gone.
 assert.match(derived,/^Camera and light, exactly as arranged: Low-angle shot looking up at the subject\./);
 assert.match(derived,/Scene \(must match\): Staging: low angle camera \(-20° from eye level\)/);
 assert.equal(derived.split("Scene (must match)").length,2,"exactly one scene");
 assert.ok(!/eye level camera|Direction:|\b\d{2,3}mm, f\//.test(derived),derived);
 assert.ok(derived.includes("portrait of a woman in a garden"),"the content stays");
 const again=getPrivateMediaPrompt(deriveTurnWithStaging(id,{...base,cameraAngle:"high",cameraElevation:30},"1:1")!)!;
 assert.equal(again.split("Scene (must match)").length,2,"a second change replaces the scene, never stacks it");assert.ok(!again.includes("low angle camera"),again);
 assert.match(again,/Aspect ratio 1:1\.$/);
 assert.match(getPrivateMediaPrompt(id)!,/Aspect ratio 9:16\.$/);
 assert.equal(deriveTurnWithStaging("no-such-turn",base),undefined);
 const res=await quote(new Request("http://x/api/generation/quote",{method:"POST",body:JSON.stringify({modelId:r.proposal.selectedModelId,turnId:r.turnId,stagingOverride:{...base,cameraAngle:"low"}})}));
 assert.equal(res.status,200);const q=await res.json() as {token:string};assert.ok(q.token&&!("turnId" in q),"the derived turn stays inside the signed token");
 const bad=await quote(new Request("http://x/api/generation/quote",{method:"POST",body:JSON.stringify({modelId:r.proposal.selectedModelId,turnId:"no-such-turn",stagingOverride:base})}));
 assert.equal(bad.status,410);
});

test("the frame: centred on the main subject by default; any prop (the main one too) moves alone; out of frame equally on both sides; cuts are written out",async()=>{
 const {frameCamera,frameSize,propInView,propReach,propCuts,withFrameCuts,describeLayoutEn,propPlaceFa}=await import("../lib/staging");
 const person={kind:"person" as const,label:"زن",x:-0.4,z:-0.25,y:0,main:true},car={kind:"vehicle" as const,label:"ماشین",x:0.55,z:0.25,y:0};
 const s:Staging={...base,shotSize:"medium_close_up",props:[person,car]};
 const {W,H}=frameSize("16:9"),cam=frameCamera(s,s,W,H),v=propInView(person,W,H,cam.unitH);
 assert.ok(Math.abs(cam.toScreen(v.x,0)[0]-W/2)<0.01,"the main subject sits on the frame's centre line");
 const moved={...s,props:[{...person,x:0.3},car]},cam2=frameCamera(moved,s,W,H),vc=propInView(car,W,H,cam.unitH);
 assert.deepEqual(cam2.toScreen(vc.x,vc.groundY),cam.toScreen(vc.x,vc.groundY),"moving the main subject leaves the car where it is");
 for(const p of [person,car]){
  const r=propReach(p,s,s,"16:9"),pv=propInView(p,W,H,cam.unitH);
  const edge=(x:number)=>{const q=propInView({...p,x},W,H,cam.unitH);return cam.toScreen(q.x,q.groundY)[0];};
  // Equal within one step of the reach's rounding (0.01 stage units).
  const step=Math.abs(edge(r.xMax+0.01)-edge(r.xMax));
  assert.ok(Math.abs((0-edge(r.xMin))-(edge(r.xMax)-W))<step+0.1,"as far past the left edge as past the right ("+p.kind+")");
  assert.ok(edge(r.xMin)<0&&edge(r.xMax)>W&&pv.h>0);
 }
 const full={...s,shotSize:"full" as const};
 assert.ok(propReach(car,full,full,"16:9").zMin<-1,"in a full shot a prop can come closer than the stage, into the bottom edge");
 const out={...s,props:[person,{...car,x:propReach(car,s,s,"16:9").xMax}]};
 assert.deepEqual(propCuts(out.props[1],out,s,"16:9"),["right"]);
 const cut=withFrameCuts(out,s,"16:9");
 assert.match(describeLayoutEn(cut.props),/vehicle partly out of frame on the right/);
 assert.match(propPlaceFa(cut.props![1]),/نیمه بیرون از کادر، سمت راست/);
 const wide={...s,shotSize:"full" as const};assert.equal(withFrameCuts(wide,wide,"16:9").props![1].cut,undefined,"inside the frame: no cut");
 assert.ok(CreativeTurnInputSchema.shape.stagingOverride.safeParse(cut).success,"a cut scene is a valid override");
});

test("the camera orbits 360° around the main subject: props swing around it and show another side, lights stay put in the world, and back again is exact",async()=>{
 const {orbitCamera,facingOf,lightAngleOf,describeStagingEn,describeStagingChangesFa,applyStagingCues}=await import("../lib/staging");
 const person={kind:"person" as const,label:"زن",x:0,z:-0.25,y:0,main:true},tree={kind:"tree" as const,label:"درخت",x:0,z:0.75,y:0};
 const s:Staging={...base,props:[person,tree],lights:[{...base.lights[0],direction:"right",angle:0}]};
 const side=orbitCamera(s,90);
 assert.equal(side.cameraAzimuth,90);
 assert.deepEqual([side.props![0].x,side.props![0].z],[0,-0.25],"the main subject is the pivot");
 assert.ok(Math.abs(side.props![1].x-1)<1e-9&&Math.abs(side.props![1].z+0.25)<1e-9,"the tree behind it swings to frame right");
 assert.equal(side.props![0].facing,-90,"the subject now shows its side");
 assert.equal(lightAngleOf(side.lights[0]),90,"a light on the right is now between the camera and the subject");assert.equal(side.lights[0].direction,"front");
 const back=orbitCamera(side,-90);
 assert.ok(Math.abs(back.props![1].x)<1e-9&&Math.abs(back.props![1].z-0.75)<1e-9&&Math.abs(back.props![0].facing!)<1e-9,"orbiting back is exact");
 assert.equal(orbitCamera(s,180).cameraAzimuth,180);assert.equal(orbitCamera(orbitCamera(s,170),20).cameraAzimuth,-170,"wraps around");
 assert.match(describeStagingEn(orbitCamera(s,180)),/camera orbited behind the main subject/);
 assert.match(describeStagingEn(orbitCamera(s,180)),/person \(main subject\) .*back to the camera/);
 assert.ok(describeStagingChangesFa(s,side).some(l=>l.startsWith("چرخش دوربین")));
 assert.equal(facingOf({kind:"vehicle",label:"ماشین",x:0,z:0,y:0}),90,"vehicles are seen side on by default");
 assert.equal(applyStagingCues(s,normalizePersian("عکس زن از پشت سر")).props![0].facing,180);
 assert.equal(applyStagingCues(s,normalizePersian("پرتره ضدنور با نور از پشت")).props![0].facing,undefined,"a light from behind is not the subject's back");
});

test("references map to the props they show and name them on the canvas: #زن:تصویر-۱",async()=>{
 const {mapReferences,propTags,describeLayoutFa,describeLayoutEn}=await import("../lib/staging");
 const props=[{kind:"person" as const,label:"زن",x:0,z:-0.25,y:0,main:true},{kind:"vehicle" as const,label:"ماشین قرمز",x:0.55,z:0.25,y:0},{kind:"tree" as const,label:"درخت",x:-0.5,z:0.5,y:0},{kind:"tree" as const,label:"درخت",x:0.7,z:0.7,y:0}];
 const mapped=mapReferences(props,[{tag:"image1",kind:"image",role:"character"},{tag:"image2",kind:"image",role:"object"},{tag:"image3",kind:"image",role:"environment"}])!;
 assert.deepEqual(mapped.map(p=>p.refs),[["image1"],["image2"],undefined,undefined]);
 assert.deepEqual(propTags(mapped,true),["#زن:تصویر-۱","#ماشین-قرمز:تصویر-۲","#درخت","#درخت-۲"]);
 assert.deepEqual(propTags(mapped),["#زن","#ماشین-قرمز","#درخت","#درخت-۲"]);
 assert.match(describeLayoutFa(mapped),/زن \(مثل #تصویر-۱\)/);assert.match(describeLayoutEn(mapped),/person \(looks like the attached reference\)/);
 assert.equal((props[0] as {refs?:string[]}).refs,undefined,"the planner's props are not changed in place");
});

test("props and lights by tag in the chat: #زن is a badge, «:» maps it to an image (#زن:تصویر-۱), and Whoush applies typed mappings before its own",async()=>{
 const {splitMentions,mentionTrigger,propMention,propMentionParts,fileTagOf,parseMentions}=await import("../lib/attachments");
 const {editorSegments}=await import("../lib/mention-editor");
 const {typedMappings,expandMappings,applyTypedMappings,mapReferences,lightTags}=await import("../lib/staging");
 const scene=["#زن","#ماشین-قرمز","#درخت-۲","#نور-۱"];
 assert.equal(fileTagOf("تصویر-۱"),"image1");assert.equal(fileTagOf("تولید-۱"),undefined,"a generation is not a reference");
 assert.equal(propMention("#زن","image1"),"#زن:تصویر-۱");assert.deepEqual(propMentionParts("#زن:تصویر-۱"),{prop:"#زن",file:"image1"});
 assert.deepEqual(splitMentions("#زن:تصویر-۱ رو ببر جلو و #ماشین-قرمز عقب، #نوروز",scene).filter(p=>"tag" in p).map(p=>(p as {tag:string}).tag),["#زن:تصویر-۱","#ماشین-قرمز"]);
 assert.deepEqual(parseMentions("#زن:تصویر-۱"),[],"without the scene, prop mentions are plain text for the server's file checks");
 const known=new Set([...scene,"image1"]);
 assert.deepEqual(editorSegments("#زن:تصویر-۱ جلو",known).segments,[{tag:"#زن:تصویر-۱"},{text:" جلو"}]);
 assert.deepEqual(editorSegments("#زن:تصویر-۲ جلو",known).segments,[{tag:"#زن"},{text:":تصویر-۲ جلو"}],"an unknown file keeps only the prop as a badge");
 assert.deepEqual(mentionTrigger("#زن:",4,scene),{start:0,query:"",prop:"#زن"},"«:» after a prop opens the references");
 assert.deepEqual(mentionTrigger("سلام #ما",8,scene),{start:5,query:"ما"},"«#» finds the scene's props");
 assert.equal(mentionTrigger("#نو",3,[]),undefined,"an ordinary hashtag is not a trigger");
 assert.deepEqual(lightTags([...base.lights,...base.lights]).slice(0,2),["#نور-۱","#نور-۲"]);
 // Whoush: typed mappings first, then its own for the rest.
 const text="#زن:تصویر-۲ کنار #ماشین-قرمز";
 assert.deepEqual(typedMappings(text),[{prop:"#زن",file:"image2"}]);
 assert.equal(expandMappings(text),"#زن (#تصویر-۲) کنار #ماشین-قرمز");
 const props=[{kind:"person" as const,label:"زن",x:0,z:-0.25,y:0,main:true,refs:["image1"]},{kind:"vehicle" as const,label:"ماشین قرمز",x:0.5,z:0.2,y:0}];
 const typed=applyTypedMappings(props,typedMappings(text))!;
 assert.deepEqual(typed[0].refs,["image1","image2"]);
 const auto=mapReferences(applyTypedMappings(props.map(p=>({...p,refs:undefined})),[{prop:"#ماشین-قرمز",file:"image1"}]),[{tag:"image1",kind:"image",role:"character"}])!;
 assert.deepEqual(auto.map(p=>p.refs),[undefined,["image1"]],"a typed mapping wins: Whoush does not also map that file");
});

test("a brief with a typed mapping reaches the planner as an ordinary mention and the scene shows it",async()=>{
 // Media review is not on yet, so a brief with an image is planned but not offered; the plan is still shown with its scene.
 const r=await orchestrateCreativeTurn({text:"#زن:تصویر-۱ کنار یک ماشین قرمز",attachments:[{id:crypto.randomUUID(),tag:"image1",kind:"image",mime:"image/png",bytes:1,sha256:"a".repeat(64),role:"character"}]});
 assert.ok(r.status==="planned"||r.status==="unsupported",JSON.stringify(r));
 const plan=(r as {plan:import("../lib/creative-plan").PublicCreativePlan}).plan;
 assert.deepEqual(plan.staging?.props?.find(x=>x.kind==="person")?.refs,["image1"]);
 assert.match(plan.intentSummaryFa,/#زن \(#تصویر-۱\)/,"the planner read the mapping as an ordinary mention");
});

test("Whoush picks the lens for the scene around its dominant subject: distance, detail, angle, other subjects and light",async()=>{
 const {lensFor,applyStagingCues,frameCamera,frameSize,propInView}=await import("../lib/staging");
 const woman={kind:"person" as const,label:"زن",x:0,z:-0.25,y:0,main:true};
 const s:Staging={...base,props:[woman]};
 const at=(p:Partial<Staging>)=>lensFor({...s,...p});
 assert.deepEqual([at({shotSize:"close_up",shotScale:undefined}).focalLengthMm,at({shotSize:"close_up",shotScale:undefined}).aperture],[85,"f/1.8"],"a close portrait: 85mm wide open for bokeh");
 assert.equal(at({shotSize:"wide"}).aperture,"f/8");assert.ok(at({shotSize:"wide"}).focalLengthMm<=24,"a wide shot: a wide lens, everything sharp");
 assert.equal(at({shotSize:"full",cameraElevation:-45}).focalLengthMm,at({shotSize:"full"}).focalLengthMm,"the camera's angle never changes the lens");
 const shoes=applyStagingCues({...s,shotSize:"close_up"},normalizePersian("کلوزآپ از کفش‌های زن روی آسفالت خیس"));
 assert.equal(shoes.focusDetail,"feet");
 const l=lensFor(shoes);assert.equal(l.focalLengthMm,100);assert.match(l.fa,/پاها و کفش/);assert.match(l.en,/feet and shoes/);
 const {W,H}=frameSize("16:9"),c=frameCamera(shoes,shoes,W,H),v=propInView(woman,W,H,c.unitH);
 assert.ok(Math.abs(c.F[1]-(v.y-v.h*0.05))<0.01,"the zoom centres on the feet, not the head");
 assert.equal(lensFor({...applyStagingCues({...s,shotSize:"extreme_close_up"},normalizePersian("ماکرو از چشم های زن"))}).macro,true,"eyes up close: macro");
 assert.equal(applyStagingCues(s,normalizePersian("an eye level shot of a woman")).focusDetail,undefined,"eye level is a camera height, not the eyes");
 const two=lensFor({...s,shotSize:"close_up",props:[woman,{kind:"vehicle",label:"ماشین",x:0.5,z:0.6,y:0}]});
 assert.equal(two.aperture,"f/5.6","another subject at another depth must stay sharp: stop down");
 const fire=lensFor({...s,shotSize:"full",lights:[{...base.lights[0],source:"fire",colorTemperatureK:1900}]});
 assert.equal(fire.iso,1600);assert.equal(fire.aperture,"f/2.0","low light: open up and raise the ISO");
});

test("light strength: each role has its usual strength; a set strength reaches Whoush, the provider and the change list",async()=>{
 const {intensityOf,describeStagingEn,describeStagingFa,describeStagingChangesFa}=await import("../lib/staging");
 assert.equal(intensityOf({...base.lights[0],role:"key"}),1);assert.ok(intensityOf({...base.lights[0],role:"fill"})<0.5,"a fill sits under the key");
 const dim:Staging={...base,lights:[{...base.lights[0],intensity:0.3}]};
 assert.match(describeStagingEn(dim),/30% strength/);assert.match(describeStagingFa(dim),/شدت ۳۰٪/);
 assert.ok(describeStagingChangesFa({...base,lights:[base.lights[0]]},dim).some(l=>l.includes("شدت")));
 assert.ok(CreativeTurnInputSchema.shape.stagingOverride.safeParse({...dim,subject:"person"}).success);
});

test("people read apart: a woman from her label gets her own figure; props of the same kind each get their own tint",async()=>{
 const {genderOf,propTints,topAssetOf}=await import("../lib/staging");
 const P=(label:string,kind:"person"|"vehicle"="person")=>({kind,label,x:0,z:0,y:0});
 assert.equal(genderOf(P("زن جوان")),"female");assert.equal(genderOf(P("دختر")),"female");assert.equal(genderOf(P("a young woman")),"female");
 assert.equal(genderOf(P("مرد")),"male");assert.equal(genderOf(P("آدم")),undefined);assert.equal(genderOf(P("ماشین","vehicle")),undefined);
 assert.equal(topAssetOf(P("مرد")),"human-top");
 const t=propTints([P("زن"),P("مرد"),P("ماشین","vehicle"),P("دختر"),P("پسر")]);
 assert.equal(t[2],undefined,"one car alone stays plain");
 const people=[t[0],t[1],t[3],t[4]];assert.ok(people.every(Boolean));assert.equal(new Set(people).size,4,"four people, four colours");
 assert.deepEqual(propTints([P("زن"),P("ماشین","vehicle")]),[undefined,undefined]);
});

test("the frame's centre point: on the dominant subject's face by default; moving it keeps the picture still; zoom pivots around it",async()=>{
 const {frameCamera,frameSize,moveFocusPoint,propInView}=await import("../lib/staging");
 const woman={kind:"person" as const,label:"زن",x:0.4,z:-0.25,y:0,main:true},car={kind:"vehicle" as const,label:"ماشین",x:-0.5,z:0.2,y:0};
 const s:Staging={...base,shotSize:"close_up",props:[woman,car]};
 const {W,H}=frameSize("16:9"),cam=frameCamera(s,s,W,H),v=propInView(woman,W,H,cam.unitH);
 const [hx,hy]=cam.toScreen(v.x,v.y-v.h*0.88);
 assert.ok(Math.abs(hx-W/2)<0.01&&Math.abs(hy-H/2)<0.5,"close in, the woman's face is the centre of the frame");
 const moved=moveFocusPoint(s,s,W,H,W*0.3,H*0.5),s2={...s,...moved},cam2=frameCamera(s2,s,W,H);
 const vc=propInView(car,W,H,cam.unitH);
 assert.deepEqual(cam2.toScreen(vc.x,vc.groundY).map(n=>Math.round(n*100)),cam.toScreen(vc.x,vc.groundY).map(n=>Math.round(n*100)),"moving the centre point never moves the picture");
 const [fx,fy]=cam2.toScreen(cam2.F[0],cam2.F[1]);assert.ok(Math.abs(fx-W*0.3)<0.01&&Math.abs(fy-H*0.5)<0.01,"the dot is where it was dropped");
 const zoomed=frameCamera({...s2,shotScale:0.1},s,W,H),[zx,zy]=zoomed.toScreen(cam2.F[0],cam2.F[1]);
 assert.ok(Math.abs(zx-W*0.3)<0.01&&Math.abs(zy-H*0.5)<0.01,"zooming keeps the centre point in place");
 const up=moveFocusPoint(s,s,W,H,W*0.5,H*0.2),s3={...s,...up},[ux,uy]=frameCamera({...s3,shotScale:2},s,W,H).toScreen(frameCamera(s3,s,W,H).F[0],frameCamera(s3,s,W,H).F[1]);
 assert.ok(Math.abs(ux-W*0.5)<0.01&&Math.abs(uy-H*0.2)<0.01,"also high in the frame, at any zoom");
});

test("Dutch angle, shot types, and the user's own lens and aperture (bokeh) reach Whoush and the provider; unset, Whoush picks",async()=>{
 const {lensFor,describeStagingEn,describeStagingFa,describeStagingChangesFa}=await import("../lib/staging");
 const s:Staging={...base,shotSize:"close_up",props:[{kind:"person",label:"زن",x:0,z:-0.25,y:0,main:true}]};
 const auto=lensFor(s);assert.deepEqual(auto.auto,{lens:true,aperture:true});
 const mine=lensFor({...s,lensMm:35,apertureF:11});
 assert.deepEqual([mine.focalLengthMm,mine.aperture,mine.deep,mine.auto.lens],[35,"f/11",true,false]);assert.match(mine.en,/Lens: 35mm at f\/11, deep focus/);
 const bokeh=lensFor({...s,apertureF:1.8});assert.equal(bokeh.deep,false);assert.match(bokeh.en,/bokeh/);
 const tilted:Staging={...s,cameraRoll:-20,cameraAngle:"dutch",shotStyle:"ots"};
 assert.match(describeStagingEn(tilted),/Dutch angle tilted 20° counter-clockwise, over-the-shoulder shot/);
 assert.match(describeStagingFa(tilted),/زاویهٔ کج \(داچ\) ۲۰ درجه، نمای روی شانه/);
 const lines=describeStagingChangesFa(s,{...tilted,lensMm:35});
 assert.ok(lines.some(l=>l.startsWith("زاویهٔ کج"))&&lines.some(l=>l.startsWith("نوع نما"))&&lines.some(l=>l.startsWith("لنز")));
 assert.ok(CreativeTurnInputSchema.shape.stagingOverride.safeParse({...tilted,lensMm:35,apertureF:1.8}).success);
});

test("the lens follows the camera's distance smoothly while it is Whoush's pick; a lens the user set stays",async()=>{
 const {lensFor}=await import("../lib/staging");
 const s:Staging={...base,props:[{kind:"person",label:"زن",x:0,z:-0.25,y:0,main:true}]};
 const at=(shotScale:number,o:Partial<Staging>={})=>lensFor({...s,shotScale,...o}).focalLengthMm;
 const steps=[0.32,0.4,0.5,0.7,0.9,1.1,1.6,2.4].map(x=>at(x));
 for(let i=1;i<steps.length;i++)assert.ok(steps[i]<=steps[i-1],"farther, wider: "+steps.join(","));
 assert.ok(new Set(steps).size>=6,"it moves with the distance, not in a few jumps: "+steps.join(","));
 assert.deepEqual([at(0.32),at(0.5),at(1.1),at(2.4)],[85,50,35,24]);
 assert.equal(at(0.7,{lensMm:135}),135);assert.equal(at(2,{lensMm:135}),135,"the user's lens stays at any distance");
});

test("Whoush Autopilot: on by default (Whoush's lens and aperture); off keeps the user's values and is written out",async()=>{
 const {lensFor,describeStagingChangesFa}=await import("../lib/staging");
 const s:Staging={...base,props:[{kind:"person",label:"زن",x:0,z:-0.25,y:0,main:true}]};
 assert.equal(s.autopilot,undefined);assert.deepEqual(lensFor(s).auto,{lens:true,aperture:true});
 const manual:Staging={...s,autopilot:false,lensMm:50,apertureF:2.8};
 assert.deepEqual([lensFor({...manual,shotScale:2}).focalLengthMm,lensFor({...manual,shotScale:2}).aperture],[50,"f/2.8"],"off: the values stay at any distance");
 assert.ok(describeStagingChangesFa(s,manual).includes("اتوپایلوت هووش: روشن ← خاموش"));
 assert.ok(CreativeTurnInputSchema.shape.stagingOverride.safeParse({...manual,subject:"person"}).success);
});

test("the camera diagrams' sight line ends at the frame's centre point: the face by default, the detail, or where the user moved it",async()=>{
 const {centerOnSubject,moveFocusPoint,frameSize,frameCamera}=await import("../lib/staging");
 const s:Staging={...base,shotSize:"medium",props:[{kind:"person",label:"زن",x:0,z:-0.25,y:0,main:true}]};
 assert.ok(Math.abs(centerOnSubject(s,s,"16:9").height-0.88)<0.01,"the face");
 assert.ok(Math.abs(centerOnSubject({...s,focusDetail:"feet"},s,"16:9").height-0.05)<0.01,"the feet when the shot is about the shoes");
 const {W,H}=frameSize("16:9"),c=frameCamera(s,s,W,H),[fx,fy]=c.toScreen(c.F[0],c.F[1]);
 const moved={...s,...moveFocusPoint(s,s,W,H,fx+20,fy+15)},o=centerOnSubject(moved,s,"16:9");
 assert.ok(o.height<0.88&&o.lateral>0,"moved down and right on the subject: "+JSON.stringify(o));
});

test("a follow-up about one part of the scene opens «بوم» on just that part: from its words, else from what changed",async()=>{
 const {followUpFocus,sectionsFromWords,stagingSections,applyStagingCues}=await import("../lib/staging");
 const s:Staging={...base,props:[{kind:"person",label:"زن",x:0,z:-0.25,y:0,main:true}]};
 assert.deepEqual(sectionsFromWords(normalizePersian("can we move the camera angle to hero view?")),["angle"]);
 assert.deepEqual(sectionsFromWords(normalizePersian("میتونی زاویه دوربین رو نزدیک تر کنی؟")),["distance"],"the action decides: closer is the distance");
 assert.deepEqual(sectionsFromWords(normalizePersian("دوربین رو یه کم ببر عقب‌تر")),["distance"]);
 assert.deepEqual(sectionsFromWords(normalizePersian("پس‌زمینه رو محو کن، لنز تله")),["lens"]);
 assert.deepEqual(sectionsFromWords(normalizePersian("نور رو گرم‌تر کن و زاویه دوربین رو پایین‌تر")),["angle","light"]);
 assert.deepEqual(sectionsFromWords(normalizePersian("یه کم کادر رو باز تر کن")),["frame"]);
 assert.equal(applyStagingCues(s,normalizePersian("camera to hero view please")).cameraAngle,"low","a hero view is a low angle");
 assert.deepEqual(followUpFocus(normalizePersian("hero view"),s,{...s,cameraAngle:"low"}),["angle"]);
 assert.deepEqual(followUpFocus(normalizePersian("یه بار دیگه"),s,{...s,lights:[{...s.lights[0],colorTemperatureK:3000}]}),["light"],"no words: what changed");
 assert.equal(followUpFocus(normalizePersian("hero view"),undefined,s),undefined,"a first generation shows the whole canvas");
 assert.equal(followUpFocus(normalizePersian("change the angle, zoom in, a longer lens, a new framing and warmer light"),s,s),undefined,"everything: the whole canvas");
 assert.deepEqual(stagingSections(s,{...s,shotSize:"wide"}),["distance"]);
 const {expandFocus}=await import("../lib/staging");assert.deepEqual(expandFocus(["camera"]),["angle","distance","lens"],"an older saved focus still opens");
});

test("the frame is a lo-fi previz from one physical camera: lens perspective, depth of field, horizon tilt, Dutch roll",async()=>{
 const {physicalCamera,lensSizeFactor,backdropFactor,blurAt,horizonShift,frameCamera,frameSize,moveFocusPoint}=await import("../lib/staging");
 const woman={kind:"person" as const,label:"زن",x:0,z:-0.25,y:0,main:true},tree={kind:"tree" as const,label:"درخت",x:0.5,z:0.75,y:0};
 const s:Staging={...base,shotSize:"medium",props:[woman,tree]};
 const at=(o:Partial<Staging>)=>({...s,...o});
 // A medium shot stays a medium shot at any lens: a longer lens moves the camera back.
 assert.ok(physicalCamera(at({lensMm:85})).d>physicalCamera(at({lensMm:24})).d*3);
 // Perspective: 35 mm is the plain drawing; a long lens makes the background loom and near things shrink; the main subject never changes.
 assert.ok(Math.abs(lensSizeFactor(at({lensMm:35}),0.75)-1)<0.01);
 assert.ok(lensSizeFactor(at({lensMm:135}),0.75)>1.3,"tele: the tree behind looms");
 assert.ok(lensSizeFactor(at({lensMm:18}),0.75)<0.8,"wide: it falls away");
 assert.ok(Math.abs(lensSizeFactor(at({lensMm:135}),-0.25)-1)<1e-9,"the main subject keeps its size");
 assert.ok(backdropFactor(at({lensMm:135}))>backdropFactor(at({lensMm:24})));
 // Depth of field: the subject is sharp; f/1.8 at 85 mm melts the background, f/8 at 24 mm keeps it (nearly) sharp; a macro distance blurs everything off the sliver.
 assert.ok(blurAt(at({lensMm:85,apertureF:1.8}),-0.25)<0.001);
 assert.ok(blurAt(at({lensMm:85,apertureF:1.8}),"backdrop")>blurAt(at({lensMm:24,apertureF:8}),"backdrop")*10);
 assert.ok(blurAt(at({lensMm:85,apertureF:1.8}),0.75)>blurAt(at({lensMm:85,apertureF:11}),0.75)*4,"stopping down sharpens");
 assert.ok(blurAt(at({shotScale:0.09,lensMm:100,apertureF:2.8}),0.1)>blurAt(at({lensMm:100,apertureF:2.8}),0.1),"macro: paper-thin focus");
 // Horizon: looking down lifts it, looking up drops it, eye level leaves it.
 assert.ok(horizonShift(at({cameraElevation:40}))<0&&horizonShift(at({cameraElevation:-30}))>0&&Math.abs(horizonShift(at({cameraElevation:0})))<1e-9);
 // Dutch roll: the picture rolls about the frame's centre; screen and world stay exact inverses, and a drag is unrolled.
 const {W,H}=frameSize("16:9"),c=frameCamera(at({cameraRoll:20,cameraAngle:"dutch"}),s,W,H),[sx,sy]=c.toScreen(40,30),[wx,wy]=c.toWorld(sx,sy);
 assert.ok(Math.abs(wx-40)<1e-9&&Math.abs(wy-30)<1e-9);
 const [ux,uy]=c.unroll(...([Math.cos(20*Math.PI/180)*10,Math.sin(20*Math.PI/180)*10] as [number,number]));assert.ok(Math.abs(ux-10)<1e-9&&Math.abs(uy)<1e-9,"dragging along the tilted frame is a straight move");
 const rolled=at({cameraRoll:20,cameraAngle:"dutch"}),mv={...rolled,...moveFocusPoint(rolled,s,W,H,W*0.3,H*0.4)};
 assert.deepEqual(frameCamera(mv,s,W,H).toScreen(10,20).map(n=>Math.round(n*1000)),frameCamera(rolled,s,W,H).toScreen(10,20).map(n=>Math.round(n*1000)),"moving the centre point never moves a rolled picture");
});

test("focus follows the centre point: on a prop it is sharp and the subject softens; above the horizon the background is sharp; the prompt says so",async()=>{
 const {blurAt,focusDepth,frameSize,frameCamera,moveFocusPoint,propInView,describeStagingEn}=await import("../lib/staging");
 const woman={kind:"person" as const,label:"زن",x:-0.3,z:-0.25,y:0,main:true},car={kind:"vehicle" as const,label:"ماشین",x:0.5,z:0.5,y:0};
 const s:Staging={...base,shotSize:"full",lensMm:85,apertureF:1.8,props:[woman,car]};
 const {W,H}=frameSize("16:9"),c=frameCamera(s,s,W,H),v=propInView(car,W,H,c.unitH),[sx,sy]=c.toScreen(v.x,v.groundY-v.h*0.3);
 const onCar={...s,...moveFocusPoint(s,s,W,H,sx,sy)};
 assert.equal(focusDepth(onCar,s,W,H),0.5,"the car is under the centre point");
 const fz=focusDepth(onCar,s,W,H);
 assert.ok(blurAt(onCar,0.5,fz)<0.001&&blurAt(onCar,-0.25,fz)>0.003,"the car sharp, the woman soft");
 assert.match(describeStagingEn(onCar),/focus set on the vehicle/);
 const [hx,hy]=c.toScreen(W*0.1,H*0.2),sky={...s,...moveFocusPoint(s,s,W,H,hx,hy)};
 assert.equal(focusDepth(sky,s,W,H),"backdrop");
 assert.equal(focusDepth(s,s,W,H),undefined,"no centre point moved: the main subject");
});

test("the place is detected from the brief and sets the background's distance: a room's wall is close (it blurs little), mountains are far",async()=>{
 const {applyStagingCues,blurAt,backdropFactor,describeStagingEn}=await import("../lib/staging");
 const s:Staging={...base,shotSize:"medium",lensMm:85,apertureF:1.8,props:[{kind:"person",label:"زن",x:0,z:-0.25,y:0,main:true}]};
 const env=(t:string)=>applyStagingCues(s,normalizePersian(t)).environment;
 assert.equal(env("پرتره یه زن توی کافه"),"room");assert.equal(env("a model in a photo studio"),"studio");assert.equal(env("یه مرد توی خیابون شب"),"street");
 assert.equal(env("کنار دریا موقع غروب"),"beach");assert.equal(env("a hiker in the forest"),"forest");assert.equal(env("کویر"),"desert");assert.equal(env("a portrait"),undefined);
 const room={...s,environment:"room" as const},open={...s,environment:"landscape" as const};
 assert.ok(blurAt(room,"backdrop")<blurAt(open,"backdrop"),"a near wall is less blurred than far mountains");
 assert.ok(backdropFactor(open)>backdropFactor(room),"a long lens magnifies far mountains more than a near wall");
 assert.match(describeStagingEn(room),/in an interior room/);
});

test("a coloured light's tint: how strong its colour is reaches the drawing, Whoush and the provider",async()=>{
 const {lightHex,describeStagingEn,describeStagingFa,describeStagingChangesFa}=await import("../lib/staging");
 const l={role:"key" as const,direction:"left" as const,height:"high" as const,quality:"soft" as const,source:"softbox" as const,colorTemperatureK:5600,colorHex:"#ff5a5f"};
 // Always fully saturated: light at a low tint (a bright glow, not washed out toward white), deep at a high one.
 const lum=(h:string)=>[1,3,5].reduce((a,i)=>a+parseInt(h.slice(i,i+2),16),0),sat=(h:string)=>{const v=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));return Math.max(...v)-Math.min(...v);};
 const [b0,b5,b1]=[0,0.5,1].map(t=>lightHex({...l,tint:t})),min=(h:string)=>Math.min(...[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)));
 assert.ok(lum(b0)>lum(b5)*1.2&&lum(b5)>lum(b1)*1.4,"bright, middle and deep clearly apart: "+[b0,b5,b1].join(" "));
 assert.equal(min(b1),0,"deep stays pure (no white in it)");assert.ok(sat(b0)>=100,"bright is still a colour, not white");
 const s={...base,lights:[{...l,tint:0.2}]};
 assert.match(describeStagingEn(s),/a bright, neon-like #ff5a5f colour gel/);assert.match(describeStagingFa(s),/رنگ #ff5a5f \(روشن\)/);
 assert.ok(describeStagingChangesFa(s,{...s,lights:[{...l,tint:0.9}]}).some(x=>x.includes("شدت رنگ روشن ← پررنگ")));
});

test("the arranged scene opens the image prompt in plain words: angle, view, framing and coloured light first",async()=>{
 const {sceneLeadEn}=await import("../lib/staging");
 const l={role:"key" as const,direction:"front_left" as const,height:"high" as const,quality:"soft" as const,source:"softbox" as const,colorTemperatureK:5600,colorHex:"#ff1744",tint:0.9};
 const lead=sceneLeadEn({...base,cameraAngle:"low",cameraElevation:-25,cameraAzimuth:90,shotSize:"close_up",lights:[l]});
 assert.match(lead,/^Camera and light, exactly as arranged: Low-angle shot looking up at the subject\. Side profile view of the subject\. Tight close-up: the face fills most of the frame/);
 assert.match(lead,/Key light: a deep, strongly saturated red coloured light \(#ff1744\), from frame left, in front of the subject, from above face height\./);
 assert.match(lead,/Exactly one person in the picture\./);
 // Every light is stated, with its side of the frame; the canvas keeps lights relative to the camera, so frame right stays frame right after an orbit.
 const fill={role:"fill" as const,direction:"right" as const,height:"eye" as const,quality:"soft" as const,source:"window" as const,colorTemperatureK:3200};
 assert.match(sceneLeadEn({...base,lights:[fill]}),/Fill light: a soft window light, warm \(3200K\), from frame right, level with the subject, at face height\./);
 assert.match(sceneLeadEn({...base,lights:[{...fill,direction:"back"}]}),/from directly behind the subject/);
 // A person seen from behind: what shows is the back of the head and upper back, never a chest.
 const back=sceneLeadEn({...base,cameraAzimuth:135,shotSize:"medium_close_up",lights:[]});
 assert.match(back,/Three-quarter back view: the back of the subject's head and upper back, with only a small part of one cheek visible\. Medium close-up: the head and upper back, cropped mid-back\./);
 assert.ok(!/chest/.test(back),back);
});
