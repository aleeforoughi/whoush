import {test} from "node:test";
import assert from "node:assert/strict";
import {liveStatusFa,SLOWER_THAN_USUAL_FA,jobStatusFa} from "../lib/job-progress";
import {cleanProgressLines,MAX_PROGRESS_LINES} from "../lib/progress-narration";
import {jobSnapshot,followJobUntilDone} from "../lib/job-follow";

const LINES=["نور طلایی غروب روی دریاچه…","قایق چوبی کوچیک وسط قاب…","مه نازک روی آب…"];
const TYP=40_000;
const at=(ms:number,extra:Partial<Parameters<typeof liveStatusFa>[0]>={})=>liveStatusFa({state:"running",elapsedMs:ms,typicalMs:TYP,model:"Nano Banana 2",lines:LINES,...extra});

test("while running, the line moves forward through this job's own lines and never comes back",()=>{
 const seen:string[]=[];
 for(let t=0;t<=TYP;t+=500){const l=at(t);if(seen.at(-1)!==l)seen.push(l);}
 assert.equal(seen[0],"در حال ساخت تصویر با Nano Banana 2…");
 for(const l of LINES)assert.ok(seen.includes(l),l);
 assert.equal(new Set(seen).size,seen.length,"no line shows twice");
 assert.equal(at(TYP*1.2),SLOWER_THAN_USUAL_FA,"past the typical time it says so, honestly");
});
test("lines arriving mid-run only move the line forward",()=>{
 for(let t=0;t<TYP;t+=1000){
  const before=["در حال ساخت تصویر با Nano Banana 2…"],after=[before[0],...LINES];
  const i=before.indexOf(at(t,{lines:undefined})),j=after.indexOf(at(t));
  assert.ok(j>=i,"position never goes back at "+t);
 }
});
test("stage lines state the real stage and the job's facts",()=>{
 assert.match(liveStatusFa({state:"reserved",elapsedMs:0,facts:{references:2}}),/آماده‌سازی ۲ عکست و ارسال/);
 assert.match(liveStatusFa({state:"submitted",elapsedMs:0,model:"Seedream 5"}),/درخواست رسید به Seedream 5؛ در صف/);
 const brush=[0,1,2,3].map(k=>at(k*TYP/5,{facts:{brushEdit:true},lines:[]}));
 assert.ok(brush.some(l=>/فقط جاهایی که رنگ کردی عوض می‌شه/.test(l)),"a brush edit says the rest stays");
 assert.ok([0,1].map(k=>at(k*TYP/2+1,{facts:{references:1},lines:[]})).some(l=>/با عکست به‌عنوان مرجع/.test(l)));
 assert.equal(liveStatusFa({state:"failed",elapsedMs:0}),jobStatusFa("failed"),"a stopped job keeps its final line");
 assert.match(at(0,{kind:"video"}),/در حال ساخت ویدیو/);
});
test("only safe Persian lines are kept: no Latin letters (no model or vendor names), nothing flagged, no duplicates, at most six",()=>{
 const out=cleanProgressLines(["  نور نرم صبح روی صورت.  ","Gemini داره می‌سازه…","نور نرم صبح روی صورت…","نور نرم صبح روی صورت","x".repeat(5),"","لباس قرمز مخملی…",
  "یک","آسمان آبی…","کوه‌های برفی…","گل‌های بهاری…","سایهٔ درخت‌ها…","رنگ‌های گرم…"]);
 assert.equal(out[0],"نور نرم صبح روی صورت…");
 assert.ok(out.every(l=>!/[A-Za-z]/.test(l)&&l.endsWith("…")));
 assert.equal(new Set(out).size,out.length);
 assert.ok(out.length<=MAX_PROGRESS_LINES);
 assert.deepEqual(cleanProgressLines(["یه لیوان شراب قرمز روی میز…"]),[],"the lexical check drops a flagged line");
});
test("the browser follows new progress lines even when the state does not change",async()=>{
 const replies=[{state:"running",messageFa:"در حال تولید…"},{state:"running",messageFa:"در حال تولید…",progressFa:LINES,progressFacts:{references:1}},{state:"completed",messageFa:"تمام",outputs:[]}];
 const updates:unknown[]=[];let n=0,now=0;
 const start=jobSnapshot({id:"00000000-0000-4000-8000-000000000001",state:"running",messageFa:"در حال تولید…",typicalMs:TYP});
 await followJobUntilDone(start,u=>updates.push(u),()=>true,{fetch:(async()=>new Response(JSON.stringify(replies[Math.min(n++,replies.length-1)]),{status:200}))as typeof fetch,sleep:async ms=>{now+=ms;},now:()=>now});
 assert.ok(updates.some(u=>(u as {progressFa?:string[]}).progressFa?.length===3),"the lines reached the transcript");
 assert.deepEqual((updates.find(u=>(u as {progressFacts?:unknown}).progressFacts) as {progressFacts:unknown}).progressFacts,{references:1});
});

test("a real job gets its lines written after the submit and shown only while it works",async()=>{
 const {randomUUID}=await import("node:crypto");
 const {orchestrateCreativeTurn}=await import("../lib/orchestrator");
 const {createQuote}=await import("../lib/quotes");
 const {InMemoryJobStore,executeApprovedQuote,pollJob,toPublicJob}=await import("../lib/jobs");
 const {ReservationLedger}=await import("../lib/ledger");
 const env=process.env as Record<string,string|undefined>,saved={NODE_ENV:env.NODE_ENV,T:env.WHOUSH_DEV_LIVE_TEST,K:env.HIGGSFIELD_API_KEY};
 env.NODE_ENV="development";env.WHOUSH_DEV_LIVE_TEST="true";env.HIGGSFIELD_API_KEY="test-key";
 (globalThis as {__whoushDevSubmits?:{n:number}}).__whoushDevSubmits={n:0};
 try{
  const t=await orchestrateCreativeTurn({text:"یک عکس از دریاچه در غروب با soul"});assert.equal(t.status,"planned");
  const q=createQuote({modelId:"soul-image",turnId:(t as {turnId:string}).turnId});assert.equal(q.mode,"dev_live");
  let asked=0,status:{state:"running"|"completed";outputs:{kind:"image";url:string;needsMirroring:true}[]}={state:"running",outputs:[]};
  const deps={store:new InMemoryJobStore(),ledger:new ReservationLedger(),
   provider:{async submit(){return {providerRequestId:"req-1"};},async status(){return status;},async cancel(){}},
   narrate:async(i:{mediaPrompt:string;kind:string})=>{asked++;assert.ok(i.mediaPrompt.length>0);assert.equal(i.kind,"image");return LINES;}};
  const job=await executeApprovedQuote({token:q.token,approved:true,idempotencyKey:randomUUID(),ownerId:"o",moderation:{decision:"allow",source:"lexical_demo"}},deps);
  await new Promise(r=>setTimeout(r,5));
  assert.equal(asked,1);
  const running=(await pollJob(job.id,"o",deps))!;assert.equal(running.state,"running");
  assert.deepEqual(toPublicJob(running).progressFa,LINES);
  status={state:"completed",outputs:[{kind:"image",url:"https://cdn.example/out.png",needsMirroring:true as const}]};
  const done=(await pollJob(job.id,"o",deps))!;assert.equal(done.state,"completed");
  assert.equal(toPublicJob(done).progressFa,undefined,"a finished job shows its result, not progress lines");
 }finally{for(const [k,v] of [["NODE_ENV",saved.NODE_ENV],["WHOUSH_DEV_LIVE_TEST",saved.T],["HIGGSFIELD_API_KEY",saved.K]] as const){if(v===undefined)delete env[k];else env[k]=v;}}
});
