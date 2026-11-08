import FINGLISH from "./finglish.json";
/**
 * Persian interface text in Finglish (lib/ui-lang.ts), from a dictionary keyed by the exact Persian string (lib/i18n/finglish.json, every Persian
 * string the interface and the server's fixed messages contain; tests/i18n.test.ts keeps it complete). Text that is not in it (a composed line, a
 * user's own words) is tried part by part, then left as it is, with Persian digits as Latin ones.
 */
const DICT=FINGLISH as Record<string,string>;
const FA=/[؀-ۿ]/;
const DIGITS=(s:string)=>s.replace(/[۰-۹]/g,d=>String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/٫/g,".").replace(/٬/g,",");
const norm=(s:string)=>s.replace(/\s+/g," ").trim();
/** Parts a composed line is cut into (labels joined with «·», a colon, a Persian comma or a full stop). */
const PARTS=/(\s*[·:،؛]\s*|(?<=[.!؟?])\s+|\n)/;
/** `exact`: only a whole known string is translated (Whoush's replies: a fixed line is, free text never half-translated). */
/**
 * Persian letters in Latin ones, for interface text the dictionary does not know (owner, 2026-11-08: "in Finglish never use Farsi"). Persian writes few
 * vowels, so this is a readable approximation, never the dictionary's quality: a word-final silent ه is "eh", و between letters is "u", ی is "i".
 */
const LETTERS:Record<string,string>={"ا":"a","آ":"a","أ":"a","إ":"e","ب":"b","پ":"p","ت":"t","ث":"s","ج":"j","چ":"ch","ح":"h","خ":"kh","د":"d","ذ":"z","ر":"r","ز":"z","ژ":"j",
 "س":"s","ش":"sh","ص":"s","ض":"z","ط":"t","ظ":"z","ع":"'","غ":"gh","ف":"f","ق":"gh","ک":"k","ك":"k","گ":"g","ل":"l","م":"m","ن":"n","و":"v","ه":"h","ة":"h","ی":"i","ي":"i","ى":"i","ئ":"'","ء":"'","ؤ":"o","ۀ":"eh","ٔ":"ye"};
function transliterateWord(w:string):string{
 let out="";
 for(let i=0;i<w.length;i++){
  const c=w[i],prev=w[i-1],next=w[i+1];
  if(c==="و")out+=i===0?"v":next&&/[\u0600-\u06ff]/.test(next)&&prev?"u":"o";
  else if(c==="ی"||c==="ي")out+=i===0?"y":"i";
  else if(c==="ه"&&i===w.length-1&&i>0)out+="eh";
  else out+=LETTERS[c]??c;
 }
 return out;
}
export const transliterate=(s:string)=>DIGITS(s).replace(/[\u0600-\u06ff\u200c]+/g,w=>transliterateWord(w.replace(/\u200c/g,""))).replace(/،/g,",").replace(/؛/g,";").replace(/؟/g,"?").replace(/[«»]/g,"\"");
export function toFinglish(text:string,exact=false):string{
 if(!FA.test(text))return text;
 const lead=text.match(/^\s*/)![0],tail=text.match(/\s*$/)![0],core=norm(text);
 const whole=DICT[core];if(whole!==undefined)return lead+whole+tail;
 if(exact)return text;
 const parts=core.split(PARTS);
 if(parts.length>1){const out=parts.map(p=>PARTS.test(p)?p.replace("،",",").replace("؛",";"):(DICT[norm(p)]??p));if(out.join("")!==core)return lead+transliterate(out.join(""))+tail;}
 // Not in the dictionary: never left in Persian script.
 return lead+transliterate(core)+tail;
}
export const dictionarySize=()=>Object.keys(DICT).length;
export const inDictionary=(s:string)=>DICT[norm(s)]!==undefined;
