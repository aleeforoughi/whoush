"use client";
import {BookOpenCheck,RotateCcw,ShieldCheck,X} from "lucide-react";
import {Icon} from "@aleeforoughi/feather-react";
import type {GenerationProposal,ProposalResearch} from "@/lib/types";
import {fa} from "@/lib/format";

export const RESEARCH_TITLE_FA="تحقیق هووش";
const SOURCE_FA={wikimedia:"ویکی‌مدیا",openverse:"اوپن‌ورس"} as const;

/**
 * Whoush's research report on a proposal (docs/RESEARCH_PIPELINE.md): what had to look right, the reference package it found (open-licensed, inspected),
 * each with its source and license, and honest notes. The user confirms the package by generating; a wrong reference is removed here (✕, restorable) or
 * corrected in the chat. Read-only on past proposals (no `onToggle`).
 */
export function ResearchReport({research,excluded,onToggle}:{research:ProposalResearch;excluded?:ReadonlySet<string>;onToggle?:(id:string)=>void}){
 const kept=research.references.filter(r=>!excluded?.has(r.id)).length;
 return <section aria-label={RESEARCH_TITLE_FA} className="flex flex-col gap-2.5 rounded-card border border-line-secondary bg-surface-subtle p-3">
  <p className="flex items-center gap-2 type-label text-fg-primary"><Icon icon={BookOpenCheck} size={16} aria-hidden="true" className="size-4 text-primary"/>{RESEARCH_TITLE_FA}</p>
  <ul className="flex flex-col gap-1.5">
   {research.subjects.map(s=><li key={s.labelFa} className="flex flex-col gap-0.5">
    <span className="type-body-sm text-fg-primary">{s.labelFa}</span>
    {s.factsFa.map(f=><span key={f} className="type-caption text-fg-secondary">• {f}</span>)}
   </li>)}
  </ul>
  {research.references.length>0&&<>
   <p className="type-caption text-fg-secondary">
    {research.usedAsImages?"این مرجع‌ها رو پیدا کردم (آزاد و بررسی‌شده). اگه یکی اشتباهه حذفش کن یا توی چت بگو؛ با «بسازش» تأییدشون می‌کنی.":"این مرجع‌ها رو پیدا کردم و در نوشتن صحنه به کار بردم."}
   </p>
   <ul aria-label={"مرجع‌ها: "+fa(kept)+" از "+fa(research.references.length)} className="flex flex-wrap gap-2">
    {research.references.map(r=>{
     const off=excluded?.has(r.id)??false,attribution=r.title+" · "+r.creator+" · "+r.license+" · "+SOURCE_FA[r.source];
     return <li key={r.id} className={"relative w-20 shrink-0 motion-state "+(off?"opacity-40":"")}>
      <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer" title={attribution} aria-label={"منبع: "+attribution}
       className="block overflow-hidden rounded-control border border-line-secondary bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
       {/* eslint-disable-next-line @next/next/no-img-element -- a Whoush-owned copy of an open-licensed reference */}
       <img src={r.url} alt="" loading="lazy" className="block aspect-square w-full object-cover"/>
      </a>
      <span className="mt-1 block truncate type-caption text-fg-secondary" dir="ltr">{r.license}</span>
      {onToggle&&research.usedAsImages&&<button type="button" onClick={()=>onToggle(r.id)} aria-pressed={off}
       aria-label={(off?"برگرداندن مرجع: ":"حذف مرجع: ")+r.subjectFa}
       className="absolute end-1 top-1 flex size-6 items-center justify-center rounded-full bg-background/85 text-fg-primary shadow-sm motion-hover hover:bg-background focus-visible:outline-2 focus-visible:outline-ring">
       <Icon icon={off?RotateCcw:X} size={16} aria-hidden="true" className="size-3.5"/>
      </button>}
     </li>;
    })}
   </ul>
  </>}
  {research.notesFa.map(n=><p key={n} className="type-caption text-fg-secondary">{n}</p>)}
 </section>;
}

export const REVIEW_TITLE_FA="بررسی پیش از ساخت";
/**
 * The pre-generation risk check on a proposal: what could have gone wrong with this model, each already fixed in the prompt, or a short all-clear. Shown
 * only when the check ran.
 */
export function ReviewNote({review}:{review:NonNullable<GenerationProposal["review"]>}){
 return <section aria-label={REVIEW_TITLE_FA} className="flex flex-col gap-1.5 rounded-card border border-line-secondary bg-surface-subtle p-3">
  <p className="flex items-center gap-2 type-label text-fg-primary"><Icon icon={ShieldCheck} size={16} aria-hidden="true" className="size-4 text-primary"/>{REVIEW_TITLE_FA}</p>
  {review.risks.length
   ?<><p className="type-caption text-fg-secondary">این‌ها رو قبل از ساخت پیدا کردم و توی پرامپت درستشون کردم:</p>
    <ul className="flex flex-col gap-1">{review.risks.map(r=><li key={r.issueFa} className="type-caption text-fg-primary">• {r.issueFa}</li>)}</ul></>
   :<p className="type-caption text-fg-secondary">بررسی شد؛ ریسک مهمی پیدا نشد.</p>}
 </section>;
}

