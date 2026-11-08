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
