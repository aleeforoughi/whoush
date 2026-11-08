import {test} from "node:test";
import assert from "node:assert/strict";
import {draftVideoModel} from "../lib/router";
import {matchSourceLength} from "../lib/orchestrator";
import {buildProposal} from "../lib/agent";

test("owner (2026-11-08): a video's draft is the cheapest 480p video model, silent and short; none for a ratio it lacks",()=>{
 const m=draftVideoModel("9:16");
 assert.equal(m?.id,"seedance-2-5-480p-5s");assert.equal(m?.neurons,9);
 assert.equal(draftVideoModel("2:3"),undefined,"no 480p model offers 2:3: the draft falls back to the opening-frame still");
});
test("owner (2026-11-08): a replacement in a video lasts as long as that video: the recommended model's version that covers it, same resolution",()=>{
 const p=buildProposal("a cinematic video with seedance 2.5","quality",undefined,"video");
 const head=p.suggestions.find(s=>s.modelId===p.selectedModelId)!;
 assert.equal(head.durationSeconds,5);
 const seven=matchSourceLength(p,7);
 assert.equal(seven.seconds,10);const s7=seven.proposal.suggestions.find(s=>s.modelId===seven.proposal.selectedModelId)!;
 assert.equal(s7.durationSeconds,10);assert.equal(s7.resolution,head.resolution,"the resolution stays");assert.equal(seven.proposal.fixedNeurons,s7.neurons,"the price follows the version");
 assert.equal(seven.proposal.recommendedModelId,s7.modelId);
 assert.equal(matchSourceLength(p,4.8).seconds,5,"a 4.8 s clip fits the 5 s version");
 assert.equal(matchSourceLength(p,25).seconds,10,"longer than any version: the longest");
});

test("owner (2026-11-08): with a source video the draft is the frame preview: first, middle, last and one every 3 s, each edited with the photos",async()=>{
 const {forgetReviewsForTests,reviewUpload}=await import("../lib/upload-review");
 const {reviewVideoUpload}=await import("../lib/video-review");
 const {orchestrateCreativeTurn,deterministicPlanner,getTurnReferences,getPrivateMediaPrompt}=await import("../lib/orchestrator");
 const {frameTimes,previewFramesFor}=await import("../lib/frame-draft");
 assert.deepEqual(frameTimes(7),[0,3.5,6.9],"a 7 s clip: first, middle, last");
 assert.equal(previewFramesFor(12),4);assert.equal(previewFramesFor(2),3);assert.equal(previewFramesFor(120),12);
 forgetReviewsForTests();
 const vid=await reviewVideoUpload(new Uint8Array([0,0,0,24,0x66,0x74,0x79,0x70,0x69,0x73,0x6f,0x6d,0,0,0]),"video/mp4",{sample:async()=>[new Uint8Array([1])],inspect:async()=>({category:"none",person:false}),soundtrack:async()=>"clean",store:async()=>({id:"77777777-7777-4777-8777-777777777777",url:"/x"})});
 const pic=await reviewUpload(new Uint8Array([0xff,0xd8,0xff,0]),"image/jpeg",{inspect:async()=>({category:"none",person:true}),store:async()=>({id:"88888888-8888-4888-8888-888888888888",url:"/y"})});
 let stored=0,asked:readonly number[]=[];
 const frames={read:async()=>new Uint8Array([9]),sample:async(_v:Uint8Array,t:readonly number[])=>{asked=t;return t.map(at=>({atSeconds:at,bytes:new Uint8Array([at])}));},store:async()=>({id:"9999999"+(stored++)+"-9999-4999-8999-999999999999"})};
 const r=await orchestrateCreativeTurn({text:"آدم توی #ویدیو-۱ رو با #تصویر-۱ عوض کن",attachments:[
  {id:crypto.randomUUID(),tag:"video1",kind:"video",mime:"video/mp4",width:720,height:1280,durationSeconds:7,bytes:4096,sha256:"a".repeat(64),role:"reference",reviewId:vid.reviewId},
  {id:crypto.randomUUID(),tag:"image1",kind:"image",mime:"image/jpeg",width:800,height:800,bytes:2048,sha256:"b".repeat(64),role:"character",reviewId:pic.reviewId}]},{planner:deterministicPlanner,frames});
 assert.equal(r.status,"planned",JSON.stringify(r).slice(0,300));
 const d=(r as {proposal:{draft?:{kind?:string;frames?:{turnId:string;atSeconds:number}[];neurons:number;aspectRatio?:string}}}).proposal.draft!;
 assert.equal(d.kind,"frames");assert.deepEqual(asked,[0,3.5,6.9]);assert.equal(d.frames!.length,3);assert.equal(d.neurons,3,"one Neuron a frame");
 assert.equal(d.aspectRatio,"9:16","the frames keep the clip's shape");
 for(const [i,f] of d.frames!.entries()){
  const refs=getTurnReferences(f.turnId);
  assert.equal(refs[0].id,"88888888-8888-4888-8888-888888888888","the photo keeps number 1");assert.match(refs.at(-1)!.subjectFa,/فریم/,"the frame is last");
  assert.match(getPrivateMediaPrompt(f.turnId)!,new RegExp("frame "+(i+1)+" of a video"));
 }
});

test("owner (2026-11-08): a request a model's own rules refused is offered on a model from another provider: same kind, its photos, a video's length",async()=>{
 const {alternativeModel}=await import("../lib/router");
 const {findMediaModel}=await import("../lib/catalog");
 for(const id of ["nano-banana-2","seedance-2-5-10s","kling-3-0-720p-5s"]){
  const cur=findMediaModel(id)!,alt=alternativeModel(id);
  assert.ok(alt,"an alternative for "+id);
  assert.equal(alt!.kind,cur.kind);assert.notEqual(alt!.provider,cur.provider,"other rules: another provider");
  if(cur.kind==="video")assert.equal(alt!.durationSeconds,cur.durationSeconds,"the same length");
 }
 const withPhotos=alternativeModel("nano-banana-2",3);
 assert.ok(withPhotos&&withPhotos.capabilities.referenceImages.supported,"the photos go with it");
 assert.equal(alternativeModel("unknown-model"),undefined);
});

test("owner (2026-11-08): each provider's documented refusal codes are told as refusals; other errors are not",async()=>{
 const {CONTENT_REFUSAL,isContentRefusal}=await import("../lib/provider-errors");
 for(const m of ["Google request failed: 400 image_safety","Google request failed: 400 prohibited_content","Google request failed: 400 content_blocked","Google request failed: 400 image_other",
  "BytePlus request failed: 400 OutputImageSensitiveContentDetected","BytePlus request failed: 400 InputTextSensitiveContentDetected.PolicyViolation","Kling request failed: 400 1301","Kling request failed: 400 1300"])
  assert.ok(CONTENT_REFUSAL.test(m),m);
 for(const m of ["Google request failed: 500 internal","Kling request failed: 429 1303","BytePlus request failed: 400 ModelNotOpen","Google request failed: 400 no_image","Live generation blocked"])
  assert.ok(!CONTENT_REFUSAL.test(m),m);
 assert.equal(isContentRefusal("x"),false);
});
test("owner (2026-11-08): an alternative never goes back to a provider that already refused the same request",async()=>{
 const {alternativeModel}=await import("../lib/router");
 const {findMediaModel}=await import("../lib/catalog");
 const first=alternativeModel("nano-banana-2")!;
 const second=alternativeModel("nano-banana-2",0,["google",first.provider]);
 assert.ok(!second||(second.provider!=="google"&&second.provider!==first.provider),"skips both: "+second?.id);
 assert.equal(findMediaModel(first.id)!.kind,"image");
});

test("owner live test (2026-11-08): the last allowed dev submission goes through; a submission that never left gives its slot back",async()=>{
 const {claimDevSubmit,releaseDevSubmit,devGateOpenForClaimed,devGenerationGate}=await import("../lib/policy");
 const {findMediaModel}=await import("../lib/catalog");
 const env={...process.env};
 Object.assign(process.env,{WHOUSH_DEV_LIVE_TEST:"true",NODE_ENV:"development",WHOUSH_DEV_LIVE_MAX_SUBMITS:"2",HIGGSFIELD_API_KEY:"test-key"});
 const g=globalThis as {__whoushDevSubmits?:{n:number}};const before=g.__whoushDevSubmits?.n;g.__whoushDevSubmits={n:1};
 try{
  const m=findMediaModel("seedance-2-5-480p-5s")!;
  assert.equal(claimDevSubmit(),true,"the 2nd of 2 is allowed");
  assert.equal(devGenerationGate(m).blockers.includes("dev_cap_reached"),true,"the cap is now full for new quotes");
  assert.equal(devGateOpenForClaimed(m),true,"but the claimed job itself may go");
  releaseDevSubmit();assert.equal(g.__whoushDevSubmits!.n,1,"a submission that never left is given back");
 }finally{for(const k of Object.keys(process.env))if(!(k in env))delete process.env[k];Object.assign(process.env,env);if(before===undefined)delete g.__whoushDevSubmits;else g.__whoushDevSubmits={n:before};}
});
