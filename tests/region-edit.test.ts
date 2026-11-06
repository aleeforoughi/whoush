import {test,beforeEach,afterEach} from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
process.env.WHOUSH_MEDIA_DIR=mkdtempSync(join(tmpdir(),"whoush-region-test-"));
import {forgetReviewsForTests,reviewUpload,safeReview} from "../lib/upload-review";
import {orchestrateCreativeTurn,getPrivateMediaPrompt,getTurnReferences,type OrchestratorResult} from "../lib/orchestrator";
import {resetRouterStateForTests} from "../lib/llm-routing";
import {wantsBrushEdit} from "../lib/edit-card";
import {CreativeTurnInputSchema} from "../lib/creative-plan";

const ENV_KEYS=["LLM_PROVIDER_AUTHORIZED","ALLOW_LIVE_LLM","ANTHROPIC_API_KEY","OPENAI_API_KEY"];
let saved:Record<string,string|undefined>={};
beforeEach(()=>{resetRouterStateForTests();forgetReviewsForTests();saved=Object.fromEntries(ENV_KEYS.map(k=>[k,process.env[k]]));for(const k of ENV_KEYS)delete process.env[k];});
afterEach(()=>{for(const k of ENV_KEYS){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}});
const JPEG=new Uint8Array([0xff,0xd8,0xff,0xe0,1,2,3,4,5,6,7,8]);
const ok=()=>reviewUpload(JPEG,"image/jpeg",{inspect:async()=>({category:"none",person:true})});
const photo=(over:Record<string,unknown>={})=>({id:crypto.randomUUID(),tag:"image1",kind:"image",mime:"image/jpeg",bytes:2048,sha256:"c".repeat(64),...over});

test("brush edit: each painted region (its colour and comment) changes only its area; everything else is locked; the marked copy follows the photo",async()=>{
 const src=await ok(),guide=await ok();
 const r=await orchestrateCreativeTurn({text:"#تصویر-۱ رو ادیت کن — ادیت ۱ (قرمز): رژ لب قرمز مات؛ ادیت ۲ (آبی): موها کمی روشن‌تر",
  attachments:[photo({reviewId:src.reviewId,regionEdit:{guideReviewId:guide.reviewId,regions:[{n:1,color:"red",note:"رژ لب قرمز مات"},{n:2,color:"blue",note:"موها کمی روشن‌تر"}]}})]});
 assert.equal(r.status,"planned",JSON.stringify(r).slice(0,300));
 const p=r as Extract<OrchestratorResult,{status:"planned"}>;
 assert.equal(p.plan.references[0].role,"edit_reference","a painted photo is the photo to edit");
 assert.ok(p.plan.hardConstraints[0].startsWith("فقط ناحیه‌های رنگ‌شدهٔ #تصویر-۱ تغییر می‌کنند")&&p.plan.hardConstraints[0].includes("#ادیت-۲ (آبی)"),p.plan.hardConstraints[0]);
 const prompt=getPrivateMediaPrompt(p.turnId)!;
 assert.match(prompt,/^Edit \[reference image 1[^\]]*\] only inside the areas painted in its marked copy, each as noted: the red area: رژ لب قرمز مات; the blue area: موها کمی روشن‌تر\. Do not regenerate the photo: everything outside these areas is copied from the source unchanged\. Preserve all unedited source regions pixel-faithfully/);
 assert.ok(!/Camera and light|Key light|Wide shot|golden-hour|horizon/.test(prompt),"no scene, camera or light lines: they would read as a re-shoot");
 assert.ok(/skin texture exactly as in the source/.test(prompt)&&/same white balance, exposure, contrast, saturation/.test(prompt),"skin-texture and colour-settings locks");
 assert.match(prompt,/1 = \[reference image 1[^\]]*\]; 2 = the same photo with the areas to change painted in translucent colours/);
 assert.deepEqual(getTurnReferences(p.turnId).map(x=>x.id),[safeReview(src.reviewId)!.mediaId,safeReview(guide.reviewId)!.mediaId],"the photo, then its marked copy");
});

test("brush edit: an unchecked marked copy stops before a price like any photo; a restricted comment is refused kindly",async()=>{
 const src=await ok();
 const r=await orchestrateCreativeTurn({text:"#تصویر-۱ رو ادیت کن",attachments:[photo({reviewId:src.reviewId,regionEdit:{guideReviewId:crypto.randomUUID(),regions:[{n:1,color:"red",note:"رژ لب قرمز"}]}})]});
 assert.ok(r.status==="unsupported"&&r.reason==="media_review"&&r.unreviewed?.includes("image1"));
 const g=await ok();
 const bad=await orchestrateCreativeTurn({text:"#تصویر-۱ رو ادیت کن",attachments:[photo({reviewId:src.reviewId,regionEdit:{guideReviewId:g.reviewId,regions:[{n:1,color:"red",note:"یه لیوان شراب بذار دستش"}]}})]});
 assert.ok(bad.status==="restricted"&&bad.category==="alcohol"&&bad.choices?.length);
 assert.ok(!CreativeTurnInputSchema.safeParse({text:"x",attachments:[photo({regionEdit:{guideReviewId:g.reviewId,regions:[{n:1,color:"orange",note:"x"}]}})]}).success,"only the five colours");
});

test("edit card: a local change with no place named, or a brush request, gets the picture to mark; a clear instruction goes straight on",async()=>{
 for(const t of ["اینجاشو عوض کن","این قسمت رو درست کن","می‌خوام با قلم مشخص کنم چی عوض بشه","change this part","let me mark it with the brush"])assert.ok(wantsBrushEdit(t),t);
 for(const t of ["رژ لبشو قرمز کن","یه عکس از دریا","پس‌زمینه رو آبی کن"])assert.ok(!wantsBrushEdit(t),t);
 const gen=[{tag:"generation1",mediaKind:"image" as const,summaryFa:"پرتره"}];
 const r=await orchestrateCreativeTurn({text:"#تولید-۱ یه قسمتش رو می‌خوام عوض کنم",generations:gen});
 assert.ok(r.status==="needs_input"&&r.editCard?.tag==="generation1",JSON.stringify(r).slice(0,200));
 const once=await orchestrateCreativeTurn({text:"#تولید-۱ یه قسمتش رو می‌خوام عوض کنم",generations:gen,answersQuestion:true});
 assert.ok(once.status!=="needs_input"||!once.editCard,"asked once");
});
