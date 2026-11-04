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
