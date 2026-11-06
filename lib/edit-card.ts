/**
 * The edit card (owner, 2026-11-06): Whoush is content aware. When a message asks to change part of a photo or a generation but does not say where, or asks to
 * mark it with the brush, Whoush answers with a card that opens that picture full screen for «ویرایش با قلم» (lib/region-edit.ts). Pure: server and studio.
 */
import {normalizePersian} from "./safety";

export const EDIT_CARD_FA="عکس رو باز کن، روی همون قسمتی که می‌خوای عوض بشه بکش و بنویس چی بشه؛ بعدش خودم انجامش می‌دم.";
export const EDIT_CARD_FINGLISH="Aks ro baz kon, roo-ye hamoon ghesmati ke mikhay avaz beshe bekesh va benevis chi beshe; badesh khodam anjamesh midam.";
export const EDIT_CARD_OPEN_FA="ادیت";
/** More than one photo: one card each. */
export const EDIT_CARDS_FA="هر عکس رو باز کن، روی جاهایی که می‌خوای عوض بشه بکش و بنویس چی بشه؛ بعدش خودم انجامش می‌دم.";
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

/** Words of an edit request that carry no content of their own: «می‌خوام این عکس رو ادیت کنم» says to edit, not what to change. */
const EDIT_WORDS=["ادیت","ادیتش","ادیتشون","ویرایش","ویرایشش","روتوش","روتوشش","رتوش","edit","editing","retouch"];
const FILLER=["می","خوام","خواهم","خوایم","ها","های","هامو","م","مو","می خوام","میخوام","می‌خوام","میخواهم","می خواهم","کنم","کن","کنی","بکنم","بکن","بکنی","کنید","این","اینو","اینها","این‌ها","اینارو","عکس","عکسو","عکسم","عکسمو","عکسا","عکس‌ها","عکسها","عکسامو","تصویر","تصاویر","رو","را","لطفا","لطفاً","یه","یک","من","منو","و","هم","همین","همینو","میشه","بشه","خودم","برام","برای","با","تا","دوتا","سه‌تا","دو","سه","همه","همشون","هر","شون","ش","دارم","دارید","بیا","بیاید",
 "i","want","to","the","this","these","that","image","images","photo","photos","picture","pictures","please","my","it","them","can","you","edit","help","me","both","all","a","and","with","of","some","let","lets","let's","do"];
/**
 * A plain edit request with nothing to change named yet («می‌خوام این عکس رو ادیت کنم», "edit these photos"): Whoush opens the edit card for each photo, and the
 * brush and comments say what to change. A request that names the change («رژ لبشو قرمز کن») goes straight on.
 */
export function wantsEditCard(text:string):boolean{
 if(wantsBrushEdit(text))return true;
 const t=normalizePersian(text.replace(/[#@][^\s]+/g," "));
 if(!has(t,EDIT_WORDS))return false;
 const filler=new Set([...FILLER,...EDIT_WORDS].map(w=>normalizePersian(w)));
 return t.split(" ").filter(w=>w&&!filler.has(w)&&!/^[0-9۰-۹]+$/.test(w)).length===0;
}
