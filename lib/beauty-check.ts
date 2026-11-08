import "server-only";
/**
 * Whoush reviews its own finished pictures (owner, 2026-11-08):
 * - a «زیباسازی» result against its goal: a photo the person proudly shares on social media, beautiful, still them, in the same mood (the self-check);
 * - any other picture as a demanding photo editor would: only clear, visible problems worth fixing (the quality assessor).
 * When something is still worth fixing, the card says so in Whoush's own voice («باید پوست رو طبیعی نگه دارم، ابرو رو برگردونم.») and asks whether to fix it
 * once more with a new prompt or keep it. The fix instructions stay on the server: «آره، اصلاحش کن» derives a new turn from this one with them added
 * (lib/orchestrator.ts deriveTurnWithFix), quoted and run as a new card. Never a failure: the job is completed and paid, nothing is refunded or charged
 * again on its own. A fixed result is never offered another fix (no loops).
 */
import {readMedia,MEDIA_ROUTE} from "./media-store";
import {assessResult,checkShareReady,type ResultAssessment,type ShareCheck} from "./reference-inspect";
import {evaluatePlanTextSafety} from "./safety";

/** The «زیباسازی» self-check's line on the card: ready to share or not, and its sentence. */
export type BeautyVerdict={shareReady:boolean;samePerson:boolean;verdictFa:string};
/** What Whoush would still fix: its own words for the card (`sayFa`) and the instructions for the next attempt (`fixEn`, server only). */
export type ResultReview={sayFa:string;fixEn:string};
const turns=()=>((globalThis as {__whoushBeautifyTurns?:Map<string,string>}).__whoushBeautifyTurns??=new Map());
const fixed=()=>((globalThis as {__whoushFixedTurns?:Set<string>}).__whoushFixedTurns??=new Set());
/** A «زیباسازی» turn and its source photo (media id). In memory, like the other turn stores. */
export function rememberBeautifyTurn(turnId:string,sourceId:string){const m=turns();m.set(turnId,sourceId);if(m.size>500)m.delete(m.keys().next().value!);}
export const beautifySourceOf=(turnId:string)=>turns().get(turnId);
/** A turn made by «اصلاحش کن»: its result gets its verdict line but never another fix offer. */
export function rememberFixedTurn(turnId:string){const s=fixed();s.add(turnId);if(s.size>500)s.delete(s.values().next().value!);}
// Persian text (a brand word such as Instagram may be in it: more Persian than Latin letters), no markup, passing the text checks.
const clean=(t:string,max=160)=>{const s=t.trim().slice(0,max),fa=(s.match(/[؀-ۿ]/g)??[]).length,la=(s.match(/[A-Za-z]/g)??[]).length;
 return s&&fa>la&&!/[<>{}]|https?:/.test(s)&&evaluatePlanTextSafety(s).decision==="allow"?s:"";};
const cleanEn=(t:string)=>{const s=t.trim().slice(0,400);return s&&!/[<>{}]|https?:/.test(s)&&evaluatePlanTextSafety(s).decision==="allow"?s:"";};
const review=(sayFa:string,fixEn:string,turnId:string):ResultReview|undefined=>{
 if(fixed().has(turnId))return undefined;const say=clean(sayFa,200),fix=cleanEn(fixEn);return say&&fix?{sayFa:say,fixEn:fix}:undefined;};
const firstImage=(outputs:readonly {kind:string;url:string}[])=>outputs.find(o=>o.kind==="image"&&o.url.startsWith(MEDIA_ROUTE));

/** The self-check of a finished «زیباسازی» image (its verdict, and what to fix when not ready), or undefined (another kind of turn, or no check). */
export async function beautyVerdictFor(turnId:string,outputs:readonly {kind:string;url:string}[],deps:{check?:typeof checkShareReady}={}):Promise<{verdict:BeautyVerdict;review?:ResultReview}|undefined>{
 const sourceId=turns().get(turnId),out=firstImage(outputs);
 if(!sourceId||!out)return undefined;
 try{
  const [src,res]=await Promise.all([readMedia(sourceId),readMedia(out.url.slice(MEDIA_ROUTE.length))]);if(!src||!res)return undefined;
  const c:ShareCheck=await (deps.check??checkShareReady)({bytes:new Uint8Array(src.bytes),mime:src.mime},{bytes:new Uint8Array(res.bytes),mime:res.mime});
  const ready=c.shareReady&&c.beautiful&&c.samePerson&&c.moodKept,verdict=clean(c.verdictFa),r=ready?undefined:review(c.fixFa,c.fixEn,turnId);
  return {verdict:{shareReady:ready,samePerson:c.samePerson,verdictFa:verdict||(ready?"آماده‌ی انتشاره.":"هنوز کامل آماده‌ی انتشار نیست.")},...(r?{review:r}:{})};
 }catch{return undefined;}
}

/** The quality assessor on any other finished picture: what Whoush would still fix, or undefined (good, a «زیباسازی» result, or no check). */
export async function reviewFor(turnId:string,outputs:readonly {kind:string;url:string}[],deps:{assess?:typeof assessResult}={}):Promise<ResultReview|undefined>{
 if(turns().has(turnId))return undefined;
 const out=firstImage(outputs);if(!out)return undefined;
 try{
  const res=await readMedia(out.url.slice(MEDIA_ROUTE.length));if(!res)return undefined;
  const a:ResultAssessment=await (deps.assess??assessResult)({bytes:new Uint8Array(res.bytes),mime:res.mime});
  return a.good?undefined:review(a.sayFa,a.fixEn,turnId);
 }catch{return undefined;}
}
