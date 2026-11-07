import {test} from "node:test";
import assert from "node:assert/strict";
import {findMediaModel} from "../lib/catalog";
import {GoogleMediaProvider,buildGoogleImageRequest,googleImages} from "../lib/providers/google";
import {BytePlusMediaProvider,buildSeedanceRequest,buildSeedreamRequest,seedreamSize} from "../lib/providers/byteplus";
import {KlingMediaProvider,buildKlingVideoRequest} from "../lib/providers/kling";
import {settleRun} from "../lib/providers/sync-runner";
import {readMedia} from "../lib/media-store";
import {NotCancelableError,SubmissionUnknownError} from "../lib/provider-errors";
import {mkdtempSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
// Media the adapters store goes to a temporary folder, never the real `.media/` store.
process.env.WHOUSH_MEDIA_DIR=mkdtempSync(join(tmpdir(),"whoush-media-test-"));

type Call={url:string;method:string;headers:Record<string,string>;body?:unknown};
async function withFetch(handler:(c:Call)=>Response|Promise<Response>,run:(calls:Call[])=>Promise<void>,env:Record<string,string>){
 const real=globalThis.fetch,saved={...process.env},calls:Call[]=[];
 Object.assign(process.env,env);
 globalThis.fetch=(async(url:string,init?:RequestInit)=>{const c={url:String(url),method:init?.method??"GET",headers:(init?.headers??{}) as Record<string,string>,body:init?.body?JSON.parse(String(init.body)):undefined};calls.push(c);return handler(c);}) as typeof fetch;
 try{await run(calls);}finally{globalThis.fetch=real;process.env={...saved};}
}
const json=(b:unknown,status=200)=>new Response(JSON.stringify(b),{status,headers:{"content-type":"application/json"}});
const PNG=Buffer.from([137,80,78,71,13,10,26,10,9,9]);

test("Google: the documented interactions request, key only in the header, base64 image stored by Whoush; never resent, never canceled",async()=>{
 const m=findMediaModel("nano-banana-pro-2k")!;
 assert.deepEqual(buildGoogleImageRequest(m,"a man",{aspectRatio:"16:9"}),{model:"gemini-3-pro-image",input:"a man",response_format:{type:"image",image_size:"2K",aspect_ratio:"16:9"},store:false});
 assert.deepEqual((buildGoogleImageRequest(m,"p",{aspectRatio:"8:1"}).response_format as Record<string,unknown>).aspect_ratio,undefined,"a ratio the model does not list is not sent");
 assert.throws(()=>buildGoogleImageRequest(findMediaModel("soul-image")!,"p",{}),/Not a Google image model/);
 assert.equal(googleImages({status:"completed",steps:[{type:"thought",content:[{type:"image",mime_type:"image/png",data:"AA=="}]},{type:"model_output",content:[{type:"text",text:"x"},{type:"image",mime_type:"image/png",data:PNG.toString("base64")}]}]}).length,1,"only model_output images count, not thought images");
 assert.throws(()=>googleImages({status:"failed"}),/not completed/);
 await withFetch(()=>json({status:"completed",steps:[{type:"model_output",content:[{type:"image",mime_type:"image/png",data:PNG.toString("base64")}]}]}),async calls=>{
  const p=new GoogleMediaProvider(),{providerRequestId}=await p.submit({modelId:"nano-banana-pro-2k",prompt:"a man",configuration:{aspectRatio:"3:4"},idempotencyKey:"k"});
  await settleRun(providerRequestId);
  const s=await p.status(providerRequestId);assert.equal(s.state,"completed");
  assert.equal(calls[0].url,"https://generativelanguage.googleapis.com/v1beta/interactions");assert.ok(!calls[0].url.includes("key="),"the key never goes in the URL");
  assert.equal(calls[0].headers["x-goog-api-key"],"g-key");
  const stored=await readMedia(s.outputs[0].url.split("/").pop()!);assert.deepEqual(new Uint8Array(stored!.bytes),new Uint8Array(PNG));
  assert.equal(p.resendSafe(),false);await assert.rejects(()=>p.cancel(),NotCancelableError);
 },{GEMINI_API_KEY:"g-key"});
 await withFetch(()=>json({error:{code:"image_safety"}},400),async()=>{
  const p=new GoogleMediaProvider(),{providerRequestId}=await p.submit({modelId:"nano-banana-2",prompt:"p",configuration:{},idempotencyKey:"k"});
  await settleRun(providerRequestId);assert.equal((await p.status(providerRequestId)).state,"nsfw","a content refusal is told as one; the job ends it as failed: no Neurons are charged");
 },{GEMINI_API_KEY:"g-key"});
});
test("BytePlus Seedream: explicit size for the canvas ratio within the pixel budget, URL mirrored before it expires",async()=>{
 for(const [a,px] of [["16:9",4194304],["9:16",4194304],["21:9",4194304],["1:1",4194304]] as const){
  const [w,h]=seedreamSize(px,a).split("x").map(Number);assert.ok(w%16===0&&h%16===0&&w*h<=4624220&&w*h>=3686400,a+" "+w+"x"+h);
 }
 assert.deepEqual(buildSeedreamRequest(findMediaModel("seedream-5-pro-2k")!,"p",{aspectRatio:"1:1"}),{model:"dola-seedream-5-0-pro-260628",prompt:"p",size:"2048x2048",response_format:"url",output_format:"png",watermark:true});
 await withFetch(c=>c.url.startsWith("https://cdn.example/")?new Response(PNG,{headers:{"content-type":"application/octet-stream"}}):json({data:[{url:"https://cdn.example/a.png",size:"2048x2048"}]}),async calls=>{
  const p=new BytePlusMediaProvider(),{providerRequestId}=await p.submit({modelId:"seedream-5-lite",prompt:"p",configuration:{},idempotencyKey:"k"});
  assert.ok(providerRequestId.startsWith("img_"));await settleRun(providerRequestId.slice(4));
  const s=await p.status(providerRequestId);assert.equal(s.state,"completed");assert.ok(s.outputs[0].url.startsWith("/api/generation/media/"),"served by Whoush, not the 24-hour link");
  assert.equal(calls[0].url,"https://ark.ap-southeast.bytepluses.com/api/v3/images/generations");assert.equal(calls[0].headers.Authorization,"Bearer b-key");
 },{BYTEPLUS_API_KEY:"b-key"});
});
test("BytePlus Seedance: task create, documented statuses, queued-only cancel; an unclear create is unknown and never resent",async()=>{
 assert.deepEqual(buildSeedanceRequest(findMediaModel("seedance-2-0-720p-5s")!,"p",{aspectRatio:"9:16"}),{model:"dreamina-seedance-2-0-260128",content:[{type:"text",text:"p"}],resolution:"720p",ratio:"9:16",duration:5,generate_audio:false,watermark:false});
 let reply:Response=json({id:"cgt-1"});
 await withFetch(c=>c.url.startsWith("https://tos.example/")?new Response(PNG,{headers:{"content-type":"video/mp4"}}):reply.clone(),async calls=>{
  const p=new BytePlusMediaProvider(),{providerRequestId}=await p.submit({modelId:"seedance-2-0-720p-5s",prompt:"p",configuration:{},idempotencyKey:"k"});
  assert.equal(providerRequestId,"task_cgt-1");assert.equal(calls[0].url,"https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks");
  for(const [raw,mapped] of [["queued","queued"],["running","running"],["failed","failed"],["cancelled","canceled"],["expired","failed"]] as const){reply=json({status:raw});assert.equal((await p.status(providerRequestId)).state,mapped);}
  reply=json({status:"bogus"});await assert.rejects(()=>p.status(providerRequestId),/Unknown provider status/);
  reply=json({status:"succeeded",content:{video_url:"https://tos.example/v.mp4"}});const done=await p.status(providerRequestId);
  assert.equal(done.state,"completed");assert.equal(done.outputs[0].kind,"video");
  reply=json({error:{code:"InvalidParameter"}},400);await assert.rejects(()=>p.cancel(providerRequestId),NotCancelableError,"a running task cannot be canceled");
  reply=json({error:{code:"InternalServiceError"}},500);
  await assert.rejects(()=>p.submit({modelId:"seedance-2-0-720p-5s",prompt:"p",configuration:{},idempotencyKey:"k2"}),(e:unknown)=>e instanceof SubmissionUnknownError);
  reply=json({error:{code:"InvalidParameter"}},400);
  await assert.rejects(()=>p.submit({modelId:"seedance-2-0-720p-5s",prompt:"p",configuration:{},idempotencyKey:"k3"}),(e:unknown)=>!(e instanceof SubmissionUnknownError));
  assert.equal(p.resendSafe(),false);
 },{BYTEPLUS_API_KEY:"b-key"});
});
test("Kling: the current API with the job key as external_task_id; a resend finds the task the key already made",async()=>{
 const m=findMediaModel("kling-3-0-720p-10s")!;
 assert.deepEqual(buildKlingVideoRequest(m,"p",{aspectRatio:"4:3"},"job-1"),{path:"/text-to-video/kling-3.0",body:{prompt:"p",settings:{resolution:"720p",aspect_ratio:"16:9",duration:10,audio:"off",multi_shot:false},options:{external_task_id:"job-1",watermark_info:{enabled:false}}}});
 let existing:unknown[]=[];let created=0;let task:Record<string,unknown>={id:"t1",status:"submitted"};
 await withFetch(c=>{
  if(c.url.startsWith("https://cdn.kling.example/"))return new Response(PNG,{headers:{"content-type":"video/mp4"}});
  if(c.method==="POST"){created++;return json({code:0,data:{id:"t1",status:"submitted"}});}
  if(c.url.includes("external_task_ids="))return json({code:0,data:existing});
  return json({code:0,data:[task]});
 },async calls=>{
  const p=new KlingMediaProvider();
  const a=await p.submit({modelId:"kling-3-0-720p-5s",prompt:"p",configuration:{},idempotencyKey:"job-1"});
  assert.equal(a.providerRequestId,"t1");assert.equal(created,1);assert.equal(calls[1].headers.Authorization,"Bearer k-key");
  assert.equal(calls[1].url,"https://api-singapore.klingai.com/text-to-video/kling-3.0");assert.equal((calls[1].body as {options:{external_task_id:string}}).options.external_task_id,"job-1");
  existing=[{id:"t1",status:"processing"}];
  const again=await p.submit({modelId:"kling-3-0-720p-5s",prompt:"p",configuration:{},idempotencyKey:"job-1"});
  assert.equal(again.providerRequestId,"t1");assert.equal(created,1,"the resend found the first task: no second job");
  for(const [raw,mapped] of [["submitted","queued"],["processing","running"],["failed","failed"]] as const){task={id:"t1",status:raw};assert.equal((await p.status("t1")).state,mapped);}
  task={id:"t1",status:"succeeded",outputs:[{type:"video",url:"https://cdn.kling.example/v.mp4"}]};
  const done=await p.status("t1");assert.equal(done.state,"completed");assert.ok(done.outputs[0].url.startsWith("/api/generation/media/"));
  await assert.rejects(()=>p.cancel(),NotCancelableError);assert.equal(p.resendSafe(),true);
 },{KLING_API_KEY:"k-key"});
});
