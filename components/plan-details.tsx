"use client";
import {TagText} from "@/components/message-text";
import {useState,type ReactNode} from "react";
import {Aperture,ArrowLeft,Brush,Camera,SlidersHorizontal,CircleCheck,CircleHelp,Clapperboard,ImagePlus,Image as ImageIcon,Film,Focus,Frame,Gauge,Layers,Lightbulb,ListChecks,MessageCircle,Move,Paperclip,RefreshCw,RectangleHorizontal,Ruler,ShieldCheck,Sparkles,Star,Thermometer,Timer,Upload,type LucideIcon,LoaderCircle,WandSparkles,Check,X} from "lucide-react";
import {Accordion,AccordionContent,AccordionItem,AccordionTrigger,Badge,Button,Icon} from "@aleeforoughi/feather-react";
import type {ReferenceRequest} from "@/lib/reference-needs";
import {StagingEditor} from "@/components/staging-editor";
import type {Staging} from "@/lib/creative-plan";
import {STYLE_LABEL_FA,type PublicCreativePlan} from "@/lib/creative-plan";
import {CHARACTER_VIEWS} from "@/lib/characters";
import {displayTag} from "@/lib/attachments";
import {TagBadge} from "@/components/attachment-chip";
import {EDIT_CARD_GENERATE_FA,EDIT_CARD_OPEN_FA,EDIT_PREPARING_FA,type SuggestedEdit} from "@/lib/edit-card";
import {BEAUTIFY_SKIP_FA,BEAUTIFY_GO_FA,BEAUTIFY_GROUPS,BEAUTIFY_MINOR_FA,BEAUTIFY_NAME,BEAUTIFY_PARTS,BEAUTIFY_PARTS_MINOR,beautifySeenFa,type BeautifyPart} from "@/lib/beautify";
import {WIDGET_BUTTON,WidgetActions,WidgetHeader} from "@/components/widget";
import {AreaOverlay} from "@/components/area-overlay";
import {NEON_SHADOW,REGION_COLORS,regionTagFa} from "@/lib/region-edit";
import {fa,faText,faAuto} from "@/lib/format";
import type {QuestionChoice} from "@/lib/media-intent";
import {MAIN_SUBJECT_FA,shownTag} from "@/lib/main-subject";
import {expandFocus,lensFor} from "@/lib/staging";

const latin=(v:string|number)=><bdi dir="ltr">{faText(String(v))}</bdi>;
const text=(v:string)=><span dir="auto"><TagText text={v} format={faAuto}/></span>;
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
export function PlanStory({plan,onStagingChange,focus,widget}:{plan:PublicCreativePlan;
 /** A focused follow-up: the change widget that holds «بوم»'s changed parts and the generation's confirmation (owner, 2026-11-08). */widget?:(editor:ReactNode)=>ReactNode;
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
 const editor=staging&&!brush&&<StagingEditor staging={staging} aspectRatio={plan.camera?.aspectRatio} mediaKind={plan.mediaKind} onChange={onArrange} focus={focus?expandFocus(focus):undefined} embedded={Boolean(focus?.length&&widget)}/>;
 // A focused follow-up: only the part of «بوم» it is about, with the rest of the plan folded away.
 if(focus?.length)return <div className="flex flex-col gap-3">
  {summary}
  {widget?widget(editor):editor}
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
/** «Beautify it» offered on a photo (lib/beautify.ts). */
export type BeautifyCardOffer={tag:string;parts:readonly BeautifyPart[];notes?:Partial<Record<BeautifyPart,string>>;minor?:true;thumbUrl?:string};
/**
 * The «Beautify it» card (owner, 2026-11-08): the photo, what it does, a switch per part (all on as offered; tap to turn one off), and «Beautify it» at the
 * bottom, the full width. On its own it is the whole widget; under an edit card it is the other way to go, with its own title.
 */
function BeautifySection({offer,alone,busy,onBeautify,onSkip}:{offer:BeautifyCardOffer;alone:boolean;busy?:boolean;onBeautify?:(tag:string,parts:BeautifyPart[])=>void;
 /** «لازم نیست» (owner, 2026-11-08): the offer can always be turned down. */onSkip?:()=>void}){
 // Up to four general switches (owner, 2026-11-08: not a long checklist; only what the photo needs): a group shows when one of its parts was offered.
 const allowed=offer.minor?BEAUTIFY_PARTS_MINOR:BEAUTIFY_PARTS,groups=BEAUTIFY_GROUPS.filter(g=>g.parts.some(p=>allowed.includes(p)&&offer.parts.includes(p)));
 const [on,setOn]=useState<ReadonlySet<string>>(()=>new Set(groups.filter(g=>g.parts.some(p=>offer.parts.includes(p))).map(g=>g.id)));
 const toggle=(id:string)=>setOn(s=>{const n=new Set(s);if(n.has(id))n.delete(id);else n.add(id);return n;});
 const chosen=groups.filter(g=>on.has(g.id)).flatMap(g=>g.parts.filter(p=>allowed.includes(p)&&offer.parts.includes(p))),seen=beautifySeenFa(offer.notes);
 return <section aria-label={BEAUTIFY_NAME} className="flex flex-col gap-3">
  {!alone&&<h3 className="flex items-center gap-2 type-label text-fg-primary"><Icon icon={WandSparkles} size={16} aria-hidden="true" className="size-4 text-primary"/>{BEAUTIFY_NAME}</h3>}
  {alone&&<span className="relative block w-full overflow-hidden rounded-control bg-surface-hover">
   {offer.thumbUrl
    // eslint-disable-next-line @next/next/no-img-element -- a local or owned image
    ?<img src={offer.thumbUrl} alt="" className="block h-auto w-full"/>
    :<span className="flex aspect-video items-center justify-center text-fg-secondary"><Icon icon={ImageIcon} size={24} aria-hidden="true"/></span>}
  </span>}
  {seen&&<p className="type-body-sm text-fg-primary">{seen}</p>}
  {/* A switch per group: on (filled, a check) or off (outlined). */}
  <div role="group" aria-label={"بخش‌های "+BEAUTIFY_NAME} className="flex flex-wrap gap-2">
   {groups.map(g=>{const active=on.has(g.id);return <button key={g.id} type="button" aria-pressed={active} onClick={()=>toggle(g.id)} disabled={!onBeautify}
    className={"inline-flex min-h-11 items-center gap-1.5 rounded-control px-3 py-2 type-body-sm motion-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60 "
     +(active?"bg-primary/15 text-fg-primary hover:bg-primary/25":"bg-transparent text-fg-secondary ring-1 ring-line-secondary hover:bg-surface-hover")}>
    {active&&<Icon icon={Check} size={16} aria-hidden="true" className="size-4 text-primary"/>}{g.labelFa}</button>;})}
  </div>
  {offer.minor&&<p className="type-caption text-fg-secondary">{BEAUTIFY_MINOR_FA}</p>}
  {onBeautify&&<WidgetActions label={BEAUTIFY_NAME}>
   <Button type="button" onClick={()=>onBeautify(offer.tag,chosen)} disabled={!chosen.length||busy} aria-busy={busy||undefined} className={WIDGET_BUTTON}>
    <Icon icon={busy?LoaderCircle:WandSparkles} aria-hidden="true" className={busy?"animate-spin motion-reduce:animate-none":undefined}/>{BEAUTIFY_GO_FA}</Button>
   {onSkip&&<Button type="button" variant="outline" onClick={onSkip} disabled={busy} className={WIDGET_BUTTON}><Icon icon={X} aria-hidden="true"/>{BEAUTIFY_SKIP_FA}</Button>}
  </WidgetActions>}
 </section>;
}

/**
 * Whoush's question, always the last item of its message while it waits («نیاز به پاسخ تو»). When Whoush asked for photos (a reference request: the user's
 * tattoos, logo, product...), it lists the angles it needs, each with «آپلود» (the photo lands in the chat input as a card with the right role) and a check
 * once it is in, then «ادامه» sends them with the original request.
 */
export function AgentQuestion({question,repeated,preparing,waiting,onAnswer,references,uploaded,onUpload,onContinue,choices,onChoose,editCards,onEdit,onGenerate,beautify,onBeautify,beautifying,onSkipBeautify}:{question:string;waiting:boolean;onAnswer:()=>void;
 /** «لازم نیست» on the «زیباسازی» offer. */onSkipBeautify?:()=>void;
 /** «Beautify it» offered for a photo (lib/beautify.ts), and its button; `beautifying` while it is being sent. */beautify?:BeautifyCardOffer;onBeautify?:(tag:string,parts:BeautifyPart[])=>void;beautifying?:boolean;
 /** The question is the message just above it word for word: the widget shows only its title and its content, not the same text twice. */repeated?:boolean;
 /** The edit cards (lib/edit-card.ts): one per picture to open full screen for «ادیت», maybe with the areas Whoush painted. */editCards?:readonly {tag:string;thumbUrl?:string;suggested?:readonly SuggestedEdit[]}[];onEdit?:(tag:string,suggested?:readonly SuggestedEdit[])=>void;
 /** The tag whose «بساز» is preparing (its button shows it is working). */preparing?:string|null;
 /** «بساز» (owner, 2026-11-08): the areas Whoush marked go as they are, without opening the editor. */onGenerate?:(tag:string,suggested:readonly SuggestedEdit[])=>void;
 references?:ReferenceRequest;uploaded?:Record<string,boolean>;onUpload?:(angle:{id:string;titleFa:string})=>void;onContinue?:()=>void;
 /** One-tap answers («عکس»، «ویدیو»، «هر دو»): each sends its reply as the user's answer. */choices?:readonly QuestionChoice[];onChoose?:(reply:string)=>void}){
 const done=references?references.angles.filter(a=>uploaded?.[a.id]).length:0;
 const edits=editCards??[];
 // Every widget has a clear title (owner, 2026-11-08): what it is for, then the content, then its actions at the bottom.
 const title=references?"عکس‌های لازم: "+references.titleFa:edits.length>1?"ادیت عکس‌ها":edits.length?"ادیت عکس":beautify?BEAUTIFY_NAME:"سؤال هووش";
 return <div role={waiting?"status":undefined} className="whoush-widget flex w-full flex-col gap-4 rounded-card p-4">
  <WidgetHeader icon={references?ImagePlus:edits.length?Brush:beautify?WandSparkles:CircleHelp} title={title} tone={waiting?"attention":"neutral"}>
   {edits.length===1?<TagBadge tag={edits[0].tag}/>:!edits.length&&beautify?<TagBadge tag={beautify.tag}/>:null}
   {waiting&&<span className="ms-auto inline-flex shrink-0 items-center gap-1.5 rounded-control bg-primary px-2.5 py-0.5 type-caption font-medium text-primary-foreground animate-pulse motion-reduce:animate-none">
    <span aria-hidden="true" className="size-1.5 rounded-full bg-current"/>{NEEDS_INPUT_FA}
   </span>}
  </WidgetHeader>
  {!repeated&&<p className="type-body-sm text-fg-primary">{text(question)}</p>}
  {references&&<ul className="flex flex-col gap-1.5" aria-label={"عکس‌های لازم: "+references.titleFa}>
   {references.angles.map(a=><li key={a.id} className="flex min-h-12 items-center gap-2 rounded-control border border-line-secondary px-2.5 py-1.5">
    <Icon icon={uploaded?.[a.id]?CircleCheck:ImageIcon} size={16} aria-hidden="true" className={"size-4 shrink-0 "+(uploaded?.[a.id]?"text-primary":"text-fg-secondary")}/>
    <span className="min-w-0 flex-1 type-caption text-fg-primary">{a.titleFa}</span>
    {waiting&&onUpload&&<Button type="button" size="sm" variant={uploaded?.[a.id]?"ghost":"secondary"} onClick={()=>onUpload(a)}><Icon icon={uploaded?.[a.id]?RefreshCw:Upload} aria-hidden="true"/>{uploaded?.[a.id]?"عوض کن":"آپلود"}</Button>}
   </li>)}
  </ul>}
  {references&&waiting&&onContinue&&<p className="type-caption text-fg-secondary">هووش خودش نقش عکس‌ها رو تعیین می‌کنه و به {references.titleFa} وصلشون می‌کنه.</p>}
  {/* One card per picture: its #, the picture the full width with the areas Whoush marked, their comments, then «بساز» and «ادیت» at the bottom. */}
  {edits.length>0&&<ul className="flex flex-col gap-4">{edits.map(c=><li key={c.tag} className="flex flex-col gap-2.5">
   {edits.length>1&&<TagBadge tag={c.tag}/>}
   <span className="relative block w-full overflow-hidden rounded-control bg-surface-hover">
    {c.thumbUrl
     // eslint-disable-next-line @next/next/no-img-element -- a local or owned image
     ?<img src={c.thumbUrl} alt="" className="block h-auto w-full"/>
     :<span className="flex aspect-video items-center justify-center text-fg-secondary"><Icon icon={ImageIcon} size={24} aria-hidden="true"/></span>}
    {c.thumbUrl&&c.suggested?.length?<AreaOverlay photoUrl={c.thumbUrl} areas={c.suggested}/>:null}
   </span>
   {c.suggested&&c.suggested.length>0&&<ul className="flex flex-col gap-1.5">{c.suggested.map((sg,i)=><li key={i} className="flex items-start gap-2 type-body-sm text-fg-primary">
    <RegionChip n={i+1} color={REGION_COLORS[i%REGION_COLORS.length].name}/><span className="min-w-0 break-words">{sg.note}</span></li>)}</ul>}
   {(onEdit||onGenerate)&&<WidgetActions label={displayTag(c.tag)}>
    {onGenerate&&<Button type="button" onClick={()=>onGenerate(c.tag,c.suggested??[])} disabled={Boolean(preparing)} aria-busy={preparing===c.tag||undefined} className={WIDGET_BUTTON}>
     <Icon icon={preparing===c.tag?LoaderCircle:Sparkles} aria-hidden="true" className={preparing===c.tag?"animate-spin motion-reduce:animate-none":undefined}/>{preparing===c.tag?EDIT_PREPARING_FA:EDIT_CARD_GENERATE_FA}</Button>}
    {onEdit&&<Button type="button" variant={onGenerate?"outline":"default"} onClick={()=>onEdit(c.tag,c.suggested)} aria-label={EDIT_CARD_OPEN_FA+" "+displayTag(c.tag)} className={WIDGET_BUTTON}><Icon icon={Brush} aria-hidden="true"/>{EDIT_CARD_OPEN_FA}</Button>}
   </WidgetActions>}
  </li>)}</ul>}
  {beautify&&<BeautifySection offer={beautify} alone={!edits.length} busy={beautifying} onBeautify={waiting?onBeautify:undefined} onSkip={waiting?onSkipBeautify:undefined}/>}
  {choices&&waiting&&onChoose&&<WidgetActions label={question}>
   {choices.map(c=><Button key={c.id} type="button" variant="secondary" onClick={()=>onChoose(c.replyFa)} className={WIDGET_BUTTON}><Icon icon={CHOICE_ICON[c.id]??CircleCheck} aria-hidden="true"/>{c.labelFa}</Button>)}
  </WidgetActions>}
  {references&&waiting&&onContinue&&<WidgetActions>
   <Button type="button" onClick={onContinue} disabled={!done} className={WIDGET_BUTTON}>ادامه با {fa(done)} عکس<Icon icon={ArrowLeft} aria-hidden="true"/></Button>
  </WidgetActions>}
  {waiting&&!references&&!choices&&!edits.length&&!beautify&&<WidgetActions>
   <Button type="button" variant="outline" onClick={onAnswer} className={WIDGET_BUTTON}><Icon icon={MessageCircle} aria-hidden="true"/>پاسخ بده</Button>
  </WidgetActions>}
 </div>;
}
