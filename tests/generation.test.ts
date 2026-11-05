import {test} from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {MEDIA_CATALOG,MEDIA_CATALOG_VERSION,assertValidCatalog,capabilityState,findMediaModel,priceFor} from "../lib/catalog";
import {SCENE_COMPILER_VERSION} from "../lib/scene-compiler";
import {bestModelFor,modelIneligibility,recommendMediaModels,suggestModel} from "../lib/router";
import {buildProposal,NoCompatibleModelError} from "../lib/agent";
import {generationGate} from "../lib/policy";
import {ReservationLedger} from "../lib/ledger";
import {createQuote,verifyQuote,QuoteError,QUOTE_TTL_MS} from "../lib/quotes";
import {InMemoryJobStore,JobError,RECONCILE_MAX_ATTEMPTS,cancelJob,executeApprovedQuote,moderateAtExecution,pollJob,toPublicJob,transition,type Job,type JobDeps} from "../lib/jobs";
import {HiggsfieldMediaProvider,MockMediaProvider,NotCancelableError,SubmissionUnknownError,type MediaProvider,type ProviderStatus} from "../lib/media-provider";
import {evaluateOutputQA} from "../lib/output-qa";
import {orchestrateCreativeTurn} from "../lib/orchestrator";
import {GET as publicCatalog} from "../app/api/public/catalog/route";
import {POST as quoteRoute} from "../app/api/generation/quote/route";
const GATE_ENV=["PROVIDER_END_USER_AUTHORIZED","PROVIDER_RESELLER_AUTHORIZED","ALLOW_LIVE_GENERATION","HIGGSFIELD_API_KEY","PRODUCTION_MODERATION_VERIFIED","BILLING_LEDGER_VERIFIED","QUOTE_SIGNING_SECRET","DEMO_FX_TOMAN_PER_USD"];
async function withEnv<T>(vars:Record<string,string|undefined>,fn:()=>Promise<T>|T):Promise<T>{
 const saved:Record<string,string|undefined>={};
 for(const k of GATE_ENV)saved[k]=process.env[k];
 for(const k of GATE_ENV)delete process.env[k];
 for(const [k,v] of Object.entries(vars)){if(v===undefined)delete process.env[k];else process.env[k]=v;}
 try{return await fn();}
 finally{for(const k of GATE_ENV){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}}
}
const LIVE_ENV={PROVIDER_END_USER_AUTHORIZED:"true",PROVIDER_RESELLER_AUTHORIZED:"true",ALLOW_LIVE_GENERATION:"true",HIGGSFIELD_API_KEY:"test-id:test-secret",PRODUCTION_MODERATION_VERIFIED:"true",BILLING_LEDGER_VERIFIED:"true",QUOTE_SIGNING_SECRET:"s".repeat(40)};
const PROMPT="یک عکس از کوه‌های البرز هنگام غروب";
async function turn(text=PROMPT){
 const r=await orchestrateCreativeTurn({text});
 assert.equal(r.status,"planned");
 return (r as {turnId:string}).turnId;
}
const fresh=():JobDeps&{store:InMemoryJobStore;ledger:ReservationLedger}=>({store:new InMemoryJobStore(),ledger:new ReservationLedger(),provider:new MockMediaProvider()});
const allow={decision:"allow" as const,source:"lexical_demo" as const};
async function run(deps:JobDeps,o:{modelId?:string;key?:string;owner?:string;turnId?:string}={}){
 const turnId=o.turnId??await turn();
 const q=createQuote({modelId:o.modelId??"soul-image",turnId});
 const job=await executeApprovedQuote({token:q.token,approved:true,idempotencyKey:o.key??randomUUID(),ownerId:o.owner??"owner-a",moderation:allow},deps);
 return {q,job};
}
const mutate=(token:string,f:(p:Record<string,unknown>)=>void)=>{
 const [body,sig]=token.split(".");const p=JSON.parse(Buffer.from(body,"base64url").toString());f(p);
 return Buffer.from(JSON.stringify(p)).toString("base64url")+"."+sig;
};
const rejects=(fn:()=>unknown,code:string)=>assert.throws(fn,(e:unknown)=>e instanceof QuoteError&&e.code===code);

test("quote: tampered payload (neurons, model) is rejected",async()=>{
 const q=createQuote({modelId:"soul-image",turnId:await turn()});
 verifyQuote(q.token);
 rejects(()=>verifyQuote(mutate(q.token,p=>{p.neurons=1;})),"invalid_quote");
 rejects(()=>verifyQuote(mutate(q.token,p=>{p.modelId="nano-banana-pro-2k";})),"invalid_quote");
 rejects(()=>verifyQuote(q.token.slice(0,-2)+"AA"),"invalid_quote");
 rejects(()=>verifyQuote("garbage"),"invalid_quote");
});
test("quote: expiry is enforced",async()=>{
 const now=new Date("2026-11-04T10:00:00Z"),q=createQuote({modelId:"soul-image",turnId:await turn(),now});
 assert.equal(q.expiresAt,new Date(now.getTime()+QUOTE_TTL_MS).toISOString());
 verifyQuote(q.token,new Date(now.getTime()+QUOTE_TTL_MS-1));
 rejects(()=>verifyQuote(q.token,new Date(now.getTime()+QUOTE_TTL_MS)),"expired_quote");
});
test("quote: configuration, characterRef and prompt changes yield different digests",async()=>{
 const t=await turn(),a=createQuote({modelId:"soul-image",turnId:t,configuration:{aspectRatio:"1:1"}}),b=createQuote({modelId:"soul-image",turnId:t,configuration:{aspectRatio:"16:9"}});
 assert.notEqual(a.inputsDigest,b.inputsDigest);
 assert.equal(a.inputsDigest,createQuote({modelId:"soul-image",turnId:t,configuration:{aspectRatio:"1:1"}}).inputsDigest);
 const c=createQuote({modelId:"soul-image",turnId:t,configuration:{aspectRatio:"1:1"},characterRef:{id:"char-12345678",version:1,angles:["front"]}});
 assert.notEqual(a.inputsDigest,c.inputsDigest);
 assert.notEqual(a.inputsDigest,createQuote({modelId:"soul-image",turnId:await turn("یک عکس از دریا"),configuration:{aspectRatio:"1:1"}}).inputsDigest);
});
test("quote: unknown turn, unknown model and unsupported configuration are rejected",async()=>{
 rejects(()=>createQuote({modelId:"soul-image",turnId:randomUUID()}),"unknown_turn");
 const t=await turn();
 rejects(()=>createQuote({modelId:"nope",turnId:t}),"unsupported_model");
 rejects(()=>createQuote({modelId:"soul-image",turnId:t,configuration:{aspectRatio:"7:5"}}),"invalid_configuration");
 rejects(()=>createQuote({modelId:"soul-image",turnId:t,configuration:{durationSeconds:5}}),"invalid_configuration");
 rejects(()=>createQuote({modelId:"kling-4-0-5s",turnId:t,configuration:{aspectRatio:"16:9"}}),"invalid_configuration"); // unverified aspect ratios are never promised
 assert.equal(new QuoteError("unknown_turn").status,410);
});
test("quote: live mode never signs with the random demo secret",async()=>{
 await withEnv(LIVE_ENV,async()=>{
  const t=await turn(),q=createQuote({modelId:"soul-image",turnId:t});
  assert.equal(q.mode,"live");
  verifyQuote(q.token);
 });
 await withEnv({},async()=>{ // a live-signed token is useless once the secret/gates are gone
  const live=await withEnv(LIVE_ENV,async()=>createQuote({modelId:"soul-image",turnId:await turn()}));
  rejects(()=>verifyQuote(live.token),"invalid_quote");
 });
});
test("idempotency: same key twice yields one job and one reservation",async()=>{
 const deps=fresh(),turnId=await turn(),q=createQuote({modelId:"soul-image",turnId}),key=randomUUID();
 const args={token:q.token,approved:true,idempotencyKey:key,ownerId:"owner-a",moderation:allow};
 const [a,b]=await Promise.all([executeApprovedQuote(args,deps),executeApprovedQuote(args,deps)]);
 const c=await executeApprovedQuote(args,deps);
 assert.equal(a.id,b.id);assert.equal(a.id,c.id);
 assert.equal(deps.ledger.count(),1);
});
test("idempotency: key reuse with a different quote is 409; one quote cannot fund two jobs",async()=>{
 const deps=fresh(),{job}=await run(deps,{key:randomUUID()});
 const key=job.idempotencyKey,other=createQuote({modelId:"soul-image",turnId:await turn()});
 await assert.rejects(()=>executeApprovedQuote({token:other.token,approved:true,idempotencyKey:key,ownerId:"owner-a",moderation:allow},deps),(e:unknown)=>e instanceof JobError&&e.status===409&&e.code==="idempotency_conflict");
 const q=createQuote({modelId:"soul-image",turnId:await turn()});
 await executeApprovedQuote({token:q.token,approved:true,idempotencyKey:randomUUID(),ownerId:"owner-a",moderation:allow},deps);
 await assert.rejects(()=>executeApprovedQuote({token:q.token,approved:true,idempotencyKey:randomUUID(),ownerId:"owner-a",moderation:allow},deps),(e:unknown)=>e instanceof JobError&&e.code==="quote_already_used");
 assert.equal(deps.ledger.count(),2);
});
test("execution fails closed without approval or moderation allow, and before any reservation",async()=>{
 const deps=fresh(),q=createQuote({modelId:"soul-image",turnId:await turn()});
 const base={token:q.token,idempotencyKey:randomUUID(),ownerId:"owner-a"};
 await assert.rejects(()=>executeApprovedQuote({...base,approved:false,moderation:allow},deps),(e:unknown)=>e instanceof JobError&&e.code==="not_approved");
 for(const decision of ["block","review"] as const)await assert.rejects(()=>executeApprovedQuote({...base,approved:true,moderation:{decision}},deps),(e:unknown)=>e instanceof JobError&&e.code==="moderation_blocked");
 assert.equal(deps.ledger.count(),0);
 assert.equal(moderateAtExecution(q.token).decision,"allow");
});
test("job state machine rejects illegal transitions",async()=>{
 const {job}=await run(fresh());
 assert.equal(job.state,"submitted");
 const now=new Date();
 for(const to of ["quoted","approved","reserved","released"] as const)assert.throws(()=>transition(job,to,now),(e:unknown)=>e instanceof JobError&&e.code==="illegal_transition");
 transition(job,"failed",now);
 assert.throws(()=>transition(job,"running",now),JobError);
 assert.throws(()=>transition({...job,state:"completed"},"submitted",now),JobError);
});
test("ownership: another owner cannot read or cancel a job",async()=>{
 const deps=fresh(),{job}=await run(deps,{owner:"owner-a"});
 assert.equal(await pollJob(job.id,"owner-b",deps),undefined);
 assert.equal(await cancelJob(job.id,"owner-b",deps),undefined);
 assert.equal(await pollJob("00000000-0000-4000-8000-000000000000","owner-a",deps),undefined);
 assert.equal((await pollJob(job.id,"owner-a",deps))?.id,job.id);
});
test("mock provider never yields media or charges; terminal state is completed_demo",async()=>{
 const deps=fresh(),{job,q}=await run(deps);
 assert.equal(job.mode,"demo");assert.equal(q.mode,"demo");assert.equal(job.chargedNeurons,0);assert.ok(job.providerRequestId?.startsWith("mock-"));
 const states:string[]=[];
 for(let i=0;i<5;i++){const j=(await pollJob(job.id,"owner-a",deps))!;states.push(j.state);assert.deepEqual(j.outputs,[]);assert.equal(j.chargedNeurons,0);}
 assert.deepEqual(states,["submitted","running","completed_demo","completed_demo","completed_demo"]);
 const pub=toPublicJob((await pollJob(job.id,"owner-a",deps))!);
 // Provenance: the job keeps the hash of the exact prompt it sent, privately; the public job never shows it.
 const pv=job.provenance!;
 assert.match(pv.promptSha256,/^[0-9a-f]{64}$/);assert.equal(pv.requestedModelId,"soul-image");assert.equal(pv.endpoint,"mock");
 assert.equal(pv.catalogVersion,MEDIA_CATALOG_VERSION);assert.equal(pv.compilerVersion,SCENE_COMPILER_VERSION,"an image prompt compiled from the canvas");
 assert.equal(pv.reportedModelId,undefined,"no provider reported a model: nothing is assumed");
 assert.ok(!JSON.stringify(pub).includes(pv.promptSha256)&&!("provenance" in pub));
 assert.deepEqual(pub.outputs,[]);assert.equal(pub.chargedNeurons,0);assert.equal(pub.qa.status,"not_applicable");assert.match(pub.messageFa,/هیچ رسانه واقعی/);
 assert.equal(deps.ledger.get(job.id)?.state,"released");
 const mock=new MockMediaProvider(),{providerRequestId}=await mock.submit();
 for(let i=0;i<4;i++)assert.deepEqual((await mock.status(providerRequestId)).outputs,[]);
});
test("mock cancel honored only while queued",async()=>{
 const deps=fresh(),a=await run(deps),r=await cancelJob(a.job.id,"owner-a",deps);
 assert.equal(r?.canceled,true);assert.equal(r?.job.state,"canceled");assert.equal(deps.ledger.get(a.job.id)?.state,"released");
 const b=await run(deps);await pollJob(b.job.id,"owner-a",deps);await pollJob(b.job.id,"owner-a",deps);
 const r2=await cancelJob(b.job.id,"owner-a",deps);
 assert.equal(r2?.canceled,false);assert.equal(r2?.job.state,"running");
});
test("generationGate is blocked by default and lists every blocker",async()=>{
 await withEnv({},()=>{
  const g=generationGate(findMediaModel("soul-image"));
  assert.equal(g.live,false);
  assert.deepEqual(g.blockers.sort(),["billing_ledger_unverified","live_switch","production_moderation_unverified","provider_authorization","provider_credentials","quote_signing_secret"].sort());
  assert.deepEqual(generationGate(findMediaModel("kling-4-0-5s")).blockers.includes("model_unverified"),true);
  assert.equal(generationGate().blockers.includes("model_unspecified"),true);
 });
});
test("each flag individually blocks; all flags + verified model opens; verified:false never goes live",async()=>{
 const soul=findMediaModel("soul-image")!,kling=findMediaModel("kling-4-0-5s")!;
 await withEnv(LIVE_ENV,()=>{
  assert.deepEqual(generationGate(soul),{live:true,blockers:[]});
  for(const m of MEDIA_CATALOG.filter(x=>!x.capabilities.verified))assert.deepEqual(generationGate(m),{live:false,blockers:["model_unverified",...(m.operations.includes("generate")?[]:["needs_hosted_media"])]},m.id);
  for(const id of ["genjutsu-replace","genjutsu-motion"])assert.deepEqual(generationGate(findMediaModel(id)),{live:false,blockers:["needs_hosted_media"]},id);
  for(const id of ["seedance-2-5-5s","seedance-2-5-10s"])assert.deepEqual(generationGate(findMediaModel(id)),{live:true,blockers:[]},id);
  assert.equal(generationGate(kling).live,false);
 });
 for(const k of Object.keys(LIVE_ENV))await withEnv({...LIVE_ENV,[k]:k==="HIGGSFIELD_API_KEY"?undefined:k==="QUOTE_SIGNING_SECRET"?"short":"false"},()=>assert.equal(generationGate(soul).live,false,k));
 await withEnv(LIVE_ENV,async()=>{ // an unverified model stays on the mock provider end to end
  const deps={store:new InMemoryJobStore(),ledger:new ReservationLedger()},t=await turn();
  const q=createQuote({modelId:"kling-4-0-5s",turnId:t});assert.equal(q.mode,"demo");
  const job=await executeApprovedQuote({token:q.token,approved:true,idempotencyKey:randomUUID(),ownerId:"o",moderation:allow},deps);
  assert.equal(job.mode,"demo");assert.ok(job.providerRequestId?.startsWith("mock-"));
 });
});
test("live path: lexical moderation is not enough; settle exactly once on verified output; release otherwise",async()=>{
 await withEnv(LIVE_ENV,async()=>{
  let status:ProviderStatus={state:"queued",outputs:[]};
  const provider:MediaProvider={async submit(j){assert.equal(j.modelId,"soul-image");return {providerRequestId:"req-1"};},async status(){return status;},async cancel(){throw new NotCancelableError();}};
  const mk=()=>({store:new InMemoryJobStore(),ledger:new ReservationLedger(()=>1000),provider});
  const exec=async(deps:JobDeps)=>{const q=createQuote({modelId:"soul-image",turnId:await turn()});assert.equal(q.mode,"live");return {q,args:{token:q.token,approved:true as const,idempotencyKey:randomUUID(),ownerId:"o",moderation:{decision:"allow" as const,source:"production" as const}}};};
  const d1=mk(),{args:a1}=await exec(d1);
  await assert.rejects(()=>executeApprovedQuote({...a1,moderation:allow},d1),(e:unknown)=>e instanceof JobError&&e.code==="moderation_blocked");
  const job=await executeApprovedQuote(a1,d1);
  assert.equal(job.mode,"live");assert.equal(job.chargedNeurons,0);assert.equal(job.providerRequestId,"req-1");
  status={state:"running",outputs:[]};assert.equal((await pollJob(job.id,"o",d1))!.state,"running");
  status={state:"completed",outputs:[{kind:"image",url:"https://cdn.example/x.png",needsMirroring:true}]};
  const done=(await pollJob(job.id,"o",d1))!;
  assert.equal(done.state,"completed");assert.equal(done.chargedNeurons,2);assert.equal(d1.ledger.get(job.id)?.state,"settled");
  assert.equal(done.qa.status,"pending_inspection");
  assert.equal((await pollJob(job.id,"o",d1))!.chargedNeurons,2); // no double settle
  assert.equal(toPublicJob(done).outputs.length,1);
  // completed without usable output is a failure, never a charge
  for(const s of [{state:"completed",outputs:[]},{state:"completed",outputs:[{kind:"image",url:"http://insecure/x.png",needsMirroring:true}]},{state:"failed",outputs:[]},{state:"nsfw",outputs:[]},{state:"canceled",outputs:[]}] as ProviderStatus[]){
   const d=mk(),{args}=await exec(d),j=await executeApprovedQuote(args,d);status=s;
   const r=(await pollJob(j.id,"o",d))!;
   assert.equal(r.chargedNeurons,0,s.state);assert.equal(d.ledger.get(j.id)?.state,"released");assert.deepEqual(toPublicJob(r).outputs,[]);
   assert.ok(r.state==="failed"||r.state==="canceled");
  }
  // live spend without a wallet balance source is refused before any reservation
  const d0={store:new InMemoryJobStore(),ledger:new ReservationLedger(),provider},{args:a0}=await exec(d0);
  await assert.rejects(()=>executeApprovedQuote(a0,d0),(e:unknown)=>e instanceof JobError&&e.code==="insufficient_balance");assert.equal(d0.ledger.count(),0);
  // submission failure releases the reservation
  const d3=mk();d3.provider={...provider,async submit(){throw new Error("boom");}};
  const {args:a3}=await exec(d3),j3=await executeApprovedQuote(a3,d3);
  assert.equal(j3.state,"released");assert.equal(d3.ledger.get(j3.id)?.state,"released");
 });
});
test("Higgsfield adapter maps documented statuses exactly and never guesses",async()=>{
 await withEnv(LIVE_ENV,async()=>{
  const realFetch=globalThis.fetch,calls:{url:string;init?:RequestInit}[]=[];let reply:{status:number;body?:unknown}={status:200,body:{}};
  globalThis.fetch=(async(url:string,init?:RequestInit)=>{calls.push({url:String(url),init});if(reply.status===-1)throw new TypeError("fetch failed");return new Response(reply.body===undefined?null:JSON.stringify(reply.body),{status:reply.status});}) as typeof fetch;
  try{
   const p=new HiggsfieldMediaProvider();
   // An ambiguous outcome (5xx, a dropped connection, an unreadable 2xx) is unknown, never "not sent"; a 4xx is a definite refusal.
   const sub=()=>p.submit({modelId:"soul-image",prompt:"p",configuration:{},idempotencyKey:"k0"});
   for(const [st,body,reason] of [[500,{detail:"x"},"http_500"],[502,undefined,"http_502"],[200,{},"malformed_response"],[-1,undefined,"network"]] as const){
    reply={status:st,body};await assert.rejects(sub,(e:unknown)=>e instanceof SubmissionUnknownError&&e.reason===reason);
   }
   for(const st of [400,403,422,429]){reply={status:st,body:{detail:"no"}};await assert.rejects(sub,(e:unknown)=>!(e instanceof SubmissionUnknownError)&&/failed: \d+/.test(String(e)));}
   calls.length=0;
   reply={status:200,body:{request_id:"abc-123",status:"queued",status_url:"x",cancel_url:"y"}};
   const r=await p.submit({modelId:"soul-image",prompt:"p",configuration:{aspectRatio:"16:9"},idempotencyKey:"k1"});
   assert.equal(r.providerRequestId,"abc-123");
   assert.equal(calls[0].url,"https://api.higgsfield.ai/higgsfield-ai/soul/standard");
   assert.deepEqual(JSON.parse(String(calls[0].init?.body)),{prompt:"p",resolution:"720p",batch_size:1,aspect_ratio:"16:9"});
   const h=calls[0].init?.headers as Record<string,string>;assert.equal(h.Authorization,"Key test-id:test-secret");assert.equal(h["Idempotency-Key"],"k1");
   await assert.rejects(()=>p.submit({modelId:"kling-4-0-5s",prompt:"p",configuration:{},idempotencyKey:"k"}),/blocked/);
   // Seedance 2.5 text-to-video: every billed field explicit, audio off
   reply={status:200,body:{request_id:"sd-1",status:"queued"}};
   await p.submit({modelId:"seedance-2-5-10s",prompt:"p",configuration:{aspectRatio:"9:16"},idempotencyKey:"k2"});
   assert.equal(calls.at(-1)?.url,"https://api.higgsfield.ai/bytedance/seedance-2.5/text-to-video");
   assert.deepEqual(JSON.parse(String(calls.at(-1)?.init?.body)),{prompt:"p",duration:10,resolution:"1080p",generate_audio:false,aspect_ratio:"9:16"});
   // Genjutsu is verified but its media inputs cannot be hosted: blocked before any request
   const before=calls.length;
   for(const id of ["genjutsu-replace","genjutsu-motion"])await assert.rejects(()=>p.submit({modelId:id,prompt:"p",configuration:{},idempotencyKey:"k"}),/blocked/);
   assert.equal(calls.length,before,"no request was sent");
   for(const [raw,mapped] of [["queued","queued"],["in_progress","running"],["failed","failed"],["nsfw","nsfw"],["canceled","canceled"]] as const){reply={status:200,body:{status:raw}};assert.equal((await p.status("abc-123")).state,mapped);}
   reply={status:200,body:{status:"completed",images:[{url:"https://a/1.png"},{url:"https://a/2.png"}],expires_at:"2026-11-11T00:00:00Z"}};
   const c=await p.status("abc-123");assert.equal(c.state,"completed");assert.equal(c.outputs.length,2);assert.ok(c.outputs.every(o=>o.needsMirroring&&o.kind==="image"));assert.equal(c.expiresAt,"2026-11-11T00:00:00Z");
   reply={status:200,body:{status:"completed",video:{url:"https://a/v.mp4"}}};assert.equal((await p.status("abc-123")).outputs[0].kind,"video");
   reply={status:200,body:{status:"processing"}};await assert.rejects(()=>p.status("abc-123"),/Unknown provider status/);
   reply={status:202};await p.cancel("abc-123");assert.equal(calls.at(-1)?.url,"https://api.higgsfield.ai/requests/abc-123/cancel");
   reply={status:400,body:{detail:"started"}};await assert.rejects(()=>p.cancel("abc-123"),NotCancelableError);
  }finally{globalThis.fetch=realFetch;}
 });
 await withEnv({},async()=>{ // default env: adapter refuses everything
  await assert.rejects(()=>new HiggsfieldMediaProvider().submit({modelId:"soul-image",prompt:"p",configuration:{},idempotencyKey:"k"}),/blocked/);
  await assert.rejects(()=>new HiggsfieldMediaProvider().status("abc"),/disabled/);
 });
});
test("router: ineligible explicit model is rejected with reason and compatible alternatives",()=>{
 const r=recommendMediaModels("make a 10 second video with kling","quality",{durationSeconds:10});
 assert.equal(r.kind,"video");assert.equal(r.explicit,undefined);assert.equal(r.explicitRejected?.id,"kling-4-0-5s");assert.ok(r.explicitRejected?.reasonFa);
 assert.deepEqual(r.alternatives.map(m=>m.id),["seedance-2-5-10s"]);assert.ok(r.ranked.every(m=>m.id!=="kling-4-0-5s"));
 const img=recommendMediaModels("generate an image with nano banana","quality",{aspectRatio:"16:9"});
 assert.equal(img.explicitRejected?.id,"nano-banana-pro-2k");assert.deepEqual(img.alternatives.map(m=>m.id),["soul-image"]);
 const ref=recommendMediaModels("generate an image with soul","quality",{referenceImages:1});
 assert.equal(ref.explicitRejected?.id,"soul-image");assert.deepEqual(ref.alternatives,[]); // nothing verified supports reference images
 const lip=recommendMediaModels("video with seedance lip sync","quality",{lipSync:true});
 assert.equal(lip.explicitRejected?.id,"seedance-2-5-5s");
 const p=buildProposal("make a 10 second video with kling","quality",{durationSeconds:10});
 assert.equal(p.selectedModelId,"seedance-2-5-10s");assert.equal(p.explicitRejected?.modelId,"kling-4-0-5s");assert.ok(p.suggestions.length>=1&&p.suggestions.length<=3);
 assert.throws(()=>buildProposal("video with seedance lip sync","quality",{lipSync:true}),NoCompatibleModelError);
});
test("router: motion-reference and video-reference are unverified for every generation model, so they are never satisfied",()=>{
 assert.ok(MEDIA_CATALOG.filter(m=>m.operations.includes("generate")).every(m=>m.capabilities.motionReference===false&&m.capabilities.videoReference===false));
 for(const req of [{motionReference:true},{videoReference:true}]){
  const r=recommendMediaModels("a video of a horse","quality",req);assert.equal(r.ranked.length,0);
  assert.throws(()=>buildProposal("a video of a horse","quality",req),NoCompatibleModelError);
  assert.ok(modelIneligibility(MEDIA_CATALOG.find(m=>m.kind==="video")!,req));
 }
 assert.ok(recommendMediaModels("a video of a horse","quality",{motionReference:false}).ranked.length>0);
});
test("router: two-argument calls and eligible explicit models behave as before",()=>{
 const a=recommendMediaModels("Generate an image using Nano Banana Pro 2K");
 assert.equal(a.explicit,"nano-banana-pro-2k");assert.equal(a.ranked[0].id,"nano-banana-pro-2k");assert.equal(a.explicitRejected,undefined);assert.deepEqual(a.alternatives,[]);
 const b=recommendMediaModels("a video of a horse","cost");assert.ok(b.ranked.length===3);
 assert.equal(recommendMediaModels("a 10s clip with seedance 10s","quality",{durationSeconds:10}).explicit,"seedance-2-5-10s");
});
test("catalog: capability sanity, integer FX-independent prices, only models with a read API reference are verified",async()=>{
 assertValidCatalog();
 assert.ok(MEDIA_CATALOG_VERSION);
 assert.deepEqual(MEDIA_CATALOG.filter(m=>m.capabilities.verified).map(m=>m.id),["soul-image","seedance-2-5-5s","seedance-2-5-10s","genjutsu-replace","genjutsu-motion"]);
 const priced=MEDIA_CATALOG.filter(m=>!m.pricePending&&!m.sourceSecondsSkus),base=priced.map(m=>priceFor(m));
 for(const n of base)assert.ok(Number.isSafeInteger(n)&&n>0);
 for(const fx of ["150000","250000","900000"])await withEnv({DEMO_FX_TOMAN_PER_USD:fx},async()=>{
  assert.deepEqual(priced.map(m=>priceFor(m)),base);
  assert.equal(createQuote({modelId:"seedance-2-5-5s",turnId:await turn()}).neurons,45);
  assert.equal(priceFor(findMediaModel("genjutsu-replace")!,{sourceVideoSeconds:12}),81);
 });
 assert.throws(()=>priceFor(findMediaModel("soul-image")!,{aspectRatio:"1:7"}));
});
const FORBIDDEN=["usd","cost","apikey","key ","claude","anthropic","openai","verifiedapipath","evidence"];
const assertClean=(label:string,v:unknown)=>{const j=JSON.stringify(v).toLowerCase();for(const t of FORBIDDEN)assert.equal(j.includes(t),false,label+" leaks "+t);};
test("consumer JSON (catalog, quote, job) leaks no provider cost, keys, evidence or LLM identity",async()=>{
 assertClean("catalog",await publicCatalog().json());
 const deps=fresh(),turnId=await turn(),q=createQuote({modelId:"soul-image",turnId,configuration:{aspectRatio:"1:1"}});
 const {token,...pub}=q;
 assertClean("quote",pub);
 assertClean("quote token payload",JSON.parse(Buffer.from(token.split(".")[0],"base64url").toString()));
 const job=await executeApprovedQuote({token,approved:true,idempotencyKey:randomUUID(),ownerId:"o",moderation:allow},deps);
 assertClean("job",toPublicJob(job));
 assert.deepEqual(Object.keys(toPublicJob(job)).sort(),["chargedNeurons","id","messageFa","mode","modelId","neurons","outputs","qa","state"]);
 const cat=await publicCatalog().json() as {models:{capabilities:Record<string,unknown>}[]};
 for(const m of cat.models)assert.equal("verified" in m.capabilities,false);
});
test("output QA: metadata checks only; identity/continuity/lip-sync/text are never auto-passed",()=>{
 const live={mode:"live" as const,configuration:{aspectRatio:"16:9",durationSeconds:5}};
 const out=(o:object)=>({kind:"video" as const,url:"https://x/y.mp4",needsMirroring:true as const,...o});
 const unverified=["identity","continuity","lip_sync","text_accuracy"];
 const scenarios=[[out({})],[out({mime:"video/mp4",width:1920,height:1080,durationSeconds:5})],[out({mime:"application/x-evil",width:100,height:100,durationSeconds:60})],[]];
 for(const o of scenarios){
  const qa=evaluateOutputQA(live,o);
  for(const id of unverified)assert.equal(qa.checks.find(c=>c.id===id)?.result,"unverified",id);
  assert.ok(qa.checks.filter(c=>unverified.includes(c.id)).every(c=>c.noteFa));
 }
 const good=evaluateOutputQA(live,[out({mime:"video/mp4",width:1920,height:1080,durationSeconds:5})]);
 assert.equal(good.status,"pending_inspection");assert.ok(good.checks.filter(c=>!unverified.includes(c.id)).every(c=>c.result==="pass"));
 assert.equal(evaluateOutputQA(live,[out({})]).checks.find(c=>c.id==="mime")?.result,"unverified");
 assert.equal(evaluateOutputQA(live,[out({mime:"application/x-evil",width:100,height:100,durationSeconds:60})]).status,"failed_checks");
 assert.equal(evaluateOutputQA(live,[]).status,"failed_checks");
 assert.deepEqual(evaluateOutputQA({mode:"demo",configuration:{}},[]),{status:"not_applicable",checks:[]});
});
test("P5 router: bestModelFor maps specialised work to the catalogue model with Persian blockers, and nothing for plain generation",()=>{
 const ids={lip_sync:"intone",replace:"genjutsu-replace",motion_transfer:"genjutsu-motion"} as const;
 const req={lip_sync:{operation:"lip_sync",lipSync:true,referenceImages:1},replace:{operation:"replace",videoReference:true,referenceImages:2},motion_transfer:{operation:"motion_transfer",motionReference:true,referenceImages:1}} as const;
 for(const op of ["lip_sync","replace","motion_transfer"] as const){
  const b=bestModelFor(req[op],"video");assert.equal(b?.model.id,ids[op],op);assert.equal(b?.active,false);
  assert.deepEqual(b?.blockersFa,[...(op==="lip_sync"?["مسیر API تأیید نشده","قیمت نورون هنوز تأیید نشده"]:[]),"بررسی ایمنی رسانه هنوز فعال نیست","بارگذاری رسانه روی سرور هنوز فعال نیست"],op);
  assert.ok(b!.blockersFa.every(x=>/[؀-ۿ]/.test(x)));
 }
 assert.equal(bestModelFor({},"image"),undefined);assert.equal(bestModelFor({referenceImages:1},"image"),undefined);assert.equal(bestModelFor({},"video"),undefined);
 assert.equal(bestModelFor(req.lip_sync,"image"),undefined,"wrong kind");
 assert.equal(bestModelFor({lipSync:true},"video")?.model.id,"intone","lip sync without audio still names the model");
 assert.equal(bestModelFor({operation:"lip_sync",lipSync:true,referenceImages:3},"video"),undefined,"more than two characters exceeds the stated limit");
 assert.deepEqual(suggestModel(req.replace,"video"),{name:"Genjutsu",active:false,blockersFa:bestModelFor(req.replace,"video")!.blockersFa});
});
test("P5 router: price-pending and operation models are never proposed, even when a requirement matches them",()=>{
 const lip=recommendMediaModels("talking video with intone","quality",{operation:"lip_sync",lipSync:true});
 assert.deepEqual(lip.ranked,[]);assert.equal(lip.explicitRejected?.id,"intone");
 assert.throws(()=>buildProposal("talking video","quality",{operation:"lip_sync",lipSync:true}),NoCompatibleModelError);
 assert.throws(()=>buildProposal("a video of a horse","quality",{lipSync:true}),NoCompatibleModelError);
 const named=recommendMediaModels("a video with genjutsu");assert.equal(named.explicitRejected?.id,"genjutsu-replace");assert.ok(named.ranked.length>0&&named.ranked.every(m=>m.operations.includes("generate")&&!m.pricePending));
 assert.equal(buildProposal("a video with intone","quality").selectedModelId.startsWith("seedance"),true);
 assert.ok(modelIneligibility(findMediaModel("intone")!,{referenceImages:1}),"an operation model is not a generation model");
 const g=findMediaModel("genjutsu-replace")!;
 assert.equal(modelIneligibility(g,{operation:"replace",referenceImages:8,videoReference:true}),undefined,"the documented limit is 8");
 assert.ok(modelIneligibility(g,{operation:"replace",referenceImages:9,videoReference:true}),"more than 8 references exceeds it");
 assert.ok(modelIneligibility({...g,capabilities:{...g.capabilities,referenceImages:{supported:true,max:null}}},{operation:"replace",referenceImages:1,videoReference:true}),"unknown max never satisfies a hard requirement");
});
test("P5 quotes: price-pending models are refused with 409 price_pending (quote route and library)",async()=>{
 const turnId=await turn();
 rejects(()=>createQuote({modelId:"intone",turnId}),"price_pending");
 // Genjutsu has approved length bands, but no quote without a server-measured source length (and the route never accepts one from the client)
 for(const id of ["genjutsu-replace","genjutsu-motion"])rejects(()=>createQuote({modelId:id,turnId}),"invalid_configuration");
 const gq=await quoteRoute(new Request("http://x/api/generation/quote",{method:"POST",body:JSON.stringify({modelId:"genjutsu-replace",turnId,configuration:{sourceVideoSeconds:5}})}));
 assert.equal(gq.status,400,"a client-supplied source length is rejected by the route schema");
 assert.equal(new QuoteError("price_pending").status,409);
 const res=await quoteRoute(new Request("http://x/api/generation/quote",{method:"POST",body:JSON.stringify({modelId:"intone",turnId})}));
 assert.equal(res.status,409);const j=await res.json();assert.equal(j.error,"price_pending");assert.match(j.message,/[؀-ۿ]/);
 assert.equal((await quoteRoute(new Request("http://x/api/generation/quote",{method:"POST",body:JSON.stringify({modelId:"soul-image",turnId})}))).status,200);
 assert.throws(()=>priceFor(findMediaModel("intone")!));
});
test("P5 catalog: price-pending models need no neurons, priced ones need a positive integer, agent-catalogue models stay unverified",()=>{
 assertValidCatalog();
 const soul=findMediaModel("soul-image")!,intone=findMediaModel("intone")!;
 assertValidCatalog([intone]);
 assert.throws(()=>assertValidCatalog([{...intone,neurons:5}]),/price-pending/i);
 for(const n of [undefined,0,-1,1.5,Number.NaN])assert.throws(()=>assertValidCatalog([{...soul,neurons:n}]),/Neuron SKU/);
 assert.throws(()=>assertValidCatalog([{...intone,pricePending:undefined}]),/Neuron SKU/);
 assert.throws(()=>assertValidCatalog([{...intone,operations:[]}]),/operation/);
 assert.throws(()=>assertValidCatalog([{...intone,capabilities:{...intone.capabilities,lipSync:false}}]),/lip/i);
 assert.throws(()=>assertValidCatalog([{...intone,audioSecondsRange:[30,2]}]),/range/);
 assert.throws(()=>assertValidCatalog([{...findMediaModel("genjutsu-motion")!,capabilities:{...findMediaModel("genjutsu-motion")!.capabilities,referenceImages:{supported:false,max:null}}}]),/reference/i);
 assert.deepEqual(MEDIA_CATALOG.filter(m=>m.evidenceSource==="agent_catalogue").map(m=>m.id),["intone"],"only Intone lacks an API reference page");
 assert.ok(MEDIA_CATALOG.filter(m=>m.evidenceSource==="agent_catalogue").every(m=>!m.capabilities.verified&&!m.verifiedApiPath&&m.pricePending&&m.neurons===undefined));
 assert.ok(MEDIA_CATALOG.filter(m=>m.pricePending).every(m=>m.neurons===undefined&&!m.sourceSecondsSkus));
 assert.deepEqual(MEDIA_CATALOG.filter(m=>m.pricePending).map(m=>m.id),["intone"],"Genjutsu has owner-approved length bands");
 assert.equal(intone.characterImagesMax,2);assert.equal(intone.audioClipsMax,6);assert.deepEqual(intone.audioSecondsRange,[2,30]);assert.equal(findMediaModel("genjutsu-replace")!.capabilities.referenceImages.max,8);
 assert.deepEqual(findMediaModel("genjutsu-motion")!.sourceVideoSecondsRange,[4,30]);
 for(const m of MEDIA_CATALOG.filter(x=>x.evidenceSource==="agent_catalogue"))assert.ok(m.capabilities.verified===false&&generationGate(m).blockers.includes("model_unverified"));
});
test("P5 public catalog: pending models are listed available:false with no price and no internals",async()=>{
 const j=await (await publicCatalog()).json() as {models:Array<{id:string;name:string;available:boolean;neurons?:number}>};
 const intone=j.models.find(m=>m.id==="intone")!;assert.equal(intone.name,"Intone");assert.equal(intone.available,false);assert.equal(intone.neurons,undefined);
 assert.equal(j.models.find(m=>m.id==="soul-image")!.available,true);
 const raw=JSON.stringify(j);
 for(const t of ["evidence","evidenceSource","verifiedApiPath","pricePending","agent_catalogue","higgsfield"])assert.equal(raw.toLowerCase().includes(t.toLowerCase()),false,t);
});

test("payload builder and path rule: documented paths only, Genjutsu never gets a payload without hosted media",async()=>{
 const {buildHiggsfieldPayload}=await import("../lib/media-provider");
 const {submitHiggsfieldVerifiedPath}=await import("../lib/higgsfield");
 assert.throws(()=>buildHiggsfieldPayload(findMediaModel("genjutsu-replace")!,"p",{}),/No verified payload/);
 assert.throws(()=>buildHiggsfieldPayload(findMediaModel("seedance-2-5-5s")!,"p",{durationSeconds:7}),/duration/);
 assert.deepEqual(buildHiggsfieldPayload(findMediaModel("seedance-2-5-5s")!,"p",{}),{prompt:"p",duration:5,resolution:"1080p",generate_audio:false});
 await withEnv(LIVE_ENV,async()=>{
  const realFetch=globalThis.fetch,urls:string[]=[];
  globalThis.fetch=(async(url:string)=>{urls.push(String(url));return new Response(JSON.stringify({request_id:"r"}),{status:200});}) as typeof fetch;
  try{
   for(const ok of ["/higgsfield-ai/soul/standard","/bytedance/seedance-2.5/text-to-video","/higgsfield/genjutsu/object-swap/v1.0"])await submitHiggsfieldVerifiedPath(ok,{});
   for(const bad of ["/a/../b","/a/b.","/a/.b","/a//b","/a","/A/b","/a/b?x=1","https://evil/a/b","/a/b-"])await assert.rejects(()=>submitHiggsfieldVerifiedPath(bad,{}),/Invalid configured model path/,bad);
   assert.equal(urls.length,3);
  }finally{globalThis.fetch=realFetch;}
 });
});

test("owner-approved SKUs (2026-11-04) and Genjutsu source-length bands",()=>{
 const n=(id:string)=>findMediaModel(id)!;
 assert.deepEqual(["soul-image","seedance-2-5-5s","seedance-2-5-10s"].map(id=>priceFor(n(id))),[2,45,90]);
 const g=n("genjutsu-replace");
 assert.deepEqual([4,5,6,10,11,15,16,30].map(s=>priceFor(g,{sourceVideoSeconds:s})),[27,27,54,54,81,81,160,160]);
 assert.deepEqual(priceFor(n("genjutsu-motion"),{sourceVideoSeconds:8}),54);
 for(const bad of [{},{sourceVideoSeconds:3},{sourceVideoSeconds:31},{sourceVideoSeconds:4.5}])assert.throws(()=>priceFor(g,bad),/configuration/,JSON.stringify(bad));
 assert.throws(()=>priceFor(n("soul-image"),{sourceVideoSeconds:5}),/configuration/,"a model without a source video refuses one");
 const bad=(over:Record<string,unknown>)=>assert.throws(()=>assertValidCatalog([{...g,...over} as never]),/band|Neuron/i);
 bad({neurons:27});bad({sourceSecondsSkus:[{upToSeconds:5,neurons:27}]});bad({sourceSecondsSkus:[{upToSeconds:10,neurons:54},{upToSeconds:5,neurons:27},{upToSeconds:30,neurons:160}]});
 bad({sourceSecondsSkus:[{upToSeconds:5,neurons:27.5},{upToSeconds:30,neurons:160}]});bad({sourceSecondsSkus:[{upToSeconds:5,neurons:60},{upToSeconds:30,neurons:50}]});
 assert.throws(()=>assertValidCatalog([{...g,pricePending:true} as never]),/price-pending/i);
});
test("public catalog: Genjutsu is listed unavailable with no price; priced generation models show their fixed price",async()=>{
 const j=await (await publicCatalog()).json() as {models:Array<{id:string;available:boolean;neurons?:number}>};
 const by=(id:string)=>j.models.find(m=>m.id===id)!;
 for(const id of ["genjutsu-replace","genjutsu-motion","intone"]){assert.equal(by(id).available,false,id);assert.equal(by(id).neurons,undefined,id);}
 assert.deepEqual([by("soul-image").neurons,by("seedance-2-5-5s").neurons,by("seedance-2-5-10s").neurons],[2,45,90]);
 assert.ok(!JSON.stringify(j).includes("sourceSecondsSkus"));
});

test("provenance: a model the provider reports is recorded, and one that differs from the requested model is flagged",async()=>{
 const mock=new MockMediaProvider(),reporting:MediaProvider={submit:()=>mock.submit(),cancel:id=>mock.cancel(id),
  status:async id=>({...(await mock.status(id)),reportedModelId:"some-other-model"})};
 const deps={...fresh(),provider:reporting},{job}=await run(deps);
 const polled=(await pollJob(job.id,"owner-a",deps))!;
 assert.equal(polled.provenance?.reportedModelId,"some-other-model");assert.equal(polled.provenance?.modelMismatch,true);
 assert.ok(!("provenance" in toPublicJob(polled)));
});
test("capability states: verified from the API reference, unsupported only there; the agent catalogue is documented but unverified; the rest is unknown",()=>{
 const m=(id:string)=>findMediaModel(id)!;
 assert.equal(capabilityState(m("soul-image")),"verified");
 assert.equal(capabilityState(m("soul-image"),"referenceImages"),"unsupported");
 assert.equal(capabilityState(m("intone")),"documented_unverified");assert.equal(capabilityState(m("intone"),"lipSync"),"documented_unverified");
 assert.equal(capabilityState(m("intone"),"startImage"),"unknown","a false flag on an unverified model proves nothing");
 assert.equal(capabilityState(m("nano-banana-pro-2k")),"unknown");assert.equal(capabilityState(m("nano-banana-pro-2k"),"referenceImages"),"unknown");
});

test("an unknown submission keeps its reservation and is resent with the same key until the provider answers; never a second paid job",async()=>{
 let t=Date.parse("2026-11-05T12:00:00Z");const now=()=>new Date(t);
 const sent:{key:string;prompt:string}[]=[];let next:"unknown"|"ok"|"refuse"="unknown";
 const mock=new MockMediaProvider();
 const flaky:MediaProvider={async submit(j){sent.push({key:j.idempotencyKey,prompt:j.prompt});
   if(next==="unknown")throw new SubmissionUnknownError("timeout");if(next==="refuse")throw new Error("Higgsfield submission failed: 400");return mock.submit();},
  status:id=>mock.status(id),cancel:id=>mock.cancel(id)};
 const deps={...fresh(),provider:flaky,now},{job}=await run(deps);
 assert.equal(job.state,"submission_unknown");assert.equal(deps.ledger.get(job.id)?.state,"reserved","the Neurons stay reserved, not released");
 assert.equal(job.chargedNeurons,0);assert.match(toPublicJob(job).messageFa,/دوباره نزن/);assert.ok(!("unknownSubmission" in toPublicJob(job)));
 // Too soon: nothing is resent.
 t+=500;await pollJob(job.id,"owner-a",deps);assert.equal(sent.length,1);
 // Still unknown on the second try: waits, doubling.
 t+=2000;assert.equal((await pollJob(job.id,"owner-a",deps))!.state,"submission_unknown");assert.equal(sent.length,2);
 t+=2000;await pollJob(job.id,"owner-a",deps);assert.equal(sent.length,2,"the next try waits 4 s");
 // The provider answers: the same request with the same key; submitted, then the normal flow.
 next="ok";t+=2500;const ok=(await pollJob(job.id,"owner-a",deps))!;
 assert.equal(ok.state,"submitted");assert.equal(sent.length,3);assert.ok(sent.every(x=>x.key===job.id&&x.prompt===sent[0].prompt),"same key, same prompt");
 assert.equal(ok.unknownSubmission,undefined);
 // A definite refusal on a resend: nothing was made, the reservation is released.
 next="unknown";const d2={...fresh(),provider:flaky,now},{job:j2}=await run(d2);
 next="refuse";t+=3000;const released=(await pollJob(j2.id,"owner-a",d2))!;
 assert.equal(released.state,"released");assert.equal(d2.ledger.get(j2.id)?.state,"released");
 // After the last try it stays unknown with its reservation, for the owner: no more resends.
 next="unknown";const d3={...fresh(),provider:flaky,now},{job:j3}=await run(d3);
 for(let i=0;i<RECONCILE_MAX_ATTEMPTS+3;i++){t+=600_000;await pollJob(j3.id,"owner-a",d3);}
 const before=sent.length;t+=600_000;await pollJob(j3.id,"owner-a",d3);
 assert.equal(sent.length,before);assert.equal(d3.store.get(j3.id)?.state,"submission_unknown");assert.equal(d3.ledger.get(j3.id)?.state,"reserved");
 // It cannot be canceled into a release either: nobody knows whether the provider has it.
 assert.equal((await cancelJob(j3.id,"owner-a",d3))?.canceled,false);
});
