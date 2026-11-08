"use client";
import {VideoThumb} from "@/components/video-poster";
import {AudioLines,Brush,FileJson,FileText,Image as ImageIcon,Play,Video,X,type LucideIcon} from "lucide-react";
import {Icon,Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from "@aleeforoughi/feather-react";
import {ACCENTS,LANGUAGES,TagBadge,canPreview,type AttachmentPatch} from "@/components/attachment-chip";
import {INSERT_ICONS} from "@/components/insert-menu";
import {MainSubjectStar} from "@/components/main-subject-star";
import {PhotoReviewOverlay} from "@/components/photo-review-badge";
import {EditImageButton} from "@/components/edit-image-button";
import type {PhotoReview} from "@/lib/photo-review";
import {BRUSH_EDIT_FA,BRUSH_MARKED_FA} from "@/lib/region-edit";
import {displayTag,isMediaKind,roleLabelFa,rolesFor,type AttachmentKind,type AttachmentRole,type AttachmentSpeech,type LocalAttachment} from "@/lib/attachments";
import {roleIconKey,type InsertIconKey} from "@/lib/insert-menu";
import {faBytes,faDuration} from "@/lib/format";

const AUTO_ROLE="auto";
export const CARD_AUTO_ROLE_FA="اتوماتیک";
/**
 * The shared card geometry, so an empty upload card and the file card that replaces it are the same size: 12rem wide, a 16:9 media area on top (the upload button
 * with the category when empty, the thumbnail when filled), a 1.75rem tag row and a 2.25rem role row (the height of a compact `sm` menu: role icon at the start, role name, a small delete button at the end; the icon and the delete
 * button's X both sit 4px in from the media edge). Menus in a card are the compact `sm` size; their touch targets stay 44px (`hit-area`).
 * In the composer row every card stretches to the tallest one, so a lip-sync card with its extra menus still lines up.
 */
export const CARD_FRAME="relative flex w-48 shrink-0 flex-col gap-2 rounded-control border p-2";
export const CARD_MEDIA="relative flex aspect-video w-full shrink-0 items-center justify-center overflow-hidden rounded-control";
export const CARD_META="flex h-7 items-center gap-2 ps-1";
export const CARD_FOOT="flex h-9 w-full items-center gap-2 ps-1";
/** Category icons for the media area of documents and audio. */
const KIND_ICONS:Record<AttachmentKind,LucideIcon>={image:ImageIcon,video:Video,audio:AudioLines,pdf:FileText,json:FileJson,md:FileText};

/** The small delete button at the end of the role row: 28px to the eye, a 44px touch target (`hit-area`); pulled 2px outwards so its X lines up 4px in, like the role icon. */
export function CardRemove({label,onClick}:{label:string;onClick:()=>void}){
 return <button type="button" onClick={onClick} aria-label={label}
  className="hit-area -me-0.5 flex size-7 shrink-0 items-center justify-center rounded-control text-fg-secondary motion-hover hover:bg-surface-hover hover:text-fg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
  <Icon icon={X} size={16} aria-hidden="true"/>
 </button>;
}
/** The role row: the role's icon at the start (right in RTL), the role name, and the delete button at the end (left in RTL); no delete button on a sent card. No frame around the role. */
export function CardRoleRow({icon,label,muted,remove}:{icon:InsertIconKey;label:string;muted?:boolean;remove?:{label:string;onClick:()=>void}}){
 return <span className={CARD_FOOT}>
  <Icon icon={INSERT_ICONS[icon]} size={16} aria-hidden="true" className="shrink-0 text-fg-secondary"/>
  <span className={"min-w-0 flex-1 truncate type-label "+(muted?"text-fg-secondary":"text-fg-primary")}>{label}</span>
  {remove&&<CardRemove {...remove}/>}
 </span>;
}

/** The card's media area: the thumbnail (a button that opens the full-screen viewer for images and video), or the kind's icon and the file name. */
function CardMedia({item:a,onPreview,review,onRetryReview}:{item:LocalAttachment;onPreview:()=>void;review?:PhotoReview;onRetryReview?:()=>void}){
 const frame=CARD_MEDIA+" bg-surface-hover text-fg-secondary";
 const visual=a.kind==="image"&&a.previewUrl
  // A painted photo shows its marked copy, so the area to change stays visible.
  // eslint-disable-next-line @next/next/no-img-element -- a local blob: URL; next/image cannot optimize it
  ?<img src={a.regionEdit?.guideUrl??a.previewUrl} alt="" className="size-full object-cover"/>
  :a.kind==="video"&&a.previewUrl
   ?<><VideoThumb url={a.previewUrl} className="size-full object-cover"/>
    <span className="absolute inset-0 flex items-center justify-center"><span className="flex size-8 items-center justify-center rounded-control bg-background/70 text-fg-primary"><Icon icon={Play} size={16} aria-hidden="true"/></span></span></>
   :<span className="flex min-w-0 flex-col items-center gap-1 px-3 text-center"><Icon icon={KIND_ICONS[a.kind]} size={32} aria-hidden="true"/><span className="max-w-full truncate type-caption" title={a.name}><bdi>{a.name}</bdi></span></span>;
 const view=canPreview(a)
  ?<button type="button" onClick={onPreview} data-viewer-open={a.id} aria-label={"نمایش تمام‌صفحه "+displayTag(a.tag)} title={a.name} className={frame+" motion-hover not-disabled:hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"}>{visual}</button>
  :<span className={frame}>{visual}</span>;
 // The photo's safety check sits over the thumbnail (lib/photo-review.ts); the overlay is its own layer, so the viewer button stays one control.
 return (a.kind==="image"||a.kind==="video")&&review?<span className="relative block w-full">{view}<span className="pointer-events-none absolute inset-0 overflow-hidden rounded-control"><PhotoReviewOverlay review={review} onRetry={onRetryReview}/></span></span>:view;
}

/**
 * A file attached to the next message, as a card inside the chat input: the same geometry as the empty upload card it filled, now solid, with the thumbnail on top
 * (a button that opens the full-screen viewer for images and video), the tag (a button that inserts it into the prompt; name and size in the tooltip) and the role
 * row. A role the user chose is fixed text (to change it, remove the card and add another); a file with no role gets the optional role menu in that row. A lip-sync
 * audio also gets language and accent.
 */
export function AttachmentCard({item:a,onChange,onRemove,onPreview,onMention,main,onToggleMain,review,onRetryReview,onBrush}:{item:LocalAttachment;onChange:(patch:AttachmentPatch)=>void;onRemove:()=>void;onPreview:()=>void;onMention:()=>void;
 /** «ویرایش با قلم»: paint the part of the photo to change (photos only). */onBrush?:()=>void;
 /** The photo's safety check: progress, verified badge, or why it cannot be used (and a retry when the check failed). */review?:PhotoReview;onRetryReview?:()=>void;
 /** «سوژه اصلی»: whether this file is the main subject, and the star that toggles it (optional). */main?:boolean;onToggleMain?:()=>void}){
 // On the narrow card the no-role option reads «اتوماتیک» (the full «انتخاب اتوماتیک هووش» would be cut off beside the delete button); the menu items are unchanged otherwise.
 // The role menu, plus the file's own role when it is one the menu does not list (a role chosen in the + menu, such as «ادیت عکس»), so it shows as chosen.
 const listed=rolesFor(a.kind).map(r=>({value:r.id as string,label:r.labelFa}));
 const media=isMediaKind(a.kind),roles=[{value:AUTO_ROLE,label:CARD_AUTO_ROLE_FA},...(a.role&&!listed.some(r=>r.value===a.role)?[{value:a.role as string,label:roleLabelFa(a.role,a.kind)}]:[]),...listed];
 const lip=a.role==="lip_sync"?a.speech:undefined;
 const set=(patch:Partial<AttachmentSpeech>)=>a.speech&&onChange({speech:{...a.speech,...patch}});
 const remove={label:"حذف "+a.name,onClick:onRemove};
 return <li id={"attachment-"+a.id} className={CARD_FRAME+" whoush-widget"}>
  <CardMedia item={a} onPreview={onPreview} review={review} onRetryReview={onRetryReview}/>
  <span className={CARD_META} title={a.name+" · "+faBytes(a.bytes)}>
   <TagBadge tag={a.tag} onMention={onMention}/>
   {a.durationSeconds!==undefined&&<span className="type-caption text-fg-secondary"><bdi>{faDuration(a.durationSeconds)}</bdi></span>}
   {onBrush&&a.kind==="image"&&<button type="button" onClick={onBrush} aria-label={BRUSH_EDIT_FA+" "+displayTag(a.tag)} title={a.regionEdit?BRUSH_MARKED_FA:BRUSH_EDIT_FA}
    className={"hit-area flex size-7 shrink-0 items-center justify-center rounded-control motion-hover hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring "+"ms-auto "+(a.regionEdit?"text-primary":"text-fg-secondary")}>
    <Icon icon={Brush} size={16} aria-hidden="true"/></button>}
   {onToggleMain&&<MainSubjectStar tag={a.tag} on={Boolean(main)} onToggle={onToggleMain} className={onBrush&&a.kind==="image"?"":"ms-auto"}/>}
  </span>
  {/* A role the user chose is fixed: the card shows it, and changing it means removing the card and adding another. A file with no role, or with a role
      Whoush detected (owner, 2026-11-08: «if Whoush got it wrong, the user changes it»), keeps the menu, the detected role selected. */}
  {media&&a.role&&!a.roleAuto&&<CardRoleRow icon={roleIconKey(a.kind,a.role)} label={roleLabelFa(a.role,a.kind)} remove={remove}/>}
  {media&&(!a.role||a.roleAuto)&&<span className={CARD_FOOT}>
   <Select value={a.role??AUTO_ROLE} onValueChange={v=>onChange({role:v===AUTO_ROLE?null:v as AttachmentRole})} items={roles}>
    <SelectTrigger size="sm" aria-label={"نقش "+displayTag(a.tag)} className="min-w-0 flex-1"><SelectValue/></SelectTrigger>
    <SelectContent>{roles.map(r=><SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
   </Select>
   <CardRemove {...remove}/>
  </span>}
  {!media&&<CardRoleRow icon="document" label={a.name} remove={remove}/>}
  {lip&&<>
   <Select value={lip.language} onValueChange={v=>set({language:v as AttachmentSpeech["language"]})} items={LANGUAGES}>
    <SelectTrigger size="sm" aria-label="زبان گفتار" className="w-full"><span className="text-fg-secondary">زبان</span><SelectValue/></SelectTrigger>
    <SelectContent>{LANGUAGES.map(l=><SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
   </Select>
   <Select value={lip.accent} onValueChange={v=>set({accent:v as AttachmentSpeech["accent"]})} items={ACCENTS}>
    <SelectTrigger size="sm" aria-label="لهجه" className="w-full"><span className="text-fg-secondary">لهجه</span><SelectValue/></SelectTrigger>
    <SelectContent>{ACCENTS.map(l=><SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
   </Select>
  </>}
 </li>;
}

/**
 * A file in a sent message, as the same card the user built in the chat input (same size, thumbnail, tag and role row with its icon), read-only: the thumbnail
 * opens the viewer, the tag inserts itself into the prompt, and there is no delete button or role menu. A file with no role reads «اتوماتیک»; a lip-sync audio
 * adds its language and accent.
 */
export function SentAttachmentCard({item:a,onPreview,onMention,review,onBrush}:{item:LocalAttachment;onPreview:()=>void;onMention:()=>void;review?:PhotoReview;onBrush?:()=>void}){
 const media=isMediaKind(a.kind),lip=a.role==="lip_sync"?a.speech:undefined;
 const label=(list:readonly {value:string;label:string}[],v:string)=>list.find(x=>x.value===v)?.label??v;
 return <li className={CARD_FRAME+" whoush-widget"}>
  <span className="group relative block">{onBrush&&a.kind==="image"&&<EditImageButton label={displayTag(a.tag)} onClick={onBrush}/>}<CardMedia item={a} onPreview={onPreview} review={review}/></span>
  <span className={CARD_META} title={a.name+" · "+faBytes(a.bytes)}>
   <TagBadge tag={a.tag} onMention={onMention}/>
   {a.durationSeconds!==undefined&&<span className="type-caption text-fg-secondary"><bdi>{faDuration(a.durationSeconds)}</bdi></span>}
  </span>
  {media
   ?<CardRoleRow icon={a.role?roleIconKey(a.kind,a.role):"auto"} label={a.role?roleLabelFa(a.role,a.kind):CARD_AUTO_ROLE_FA}/>
   :<CardRoleRow icon="document" label={a.name}/>}
  {lip&&<span className={CARD_FOOT+" type-caption text-fg-secondary"}>{label(LANGUAGES,lip.language)} · {label(ACCENTS,lip.accent)}</span>}
 </li>;
}

/**
 * A # the user picked in the chat box (owner, 2026-11-06): the referenced photo or generation shown as a card beside the new files, exactly like a reference,
 * so it is recognisable at a glance. Its ✕ takes the # out of the message.
 */
export function MentionRefCard({tag,thumbUrl,kind,label,onRemove,onPreview}:{tag:string;thumbUrl?:string;kind:AttachmentKind|"generation";label:string;onRemove:()=>void;onPreview?:()=>void}){
 const media=CARD_MEDIA+" bg-surface-hover text-fg-secondary";
 const visual=thumbUrl
  // eslint-disable-next-line @next/next/no-img-element -- a local blob: URL or an owned output
  ?<img src={thumbUrl} alt="" className="size-full object-cover"/>
  :<Icon icon={kind==="generation"?ImageIcon:KIND_ICONS[kind]} size={32} aria-hidden="true"/>;
 return <li className={CARD_FRAME+" border-dashed border-line-primary bg-surface-subtle"}>
  {onPreview?<button type="button" onClick={onPreview} aria-label={"نمایش "+displayTag(tag)} className={media+" motion-hover not-disabled:hover:opacity-90"}>{visual}</button>:<span className={media}>{visual}</span>}
  <span className={CARD_META}><TagBadge tag={tag}/></span>
  <CardRoleRow icon={kind==="generation"?"auto":kind==="image"?"auto":"document"} label={label} muted remove={{label:"برداشتن "+displayTag(tag)+" از پیام",onClick:onRemove}}/>
 </li>;
}
