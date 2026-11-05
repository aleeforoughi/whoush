"use client";
import type {ReactNode} from "react";
import {Aperture,Camera,CircleHelp,Clapperboard,Film,Focus,Frame,Gauge,Lightbulb,ListChecks,Move,Paperclip,RectangleHorizontal,Ruler,ShieldCheck,Sparkles,Thermometer,Timer,type LucideIcon} from "lucide-react";
import {Accordion,AccordionContent,AccordionItem,AccordionTrigger,Badge,Icon} from "@aleeforoughi/feather-react";
import {StagingEditor} from "@/components/staging-editor";
import type {Staging} from "@/lib/creative-plan";
import {STYLE_LABEL_FA,type PublicCreativePlan} from "@/lib/creative-plan";
import {CHARACTER_VIEWS} from "@/lib/characters";
import {displayTag} from "@/lib/attachments";
import {fa} from "@/lib/format";

const latin=(v:string|number)=><bdi dir="ltr">{v}</bdi>;
const text=(v:string)=><span dir="auto">{v}</span>;
const LIP_SYNC:Record<string,string>={needs_audio:"به فایل صوتی نیاز دارد",planned_from_audio:"از روی صدای مرجع برنامه‌ریزی شده",not_requested:"درخواست نشده"};
const ACCENT:Record<string,string>={tehrani:"تهرانی",original:"اصلی",unspecified:"نامشخص"};
const VIEW_TITLE:Record<string,string>=Object.fromEntries(CHARACTER_VIEWS.map(v=>[v.id,v.title]));

function Facts({title,rows}:{title:string;rows:ReadonlyArray<readonly [string,ReactNode]>}){
 return <section className="flex flex-col gap-2">
  <h4 className="type-label text-fg-primary">{title}</h4>
  <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1">
   {rows.map(([k,v])=><div key={k} className="contents"><dt className="type-body-sm text-fg-secondary">{k}</dt><dd className="type-body-sm text-fg-primary">{v}</dd></div>)}
  </dl>
 </section>;
}
function Bullets({title,items}:{title:string;items:readonly string[]}){
 if(items.length===0)return null;
 return <section className="flex flex-col gap-2">
  <h4 className="type-label text-fg-primary">{title}</h4>
  <ul className="list-disc ps-5 type-body-sm text-fg-primary marker:text-fg-secondary">{items.map((x,i)=><li key={i}>{text(x)}</li>)}</ul>
 </section>;
}

/** On an unsupported turn: the model that fits the work but is not active yet. Raw name, «به‌زودی» and the reasons; never a price or an approve action. */
export function SuggestedModelNote({model}:{model:NonNullable<PublicCreativePlan["suggestedModel"]>}){
 return <section aria-label="مدل پیشنهادی" className="flex flex-col gap-2 rounded-card border border-line-tertiary bg-surface-subtle p-3">
  <div className="flex flex-wrap items-center gap-2">
   <span className="type-label text-fg-primary">مدل پیشنهادی: <bdi>{model.name}</bdi></span>
   {!model.active&&<Badge variant="outline">به‌زودی</Badge>}
  </div>
  {model.blockersFa.length>0&&<ul className="list-disc ps-5 type-body-sm text-fg-secondary marker:text-fg-secondary">{model.blockersFa.map(b=><li key={b}>{b}</li>)}</ul>}
 </section>;
}

/** A section of the plan in the conversation: an icon and a title, then its content. */
function Section({icon,title,children}:{icon:LucideIcon;title:string;children:ReactNode}){
 return <section className="flex flex-col gap-2">
  <h4 className="flex items-center gap-2 type-label text-fg-primary"><Icon icon={icon} size={16} aria-hidden="true" className="size-4 shrink-0 text-fg-secondary"/>{title}</h4>
  {children}
 </section>;
}
/** A compact setting with its icon: «۸۵ میلی‌متر», «f/2.0», «ISO ۲۰۰». */
function Spec({icon,label,children}:{icon:LucideIcon;label:string;children:ReactNode}){
 return <li className="inline-flex h-7 items-center gap-1.5 rounded-control bg-surface-subtle px-2 type-caption text-fg-primary" title={label}>
  <Icon icon={icon} size={16} aria-hidden="true" className="size-3.5 shrink-0 text-fg-secondary"/><span className="sr-only">{label}: </span>{children}
 </li>;
}
/** A described setting with its icon: «کادر: …», «نور: …». */
function Line({icon,label,children}:{icon:LucideIcon;label:string;children:ReactNode}){
 return <li className="flex items-start gap-2 type-body-sm"><Icon icon={icon} size={16} aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-fg-secondary"/>
  <span className="min-w-0"><span className="text-fg-secondary">{label}: </span><span className="text-fg-primary">{children}</span></span></li>;
}

/**
 * A generation plan as part of the conversation (not inside the card): the intent, the references, the camera, framing and lighting
 * diagrams, the camera or shot settings as icon chips and lines, and the hard constraints; preferences, identity lock, continuity, speech and the QA checklist
 * fold under «جزئیات بیشتر». All of it is Whoush's proposal, not verified model settings.
 */
export function PlanStory({plan,onStagingChange}:{plan:PublicCreativePlan;
 /** When set (the live generation), «بوم» is adjustable and every change flows to the generation card. */onStagingChange?:(s:Staging,aspect:string,changed:boolean)=>void}){
 const {camera,shot,identityLock,speech,references,staging}=plan;
 const more=plan.softPreferences.length+plan.continuity.locks.length+plan.continuity.antiTeleport.length+plan.qaChecklist.length>0||identityLock||speech;
 return <div className="flex flex-col gap-5">
  <Section icon={Sparkles} title="هدف">
   <p className="type-body-sm text-fg-primary">{text(plan.intentSummaryFa)}</p>
   <ul className="flex flex-wrap gap-2">
    <Spec icon={plan.mediaKind==="video"?Clapperboard:Camera} label="نوع خروجی">{plan.mediaKind==="video"?"ویدیو":"تصویر"}</Spec>
    <Spec icon={Sparkles} label="سبک">{plan.style?STYLE_LABEL_FA[plan.style]:plan.realism.mode==="photoreal"?"واقع‌گرایانه":"سبک‌دار"}</Spec>
   </ul>
  </Section>
  {references.length>0&&<Section icon={Paperclip} title="مراجع">
   <ul className="flex flex-wrap gap-2">{references.map(r=><li key={r.tag} className="inline-flex h-7 items-center gap-1.5 rounded-control bg-surface-subtle px-2 type-caption text-fg-primary">
    <bdi className="type-label">{displayTag(r.tag)}</bdi><span className="text-fg-secondary">{r.labelFa}{r.roleSource==="inferred"&&" (انتخاب هووش)"}</span></li>)}</ul>
  </Section>}
  {staging&&<StagingEditor staging={staging} aspectRatio={camera?.aspectRatio} onChange={onStagingChange}/>}
  {camera&&<Section icon={Camera} title="دوربین">
   <ul className="flex flex-wrap gap-2">
    <Spec icon={Ruler} label="لنز">{fa(camera.focalLengthMm)} میلی‌متر</Spec>
    <Spec icon={Aperture} label="دیافراگم">{latin(camera.aperture)}</Spec>
    <Spec icon={Timer} label="سرعت شاتر">{latin(camera.shutter)}</Spec>
    <Spec icon={Gauge} label="حساسیت">{latin("ISO")} {fa(camera.iso)}</Spec>
    <Spec icon={Thermometer} label="تراز سفیدی">{fa(camera.whiteBalanceK)} کلوین</Spec>
    <Spec icon={RectangleHorizontal} label="نسبت تصویر">{latin(camera.aspectRatio)}</Spec>
   </ul>
   <ul className="flex flex-col gap-1.5">
    <Line icon={Camera} label="حال‌وهوا">{text(camera.look)}</Line>
    <Line icon={Frame} label="کادر">{text(camera.framing)}</Line>
    <Line icon={Lightbulb} label="نور">{text(camera.lighting)}</Line>
    <Line icon={Focus} label="فوکوس">{text(camera.focus)}</Line>
   </ul>
  </Section>}
  {shot&&<Section icon={Clapperboard} title="نما">
   <ul className="flex flex-wrap gap-2">
    <Spec icon={Timer} label="مدت">{fa(shot.durationSeconds)} ثانیه</Spec>
    <Spec icon={Film} label="فریم‌ریت">{fa(shot.targetFps)} {latin("fps")}</Spec>
    <Spec icon={Aperture} label="زاویه شاتر">{fa(shot.shutterAngle)} درجه</Spec>
   </ul>
   <ul className="flex flex-col gap-1.5">
    <Line icon={Frame} label="اندازه نما">{text(shot.shotSize)}</Line>
    <Line icon={Move} label="حرکت دوربین">{text(shot.cameraMovement)}</Line>
    <Line icon={Ruler} label="لنز">{text(shot.lens)}</Line>
   </ul>
  </Section>}
  {plan.hardConstraints.length>0&&<Section icon={ShieldCheck} title="قیدهای قطعی">
   <ul className="list-disc ps-5 type-body-sm text-fg-primary marker:text-fg-secondary">{plan.hardConstraints.map((x,i)=><li key={i}>{text(x)}</li>)}</ul>
  </Section>}
  {more&&<Accordion>
   <AccordionItem value="more" className="border-b-0">
    <AccordionTrigger className="py-0"><span className="flex items-center gap-2"><Icon icon={ListChecks} size={16} aria-hidden="true" className="size-4 text-fg-secondary"/>جزئیات بیشتر</span></AccordionTrigger>
    <AccordionContent>
     <div className="flex flex-col gap-5 pt-3">
      <p className="type-caption text-fg-secondary">این‌ها پیشنهاد کارگردانی هووش است، نه تنظیمات تأییدشدهٔ مدل.</p>
      <Bullets title="ترجیحات" items={plan.softPreferences}/>
      {identityLock&&<>
       <Facts title="قفل هویت کاراکتر" rows={[["زاویه‌های مرجع",identityLock.providedAngles.map(a=>VIEW_TITLE[a]??a).join("، ")]]}/>
       <Bullets title="ویژگی‌های ثابت" items={identityLock.lockedAttributes}/>
       <Bullets title="تغییرات مجاز" items={identityLock.allowedChanges}/>
      </>}
      <Bullets title="قفل‌های پیوستگی" items={[...plan.continuity.locks,...plan.continuity.antiTeleport]}/>
      {speech&&<Facts title="گفتار" rows={[["هم‌زمان‌سازی لب",LIP_SYNC[speech.lipSync.status]??speech.lipSync.status],["لهجه",ACCENT[speech.accent]??speech.accent]]}/>}
      <Bullets title="فهرست کنترل کیفیت" items={plan.qaChecklist}/>
     </div>
    </AccordionContent>
   </AccordionItem>
  </Accordion>}
 </div>;
}

export const NEEDS_INPUT_FA="نیاز به پاسخ تو";
/**
 * The agent's question, always the last item of its message (after the plan and the card) so it is not missed. While it waits for an answer (`waiting`: nothing
 * has been sent since), it is highlighted with a flashing «نیاز به پاسخ تو» badge (a gentle pulse; still under reduced motion) and «پاسخ بده» moves focus to the
 * prompt. Once answered it stays as a quiet record.
 */
export function AgentQuestion({question,waiting,onAnswer}:{question:string;waiting:boolean;onAnswer:()=>void}){
 return <div role={waiting?"status":undefined} className={"flex items-start gap-3 rounded-card p-3 "+(waiting?"border border-primary bg-surface-subtle":"bg-surface-subtle")}>
  <Icon icon={CircleHelp} size={20} aria-hidden="true" className={"mt-0.5 shrink-0 "+(waiting?"text-primary":"text-fg-secondary")}/>
  <div className="flex min-w-0 flex-1 flex-col gap-2">
   {waiting&&<span className="inline-flex w-fit items-center gap-1.5 rounded-control bg-primary px-2.5 py-0.5 type-caption font-medium text-primary-foreground animate-pulse motion-reduce:animate-none">
    <span aria-hidden="true" className="size-1.5 rounded-full bg-current"/>{NEEDS_INPUT_FA}
   </span>}
   <p className="type-body-sm text-fg-primary">{text(question)}</p>
   {waiting&&<button type="button" onClick={onAnswer} className="w-fit rounded-control type-label text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">پاسخ بده</button>}
  </div>
 </div>;
}
