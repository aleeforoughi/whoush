import {test,beforeEach,afterEach} from "node:test";
import assert from "node:assert/strict";
import {parseNdjson,STAGE_TEXT} from "../lib/agent-stream";
import {orchestrateCreativeTurn} from "../lib/orchestrator";
import {TURN_STAGES} from "../lib/orchestrator-stages";
/** A turn without research skips that stage (it runs only when the plan asks for research). */
const PLAIN_STAGES=TURN_STAGES.filter(s=>s!=="researching");
import {resetRouterStateForTests} from "../lib/llm-routing";
import {POST} from "../app/api/agent/route";

const ENV_KEYS=["LLM_PROVIDER_AUTHORIZED","ALLOW_LIVE_LLM","ANTHROPIC_API_KEY","OPENAI_API_KEY"];
let saved:Record<string,string|undefined>={};
beforeEach(()=>{resetRouterStateForTests();saved=Object.fromEntries(ENV_KEYS.map(k=>[k,process.env[k]]));for(const k of ENV_KEYS)delete process.env[k];});
afterEach(()=>{for(const k of ENV_KEYS){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}});

test("NDJSON events are read line by line across chunk boundaries; broken lines are skipped",()=>{
 const a=parseNdjson('{"type":"stage","stage":"reading"}\n{"type":"sta');
 assert.deepEqual(a.events,[{type:"stage",stage:"reading"}]);assert.equal(a.rest,'{"type":"sta');
 const b=parseNdjson(a.rest+'ge","stage":"planning"}\nnot json\n{"type":"result","status":200,"body":{"x":1}}\n');
 assert.deepEqual(b.events,[{type:"stage",stage:"planning"},{type:"result",status:200,body:{x:1}}]);assert.equal(b.rest,"");
});
test("a turn reports its real stages in order; a turn stopped at the preflight reports only reading",async()=>{
 const seen:string[]=[];await orchestrateCreativeTurn({text:"a photo of a lake"},{onStage:s=>seen.push(s)});
 assert.deepEqual(seen,[...PLAIN_STAGES]);
 const blocked:string[]=[];await orchestrateCreativeTurn({text:"campaign poster for President Trump"},{onStage:s=>blocked.push(s)});
 assert.deepEqual(blocked,["reading"]);
 for(const s of TURN_STAGES){assert.match(STAGE_TEXT.fa[s],/…$/);assert.ok(!/[؀-ۿ]/.test(STAGE_TEXT.finglish[s]));}
});
test("the route streams stage lines then the same result as the JSON API; without the header it answers JSON as before",async()=>{
 const body=JSON.stringify({text:"a photo of a lake"});
 const res=await POST(new Request("http://x/api/agent",{method:"POST",body,headers:{accept:"application/x-ndjson"}}));
 assert.match(res.headers.get("content-type")??"",/ndjson/);assert.equal(res.headers.get("cache-control"),"no-store");
 const {events,rest}=parseNdjson(await res.text());
 assert.equal(rest,"");assert.deepEqual(events.filter(e=>e.type==="stage").map(e=>(e as {stage:string}).stage),[...PLAIN_STAGES]);
 const result=events.at(-1) as {type:string;status:number;body:{selectedModelId?:string;plan?:unknown;turnId?:string}};
 assert.equal(result.type,"result");assert.equal(result.status,200);assert.ok(result.body.selectedModelId&&result.body.plan&&result.body.turnId);
 assert.ok(!JSON.stringify(events).match(/claude|gpt|openai|anthropic|mediaPrompt/i),"no private detail in the stream");
 const plain=await POST(new Request("http://x/api/agent",{method:"POST",body}));
 assert.equal(plain.status,200);assert.match(plain.headers.get("content-type")??"",/json/);
 const blocked=await POST(new Request("http://x/api/agent",{method:"POST",body:JSON.stringify({text:"campaign poster for President Trump"}),headers:{accept:"application/x-ndjson"}}));
 const be=parseNdjson(await blocked.text()).events.at(-1) as {status:number;body:{error:string}};
 assert.equal(be.status,422);assert.equal(be.body.error,"content_restricted");
});
