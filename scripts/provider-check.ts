/**
 * Live provider check: one minimal generation per model through the app's own adapters (RoutingMediaProvider, dev_live mode).
 * Usage: node --conditions=react-server --import tsx scripts/provider-check.ts [modelId ...]
 * Keys are read from .env.local and never printed. Outputs go to a temp media dir, never the repo's .media.
 */
import {readFileSync,mkdirSync} from "node:fs";
import path from "node:path";

const MEDIA_DIR="/private/tmp/claude-501/-Users-craxive-Documents-whoush/8ec6f4f5-f2a0-46bd-b075-843c6db7fbdc/scratchpad/provider-check-media";
mkdirSync(MEDIA_DIR,{recursive:true});
process.env.WHOUSH_MEDIA_DIR=MEDIA_DIR;
try{
 for(const line of readFileSync(path.join(process.cwd(),".env.local"),"utf8").split("\n")){
  const m=/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);if(!m||line.trim().startsWith("#"))continue;
  const v=m[2].replace(/^(["'])(.*)\1$/,"$2");if(process.env[m[1]]===undefined)process.env[m[1]]=v;
 }
}catch{}
// dev_live is the app's own owner-only testing mode: needs NODE_ENV=development + WHOUSH_DEV_LIVE_TEST=true (from .env.local).
(process.env as Record<string,string>).NODE_ENV="development";
process.env.WHOUSH_DEV_LIVE_TEST="true";
process.env.WHOUSH_DEV_LIVE_MAX_SUBMITS="50";

const PROMPT="a ceramic cup of tea on a wooden table, soft daylight";
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));

async function main(){
 const {MEDIA_CATALOG}=await import("../lib/catalog");
 const {RoutingMediaProvider}=await import("../lib/media-provider");
 const {hasProviderCredentials}=await import("../lib/provider-credentials");
 const {devGenerationGate,claimDevSubmit}=await import("../lib/policy");
 const all=MEDIA_CATALOG.filter(m=>m.operations.includes("generate")&&m.operations.length===1&&(m.provider as string)!=="none");
 const ids=process.argv.slice(2);
 const models=ids.length?ids.map(id=>{const m=MEDIA_CATALOG.find(x=>x.id===id);if(!m)throw new Error("Unknown model "+id);return m;}):all;
 const router=new RoutingMediaProvider("dev_live");
 const rows:string[]=[];
 for(const m of models){
  const t0=Date.now(),el=()=>((Date.now()-t0)/1000).toFixed(1);
  const done=(outcome:string,n=0)=>{const l=[m.id,m.provider,outcome,el()+"s","outputs="+n].join(" | ");rows.push(l);console.log("RESULT "+l);};
  if(!hasProviderCredentials(m.provider)){done("skipped: no key");continue;}
  const gate=devGenerationGate(m);
  if(!gate.live){done("blocked by app gate: "+gate.blockers.join(","));continue;}
  const durs=m.capabilities.durationsSeconds??[];
  const configuration=m.kind==="video"&&durs.length?{durationSeconds:Math.min(...durs)}:{};
  const timeout=(m.kind==="video"?600:240)*1000;
  // Capture the adapters' own sanitised warnings (provider status/code/message; they carry no key or prompt).
  const warns:string[]=[];const ow=console.warn;console.warn=(...a:unknown[])=>{warns.push(a.map(String).join(" "));};
  try{
   claimDevSubmit();
   const {providerRequestId}=await router.submit({modelId:m.id,prompt:PROMPT,configuration,idempotencyKey:"provider-check-"+m.id+"-"+Date.now()});
   let outcome="",n=0;
   while(Date.now()-t0<timeout){
    await sleep(m.kind==="video"?10_000:3_000);
    const s=await router.status(providerRequestId);
    if(s.state==="completed"){outcome="ok";n=s.outputs.length;break;}
    if(s.state==="failed"||s.state==="nsfw"||s.state==="canceled"){outcome="error: provider state "+s.state+(warns.length?" ["+warns.join(" / ").slice(0,500)+"]":"");break;}
   }
   console.warn=ow;
   done(outcome||"timeout",n);
  }catch(e){
   console.warn=ow;
   const x=e as {name?:string;message?:string;status?:number;code?:string};
   done("error: "+(x.name??"Error")+" "+(x.status??"")+" "+(x.code??"")+" "+String(x.message??"").slice(0,300)+(warns.length?" ["+warns.join(" / ").slice(0,500)+"]":""));
  }
 }
 console.log("\nSUMMARY\n"+rows.join("\n"));
}
main().catch(e=>{console.error("fatal:",e instanceof Error?e.message:String(e));process.exit(1);});
