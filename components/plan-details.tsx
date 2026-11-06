"use client";
import {useState,type ReactNode} from "react";
import {Aperture,ArrowLeft,Brush,Camera,SlidersHorizontal,CircleCheck,CircleHelp,Clapperboard,ImagePlus,Image as ImageIcon,Film,Focus,Frame,Gauge,Layers,Lightbulb,ListChecks,MessageCircle,Move,Paperclip,RefreshCw,RectangleHorizontal,Ruler,ShieldCheck,Sparkles,Star,Thermometer,Timer,Upload,type LucideIcon} from "lucide-react";
import {Accordion,AccordionContent,AccordionItem,AccordionTrigger,Badge,Button,Icon} from "@aleeforoughi/feather-react";
import type {ReferenceRequest} from "@/lib/reference-needs";
import {StagingEditor} from "@/components/staging-editor";
import type {Staging} from "@/lib/creative-plan";
import {STYLE_LABEL_FA,type PublicCreativePlan} from "@/lib/creative-plan";
import {CHARACTER_VIEWS} from "@/lib/characters";
import {displayTag} from "@/lib/attachments";
import {EDIT_CARD_OPEN_FA} from "@/lib/edit-card";
import {NEON_SHADOW,REGION_COLORS,regionTagFa} from "@/lib/region-edit";
import {fa,faText,faAuto} from "@/lib/format";
import type {QuestionChoice} from "@/lib/media-intent";
import {MAIN_SUBJECT_FA,shownTag} from "@/lib/main-subject";
import {expandFocus,lensFor} from "@/lib/staging";

const latin=(v:string|number)=><bdi dir="ltr">{faText(String(v))}</bdi>;
const text=(v:string)=><span dir="auto">{faAuto(v)}</span>;
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
 * A generation plan as part of the conversation (not inside the card): the intent, the references, the camera or shot settings as icon chips and lines, and the hard constraints; preferences, identity lock, continuity, speech and the QA checklist
 * fold under «جزئیات بیشتر»; «بوم» (the adjustable scene) comes last. All of it is Whoush's proposal, not verified model settings.
 */
/** A brush region's tag as a neon chip (the same colours as the editor). */
export function RegionChip({n,color}:{n:number;color:string}){
 const c=REGION_COLORS.find(x=>x.name===color)??REGION_COLORS[0];
 return <bdi className="shrink-0 rounded-[4px] px-1.5 py-0.5 type-caption font-medium" style={{background:c.css,color:c.ink,boxShadow:NEON_SHADOW}}>{regionTagFa(n)}</bdi>;
}
export const DETAILS_FA="جزئیات و تنظیمات";
export function PlanStory({plan,onStagingChange,focus}:{plan:PublicCreativePlan;
 /** A follow-up about one or two parts of the scene: «بوم» shows just those parts (expandable to all), and the rest of the plan folds under «جزئیات پرامپت». */
 focus?:readonly string[];
 /** When set (the live generation), «بوم» is adjustable and every change flows to the generation card. */onStagingChange?:(s:Staging,aspect:string,changed:boolean)=>void}){
 const {shot,identityLock,speech,references,staging}=plan;
 // When the user arranges «بوم», Whoush re-picks the lens for that scene (the same choice the build uses): shown here live.
 const [arranged,setArranged]=useState<Staging|null>(null);
 const lens=arranged?lensFor(arranged):undefined;
 const camera=plan.camera&&lens?{...plan.camera,focalLengthMm:lens.focalLengthMm,aperture:lens.aperture,iso:lens.iso,focus:lens.fa}:plan.camera;
 const onArrange=onStagingChange?(s:Staging,aspect:string,changed:boolean)=>{setArranged(changed?s:null);onStagingChange(s,aspect,changed);}:undefined;
 const more=plan.softPreferences.length+plan.continuity.locks.length+plan.continuity.antiTeleport.length+plan.qaChecklist.length>0||identityLock||speech;
 // Clean and task-first (owner, 2026-11-06): the goal, the brush edits and the references show; camera, shot, constraints, the rest of the plan and «بوم»
 // fold into one collapsed «جزئیات و تنظیمات», a tap away. A brush edit has no scene to arrange, so it has no «بوم».
 const brush=plan.regionEdits?.length?plan.regionEdits:undefined;
 const summary=<>
  <Section icon={Sparkles} title="هدف">
   <p className="type-body-sm text-fg-primary">{text(plan.intentSummaryFa)}</p>
   <ul className="flex flex-wrap gap-2">
    <Spec icon={plan.mediaKind==="video"?Clapperboard:Camera} label="نوع خروجی">{plan.mediaKind==="video"?"ویدیو":"تصویر"}</Spec>
    {plan.mainSubject&&<li className="inline-flex h-7 items-center gap-1.5 rounded-control bg-surface-selected px-2 type-caption text-fg-primary" title={MAIN_SUBJECT_FA}>
     <Icon icon={Star} size={16} aria-hidden="true" className="size-3.5 shrink-0 fill-current text-primary"/>{MAIN_SUBJECT_FA}: <bdi className="type-label">{shownTag(plan.mainSubject)}</bdi></li>}
    <Spec icon={Sparkles} label="سبک">{plan.style?STYLE_LABEL_FA[plan.style]:plan.realism.mode==="photoreal"?"واقع‌گرایانه":"سبک‌دار"}</Spec>
   </ul>
  </Section>
  {references.length>0&&<Section icon={Paperclip} title="مراجع">
   {/* Newest first (owner, 2026-11-06), once each. */}
   <ul className="flex flex-wrap gap-2">{[...references].filter((r,i,all)=>all.findIndex(x=>x.tag===r.tag)===i).sort((a,b)=>Number(b.tag.replace(/\D/g,""))-Number(a.tag.replace(/\D/g,""))).map(r=><li key={r.tag} className="inline-flex h-7 items-center gap-1.5 rounded-control bg-surface-subtle px-2 type-caption text-fg-primary">
    {plan.mainSubject===r.tag&&<Icon icon={Star} size={16} aria-hidden="true" className="size-3.5 shrink-0 fill-current text-primary"/>}<bdi className="type-label">{displayTag(r.tag)}</bdi><span className="text-fg-secondary">{r.labelFa}{r.roleSource==="inferred"&&" (انتخاب هووش)"}</span></li>)}</ul>
  </Section>}
  {brush&&<Section icon={Brush} title="ادیت‌ها">
   <ul className="flex flex-col gap-1.5">{brush.flatMap(b=>b.regions.map(r=><li key={b.tag+"-"+r.n} className="flex items-start gap-2 type-body-sm text-fg-primary">
    <RegionChip n={r.n} color={r.color}/><span className="min-w-0 break-words">{r.note}</span></li>))}</ul>
  </Section>}
 </>;
 const details=<>
  {camera&&<Section icon={Camera} title="دوربین">
   {lens&&<p className="type-caption text-primary">هووش لنز رو برای صحنه‌ای که چیدی دوباره انتخاب کرد.</p>}
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
    <Line icon={Ruler} label="لنز">{lens?latin(lens.focalLengthMm+"mm "+lens.aperture):text(shot.lens)}</Line>
   </ul>
  </Section>}
  {plan.hardConstraints.length>0&&<Section icon={ShieldCheck} title="قیدهای قطعی">
   <ul className="list-disc ps-5 type-body-sm text-fg-primary marker:text-fg-secondary">{plan.hardConstraints.map((x,i)=><li key={i}>{text(x)}</li>)}</ul>
  </Section>}
  {more&&<div className="flex flex-col gap-5">
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
  </div>}
 </>;
 const editor=staging&&!brush&&<StagingEditor staging={staging} aspectRatio={plan.camera?.aspectRatio} mediaKind={plan.mediaKind} onChange={onArrange} focus={focus?expandFocus(focus):undefined}/>;
 // A focused follow-up: only the part of «بوم» it is about, with the rest of the plan folded away.
 if(focus?.length)return <div className="flex flex-col gap-3">
  {summary}
  {editor}
  <Accordion>
   <AccordionItem value="plan" className="border-b-0">
    <AccordionTrigger className="rounded-card px-3 py-2.5 hover:no-underline hover:bg-surface-hover aria-expanded:bg-surface-selected aria-expanded:hover:bg-surface-selected"><span className="flex items-center gap-2"><Icon icon={ListChecks} size={16} aria-hidden="true" className="size-4 text-fg-secondary group-aria-expanded/accordion-trigger:text-primary"/>جزئیات پرامپت</span></AccordionTrigger>
    <AccordionContent><div className="flex flex-col gap-5 pt-3">{details}</div></AccordionContent>
   </AccordionItem>
  </Accordion>
 </div>;
 return <div className="flex flex-col gap-4">
  {summary}
  <Accordion>
   <AccordionItem value="details" className="border-b-0">
    <AccordionTrigger className="rounded-card px-3 py-2.5 hover:no-underline hover:bg-surface-hover aria-expanded:bg-surface-selected aria-expanded:hover:bg-surface-selected"><span className="flex items-center gap-2"><Icon icon={SlidersHorizontal} size={16} aria-hidden="true" className="size-4 shrink-0 text-fg-secondary"/><span className="type-label">{DETAILS_FA}</span></span></AccordionTrigger>
    <AccordionContent><div className="flex flex-col gap-5 pt-3">{details}{editor}</div></AccordionContent>
   </AccordionItem>
  </Accordion>
 </div>;
}

export const NEEDS_INPUT_FA="نیاز به پاسخ تو";
/** Icons for the one-tap answers: a photo, a video, both, or «آره، همونا». */
const CHOICE_ICON:Record<string,LucideIcon>={image:ImageIcon,video:Clapperboard,both:Layers,reuse:CircleCheck};
/**
 * The agent's question, always the last item of its message (after the plan and the card) so it is not missed. While it waits for an answer (`waiting`: nothing
 * has been sent since), it is highlighted with a flashing «نیاز به پاسخ تو» badge (a gentle pulse; still under reduced motion) and «پاسخ بده» moves focus to the
 * prompt. Once answered it stays as a quiet record.
 */
/**
 * Whoush's question, always the last item of its message while it waits («نیاز به پاسخ تو»). When Whoush asked for photos (a reference request: the user's
 * tattoos, logo, product...), it lists the angles it needs, each with «آپلود» (the photo lands in the chat input as a card with the right role) and a check
 * once it is in, then «ادامه» sends them with the original request.
 */
export function AgentQuestion({question,waiting,onAnswer,references,uploaded,onUpload,onContinue,choices,onChoose,editCard,onEdit}:{question:string;waiting:boolean;onAnswer:()=>void;
 /** The edit card (lib/edit-card.ts): the picture to open full screen for «ویرایش با قلم». */editCard?:{tag:string;thumbUrl?:string};onEdit?:()=>void;
 references?:ReferenceRequest;uploaded?:Record<string,boolean>;onUpload?:(angle:{id:string;titleFa:string})=>void;onContinue?:()=>void;
 /** One-tap answers («عکس»، «ویدیو»، «هر دو»): each sends its reply as the user's answer. */choices?:readonly QuestionChoice[];onChoose?:(reply:string)=>void}){
 const done=references?references.angles.filter(a=>uploaded?.[a.id]).length:0;
 return <div role={waiting?"status":undefined} className={"flex items-start gap-3 rounded-card p-3 "+(waiting?"border border-primary bg-surface-subtle":"bg-surface-subtle")}>
  <Icon icon={references?ImagePlus:CircleHelp} size={20} aria-hidden="true" className={"mt-0.5 shrink-0 "+(waiting?"text-primary":"text-fg-secondary")}/>
  <div className="flex min-w-0 flex-1 flex-col gap-2">
   {waiting&&<span className="inline-flex w-fit items-center gap-1.5 rounded-control bg-primary px-2.5 py-0.5 type-caption font-medium text-primary-foreground animate-pulse motion-reduce:animate-none">
    <span aria-hidden="true" className="size-1.5 rounded-full bg-current"/>{NEEDS_INPUT_FA}
   </span>}
   <p className="type-body-sm text-fg-primary">{text(question)}</p>
   {choices&&waiting&&onChoose&&<div role="group" aria-label={question} className="flex flex-wrap gap-2">
    {choices.map(c=><Button key={c.id} type="button" size="sm" variant="secondary" onClick={()=>onChoose(c.replyFa)}><Icon icon={CHOICE_ICON[c.id]??CircleCheck} aria-hidden="true"/>{c.labelFa}</Button>)}
   </div>}
   {references&&<ul className="flex flex-col gap-1.5" aria-label={"عکس‌های لازم: "+references.titleFa}>
    {references.angles.map(a=><li key={a.id} className="flex items-center gap-2 rounded-control border border-line-secondary px-2.5 py-1.5">
     <Icon icon={uploaded?.[a.id]?CircleCheck:ImageIcon} size={16} aria-hidden="true" className={"size-4 shrink-0 "+(uploaded?.[a.id]?"text-primary":"text-fg-secondary")}/>
     <span className="min-w-0 flex-1 type-caption text-fg-primary">{a.titleFa}</span>
     {waiting&&onUpload&&<Button type="button" size="sm" variant={uploaded?.[a.id]?"ghost":"secondary"} onClick={()=>onUpload(a)}><Icon icon={uploaded?.[a.id]?RefreshCw:Upload} aria-hidden="true"/>{uploaded?.[a.id]?"عوض کن":"آپلود"}</Button>}
    </li>)}
   </ul>}
   {references&&waiting&&onContinue&&<div className="flex flex-wrap items-center gap-2">
    <Button type="button" size="sm" onClick={onContinue} disabled={!done}>ادامه با {fa(done)} عکس<Icon icon={ArrowLeft} aria-hidden="true"/></Button>
    <span className="type-caption text-fg-secondary">هووش خودش نقش عکس‌ها رو تعیین می‌کنه و به {references.titleFa} وصلشون می‌کنه.</span>
   </div>}
   {editCard&&<div className="flex items-center gap-3 rounded-control border border-line-secondary p-2">
    {editCard.thumbUrl
     // eslint-disable-next-line @next/next/no-img-element -- a local or owned image
     ?<img src={editCard.thumbUrl} alt="" className="size-16 shrink-0 rounded-control object-cover"/>
     :<span className="flex size-16 shrink-0 items-center justify-center rounded-control bg-surface-hover"><Icon icon={ImageIcon} size={20} aria-hidden="true"/></span>}
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
     <bdi className="type-label text-fg-primary">{displayTag(editCard.tag)}</bdi>
     {onEdit&&<Button type="button" size="sm" className="w-fit" onClick={onEdit}><Icon icon={Brush} aria-hidden="true"/>{EDIT_CARD_OPEN_FA}</Button>}
    </div>
   </div>}
   {waiting&&!references&&!choices&&!editCard&&<button type="button" onClick={onAnswer} className="inline-flex w-fit items-center gap-1.5 rounded-control type-label text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"><Icon icon={MessageCircle} size={16} aria-hidden="true" className="size-4 shrink-0"/>پاسخ بده</button>}
  </div>
 </div>;
}
