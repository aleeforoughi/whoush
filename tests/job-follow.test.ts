import test from "node:test";
import assert from "node:assert/strict";
import {followJobUntilDone,jobSnapshot,LOST_JOB_FA} from "../lib/job-follow";
import {followDeadlineMs,isFinalJobState,pollDelayMs} from "../lib/job-progress";
import {validateProject} from "../lib/projects";
import type {JobSnapshot} from "../lib/projects";

const ID="47d72172-a4df-4601-b89f-00a09bdf46d3",MEDIA="/api/generation/media/14bceb1c-d0f3-449c-9df0-cc16fc4e278d";
/** A fake clock and server: `replies(t)` answers a status check at time t (ms since start). */
function fakeIo(replies:(t:number)=>{status:number;body?:unknown}){
 let t=0;const calls:number[]=[];
 return {calls,io:{now:()=>t,sleep:async(ms:number)=>{t+=ms;},fetch:(async()=>{calls.push(t);const r=replies(t);return new Response(r.body===undefined?null:JSON.stringify(r.body),{status:r.status});}) as typeof fetch}};
}
const running:JobSnapshot={state:"running",messageFa:"در حال ساخت",jobId:ID,typicalMs:150_000,tag:"generation2"};

test("job follow: a slow job (150 s) is followed to completion, not abandoned after 15 s; outputs and tag are kept",async()=>{
 const {io,calls}=fakeIo(t=>t<150_000?{status:200,body:{id:ID,state:"running",messageFa:"در حال ساخت"}}:{status:200,body:{id:ID,state:"completed",messageFa:"تمام شد",outputs:[{kind:"image",url:MEDIA}]}});
 const seen:JobSnapshot[]=[];
 const end=await followJobUntilDone(running,s=>seen.push(s),()=>true,io);
 assert.equal(end.state,"completed");assert.deepEqual(end.outputs,[{kind:"image",url:MEDIA}]);assert.equal(end.tag,"generation2");assert.equal(end.jobId,ID);
 assert.equal(seen.length,1,"only real changes are reported");
 assert.ok(calls.length<60,"checks slow down: "+calls.length+" checks in 150 s");
});

test("job follow: a job the server no longer knows ends as lost; a closed project stops following; network errors are retried",async()=>{
 const gone=fakeIo(()=>({status:404}));
 const lost=await followJobUntilDone(running,()=>undefined,()=>true,gone.io);
 assert.equal(lost.state,"lost");assert.equal(lost.messageFa,LOST_JOB_FA);assert.ok(isFinalJobState("lost"));
 const other=fakeIo(()=>({status:200,body:{state:"running",messageFa:"x"}}));
 const stopped=await followJobUntilDone(running,()=>undefined,()=>false,other.io);
 assert.equal(stopped.state,"running");assert.equal(other.calls.length,0);
 let n=0;const flaky={now:()=>n*1000,sleep:async()=>{n++;},fetch:(async()=>{if(n<3)throw new Error("offline");return new Response(JSON.stringify({state:"completed",messageFa:"تمام شد"}),{status:200});}) as typeof fetch};
 assert.equal((await followJobUntilDone(running,()=>undefined,()=>true,flaky)).state,"completed");
});

test("job follow: it gives up only after the deadline (4x typical, 3 to 15 minutes); finished or id-less jobs are not followed",async()=>{
 assert.equal(followDeadlineMs(20_000),180_000);assert.equal(followDeadlineMs(150_000),600_000);assert.equal(followDeadlineMs(600_000),900_000);
 assert.equal(pollDelayMs(0),1500);assert.equal(pollDelayMs(100),5000);
 const forever=fakeIo(()=>({status:200,body:{state:"running",messageFa:"در حال ساخت"}}));
 const end=await followJobUntilDone(running,()=>undefined,()=>true,forever.io);
 assert.equal(end.state,"running");assert.ok(forever.calls.at(-1)!<=followDeadlineMs(150_000)+5000);
 const none=fakeIo(()=>({status:500}));
 await followJobUntilDone({...running,state:"completed"},()=>undefined,()=>true,none.io);
 await followJobUntilDone({state:"running",messageFa:"x"},()=>undefined,()=>true,none.io);
 assert.equal(none.calls.length,0);
});

test("job snapshot: only Whoush-owned outputs are kept; saved projects accept the job id, owned outputs and pace, and reject anything else",()=>{
 const s=jobSnapshot({id:ID,state:"completed",messageFa:"تمام شد",outputs:[{kind:"image",url:MEDIA},{kind:"image",url:"https://cdn.example.com/x.png"}],typicalMs:20_000},"generation1");
 assert.deepEqual(s.outputs,[{kind:"image",url:MEDIA}]);
 const project=(snapshot:unknown)=>({id:"00000000-0000-4000-8000-000000000001",version:1,title:"t",titleSource:"auto",createdAt:"2026-11-06T00:00:00.000Z",updatedAt:"2026-11-06T00:00:00.000Z",
  mode:"quality",style:null,tagCounters:{image:0,video:0,audio:0,file:0},messages:[{id:"m1",role:"agent",text:"x",at:"2026-11-06T00:00:00.000Z",kind:"job",snapshot}]});
 const ok=(snap:unknown)=>{try{validateProject(project(snap));return true;}catch{return false;}};
 assert.ok(ok({state:"running",messageFa:"x"}),"old saved jobs still load");
 assert.ok(ok(s));
 assert.ok(!ok({...s,outputs:[{kind:"image",url:"https://evil.example/x.png"}]}),"never a provider or foreign URL");
 assert.ok(!ok({...s,jobId:"not-an-id"}));assert.ok(!ok({...s,typicalMs:-1}));
});
