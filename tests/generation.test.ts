import {test} from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {MEDIA_CATALOG,MEDIA_CATALOG_VERSION,assertValidCatalog,findMediaModel,priceFor} from "../lib/catalog";
import {modelIneligibility,recommendMediaModels} from "../lib/router";
import {buildProposal,NoCompatibleModelError} from "../lib/agent";
import {generationGate} from "../lib/policy";
import {ReservationLedger} from "../lib/ledger";
import {createQuote,verifyQuote,QuoteError,QUOTE_TTL_MS} from "../lib/quotes";
import {InMemoryJobStore,JobError,cancelJob,executeApprovedQuote,moderateAtExecution,pollJob,toPublicJob,transition,type Job,type JobDeps} from "../lib/jobs";
import {HiggsfieldMediaProvider,MockMediaProvider,NotCancelableError,type MediaProvider,type ProviderStatus} from "../lib/media-provider";
import {evaluateOutputQA} from "../lib/output-qa";
import {orchestrateCreativeTurn} from "../lib/orchestrator";
import {GET as publicCatalog} from "../app/api/public/catalog/route";
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
  for(const m of MEDIA_CATALOG.filter(x=>!x.capabilities.verified))assert.deepEqual(generationGate(m),{live:false,blockers:["model_unverified"]});
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
  assert.equal(done.state,"completed");assert.equal(done.chargedNeurons,4);assert.equal(d1.ledger.get(job.id)?.state,"settled");
  assert.equal(done.qa.status,"pending_inspection");
  assert.equal((await pollJob(job.id,"o",d1))!.chargedNeurons,4); // no double settle
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
  globalThis.fetch=(async(url:string,init?:RequestInit)=>{calls.push({url:String(url),init});return new Response(reply.body===undefined?null:JSON.stringify(reply.body),{status:reply.status});}) as typeof fetch;
  try{
   const p=new HiggsfieldMediaProvider();
   reply={status:200,body:{request_id:"abc-123",status:"queued",status_url:"x",cancel_url:"y"}};
   const r=await p.submit({modelId:"soul-image",prompt:"p",configuration:{aspectRatio:"16:9"},idempotencyKey:"k1"});
   assert.equal(r.providerRequestId,"abc-123");
   assert.equal(calls[0].url,"https://api.higgsfield.ai/higgsfield-ai/soul/standard");
   assert.deepEqual(JSON.parse(String(calls[0].init?.body)),{prompt:"p",num_images:1,aspect_ratio:"16:9"});
   const h=calls[0].init?.headers as Record<string,string>;assert.equal(h.Authorization,"Key test-id:test-secret");assert.equal(h["Idempotency-Key"],"k1");
   await assert.rejects(()=>p.submit({modelId:"kling-4-0-5s",prompt:"p",configuration:{},idempotencyKey:"k"}),/blocked/);
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
test("router: motion-reference and video-reference are unverified for every model, so they are never satisfied",()=>{
 assert.ok(MEDIA_CATALOG.every(m=>m.capabilities.motionReference===false&&m.capabilities.videoReference===false));
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
test("catalog: capability sanity, integer FX-independent prices, only the doc-read model is verified",async()=>{
 assertValidCatalog();
 assert.ok(MEDIA_CATALOG_VERSION);
 assert.deepEqual(MEDIA_CATALOG.filter(m=>m.capabilities.verified).map(m=>m.id),["soul-image"]);
 const base=MEDIA_CATALOG.map(m=>priceFor(m));
 for(const n of base)assert.ok(Number.isSafeInteger(n)&&n>0);
 for(const fx of ["150000","250000","900000"])await withEnv({DEMO_FX_TOMAN_PER_USD:fx},async()=>{
  assert.deepEqual(MEDIA_CATALOG.map(m=>priceFor(m)),base);
  assert.equal(createQuote({modelId:"seedance-2-5-5s",turnId:await turn()}).neurons,42);
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
