import {test} from "node:test";
import assert from "node:assert/strict";
import {editorSegments,removeBadge} from "../lib/mention-editor";
import {estimateProgress,isActiveJob,isOwnedOutputUrl,jobStatusFa,TYPICAL_MS} from "../lib/job-progress";
import {answerBrief,validateProject} from "../lib/projects";

const known=new Set(["image1","generation1","generation12"]);

test("prompt badges: a known mention is a badge once the caret has moved past it; unknown tags and plain hashtags stay text",()=>{
 const r=editorSegments("#تولید-۱ رو آبی کن",known,17);
 assert.deepEqual(r.segments,[{tag:"generation1"},{text:" رو آبی کن"}]);assert.equal(r.value,"#تولید-۱ رو آبی کن");assert.equal(r.caret,17);
 assert.deepEqual(editorSegments("ببین #تولید-۱",known,13).segments,[{text:"ببین #تولید-۱"}],"still typing: #تولید-۱ may become #تولید-۱۲");
 assert.deepEqual(editorSegments("ببین #تولید-۱۲ ",known,15).segments,[{text:"ببین "},{tag:"generation12"},{text:" "}]);
 assert.deepEqual(editorSegments("#تصویر-۹ و #نوروز",known).segments,[{text:"#تصویر-۹ و #نوروز"}],"not in this chat, or not a tag");
 const legacy=editorSegments("با @image1 و #تصویر۱ ",known,21);
 assert.equal(legacy.value,"با #تصویر-۱ و #تصویر-۱ ","a badge is always the canonical tag");assert.equal(legacy.caret,legacy.value.length);
});
test("prompt badges: a caret inside a badge's text moves after it, one at its start stays before it, and removing a badge leaves the caret where it was",()=>{
 assert.equal(editorSegments("x #تصویر-۱ y",known,5).caret,10);
 assert.equal(editorSegments("x #تصویر-۱ y",known,2).caret,2);
 const segs=editorSegments("a #تصویر-۱ b #تولید-۱ c",known).segments;
 assert.deepEqual(removeBadge(segs,1),{value:"a #تصویر-۱ b  c",caret:13});
 assert.deepEqual(removeBadge(segs,0),{value:"a  b #تولید-۱ c",caret:2});
});

test("generation progress is an estimate: it eases to 95% while running and reaches 100% only when the provider reports completion",()=>{
 assert.equal(estimateProgress("queued",0),0);assert.ok(estimateProgress("queued",60_000)!<=12);
 const run=(ms:number,k:"image"|"video"="image")=>estimateProgress("running",ms,k)!;
 assert.equal(run(0),12);assert.ok(run(5_000)<run(15_000)&&run(15_000)<run(60_000),"rises with time");
 assert.equal(run(10*60_000),95,"never 100 while running");
 assert.ok(run(TYPICAL_MS.image,"video")<run(TYPICAL_MS.image,"image"),"video is paced slower");
 assert.equal(estimateProgress("completed_demo",0),100);assert.equal(estimateProgress("failed",5000),null);
 assert.ok(isActiveJob("queued")&&isActiveJob("running")&&!isActiveJob("completed")&&!isActiveJob("canceled"));
});
test("the live status line names only real facts: state, kind and model",()=>{
 assert.equal(jobStatusFa("running","image","Soul Standard"),"در حال ساخت تصویر با Soul Standard…");
 assert.equal(jobStatusFa("queued","video"),"در صف سرویس ساخت…");assert.equal(jobStatusFa("submitted","image"),"در صف سرویس ساخت…");
 for(const s of ["quoted","approved","reserved"])assert.ok(!jobStatusFa(s).includes("آماده‌سازی…")||jobStatusFa(s)!=="در حال آماده‌سازی…",s);
 assert.equal(jobStatusFa("completed_demo","video"),"ساخت ویدیو تمام شد");
});
test("only a Whoush-owned output URL is shown; provider URLs keep the placeholder (launch gate 8)",()=>{
 assert.ok(isOwnedOutputUrl("/media/abc.png"));assert.ok(isOwnedOutputUrl("https://whoush.app/m/1.png","https://whoush.app"));
 assert.ok(!isOwnedOutputUrl("https://cdn.provider.example/out.png","https://whoush.app"));assert.ok(!isOwnedOutputUrl("//evil.example/x.png"));
 assert.ok(!isOwnedOutputUrl("not a url","https://whoush.app"));
});

test("an answer to Whoush's question is sent with the original request; the original is shortened to fit, never the answer",()=>{
 assert.equal(answerBrief("یه چیز قشنگ","یک گربه"),"یه چیز قشنگ\nیک گربه");
 const long=answerBrief("ا".repeat(4000),"جواب کوتاه");
 assert.equal(long.length,4000);assert.ok(long.endsWith("\nجواب کوتاه"));
});
test("saved projects keep Whoush's questions and the brief an answer was sent with",()=>{
 const at="2026-11-05T10:00:00.000Z",base={id:crypto.randomUUID(),title:"t",titleSource:"auto",createdAt:at,updatedAt:at,version:1,tagCounters:{image:0,video:0,audio:0,file:0},mode:"quality",style:null};
 validateProject({...base,messages:[{id:"u",role:"user",text:"یه چیز",at},{id:"q",role:"agent",text:"سؤال",at,kind:"question",snapshot:{question:"چه چیزی؟"}},{id:"u2",role:"user",text:"گربه",at,brief:"یه چیز\nگربه"}]});
 assert.throws(()=>validateProject({...base,messages:[{id:"q",role:"agent",text:"x",at,kind:"question",snapshot:{question:""}}]}));
 assert.throws(()=>validateProject({...base,messages:[{id:"u",role:"user",text:"x",at,brief:"ا".repeat(4001)}]}));
});
