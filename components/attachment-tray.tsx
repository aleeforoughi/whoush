"use client";
import {CircleAlert,X} from "lucide-react";
import {Alert,AlertDescription,Button,Icon} from "@aleeforoughi/feather-react";
import {AttachmentChip,type AttachmentPatch} from "@/components/attachment-chip";
import {MAX_ATTACHMENTS,type LocalAttachment} from "@/lib/attachments";
import {fa} from "@/lib/format";

export type AttachmentProblem={key:string;name:string;message:string};
export const ATTACHMENT_NOTE="فایل‌ها فقط در همین مرورگر نگه داشته می‌شوند و فعلاً به سرویس تولید ارسال نمی‌شوند.";

/** Chips for the files picked for the next message, a running count, per-file problems and the privacy note. */
export function AttachmentTray({items,problems,reading,onChange,onRemove,onPreview,onDismiss}:{items:LocalAttachment[];problems:AttachmentProblem[];reading:boolean;onChange:(id:string,patch:AttachmentPatch)=>void;onRemove:(id:string)=>void;onPreview:(item:LocalAttachment)=>void;onDismiss:(key:string)=>void}){
 if(!items.length&&!problems.length&&!reading)return null;
 return <div className="flex flex-col gap-2">
  {problems.map(p=><Alert key={p.key} variant="destructive" role="alert" className="flex items-center gap-2">
   <Icon icon={CircleAlert} aria-hidden="true"/>
   <AlertDescription className="min-w-0 flex-1 break-words"><bdi>{p.name}</bdi>: {p.message}</AlertDescription>
   <Button type="button" variant="ghost" size="icon" onClick={()=>onDismiss(p.key)} aria-label={"بستن پیام "+p.name}><Icon icon={X} aria-hidden="true"/></Button>
  </Alert>)}
  {items.length>0&&<ul aria-label="پیوست‌ها" className="flex flex-wrap gap-2">
   {items.map(a=><AttachmentChip key={a.id} item={a} onChange={patch=>onChange(a.id,patch)} onRemove={()=>onRemove(a.id)} onPreview={()=>onPreview(a)}/>)}
  </ul>}
  <p className="type-caption text-fg-secondary">
   {items.length>0&&<span>{fa(items.length)} از {fa(MAX_ATTACHMENTS)} پیوست</span>}
   {reading&&<span role="status">{items.length>0?" · ":""}در حال بررسی فایل‌ها…</span>}
  </p>
  {items.length>0&&<p className="type-caption text-fg-secondary">{ATTACHMENT_NOTE}</p>}
 </div>;
}
