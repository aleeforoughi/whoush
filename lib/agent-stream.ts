/** Client side of POST /api/agent's progress stream (application/x-ndjson): stage lines while the turn runs, then one result line. Pure; safe in the browser. */
import type {TurnNote,TurnStage} from "./orchestrator-stages";

export type StreamEvent={type:"stage";stage:TurnStage}|({type:"note"}&TurnNote)|{type:"result";status:number;body:unknown};
/** Splits buffered text into complete NDJSON events; returns them and the unfinished tail. Malformed lines are skipped. */
export function parseNdjson(buffer:string):{events:StreamEvent[];rest:string}{
 const lines=buffer.split("\n"),rest=lines.pop()??"",events:StreamEvent[]=[];
 for(const l of lines){
  if(!l.trim())continue;
  try{const o=JSON.parse(l) as StreamEvent;if(o&&(o.type==="stage"||o.type==="result"||(o.type==="note"&&Array.isArray(o.lines)&&o.lines.every(l=>typeof l==="string"))))events.push(o);}catch{ /* skip a broken line */ }
 }
 return {events,rest};
}
/** The live status line for a stage, in the user's script (Finglish for a Finglish message). */
export const STAGE_TEXT:Record<"fa"|"finglish",Record<TurnStage,string>>={
 fa:{reading:"دارم پیامت رو می‌خونم…",planning:"دارم صحنه، دوربین و نور رو می‌چینم…",researching:"دارم تحقیق می‌کنم و مرجع‌های آزاد پیدا می‌کنم…",reviewing:"دارم قبل از ساخت ریسک‌ها رو بررسی می‌کنم…",checking:"دارم پرامپت رو چک می‌کنم…",pricing:"دارم مدل و قیمت رو پیدا می‌کنم…"},
 finglish:{reading:"Daram payamet ro mikhunam…",planning:"Daram sahne, durbin o nur ro michinam…",researching:"Daram tahghigh mikonam o marja-haye azad peyda mikonam…",reviewing:"Daram ghabl az sakht risk-ha ro barresi mikonam…",checking:"Daram barname ro check mikonam…",pricing:"Daram model o gheymat ro peyda mikonam…"}
};
/** A finished stage, for the expandable progress list (what Whoush already did this turn). */
export const STAGE_DONE_TEXT:Record<"fa"|"finglish",Record<TurnStage,string>>={
 fa:{reading:"پیامت رو خوندم",planning:"صحنه، دوربین و نور رو چیدم",checking:"پرامپت رو چک کردم",researching:"تحقیق کردم و مرجع‌های آزاد پیدا کردم",pricing:"مدل و قیمت مناسب رو پیدا کردم",reviewing:"ریسک‌ها رو قبل از ساخت بررسی کردم"},
 finglish:{reading:"Payamet ro khundam",planning:"Sahne, durbin o nur ro chidam",checking:"Prompt ro check kardam",researching:"Tahghigh kardam o marja-haye azad peyda kardam",pricing:"Model o gheymat-e monaseb ro peyda kardam",reviewing:"Risk-ha ro ghabl az sakht barresi kardam"}
};
/** Why Whoush plans first, said once in the progress list. */
export const PLAN_FIRST_FA={fa:"اول برنامه‌ریزی، تحقیق و بررسی رو با سریع‌ترین و ارزون‌ترین مدل‌ها انجام می‌دم تا لازم نباشه چند بار بسازی و نورونت هدر بره.",
 finglish:"Aval barname-rizi, tahghigh o barresi ro ba sari-tarin o arzun-tarin model-ha anjam midam ta lazem nabashe chand bar besazi."};
/**
 * Sends a turn and reports each real stage as it starts. Returns the final result shaped like a Response (ok, status, json), so the caller's handling does not
 * change. Falls back to a plain JSON response when the server does not stream.
 */
export async function postAgentTurn(body:string,onStage:(s:TurnStage)=>void,onNote:(n:TurnNote)=>void=()=>{}):Promise<{ok:boolean;status:number;json:()=>Promise<unknown>}>{
 const r=await fetch("/api/agent",{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/x-ndjson"},body});
 if(!r.body||!(r.headers.get("content-type")??"").includes("ndjson"))return r;
 const reader=r.body.getReader(),dec=new TextDecoder();let buf="",result:{status:number;body:unknown}|undefined;
 for(;;){
  const {done,value}=await reader.read();
  if(value)buf+=dec.decode(value,{stream:!done});
  const p=parseNdjson(done?buf+"\n":buf);buf=p.rest;
  for(const e of p.events){if(e.type==="stage")onStage(e.stage);else if(e.type==="note")onNote({stage:e.stage,kind:e.kind==="story"?"story":"facts",lines:e.lines.slice(0,6).map(l=>l.slice(0,140))});else result={status:e.status,body:e.body};}
  if(done)break;
 }
 if(!result)return {ok:false,status:502,json:async()=>({error:"stream_incomplete"})};
 const res=result;
 return {ok:res.status>=200&&res.status<300,status:res.status,json:async()=>res.body};
}
