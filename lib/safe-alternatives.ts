/**
 * Whoush is the user's advocate (owner, 2026-11-06): when a request touches something Whoush does not make, it says so in one short line with the general reason (politics, nudity, alcohol…; owner, 2026-11-07: never like an error), no details, no
 * lecture; politics is simply «we don't talk about politics here») and offers safe ideas the user
 * can take with one tap, so the chat goes on. A suggestion always leaves the restricted subject out and points somewhere else; it never says how to keep the
 * subject and get past a check. Pure: used by the server (lib/safety.ts) and the studio.
 */
import type {QuestionChoice} from "./media-intent";

export type RestrictedTopic="iran_politics"|"iran_royal"|"sexual"|"minor"|"alcohol"|"drugs"|"violence"|"religion"|"language";
const c=(id:string,labelFa:string,replyFa:string):QuestionChoice=>({id,labelFa,replyFa});
/** The friendly message (why, in one line, then the way forward) and up to three safe ideas per topic. */
export const SAFE_ALTERNATIVES:Record<RestrictedTopic,{messageFa:string;choices:QuestionChoice[]}>={
 iran_politics:{messageFa:"اینجا درباره سیاست حرف نمی‌زنیم. یکی از این‌ها چطوره؟",
  choices:[c("idea","کوچه‌های کاشان","یه عکس سینمایی از کوچه‌های کاهگلی کاشان موقع غروب"),c("idea","سفرهٔ یلدا","یه عکس گرم از سفرهٔ شب یلدا با انار و هندونه و آجیل"),c("idea","بازار تبریز","یه عکس از بازار سرپوشیدهٔ تبریز با نور صبح")]},
 iran_royal:{messageFa:"این موضوع سیاسیه و اینجا سراغ سیاست نمی‌ریم. یکی از این‌ها چطوره؟",
  choices:[c("idea","تخت جمشید","یه عکس حماسی از تخت جمشید موقع طلوع"),c("idea","کاخ گلستان","یه عکس از آینه‌کاری‌های کاخ گلستان"),c("idea","پرچم رسمی ایران","یه عکس از پرچم رسمی ایران روی برج میلاد در آسمان آبی")]},
 sexual:{messageFa:"تصویر برهنه یا تحریک‌آمیز نمی‌سازیم. یکی از این‌ها چطوره؟",
  choices:[c("idea","پرترهٔ فشن","یه پرترهٔ فشن شیک با لباس روزمره و نور نرم"),c("idea","عکس تابستونی","یه عکس تابستونی شاد کنار دریا با لباس روزمره"),c("idea","پرترهٔ سینمایی","یه پرترهٔ سینمایی با نور پنجره")]},
 minor:{messageFa:"برای امنیت بچه‌ها این یکی رو نمی‌سازیم. یکی از این‌ها چطوره؟",
  choices:[c("idea","بازی در پارک","یه عکس شاد از بچه‌ها در حال بازی توی پارک"),c("idea","نقاشی کشیدن","یه عکس از یه بچه که داره نقاشی می‌کشه")]},
 alcohol:{messageFa:"نوشیدنی الکلی نمی‌سازیم. با یه نوشیدنی دیگه چطوره؟",
  choices:[c("idea","با چای","یه عکس از یه کافهٔ دنج با استکان چای و نور گرم"),c("idea","با قهوه","یه عکس از یه فنجون قهوه کنار پنجره"),c("idea","با شربت","یه عکس تابستونی از لیوان شربت آلبالو با یخ")]},
 drugs:{messageFa:"چیزی مربوط به مواد مخدر نمی‌سازیم. یکی از این‌ها چطوره؟",
  choices:[c("idea","دورهمی دوستانه","یه عکس از دورهمی دوستانه با چای و میوه"),c("idea","کافهٔ دنج","یه عکس از یه کافهٔ دنج با نور گرم")]},
 violence:{messageFa:"صحنهٔ خشن یا خونی نمی‌سازیم. یکی از این‌ها چطوره؟",
  choices:[c("idea","تعقیب و گریز","یه صحنهٔ هیجانی تعقیب و گریز با نور و حرکت، بدون آسیب"),c("idea","لحظهٔ قبل از نبرد","یه صحنهٔ حماسی از لحظهٔ قبل از نبرد، آروم و پرتنش"),c("idea","طوفان","یه صحنهٔ دراماتیک از طوفان روی دریا")]},
 religion:{messageFa:"چیزی که به باورهای دینی بی‌احترامی کنه نمی‌سازیم. یکی از این‌ها چطوره؟",
  choices:[c("idea","مسجد نصیرالملک","یه عکس از نور رنگی پنجره‌های مسجد نصیرالملک"),c("idea","میدان نقش جهان","یه عکس از میدان نقش جهان اصفهان در شب")]},
 language:{messageFa:"با کلمه‌های توهین‌آمیز چیزی نمی‌سازیم. یه جور دیگه بگی؟",choices:[]}
};
