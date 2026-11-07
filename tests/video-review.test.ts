import {test} from "node:test";
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {mkdtempSync,readFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {framesFor,parseDuration,reviewVideoUpload,sniffVideo,VideoTooLongError,type VideoReviewDeps} from "../lib/video-review";
import {forgetReviewsForTests,safeReview} from "../lib/upload-review";
import {hasFfmpeg} from "../lib/audio-check";
import {orchestrateCreativeTurn,deterministicPlanner,faMediaReview,type OrchestratorResult} from "../lib/orchestrator";

const VIDEO=new Uint8Array([0,0,0,24,0x66,0x74,0x79,0x70,0x69,0x73,0x6f,0x6d,0,0,0]);
const safeFrame=async()=>({category:"none" as const,person:false});
const deps=(o:Partial<VideoReviewDeps>):VideoReviewDeps=>({sample:async()=>[new Uint8Array([1]),new Uint8Array([2]),new Uint8Array([3])],inspect:safeFrame,soundtrack:async()=>"clean",store:async()=>({id:"11111111-1111-4111-8111-111111111111",url:"/x"}),...o});

test("owner (2026-11-08): an uploaded video is checked like a photo: every frame and its words pass, then it is stored under a review id",async()=>{
 forgetReviewsForTests();
 const r=await reviewVideoUpload(VIDEO,"video/mp4",deps({}));
 assert.equal(r.state,"safe");assert.equal(r.kind,"video");
 assert.equal(safeReview(r.reviewId)?.kind,"video","the turn finds it by its review id");
});
test("one frame that fails blocks the video, with the video's own wording and a safe way forward",async()=>{
 let given=0;
 const r=await reviewVideoUpload(VIDEO,"video/mp4",deps({inspect:async frames=>{given=frames.length;return {category:"alcohol",person:false};}}));
 assert.equal(given,3,"every sampled frame goes in the one call");
 assert.equal(r.state,"blocked");
 if(r.state==="blocked"){assert.equal(r.category,"alcohol");assert.match(r.messageFa!,/این ویدیو/);assert.doesNotMatch(r.fixFa,/عکس/);}
});
test("words that fail block the video with a reason about its sound, and the fix is to send it silent",async()=>{
 const r=await reviewVideoUpload(VIDEO,"video/mp4",deps({soundtrack:async()=>"politics"}));
 assert.equal(r.state,"blocked");
 if(r.state==="blocked"){assert.match(r.messageFa!,/صدای این ویدیو/);assert.match(r.fixFa,/بدون صدا/);}
});
test("fail closed: a frame or soundtrack that cannot be checked leaves the video unchecked (it throws, nothing is stored)",async()=>{
 let stored=false;const store=async()=>{stored=true;return {id:"x",url:"/x"};};
 await assert.rejects(reviewVideoUpload(VIDEO,"video/mp4",deps({inspect:async()=>{throw new Error("x");},store})));
 await assert.rejects(reviewVideoUpload(VIDEO,"video/mp4",deps({soundtrack:async()=>"unchecked",store})));
 await assert.rejects(reviewVideoUpload(VIDEO,"video/mp4",deps({sample:async()=>{throw new VideoTooLongError();},store})),VideoTooLongError);
 assert.equal(stored,false);
});
test("the container is read from the bytes: MP4, QuickTime and WebM; anything else is not a video",()=>{
 assert.equal(sniffVideo(VIDEO),"video/mp4");
 assert.equal(sniffVideo(new Uint8Array([0,0,0,20,0x66,0x74,0x79,0x70,0x71,0x74,0,0,0])),"video/quicktime");
 assert.equal(sniffVideo(new Uint8Array([0x1a,0x45,0xdf,0xa3,1])),"video/webm");
 assert.equal(sniffVideo(new Uint8Array([0xff,0xd8,0xff,0])),undefined);
 assert.equal(parseDuration("  Duration: 00:01:02.50, start: 0"),62.5);
});
test("owner (2026-11-08): one frame every 5 seconds, never fewer than 3, at most 24",()=>{
 assert.equal(framesFor(3),3);assert.equal(framesFor(15),3);assert.equal(framesFor(16),4);assert.equal(framesFor(30),6);assert.equal(framesFor(120),24);assert.equal(framesFor(600),24);
});
test("real ffmpeg: frames are sampled across the clip and all go to the check together",async t=>{
 if(!(await hasFfmpeg())){t.skip("ffmpeg not installed");return;}
 const dir=mkdtempSync(join(tmpdir(),"whoush-video-test-"));
 try{
  const clip=join(dir,"c.mp4");
  execFileSync("ffmpeg",["-hide_banner","-loglevel","error","-f","lavfi","-i","testsrc=size=320x240:rate=10:duration=22","-c:v","libx264","-pix_fmt","yuv420p",clip]);
  let seen:number[]=[],calls=0;
  const r=await reviewVideoUpload(new Uint8Array(readFileSync(clip)),"video/mp4",{inspect:async frames=>{calls++;seen=frames.map(f=>f.bytes.byteLength);return {category:"none",person:false};},
   soundtrack:async()=>"none",store:async()=>({id:"22222222-2222-4222-8222-222222222222",url:"/x"})});
  assert.equal(r.state,"safe");
  assert.equal(calls,1,"one call for the whole video");
  assert.ok(seen.length>=framesFor(22)-1&&seen.length<=framesFor(22),"a 22 s clip: about "+framesFor(22)+" frames, got "+seen.length);
  assert.ok(seen.every(b=>b>500),"real JPEG frames");
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test("a turn with a checked video goes on; an unchecked one is refused before any paid planning, calmly and by name",async()=>{
 forgetReviewsForTests();
 const ok=await reviewVideoUpload(VIDEO,"video/mp4",deps({}));
 const att=(reviewId?:string)=>({id:crypto.randomUUID(),tag:"video1",kind:"video",mime:"video/mp4",width:64,height:64,durationSeconds:3,role:"motion_reference",bytes:2048,sha256:"c".repeat(64),...(reviewId?{reviewId}:{})});
 let planned=0;const planner=(r:Parameters<typeof deterministicPlanner>[0])=>{planned++;return deterministicPlanner(r);};
 const checked=await orchestrateCreativeTurn({text:"یه ویدیو با حرکت‌های همین فیلم بساز",attachments:[att(ok.reviewId)]},{planner});
 assert.ok(!(checked.status==="unsupported"&&(checked as Extract<OrchestratorResult,{status:"unsupported"}>).reason==="media_review"),JSON.stringify(checked).slice(0,300));
 planned=0;
 const unchecked=await orchestrateCreativeTurn({text:"یه ویدیو با حرکت‌های همین فیلم بساز",attachments:[att()]},{planner});
 assert.equal(unchecked.status,"unsupported");
 const u=unchecked as Extract<OrchestratorResult,{status:"unsupported"}>;
 assert.equal(u.reason,"media_review");assert.equal(planned,0,"no paid plan for a turn that cannot go ahead");
 assert.match(u.message,/#ویدیو-۱/);assert.doesNotMatch(u.message,/تموم نشده \(/);
 assert.match(faMediaReview(["#صدا-۱"],["audio"]),/فایل صوتی هنوز بررسی ایمنی نمی‌شه/);
});
