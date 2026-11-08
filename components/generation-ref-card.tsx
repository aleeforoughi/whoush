"use client";
import {Clapperboard,Image as ImageIcon} from "lucide-react";
import {Icon} from "@aleeforoughi/feather-react";
import {TagBadge} from "@/components/attachment-chip";
import {CARD_FRAME,CARD_MEDIA,CARD_META,CardRoleRow} from "@/components/attachment-card";
import {displayTag} from "@/lib/attachments";
import type {ProposalSnapshot} from "@/lib/projects";

export const CHANGE_ROLE_FA="اصلاح";

/**
 * An earlier generation the next message asks to change («اصلاح» on its card), as a card in the chat input with the same geometry as the file cards: the media
 * area shows the kind and the generation's intent, then its tag (#تولید-۱, a button that puts it in the prompt) and the role row «اصلاح» with the remove button.
 * Read-only on a sent message (no remove button).
 */
export function GenerationRefCard({snapshot,onMention,onRemove,onOpen}:{snapshot:ProposalSnapshot&{tag:string};onMention:()=>void;onRemove?:()=>void;onOpen?:()=>void}){
 const video=snapshot.plan.mediaKind==="video";
 const body=<>
  <Icon icon={video?Clapperboard:ImageIcon} size={20} aria-hidden="true" className="absolute start-2 top-2 size-4"/>
  <span className="line-clamp-3 px-3 text-center type-caption text-fg-primary">{snapshot.intentSummaryFa}</span>
 </>;
 return <li className={CARD_FRAME+" whoush-widget"}>
  {onOpen
   ?<button type="button" onClick={onOpen} aria-label={"رفتن به "+displayTag(snapshot.tag)} className={CARD_MEDIA+" bg-surface-hover text-fg-secondary motion-hover not-disabled:hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"}>{body}</button>
   :<span className={CARD_MEDIA+" bg-surface-hover text-fg-secondary"}>{body}</span>}
  <span className={CARD_META}><TagBadge tag={snapshot.tag} onMention={onMention}/></span>
  <CardRoleRow icon="edit_image" label={CHANGE_ROLE_FA} remove={onRemove&&{label:"حذف "+displayTag(snapshot.tag)+" از پیام",onClick:onRemove}}/>
 </li>;
}
