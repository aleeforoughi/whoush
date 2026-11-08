import {test,beforeEach,afterEach} from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,readdirSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
process.env.WHOUSH_MEDIA_DIR=mkdtempSync(join(tmpdir(),"whoush-review-test-"));
import {BLOCKED_FA,forgetReviewsForTests,reviewUpload,safeReview} from "../lib/upload-review";
import {orchestrateCreativeTurn,getPrivateMediaPrompt,getTurnReferences,type OrchestratorResult} from "../lib/orchestrator";
import {createQuote} from "../lib/quotes";
import {recommendMediaModels} from "../lib/router";
import {resetRouterStateForTests} from "../lib/llm-routing";
import {POST as reviewRoute} from "../app/api/media/review/route";

const ENV_KEYS=["LLM_PROVIDER_AUTHORIZED","ALLOW_LIVE_LLM","ANTHROPIC_API_KEY","OPENAI_API_KEY"];
let saved:Record<string,string|undefined>={};
beforeEach(()=>{resetRouterStateForTests();forgetReviewsForTests();saved=Object.fromEntries(ENV_KEYS.map(k=>[k,process.env[k]]));for(const k of ENV_KEYS)delete process.env[k];});
afterEach(()=>{for(const k of ENV_KEYS){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}});
const JPEG=new Uint8Array([0xff,0xd8,0xff,0xe0,1,2,3,4,5,6,7,8]);
const safe=async()=>({category:"none" as const,person:true});
const photo=(over:Record<string,unknown>={})=>({id:crypto.randomUUID(),tag:"image1",kind:"image",mime:"image/jpeg",bytes:2048,sha256:"c".repeat(64),...over});
const files=()=>readdirSync(process.env.WHOUSH_MEDIA_DIR!).length;

test("upload review: a safe photo is stored and known by its id; a blocked one is never stored; a check that cannot run keeps nothing",async()=>{
 const before=files();
 const ok=await reviewUpload(JPEG,"image/jpeg",{inspect:safe});
 assert.equal(ok.state,"safe");assert.equal(files(),before+1,"stored for the provider");
 assert.equal(safeReview(ok.reviewId)?.state,"safe");
 const bad=await reviewUpload(JPEG,"image/jpeg",{inspect:async()=>({category:"iran_royal",person:false})});
 assert.equal(bad.state,"blocked");assert.equal(files(),before+1,"a blocked photo is not kept");
 assert.equal(safeReview(bad.reviewId),undefined);assert.ok(Object.values(BLOCKED_FA).every(l=>l.length<50),"one short line, no details");
 await assert.rejects(reviewUpload(JPEG,"image/jpeg",{inspect:async()=>{throw new Error("down");}}));
 assert.equal(safeReview(crypto.randomUUID()),undefined,"an id the server never gave is unknown");
 assert.equal(safeReview(undefined),undefined);
});

test("the owner's hard rejections each have a plain Persian reason; casual summer photos of women are explicitly allowed in the check",async()=>{
 for(const c of ["iran_political","iran_royal","sexual","minor","alcohol","drugs","violence","public_figure"] as const)assert.ok(/[\u0600-\u06FF]/.test(BLOCKED_FA[c]),c);
 const src=(await import("node:fs")).readFileSync("lib/reference-inspect.ts","utf8");
 assert.ok(src.includes("casual summer clothes")&&src.includes("Political figures of other countries are not this category")&&src.includes("Lion and Sun"));
});

test("review route: closed when photos cannot be checked (no live vision), with a Persian message and no internals",async()=>{
 const r=await reviewRoute(new Request("http://x/api/media/review",{method:"POST",body:JPEG,headers:{"content-type":"image/jpeg"}}));
 assert.equal(r.status,503);const j=await r.json();assert.equal(j.error,"review_unavailable");assert.ok(/[؀-ۿ]/.test(j.message));
 assert.ok(!/anthropic|claude|gpt|openai/i.test(JSON.stringify(j)));
});

test("checked photos are not a blocker: the turn is priced on a model that keeps a face, and the exact checked photos go with it, in order",async()=>{
 const face=await reviewUpload(JPEG,"image/jpeg",{inspect:safe}),place=await reviewUpload(new Uint8Array([0xff,0xd8,0xff,0xe0,9,9,9,9,9,9,9,9]),"image/jpeg",{inspect:async()=>({category:"none",person:false})});
 const r=await orchestrateCreativeTurn({text:"یه عکس از من با #تصویر-۱ توی جای #تصویر-۲",attachments:[photo({tag:"image2",role:"environment",reviewId:place.reviewId}),photo({tag:"image1",role:"character",reviewId:face.reviewId})]});
 assert.equal(r.status,"planned",JSON.stringify(r).slice(0,400));
 const p=(r as Extract<OrchestratorResult,{status:"planned"}>);
 assert.ok(p.proposal.suggestions.every(s=>s.modelId.startsWith("nano-banana-")),"only models documented to keep a person (Nano Banana 2, 2.1, Pro): "+p.proposal.suggestions.map(s=>s.modelId).join());
 const refs=getTurnReferences(p.turnId);
 assert.deepEqual(refs.map(x=>x.id),[safeReview(face.reviewId)!.mediaId,safeReview(place.reviewId)!.mediaId],"tag order: image1, then image2");
 assert.ok(refs.every(x=>x.source==="upload"));
 assert.match(getPrivateMediaPrompt(p.turnId)!,/Attached reference images, in this order: 1 = \[reference image 1 · [^\]]+\]; 2 = \[reference image 2 · [^\]]+\]\./);
 const q=createQuote({modelId:p.proposal.selectedModelId,turnId:p.turnId});
 assert.equal(q.references?.length,2,"the quote binds the checked photos");
});

test("an unchecked, unknown or forged photo still stops before a price, naming the photos to check again; video and audio stay closed",async()=>{
 const none=await orchestrateCreativeTurn({text:"یه عکس از یه دریاچه",attachments:[photo({role:"environment"})]});
 assert.ok(none.status==="unsupported"&&none.reason==="media_review");assert.deepEqual(none.status==="unsupported"&&none.unreviewed,["image1"]);
 const forged=await orchestrateCreativeTurn({text:"یه عکس از یه دریاچه",attachments:[photo({role:"environment",reviewId:crypto.randomUUID()})]});
 assert.ok(forged.status==="unsupported"&&forged.reason==="media_review");
 const vid=await orchestrateCreativeTurn({text:"یه ویدیو از دریا",attachments:[{id:crypto.randomUUID(),tag:"video1",kind:"video",mime:"video/mp4",bytes:4096,sha256:"d".repeat(64),role:"motion_reference"}]});
 assert.ok(vid.status==="unsupported"&&vid.reason==="media_review"&&vid.unreviewed===undefined,"a video cannot be checked yet: nothing to retry");
});

test("a video with checked photos: the photos serve the opening-frame draft (a video model takes no faces), and the reply says so",async()=>{
 const face=await reviewUpload(JPEG,"image/jpeg",{inspect:safe});
 const r=await orchestrateCreativeTurn({text:"یه ویدیو از من با #تصویر-۱ که کنار دریا قدم می‌زنم",attachments:[photo({role:"character",reviewId:face.reviewId})]});
 assert.equal(r.status,"planned",JSON.stringify(r).slice(0,300));
 const p=r as Extract<OrchestratorResult,{status:"planned"}>;
 assert.equal(p.proposal.operation,"generate_video");assert.ok(p.proposal.draft);
 assert.deepEqual(getTurnReferences(p.proposal.draft!.turnId).map(x=>x.id),[safeReview(face.reviewId)!.mediaId]);
 assert.equal(getTurnReferences(p.turnId).length,0,"the video model gets none");
 assert.ok(p.proposal.message.includes("پیش‌نویس"));
});

test("router: a person's own photos go only to models documented to keep a face; a saved character (photos on the device) still to none",()=>{
 const ids=recommendMediaModels("یه عکس",undefined,{referenceImages:3,identityReference:true},"image").ranked.map(m=>m.id);
 assert.ok(ids.length&&ids.every(id=>id==="nano-banana-2"||id==="nano-banana-2-1"||id==="nano-banana-pro-2k"),ids.join());
 assert.ok(recommendMediaModels("یه عکس",undefined,{referenceImages:2},"image").ranked.some(m=>m.id.startsWith("seedream")),"a place or outfit photo: Seedream too");
 assert.equal(recommendMediaModels("یه عکس",undefined,{referenceImages:2,identityReference:true,savedCharacter:true},"image").ranked.length,0);
});

test("no duplicates: two #s with the same checked picture go to the model once, and the order note names both",async()=>{
 const a=await reviewUpload(JPEG,"image/jpeg",{inspect:safe}),b=await reviewUpload(JPEG,"image/jpeg",{inspect:safe});
 const r=await orchestrateCreativeTurn({text:"یه عکس از من با #تصویر-۱ و #تصویر-۲ توی کافه",attachments:[photo({tag:"image1",role:"character",reviewId:a.reviewId}),photo({tag:"image2",role:"character",reviewId:b.reviewId})]});
 assert.equal(r.status,"planned",JSON.stringify(r).slice(0,300));
 const p=r as Extract<OrchestratorResult,{status:"planned"}>;
 assert.equal(getTurnReferences(p.turnId).length,1,"the same bytes are sent once");
 assert.match(getPrivateMediaPrompt(p.turnId)!,/1 = \[reference image 1[^\]]*\] \(also named \[reference image 2[^\]]*\]\)\./);
});

test("keeping the thread: a follow-up that corrects the work keeps the photos it was built on; a brand-new request starts clean",async()=>{
 const model=await reviewUpload(JPEG,"image/jpeg",{inspect:safe}),shoes=await reviewUpload(new Uint8Array([0xff,0xd8,0xff,0xe0,7,7,7,7,7,7,7,7]),"image/jpeg",{inspect:async()=>({category:"none",person:false})});
 const prior=[photo({tag:"image1",role:"character",reviewId:model.reviewId}),photo({tag:"image2",role:"object",reviewId:shoes.reviewId,sha256:"e".repeat(64)})];
 const gen=[{tag:"generation1",mediaKind:"image" as const,summaryFa:"مدل با کفش"}];
 const fix=await orchestrateCreativeTurn({text:"چرا کفش رو گذاشتی دستش؟ برش دار، من یه کفش دیگه می‌خواستم",priorAttachments:prior,continueWith:["image1","image2"],generations:gen});
 assert.equal(fix.status,"planned",JSON.stringify(fix).slice(0,300));
 const p=fix as Extract<OrchestratorResult,{status:"planned"}>;
 assert.deepEqual(p.plan.references.map(r=>r.tag).sort(),["image1","image2"],"the model and the shoes photo stay with the work");
 assert.equal(getTurnReferences(p.turnId).length,2,"both photos go to the model again");
 const fresh=await orchestrateCreativeTurn({text:"یه عکس جدید از یه دریاچه آروم",priorAttachments:prior,continueWith:["image1","image2"]});
 assert.ok(fresh.status!=="planned"||fresh.plan.references.length===0,"a new request does not drag old photos in");
});

test("a model's content refusal is told as a refusal with a way forward (nothing charged), not a bare failure",async()=>{
 const {startRun,runStatus,settleRun}=await import("../lib/providers/sync-runner");
 const id=startRun(async()=>{throw new Error("Google request failed: 400 prohibited_content");});await settleRun(id);
 assert.equal(runStatus(id).state,"nsfw");
 const other=startRun(async()=>{throw new Error("Google request failed: 500 internal");});await settleRun(other);
 assert.equal(runStatus(other).state,"failed");
 const {REFUSED_FA}=await import("../lib/jobs");
 assert.ok(REFUSED_FA.includes("نورونی کسر نشد")&&!/google|gemini|byteplus|higgsfield/i.test(REFUSED_FA));
});

test("owner (2026-11-07): a blocked photo says its reason, in a line and in a word on the photo",async()=>{
 const {BLOCKED_FA,BLOCKED_LABEL_FA}=await import("../lib/upload-review");
 for(const k of Object.keys(BLOCKED_FA) as (keyof typeof BLOCKED_FA)[]){assert.ok(BLOCKED_LABEL_FA[k].length<=12,k);assert.doesNotMatch(BLOCKED_FA[k],/^این عکس قابل استفاده نیست\.$/,k);}
 assert.match(BLOCKED_FA.sexual,/برهنگی/);assert.match(BLOCKED_FA.iran_royal,/سیاس/);assert.match(BLOCKED_FA.alcohol,/الکل/);
});
