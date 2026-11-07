import {test,beforeEach,afterEach} from "node:test";
import assert from "node:assert/strict";
import {mediaIntent,MEDIA_KIND_QUESTION_FA,isQuestionChoices} from "../lib/media-intent";
import {detectMediaKind,requestedMediaKind} from "../lib/router";
import {orchestrateCreativeTurn,type OrchestratorResult} from "../lib/orchestrator";
import {resetRouterStateForTests} from "../lib/llm-routing";

const ENV_KEYS=["LLM_PROVIDER_AUTHORIZED","ALLOW_LIVE_LLM","ANTHROPIC_API_KEY","OPENAI_API_KEY"];
let saved:Record<string,string|undefined>={};
beforeEach(()=>{resetRouterStateForTests();saved=Object.fromEntries(ENV_KEYS.map(k=>[k,process.env[k]]));for(const k of ENV_KEYS)delete process.env[k];});
afterEach(()=>{for(const k of ENV_KEYS){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}});

const photo=(over:Record<string,unknown>={})=>({id:crypto.randomUUID(),tag:"image1",kind:"image",mime:"image/png",bytes:2048,sha256:"c".repeat(64),...over});
const kindOf=(r:OrchestratorResult)=>{assert.ok(r.status==="planned"||r.status==="unsupported",JSON.stringify(r));return r.plan.mediaKind;};

test("media intent: photo, video, both or nothing said; negations and joined words count, words inside other words do not",()=>{
 assert.equal(mediaIntent("یه عکس از یه گربه روی پشت‌بوم"),"image");
 assert.equal(mediaIntent("یه ویدیو از اسب که می‌دوه"),"video");
 assert.equal(mediaIntent("a short clip of the sea"),"video");
 assert.equal(mediaIntent("یه کلیپ ۵ ثانیه‌ای"),"video");
 assert.equal(mediaIntent("make it 10 seconds long"),"video","a length in seconds is a video");
 // The bug of 2026-11-06: «حرکت» and «emotion» were read as video; a story about movement is not a video request.
 assert.equal(mediaIntent("یه مرد که آروم به سمت دریا حرکت می‌کنه، غروب"),undefined);
 assert.equal(mediaIntent("a portrait full of emotion"),"image");
 assert.equal(mediaIntent("a woman with deep emotion in a cafe"),undefined);
 // Negations: the photo the user asked for wins over the video they did not want.
 assert.equal(mediaIntent("من عکس می‌خواستم نه ویدیو"),"image");
 assert.equal(mediaIntent("ویدیو نمی‌خوام، عکسشو بساز"),"image");
 assert.equal(mediaIntent("ویدیو نمی‌خوام"),"image","only a negated video: a photo");
 assert.equal(mediaIntent("not a video, a photo please"),"image");
 assert.equal(mediaIntent("عکس نه، ویدیو"),"video");
 // Both: joined words or «هر دو»; otherwise the photo is the video's source.
 assert.equal(mediaIntent("هر دو"),"both");
 assert.equal(mediaIntent("یه عکس و یه ویدیو ازش بساز"),"both");
 assert.equal(mediaIntent("photo and video please"),"both");
 assert.equal(mediaIntent("از این عکس یه ویدیو بساز"),"video");
 assert.equal(mediaIntent("Ye aks az daryache"),"image","Finglish");
 assert.equal(mediaIntent("یه داستان: پیرمردی کنار دریا منتظر قایقشه"),undefined);
 // The router: a named model says the kind; nothing said is a photo when a kind must be chosen.
 assert.equal(requestedMediaKind("با kling بساز"),"video");
 assert.equal(requestedMediaKind("پیرمردی کنار دریا"),undefined);
 assert.equal(detectMediaKind("پیرمردی کنار دریا"),"image");assert.equal(detectMediaKind("هر دو"),"video");
 assert.ok(isQuestionChoices([{id:"image",labelFa:"عکس",replyFa:"عکس"}]));assert.ok(!isQuestionChoices([{id:"x"}]));assert.ok(!isQuestionChoices([]));
});

test("photo or video: when nothing says, Whoush asks once with three answers, before any plan or price; the answer decides",async()=>{
 const story="پیرمردی کنار دریا منتظر قایقشه و باد موهاشو تکون می‌ده";
 const asked=await orchestrateCreativeTurn({text:story});
 assert.equal(asked.status,"needs_input");
 assert.ok(asked.status==="needs_input"&&asked.question===MEDIA_KIND_QUESTION_FA&&asked.choices?.map(c=>c.id).join()==="image,video,both");
 assert.equal(kindOf(await orchestrateCreativeTurn({text:story+"\nعکس",answersQuestion:true})),"image");
 assert.equal(kindOf(await orchestrateCreativeTurn({text:story+"\nویدیو",answersQuestion:true})),"video");
 const both=await orchestrateCreativeTurn({text:story+"\nهر دو",answersQuestion:true});
 assert.equal(kindOf(both),"video");assert.ok(both.status==="planned"&&both.proposal.draft&&both.proposal.message.includes("هر دو رو می‌سازم"),"both: the opening-frame photo, then the video");
 assert.equal(kindOf(await orchestrateCreativeTurn({text:story+"\nنمی‌دونم",answersQuestion:true})),"image","never asked twice: an answer that says nothing gets a photo");
 // Not asked when the chat already said it, or when the message works with something in the chat.
 assert.equal(kindOf(await orchestrateCreativeTurn({text:story,history:[{role:"user",text:"ویدیو"},{role:"agent",text:"حله"}]})),"video");
 assert.equal(kindOf(await orchestrateCreativeTurn({text:story,generations:[{tag:"generation1",mediaKind:"video",summaryFa:"ویدیوی پیرمرد"}]})),"video");
 assert.equal((await orchestrateCreativeTurn({text:story,attachments:[photo({role:"environment"})]})).status,"unsupported","a file: no question (uninspected media still stops before a price)");
});

test("an explicit photo after a video wins: the plan and the offered models are both photos (the bug of 2026-11-06)",async()=>{
 const gen=[{tag:"generation1",mediaKind:"video" as const,summaryFa:"ویدیوی پیرمرد کنار دریا"}];
 const r=await orchestrateCreativeTurn({text:"#تولید-۱ رو عکس می‌خواستم نه ویدیو",generations:gen});
 assert.equal(kindOf(r),"image");
 assert.ok(r.status==="planned"&&r.proposal.operation==="generate_image","the model list follows the plan, not the words");
 const v=await orchestrateCreativeTurn({text:"#تولید-۱ رو یه کم آروم‌تر کن",generations:gen});
 assert.ok(v.status==="planned"&&v.plan.mediaKind==="video"&&v.proposal.operation==="generate_video","a change that does not say keeps the generation's kind, models included");
});

test("references already in the chat are reused instead of asked for again; unsure ones are confirmed once; a saved character covers a face",async()=>{
 const brief="یه عکس از خودم کنار دریا";
 const first=await orchestrateCreativeTurn({text:brief});
 assert.ok(first.status==="needs_input"&&first.references?.need==="face","no photo anywhere: ask for the face photos");
 // The face photos were sent with an earlier message (as answers to that card): used as they are, no question.
 const faces=[photo({tag:"image1",role:"character"}),photo({tag:"image2",role:"character"}),photo({tag:"image3",role:"character"})];
 const reused=await orchestrateCreativeTurn({text:"حالا یه عکس از خودم توی کوه",priorAttachments:faces});
 assert.equal(reused.status,"unsupported","used: the turn goes on to the (still closed) media review instead of asking again");
 assert.ok(reused.status==="unsupported"&&reused.plan.references.map(r=>r.tag).join()==="image1,image2,image3");
 // Earlier photos with no fitting role: one question, «آره، همونا» uses them.
 const loose=[photo({tag:"image4"})];
 const confirm=await orchestrateCreativeTurn({text:"یه عکس از خودم توی کوه",priorAttachments:loose});
 assert.ok(confirm.status==="needs_input"&&confirm.question.includes("#تصویر-۴")&&confirm.choices?.[0].id==="reuse"&&confirm.references?.need==="face");
 const yes=await orchestrateCreativeTurn({text:"یه عکس از خودم توی کوه\nآره، همونا رو استفاده کن",answersQuestion:true,priorAttachments:loose,
  history:[{role:"user",text:"یه عکس از خودم توی کوه"},{role:"agent",text:confirm.status==="needs_input"?confirm.question:""}]});
 assert.ok(yes.status==="unsupported"&&yes.plan.references.some(r=>r.tag==="image4"&&r.role==="character"));
 // A saved character is the face: nothing to ask.
 const ch=await orchestrateCreativeTurn({text:brief,characterRef:{id:"char-abcdef12",name:"سارا",angles:["front","profile_left"],version:1}});
 assert.notEqual(ch.status,"needs_input");
 // Answering the photo-or-video question still gets the photo question once.
 const kindFirst=await orchestrateCreativeTurn({text:"خودم کنار دریا"});
 assert.ok(kindFirst.status==="needs_input"&&kindFirst.question===MEDIA_KIND_QUESTION_FA);
 const then=await orchestrateCreativeTurn({text:"خودم کنار دریا\nعکس",answersQuestion:true,history:[{role:"user",text:"خودم کنار دریا"},{role:"agent",text:MEDIA_KIND_QUESTION_FA}]});
 assert.ok(then.status==="needs_input"&&then.references?.need==="face");
});
