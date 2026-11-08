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
export function toFinglish(text:string,exact=false):string{
 if(!FA.test(text))return text;
 const lead=text.match(/^\s*/)![0],tail=text.match(/\s*$/)![0],core=norm(text);
 const whole=DICT[core];if(whole!==undefined)return lead+whole+tail;
 if(exact)return text;
 const parts=core.split(PARTS);
 if(parts.length>1){const out=parts.map(p=>PARTS.test(p)?p.replace("،",",").replace("؛",";"):(DICT[norm(p)]??p));if(out.join("")!==core)return lead+DIGITS(out.join("").replace(/؟/g,"?"))+tail;}
 return lead+DIGITS(core)+tail;
}
export const dictionarySize=()=>Object.keys(DICT).length;
export const inDictionary=(s:string)=>DICT[norm(s)]!==undefined;
