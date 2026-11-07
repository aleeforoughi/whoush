/**
 * What the user asked to make: a photo, a video, both, or nothing said (owner, 2026-11-06). Pure: safe in the browser and on the server.
 *
 * Words are matched as whole words (a few Persian suffixes allowed), never inside other words («emotion» is not «motion»), and a word the user negates
 * («نه ویدیو», «ویدیو نمی‌خوام», «not a video») does not count. When both a photo word and a video word remain, it is «both» only when they are joined
 * («عکس و ویدیو», «هر دو»); otherwise the video wins, since the photo is then its source («از این عکس یه ویدیو بساز»). A duration («۵ ثانیه») means video.
 */
import {normalizePersian} from "./safety";

export type MediaIntent="image"|"video"|"both";

/** Whole words, with Persian suffixes (ش، ی، ها، رو...) allowed after the stems marked `stem`. */
const IMAGE_STEMS=["عکس","تصویر","پوستر","پرتره","والپیپر","photo","image","picture","portrait","poster","wallpaper","aks","axs"];
const IMAGE_WORDS=["pic","pics","photos","images","pictures","portraits","posters"];
const VIDEO_STEMS=["ویدیو","ویدئو","ویدیئو","کلیپ","انیمیشن","تیزر","ریلز","video","clip","animation","teaser","reel"];
const VIDEO_WORDS=["فیلم","فیلمش","فیلمو","فیلمه","فیلما","متحرکش","animate","animated","videos","clips","reels"];
const BOTH=["هر دو","هردو","هر دوش","هردوش","هر دوتا","هردوتا","both","har do","hardo"];
/** Persian suffixes that may follow a stem: «عکسش»، «تصویری»، «ویدیوها»، «کلیپو». */
const SUFFIX=/^(?:ش|ی|یی|ها|های|هایی|و|رو|ا|ای|ه|م|مو|ت|تو|s|es)?$/;
/** Words that negate a nearby media word: before it («نه ویدیو», «بدون ویدیو», «not a video») or after it («ویدیو نمی‌خوام», «ویدیو نه»). */
const NEG_BEFORE=new Set(["نه","بدون","not","no","without","non","nah"]);
const NEG_AFTER=new Set(["نه","نمی","نمیخوام","نمیخواستم","نخواستم","نمیخواهم","نیست","نباشه","نمیخواد","nemikham","na","not"]);
const JOINERS=new Set(["و","هم","and","&","+","با","va","ham"]);

const matchesStem=(token:string,stems:readonly string[])=>stems.some(s=>token.startsWith(s)&&SUFFIX.test(token.slice(s.length)));

type Hit={kind:"image"|"video";at:number;negated:boolean};
function hits(tokens:readonly string[]):Hit[]{
 const out:Hit[]=[];
 tokens.forEach((t,i)=>{
  const kind=matchesStem(t,IMAGE_STEMS)||IMAGE_WORDS.includes(t)?"image":matchesStem(t,VIDEO_STEMS)||VIDEO_WORDS.includes(t)?"video":undefined;
  if(!kind)return;
  const before=tokens.slice(Math.max(0,i-2),i),after=tokens.slice(i+1,i+3);
  // «نه» right after a word negates it only at the end of a clause («ویدیو نه، عکس»), so a following «نه» counts only as the next word.
  const negated=before.some(w=>NEG_BEFORE.has(w))||after.some(w=>NEG_AFTER.has(w)&&w!=="نه")||after[0]==="نه";
  out.push({kind,at:i,negated});
 });
 return out;
}

/** What the text asks to make, or undefined when it does not say. */
export function mediaIntent(text:string):MediaIntent|undefined{
 const n=normalizePersian(text),tokens=n.split(" ").filter(Boolean),padded=" "+n+" ";
 if(BOTH.some(b=>padded.includes(" "+b+" ")))return "both";
 const found=hits(tokens),kept=found.filter(h=>!h.negated);
 const image=kept.filter(h=>h.kind==="image"),video=kept.filter(h=>h.kind==="video");
 // A length in seconds is a video: «یه کلیپ ۵ ثانیه‌ای», «10 second».
 const duration=/(?:^| )[0-9۰-۹]+ ?(?:ثانیه|ثانیه ای|sec|secs|second|seconds|s)(?: |$)/.test(n);
 if(image.length&&(video.length||duration)){
  // Joined: «عکس و ویدیو», «یه عکس، یه ویدیو هم» (the joiner sits between the two words, at most two words apart).
  const joined=image.some(a=>video.some(b=>{const [lo,hi]=a.at<b.at?[a.at,b.at]:[b.at,a.at];return hi-lo<=3&&tokens.slice(lo+1,hi+1).some(w=>JOINERS.has(w));}));
  return joined?"both":"video";
 }
 if(video.length||duration)return "video";
 if(image.length)return "image";
 // Only negations: «ویدیو نمی‌خوام» alone means not a video, so a photo.
 if(found.some(h=>h.kind==="video"&&h.negated)&&!found.some(h=>h.kind==="image"&&h.negated))return "image";
 if(found.some(h=>h.kind==="image"&&h.negated)&&!found.some(h=>h.kind==="video"&&h.negated))return "video";
 return undefined;
}

/** The question when nothing says photo or video, with its answer buttons (each sends its reply as the user's answer). */
export const MEDIA_KIND_QUESTION_FA="عکس می‌خوای، ویدیو یا هر دو؟";
export const MEDIA_KIND_QUESTION_FINGLISH="aks mikhay, video ya har do?";
export type QuestionChoice={id:string;labelFa:string;/** Sent as the user's answer. */replyFa:string};
export const MEDIA_KIND_CHOICES:readonly QuestionChoice[]=[
 {id:"image",labelFa:"عکس",replyFa:"عکس"},
 {id:"video",labelFa:"ویدیو",replyFa:"ویدیو"},
 {id:"both",labelFa:"هر دو",replyFa:"هر دو"}
];
/** A question's choices as received over the network (checked before use). */
export function isQuestionChoices(v:unknown):v is QuestionChoice[]{
 return Array.isArray(v)&&v.length>=1&&v.length<=4&&v.every(c=>c&&typeof c==="object"&&["id","labelFa","replyFa"].every(k=>{const x=(c as Record<string,unknown>)[k];return typeof x==="string"&&x.length>=1&&x.length<=60;}));
}
