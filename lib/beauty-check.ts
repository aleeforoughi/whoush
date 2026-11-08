import "server-only";
/**
 * After a «زیباسازی» result is made, Whoush checks it against the goal (owner, 2026-11-08): a photo the person proudly shares on social media, beautiful,
 * still them, in the same mood. The turn remembers its source photo when it is planned; the job's completion asks the vision check (lib/reference-inspect.ts)
 * and keeps a short verdict for the card. Advice only: nothing is generated or charged again on its own.
 */
import {readMedia,MEDIA_ROUTE} from "./media-store";
import {assessResult,checkShareReady,type ResultAssessment,type ShareCheck} from "./reference-inspect";
import {beautifyOffer,type BeautifyOffer} from "./beautify";
import {evaluatePlanTextSafety} from "./safety";

/** What the card shows: ready to share or not, the sentence, and the one fix when not. */
export type BeautyVerdict={shareReady:boolean;samePerson:boolean;verdictFa:string;fixFa?:string};
const turns=()=>((globalThis as {__whoushBeautifyTurns?:Map<string,string>}).__whoushBeautifyTurns??=new Map());
/** A «زیباسازی» turn and its source photo (media id). In memory, like the other turn stores. */
export function rememberBeautifyTurn(turnId:string,sourceId:string){const m=turns();m.set(turnId,sourceId);if(m.size>500)m.delete(m.keys().next().value!);}
// Persian text (a brand word such as Instagram may be in it: more Persian than Latin letters), no markup, passing the text checks.
const clean=(t:string)=>{const s=t.trim().slice(0,160),fa=(s.match(/[\u0600-\u06FF]/g)??[]).length,la=(s.match(/[A-Za-z]/g)??[]).length;
 return s&&fa>la&&!/[<>{}]|https?:/.test(s)&&evaluatePlanTextSafety(s).decision==="allow"?s:"";};
/** The verdict for a finished «زیباسازی» image, or undefined (another kind of turn, no image, or the check could not run). */
export async function beautyVerdictFor(turnId:string,outputs:readonly {kind:string;url:string}[],deps:{check?:typeof checkShareReady}={}):Promise<BeautyVerdict|undefined>{
 const sourceId=turns().get(turnId),out=outputs.find(o=>o.kind==="image"&&o.url.startsWith(MEDIA_ROUTE));
 if(!sourceId||!out)return undefined;
 try{
  const [src,res]=await Promise.all([readMedia(sourceId),readMedia(out.url.slice(MEDIA_ROUTE.length))]);if(!src||!res)return undefined;
  const c:ShareCheck=await (deps.check??checkShareReady)({bytes:new Uint8Array(src.bytes),mime:src.mime},{bytes:new Uint8Array(res.bytes),mime:res.mime});
  const ready=c.shareReady&&c.beautiful&&c.samePerson&&c.moodKept,verdict=clean(c.verdictFa),fix=clean(c.fixFa);
  return {shareReady:ready,samePerson:c.samePerson,verdictFa:verdict||(ready?"آماده‌ی انتشاره.":"هنوز کامل آماده‌ی انتشار نیست."),...(!ready&&fix?{fixFa:fix}:{})};
 }catch{return undefined;}
}

/**
 * Neither check is a failure (owner, 2026-11-08): the job is already completed and paid, nothing is refunded or charged again; following a suggestion is
 * a new request with its own quote.
 * The quality assessor on any other finished picture (owner, 2026-11-08): when it has a clear problem and its subject is a person, the «زیباسازی» offer for
 * it, with only the parts the problems name; else nothing. Never on a «زیباسازی» result itself (no fix-the-fix loops: that one gets its self-check above).
 * The studio decides whether to show it (once per picture; not in a chat where two offers were turned down).
 */
export async function enhanceOfferFor(turnId:string,outputs:readonly {kind:string;url:string}[],deps:{assess?:typeof assessResult}={}):Promise<Omit<BeautifyOffer,"tag">|undefined>{
 if(turns().has(turnId))return undefined;
 const out=outputs.find(o=>o.kind==="image"&&o.url.startsWith(MEDIA_ROUTE));if(!out)return undefined;
 try{
  const res=await readMedia(out.url.slice(MEDIA_ROUTE.length));if(!res)return undefined;
  const a:ResultAssessment=await (deps.assess??assessResult)({bytes:new Uint8Array(res.bytes),mime:res.mime});
  if(a.good||!a.person)return undefined;
  const issues=a.issues.filter(i=>clean(i.noteFa)&&i.noteEn.trim()&&evaluatePlanTextSafety(i.noteEn).decision==="allow").map(i=>({part:i.part,noteFa:clean(i.noteFa),noteEn:i.noteEn.trim().slice(0,160)}));
  if(!issues.length)return undefined;
  const {tag:_t,...offer}=beautifyOffer("",issues.filter((i,k)=>issues.findIndex(j=>j.part===i.part)===k),false);
  return offer;
 }catch{return undefined;}
}
