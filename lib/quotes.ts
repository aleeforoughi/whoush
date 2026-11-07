import "server-only";
import {createHash,createHmac,randomBytes,randomUUID,timingSafeEqual} from "node:crypto";
import {z} from "zod";
import {MEDIA_CATALOG_VERSION,configurationProblem,findMediaModel,priceFor,type MediaConfiguration} from "./catalog";
import {getPrivateMediaPrompt,getTurnReferences} from "./orchestrator";
import {devGenerationGate,devLiveTest,generationGate,generationModeFor} from "./policy";
export type QuoteErrorCode="unsupported_model"|"unknown_turn"|"invalid_configuration"|"invalid_quote"|"expired_quote"|"stale_quote"|"signing_unavailable"|"price_pending"|"dev_cap_reached";
const STATUS:Record<QuoteErrorCode,number>={unsupported_model:422,unknown_turn:410,invalid_configuration:422,invalid_quote:400,expired_quote:410,stale_quote:409,signing_unavailable:503,price_pending:409,dev_cap_reached:429};
/** Persian explanation for `price_pending` (409): the model is known but has no approved Neuron price yet. */
export const FA_PRICE_PENDING="قیمت نورونی این مدل هنوز تأیید نشده است؛ فعلاً امکان قیمت‌گذاری یا تولید با آن وجود ندارد.";
/** Owner-only local testing: this server used all its real test generations (WHOUSH_DEV_LIVE_MAX_SUBMITS). Said plainly instead of a silent demo run. */
export const FA_DEV_CAP_REACHED="سقف تولید آزمایشی این سرور پر شده؛ برای ادامه، سرور رو دوباره راه بندازید یا سقف رو بالاتر ببرید.";
/** The only thing between this model and a real local test generation is the per-server cap. */
export function devCapIsTheOnlyBlock(model:Parameters<typeof devGenerationGate>[0]):boolean{
 if(!devLiveTest().enabled||generationGate(model).live)return false;
 const b=devGenerationGate(model).blockers;return b.length===1&&b[0]==="dev_cap_reached";
}
export class QuoteError extends Error{readonly status:number;constructor(readonly code:QuoteErrorCode){super(code);this.name="QuoteError";this.status=STATUS[code];}}
export const QUOTE_TTL_MS=5*60*1000;
export type CharacterRefDigest={id:string;version:number;angles:readonly string[]};
const payloadSchema=z.object({
 quoteId:z.string().min(1).max(64),modelId:z.string().min(1).max(128),turnId:z.string().min(1).max(64),
 configuration:z.object({aspectRatio:z.string().max(12).optional(),durationSeconds:z.number().int().positive().optional(),audio:z.boolean().optional()}).strict(),
 characterRef:z.object({id:z.string().max(80),version:z.number().int().positive(),angles:z.array(z.string().max(32)).max(6)}).strict().optional(),
 inputsDigest:z.string().regex(/^[0-9a-f]{64}$/),neurons:z.number().int().positive().max(Number.MAX_SAFE_INTEGER),catalogVersion:z.string().max(64),
 issuedAt:z.string().max(40),expiresAt:z.string().max(40),mode:z.enum(["demo","live","dev_live"]),
 /** The research references the user kept (ids of Whoush-owned copies, server-side per turn), bound into inputsDigest. */
 references:z.array(z.string().uuid()).max(14).optional()
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
export function computeInputsDigest(prompt:string,characterRef:CharacterRefDigest|undefined,configuration:MediaConfiguration,references?:readonly string[]):string{
 return sha256(canonical({promptSha256:sha256(prompt),characterRef:characterRef&&{id:characterRef.id,version:characterRef.version,angles:[...characterRef.angles]},configuration,
  references:references?.length?[...references].sort():undefined}));
}
const envSecret=()=>{const s=process.env.QUOTE_SIGNING_SECRET;return s&&s.length>=32?s:undefined;};
// Demo-only random per-process secret: demo quotes die with the process. globalThis so route bundles share it.
const demoSecret=()=>((globalThis as {__whoushQuoteSecret?:string}).__whoushQuoteSecret??=randomBytes(32).toString("hex"));
const sign=(body:string,secret:string)=>createHmac("sha256",secret).update(body).digest("base64url");
const eq=(a:string,b:string)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);};
// ---- API ----
/**
 * `excludeReferences`: research references the user removed from the package. The rest of the turn's references (server-side, never client-supplied) are bound
 * to the quote when the model takes reference images, at most its own limit.
 */
export function createQuote(i:{modelId:string;configuration?:MediaConfiguration;turnId:string;characterRef?:CharacterRefDigest;excludeReferences?:readonly string[];now?:Date}):IssuedQuote{
 const now=i.now??new Date(),configuration=i.configuration??{};
 const model=findMediaModel(i.modelId);if(!model)throw new QuoteError("unsupported_model");
 if(model.pricePending)throw new QuoteError("price_pending"); // a suggested-only model is never quoted
 const prompt=getPrivateMediaPrompt(i.turnId);if(prompt===undefined)throw new QuoteError("unknown_turn"); // never a client-supplied prompt
 if(configurationProblem(model,configuration))throw new QuoteError("invalid_configuration");
 const refCap=model.capabilities.referenceImages.supported?model.capabilities.referenceImages.max??0:0,drop=new Set(i.excludeReferences??[]);
 const references=getTurnReferences(i.turnId).filter(r=>!drop.has(r.id)).slice(0,refCap).map(r=>r.id);
 // With local testing on, a used-up cap would quietly turn the quote into a demo that makes nothing: it is refused with the reason instead.
 if(devCapIsTheOnlyBlock(model))throw new QuoteError("dev_cap_reached");
 const mode=generationModeFor(model),secret=envSecret()??(mode!=="live"?demoSecret():undefined);
 if(!secret)throw new QuoteError("signing_unavailable"); // live fails closed
 const p:SignedQuote={quoteId:randomUUID(),modelId:model.id,turnId:i.turnId,configuration:{...configuration},characterRef:i.characterRef&&{id:i.characterRef.id,version:i.characterRef.version,angles:[...i.characterRef.angles]},
  inputsDigest:computeInputsDigest(prompt,i.characterRef,configuration,references),neurons:priceFor(model,configuration),catalogVersion:MEDIA_CATALOG_VERSION,issuedAt:now.toISOString(),expiresAt:new Date(now.getTime()+QUOTE_TTL_MS).toISOString(),mode,
  ...(references.length?{references}:{})};
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
 if(okDemo&&p.mode==="live")throw bad();
 return {quote:p,viaDemoSecret:okDemo};
}
/** Throws QuoteError unless the token is untampered, unexpired, current-catalog, same-price, same-mode and its server-side inputs are unchanged. */
export function verifyQuote(token:string,now:Date=new Date()):SignedQuote{
 const p=verifyQuoteSignature(token).quote;
 if(!(now.getTime()<Date.parse(p.expiresAt)))throw new QuoteError("expired_quote");
 const model=findMediaModel(p.modelId);
 if(model?.pricePending)throw new QuoteError("price_pending");
 if(p.catalogVersion!==MEDIA_CATALOG_VERSION||!model||configurationProblem(model,p.configuration)||priceFor(model,p.configuration)!==p.neurons)throw new QuoteError("stale_quote");
 if(p.mode!==generationModeFor(model))throw new QuoteError("stale_quote");
 const prompt=getPrivateMediaPrompt(p.turnId);if(prompt===undefined)throw new QuoteError("unknown_turn");
 if(computeInputsDigest(prompt,p.characterRef,p.configuration,p.references)!==p.inputsDigest)throw new QuoteError("stale_quote");
 // Every bound reference must still be one of this turn's (and within the model's limit).
 if(p.references?.length){
  const own=new Set(getTurnReferences(p.turnId).map(r=>r.id)),cap=model.capabilities.referenceImages.supported?model.capabilities.referenceImages.max??0:0;
  if(p.references.length>cap||p.references.some(id=>!own.has(id)))throw new QuoteError("stale_quote");
 }
 return p;
}
