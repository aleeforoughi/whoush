/**
 * Keeping the thread (owner, 2026-11-06: Whoush lost the shoes photo on the next message and made something unrelated). A message with no files of its own
 * that continues the latest work (corrects it, changes it, asks for it again, or names it) keeps the photos that work was built on. A brand-new request
 * («یه عکس از دریا») starts clean. Pure: server and studio.
 */
import {normalizePersian} from "./safety";

const CUES=["نه","نخیر","اشتباه","اشتباهه","غلط","چرا","دوباره","باز","هنوز","بازم","همون","همین","همونو","همینو","بردار","برش دار","حذف","پاک","عوض","عوضش","تغییر","تغییرش","درست","درستش","بهتر","بهترش","به جای","بجای","جای","دیگه","یه دیگه","کفش دیگه","اون","اونو","ولی","اما","فقط","نمی خواستم","نمیخواستم","می خواستم","میخواستم","منظورم","خواستم",
 "no","not","wrong","why","again","still","same","instead","another","other","different","remove","change","fix","replace","but","only","i wanted","i meant","keep"];
const NEW_START=["یه عکس جدید","یه ویدیو جدید","یه چیز دیگه بساز","از اول","موضوع جدید","new photo","new image","start over","something else"];
const has=(t:string,w:string)=>(" "+t+" ").includes(" "+normalizePersian(w)+" ");
/** Whether a message continues the latest work rather than starting something new. */
export function continuesWork(text:string,namesEarlierWork=false):boolean{
 const t=normalizePersian(text);
 if(NEW_START.some(w=>has(t,w)))return false;
 return namesEarlierWork||CUES.some(w=>has(t,w));
}
