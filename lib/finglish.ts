/**
 * Finglish (also Pinglish): Persian written in Latin letters, the way Iranians type in messages on a Latin keyboard ("salam, ye aks az shab-e Tehran mikham").
 * Pure helpers: detecting it, and folding its many spellings into one form so safety terms match however they are typed.
 *
 * Conventions (no single standard; people mix them): خ kh or x, ش sh, چ ch, ژ zh, غ and ق gh or q, ع and ء a, e or an apostrophe, و o, u, oo or v, ی i, ee or y,
 * ا a or aa; the ezafe as -e, e or ye ("shab-e", "shabe"). Some people use digits for letters (an Arabic-chat habit, rarer in Persian): 2 for ء, 3 for ع, 7 for ح or ه,
 * 8 for ق, 5 for خ.
 */

/** Common everyday Persian words in Latin letters that rarely occur in English text. Two or more of them (or one in a short message) mark Finglish. */
const MARKERS=new Set([
 "salam","slm","merci","mersi","mamnoon","mamnun","mamnunam","lotfan","khahesh","chetori","khubi","khoobi","khobi","khub","khoob","khob","kheili","khaili","kheyli","khili",
 "mikham","mikhay","mikhaym","mikhai","mikhan","mikhad","nemikham","bekhoon","bebin","bebinam","bezar","bezan","besaz","besazi","besazim","bia","biya","berim","boro","bayad",
 "mishe","mishod","nemishe","mitooni","mituni","mitunam","mitoonam","nemidunam","nemidoonam","midunam","midoonam","dige","digeh","hamin","hamun","hamoon","intori","oonjoori","injoori",
 "chi","chie","chiye","chera","koja","kojast","kei","che","chand","ye","yek","yedoone","yedune","ro","ru","va","vali","ama","hata","faghat","hamash","badan",
 "aks","tasvir","vidio","filmo","shab","rooz","ruz","aseman","asemoon","daryache","darya","koh","shahr","khiaboon","khiabun","khoone","khune","gorbe","dokhtar","pesar",
 "khoshgel","ghashang","ghashange","khafan","bahal","baahal","aali","awli","avali","eyval","eival","dametgarm","damet","garm","halle","oki","okey","okeye","bashe","baashe",
 "baraye","barat","baram","behem","behet","azash","azam","azet","ino","inja","unja","oonja","inam","kon","kard","kardam","kardi","konam","koni","shod","shode","nist","hast","hastam",
 "jadid","ghadimi","sonnati","bache","bacheha","dooste","doost","refigh","rafigh","dadash","abji"
]);
const LATIN_WORD=/[a-z][a-z0-9']*/g;

/**
 * Whether a message is Finglish: written in Latin letters with everyday Persian words (two or more, or one in a message of up to three words). English stays English,
 * including English that names Iranian places or festivals (they are deliberately not markers).
 */
export function isFinglish(text:string):boolean{
 // Tags (#تولید-۱, @image1) are names, not language: a Finglish message may carry Persian-script tags.
 const plain=text.replace(/[#@][^\s]+/g," ");
 if(/[\u0600-\u06ff]/.test(plain))return false;
 const words=plain.toLowerCase().match(LATIN_WORD)??[];
 if(!words.length)return false;
 const hits=words.filter(w=>MARKERS.has(w.replace(/'/g,""))).length;
 return hits>=2||(hits===1&&words.length<=3);
}
/** The script a reply should use: Persian script, or Finglish when the user writes Finglish. */
export type ReplyScript="fa"|"finglish";
export const replyScriptFor=(text:string):ReplyScript=>isFinglish(text)?"finglish":"fa";

/**
 * Folds Finglish spelling variants into one form for matching: lowercase; digit letters and apostrophes dropped (2, 3, ') or mapped (7 h, 5 kh, 8 gh); x to kh, q to gh,
 * w to v; doubled vowels and ou/ee/oo collapsed (aa a, ee i, oo u, ou u); separators to spaces. Applied to both the text and the terms it is matched against.
 */
export function normalizeFinglish(text:string):string{
 return text.toLowerCase().normalize("NFKC")
  .replace(/(?<=[a-z])[23']+|[23']+(?=[a-z])/g,"").replace(/7/g,"h").replace(/5/g,"kh").replace(/8/g,"gh")
  .replace(/x/g,"kh").replace(/q/g,"gh").replace(/w/g,"v")
  .replace(/ou/g,"u").replace(/oo+/g,"u").replace(/ee+/g,"i").replace(/aa+/g,"a").replace(/ii+/g,"i").replace(/uu+/g,"u")
  .replace(/[^a-z0-9]+/g," ").replace(/\s+/g," ").trim();
}
/** Whether the normalized Finglish text contains the term as whole words. */
export function containsFinglish(normalizedText:string,term:string):boolean{
 return (" "+normalizedText+" ").includes(" "+normalizeFinglish(term)+" ");
}
