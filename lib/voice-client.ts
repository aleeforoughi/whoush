/** Browser-side helpers for voice mode (pure, so they are testable without a microphone). */

/** Recording types in preference order: Opus in WebM (Chrome, Firefox, Edge, newer Safari), Opus in Ogg, then AAC in MP4 (older Safari). */
export const RECORDER_TYPES=["audio/webm;codecs=opus","audio/webm","audio/ogg;codecs=opus","audio/mp4"] as const;
/** The first type this browser can record, or undefined (the recorder then uses its own default). */
export function pickRecorderType(isSupported:(t:string)=>boolean):string|undefined{
 return RECORDER_TYPES.find(t=>{try{return isSupported(t);}catch{return false;}});
}

const faDigits=(s:string)=>s.replace(/\d/g,d=>"۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
/** Elapsed recording time as m:ss in Persian digits (۰:۰۷). */
export function voiceTimerFa(ms:number):string{
 const s=Math.max(0,Math.floor(ms/1000));
 return faDigits(Math.floor(s/60)+":"+String(s%60).padStart(2,"0"));
}

/** Why the microphone could not start, in everyday Persian, from the browser's error name. */
export function micErrorFa(name:string|undefined):string{
 if(name==="NotAllowedError"||name==="SecurityError")return "اجازهٔ میکروفون داده نشد. از تنظیمات مرورگر اجازه بده و دوباره امتحان کن.";
 if(name==="NotFoundError"||name==="OverconstrainedError")return "میکروفونی پیدا نشد.";
 if(name==="NotReadableError")return "میکروفون دست برنامهٔ دیگه‌ایه. اون رو ببند و دوباره امتحان کن.";
 if(name==="unsupported")return "این مرورگر ضبط صدا رو پشتیبانی نمی‌کنه.";
 return "میکروفون روشن نشد. دوباره امتحان کن.";
}

/**
 * Bar lengths (0 to 1) for the round equalizer from analyser frequency data: `count` bars over the speech band (the lower ~60% of bins), each eased towards
 * its new level so the ring breathes instead of flickering. `prev` is the last frame's bars (same length) or empty.
 */
export function equalizerBars(freq:ArrayLike<number>,count:number,prev:readonly number[],ease=0.35):number[]{
 const usable=Math.max(1,Math.floor(freq.length*0.6)),out:number[]=[];
 for(let i=0;i<count;i++){
  // Mirror the band so the ring is symmetric: bar i and bar count-1-i read the same bins.
  const half=Math.ceil(count/2),k=i<half?i:count-1-i,from=Math.floor(k*usable/half),to=Math.max(from+1,Math.floor((k+1)*usable/half));
  let sum=0;for(let j=from;j<to;j++)sum+=freq[j]??0;
  const level=Math.min(1,sum/(to-from)/200),last=prev[i]??0;
  out.push(last+(level-last)*ease);
 }
 return out;
}
