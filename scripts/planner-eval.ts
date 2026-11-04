/**
 * Offline Persian planner evaluation. Run (the owner/lead runs it; it makes real model calls):
 *   node --conditions=react-server --import tsx scripts/planner-eval.ts --models claude-sonnet-5-5,gpt-6.1-sol [--limit N] [--out DIR] [--dry-run]
 * `--limit 0` or `--dry-run` validates the prompt file and the full pipeline with the deterministic planner and makes NO API call.
 * Keys are read from .env.local into process.env (never printed). Prompts are never logged; only ids.
 */
import {readFileSync,existsSync,mkdirSync,writeFileSync} from "node:fs";
import {join,resolve} from "node:path";
import {orchestrateCreativeTurn,deterministicPlanner} from "../lib/orchestrator";
import {CreativeTurnInputSchema,type PrivatePlanner,type PublicCreativePlan} from "../lib/creative-plan";
import {providerForModelId} from "../lib/llm";
import {planWithAnthropic} from "../lib/llm-anthropic";
import {planWithOpenAI} from "../lib/llm-openai";
import type {PrivateAuditRecord,PrivateAuditSink} from "../lib/private-audit";
import {EvalPromptsSchema,applyEnv,completeness,estimateCostUsd,normalizeUsage,parseEnvFile,persianRatio,publicStrings,renderReport,scoreMentions,summarize,type EvalPrompt,type EvalRun} from "./planner-eval-lib";

const KEY_FOR={anthropic:"ANTHROPIC_API_KEY",openai:"OPENAI_API_KEY"} as const;
function args(argv:string[]){
 const o:{models:string[];limit:number|null;out:string|null;dry:boolean}={models:[],limit:null,out:null,dry:false};
 for(let i=0;i<argv.length;i++){
  const a=argv[i];
  if(a==="--models")o.models=(argv[++i]??"").split(",").map(s=>s.trim()).filter(Boolean);
  else if(a==="--limit")o.limit=Number(argv[++i]);
  else if(a==="--out")o.out=argv[++i]??null;
  else if(a==="--dry-run")o.dry=true;
  else throw new Error("unknown argument "+a);
 }
 if(o.limit!==null&&(!Number.isInteger(o.limit)||o.limit<0))throw new Error("--limit must be a non-negative integer");
 return o;
}
const collector=()=>{const recs:PrivateAuditRecord[]=[];const sink:PrivateAuditSink={record:r=>{recs.push(r);}};return {recs,sink};};
const pubOf=(r:{status:string}):PublicCreativePlan|undefined=>(r as {plan?:PublicCreativePlan}).plan;

async function main(){
 const a=args(process.argv.slice(2));
 const envPath=resolve(process.cwd(),".env.local");
 if(existsSync(envPath)){const names=applyEnv(parseEnvFile(readFileSync(envPath,"utf8")),process.env);console.log("loaded .env.local ("+names.length+" variables set)");}
 else console.log(".env.local not found");
 if(!a.models.length)throw new Error("--models is required (comma separated model ids)");
 const providers=a.models.map(m=>{const p=providerForModelId(m);if(!p)throw new Error("unknown model id family: "+m);return p;});
 const missing=[...new Set(providers.map(p=>KEY_FOR[p]).filter(k=>!process.env[k]))];
 const prompts:EvalPrompt[]=EvalPromptsSchema.parse(JSON.parse(readFileSync(new URL("../evals/planner/prompts.fa.json",import.meta.url),"utf8")));
 for(const p of prompts)CreativeTurnInputSchema.parse(p.input);
 const chosen=a.limit===null?prompts:prompts.slice(0,a.limit);
 const dry=a.dry||a.limit===0;
 if(dry){
  // full pipeline with the deterministic planner: proves every prompt passes safety and the invariants, with no network
  const stat:Record<string,number>={},bad:string[]=[];
  for(const p of prompts){
   const c=collector(),r=await orchestrateCreativeTurn(p.input,{planner:deterministicPlanner as PrivatePlanner,audit:c.sink});
   stat[r.status]=(stat[r.status]??0)+1;
   const pl=pubOf(r);if(!pl||pl.mediaKind!==p.expect.kind)bad.push(p.id);
  }
  console.log("dry run: "+prompts.length+" prompts valid; deterministic pipeline statuses "+JSON.stringify(stat)+(bad.length?"; unplanned or kind mismatch: "+bad.join(","):""));
  console.log("models: "+a.models.join(", ")+"; keys missing: "+(missing.length?missing.join(", "):"none")+"; no API call made");
  return;
 }
 if(missing.length){console.error("missing environment variables: "+missing.join(", "));process.exit(2);}
 const outDir=resolve(a.out??join("evals","planner","results",new Date().toISOString().replace(/[:.]/g,"-")));
 mkdirSync(outDir,{recursive:true});
 const runs:EvalRun[]=[];
 for(const p of chosen)for(const model of a.models){
  const provider=providerForModelId(model)!,cap:{usage:unknown;ms:number}={usage:null,ms:0},c=collector();
  const planner:PrivatePlanner=async req=>{
   const t0=performance.now();
   try{const r=await (provider==="openai"?planWithOpenAI(req,model):planWithAnthropic(req,model));cap.usage=r.usage;return r;}
   finally{cap.ms=performance.now()-t0;}
  };
  let run:EvalRun;
  try{
   const r=await orchestrateCreativeTurn(p.input,{planner,audit:c.sink}),rec=c.recs[c.recs.length-1],pl=pubOf(r);
   const strings=publicStrings(pl),m=scoreMentions(strings,p.expect.mustMention,p.expect.mustNotMention),usage=normalizeUsage(cap.usage);
   run={promptId:p.id,model,provider,ok:(r.status==="planned"||r.status==="unsupported")&&rec?.planner==="live"&&!rec.fallbackReason,status:r.status,fallbackReason:rec?.fallbackReason,latencyMs:Math.round(cap.ms),usage,costUsdEstimate:estimateCostUsd(model,usage),
    corrections:rec?.corrections?.length??0,leakFiltered:rec?.fallbackReason==="leak_filtered",persianRatio:persianRatio(strings),complete:completeness(pl,p.expect.kind),mentionHitRate:m.hitRate,mentionMisses:m.misses,mustNotViolations:m.violations,planChars:strings.join("").length,plan:pl};
  }catch(e){
   run={promptId:p.id,model,provider,ok:false,status:"error",error:(e as Error).name,latencyMs:Math.round(cap.ms),usage:normalizeUsage(cap.usage),costUsdEstimate:null,corrections:0,leakFiltered:false,persianRatio:0,complete:null,mentionHitRate:null,mentionMisses:[],mustNotViolations:[],planChars:0};
  }
  runs.push(run);
  console.log(p.id+" "+model+" "+(run.ok?"ok":"FAIL "+(run.fallbackReason??run.error??run.status))+" "+run.latencyMs+"ms");
 }
 const generatedAt=new Date().toISOString();
 writeFileSync(join(outDir,"results.json"),JSON.stringify({generatedAt,models:a.models,summary:summarize(runs),runs},null,1));
 writeFileSync(join(outDir,"report.html"),renderReport(runs,chosen,{generatedAt,models:a.models}));
 console.log("wrote "+join(outDir,"results.json")+" and report.html");
}
main().catch(e=>{console.error("planner-eval failed:",(e as Error).message);process.exit(1);});
