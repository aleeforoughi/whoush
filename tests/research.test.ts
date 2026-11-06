import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
// Stored references go to a temporary folder, never the real `.media/` store.
process.env.WHOUSH_MEDIA_DIR=mkdtempSync(join(tmpdir(),"whoush-media-test-"));
import {isUsableLicense,researchReferences,searchOpenverse,searchWikimedia,MAX_REFERENCES,KEEP_PER_SUBJECT,type Inspector,type ResearchReference} from "../lib/research";
import {orchestrateCreativeTurn,deterministicPlanner,getTurnReferences,keepTurnReferencesForTests,type OrchestratorResult} from "../lib/orchestrator";
import {createQuote,verifyQuote} from "../lib/quotes";
import {buildGoogleImageRequest} from "../lib/providers/google";
import {buildSeedreamRequest} from "../lib/providers/byteplus";
import {findMediaModel} from "../lib/catalog";
import {REFERENCE_PROMPT_NOTE} from "../lib/media-provider";
import {ResearchSchema,type CreativePlan,type PrivatePlanner} from "../lib/creative-plan";
import type {TurnStage} from "../lib/orchestrator-stages";

const PLAN={subjects:[{labelFa:"لباس سربازان هخامنشی",kind:"clothing" as const,queries:["Persepolis relief Persian guards"],factsFa:["لباس بلند و چین‌دار پارسی، نه لباس مصری"]},
 {labelFa:"دروازه ایشتار بابل",kind:"landmark" as const,queries:["Ishtar Gate Pergamon Museum"],factsFa:["آجرهای لعابی آبی با نقش شیر و اژدها"]}]};
const JPEG=new Uint8Array([255,216,255,224,0,16,74,70,73,70]);
/** A fake web: Wikimedia and Openverse search answers, and image downloads. `licenses` sets each result's license. */
function fakeWeb(licenses:string[]){
 const calls:string[]=[];
 const f=(async(url:string)=>{
  const u=String(url);calls.push(u);
  if(u.startsWith("https://commons.wikimedia.org/w/api.php"))return Response.json({query:{pages:licenses.map((l,i)=>({title:"File:Relief "+i+".jpg",index:i,imageinfo:[{url:"https://upload.example/r"+i+".jpg",thumburl:"https://upload.example/r"+i+"-800.jpg",mime:"image/jpeg",descriptionurl:"https://commons.wikimedia.org/wiki/File:Relief_"+i+".jpg",extmetadata:{LicenseShortName:{value:l},Artist:{value:"<a href=x>Photographer "+i+"</a>"}}}]}))}});
  if(u.startsWith("https://api.openverse.org/v1/images/"))return Response.json({results:[{title:"Openverse photo",url:"https://ov.example/1.jpg",foreign_landing_url:"https://flickr.example/1",license:"by",license_version:"2.0",creator:"Someone"}]});
  if(/\.(jpg)$/.test(u))return new Response(JPEG,{headers:{"content-type":"image/jpeg"}});
  return new Response("not found",{status:404});
 }) as typeof fetch;
 return {f,calls};
}
const passAll:Inspector=async groups=>groups.map(g=>g.images.map(()=>({relevant:true,safe:true})));void passAll;

test("research: only public domain, CC0, CC BY and CC BY-SA licenses are used",()=>{
 for(const l of ["CC BY-SA 3.0","CC BY 2.0","Public domain","No restrictions","CC0","CC BY-SA 4.0"])assert.ok(isUsableLicense(l),l);
 for(const l of ["CC BY-NC 2.0","CC BY-ND 4.0","CC BY-NC-SA 3.0","All rights reserved","GFDL",""])assert.ok(!isUsableLicense(l),l);
});

test("research: Openverse is asked only when Wikimedia is short; the whole research respects its time budget",async()=>{
 const {f,calls}=fakeWeb(["CC BY-SA 3.0","Public domain","CC BY 2.0"]);
 await researchReferences(ResearchSchema.parse(PLAN),{fetch:f,inspect:async g=>g.map(x=>x.images.map(()=>({relevant:true,safe:true})))});
 assert.ok(!calls.some(u=>u.includes("openverse")),"Wikimedia had enough");
 let t=0;const slow=await researchReferences(ResearchSchema.parse(PLAN),{fetch:f,now:()=>(t+=6000),inspect:async g=>g.map(x=>x.images.map(()=>({relevant:true,safe:true})))});
 assert.ok(slow.notesFa.some(n=>n.includes("سریع")),"past the budget, research stops and says so");
});

test("research: Wikimedia and Openverse results keep only usable licenses, with source, author and license",async()=>{
 const {f,calls}=fakeWeb(["CC BY-SA 3.0","CC BY-NC 2.0","Public domain"]);
 const w=await searchWikimedia("Persepolis relief",4,f);
 assert.deepEqual(w.map(x=>x.license),["CC BY-SA 3.0","Public domain"]);
 assert.equal(w[0].creator,"Photographer 0");assert.equal(w[0].sourceUrl,"https://commons.wikimedia.org/wiki/File:Relief_0.jpg");assert.equal(w[0].imageUrl,"https://upload.example/r0-800.jpg");
 assert.ok(calls[0].includes("gsrnamespace=6")&&calls[0].includes("iiextmetadatafilter="),"documented parameters");
 const o=await searchOpenverse("Achaemenid soldier",4,f);
 assert.equal(o[0].license,"CC BY 2.0");assert.ok(calls.at(-1)!.includes("license_type=commercial%2Cmodification"),"no NC or ND at the source");
});

test("research: only inspected references are kept (relevant and safe), at most two per subject, in one inspection call; no inspection means none",async()=>{
 const {f}=fakeWeb(["CC BY-SA 3.0","Public domain","CC BY 2.0","CC0"]);
 const picky:Inspector=async groups=>groups.map(g=>g.images.map((_,i)=>({relevant:i!==0,safe:i!==2})));
 let calls=0;const counted:Inspector=async g=>{calls++;return picky(g);};
 const r=await researchReferences(ResearchSchema.parse(PLAN),{fetch:f,inspect:counted});
 assert.equal(calls,1,"one inspection call for every subject");
 assert.equal(r.subjects.length,2);
 assert.ok(r.references.length<=MAX_REFERENCES&&r.subjects.every(s=>s.kept<=KEEP_PER_SUBJECT));
 assert.ok(r.references.every(x=>/^\/api\/generation\/media\/[0-9a-f-]{36}$/.test(x.url)),"Whoush-owned copies");
 assert.ok(r.references.every(x=>x.license&&x.creator&&x.sourceUrl),"attribution kept");
 const closed=await researchReferences(ResearchSchema.parse(PLAN),{fetch:f,inspect:async()=>{throw new Error("unavailable");}});
 assert.equal(closed.references.length,0,"uninspected media is never used");
 assert.ok(closed.notesFa.some(n=>n.includes("بررسی تصویری")));
});

test("research turn: the planner asks for research, the turn reports «researching», and an image is offered on a model that takes the references",async()=>{
 const planner:PrivatePlanner=r=>{const p=structuredClone(deterministicPlanner(r).plan) as CreativePlan;p.research=ResearchSchema.parse(PLAN);return {plan:p};};
 const refs:ResearchReference[]=[{id:"11111111-1111-4111-8111-111111111111",url:"/api/generation/media/11111111-1111-4111-8111-111111111111",subjectFa:"لباس سربازان هخامنشی",title:"Relief",license:"CC BY-SA 3.0",creator:"A",sourceUrl:"https://commons.wikimedia.org/wiki/File:R.jpg",source:"wikimedia",mime:"image/jpeg"},
  {id:"22222222-2222-4222-8222-222222222222",url:"/api/generation/media/22222222-2222-4222-8222-222222222222",subjectFa:"دروازه ایشتار بابل",title:"Gate",license:"CC BY 2.0",creator:"B",sourceUrl:"https://commons.wikimedia.org/wiki/File:G.jpg",source:"wikimedia",mime:"image/jpeg"}];
 const stages:TurnStage[]=[];
 const r=await orchestrateCreativeTurn({text:"یه عکس از ورود کوروش کبیر به بابل"},{planner,onStage:s=>stages.push(s),research:async()=>({subjects:PLAN.subjects.map(s=>({labelFa:s.labelFa,factsFa:s.factsFa,found:2,kept:1})),references:refs,notesFa:[]})}) as Extract<OrchestratorResult,{status:"planned"}>;
 assert.equal(r.status,"planned",JSON.stringify(r));
 assert.deepEqual(stages,["reading","planning","checking","researching","pricing"],"research runs after the plan text is checked, before pricing");
 const research=r.proposal.research!;
 assert.equal(research.usedAsImages,true);assert.equal(research.references.length,2);
 assert.ok(research.references.every(x=>!("mime" in x)),"public references carry only what the card needs");
 assert.ok(r.proposal.suggestions.every(s=>findMediaModel(s.modelId)!.capabilities.referenceImages.supported),"only models that take the references");
 assert.deepEqual(getTurnReferences(r.turnId!).map(x=>x.id),refs.map(x=>x.id));
 // A video plan keeps the facts in its prompt but cannot take the images yet: the report says so.
 const vplanner:PrivatePlanner=req=>{const p=structuredClone(deterministicPlanner({...req,kind:"video"}).plan) as CreativePlan;p.research=ResearchSchema.parse(PLAN);return {plan:p};};
 const v=await orchestrateCreativeTurn({text:"یه ویدیو از ورود کوروش کبیر به بابل"},{planner:vplanner,research:async()=>({subjects:[],references:refs,notesFa:[]})}) as Extract<OrchestratorResult,{status:"planned"}>;
 assert.equal(v.status,"planned");assert.equal(v.proposal.research?.usedAsImages,false);assert.ok(v.proposal.research?.notesFa.some(n=>n.includes("ویدیو")));
 assert.equal(getTurnReferences(v.turnId!).length,0,"nothing bound when the models cannot take them");
});

test("research: the quote binds the references the user kept; a removed one stays out and a tampered list is refused",async()=>{
 const planner:PrivatePlanner=r=>({plan:deterministicPlanner(r).plan});
 const r=await orchestrateCreativeTurn({text:"a photo of a lake"},{planner}) as Extract<OrchestratorResult,{status:"planned"}>;
 const ids=["33333333-3333-4333-8333-333333333333","44444444-4444-4444-8444-444444444444"];
 keepTurnReferencesForTests(r.turnId!,ids.map(id=>({id,url:"/api/generation/media/"+id,subjectFa:"x",title:"t",license:"CC0",creator:"c",sourceUrl:"https://commons.wikimedia.org/x",source:"wikimedia",mime:"image/jpeg"})));
 const all=createQuote({modelId:"nano-banana-2-1",turnId:r.turnId!});
 assert.deepEqual(all.references,ids);
 const kept=createQuote({modelId:"nano-banana-2-1",turnId:r.turnId!,excludeReferences:[ids[0]]});
 assert.deepEqual(kept.references,[ids[1]]);assert.notEqual(kept.inputsDigest,all.inputsDigest,"the digest covers the kept set");
 assert.equal(verifyQuote(kept.token).references?.[0],ids[1]);
 const none=createQuote({modelId:"soul-image",turnId:r.turnId!});
 assert.equal(none.references,undefined,"a model without reference input gets none");
 keepTurnReferencesForTests(r.turnId!,[]);
 assert.throws(()=>verifyQuote(kept.token),/stale_quote/,"a reference no longer on the turn invalidates the quote");
});

test("research: Nano Banana gets the prompt and the images as typed blocks; Seedream gets data URLs; too many is refused",()=>{
 const refs=[{bytes:JPEG,mime:"image/jpeg"},{bytes:JPEG,mime:"image/jpeg"}];
 const g=buildGoogleImageRequest(findMediaModel("nano-banana-2-1")!,"Cyrus enters Babylon",{aspectRatio:"16:9"},refs) as {input:{type:string;text?:string;mime_type?:string;data?:string}[]};
 assert.equal(g.input[0].type,"text");assert.ok(g.input[0].text!.endsWith(REFERENCE_PROMPT_NOTE));
 assert.deepEqual(g.input.slice(1).map(b=>[b.type,b.mime_type]),[["image","image/jpeg"],["image","image/jpeg"]]);
 assert.equal(typeof (buildGoogleImageRequest(findMediaModel("nano-banana-2-1")!,"p",{}) as {input:unknown}).input,"string","no references: plain prompt as before");
 const s=buildSeedreamRequest(findMediaModel("seedream-5-pro-2k")!,"p",{},refs) as {image:string[];prompt:string};
 assert.ok(s.image.every(u=>u.startsWith("data:image/jpeg;base64,")));assert.ok(s.prompt.endsWith(REFERENCE_PROMPT_NOTE));
 assert.throws(()=>buildGoogleImageRequest(findMediaModel("nano-banana-pro-2k")!,"p",{},refs),/Too many/,"Pro takes none (not documented)");
});

test("research: never when the user gave references of their own (an attached image or a saved character); planner told to research only public subjects",async()=>{
 const planner:PrivatePlanner=r=>{const p=structuredClone(deterministicPlanner(r).plan) as CreativePlan;p.research=ResearchSchema.parse(PLAN);return {plan:p};};
 let asked=0;const research=async()=>{asked++;return {subjects:[],references:[],notesFa:[]};};
 const att={id:"55555555-5555-4555-8555-555555555555",kind:"image",tag:"image1",mime:"image/jpeg",width:64,height:64,role:"environment",bytes:2048,sha256:"a".repeat(64)};
 await orchestrateCreativeTurn({text:"ورود کوروش کبیر به بابل",attachments:[att]},{planner,research});
 assert.equal(asked,0,"the user's own image leads; no web search");
 await orchestrateCreativeTurn({text:"ورود کوروش کبیر به بابل"},{planner,research});
 assert.equal(asked,1);
 const {compileSkillInstructions}=await import("../lib/skills");
 const sys=compileSkillInstructions({prompt:"x",kind:"image"});
 assert.ok(sys.includes("Research only public, well-documented subjects")&&sys.includes("Never research private people or the user's own things"));
});

test("research plan: a slightly long answer is trimmed to the limits, not dropped",()=>{
 const long={subjects:[1,2,3,4].map(i=>({labelFa:"موضوع "+i,kind:"landmark",queries:["a","b","c"].map(q=>q+" query"),factsFa:["x".repeat(250),"y","z","w","v"]}))};
 const r=ResearchSchema.parse(long);
 assert.equal(r.subjects.length,3);assert.ok(r.subjects.every(x=>x.queries.length===2&&x.factsFa.length===4&&x.factsFa[0].length===200));
});

