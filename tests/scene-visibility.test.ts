import test from "node:test";
import assert from "node:assert/strict";
import type {Staging} from "../lib/creative-plan";
import {clearSightByMovingProp,occlusionMessageFa,sceneVisibility,sightFix} from "../lib/scene-visibility";
import {compileImagePrompt} from "../lib/scene-compiler";
import {orchestrateCreativeTurn,deriveTurnWithStaging,getPrivateMediaPrompt,SceneOccluded} from "../lib/orchestrator";

const L:Staging["lights"]=[{role:"key",direction:"front_left",height:"high",quality:"soft",source:"window",colorTemperatureK:5600}];
const man={kind:"person" as const,label:"مرد",x:0,z:2,y:0,main:true};
const table={kind:"object" as const,label:"میز",x:0,z:1.9,y:0,size:{w:1,h:0.75,d:0.7}};
const cafe=(el:number,shot:Staging["shotSize"]="medium"):Staging=>({subject:"person",cameraAngle:el<=-40?"worms_eye":el<0?"low":"eye_level",cameraElevation:el,shotSize:shot,lights:L,props:[man,table]});

test("visibility: a table in front of a floor-level camera hides the face; the smallest fix raises the camera; eye level sees over it",()=>{
 const worm=sceneVisibility(cafe(-55),"9:16");
 assert.equal(worm.subject,"occluded");assert.equal(worm.occluder,1);
 assert.deepEqual(sightFix(cafe(-55),"9:16"),{kind:"raise",elevation:-30});
 assert.equal(sceneVisibility(cafe(-30),"9:16").subject,"visible","the suggested fix really clears it");
 assert.equal(sceneVisibility(cafe(0),"9:16").subject,"visible");
 assert.equal(sceneVisibility({...cafe(0),props:[]},"9:16").subject,"none");
});
test("visibility: the user's arranged scene is never moved; a scene Whoush arranged moves its prop aside and keeps the camera",()=>{
 const fixed=clearSightByMovingProp(cafe(-55),"9:16");
 assert.equal(sceneVisibility(fixed,"9:16").subject,"visible");
 assert.equal(fixed.cameraElevation,-55,"the camera stays as asked");assert.notEqual(fixed.props![1].x,0);assert.equal(fixed.props![1].z,table.z);
 const msg=occlusionMessageFa(cafe(-55),"9:16");
 assert.match(msg,/«میز» از این زاویه جلوی صورتِ «مرد» رو گرفته/);assert.match(msg,/−۳۰ درجه/);assert.ok(!/\d/.test(msg),"Persian digits only");
});
test("only what the crop shows is described: a prop outside the frame leaves the layout and the people count",()=>{
 const far={kind:"person" as const,label:"زن",x:6,z:2,y:0};
 const s:Staging={...cafe(0,"close_up"),props:[man,far]};
 const v=sceneVisibility(s,"3:4");assert.deepEqual(v.inFrame,[true,false]);
 const p=compileImagePrompt({content:"A man in a café.",staging:s,aspect:"3:4"}).prompt;
 assert.match(p,/Exactly one person in the picture\./);
 assert.match(p.split("Scene (must match)")[1],/Layout: person \(main subject\) [a-z ]+\. Lens/,"only the main subject is in the layout");
 const wide:Staging={...s,shotSize:"wide"},pw=compileImagePrompt({content:"A man in a café.",staging:wide,aspect:"16:9"}).prompt;
 if(sceneVisibility(wide,"16:9").inFrame[1])assert.match(pw,/Exactly two people in the picture\./);
});
test("«بساز» with an arranged scene that hides the subject is refused before any price, with the fix in Persian",async()=>{
 const r=await orchestrateCreativeTurn({text:"portrait of a man in a café"});assert.equal(r.status,"planned");
 const id=(r as {turnId:string}).turnId;
 assert.throws(()=>deriveTurnWithStaging(id,cafe(-55),"9:16"),(e:unknown)=>e instanceof SceneOccluded&&e.code==="composition_occluded"&&/بالاتر ببر/.test(e.messageFa));
 const ok=deriveTurnWithStaging(id,cafe(-30),"9:16")!;assert.ok(getPrivateMediaPrompt(ok));
 // The same scene arranged in the chat message: a question with the fix, no plan card, no price.
 const asked=await orchestrateCreativeTurn({text:"portrait of a man in a café",stagingOverride:cafe(-55) as Staging&{subject:"person"},aspectOverride:"9:16"});
 assert.equal(asked.status,"needs_input");assert.match((asked as {question:string}).question,/«میز»/);
});
