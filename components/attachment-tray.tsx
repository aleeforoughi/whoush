"use client";
import {CircleAlert,X} from "lucide-react";
import {Alert,AlertDescription,Button,Icon} from "@aleeforoughi/feather-react";
import {MAX_ATTACHMENTS,type LocalAttachment} from "@/lib/attachments";
import {fa} from "@/lib/format";

export type AttachmentProblem={key:string;name:string;message:string};
export const ATTACHMENT_NOTE="فایل‌ها فقط در همین مرورگر نگه داشته می‌شوند و فعلاً به سرویس تولید ارسال نمی‌شوند.";

/**
 * Above the chat input: per-file problems, a running count and the privacy note. The files themselves are cards inside the input (`components/attachment-card.tsx`).
 * The count is of cards, empty upload cards included, since they count toward the per-message limit too.
 */
export function AttachmentTray({items,cards=items.length,problems,reading,onDismiss}:{items:LocalAttachment[];cards?:number;problems:AttachmentProblem[];reading:boolean;onDismiss:(key:string)=>void}){
 if(!cards&&!items.length&&!problems.length&&!reading)return null;
 return <div className="flex max-h-[45dvh] flex-col gap-2 overflow-y-auto">
  {problems.map(p=><Alert key={p.key} variant="destructive" role="alert" className="flex items-center gap-2">
   <Icon icon={CircleAlert} aria-hidden="true"/>
   <AlertDescription className="min-w-0 flex-1 break-words"><bdi>{p.name}</bdi>: {p.message}</AlertDescription>
   <Button type="button" variant="ghost" size="icon" onClick={()=>onDismiss(p.key)} aria-label={"بستن پیام "+p.name}><Icon icon={X} aria-hidden="true"/></Button>
  </Alert>)}
  <p className="type-caption text-fg-secondary">
   {cards>0&&<span>{fa(cards)} از {fa(MAX_ATTACHMENTS)} پیوست</span>}
   {reading&&<span role="status">{cards>0?" · ":""}در حال بررسی فایل‌ها…</span>}
  </p>
  {items.length>0&&<p className="type-caption text-fg-secondary">{ATTACHMENT_NOTE}</p>}
 </div>;
}
