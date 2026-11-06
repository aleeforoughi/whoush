import {test,beforeEach,afterEach} from "node:test";
import assert from "node:assert/strict";
import {mainSubjectRule,shownTag,typedMainSubject} from "../lib/main-subject";
import {CreativeTurnInputSchema} from "../lib/creative-plan";
import {orchestrateCreativeTurn,getPrivateMediaPrompt,type OrchestratorResult} from "../lib/orchestrator";
import {resetRouterStateForTests} from "../lib/llm-routing";

const ENV_KEYS=["LLM_PROVIDER_AUTHORIZED","ALLOW_LIVE_LLM","ANTHROPIC_API_KEY","OPENAI_API_KEY"];
let saved:Record<string,string|undefined>={};
beforeEach(()=>{resetRouterStateForTests();saved=Object.fromEntries(ENV_KEYS.map(k=>[k,process.env[k]]));for(const k of ENV_KEYS)delete process.env[k];});
afterEach(()=>{for(const k of ENV_KEYS){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}});
const gen={tag:"generation1",mediaKind:"image" as const,summaryFa:"عکس یه فنجون قهوه کنار کتاب"};
const plan=(r:OrchestratorResult)=>{assert.ok(r.status==="planned"||r.status==="unsupported",JSON.stringify(r));return r;};

test("main subject: typed next to a #, shown by its Persian tag, and its rule leads the plan in Persian and the prompt in English",()=>{
 assert.equal(typedMainSubject("#تصویر-۱ سوژه اصلیه، بقیه پس‌زمینه"),"image1");
 assert.equal(typedMainSubject("یه عکس با #تصویر-۱ و #تصویر-۲ که سوژه‌ی اصلی #تصویر-۲ باشه"),"image2","the nearest #");
 assert.equal(typedMainSubject("make @image3 the main subject"),"image3");
 assert.equal(typedMainSubject("#تصویر-۱ و #تصویر-۲ کنار هم"),undefined,"nothing said: none");
 assert.equal(shownTag("generation2"),"#تولید-۲");assert.equal(shownTag("#زن"),"#زن");
 const r=mainSubjectRule("image1","video");
 assert.ok(r.fa.startsWith("#تصویر-۱ سوژهٔ اصلی است")&&r.fa.includes("ویدیو"));assert.ok(r.en.includes("Main subject: #تصویر-۱")&&r.en.includes("whole shot"));
 assert.ok(CreativeTurnInputSchema.safeParse({text:"x",mainSubject:"generation1"}).success);
});

test("main subject: chosen with the star or written, the whole work is built around it; unknown ones are ignored, never blocking",async()=>{
 const starred=plan(await orchestrateCreativeTurn({text:"یه عکس از #تولید-۱ با نور صبح",generations:[gen],mainSubject:"generation1"}));
 assert.equal(starred.plan.mainSubject,"generation1");
 assert.ok(starred.plan.hardConstraints[0].startsWith("#تولید-۱ سوژهٔ اصلی است"),"the first hard rule");
 const prompt=getPrivateMediaPrompt(starred.turnId)!;
 assert.ok(/Main subject: \[earlier generation 1\]\. Build the whole image around it/.test(prompt),"provider prompt: the tag becomes its description");
 const typed=plan(await orchestrateCreativeTurn({text:"یه عکس از #تولید-۱ که سوژه اصلیه، نور صبح",generations:[gen]}));
 assert.equal(typed.plan.mainSubject,"generation1");
 const unknown=plan(await orchestrateCreativeTurn({text:"یه عکس از یه فنجون قهوه",mainSubject:"image7"}));
 assert.equal(unknown.plan.mainSubject,undefined,"not in the chat: ignored");
 const none=plan(await orchestrateCreativeTurn({text:"یه عکس از #تولید-۱",generations:[gen]}));
 assert.equal(none.plan.mainSubject,undefined,"optional: nothing chosen, nothing added");
 assert.ok(!none.plan.hardConstraints.some(c=>c.includes("سوژهٔ اصلی")));
});
