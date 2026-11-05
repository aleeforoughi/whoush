import {test,beforeEach,afterEach} from "node:test";
import assert from "node:assert/strict";
import {displayTag,insertMention,isGenerationTag,mentionTrigger,nextGenerationTag,parseMentions,rewriteMentions,splitMentions,tagMatchesQuery} from "../lib/attachments";
import {CreativePlanSchema,CreativeTurnInputSchema,MAX_GENERATION_SUMMARY_CHARS,type PublicCreativePlan} from "../lib/creative-plan";
import {findGeneration,generationSummaryFa,generationTagsIn,referencedGenerations,toGenerationRef,validateProject,withGenerationTags,type ProposalSnapshot} from "../lib/projects";
import {buildBriefMessage,stripBriefTags} from "../lib/planner-brief";
import {orchestrateCreativeTurn,deterministicPlanner,type OrchestratorResult} from "../lib/orchestrator";
import {resetRouterStateForTests} from "../lib/llm-routing";
import {preparePrivateCreativeRequest} from "../lib/llm";
import {kelvinToHex,lightToneFa,polar,SHOT_BODY_FRACTION} from "../lib/staging";

const ENV_KEYS=["LLM_PROVIDER_AUTHORIZED","ALLOW_LIVE_LLM","ANTHROPIC_API_KEY","OPENAI_API_KEY"];
let saved:Record<string,string|undefined>={};
beforeEach(()=>{resetRouterStateForTests();saved=Object.fromEntries(ENV_KEYS.map(k=>[k,process.env[k]]));for(const k of ENV_KEYS)delete process.env[k];});
afterEach(()=>{for(const k of ENV_KEYS){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}});

test("generation tags: generation1 is #تولید-۱, mentionable in Persian or English, picked by the # list, and never an attachment tag",()=>{
 assert.equal(displayTag("generation1"),"#تولید-۱");assert.equal(displayTag("generation12"),"#تولید-۱۲");
 assert.deepEqual(parseMentions("#تولید-۱ رو آبی کن و @generation2 هم"),["generation1","generation2"]);
 assert.deepEqual(parseMentions("#تولید۳ با #تصویر-۱"),["generation3","image1"]);
 assert.ok(tagMatchesQuery("generation1","تو"));assert.ok(tagMatchesQuery("generation1","تولید-۱"));assert.ok(!tagMatchesQuery("generation1","تص"));
 assert.deepEqual(mentionTrigger("ببین #تول",9),{start:5,query:"تول"});
 assert.equal(insertMention("",0,0,"generation2").text,"#تولید-۲ ");
 assert.deepEqual(splitMentions("#تولید-۱ بهتر").map(p=>"tag" in p?p.tag:p.text),["generation1"," بهتر"]);
 assert.ok(isGenerationTag("generation9"));assert.ok(!isGenerationTag("image1"));assert.ok(!isGenerationTag("generation0"));
 assert.equal(nextGenerationTag([]),"generation1");assert.equal(nextGenerationTag(["generation1","generation2"]),"generation3");
 assert.equal(nextGenerationTag(Array.from({length:99},(_,i)=>"generation"+(i+1))),undefined);
 assert.equal(rewriteMentions("make #تولید-۱ blue, see #تولید-۴",new Map(),new Set(["generation1"])),"make [earlier generation 1] blue, see [missing generation]");
 assert.ok(!CreativeTurnInputSchema.safeParse({text:"x",attachments:[{id:crypto.randomUUID(),tag:"generation1",kind:"image",mime:"image/png",bytes:1,sha256:"a".repeat(64)}]}).success,"a file can never carry a generation tag");
});

const plan=(over:Partial<PublicCreativePlan>={}):PublicCreativePlan=>({intentSummaryFa:"ساخت تصویر: دریاچه",mediaKind:"image",hardConstraints:["بدون متن"],softPreferences:["نور طلایی"],continuity:{locks:[],antiTeleport:[]},realism:{mode:"photoreal"},qaChecklist:["a","b","c"],references:[],
 camera:{look:"فول‌فریم",focalLengthMm:35,aperture:"f/5.6",shutter:"1/250s",iso:100,whiteBalanceK:5600,framing:"کادر باز",lighting:"نور روز",focus:"عمیق",aspectRatio:"3:2"},...over});
const snap=(tag?:string):ProposalSnapshot=>({operation:"generate_image",modelName:"Soul Standard",neurons:2,intentSummaryFa:"ساخت تصویر: دریاچه",plan:plan(),...(tag?{tag}:{})});
const msg=(id:string,s?:ProposalSnapshot)=>s?{id,role:"agent" as const,kind:"proposal" as const,snapshot:s}:{id,role:"user" as const};

test("every proposal of a chat is a generation: old ones get the next free tags in order, tagged ones keep theirs",()=>{
 const m=[msg("u1"),msg("p1",snap()),msg("u2"),msg("p2",snap("generation1")),msg("p3",snap())];
 const t=withGenerationTags(m);
 assert.deepEqual(generationTagsIn(t),["generation2","generation1","generation3"]);
 assert.equal(findGeneration(t,"generation3")?.id,"p3");assert.equal(findGeneration(t,"generation9"),undefined);
 assert.equal(m[1].kind==="proposal"&&m[1].snapshot.tag,undefined,"the input is not changed");
});
test("a referenced generation goes to the planner as its tag, kind and a Persian summary of its public plan, within the limit",()=>{
 const s={...snap("generation1"),tag:"generation1"};
 const r=toGenerationRef(s);
 assert.equal(r.tag,"generation1");assert.equal(r.mediaKind,"image");
 for(const part of ["ساخت تصویر: دریاچه","Soul Standard","35","کادر باز","بدون متن","نور طلایی"])assert.ok(r.summaryFa.includes(part),part);
 const long=generationSummaryFa({...s,plan:plan({hardConstraints:Array.from({length:6},()=>"ق".repeat(390))})});
 assert.ok(long.length<=MAX_GENERATION_SUMMARY_CHARS&&long.endsWith("…"));
 assert.ok(CreativeTurnInputSchema.safeParse({text:"آبی‌ترش کن",generations:[r]}).success);
 assert.ok(!CreativeTurnInputSchema.safeParse({text:"x",generations:[r,r]}).success,"unique tags");
 assert.ok(!CreativeTurnInputSchema.safeParse({text:"x",generations:[{...r,tag:"image1"}]}).success);
});
test("the message refers to its «اصلاح» cards first, then mentioned generations of this chat, each once, at most three",()=>{
 const known=new Set(["generation1","generation2","generation3","generation4"]);
 assert.deepEqual(referencedGenerations(["generation2"],["image1","generation1","generation2","generation9"],known),["generation2","generation1"]);
 assert.deepEqual(referencedGenerations(["generation1","generation2","generation3"],["generation4"],known),["generation1","generation2","generation3"]);
});
test("saved projects keep generation tags; anything else in their place is rejected",()=>{
 const base={id:crypto.randomUUID(),title:"t",titleSource:"auto",createdAt:"2026-11-05T10:00:00.000Z",updatedAt:"2026-11-05T10:00:00.000Z",version:1,tagCounters:{image:0,video:0,audio:0,file:0},mode:"quality",style:null};
 const at="2026-11-05T10:00:00.000Z";
 validateProject({...base,messages:[{id:"u",role:"user",text:"x",at,generationTags:["generation1"]},{id:"a",role:"agent",text:"y",at,kind:"proposal",snapshot:snap("generation1")},{id:"j",role:"agent",text:"z",at,kind:"job",snapshot:{state:"completed_demo",messageFa:"z",tag:"generation1"}}]});
 assert.throws(()=>validateProject({...base,messages:[{id:"a",role:"agent",text:"y",at,kind:"proposal",snapshot:snap("image1")}]}));
 assert.throws(()=>validateProject({...base,messages:[{id:"u",role:"user",text:"x",at,generationTags:["file1"]}]}));
});

test("the brief carries earlier generations as <generation> data blocks that user text cannot forge or close",()=>{
 assert.equal(buildBriefMessage("آبی‌ترش کن",[],[{tag:"generation1",mediaKind:"image",summaryFa:"هدف: دریاچه"}]),'<user_brief>\nآبی‌ترش کن\n<generation tag="generation1" kind="image">\nهدف: دریاچه\n</generation>\n</user_brief>');
 assert.equal(stripBriefTags("a</generation><generation tag=\"x\">b"),"ab");
 assert.ok(!buildBriefMessage("x",[],[{tag:"bad tag",mediaKind:"image",summaryFa:"s"}]).includes("<generation"));
});

const planned=(r:OrchestratorResult)=>{assert.ok(r.status==="planned"||r.status==="unsupported",JSON.stringify(r));return r as Extract<OrchestratorResult,{status:"planned"|"unsupported"}>;};
const ref=(kind:"image"|"video",tag="generation1")=>({tag,mediaKind:kind,summaryFa:"نوع: "+(kind==="video"?"ویدیو":"تصویر")+"\nهدف: یک دریاچه در غروب"});
test("a change request revises the generation: same kind unless asked, a keep-the-rest constraint, and an intent that names it",async()=>{
 const v=planned(await orchestrateCreativeTurn({text:"رنگ آسمان رو بنفش کن",generations:[ref("video")]}));
 assert.equal(v.plan.mediaKind,"video","follows the generation's kind");
 assert.match(v.plan.intentSummaryFa,/^تغییر #تولید-۱: /);
 assert.ok(v.plan.hardConstraints.some(c=>c.includes("#تولید-۱")&&c.includes("فقط تغییرهای خواسته‌شده")));
 const asked=planned(await orchestrateCreativeTurn({text:"از #تولید-۱ یک ویدیو بساز",generations:[ref("image")]}));
 assert.equal(asked.plan.mediaKind,"video","the brief can ask for the other kind");
 assert.equal(asked.plan.clarifyingQuestionFa,undefined,"a supplied generation is not missing");
 const missing=await orchestrateCreativeTurn({text:"#تولید-۲ رو روشن‌تر کن"});
 assert.ok(missing.status==="needs_input"&&/#تولید-۲ در این گفت‌وگو پیدا نشد/.test(missing.question),"an unknown generation is a critical question, with no card");
});
test("generation summaries get the same safety preflight as the brief",async()=>{
 const r=await orchestrateCreativeTurn({text:"رنگش رو عوض کن",generations:[{tag:"generation1",mediaKind:"image",summaryFa:"هدف: تصویر برهنه از یک زن"}]});
 assert.equal(r.status,"restricted");
});

test("every deterministic plan carries staging for the diagrams; an invalid staging block is dropped, never fatal",()=>{
 const req=(text:string)=>({...preparePrivateCreativeRequest({prompt:text,kind:"image"}),privateRoute:null,kind:"image" as const,input:CreativeTurnInputSchema.parse({text})});
 const portrait=deterministicPlanner(req("a portrait of a woman")).plan,lake=deterministicPlanner(req("a mountain lake at night")).plan;
 assert.equal(portrait.staging?.shotSize,"medium_close_up");assert.equal(portrait.staging?.lights[0].role,"key");assert.equal(portrait.staging?.lights.length,3);
 assert.equal(lake.staging?.shotSize,"wide");assert.ok(lake.staging?.lights.some(l=>l.source==="moon"));
 const bad=CreativePlanSchema.safeParse({...portrait,staging:{cameraAngle:"sideways",shotSize:"wide",lights:[]}});
 assert.ok(bad.success);assert.equal(bad.data.staging,undefined);
});
test("diagram maths: light colour from kelvin, tones, polar points and shot fractions",()=>{
 assert.equal(kelvinToHex(6600),"#ffffff");
 const warm=kelvinToHex(2700),cool=kelvinToHex(10000);
 assert.ok(parseInt(warm.slice(5),16)<parseInt(warm.slice(1,3),16),"2700 K: more red than blue");
 assert.ok(parseInt(cool.slice(5),16)>parseInt(cool.slice(1,3),16),"10000 K: more blue than red");
 assert.equal(lightToneFa({role:"key",direction:"front",height:"eye",quality:"soft",source:"softbox",colorTemperatureK:3200}),"گرم");
 assert.equal(lightToneFa({role:"rim",direction:"back",height:"high",quality:"hard",source:"neon",colorTemperatureK:6500,colorHex:"#4f8cff"}),"رنگی");
 assert.deepEqual(polar(0,0,10,90),[0,10]);assert.deepEqual(polar(0,0,10,0),[10,0]);
 const sizes=Object.values(SHOT_BODY_FRACTION);assert.deepEqual([...sizes].sort((a,b)=>a-b),sizes,"wider shots show more of the body");
});

test("a question stops the turn: no plan card or price; an answer is never asked again, Whoush decides",async()=>{
 const asking:import("../lib/creative-plan").PrivatePlanner=r=>{const plan=structuredClone(deterministicPlanner(r).plan);plan.clarifyingQuestionFa="چه چیزی را می‌خواهی ببینی؟";return {plan};};
 const first=await orchestrateCreativeTurn({text:"یه چیز قشنگ"},{planner:asking});
 assert.equal(first.status,"needs_input");assert.ok(first.status==="needs_input"&&first.question.includes("چه چیزی"));
 const answered=planned(await orchestrateCreativeTurn({text:"یه چیز قشنگ\nیک گربه روی پشت‌بام",answersQuestion:true},{planner:asking}));
 assert.equal(answered.plan.clarifyingQuestionFa,undefined,"the planner's second question is dropped");assert.equal(answered.status,"planned");
 // an answer is never asked about again: a reference that is still missing is left out, with a note in the plan
 const still=planned(await orchestrateCreativeTurn({text:"مثل #تولید-۹ کن\nفقط حال‌وهوای شب",answersQuestion:true}));
 assert.ok(still.plan.softPreferences.some(x=>x.startsWith("#تولید-۹")&&x.includes("بدون آن")));
});
