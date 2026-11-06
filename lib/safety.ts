import {containsFinglish,normalizeFinglish} from "./finglish";
import {SAFE_ALTERNATIVES,type RestrictedTopic} from "./safe-alternatives";
import type {QuestionChoice} from "./media-intent";
/** First-pass Persian-aware moderation. NOT sufficient for production: add contextual
 * multimodal moderation before provider calls and after model output. */
/**
 * The owner's content rules (2026-11-06), the same for chat text and uploaded photos (lib/reference-inspect.ts):
 * - Refused, always with a friendly message and safe ideas (lib/safe-alternatives.ts): Iranian political figures; Iranian protests, human rights, executions,
 *   government, politics, opposition statements and «freedom» slogans, and anything sensitive for the Iranian government; symbols and imagery of
 *   pre-revolution royal Iran (the Lion and Sun, the Pahlavi crown and family); nudity, pornography and sexual content; alcohol; drugs; violence and blood.
 * - Allowed: the official flag of Iran, Iranian culture, history (ancient Persia, Persepolis), palaces and cities, food, anything positive and peaceful about
 *   Iran, everyday photos of women in casual summer clothes, and (owner decision) political figures of other countries.
 * Generic political words (election, protest, government) stay refused for any country, as before.
 */
export type SafetyCategory="politics"|"iran_politics"|"iran_royal"|"sexualized_content"|"sexualization_of_minors"|"graphic_violence"|"religious_hostility"|"regulated_content"|"alcohol"|"drugs"|"ambiguous_politics"|"sensitive_language"|"none";
export type SafetyDecision="allow"|"block"|"review";
/** `choices`: safe ideas the user can take with one tap (each one passes this same check). */
export interface SafetyResult{decision:SafetyDecision;category:SafetyCategory;message:string;choices?:QuestionChoice[]}
export function normalizePersian(text:string):string {
 return text.normalize("NFKC").toLowerCase().replace(/[يى]/g,"ی").replace(/ك/g,"ک")
  .replace(/[أإ]/g,"ا").replace(/[ً-ٰٟۖ-ۭ]/g,"")
  .replace(/ـ/g,"").replace(/[‌‍]/g," ").replace(/[^a-z0-9؀-ۿ]+/g," ")
  .replace(/\s+/g," ").trim();
}
const POLITICAL_TERMS=[
 "political","politician","politics","president","prime minister","election","elections",
 "propaganda","protest","protests","parliament","government","سیاست","سیاسی","حکومت",
 "انتخابات","تبلیغات سیاسی","شعار سیاسی","تظاهرات","اعتراضات","رئیس جمهور","رییس جمهور",
 "مجلس شورای اسلامی","نخست وزیر","جمهوری اسلامی","کودتا"
];
/** Iran's politics and government, and what is sensitive for it: refused in any wording. «آزادی» alone is a word and a landmark (برج آزادی); only the slogans count. */
const IRAN_POLITICS=[
 "رهبر انقلاب","ولی فقیه","ولایت فقیه","سپاه","سپاه پاسداران","بسیج","گشت ارشاد","حجاب اجباری","کشف حجاب","مهسا امینی","زن زندگی آزادی",
 "آزادی ایران","ایران آزاد","آزادی بیان","حقوق بشر","اعدام","اعدامی","اعدام ها","زندانی سیاسی","زندانیان سیاسی","اپوزیسیون","براندازی","سرنگونی","رژیم جمهوری اسلامی","رژیم ایران",
 "دیکتاتور","سانسور","فیلترینگ","تحریم","تحریم ها","شورای نگهبان","انقلاب اسلامی","انقلاب ۵۷","انقلاب 57","شورش","اغتشاش","اغتشاشات","تجمع اعتراضی",
 "فعال سیاسی","فعال مدنی","حکومت ایران","دولت ایران","نظام جمهوری اسلامی","آیت الله",
 "irgc","revolutionary guard","basij","morality police","mandatory hijab","forced hijab","mahsa amini","woman life freedom","jin jiyan azadi","free iran",
 "freedom for iran","iran freedom","freedom of speech","human rights","executions","public execution","political prisoner","political prisoners","iranian opposition",
 "regime change","dictator","censorship","sanctions","guardian council","islamic revolution","iranian government","iran government","iranian regime",
 "riot","riots","ayatollah","supreme leader","dissident"
];
/** Iranian political figures of any era or side. Political figures of other countries are allowed (owner, 2026-11-06). */
const POLITICAL_FIGURES=[
 "خامنه ای","khamenei","خمینی","khomeini","حسن روحانی","rouhani","پزشکیان","pezeshkian","رئیسی","رییسی","raisi","خاتمی","khatami",
 // Names that are also everyday words or common surnames («ظریف» delicate, «مصدق» certified, «پسته رفسنجانی», many a «سلیمانی») count only in full.
 "احمدی نژاد","ahmadinejad","میرحسین موسوی","میر حسین موسوی","mir hossein mousavi","کروبی","karroubi","جواد ظریف","محمدجواد ظریف","محمد جواد ظریف","javad zarif",
 "قالیباف","ghalibaf","قاسم سلیمانی","سردار سلیمانی","qasem soleimani","ghasem soleimani","محمد مصدق","دکتر مصدق","mohammad mossadegh","mossadegh",
 "بنی صدر","رجوی","rajavi","مجاهدین خلق","منافقین","هاشمی رفسنجانی","اکبر هاشمی","hashemi rafsanjani","rafsanjani","رهبر ایران"
];
/** Pre-revolution royal Iran: its symbols, crown and family. The Pahlavi script and language («خط پهلوی») are history, not this. */
const IRAN_ROYAL=[
 "شیر و خورشید","شیروخورشید","پهلوی","شاهنشاهی","شاهنشاه","تاج پهلوی","اعلیحضرت","شهبانو","فرح پهلوی","رضا پهلوی","رضاشاه","رضا شاه","محمدرضا شاه",
 "محمد رضا شاه","شاه ایران","شاه سابق","ولیعهد","سلطنت طلب","lion and sun","lion sun flag","pahlavi","shahanshah","imperial iran","shah of iran","the shah",
 "reza pahlavi","farah pahlavi","monarchist","آریامهر","aryamehr"
];
/**
 * Royal titles every Iranian dynasty used («شاهنشاه», "King of Kings", «شاه ایران», crown prince): Pahlavi-era only when nothing places the text in older
 * history. Next to Cyrus, Darius, the Achaemenids, Persepolis or the Safavids they are history (owner, 2026-11-07: Cyrus the Great is Iranian history,
 * not politics). Pahlavi names and symbols (the lion and sun, «پهلوی», «رضا شاه», «آریامهر») stay restricted in every context.
 */
const GENERIC_ROYAL_TITLES=["شاهنشاه","شاهنشاهی","شاه ایران","ولیعهد","shahanshah","shahanshahi","shah of iran","the shah","imperial iran","crown prince"];
const ANCIENT_HISTORY=["کوروش","کوروش بزرگ","کوروش کبیر","داریوش","داریوش بزرگ","خشایارشا","خشایار شاه","اردشیر","شاپور","انوشیروان","خسرو انوشیروان","خسرو پرویز",
 "هخامنشی","هخامنشیان","ساسانی","ساسانیان","اشکانی","اشکانیان","مادها","ایلامی","تخت جمشید","پاسارگاد","پارسه","نقش رستم","بیستون","طاق بستان","ایران باستان","پارس باستان",
 "منشور کوروش","استوانه کوروش","صفوی","صفویه","شاه عباس","نادرشاه","نادر شاه","افشاریه","کریم خان","زندیه","سلجوقی","شاهنامه","فردوسی","کیخسرو","جمشید","فریدون",
 "cyrus","cyrus the great","darius","darius the great","xerxes","artaxerxes","shapur","khosrow","achaemenid","achaemenids","sasanian","sassanid","sasanid","parthian","median empire",
 "persepolis","pasargadae","naqsh e rostam","behistun","ancient persia","ancient persian","ancient iran","persian empire","cyrus cylinder","safavid","shah abbas","nader shah","shahnameh","ferdowsi"];
const ROYAL_HISTORY_OK=["خط پهلوی","زبان پهلوی","پهلوی ساسانی","پهلوی اشکانی","فارسی میانه","pahlavi script","pahlavi language","middle persian"];
const SEXUALIZED=[
 "nude","nudity","naked","topless","bottomless","erotic","sexual pose","sexy pose","seductive","porn","porno","pornography","pornographic","sex","xxx","nsfw",
 "lingerie","bikini","see through clothing","transparent clothing","striptease","strip club","fetish","onlyfans",
 "برهنه","نیمه برهنه","لخت","عریان","سکسی","سکس","پورن","پورنو","شهوانی","تحریک آمیز","ژست سکسی",
 "ژست اغواگر","لباس زیر","سوتین","بیکینی","مایو دو تکه","لباس بدن نما",
 "لباس شفاف","رقص برهنه","استریپ",
 // Body edits that sexualize (owner, 2026-11-06): slimming and posture are fine; enlarging breasts or hips is not.
 "بزرگ کردن سینه","سینه بزرگتر","سینه هاش بزرگتر","بزرگ کردن باسن","باسن بزرگتر","breast enlargement","bigger breasts","bigger chest","bigger butt","butt lift"
];
const MINOR_SEXUALIZATION=["child pornography","nude child","sexualized minor","کودک برهنه","برهنه بچه","سکس کودک"];
/** Violence and blood. A battle or an epic scene without injury is fine; blood orange and blood moon are not blood. */
const GRAPHIC_VIOLENCE=["graphic gore","gore","dismemberment","severed head","beheading","decapitation","blood","bloody","covered in blood","murder","massacre","torture",
 "corpse","dead body","dead bodies","stabbing","shooting people","killing people","war crime",
 "تکه تکه کردن بدن","سر بریده","سر بریدن","مثله کردن","خون","خونین","خون آلود","غرق خون","قتل","قتل عام","کشتار","شکنجه","جسد","اجساد","چاقو زدن","تیراندازی به مردم"];
const VIOLENCE_OK=["blood orange","blood moon","blood type","blood donation","blood red","blood red lipstick","blood red nails","ماه خونین","اهدای خون","گروه خونی"];
const RELIGIOUS_HOSTILITY=["burn the quran","insult islam","توهین به قرآن","اهانت به پیامبر","توهین به ادیان"];
const REGULATED_CONTENT=["casino gambling","promote gambling","قمارخانه","تبلیغ شرط بندی"];
const ALCOHOL=["شراب","مشروب","مشروبات","مشروب الکلی","مشروبات الکلی","نوشیدنی الکلی","آبجو","ویسکی","ودکا","شامپاین","عرق سگی","میخانه","مستی","مست","تبلیغ مشروبات الکلی",
 "alcohol","alcoholic","wine","red wine","beer","whiskey","whisky","vodka","champagne","alcoholic cocktail","drunk","pub","tavern","make alcohol ad"];
const DRUGS=["مواد مخدر","مخدر","حشیش","تریاک","هروئین","هرویین","کوکائین","ماریجوانا","ماری جوانا","گراس","شیشه کشیدن","تبلیغ مواد مخدر","مواد کشیدن",
 "drugs","illegal drugs","drug use","drug dealer","narcotics","cocaine","heroin","marijuana","cannabis","weed smoking","opium","meth","methamphetamine","lsd","ecstasy pills","bong"];
/**
 * Colour and style names in beauty and fashion (owner, 2026-11-06: beauty influencers, models and bloggers are core users and must never be caught by these
 * rules): «wine red» lips, a «champagne» dress, «nude» nails are colours, not alcohol or nudity. Removed before matching; the rest of the text still counts.
 */
const FASHION_COLOURS=["wine red","wine color","wine colour","wine colored","wine coloured","wine lipstick","wine lips","burgundy wine","champagne gold","champagne color",
 "champagne colour","champagne dress","champagne gown","champagne pink","champagne blonde","champagne hair","champagne tone","champagne shimmer","champagne eyeshadow"];
const DRINK_COLOUR=/\b(?:wine|champagne|burgundy) (?:red|reds|color|colour|colored|coloured|gold|pink|blonde|beige|dress|gown|satin|silk|velvet|sequins?|tones?|shimmer|lips?|lipstick|gloss|eyeshadow|hair|heels|shoes|bag|nails?|blouse|skirt|top|suit|shade|shades)\b/g;
const NUDE_BEAUTY=/\bnude (?:toned|tinted|colored|coloured|hued|shaded|lipstick|lip|lips|makeup|make up|color|colour|colors|colours|nails?|nail polish|polish|manicure|heels|shoes|pumps|sandals|tones?|shades?|palette|eyeshadow|blush|gloss|liner|look|dress|gown|beige|pink|brown|bag|tights|stockings|foundation)\b/g;
const AMBIGUOUS_REGULATED=["قمار","سیگار","religious parody"];
const AMBIGUOUS_POLITICAL=["روحانی","انقلاب ایران","revolution"];
const SENSITIVE_LANGUAGE=["فحش","فحاشی","فحاش","کصکش","fuck","motherfucker"];
/**
 * The same categories as typed in Finglish (Persian in Latin letters), matched after `normalizeFinglish` folds spelling variants (kh/x, gh/q, oo/u, ee/i, aa/a, digit
 * letters). English words already in the lists above keep matching as before; these add the Persian words people type in Latin letters.
 */
const FINGLISH:Record<"minors"|"violence"|"religion"|"regulated"|"political"|"figures"|"iran"|"royal"|"sexual"|"alcohol"|"drugs"|"ambiguousRegulated"|"ambiguousPolitical"|"sensitive",readonly string[]>={
 minors:["koodak berahne","kudak berahne","bache lokht","bacheye lokht","sex koodak","seks kudak"],
 violence:["sar boride","sar borideh","mosle kardan","tike tike kardan badan","tekke tekke kardan badan","khoon","khun","khunin","ghatl","koshtar","shekanje","jasad"],
 religion:["tohin be quran","tohin be ghoran","ehanat be payambar","tohin be adyan"],
 regulated:["ghomarkhane","tablighe shart bandi"],
 political:["siasat","siasi","siyasi","entekhabat","tazahorat","eterazat","raees jomhur","rais jomhur","raeis jomhur","raeise jomhur","jomhuri eslami","majles shoraye eslami","nokhost vazir","koodeta","kudeta","hokumat","shoare siasi","tablighate siasi","rahbar enghelab","rahbare enghelab"],
 figures:["khamenei","khamenehei","khomeini","khomeyni","pezeshkian","raisi","raeisi","raeesi","khatami","rouhani","hasan rohani","ahmadinejad","ahmadi nejad","ghasem soleimani","qasem soleimani","javad zarif","ghalibaf","dr mosadegh","hashemi rafsanjani"],
 iran:["sepah","basij","gashte ershad","gasht ershad","hejab ejbari","mahsa amini","zan zendegi azadi","azadi iran","iran azad","hoghoghe bashar","hoghugh bashar","zendani siasi","barandazi","sarnegooni","shoraye negahban","enghelab eslami","oposizion","shuresh","eghteshash","ayatollah"],
 royal:["shir o khorshid","shiro khorshid","shir khorshid","pahlavi","shahanshahi","shahanshah","reza shah","rezashah","mohammadreza shah","mohamad reza shah","reza pahlavi","farah pahlavi","alahazrat","shahbanoo","shahbanu","saltanat talab"],
 sexual:["lokht","lokhti","berahne","berahneh","nime berahne","oryan","oriyan","seksi","sexi","shahvani","tahrik amiz","lebas zir","lebase zir","sutian","sootian","mayo do tekke","lebas badan nama","lebase badan nama","lebas shafaf","raghs berahne","porn","sex"],
 alcohol:["sharab","mashrub","mashroob","abjo","aabjo","araghe sagi","aragh sagi","vodka","viski","shampain","meykhane","masti","tablighe mashrub","tablighe mashroob","tablighe sharab"],
 drugs:["mavad mokhader","mavade mokhader","mokhader","hashish","teryak","tiryak","heroein","heroin","kokain","marijuana","geras","shishe keshidan","mavad keshidan"],
 ambiguousRegulated:["ghomar","sigar","sigaret"],
 ambiguousPolitical:["enghelab iran","enghelabe iran"],
 sensitive:["koskesh","kos kesh","kosnane","kos nane","jende","madar jende"]
};
function contains(text:string,phrase:string):boolean{return (" "+text+" ").includes(" "+normalizePersian(phrase)+" ");}
function matches(text:string,terms:readonly string[]):boolean{return terms.some(term=>contains(text,term));}
const without=(text:string,phrases:readonly string[])=>{let t=" "+text+" ";for(const p of phrases)t=t.replaceAll(" "+normalizePersian(p)+" "," ok ");return t.replace(/\s+/g," ").trim();};
let swapping=false;
/** The kind message and safe ideas for a topic; for alcohol, the user's own scene with tea, coffee or sherbet in its place (only when that passes too). */
function refused(decision:SafetyDecision,category:SafetyCategory,topic:RestrictedTopic,text?:string):SafetyResult{
 const a=SAFE_ALTERNATIVES[topic];
 let choices=a.choices;
 // The swapped scene is checked with this same function; while it is, no further swap is built (a Finglish word left in place would loop).
 if(topic==="alcohol"&&text&&!swapping){
  const swap=(drink:string)=>{let t=" "+text+" ";for(const w of [...ALCOHOL].sort((x,y)=>y.length-x.length))t=t.replaceAll(" "+normalizePersian(w)+" "," "+drink+" ");return t.replace(/\s+/g," ").trim();};
  const own:QuestionChoice[]=[["با چای","چای"],["با قهوه","قهوه"],["با شربت","شربت آلبالو"]].map(([label,drink])=>({id:"idea",labelFa:label,replyFa:swap(drink)}));
  swapping=true;
  try{if(own.every(o=>o.replyFa.length>=4&&evaluateTextSafety(o.replyFa).decision==="allow"))choices=own;}finally{swapping=false;}
 }
 return {decision,category,message:a.messageFa,...(choices.length?{choices}:{})};
}
export function evaluateTextSafety(raw:string):SafetyResult {
 const text=normalizePersian(raw),fin=normalizeFinglish(raw);
 // Finglish (Persian in Latin letters) goes through the same categories, in the same order, after spelling variants are folded.
 const f=(k:keyof typeof FINGLISH)=>FINGLISH[k].some(t=>containsFinglish(fin,t));
 if(matches(text,MINOR_SEXUALIZATION)||f("minors"))return refused("block","sexualization_of_minors","minor");
 if(matches(without(text,VIOLENCE_OK),GRAPHIC_VIOLENCE)||f("violence"))return refused("block","graphic_violence","violence");
 if(matches(text,RELIGIOUS_HOSTILITY)||f("religion"))return refused("block","religious_hostility","religion");
 if(matches(text,IRAN_POLITICS)||matches(text,POLITICAL_FIGURES)||f("iran")||f("figures"))return refused("block","iran_politics","iran_politics");
 const royalText=without(matches(text,ANCIENT_HISTORY)?without(text,GENERIC_ROYAL_TITLES):text,ROYAL_HISTORY_OK);
 if(matches(royalText,IRAN_ROYAL)||FINGLISH.royal.some(t=>containsFinglish(normalizeFinglish(royalText),t)))return refused("block","iran_royal","iran_royal");
 if(matches(text,POLITICAL_TERMS)||f("political"))return refused("block","politics","iran_politics");
 const drinkText=without(text.replace(DRINK_COLOUR," ok "),FASHION_COLOURS);
 if(matches(drinkText,ALCOHOL)||FINGLISH.alcohol.some(t=>containsFinglish(normalizeFinglish(drinkText),t)))return refused("block","alcohol","alcohol",text);
 if(matches(text,DRUGS)||f("drugs"))return refused("block","drugs","drugs");
 if(matches(text,REGULATED_CONTENT)||f("regulated"))return refused("block","regulated_content","drugs");
 // Nude cosmetic color words are not necessarily nudity.
 const contextual=without(text.replace(NUDE_BEAUTY," ok "),["nude lipstick","nude makeup","nude color","naked eye","to the naked eye","رنگ نود","رژ نود","آرایش نود"]);
 if(matches(contextual,SEXUALIZED)||FINGLISH.sexual.some(t=>containsFinglish(normalizeFinglish(contextual),t)))return refused("block","sexualized_content","sexual");
 if(matches(text,AMBIGUOUS_REGULATED)||f("ambiguousRegulated"))return refused("review","regulated_content","drugs");
 if(matches(text,AMBIGUOUS_POLITICAL)||f("ambiguousPolitical"))return refused("review","ambiguous_politics","iran_politics");
 if(matches(text,SENSITIVE_LANGUAGE)||f("sensitive"))return refused("review","sensitive_language","language");
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
/** Persian is verb-final: a clause ending in a negative or avoidance verb («… اضافه نشود», «… پرهیز شود») negates every item listed before it. */
const FA_CLAUSE_NEGATION=new Set(["نشود","نشوند","نباشد","نباشند","نباید","ممنوع","پرهیز","اجتناب","نکنید","نکن","نگذارید","نیاید","نیایند","نداشته","ندارد","ندارند","نیست","نیستند","نباشه","نشه","نکنه","عاری"]);
const FA_TERMS=new Set(NEUTRALIZABLE.filter(t=>/[\u0600-\u06ff]/.test(t)).map(t=>normalizePersian(t)));
export function neutralizeNegatedCategories(raw:string):string{
 // Clause pass (Persian only): split on sentence punctuation, not on «،», so a list «… سیاسی، … سیاسی یا … سیاسی … نشود» stays one clause.
 const clauses=raw.split(/[.؛;!?\n]+/).map(c=>{
  const toks=normalizePersian(c).split(" ").filter(Boolean);
  if(!toks.some(w=>FA_CLAUSE_NEGATION.has(w)||w.startsWith("نمی")))return toks.join(" ");
  // Neutralize single-word and two-word Persian generic terms; never English words, figure names or explicit terms outside the list.
  for(let i=0;i<toks.length;i++){const two=toks[i]+" "+(toks[i+1]??"");if(FA_TERMS.has(two)){toks[i]=toks[i+1]="x";i++;}else if(FA_TERMS.has(toks[i]))toks[i]="x";}
  return toks.join(" ");
 });
 let text=" "+clauses.join(" ")+" ";
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
