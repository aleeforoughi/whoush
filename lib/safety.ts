/** First-pass Persian-aware moderation. NOT sufficient for production: add contextual
 * multimodal moderation before provider calls and after model output. */
export type SafetyCategory="politics"|"sexualized_content"|"sexualization_of_minors"|"graphic_violence"|"religious_hostility"|"regulated_content"|"ambiguous_politics"|"sensitive_language"|"none";
export type SafetyDecision="allow"|"block"|"review";
export interface SafetyResult{decision:SafetyDecision;category:SafetyCategory;message:string;}
export function normalizePersian(text:string):string {
 return text.normalize("NFKC").toLowerCase().replace(/[يى]/g,"ی").replace(/ك/g,"ک")
  .replace(/[أإ]/g,"ا").replace(/[\u064b-\u065f\u0670\u06d6-\u06ed]/g,"")
  .replace(/\u0640/g,"").replace(/[\u200c\u200d]/g," ").replace(/[^a-z0-9\u0600-\u06ff]+/g," ")
  .replace(/\s+/g," ").trim();
}
const POLITICAL_TERMS=[
 "political","politician","politics","president","prime minister","election","elections",
 "propaganda","protest","protests","parliament","government","سیاست","سیاسی","حکومت",
 "انتخابات","تبلیغات سیاسی","شعار سیاسی","تظاهرات","اعتراضات","رئیس جمهور","رییس جمهور",
 "مجلس شورای اسلامی","نخست وزیر","جمهوری اسلامی","کودتا"
];
const POLITICAL_FIGURES=[
 "خامنه ای","khamenei","خمینی","khomeini","حسن روحانی","rouhani",
 "ترامپ","trump","بایدن","biden","پزشکیان","pezeshkian","رئیسی","رییسی","raisi",
 "خاتمی","khatami","نتانیاهو","netanyahu","اوباما","obama","پوتین","putin",
 "رضاشاه","رضا شاه","محمدرضا شاه","محمد رضا شاه"
];
const SEXUALIZED=[
 "nude","nudity","naked","topless","bottomless","erotic","sexual pose","sexy pose","seductive",
 "lingerie","bikini","see through clothing","transparent clothing","striptease","fetish",
 "برهنه","نیمه برهنه","لخت","عریان","سکسی","شهوانی","تحریک آمیز","ژست سکسی",
 "ژست اغواگر","لباس زیر","سوتین","بیکینی","مایو دو تکه","لباس بدن نما",
 "لباس شفاف","رقص برهنه"
];
const MINOR_SEXUALIZATION=["child pornography","nude child","sexualized minor","کودک برهنه","برهنه بچه","سکس کودک"];
const GRAPHIC_VIOLENCE=["graphic gore","dismemberment","severed head","تکه تکه کردن بدن","سر بریده","مثله کردن"];
const RELIGIOUS_HOSTILITY=["burn the quran","insult islam","توهین به قرآن","اهانت به پیامبر","توهین به ادیان"];
const REGULATED_CONTENT=["casino gambling","promote gambling","make alcohol ad","قمارخانه","تبلیغ مشروبات الکلی","تبلیغ شرط بندی","تبلیغ مواد مخدر"];
const AMBIGUOUS_REGULATED=["شراب","مشروب","قمار","سیگار","مواد مخدر","religious parody"];
const AMBIGUOUS_POLITICAL=["پهلوی","pahlavi","روحانی","انقلاب ایران","revolution","شورای نگهبان"];
const SENSITIVE_LANGUAGE=["فحش","فحاشی","فحاش","کصکش","fuck","motherfucker"];
function contains(text:string,phrase:string):boolean{return (" "+text+" ").includes(" "+normalizePersian(phrase)+" ");}
function matches(text:string,terms:readonly string[]):boolean{return terms.some(term=>contains(text,term));}
export function evaluateTextSafety(raw:string):SafetyResult {
 const text=normalizePersian(raw);
 if(matches(text,MINOR_SEXUALIZATION))
  return {decision:"block",category:"sexualization_of_minors",message:"تولید محتوای جنسی مرتبط با کودکان ممنوع است."};
 if(matches(text,GRAPHIC_VIOLENCE))
  return {decision:"block",category:"graphic_violence",message:"ساخت تصاویر خشونت بسیار شدید در هووش پشتیبانی نمی‌شود."};
 if(matches(text,RELIGIOUS_HOSTILITY))
  return {decision:"block",category:"religious_hostility",message:"محتوای توهین‌آمیز نسبت به باورهای مذهبی پشتیبانی نمی‌شود."};
 if(matches(text,REGULATED_CONTENT))
  return {decision:"block",category:"regulated_content",message:"تبلیغ فعالیت‌ها و کالاهای پرخطر در هووش پشتیبانی نمی‌شود."};
 if(matches(text,POLITICAL_TERMS)||matches(text,POLITICAL_FIGURES))
  return {decision:"block",category:"politics",message:"در هووش تولید محتوای سیاسی یا استفاده از شخصیت‌های سیاسی پشتیبانی نمی‌شود. لطفاً یک موضوع غیرسیاسی انتخاب کن."};
 // Nude cosmetic color words are not necessarily nudity.
 const cosmetics=["nude lipstick","nude makeup","nude color","رنگ نود","رژ نود","آرایش نود"];
 let contextual=text;
 for(const shade of cosmetics)contextual=contextual.replaceAll(normalizePersian(shade)," ");
 contextual=contextual.replace(/\s+/g," ").trim();
 if(matches(contextual,SEXUALIZED))
  return {decision:"block",category:"sexualized_content",message:"این درخواست با قوانین پوشش و محتوای بصری هووش سازگار نیست. لطفاً لباس و ژست غیرتحریک‌آمیز انتخاب کن."};
 if(matches(text,AMBIGUOUS_REGULATED))
  return {decision:"review",category:"regulated_content",message:"این درخواست به بررسی محتوای حساس نیاز دارد. لطفاً هدف هنری یا غیرتبلیغاتی آن را روشن‌تر کن."};
 if(matches(text,AMBIGUOUS_POLITICAL))
  return {decision:"review",category:"ambiguous_politics",message:"برای رعایت سیاست غیرسیاسی هووش، لطفاً درخواست را بدون ارجاع به چهره‌ها و موضوعات سیاسی دقیق‌تر کن."};
 if(matches(text,SENSITIVE_LANGUAGE))
  return {decision:"review",category:"sensitive_language",message:"این عبارت نیاز به بررسی معنایی دارد. لطفاً منظورت را دقیق‌تر و بدون عبارت توهین‌آمیز توضیح بده."};
 return {decision:"allow",category:"none",message:""};
}
/**
 * Planner output only (plan inspection), never user input. Planners follow Whoush's own policy by writing avoidance lines such as
 * "no political banners" or «هیچ نماد سیاسی نباشد»; a plain lexical scan then blocked benign turns (seen live on «میدان انقلاب»). Here a GENERIC
 * category word is ignored when a negation sits within a few words of it; named political figures and every explicit term are never neutralized,
 * so "no political banners, show <figure>" still blocks. Enghelab/Revolution Square and Enghelab Street are places (docs/MODERATION_POLICY.md).
 */
const NEUTRALIZABLE=["political","politics","propaganda","protest","protests","election","elections","سیاسی","سیاست","تبلیغات سیاسی","شعار سیاسی","تظاهرات","اعتراضات","انتخابات",
 "nude","nudity","naked","revealing","lingerie","bikini","seductive","erotic","sexy","برهنه","نیمه برهنه","لخت","عریان","سکسی","تحریک آمیز","بدن نما","لباس بدن نما","لباس شفاف","لباس زیر","بیکینی"];
const NEGATE_BEFORE=new Set(["no","not","without","avoid","avoiding","avoids","never","nor","exclude","excluding","free","بدون","هیچ","نه","نباید","پرهیز","اجتناب","عاری","فاقد"]);
const NEGATE_AFTER=new Set(["نباشد","نباشند","نشود","نشوند","ممنوع","نیست","نیستند","نمی","نداشته","ندارد"]);
const PLACE_NAMES=["enghelab square","revolution square","enghelab street","enghelab avenue","میدان انقلاب","خیابان انقلاب"];
const WINDOW=4;
export function neutralizeNegatedCategories(raw:string):string{
 let text=" "+normalizePersian(raw)+" ";
 for(const place of PLACE_NAMES)text=text.replaceAll(" "+normalizePersian(place)+" "," place ");
 const tokens=text.trim().split(" ").filter(Boolean);
 const terms=NEUTRALIZABLE.map(t=>normalizePersian(t).split(" ")).sort((a,b)=>b.length-a.length);
 for(let i=0;i<tokens.length;i++){
  const term=terms.find(t=>t.every((w,k)=>tokens[i+k]===w));if(!term)continue;
  const before=tokens.slice(Math.max(0,i-WINDOW),i),after=tokens.slice(i+term.length,i+term.length+WINDOW);
  if(before.some(w=>NEGATE_BEFORE.has(w))||after.some(w=>NEGATE_AFTER.has(w)||w.startsWith("نمی")))for(let k=0;k<term.length;k++)tokens[i+k]="x";
 }
 return tokens.join(" ");
}
/** The safety check for planner-written text (media prompt, hard constraints): negated generic categories and place names are not violations. */
export function evaluatePlanTextSafety(raw:string):SafetyResult{return evaluateTextSafety(neutralizeNegatedCategories(raw));}
export class ContentPolicyError extends Error{
 readonly code="content_restricted";
 constructor(readonly result:SafetyResult){super(result.message);this.name="ContentPolicyError";}
}
export function assertSafeText(raw:string):void{
 const result=evaluateTextSafety(raw);
 if(result.decision!=="allow")throw new ContentPolicyError(result);
}
