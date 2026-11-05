/** Pure model of the prompt editor: which mentions show as badges, the canonical text and where the caret lands. No DOM; shared by the editor and tests. */
import {displayTag,splitMentions} from "./attachments";

/** The editor's content: plain text runs and badges (a mention of a file or generation of this chat). */
export type EditorSegment={text:string}|{tag:string};

/**
 * Splits the prompt into text and badges and gives the canonical text with the caret mapped into it.
 * - A mention becomes a badge when it names something in `known` (a file or a generation of this chat) and the caret is not right at its end, so a tag being
 *   typed (`#تولید-۱` on the way to `#تولید-۱۲`) stays text until the user moves past it (a space, or picking it from the list).
 * - A badge is always written in its canonical form (`@image1` and `#تصویر۱` become `#تصویر-۱`); everything else is kept as typed.
 * - A caret inside a badge's text moves after the badge; one at its start stays before it.
 */
export function editorSegments(value:string,known:ReadonlySet<string>,caret?:number):{segments:EditorSegment[];value:string;caret:number}{
 const segments:EditorSegment[]=[];let pos=0,out="",mapped:number|undefined;
 const pushText=(t:string)=>{if(!t)return;const last=segments[segments.length-1];if(last&&"text" in last)last.text+=t;else segments.push({text:t});};
 for(const p of splitMentions(value)){
  const raw="text" in p?p.text:p.raw,start=pos,end=pos+raw.length;
  const badge="tag" in p&&known.has(p.tag)&&caret!==end;
  const shown=badge?displayTag((p as {tag:string}).tag):raw;
  if(mapped===undefined&&caret!==undefined&&caret<=end)mapped=out.length+(badge?(caret<=start?0:shown.length):caret-start);
  if(badge)segments.push({tag:(p as {tag:string}).tag});else pushText(raw);
  out+=shown;pos=end;
 }
 return {segments,value:out,caret:Math.min(mapped??out.length,out.length)};
}
/** The text of a badge as it counts in the prompt (its canonical tag). */
export const badgeText=(tag:string)=>displayTag(tag);
/** Removes the `index`-th badge (in segment order) from the segments and returns the new text and the caret where the badge was. */
export function removeBadge(segments:readonly EditorSegment[],index:number):{value:string;caret:number}{
 let out="",caret=0,n=-1;
 for(const s of segments){
  if("tag" in s){n++;if(n===index){caret=out.length;continue;}out+=badgeText(s.tag);}
  else out+=s.text;
 }
 return {value:out,caret};
}
