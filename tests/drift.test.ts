import {test,beforeEach,afterEach} from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
process.env.WHOUSH_MEDIA_DIR=mkdtempSync(join(tmpdir(),"whoush-drift-test-"));
import {forgetReviewsForTests,reviewUpload} from "../lib/upload-review";
import {orchestrateCreativeTurn,type OrchestratorResult} from "../lib/orchestrator";
import {resetRouterStateForTests} from "../lib/llm-routing";
import {DRIFT_MARKER_FA,DRIFT_SKIP,driftAskFa,driftNeedsOf,missingNeeds,type PhotoCoverage} from "../lib/drift";
import {isReferenceRequest} from "../lib/reference-needs";

const ENV_KEYS=["LLM_PROVIDER_AUTHORIZED","ALLOW_LIVE_LLM","ANTHROPIC_API_KEY","OPENAI_API_KEY"];
let saved:Record<string,string|undefined>={};
beforeEach(()=>{resetRouterStateForTests();forgetReviewsForTests();saved=Object.fromEntries(ENV_KEYS.map(k=>[k,process.env[k]]));for(const k of ENV_KEYS)delete process.env[k];});
afterEach(()=>{for(const k of ENV_KEYS){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}});
const JPEG=new Uint8Array([0xff,0xd8,0xff,0xe0,7,7,7,7,1,2,3,4]);
const selfie:PhotoCoverage={framing:"head_shoulders",headAngle:"front",teeth:false,eyesOpen:true};
const checked=(c:PhotoCoverage,salt:number)=>reviewUpload(Uint8Array.from([...JPEG,salt]),"image/jpeg",{inspect:async()=>({category:"none",person:true,coverage:c})});
const photo=(over:Record<string,unknown>={})=>({id:crypto.randomUUID(),tag:"image1",kind:"image",mime:"image/jpeg",bytes:2048,sha256:"e".repeat(64),width:1200,height:1600,role:"character",...over});

test("drift: what a request needs of the person, from its words",()=>{
 assert.deepEqual(driftNeedsOf("از نیم‌رخ ازش عکس بساز"),[{id:"face_angle",angle:"profile"}]);
 assert.deepEqual(driftNeedsOf("تمام‌قد توی پارک ایستاده"),[{id:"full_body"}]);
 assert.deepEqual(driftNeedsOf("make him smile at the camera, side view"),[{id:"face_angle",angle:"profile"},{id:"smile"}]);
 assert.deepEqual(driftNeedsOf("یه پوستر خنده‌دار با همین عکس"),[],"«خنده‌دار» (funny) is not a smile");
 assert.deepEqual(driftNeedsOf("پس‌زمینه رو عوض کن"),[]);
});

test("drift: only what no photo (or saved angle) shows is missing; closed eyes need an open-eyes photo for a new picture, not for an edit",()=>{
 assert.deepEqual(missingNeeds("تمام‌قد بساز",[selfie]),[{id:"full_body"}]);
 assert.deepEqual(missingNeeds("تمام‌قد بساز",[selfie,{...selfie,framing:"full_body"}]),[],"a full-body photo covers it");
 assert.deepEqual(missingNeeds("از نیم‌رخ",[selfie],["profile"]),[],"a saved character's profile covers it");
 assert.deepEqual(missingNeeds("بخنده",[selfie]),[{id:"smile"}]);
 const closed={...selfie,eyesOpen:false};
 assert.deepEqual(missingNeeds("توی یه کافه بشینه",[closed]),[{id:"eyes_open"}]);
 assert.deepEqual(missingNeeds("پس‌زمینه رو عوض کن",[closed],[],true),[],"an edit keeps the photo's own eyes");
 assert.deepEqual(missingNeeds("با چشم بسته مدیتیشن کنه",[closed]),[],"the request keeps them closed");
 assert.deepEqual(missingNeeds("تمام‌قد بساز",[]),[],"no known photo of a person: nothing to ask");
});

test("drift: Whoush asks for the photo it lacks (once, saying why) with a skip; skipping or sending photos goes on",async()=>{
 const r=await checked(selfie,1);
 const text="#تصویر-۱ رو تمام‌قد توی یه پارک بساز که داره راه میره";
 const ask=await orchestrateCreativeTurn({text,attachments:[photo({reviewId:r.reviewId})]});
 assert.equal(ask.status,"needs_input",JSON.stringify(ask).slice(0,300));
 const q=ask as Extract<OrchestratorResult,{status:"needs_input"}>;
 assert.ok(q.message.startsWith(DRIFT_MARKER_FA)&&q.message.includes("نمی‌خوام حدسی بسازم"),q.message);
 assert.ok(isReferenceRequest(q.references)&&q.references!.need==="full_body"&&q.references!.angles[0].id==="full_front");
 assert.deepEqual(q.choices?.map(c=>c.id),["drift_skip"]);
 // «همین‌طوری بساز»: the answer to the drift question goes on to planning.
 const skip=await orchestrateCreativeTurn({text:text+"\n"+DRIFT_SKIP.replyFa,answersQuestion:true,attachments:[photo({reviewId:r.reviewId})],
  history:[{role:"user",text},{role:"agent",text:driftAskFa({id:"full_body"})}]});
 assert.notEqual(skip.status,"needs_input",JSON.stringify(skip).slice(0,300));
 // A request the photos already cover is not asked.
 const fine=await orchestrateCreativeTurn({text:"#تصویر-۱ رو توی یه کافه بذار، نمای نزدیک",attachments:[photo({reviewId:r.reviewId})]});
 assert.ok(fine.status!=="needs_input"||!fine.references,"nothing missing");
});
