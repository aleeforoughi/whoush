/**
 * The edit card (owner, 2026-11-06): Whoush is content aware. When a message asks to change part of a photo or a generation but does not say where, or asks to
 * mark it with the brush, Whoush answers with a card that opens that picture full screen for «ویرایش با قلم» (lib/region-edit.ts). Pure: server and studio.
 */
import {normalizePersian} from "./safety";

export const EDIT_CARD_FA="عکس رو باز کن، روی همون قسمتی که می‌خوای عوض بشه بکش و بنویس چی بشه؛ بعدش خودم انجامش می‌دم.";
export const EDIT_CARD_FINGLISH="Aks ro baz kon, roo-ye hamoon ghesmati ke mikhay avaz beshe bekesh va benevis chi beshe; badesh khodam anjamesh midam.";
export const EDIT_CARD_OPEN_FA="باز کردن و علامت زدن";
/** Words that point at a place in the picture without naming it, or ask for the brush. */
const POINTING=["اینجا","این جا","اینجاش","اینجاشو","اینجارو","این جاشو","یه جاشو","یه قسمتشو","این قسمتشو","این قسمت","این قسمتش","این بخش","این ناحیه","یه قسمت","یه قسمتش","یه جاش","یه جای","یه جاهایی","بعضی جاها","با قلم","قلم بزنم","علامت بزنم","علامت بذارم","نشونت بدم","نشون بدم","مشخص کنم","خودم مشخص کنم","ویرایش با قلم",
 "here","this part","this area","this spot","some parts","part of it","with the brush","brush","mark it","mark the","show you where","let me mark"];
const EDITING=["عوض","تغییر","ویرایش","ادیت","درست","روتوش","رتوش","پاک","حذف","بردار","اضافه","رنگ","edit","change","fix","remove","retouch","replace","add","recolor"];
const has=(t:string,words:readonly string[])=>words.some(w=>(" "+t+" ").includes(" "+normalizePersian(w)+" ")||t.includes(normalizePersian(w)+" "));
/** Whether the message asks for a local edit without saying where (or asks to mark it with the brush). */
export function wantsBrushEdit(text:string):boolean{
 const t=normalizePersian(text);
 const brush=has(t,["با قلم","قلم بزنم","علامت بزنم","علامت بذارم","ویرایش با قلم","ادیت با قلم","with the brush","brush","let me mark","mark it"]);
 return brush||(has(t,POINTING)&&has(t,EDITING));
}
