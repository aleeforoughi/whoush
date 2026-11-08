import "server-only";
import {randomUUID} from "node:crypto";
import type {ProviderOutput,ProviderStatus} from "../media-provider";
import {CONTENT_REFUSAL} from "../provider-errors";
/**
 * Some providers answer a generation in the same HTTP call (Google, BytePlus images), which can take tens of seconds. Whoush starts that call in the
 * background and returns at once with a local request id; the job then polls it like any asynchronous provider. Once sent, a call is never repeated
 * (these providers have no idempotency): any failure ends the run as failed, and the job releases its Neurons.
 * Development only: runs live in this server process. Production needs the durable queue (docs/ARCHITECTURE.md).
 */
type Run={state:"running"|"completed"|"failed"|"nsfw";outputs:ProviderOutput[];startedAt:number};
/** A provider's content refusal (lib/provider-errors.ts), kept apart from other failures so the user is told why and what to try. */
const REFUSAL=CONTENT_REFUSAL;
const MAX_RUNS=500;
const runs=()=>((globalThis as {__whoushSyncRuns?:Map<string,Run>}).__whoushSyncRuns??=new Map());
export function startRun(work:()=>Promise<ProviderOutput[]>):string{
 const id=randomUUID(),m=runs(),run:Run={state:"running",outputs:[],startedAt:Date.now()};
 m.set(id,run);while(m.size>MAX_RUNS)m.delete(m.keys().next().value as string);
 work().then(o=>{run.outputs=o;run.state=o.length?"completed":"failed";},
  e=>{const msg=e instanceof Error?e.message:"";run.state=REFUSAL.test(msg)?"nsfw":"failed";console.warn("[whoush] provider call failed:",msg.slice(0,200)||"unknown");}); // message only: no key, no prompt
 return id;
}
export function runStatus(id:string):ProviderStatus{
 const r=runs().get(id);if(!r)throw new Error("Unknown request");
 return {state:r.state,outputs:r.state==="completed"?r.outputs:[]};
}
/** For tests: wait until a run leaves `running`. */
export async function settleRun(id:string,ms=5000){const t=Date.now();while(runs().get(id)?.state==="running"&&Date.now()-t<ms)await new Promise(r=>setTimeout(r,5));}
