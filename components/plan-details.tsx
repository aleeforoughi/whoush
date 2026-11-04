"use client";
import type {ReactNode} from "react";
import {Accordion,AccordionContent,AccordionItem,AccordionTrigger,Badge} from "@aleeforoughi/feather-react";
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

/** The collapsible «جزئیات برنامه»: camera or shot design, constraints, continuity, QA. All of it is a proposal, not verified model settings. */
export function PlanDetails({plan,defaultOpen=false}:{plan:PublicCreativePlan;defaultOpen?:boolean}){
 const {camera,shot,identityLock,speech,references}=plan;
 return <Accordion defaultValue={defaultOpen?["plan"]:[]}>
  <AccordionItem value="plan">
   <AccordionTrigger>جزئیات برنامه</AccordionTrigger>
   <AccordionContent>
    <div className="flex flex-col gap-5">
     <p className="type-caption text-fg-secondary">این‌ها پیشنهاد کارگردانی هووش است، نه تنظیمات تأییدشدهٔ مدل.</p>
     <Facts title="کلیات" rows={[["نوع خروجی",plan.mediaKind==="video"?"ویدیو":"تصویر"],["سبک",plan.realism.mode==="photoreal"?"واقع‌گرایانه":"سبک‌دار"],...(plan.style?[["سبک انتخاب‌شده",STYLE_LABEL_FA[plan.style]] as const]:[])]}/>
     {references.length>0&&<section className="flex flex-col gap-2">
      <h4 className="type-label text-fg-primary">مراجع</h4>
      <ul className="flex flex-col gap-1 type-body-sm text-fg-primary">{references.map(r=><li key={r.tag}><bdi>{displayTag(r.tag)}</bdi> · {r.labelFa}{r.roleSource==="inferred"&&" (انتخاب هووش)"}</li>)}</ul>
     </section>}
     {camera&&<Facts title="دوربین" rows={[
      ["حال‌وهوای دوربین",text(camera.look)],
      ["لنز",<>{fa(camera.focalLengthMm)} میلی‌متر</>],
      ["دیافراگم",latin(camera.aperture)],
      ["سرعت شاتر",latin(camera.shutter)],
      ["ISO",fa(camera.iso)],
      ["تراز سفیدی",<>{fa(camera.whiteBalanceK)} کلوین</>],
      ["کادر",text(camera.framing)],
      ["نور",text(camera.lighting)],
      ["فوکوس",text(camera.focus)],
      ["نسبت تصویر",latin(camera.aspectRatio)]
     ]}/>}
     {shot&&<Facts title="نما" rows={[
      ["اندازه نما",text(shot.shotSize)],
      ["حرکت دوربین",text(shot.cameraMovement)],
      ["لنز",text(shot.lens)],
      ["فریم‌ریت",<>{fa(shot.targetFps)} {latin("fps")}</>],
      ["زاویه شاتر",<>{fa(shot.shutterAngle)} درجه</>],
      ["مدت",<>{fa(shot.durationSeconds)} ثانیه</>]
     ]}/>}
     <Bullets title="قیدهای قطعی" items={plan.hardConstraints}/>
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
 </Accordion>;
}
