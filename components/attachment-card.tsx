"use client";
import {AudioLines,FileJson,FileText,Image as ImageIcon,Play,Video,X,type LucideIcon} from "lucide-react";
import {Icon,Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from "@aleeforoughi/feather-react";
import {ACCENTS,LANGUAGES,TagBadge,canPreview,type AttachmentPatch} from "@/components/attachment-chip";
import {INSERT_ICONS} from "@/components/insert-menu";
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
function CardMedia({item:a,onPreview}:{item:LocalAttachment;onPreview:()=>void}){
 const frame=CARD_MEDIA+" bg-surface-hover text-fg-secondary";
 const visual=a.kind==="image"&&a.previewUrl
  // eslint-disable-next-line @next/next/no-img-element -- a local blob: URL; next/image cannot optimize it
  ?<img src={a.previewUrl} alt="" className="size-full object-cover"/>
  :a.kind==="video"&&a.previewUrl
   ?<><video src={a.previewUrl+"#t=0.1"} preload="metadata" muted playsInline aria-hidden="true" tabIndex={-1} className="size-full object-cover"/>
    <span className="absolute inset-0 flex items-center justify-center"><span className="flex size-8 items-center justify-center rounded-control bg-background/70 text-fg-primary"><Icon icon={Play} size={16} aria-hidden="true"/></span></span></>
   :<span className="flex min-w-0 flex-col items-center gap-1 px-3 text-center"><Icon icon={KIND_ICONS[a.kind]} size={32} aria-hidden="true"/><span className="max-w-full truncate type-caption" title={a.name}><bdi>{a.name}</bdi></span></span>;
 return canPreview(a)
  ?<button type="button" onClick={onPreview} data-viewer-open={a.id} aria-label={"نمایش تمام‌صفحه "+displayTag(a.tag)} title={a.name} className={frame+" motion-hover not-disabled:hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"}>{visual}</button>
  :<span className={frame}>{visual}</span>;
}

/**
 * A file attached to the next message, as a card inside the chat input: the same geometry as the empty upload card it filled, now solid, with the thumbnail on top
 * (a button that opens the full-screen viewer for images and video), the tag (a button that inserts it into the prompt; name and size in the tooltip) and the role
 * row. A role the user chose is fixed text (to change it, remove the card and add another); a file with no role gets the optional role menu in that row. A lip-sync
 * audio also gets language and accent.
 */
export function AttachmentCard({item:a,onChange,onRemove,onPreview,onMention}:{item:LocalAttachment;onChange:(patch:AttachmentPatch)=>void;onRemove:()=>void;onPreview:()=>void;onMention:()=>void}){
 // On the narrow card the no-role option reads «اتوماتیک» (the full «انتخاب اتوماتیک هووش» would be cut off beside the delete button); the menu items are unchanged otherwise.
 const media=isMediaKind(a.kind),roles=[{value:AUTO_ROLE,label:CARD_AUTO_ROLE_FA},...rolesFor(a.kind).map(r=>({value:r.id,label:r.labelFa}))];
 const lip=a.role==="lip_sync"?a.speech:undefined;
 const set=(patch:Partial<AttachmentSpeech>)=>a.speech&&onChange({speech:{...a.speech,...patch}});
 const remove={label:"حذف "+a.name,onClick:onRemove};
 return <li id={"attachment-"+a.id} className={CARD_FRAME+" border-line-primary bg-surface-subtle"}>
  <CardMedia item={a} onPreview={onPreview}/>
  <span className={CARD_META} title={a.name+" · "+faBytes(a.bytes)}>
   <TagBadge tag={a.tag} onMention={onMention}/>
   {a.durationSeconds!==undefined&&<span className="type-caption text-fg-secondary"><bdi>{faDuration(a.durationSeconds)}</bdi></span>}
  </span>
  {/* A role the user chose is fixed: the card shows it, and changing it means removing the card and adding another. A file with no role keeps the optional menu. */}
  {media&&a.role&&<CardRoleRow icon={roleIconKey(a.kind,a.role)} label={roleLabelFa(a.role,a.kind)} remove={remove}/>}
  {media&&!a.role&&<span className={CARD_FOOT}>
   <Select value={AUTO_ROLE} onValueChange={v=>onChange({role:v===AUTO_ROLE?null:v as AttachmentRole})} items={roles}>
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
export function SentAttachmentCard({item:a,onPreview,onMention}:{item:LocalAttachment;onPreview:()=>void;onMention:()=>void}){
 const media=isMediaKind(a.kind),lip=a.role==="lip_sync"?a.speech:undefined;
 const label=(list:readonly {value:string;label:string}[],v:string)=>list.find(x=>x.value===v)?.label??v;
 return <li className={CARD_FRAME+" border-line-primary bg-surface-subtle"}>
  <CardMedia item={a} onPreview={onPreview}/>
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
