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
 for(const a of Object.values(VISUALS))assert.match(a.src,/^\/visuals\/[a-z0-9-]+\.png$/);
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
 assert.match(getPrivateMediaPrompt(id)!,/User-adjusted scene \(overrides any earlier camera, framing or lighting direction\): Staging: low angle camera \(-20° from eye level\)/);
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
  assert.ok(Math.abs((0-edge(r.xMin))-(edge(r.xMax)-W))<0.6,"as far past the left edge as past the right ("+p.kind+")");
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
 assert.equal(at({shotSize:"full",cameraElevation:-45}).focalLengthMm,24,"a steep worm's-eye camera: wider");
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
 assert.match(describeStagingFa(tilted),/زاویهٔ کج \(داچ\) 20 درجه، نمای روی شانه/);
 const lines=describeStagingChangesFa(s,{...tilted,lensMm:35});
 assert.ok(lines.some(l=>l.startsWith("زاویهٔ کج"))&&lines.some(l=>l.startsWith("نوع نما"))&&lines.some(l=>l.startsWith("لنز")));
 assert.ok(CreativeTurnInputSchema.shape.stagingOverride.safeParse({...tilted,lensMm:35,apertureF:1.8}).success);
});
