/**
 * Keeping the thread (owner, 2026-11-06: Whoush lost the shoes photo on the next message and made something unrelated). A message with no files of its own
 * that continues the latest work (corrects it, changes it, asks for it again, or names it) keeps the photos that work was built on. A brand-new request
 * («یه عکس از دریا») starts clean. Pure: server and studio.
 */
import {normalizePersian} from "./safety";

const CUES=["نه","نخیر","اشتباه","اشتباهه","غلط","چرا","دوباره","باز","هنوز","بازم","همون","همین","همونو","همینو","بردار","برش دار","حذف","پاک","عوض","عوضش","تغییر","تغییرش","درست","درستش","بهتر","بهترش","به جای","بجای","جای","دیگه","یه دیگه","کفش دیگه","اون","اونو","ولی","اما","فقط","نمی خواستم","نمیخواستم","می خواستم","میخواستم","منظورم","خواستم",
 "no","not","wrong","why","again","still","same","instead","another","other","different","remove","change","fix","replace","but","only","i wanted","i meant","keep",
 // Pointing at the latest work (owner, 2026-11-07: keep the thread in the session): «این عکس»، «همین ویدیو»، «قبلی»، «آخری».
 "این","اینو","اینم","این عکس","این تصویر","این ویدیو","این فیلم","عکسه","تصویره","ویدیوئه","ویدیوعه","قبلی","آخری","همونی","همینی","ادیتش","ویرایشش",
 "this","this one","it","make it","the last one","the previous one","last one","previous"];
const NEW_START=["یه عکس جدید","یه ویدیو جدید","یه چیز دیگه بساز","از اول","موضوع جدید","new photo","new image","start over","something else"];
const has=(t:string,w:string)=>(" "+t+" ").includes(" "+normalizePersian(w)+" ");
/** A Persian object pronoun on a verb or comparative names something already there: «روشن‌ترش کن»، «بزرگش کن»، «کوتاه‌ترش»، «عوضش». */
const PRONOUN=/(?:^|\s)\S{2,}ش(?:\s+(?:کن|بکن|کنید|بده|نکن|کردی|کنی|رو|را)|\s*$)|(?:^|\s)\S{2,}شو(?:\s|$)|\S+ترش(?:\s|$)/;
/** «the photo», «the video» (a known one, with «رو»), and «more …» on something that exists: «آبی‌تر کن»، «کوتاه‌تر بشه». */
const DEFINITE=/(?:^|\s)(?:عکس|تصویر|ویدیو|ویدئو|فیلم|کلیپ|پوستر)\s+(?:رو|را)(?:\s|$)/,MORE=/\S\s?تر\s+(?:کن|بکن|کنید|بشه|باشه|بشن)(?:\s|$)/;
/** «یه عکس از …»: a new piece, unless the message also points at an earlier one («یه ویدیو از همین عکس»). */
const NEW_PIECE=/(?:^|\s)(?:یه|یک)\s+(?:عکس|تصویر|ویدیو|ویدئو|فیلم|کلیپ|پوستر)(?:\s|$)/,POINTING=["این","اینو","همین","همینو","همون","همونو","قبلی","آخری","this","same","previous","last"];
/** Whether a message continues the latest work rather than starting something new. */
export function continuesWork(text:string,namesEarlierWork=false):boolean{
 const t=normalizePersian(text);
 if(NEW_START.some(w=>has(t,w)))return false;
 if(!namesEarlierWork&&NEW_PIECE.test(t)&&!POINTING.some(w=>has(t,w)))return false;
 return namesEarlierWork||CUES.some(w=>has(t,w))||PRONOUN.test(t)||DEFINITE.test(t)||MORE.test(t);
}
const VIDEO_WORDS=["ویدیو","ویدئو","فیلم","کلیپ","video","clip"],PHOTO_WORDS=["عکس","تصویر","پوستر","photo","image","picture","pic"];
/** Which kind of earlier work a message talks about: a photo when it names one (also «یه ویدیو از همین عکس»), a video when it names only that. */
export function namedWorkKind(text:string):"image"|"video"|undefined{
 const t=normalizePersian(text),word=(w:string)=>t.includes(normalizePersian(w));
 return PHOTO_WORDS.some(word)?"image":VIDEO_WORDS.some(word)?"video":undefined;
}
/** Words that turn the earlier photo into a video's first frame rather than a photo to change. */
const ANIMATE=/(ویدیو|ویدئو|فیلم|کلیپ|متحرک|انیمیت|انیمیشن|حرکت بده|زنده کن|video|animate|motion)/;
export const asStartFrame=(text:string)=>ANIMATE.test(normalizePersian(text));
export type EarlierWork={tag:string;kind:"image"|"video";done:boolean};
/**
 * The generation a follow-up continues, when the message has no files or tags of its own: the latest one of the kind it names, else the latest work if that
 * is a finished generation. A plan not made yet is newer work: then the plan is continued, not an older generation (`latestPlanTag` without `done`).
 * `works` are newest first.
 */
export function continuedGeneration(text:string,works:readonly EarlierWork[]):string|undefined{
 if(!works.length||!continuesWork(text))return undefined;
 const kind=namedWorkKind(text);
 if(kind){const w=works.find(x=>x.kind===kind&&x.done);if(w)return w.tag;}
 return works[0].done?works[0].tag:undefined;
}
