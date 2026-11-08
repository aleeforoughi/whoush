/**
 * Mixed Persian and Latin text (owner, 2026-11-08: «$96.00» typed in Persian showed as «96.00$»). In right-to-left text the Unicode bidi algorithm turns a
 * European number that follows Arabic-script letters into an "Arabic number", so a currency sign or a unit no longer sticks to it and lands on the other
 * side. A Latin or number run («$96.00», «16:9», «Seedance 2.5», «a@b.com») is therefore kept as one left-to-right unit: a left-to-right mark before it
 * while typing (the chat box shows it, never sends it), and an isolated left-to-right span when a message is shown.
 */
export const LRM="‎";
/** A run of Latin letters, digits and the punctuation that belongs inside them, with a currency sign at either end. */
const RUN=/(?<![A-Za-z0-9$€£¥])[$€£¥]?[A-Za-z0-9](?:[A-Za-z0-9 .,:;/@#%+&_'’$€£¥()×*=-]*[A-Za-z0-9%$€£¥)])?/g;
const ARABIC_SCRIPT=/\p{Script=Arabic}/u;
/** The left-to-right runs of `text` as [start, end) ranges, only when it also has Persian (Arabic-script) letters; none otherwise. */
export function ltrRuns(text:string):Array<{start:number;end:number}>{
 if(!ARABIC_SCRIPT.test(text))return [];
 return [...text.matchAll(RUN)].map(m=>({start:m.index,end:m.index+m[0].length}));
}
/** `text` with a left-to-right mark before each left-to-right run (for display in an editable field; stripped before it is sent). */
export function markLtrRuns(text:string,context=text):string{
 if(!ARABIC_SCRIPT.test(context))return text;
 return text.replace(RUN,run=>LRM+run);
}
export const stripMarks=(s:string)=>s.replaceAll(LRM,"");
/** `text` cut into plain parts and left-to-right runs, for showing a message with each run isolated. */
export function bidiParts(text:string):Array<{text:string;ltr:boolean}>{
 const runs=ltrRuns(text);if(!runs.length)return [{text,ltr:false}];
 const out:Array<{text:string;ltr:boolean}>=[];let at=0;
 for(const r of runs){if(r.start>at)out.push({text:text.slice(at,r.start),ltr:false});out.push({text:text.slice(r.start,r.end),ltr:true});at=r.end;}
 if(at<text.length)out.push({text:text.slice(at),ltr:false});
 return out;
}
