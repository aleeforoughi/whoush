import {test} from "node:test";
import assert from "node:assert/strict";
import {normalizeTriage,type Triage,type TriageInput,type TurnTriager} from "../lib/turn-triage";
import {reviewVideoUpload} from "../lib/video-review";
import {forgetReviewsForTests} from "../lib/upload-review";
import {orchestrateCreativeTurn,deterministicPlanner,seriousCorrections,faMediaReview,resumeAfterReview,RESUME_QUESTION_FA,type OrchestratorResult} from "../lib/orchestrator";
import {parseNdjson} from "../lib/agent-stream";
import {historyFor,validateProject,type Project} from "../lib/projects";
import {MAX_HISTORY_TOTAL_CHARS,MAX_HISTORY_TURNS} from "../lib/creative-plan";
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
test("owner (2026-11-08): triage is told each file's real check state, so «تموم شد؟» is never answered with an invented 'still checking'",async()=>{
 forgetReviewsForTests();
 const ok=await reviewVideoUpload(new Uint8Array([0,0,0,24,0x66,0x74,0x79,0x70,0x69,0x73,0x6f,0x6d,0,0,0]),"video/mp4",{sample:async()=>[new Uint8Array([1])],inspect:async()=>({category:"none",person:false}),soundtrack:async()=>"clean",store:async()=>({id:"44444444-4444-4444-8444-444444444444",url:"/x"})});
 const att=(tag:string,kind:"video"|"image",reviewId?:string)=>({id:crypto.randomUUID(),tag,kind,mime:kind==="video"?"video/mp4":"image/jpeg",width:64,height:64,...(kind==="video"?{durationSeconds:3}:{}),bytes:2048,sha256:"d".repeat(64),...(reviewId?{reviewId}:{})});
 let seen:TriageInput["files"];
 await orchestrateCreativeTurn({text:"تموم شد؟",priorAttachments:[att("video2","video",ok.reviewId),att("image1","image")]},{planner:deterministicPlanner,triage:async i=>{seen=i.files;return {mode:"reply",replyFa:"آره، #ویدیو-۲ بررسی شد."};}});
 assert.deepEqual(seen,[{tagFa:"#ویدیو-۲",checked:true},{tagFa:"#تصویر-۱",checked:false}]);
});
test("owner (2026-11-08): «تموم شد؟» after files were set aside: once they all passed, Whoush says so and offers the same request again with one tap",async()=>{
 forgetReviewsForTests();
 const ok=await reviewVideoUpload(new Uint8Array([0,0,0,24,0x66,0x74,0x79,0x70,0x69,0x73,0x6f,0x6d,0,0,0]),"video/mp4",{sample:async()=>[new Uint8Array([1])],inspect:async()=>({category:"none",person:false}),soundtrack:async()=>"clean",store:async()=>({id:"55555555-5555-4555-8555-555555555555",url:"/x"})});
 const video=(reviewId?:string)=>({id:crypto.randomUUID(),tag:"video2",kind:"video" as const,mime:"video/mp4",width:64,height:64,durationSeconds:3,bytes:2048,sha256:"e".repeat(64),...(reviewId?{reviewId}:{})});
 const request="آدم اول این فیلم رو عوض کن #ویدیو-۲";
 const history=[{role:"user" as const,text:request},{role:"agent" as const,text:faMediaReview(["#ویدیو-۲"],["video"])}];
 let triaged=0;const triage:TurnTriager=async()=>{triaged++;return {mode:"reply",replyFa:"هنوز دارم بررسی می‌کنم"};};
 const r=await orchestrateCreativeTurn({text:"تموم شد؟",history,priorAttachments:[video(ok.reviewId)]},{planner:deterministicPlanner,triage});
 assert.equal(r.status,"needs_input");assert.equal(triaged,0,"facts, not a guess");
 const q=r as Extract<OrchestratorResult,{status:"needs_input"}>;
 assert.match(q.message,/#ویدیو-۲/);assert.equal(q.choices?.[0].replyFa,request);assert.equal(q.question,RESUME_QUESTION_FA);
 assert.equal(resumeAfterReview("تموم شد؟",0,history,[video()]),undefined,"still unchecked: no offer");
 assert.equal(resumeAfterReview("یه گربه بساز",0,history,[video(ok.reviewId)]),undefined,"a new request is not a status question");
});
test("owner (2026-11-08): Whoush reads the chat again: the whole chat goes with a message, newest first within the budget",()=>{
 const long=Array.from({length:60},(_,k)=>({role:(k%2?"agent":"user") as "user"|"agent",text:"پیام "+k+" "+"ا".repeat(900)}));
 const h=historyFor(long);
 assert.ok(h.length<=MAX_HISTORY_TURNS&&h.reduce((n,t)=>n+t.text.length,0)<=MAX_HISTORY_TOTAL_CHARS);
 assert.match(h.at(-1)!.text,/^پیام 59 /,"the newest message is always there");
 const short=historyFor(Array.from({length:30},(_,k)=>({role:(k%2?"agent":"user") as "user"|"agent",text:"پیام "+k})));
 assert.equal(short.length,30,"a normal chat is read in full, not only its last 8 messages");
 assert.equal(short[0].text,"پیام 0");
});
test("owner live chat (2026-11-08): the request is resumed even after made-up 'still checking' replies, from its brief and its #files message",async()=>{
 forgetReviewsForTests();
 const ok=await reviewVideoUpload(new Uint8Array([0,0,0,24,0x66,0x74,0x79,0x70,0x69,0x73,0x6f,0x6d,0,0,0]),"video/mp4",{sample:async()=>[new Uint8Array([1])],inspect:async()=>({category:"none",person:false}),soundtrack:async()=>"clean",store:async()=>({id:"66666666-6666-4666-8666-666666666666",url:"/x"})});
 const video={id:crypto.randomUUID(),tag:"video2",kind:"video",mime:"video/mp4",reviewId:ok.reviewId};
 const brief="می‌خوام همه حرکات این فیلم رو نگه دارم ولی آدم اول رو ریپلیس کنم.";
 const history=[{role:"user" as const,text:brief},{role:"user" as const,text:brief+" #ویدیو-۲"},{role:"user" as const,text:"#ویدیو-۲"},
  {role:"agent" as const,text:faMediaReview(["#ویدیو-۲"],["video"])},{role:"user" as const,text:"ایمنی شد؟"},{role:"agent" as const,text:"هنوز نه، خبرت می‌کنم."}];
 const r=resumeAfterReview("تموم شد؟",0,history,[video]);
 assert.equal(r?.request,brief+" #ویدیو-۲","each message once, the one already inside another dropped");
 assert.equal(resumeAfterReview("تموم شد؟",0,[...history,{role:"user",text:"نه ولش کن، یه گربه‌ی نارنجی روی پشت‌بوم تهران بساز با نور غروب"}],[video]),undefined,"a new request since: nothing to resume");
});
