import "server-only";
/**
 * After a «زیباسازی» result is made, Whoush checks it against the goal (owner, 2026-11-08): a photo the person proudly shares on social media, beautiful,
 * still them, in the same mood. The turn remembers its source photo when it is planned; the job's completion asks the vision check (lib/reference-inspect.ts)
 * and keeps a short verdict for the card. Advice only: nothing is generated or charged again on its own.
 */
import {readMedia,MEDIA_ROUTE} from "./media-store";
import {checkShareReady,type ShareCheck} from "./reference-inspect";
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
