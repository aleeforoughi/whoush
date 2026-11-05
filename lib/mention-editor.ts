/** Pure model of the prompt editor: which mentions show as badges, the canonical text and where the caret lands. No DOM; shared by the editor and tests. */
import {displayTag,isPropTag,propMentionParts,splitMentions} from "./attachments";

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
 // The scene's props are known by their own tags («#زن»); a prop mapped to a file («#زن:تصویر-۱») is a badge when both are known.
 const props=[...known].filter(isPropTag);
 const isKnown=(tag:string)=>{if(known.has(tag))return true;if(!isPropTag(tag))return false;const x=propMentionParts(tag);return known.has(x.prop)&&(!x.file||known.has(x.file));};
 // A prop mapped to a file that is not here («#زن:تصویر-۹»): the prop alone is a badge, the rest stays text.
 const parts=splitMentions(value,props).flatMap(p=>{
  if(!("tag" in p)||!isPropTag(p.tag)||isKnown(p.tag))return [p];
  const x=propMentionParts(p.tag),cut=p.raw.indexOf(":");
  return x.file&&known.has(x.prop)&&cut>0?[{tag:x.prop,raw:p.raw.slice(0,cut)},{text:p.raw.slice(cut)}]:[p];
 });
 for(const p of parts){
  const raw="text" in p?p.text:p.raw,start=pos,end=pos+raw.length;
  const badge="tag" in p&&isKnown(p.tag)&&caret!==end;
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
