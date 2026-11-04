/** First-pass Persian-aware moderation. NOT sufficient for production: add contextual
 * multimodal moderation before provider calls and after model output. */
export type SafetyCategory="politics"|"sexualized_content"|"ambiguous_politics"|"sensitive_language"|"none";
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
const AMBIGUOUS_POLITICAL=["پهلوی","pahlavi","روحانی","انقلاب ایران","revolution","شورای نگهبان"];
const SENSITIVE_LANGUAGE=["فحش","فحاشی","فحاش","کصکش","fuck","motherfucker"];
function contains(text:string,phrase:string):boolean{return (" "+text+" ").includes(" "+normalizePersian(phrase)+" ");}
function matches(text:string,terms:readonly string[]):boolean{return terms.some(term=>contains(text,term));}
export function evaluateTextSafety(raw:string):SafetyResult {
 const text=normalizePersian(raw);
 if(matches(text,POLITICAL_TERMS)||matches(text,POLITICAL_FIGURES))
  return {decision:"block",category:"politics",message:"در هووش تولید محتوای سیاسی یا استفاده از شخصیت‌های سیاسی پشتیبانی نمی‌شود. لطفاً یک موضوع غیرسیاسی انتخاب کن."};
 // Nude cosmetic color words are not necessarily nudity.
 const cosmetics=["nude lipstick","nude makeup","nude color","رنگ نود","رژ نود","آرایش نود"];
 let contextual=text;
 for(const shade of cosmetics)contextual=contextual.replaceAll(normalizePersian(shade)," ");
 contextual=contextual.replace(/\s+/g," ").trim();
 if(matches(contextual,SEXUALIZED))
  return {decision:"block",category:"sexualized_content",message:"این درخواست با قوانین پوشش و محتوای بصری هووش سازگار نیست. لطفاً لباس و ژست غیرتحریک‌آمیز انتخاب کن."};
 if(matches(text,AMBIGUOUS_POLITICAL))
  return {decision:"review",category:"ambiguous_politics",message:"برای رعایت سیاست غیرسیاسی هووش، لطفاً درخواست را بدون ارجاع به چهره‌ها و موضوعات سیاسی دقیق‌تر کن."};
 if(matches(text,SENSITIVE_LANGUAGE))
  return {decision:"review",category:"sensitive_language",message:"این عبارت نیاز به بررسی معنایی دارد. لطفاً منظورت را دقیق‌تر و بدون عبارت توهین‌آمیز توضیح بده."};
 return {decision:"allow",category:"none",message:""};
}
export class ContentPolicyError extends Error{
 readonly code="content_restricted";
 constructor(readonly result:SafetyResult){super(result.message);this.name="ContentPolicyError";}
}
export function assertSafeText(raw:string):void{
 const result=evaluateTextSafety(raw);
 if(result.decision!=="allow")throw new ContentPolicyError(result);
}
