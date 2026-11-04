import "server-only";
import type {ReasoningTier} from "./types";
/** Privileged audit only. Stores a prompt hash, never the raw prompt; attachments are kind, size and sha256 only (never content or names); never expose to customer APIs. */
export type PrivateAuditRecord={turnId:string;at:string;skillRegistryVersion:string;activeSkillIds:string[];reasoningTier:ReasoningTier;route:{provider:string;modelId:string}|null;planner:"deterministic"|"live";fallbackReason?:string;corrections?:string[];usage?:unknown;promptSha256:string;attachments?:{kind:string;bytes:number;sha256:string}[]};
export interface PrivateAuditSink{record(r:PrivateAuditRecord):void}
const MAX=200;
const g=globalThis as {__whoushAudit?:PrivateAuditRecord[]};
const ring=()=>g.__whoushAudit??=[];
export const defaultAuditSink:PrivateAuditSink={record(r){const a=ring();a.push(r);if(a.length>MAX)a.splice(0,a.length-MAX);}};
export function readPrivateAuditForTests():PrivateAuditRecord[]{return ring().map(r=>({...r}));}
