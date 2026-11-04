import "server-only";
import {createHash,createHmac,randomBytes,randomUUID,timingSafeEqual} from "node:crypto";
import {z} from "zod";
import {MEDIA_CATALOG_VERSION,configurationProblem,findMediaModel,priceFor,type MediaConfiguration} from "./catalog";
import {getPrivateMediaPrompt} from "./orchestrator";
import {generationGate} from "./policy";
export type QuoteErrorCode="unsupported_model"|"unknown_turn"|"invalid_configuration"|"invalid_quote"|"expired_quote"|"stale_quote"|"signing_unavailable";
const STATUS:Record<QuoteErrorCode,number>={unsupported_model:422,unknown_turn:410,invalid_configuration:422,invalid_quote:400,expired_quote:410,stale_quote:409,signing_unavailable:503};
export class QuoteError extends Error{readonly status:number;constructor(readonly code:QuoteErrorCode){super(code);this.name="QuoteError";this.status=STATUS[code];}}
export const QUOTE_TTL_MS=5*60*1000;
export type CharacterRefDigest={id:string;version:number;angles:readonly string[]};
const payloadSchema=z.object({
 quoteId:z.string().min(1).max(64),modelId:z.string().min(1).max(128),turnId:z.string().min(1).max(64),
 configuration:z.object({aspectRatio:z.string().max(12).optional(),durationSeconds:z.number().int().positive().optional()}).strict(),
 characterRef:z.object({id:z.string().max(80),version:z.number().int().positive(),angles:z.array(z.string().max(32)).max(6)}).strict().optional(),
 inputsDigest:z.string().regex(/^[0-9a-f]{64}$/),neurons:z.number().int().positive().max(Number.MAX_SAFE_INTEGER),catalogVersion:z.string().max(64),
 issuedAt:z.string().max(40),expiresAt:z.string().max(40),mode:z.enum(["demo","live"])
}).strict();
export type SignedQuote=z.infer<typeof payloadSchema>;
export type IssuedQuote=Omit<SignedQuote,"turnId"|"characterRef">&{token:string};
// ---- helpers ----
function canonical(v:unknown):string{
 if(Array.isArray(v))return "["+v.map(canonical).join(",")+"]";
 if(v&&typeof v==="object")return "{"+Object.entries(v as Record<string,unknown>).filter(([,x])=>x!==undefined).sort(([a],[b])=>a<b?-1:1).map(([k,x])=>JSON.stringify(k)+":"+canonical(x)).join(",")+"}";
 return JSON.stringify(v);
}
const sha256=(s:string)=>createHash("sha256").update(s).digest("hex");
export function computeInputsDigest(prompt:string,characterRef:CharacterRefDigest|undefined,configuration:MediaConfiguration):string{
 return sha256(canonical({promptSha256:sha256(prompt),characterRef:characterRef&&{id:characterRef.id,version:characterRef.version,angles:[...characterRef.angles]},configuration}));
}
const envSecret=()=>{const s=process.env.QUOTE_SIGNING_SECRET;return s&&s.length>=32?s:undefined;};
// Demo-only random per-process secret: demo quotes die with the process. globalThis so route bundles share it.
const demoSecret=()=>((globalThis as {__whoushQuoteSecret?:string}).__whoushQuoteSecret??=randomBytes(32).toString("hex"));
const sign=(body:string,secret:string)=>createHmac("sha256",secret).update(body).digest("base64url");
const eq=(a:string,b:string)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);};
// ---- API ----
export function createQuote(i:{modelId:string;configuration?:MediaConfiguration;turnId:string;characterRef?:CharacterRefDigest;now?:Date}):IssuedQuote{
 const now=i.now??new Date(),configuration=i.configuration??{};
 const model=findMediaModel(i.modelId);if(!model)throw new QuoteError("unsupported_model");
 const prompt=getPrivateMediaPrompt(i.turnId);if(prompt===undefined)throw new QuoteError("unknown_turn"); // never a client-supplied prompt
 if(configurationProblem(model,configuration))throw new QuoteError("invalid_configuration");
 const mode=generationGate(model).live?"live":"demo",secret=envSecret()??(mode==="demo"?demoSecret():undefined);
 if(!secret)throw new QuoteError("signing_unavailable"); // live fails closed
 const p:SignedQuote={quoteId:randomUUID(),modelId:model.id,turnId:i.turnId,configuration:{...configuration},characterRef:i.characterRef&&{id:i.characterRef.id,version:i.characterRef.version,angles:[...i.characterRef.angles]},
  inputsDigest:computeInputsDigest(prompt,i.characterRef,configuration),neurons:priceFor(model,configuration),catalogVersion:MEDIA_CATALOG_VERSION,issuedAt:now.toISOString(),expiresAt:new Date(now.getTime()+QUOTE_TTL_MS).toISOString(),mode};
 const body=Buffer.from(JSON.stringify(p)).toString("base64url");
 const {turnId:_t,characterRef:_c,...pub}=p;void _t;void _c;
 return {...pub,token:body+"."+sign(body,secret)};
}
/** Signature + schema only (no expiry/catalog/input checks): used to recognise an idempotent replay of an already-executed quote. */
export function verifyQuoteSignature(token:string):{quote:SignedQuote;viaDemoSecret:boolean}{
 const bad=()=>new QuoteError("invalid_quote");
 if(typeof token!=="string"||token.length>4096)throw bad();
 const [body,sig,...rest]=token.split(".");if(!body||!sig||rest.length)throw bad();
 const env=envSecret(),okEnv=env!==undefined&&eq(sig,sign(body,env)),okDemo=!okEnv&&eq(sig,sign(body,demoSecret()));
 if(!okEnv&&!okDemo)throw bad();
 let p:SignedQuote;
 try{p=payloadSchema.parse(JSON.parse(Buffer.from(body,"base64url").toString("utf8")));}catch{throw bad();}
 if(okDemo&&p.mode!=="demo")throw bad();
 return {quote:p,viaDemoSecret:okDemo};
}
/** Throws QuoteError unless the token is untampered, unexpired, current-catalog, same-price, same-mode and its server-side inputs are unchanged. */
export function verifyQuote(token:string,now:Date=new Date()):SignedQuote{
 const p=verifyQuoteSignature(token).quote;
 if(!(now.getTime()<Date.parse(p.expiresAt)))throw new QuoteError("expired_quote");
 const model=findMediaModel(p.modelId);
 if(p.catalogVersion!==MEDIA_CATALOG_VERSION||!model||configurationProblem(model,p.configuration)||priceFor(model,p.configuration)!==p.neurons)throw new QuoteError("stale_quote");
 if(p.mode!==(generationGate(model).live?"live":"demo"))throw new QuoteError("stale_quote");
 const prompt=getPrivateMediaPrompt(p.turnId);if(prompt===undefined)throw new QuoteError("unknown_turn");
 if(computeInputsDigest(prompt,p.characterRef,p.configuration)!==p.inputsDigest)throw new QuoteError("stale_quote");
 return p;
}
