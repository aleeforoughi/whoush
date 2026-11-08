"use client";
import {Badge} from "@aleeforoughi/feather-react";
import {displayTag,type AttachmentRole,type LocalAttachment} from "@/lib/attachments";

export const LANGUAGES=[{value:"fa",label:"فارسی"},{value:"other",label:"زبان دیگر"},{value:"unknown",label:"نامشخص"}];
export const ACCENTS=[{value:"original",label:"حفظ لهجهٔ اصلی"},{value:"tehrani",label:"تهرانی"},{value:"unspecified",label:"نامشخص"}];
/** `role: null` goes back to «انتخاب اتوماتیک هووش» (no role chosen). */
export type AttachmentPatch=Partial<Pick<LocalAttachment,"speech">>&{role?:AttachmentRole|null};
export const AUTO_ROLE_FA="انتخاب اتوماتیک هووش";
export const canPreview=(a:LocalAttachment)=>Boolean(a.previewUrl)&&(a.kind==="image"||a.kind==="video");
/** The Persian tag (`#تصویر-۱`) in a `<bdi>`; it is Persian text now, so it takes its direction from its own letters. */
const tagText=(tag:string)=><bdi>{displayTag(tag)}</bdi>;

/** The tag as a small Badge; with `onMention` it is a button that puts the Persian tag (`#تصویر-۱`) into the prompt at the caret. */
export function TagBadge({tag,onMention}:{tag:string;onMention?:()=>void}){
 const badge=<Badge variant="secondary">{tagText(tag)}</Badge>;
 return onMention
  ?<button type="button" onClick={onMention} aria-label={"درج "+displayTag(tag)+" در متن"} className="hit-area inline-flex rounded-control motion-hover not-disabled:hover:opacity-80">{badge}</button>
  :badge;
}
