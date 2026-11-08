import {test,beforeEach,afterEach} from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
process.env.WHOUSH_MEDIA_DIR=mkdtempSync(join(tmpdir(),"whoush-region-test-"));
import {forgetReviewsForTests,reviewUpload,safeReview} from "../lib/upload-review";
import {orchestrateCreativeTurn,getPrivateMediaPrompt,getTurnReferences,type OrchestratorResult} from "../lib/orchestrator";
import {resetRouterStateForTests} from "../lib/llm-routing";
import {wantsBrushEdit,wantsEditCard} from "../lib/edit-card";
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
 assert.match(prompt,/^Edit \[reference image 1[^\]]*\] only inside the areas its region map marks, each as noted: the red area: رژ لب قرمز مات; the blue area: موها کمی روشن‌تر\. The region map is a separate black image .*never draw its colours, shapes or black.*Do not regenerate the photo: everything outside these areas is copied from the source unchanged, same framing and size\. Preserve all unedited source regions pixel-faithfully/);
 assert.ok(!/Camera and light|Key light|Wide shot|golden-hour|horizon/.test(prompt),"no scene, camera or light lines: they would read as a re-shoot");
 assert.ok(/skin texture exactly as in the source/.test(prompt)&&/same white balance, exposure, contrast, saturation/.test(prompt),"skin-texture and colour-settings locks");
 // Owner, 2026-11-08: the painted photo got its paint copied into the result; the model now gets a region map (black, flat colour areas) as the guide.
 assert.match(prompt,/1 = \[reference image 1[^\]]*\]; 2 = its region map: black, with each area to change as a flat coloured shape \(a guide only, never drawn\)/);
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
 assert.ok(r.status==="needs_input"&&r.editCards?.[0]?.tag==="generation1",JSON.stringify(r).slice(0,200));
 const once=await orchestrateCreativeTurn({text:"#تولید-۱ یه قسمتش رو می‌خوام عوض کنم",generations:gen,answersQuestion:true});
 assert.ok(once.status!=="needs_input"||!once.editCards,"asked once");
});

test("a plain edit request with uploaded photos opens one edit card per photo; a request that names the change goes straight on",async()=>{
 for(const t of ["می‌خوام این عکس رو ادیت کنم","ادیتش کن","این عکسا رو ادیت کن","edit this photo","I want to edit these photos","#تصویر-۱ رو ویرایش کنم"])assert.ok(wantsEditCard(t),t);
 for(const t of ["رژ لبشو قرمز کن","ادیت کن رژ لبشو قرمز کن","edit the sky to sunset","یه عکس از دریا"])assert.ok(!wantsEditCard(t),t);
 const one=await orchestrateCreativeTurn({text:"می‌خوام این عکس رو ادیت کنم",attachments:[photo()]});
 assert.ok(one.status==="needs_input"&&one.editCards?.map(c=>c.tag).join()==="image1",JSON.stringify(one).slice(0,200));
 const two=await orchestrateCreativeTurn({text:"این عکسا رو ادیت کن",attachments:[photo(),photo({tag:"image2",sha256:"d".repeat(64)})]});
 assert.ok(two.status==="needs_input"&&two.editCards?.map(c=>c.tag).join()==="image1,image2","one card each");
 const named=await orchestrateCreativeTurn({text:"#تصویر-۲ رو ادیت کن",attachments:[photo(),photo({tag:"image2",sha256:"d".repeat(64)})]});
 assert.ok(named.status==="needs_input"&&named.editCards?.map(c=>c.tag).join()==="image2","only the one named");
});

test("edit or reference: «only change her shoes» on a photo opens the edit card with the shoes painted and commented; a new scene with the photo goes on as a reference",async()=>{
 const src=await ok();
 const asEdit=async()=>({mode:"edit" as const,regions:[{noteFa:"یه کفش پاشنه‌بلند قرمز",box:[.38,.82,.62,.98]}]});
 const r=await orchestrateCreativeTurn({text:"فقط کفشاشو عوض کن، یه کفش قرمز پاشنه‌بلند",attachments:[photo({reviewId:src.reviewId})]},{locateEdit:asEdit});
 assert.ok(r.status==="needs_input",JSON.stringify(r).slice(0,300));
 const card=r.status==="needs_input"?r.editCards?.[0]:undefined;
 assert.equal(card?.tag,"image1");assert.equal(card?.suggested?.[0].note,"یه کفش پاشنه‌بلند قرمز");assert.deepEqual(card?.suggested?.[0].boxes,[[.38,.82,.62,.98]]);
 const asReference=async()=>({mode:"reference" as const,regions:[]});
 const ref=await orchestrateCreativeTurn({text:"این مدل رو با همین کفش توی یه کافه بذار",attachments:[photo({reviewId:src.reviewId,role:"character"})]},{locateEdit:asReference});
 assert.ok(ref.status!=="needs_input"||!ref.editCards,"a reference goes on to a new picture");
 const down=await orchestrateCreativeTurn({text:"فقط کفشاشو عوض کن",attachments:[photo({reviewId:src.reviewId})]},{locateEdit:async()=>{throw new Error("down");}});
 assert.ok(down.status!=="needs_input"||!down.editCards?.[0]?.suggested,"no check: no invented areas");
 const unsafe=await orchestrateCreativeTurn({text:"فقط دستشو عوض کن",attachments:[photo({reviewId:src.reviewId})]},{locateEdit:async()=>({mode:"edit" as const,regions:[{noteFa:"یه لیوان شراب بذار دستش",box:[.1,.1,.3,.3]}]})});
 assert.ok(unsafe.status!=="needs_input"||!unsafe.editCards?.[0]?.suggested,"a suggestion that breaks the rules is never offered");
});
