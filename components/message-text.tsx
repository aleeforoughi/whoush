"use client";
import {Badge} from "@aleeforoughi/feather-react";
import {displayTag,splitMentions,type LocalAttachment} from "@/lib/attachments";

/** A sent message with each mention (`#تصویر-۱`, `@image1`, ...) as a Badge showing the Persian tag; a tag that names an attachment of this conversation is a button that opens it in the full-screen viewer. */
export function MessageText({text,attachments,onOpen}:{text:string;attachments:ReadonlyMap<string,LocalAttachment>;onOpen:(a:LocalAttachment)=>void}){
 return <>{splitMentions(text).map((part,i)=>{
  if("text" in part)return <span key={i}>{part.text}</span>;
  const a=attachments.get(part.tag),label=<bdi>{displayTag(part.tag)}</bdi>;
  if(!a)return <Badge key={i} variant="outline" className="align-middle">{label}</Badge>;
  return <button key={i} type="button" onClick={()=>onOpen(a)} aria-label={"نمایش تمام‌صفحه "+displayTag(a.tag)} data-viewer-open={a.id} className="hit-area inline-flex rounded-control align-middle motion-hover not-disabled:hover:opacity-80">
   <Badge variant="secondary">{label}</Badge>
  </button>;
 })}</>;
}
