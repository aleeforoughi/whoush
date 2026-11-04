/** Download and share helpers. Pure; safe in the browser and on the server. Whoush never posts anywhere: sharing is the device's own share sheet or a download. */
import {displayTag,isMediaKind,type AttachmentKind} from "./attachments";
import {faPlain} from "./format";

const EXTENSIONS:Record<string,string>={
 "image/jpeg":"jpg","image/png":"png","image/webp":"webp",
 "video/mp4":"mp4","video/quicktime":"mov","video/webm":"webm",
 "audio/mpeg":"mp3","audio/wav":"wav","audio/x-wav":"wav","audio/mp4":"m4a","audio/x-m4a":"m4a","audio/ogg":"ogg","audio/webm":"webm",
 "application/pdf":"pdf","application/json":"json","text/markdown":"md","text/x-markdown":"md","text/plain":"md"
};
export const extensionFor=(mime:string)=>EXTENSIONS[mime.toLowerCase().split(";")[0].trim()]??"bin";
export const MAX_SLUG=40;
/** A project title as a file-name part: Persian (and Latin) letters and digits and ZWNJ kept, spaces become `-`, everything else (separators, bidi controls, punctuation, emoji) is dropped. At most 40 characters. */
export function slugTitle(title:string):string{
 const slug=title.normalize("NFC").replace(/\s+/g,"-").replace(/[^\p{L}\p{N}‌-]/gu,"").replace(/-{2,}/g,"-").replace(/^-+|-+$/g,"");
 return Array.from(slug).slice(0,MAX_SLUG).join("").replace(/^-+|-+$/g,"");
}
/** `whoush-<project>-تصویر-۱.png`; without a usable title, `whoush-تصویر-۱.png`. The name is made here from local data and never sent anywhere. */
export function downloadFileName(f:{projectTitle?:string;tag:string;mime:string}):string{
 const slug=f.projectTitle?slugTitle(f.projectTitle):"";
 return "whoush-"+(slug?slug+"-":"")+displayTag(f.tag).replace(/^#/,"")+"."+extensionFor(f.mime);
}

export type InstagramFormat="reels"|"story"|"feed_square"|"feed_portrait"|"feed_landscape";
export const INSTAGRAM_NOT_DIRECT_FA="این نوع فایل را نمی‌توان مستقیم در اینستاگرام منتشر کرد";
export const REELS_LIMIT_SECONDS=90;
const TOLERANCE=0.03;
const BUCKETS:{ratio:number;formats:InstagramFormat[];noteFa:string}[]=[
 {ratio:9/16,formats:["reels","story"],noteFa:"مناسب ریلز و استوری"},
 {ratio:4/5,formats:["feed_portrait"],noteFa:"مناسب پست (عمودی ۴:۵)"},
 {ratio:1,formats:["feed_square"],noteFa:"مناسب پست (مربع)"},
 {ratio:1.91,formats:["feed_landscape"],noteFa:"مناسب پست (افقی ۱٫۹۱:۱)"}
];
/** Which Instagram formats a file's shape fits (aspect ratio within ±3%). Only the facts we know: the shapes, and the Reels length of up to 90 seconds. Audio and documents cannot be posted directly. */
export function instagramFit(f:{kind:AttachmentKind;width?:number;height?:number;durationSeconds?:number}):{formats:InstagramFormat[];noteFa:string}{
 if(f.kind!=="image"&&f.kind!=="video")return {formats:[],noteFa:INSTAGRAM_NOT_DIRECT_FA};
 const long=f.kind==="video"&&f.durationSeconds!==undefined&&f.durationSeconds>REELS_LIMIT_SECONDS;
 const withLimit=(note:string)=>long?note+" · ریلز تا "+faPlain(REELS_LIMIT_SECONDS)+" ثانیه":note;
 const {width:w,height:h}=f;
 const ratio=w&&h&&w>0&&h>0?w/h:undefined;
 const hit=ratio===undefined?undefined:BUCKETS.find(b=>Math.abs(ratio/b.ratio-1)<=TOLERANCE+1e-9);
 if(!hit)return {formats:[],noteFa:withLimit("اینستاگرام ممکن است "+(f.kind==="video"?"ویدیو":"تصویر")+" را برش بدهد")};
 return {formats:[...hit.formats],noteFa:withLimit(hit.noteFa)};
}
/** Media a person can sensibly share to a social app; documents are download-only. */
export const isShareableKind=(k:AttachmentKind)=>isMediaKind(k);

export type ShareTarget="story"|"post"|"reel";
export const FIT_GOOD_FA="مناسب";
export const FIT_CROP_FA="ممکن است برش بخورد";
/** The three Instagram destinations, with the steps for a person who has to do the last part by hand (no web deep link exists for them: see docs/ARCHITECTURE.md). */
export const SHARE_TARGETS:readonly {id:ShareTarget;labelFa:string;stepsFa:string;tipFa:string}[]=[
 {id:"story",labelFa:"استوری",stepsFa:"+ ← استوری ← انتخاب فایل از گالری",tipFa:"در فهرست اشتراک‌گذاری، اینستاگرام و سپس استوری را انتخاب کن"},
 {id:"post",labelFa:"پست",stepsFa:"+ ← پست",tipFa:"در فهرست اشتراک‌گذاری، اینستاگرام و سپس پست را انتخاب کن"},
 {id:"reel",labelFa:"ریلز",stepsFa:"+ ← ریلز",tipFa:"در فهرست اشتراک‌گذاری، اینستاگرام و سپس ریلز را انتخاب کن"}
];
/** Whether a file's shape fits that destination: story and reels need 9:16, a post any feed shape (square, 4:5, 1.91:1). Audio and documents fit none. */
export function fitsTarget(fit:{formats:readonly InstagramFormat[]},target:ShareTarget):boolean{
 return target==="story"?fit.formats.includes("story"):target==="reel"?fit.formats.includes("reels"):fit.formats.some(f=>f.startsWith("feed_"));
}
export const INSTAGRAM_URL="https://www.instagram.com/";
