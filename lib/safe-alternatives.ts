/**
 * Whoush is the user's advocate (owner, 2026-11-06): when a request touches something Whoush does not make, it says so kindly and offers safe ideas the user
 * can take with one tap, so the chat goes on. A suggestion always leaves the restricted subject out and points somewhere else; it never says how to keep the
 * subject and get past a check. Pure: used by the server (lib/safety.ts) and the studio.
 */
import type {QuestionChoice} from "./media-intent";

export type RestrictedTopic="iran_politics"|"iran_royal"|"sexual"|"minor"|"alcohol"|"drugs"|"violence"|"religion"|"language";
const c=(id:string,labelFa:string,replyFa:string):QuestionChoice=>({id,labelFa,replyFa});
/** The friendly message (why, in one line, then the way forward) and up to three safe ideas per topic. */
export const SAFE_ALTERNATIVES:Record<RestrictedTopic,{messageFa:string;choices:QuestionChoice[]}>={
 iran_politics:{messageFa:"هووش سراغ موضوعات سیاسی و حکومتی ایران نمی‌ره. ولی از ایران کلی چیز قشنگ می‌شه ساخت؛ یکی از این‌ها رو امتحان کن:",
  choices:[c("idea","کوچه‌های کاشان","یه عکس سینمایی از کوچه‌های کاهگلی کاشان موقع غروب"),c("idea","سفرهٔ یلدا","یه عکس گرم از سفرهٔ شب یلدا با انار و هندونه و آجیل"),c("idea","بازار تبریز","یه عکس از بازار سرپوشیدهٔ تبریز با نور صبح")]},
 iran_royal:{messageFa:"نمادها و تصاویر سلطنتی پیش از انقلاب رو نمی‌سازم. برای حال‌وهوای تاریخی ایران، این‌ها عالی‌ان:",
  choices:[c("idea","تخت جمشید","یه عکس حماسی از تخت جمشید موقع طلوع"),c("idea","کاخ گلستان","یه عکس از آینه‌کاری‌های کاخ گلستان"),c("idea","پرچم رسمی ایران","یه عکس از پرچم رسمی ایران روی برج میلاد در آسمان آبی")]},
 sexual:{messageFa:"این مدل تصویر رو نمی‌سازم. ولی یه عکس شیک و قشنگ با همون حس می‌تونیم بسازیم:",
  choices:[c("idea","پرترهٔ فشن","یه پرترهٔ فشن شیک با لباس روزمره و نور نرم"),c("idea","عکس تابستونی","یه عکس تابستونی شاد کنار دریا با لباس روزمره"),c("idea","پرترهٔ سینمایی","یه پرترهٔ سینمایی با نور پنجره")]},
 minor:{messageFa:"این درخواست رو به هیچ شکلی نمی‌سازم. اگه عکسی از کودک می‌خوای، فقط در موقعیت‌های معمولی و شاد:",
  choices:[c("idea","بازی در پارک","یه عکس شاد از بچه‌ها در حال بازی توی پارک"),c("idea","نقاشی کشیدن","یه عکس از یه بچه که داره نقاشی می‌کشه")]},
 alcohol:{messageFa:"هووش نوشیدنی الکلی و چیزهای مربوط بهش رو نمی‌سازه. همون صحنه با یه نوشیدنی دیگه هم قشنگه:",
  choices:[c("idea","با چای","یه عکس از یه کافهٔ دنج با استکان چای و نور گرم"),c("idea","با قهوه","یه عکس از یه فنجون قهوه کنار پنجره"),c("idea","با شربت","یه عکس تابستونی از لیوان شربت آلبالو با یخ")]},
 drugs:{messageFa:"هووش مواد مخدر و چیزهای مربوط بهش رو نمی‌سازه. شاید یکی از این‌ها به کارت بیاد:",
  choices:[c("idea","دورهمی دوستانه","یه عکس از دورهمی دوستانه با چای و میوه"),c("idea","کافهٔ دنج","یه عکس از یه کافهٔ دنج با نور گرم")]},
 violence:{messageFa:"خشونت، خون و آسیب رو نمی‌سازم. هیجان صحنه رو می‌شه بدون این‌ها هم نشون داد:",
  choices:[c("idea","تعقیب و گریز","یه صحنهٔ هیجانی تعقیب و گریز با نور و حرکت، بدون آسیب"),c("idea","لحظهٔ قبل از نبرد","یه صحنهٔ حماسی از لحظهٔ قبل از نبرد، آروم و پرتنش"),c("idea","طوفان","یه صحنهٔ دراماتیک از طوفان روی دریا")]},
 religion:{messageFa:"محتوای توهین‌آمیز به باورهای مذهبی رو نمی‌سازم. از فرهنگ و معماری ایران چیزهای قشنگی می‌شه ساخت:",
  choices:[c("idea","مسجد نصیرالملک","یه عکس از نور رنگی پنجره‌های مسجد نصیرالملک"),c("idea","میدان نقش جهان","یه عکس از میدان نقش جهان اصفهان در شب")]},
 language:{messageFa:"این عبارت رو نمی‌تونم استفاده کنم. منظورت رو بدون این کلمه بگو، با کمال میل می‌سازمش.",choices:[]}
};
