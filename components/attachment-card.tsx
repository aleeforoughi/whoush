"use client";
import {AudioLines,FileJson,FileText,Image as ImageIcon,Play,Video,X,type LucideIcon} from "lucide-react";
import {Button,Icon,Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from "@aleeforoughi/feather-react";
import {ACCENTS,AUTO_ROLE_FA,LANGUAGES,TagBadge,canPreview,type AttachmentPatch} from "@/components/attachment-chip";
import {ATTACHMENT_KINDS,TAG_WORD_FA,displayTag,isMediaKind,roleLabelFa,rolesFor,tagPrefix,type AttachmentKind,type AttachmentRole,type AttachmentSpeech,type LocalAttachment} from "@/lib/attachments";
import {faBytes,faDuration} from "@/lib/format";

const AUTO_ROLE="auto";
/**
 * The shared card geometry, so an empty upload card and the file card that replaces it are the same size: 12rem wide, a 16:9 media area on top (the upload button
 * when empty, the thumbnail when filled), a 1.75rem meta row (category and tag) and a 44px bottom row (the role name when empty, the role menu when filled).
 * In the composer row every card stretches to the tallest one, so a lip-sync card with its extra menus still lines up.
 */
export const CARD_FRAME="relative flex w-48 shrink-0 flex-col gap-2 rounded-control border p-2";
export const CARD_MEDIA="relative flex aspect-video w-full shrink-0 items-center justify-center overflow-hidden rounded-control";
export const CARD_META="flex h-7 items-center gap-2 ps-1";
export const CARD_FOOT="flex h-control w-full items-center rounded-control border border-line-secondary px-3 type-label";
/** The same category icons as the empty upload card, so a filled card reads as the same card. */
const KIND_ICONS:Record<AttachmentKind,LucideIcon>={image:ImageIcon,video:Video,audio:AudioLines,pdf:FileText,json:FileJson,md:FileText};

/**
 * A file attached to the next message, as a card inside the chat input: the same frame as the empty upload card it filled, now solid, with the thumbnail on top
 * (a button that opens the full-screen viewer for images and video), the category (and duration; name and size in the tooltip), the tag (a button that inserts it into the prompt) and, for media,
 * the role: fixed text when the user chose one (to change it, remove the card and add another), the optional role menu when the file has none; a lip-sync audio also gets language and accent. The remove button sits over the thumbnail and is a sibling of the thumbnail button.
 */
export function AttachmentCard({item:a,onChange,onRemove,onPreview,onMention}:{item:LocalAttachment;onChange:(patch:AttachmentPatch)=>void;onRemove:()=>void;onPreview:()=>void;onMention:()=>void}){
 const media=isMediaKind(a.kind),roles=[{value:AUTO_ROLE,label:AUTO_ROLE_FA},...rolesFor(a.kind).map(r=>({value:r.id,label:r.labelFa}))];
 const lip=a.role==="lip_sync"?a.speech:undefined;
 const set=(patch:Partial<AttachmentSpeech>)=>a.speech&&onChange({speech:{...a.speech,...patch}});
 const frame=CARD_MEDIA+" bg-surface-hover text-fg-secondary";
 const visual=a.kind==="image"&&a.previewUrl
  // eslint-disable-next-line @next/next/no-img-element -- a local blob: URL; next/image cannot optimize it
  ?<img src={a.previewUrl} alt="" className="size-full object-cover"/>
  :a.kind==="video"&&a.previewUrl
   ?<><video src={a.previewUrl+"#t=0.1"} preload="metadata" muted playsInline aria-hidden="true" tabIndex={-1} className="size-full object-cover"/>
    <span className="absolute inset-0 flex items-center justify-center"><span className="flex size-8 items-center justify-center rounded-control bg-background/70 text-fg-primary"><Icon icon={Play} size={16} aria-hidden="true"/></span></span></>
   :<span className="flex min-w-0 flex-col items-center gap-1 px-3 text-center"><Icon icon={KIND_ICONS[a.kind]} size={32} aria-hidden="true"/><span className="max-w-full truncate type-caption" title={a.name}><bdi>{a.name}</bdi></span></span>;
 return <li id={"attachment-"+a.id} className={CARD_FRAME+" border-line-primary bg-surface-subtle"}>
  {canPreview(a)
   ?<button type="button" onClick={onPreview} data-viewer-open={a.id} aria-label={"نمایش تمام‌صفحه "+displayTag(a.tag)} title={a.name} className={frame+" motion-hover not-disabled:hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"}>{visual}</button>
   :<span className={frame}>{visual}</span>}
  <Button type="button" variant="secondary" size="icon" onClick={onRemove} aria-label={"حذف "+a.name} className="absolute end-3 top-3">
   <Icon icon={X} aria-hidden="true"/>
  </Button>
  <span className={CARD_META}>
   <Icon icon={KIND_ICONS[a.kind]} size={16} aria-hidden="true" className="shrink-0 text-fg-secondary"/>
   <span className="min-w-0 flex-1 truncate type-caption text-fg-secondary" title={a.name+" · "+faBytes(a.bytes)}>
    {TAG_WORD_FA[tagPrefix(a.kind)]}{a.durationSeconds!==undefined&&<> · <bdi>{faDuration(a.durationSeconds)}</bdi></>}
   </span>
   <TagBadge tag={a.tag} onMention={onMention}/>
  </span>
  {/* A role the user chose is fixed: the card shows it, and changing it means removing the card and adding another. A file with no role keeps the optional menu. */}
  {media&&a.role&&<span className={CARD_FOOT+" text-fg-primary"}><span className="truncate">{roleLabelFa(a.role,a.kind)}</span></span>}
  {media&&!a.role&&<Select value={AUTO_ROLE} onValueChange={v=>onChange({role:v===AUTO_ROLE?null:v as AttachmentRole})} items={roles}>
   <SelectTrigger aria-label={"نقش "+displayTag(a.tag)} className="w-full"><SelectValue/></SelectTrigger>
   <SelectContent>{roles.map(r=><SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
  </Select>}
  {!media&&<span className={CARD_FOOT+" text-fg-primary"} title={a.name}><span className="truncate"><bdi>{a.name}</bdi> <span className="type-caption text-fg-secondary">({ATTACHMENT_KINDS[a.kind].labelFa})</span></span></span>}
  {lip&&<>
   <Select value={lip.language} onValueChange={v=>set({language:v as AttachmentSpeech["language"]})} items={LANGUAGES}>
    <SelectTrigger aria-label="زبان گفتار" className="w-full"><span className="text-fg-secondary">زبان</span><SelectValue/></SelectTrigger>
    <SelectContent>{LANGUAGES.map(l=><SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
   </Select>
   <Select value={lip.accent} onValueChange={v=>set({accent:v as AttachmentSpeech["accent"]})} items={ACCENTS}>
    <SelectTrigger aria-label="لهجه" className="w-full"><span className="text-fg-secondary">لهجه</span><SelectValue/></SelectTrigger>
    <SelectContent>{ACCENTS.map(l=><SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
   </Select>
  </>}
 </li>;
}
