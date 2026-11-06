/**
 * «سوژه اصلی» (owner, 2026-11-06): one reference or # of the chat may be marked as the main subject. It is optional and can be any role: a file, a generation or a
 * scene prop. When one is set, the whole photo or video is built around it, since showing it is the point of the work. The user marks it with the star on a
 * file card or in the # list, or by writing it («#تصویر-۱ سوژه اصلیه»). Pure: safe in the browser and on the server.
 */
import {displayTag,splitMentions} from "./attachments";

export const MAIN_SUBJECT_FA="سوژه اصلی";
/** How a main-subject tag reads: a file or generation by its Persian tag (#تصویر-۱), a scene prop as it is (#زن). */
export const shownTag=(tag:string)=>tag.startsWith("#")?tag:displayTag(tag);
/** A typed main subject: «سوژه اصلی», «سوژه‌ی اصلی», «سوژهٔ اصلی», "main subject", "hero". */
const PHRASE=/سوژه[‌\s]*(?:ی|ٔ|ء)?[‌\s]*(?:ی[‌\s]*)?اصلی|main subject|hero subject|the hero/i;

/** The tag written next to «سوژه اصلی» in the text (the nearest mention to the phrase), or undefined. `props`: the scene's prop tags, to recognise «#زن». */
export function typedMainSubject(text:string,props?:readonly string[]):string|undefined{
 const m=PHRASE.exec(text);if(!m)return undefined;
 let at=0,best:{tag:string;d:number}|undefined;
 for(const seg of splitMentions(text,props)){
  if("tag" in seg){
   const start=at,end=at+seg.raw.length,d=end<=m.index?m.index-end:start>=m.index+m[0].length?start-(m.index+m[0].length):0;
   if(!best||d<best.d)best={tag:seg.tag,d};
   at=end;
  }else at+=seg.text.length;
 }
 return best?.tag;
}

/** The hard rule in the plan (Persian, for the user) and the provider-facing sentence (English, its tag rewritten to a description later). */
export function mainSubjectRule(tag:string,kind:"image"|"video"):{fa:string;en:string}{
 const shown=shownTag(tag);
 return {
  fa:shown+" سوژهٔ اصلی است: کل "+(kind==="video"?"ویدیو":"تصویر")+" برای نشان دادنش ساخته می‌شود؛ بزرگ‌ترین، واضح‌ترین و پرنورترین عنصر قاب است و بقیه در خدمت آن‌اند",
  en:" Main subject: "+shown+". Build the whole "+(kind==="video"?"video":"image")+" around it: it is the clear focal point, the largest, sharpest and best-lit element in the strongest position"+
   (kind==="video"?", and it stays the focus for the whole shot":"")+"; everything else supports it and never competes with it."
 };
}
/** The note the planner reads with the brief, so it composes around the main subject from the start. */
export const mainSubjectNote=(tag:string)=>"\n("+MAIN_SUBJECT_FA+": "+shownTag(tag)+"؛ کل صحنه حول همین ساخته شود)";
