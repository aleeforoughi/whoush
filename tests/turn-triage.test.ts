import {test} from "node:test";
import assert from "node:assert/strict";
import {normalizeTriage,type Triage,type TurnTriager} from "../lib/turn-triage";
import {orchestrateCreativeTurn,deterministicPlanner,seriousCorrections,type OrchestratorResult} from "../lib/orchestrator";
import {parseNdjson} from "../lib/agent-stream";
import {validateProject,type Project} from "../lib/projects";
import {newTagCounters} from "../lib/attachments";

const base={mode:"make" as const,effort:"standard" as const,replyFa:"",questionFa:"",choices:[],react:null,storyFa:[]};
const stub=(t:Triage|null):TurnTriager=>async()=>t;

test("owner (2026-11-07): a greeting gets a direct reply, with no plan, price or card",async()=>{
 const r=await orchestrateCreativeTurn({text:"سلام! چه کارایی بلدی؟"},{planner:deterministicPlanner,triage:stub({mode:"reply",replyFa:"سلام! عکس و ویدیو می‌سازم. چی بسازیم؟"})});
 assert.equal(r.status,"reply");
 assert.equal((r as Extract<OrchestratorResult,{status:"reply"}>).message,"سلام! عکس و ویدیو می‌سازم. چی بسازیم؟");
});
test("a request missing what changes the result (a cover with no topic, a link) is asked once, with one-tap answers",async()=>{
 const r=await orchestrateCreativeTurn({text:"یه کاور برای ویدیوی یوتیوبم میخوام"},{planner:deterministicPlanner,triage:stub({mode:"ask",leadFa:"چند تا چیز رو بگو.",questionFa:"ویدیو درباره چیه؟ کی توی کاوره؟",choices:[{labelFa:"عکسشو می‌فرستم",replyFa:"عکسشو می‌فرستم"}]})});
 assert.equal(r.status,"needs_input");
 const q=r as Extract<OrchestratorResult,{status:"needs_input"}>;
 assert.equal(q.question,"ویدیو درباره چیه؟ کی توی کاوره؟");
 assert.deepEqual(q.choices?.map(c=>c.labelFa),["عکسشو می‌فرستم"]);
});
test("an answer to Whoush's own question is never triaged again: it goes on to planning",async()=>{
 let called=0;
 const r=await orchestrateCreativeTurn({text:"یه عکس از یه گربه",answersQuestion:true},{planner:deterministicPlanner,triage:async()=>{called++;return {mode:"reply",replyFa:"x"};}});
 assert.equal(called,0);assert.equal(r.status,"planned");
});
test("a triage reply that names a private model or fails the plan-text check is dropped: the turn is planned instead",async()=>{
 const r=await orchestrateCreativeTurn({text:"یه عکس از یه گربه"},{planner:deterministicPlanner,triage:stub({mode:"reply",replyFa:"من با Claude کار می‌کنم"})});
 assert.equal(r.status,"planned");
});
test("make streams the story lines for the planning stage, and triage that cannot run changes nothing",async()=>{
 const notes:{stage:string;kind:string;lines:string[]}[]=[];
 const r=await orchestrateCreativeTurn({text:"یه عکس از یه گربه"},{planner:deterministicPlanner,triage:stub({mode:"make",effort:"light",storyFa:["نور غروب رو روی خزش تصور می‌کنم…"]}),onNote:n=>notes.push(n)});
 assert.equal(r.status,"planned");
 assert.deepEqual(notes.find(n=>n.kind==="story"),{stage:"planning",kind:"story",lines:["نور غروب رو روی خزش تصور می‌کنم…"]});
 assert.ok(notes.some(n=>n.stage==="planning"&&n.kind==="facts"),"the plan's goal and lens are said as facts");
 assert.equal((await orchestrateCreativeTurn({text:"یه عکس از یه گربه"},{planner:deterministicPlanner,triage:stub(null)})).status,"planned");
});
test("normalizeTriage: empty texts fall back to planning; choices are trimmed and capped at three; story lines end with an ellipsis",()=>{
 assert.deepEqual(normalizeTriage({...base,mode:"reply"}),{mode:"make",effort:"standard",storyFa:[]});
 assert.deepEqual(normalizeTriage({...base,mode:"ask",questionFa:"  "}),{mode:"make",effort:"standard",storyFa:[]});
 const a=normalizeTriage({...base,mode:"ask",questionFa:"کدومو؟",choices:[1,2,3,4].map(i=>({labelFa:" ایده "+i,replyFa:"بساز "+i})),react:"😂"});
 assert.equal(a.mode,"ask");if(a.mode==="ask"){assert.equal(a.choices.length,3);assert.equal(a.choices[0].labelFa,"ایده 1");assert.equal(a.react,"😂");}
 const m=normalizeTriage({...base,effort:"deep",storyFa:["نور رو می‌سنجم","نور رو می‌سنجم","زاویه رو پیدا می‌کنم."]});
 assert.deepEqual(m,{mode:"make",effort:"deep",storyFa:["نور رو می‌سنجم…","زاویه رو پیدا می‌کنم…"]});
});
test("owner (2026-11-07): routine fill-ins never send a plan to a second paid model",()=>{
 assert.equal(seriousCorrections(["camera_filled","shot_filled","continuity_filled","style_directives","role_directives"]),0);
 assert.equal(seriousCorrections(["media_kind","identity_overwritten","shot_filled"]),2);
});
test("the progress stream carries detail lines; a malformed note is skipped",()=>{
 const p=parseNdjson('{"type":"note","stage":"planning","kind":"story","lines":["نور…"]}\n{"type":"note","stage":"planning","lines":[1]}\n');
 assert.deepEqual(p.events,[{type:"note",stage:"planning",kind:"story",lines:["نور…"]}]);
});
test("a job keeps what was quoted so a failed one can run again; a malformed rerun is rejected",()=>{
 const T0="2026-11-07T00:00:00.000Z";
 const job=(rerun:unknown)=>({id:"m1",role:"agent",text:"x",at:T0,kind:"job",snapshot:{state:"failed",messageFa:"ساخت تصویر ناموفق بود",rerun}});
 const project=(m:unknown)=>({id:"11111111-2222-4333-8444-555555555555",title:"t",titleSource:"auto",createdAt:T0,updatedAt:T0,version:1,messages:[m],tagCounters:newTagCounters(),mode:"quality",style:null}) as unknown as Project;
 validateProject(project(job({turnId:"t1",modelId:"nano-banana-2-1",aspectRatio:"4:5"})));
 assert.throws(()=>validateProject(project(job({turnId:"t1"}))));
});
test("owner (2026-11-07): a request to make something plans alongside the triage; a greeting never starts a plan",async()=>{
 let planned=0;const planner=(r:Parameters<typeof deterministicPlanner>[0])=>{planned++;return deterministicPlanner(r);};
 const slow=(t:Triage):TurnTriager=>()=>new Promise(res=>setTimeout(()=>res(t),30));
 // A photo request: the planner starts before the triage answers, so its time overlaps; the plan stands when the triage says make.
 const r=await orchestrateCreativeTurn({text:"یه عکس از یه گربه"},{planner,triage:slow({mode:"make",effort:"standard",storyFa:[]})});
 assert.equal(r.status,"planned");assert.equal(planned,1);
 // The triage asks after all: its question wins and the plan is dropped.
 const q=await orchestrateCreativeTurn({text:"یه عکس برای کاور"},{planner,triage:slow({mode:"ask",leadFa:"بگو",questionFa:"موضوعش چیه؟",choices:[]})});
 assert.equal(q.status,"needs_input");
 // A greeting names nothing to make: no plan is started at all.
 planned=0;
 const g=await orchestrateCreativeTurn({text:"سلام خوبی؟"},{planner,triage:slow({mode:"reply",replyFa:"سلام! چی بسازیم؟"})});
 assert.equal(g.status,"reply");assert.equal(planned,0);
});
test("an emoji outside the reaction palette is dropped, never failing the triage (owner live test: «سلام» fell through)",()=>{
 const r=normalizeTriage({...base,mode:"reply",replyFa:"سلام!",react:"👋"});
 assert.deepEqual(r,{mode:"reply",replyFa:"سلام!"});
});
