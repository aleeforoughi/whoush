"use client";
import {Badge} from "@aleeforoughi/feather-react";
import {splitMentions,type LocalAttachment} from "@/lib/attachments";

/** A sent message with each `@tag` as a Badge; a tag that names an attachment of this conversation is a button that opens its preview or details. */
export function MessageText({text,attachments,onOpen}:{text:string;attachments:ReadonlyMap<string,LocalAttachment>;onOpen:(a:LocalAttachment)=>void}){
 return <>{splitMentions(text).map((part,i)=>{
  if("text" in part)return <span key={i}>{part.text}</span>;
  const a=attachments.get(part.tag),label=<bdi dir="ltr">@{part.tag}</bdi>;
  if(!a)return <Badge key={i} variant="outline" className="align-middle">{label}</Badge>;
  const media=a.kind==="image"||a.kind==="video";
  return <button key={i} type="button" onClick={()=>onOpen(a)} aria-label={(media?"پیش‌نمایش ":"اطلاعات ")+"@"+a.tag} className="hit-area inline-flex rounded-full align-middle motion-hover not-disabled:hover:opacity-80">
   <Badge variant="secondary">{label}</Badge>
  </button>;
 })}</>;
}
