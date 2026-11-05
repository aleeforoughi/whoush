/** Persian digits and grouping (۵٬۰۰۰٬۰۰۰). Every number shown to the customer goes through this. */
export const fa=(n:number)=>n.toLocaleString("fa-IR");
/** Persian digits without thousands grouping (pixel sizes, years). */
export const faPlain=(n:number)=>n.toLocaleString("fa-IR",{useGrouping:false});
/** File size in Persian: کیلوبایت under 1 MB, otherwise مگابایت with one decimal. */
export const faBytes=(bytes:number)=>bytes<1024*1024
 ?faPlain(Math.max(1,Math.round(bytes/1024)))+" کیلوبایت"
 :(bytes/(1024*1024)).toLocaleString("fa-IR",{maximumFractionDigits:1})+" مگابایت";
/** Pixel size "۱۰۲۴×۱۵۳۶" (the multiplication sign keeps it readable in RTL text; wrap in <bdi>). */
export const faDimensions=(w:number,h:number)=>faPlain(w)+"×"+faPlain(h);
/** Calendar date in the Persian locale (Jalali), e.g. ۱۴۰۵/۸/۱۳. */
export const faDate=(iso:string)=>new Date(iso).toLocaleDateString("fa-IR");
/** Duration "۱:۰۵" (minutes:seconds) in Persian digits; "۰:۰۷" for short clips. */
export const faDuration=(seconds:number)=>{const s=Math.max(0,Math.round(seconds));return faPlain(Math.floor(s/60))+":"+(s%60).toLocaleString("fa-IR",{minimumIntegerDigits:2,useGrouping:false});};
const RELATIVE=new Intl.RelativeTimeFormat("fa",{numeric:"auto"});
/**
 * How long ago, in Persian, for a message's action bar: «همین الان» under 45 seconds (and for a clock that runs ahead), then minutes, hours and days
 * («۶ دقیقه پیش», «۲ ساعت پیش», «دیروز»), and the calendar date from a week on. `now` is passed in so the caller decides when it ticks.
 */
export function faRelativeTime(iso:string,now:number):string{
 const t=new Date(iso).getTime();if(!Number.isFinite(t))return "";
 const s=Math.round((now-t)/1000);
 if(s<45)return "همین الان";
 const m=Math.round(s/60);if(m<60)return RELATIVE.format(-m,"minute");
 const h=Math.round(s/3600);if(h<24)return RELATIVE.format(-h,"hour");
 const d=Math.round(s/86400);if(d<7)return RELATIVE.format(-d,"day");
 return faDate(iso);
}
const FULL=new Intl.DateTimeFormat("fa-IR",{weekday:"long",day:"numeric",month:"long",year:"numeric",hour:"numeric",minute:"2-digit"});
/**
 * Full date and time in the Persian locale (Jalali) for the hover label of a message time, in reading order: «پنجشنبه ۱۴ آبان ۱۴۰۵، ساعت ۱۰:۴۰». Built from the
 * parts, because the locale's own pattern puts the year first and uses a Latin comma.
 */
export function faDateTime(iso:string):string{
 const d=new Date(iso);if(!Number.isFinite(d.getTime()))return "";
 const p=Object.fromEntries(FULL.formatToParts(d).map(x=>[x.type,x.value]));
 return p.weekday+" "+p.day+" "+p.month+" "+p.year+"، ساعت "+p.hour+":"+p.minute;
}
/**
 * Persian digits in text shown in Persian: every number becomes Persian («۴:۵»، «زوم ۳٫۴×»، «f/۲٫۸»، «۱/۲۵۰»، «۵۶۰۰K»), with the Persian decimal point
 * and grouping signs. Digits that belong to a word written in Latin letters (a model's name, «H264») stay as they are.
 */
export const faText=(s:string)=>s.replace(/(^|[^A-Za-z0-9.,])(\d+(?:[.,]\d+)*)/g,(_,pre:string,num:string)=>pre+num.replace(/\d/g,d=>"۰۱۲۳۴۵۶۷۸۹"[Number(d)]).replace(/\./g,"٫").replace(/,/g,"٬"));
/** faText for text that may be Persian or English (a planner's words): only a Persian string gets Persian digits. */
export const faAuto=(s:string)=>/[؀-ۿ]/.test(s)?faText(s):s;
