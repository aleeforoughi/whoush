"use client";
import {bidiParts} from "@/lib/bidi";
import {Badge} from "@aleeforoughi/feather-react";
import {displayTag,splitMentions,type LocalAttachment} from "@/lib/attachments";

/**
 * A sent message with each mention (`#تصویر-۱`, `@image1`, `#تولید-۱`, ...) as a Badge showing the Persian tag: a tag that names an attachment of this conversation
 * is a button that opens it in the full-screen viewer; one that names a generation of this conversation is a button that scrolls to its card.
 */
export function MessageText({text,attachments,onOpen,generations,onGeneration}:{text:string;attachments:ReadonlyMap<string,LocalAttachment>;onOpen:(a:LocalAttachment)=>void;generations?:ReadonlySet<string>;onGeneration?:(tag:string)=>void}){
 return <>{splitMentions(text).map((part,i)=>{
  // A message's own words are conversation, not interface: never translated into Finglish (components/ui-language.tsx).
  if("text" in part)return <span key={i} data-no-translate="">{bidiParts(part.text).map((b,j)=>b.ltr?<bdi key={j} dir="ltr">{b.text}</bdi>:b.text)}</span>;
  const a=attachments.get(part.tag),label=<bdi>{displayTag(part.tag)}</bdi>;
  if(!a&&generations?.has(part.tag)&&onGeneration)return <button key={i} type="button" onClick={()=>onGeneration(part.tag)} aria-label={"رفتن به "+displayTag(part.tag)} className="hit-area inline-flex rounded-control align-middle motion-hover not-disabled:hover:opacity-80">
   <Badge variant="secondary">{label}</Badge>
  </button>;
  if(!a)return <Badge key={i} variant="outline" className="align-middle">{label}</Badge>;
  return <button key={i} type="button" onClick={()=>onOpen(a)} aria-label={"نمایش تمام‌صفحه "+displayTag(a.tag)} data-viewer-open={a.id} className="hit-area inline-flex rounded-control align-middle motion-hover not-disabled:hover:opacity-80">
   <Badge variant="secondary">{label}</Badge>
  </button>;
 })}</>;
}

/**
 * Whoush's own text (a reply, a plan line, a question, a caption) with every # it mentions as a badge (owner, 2026-11-08: "any time you mention #, it
 * comes up as a badge"). `format` shapes the plain parts (Persian digits, for example); the tags show as their Persian name.
 */
export function TagText({text,format=(s:string)=>s}:{text:string;format?:(s:string)=>string}){
 const parts=splitMentions(text);
 if(parts.length===1&&"text" in parts[0])return <>{format(text)}</>;
 return <>{parts.map((part,i)=>"text" in part?<span key={i}>{format(part.text)}</span>
  :<Badge key={i} variant="secondary" className="mx-0.5 align-middle"><bdi>{displayTag(part.tag)}</bdi></Badge>)}</>;
}
