"use client";
import {useEffect,useRef,useState,type ReactElement,type ReactNode} from "react";
import {Check,Copy,RotateCcw,SmilePlus,type LucideIcon} from "lucide-react";
import {Icon,Tooltip,TooltipContent,TooltipTrigger} from "@aleeforoughi/feather-react";
import {faDateTime,faRelativeTime} from "@/lib/format";
import {EmojiPalette} from "@/components/emoji-palette";
import {REACTION_EMOJIS,type ReactionEmoji} from "@/lib/creative-plan";

export const COPY_FA="کپی",COPIED_FA="کپی شد",RERUN_FA="اجرای دوباره",REACT_FA="واکنش";

/** The current time, refreshed every `ms` (half a minute by default), so «۶ دقیقه پیش» keeps counting while the chat is open. */
export function useNow(ms=30_000){
 const [now,setNow]=useState(()=>Date.now());
 useEffect(()=>{const id=window.setInterval(()=>setNow(Date.now()),ms);return()=>window.clearInterval(id);},[ms]);
 return now;
}

/** A tooltip that opens on hover and on keyboard focus; the trigger is rendered as `render`. */
function Hint({label,render,children}:{label:string;render:ReactElement;children:ReactNode}){
 return <Tooltip><TooltipTrigger render={render}>{children}</TooltipTrigger><TooltipContent side="bottom">{label}</TooltipContent></Tooltip>;
}
/** An icon-only action: 32px to the eye, a 44px touch target (`hit-area`), its name in the tooltip and as the accessible name. */
function ActionButton({label,icon,onClick,disabled}:{label:string;icon:LucideIcon;onClick:()=>void;disabled?:boolean}){
 return <Hint label={label} render={<button type="button" onClick={onClick} disabled={disabled} aria-label={label}
  className="hit-area flex size-8 shrink-0 items-center justify-center rounded-control text-fg-secondary motion-hover not-disabled:hover:bg-surface-hover not-disabled:hover:text-fg-primary disabled:opacity-disabled focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"/>}>
  <Icon icon={icon} size={16} aria-hidden="true" className="size-4"/>
 </Hint>;
}

/**
 * The action bar under a chat message (user and agent alike): react with an emoji (Slack-style), copy the text, run it again, and when it was sent («۶ دقیقه پیش»; the full date and time on hover
 * or focus). Only icons; each one's name is its tooltip. The bar keeps its space but stays invisible until the pointer is over the message (the nearest `group`)
 * or focus is inside it, so keyboard users reach it too; on touch screens, which have no hover, it is always shown.
 */
export function MessageActions({text,at,now,onRerun,rerunDisabled,onReact}:{text:string;at:string;now:number;onRerun?:()=>void;rerunDisabled?:boolean;
 /** Slack-style reaction: opens the reaction palette; picking toggles the user's reaction on this message. */onReact?:(emoji:ReactionEmoji)=>void}){
 const [copied,setCopied]=useState(false);
 const timer=useRef(0);
 useEffect(()=>()=>window.clearTimeout(timer.current),[]);
 const copy=()=>{
  void navigator.clipboard?.writeText(text).then(()=>{
   setCopied(true);window.clearTimeout(timer.current);timer.current=window.setTimeout(()=>setCopied(false),2000);
  }).catch(()=>{ /* clipboard blocked: nothing copied, nothing claimed */ });
 };
 return <div className="flex h-8 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:transition-none [@media(hover:none)]:opacity-100">
  {onReact&&<EmojiPalette emojis={REACTION_EMOJIS} label={REACT_FA} columns={8} onPick={e=>onReact(e as ReactionEmoji)}
   trigger={<button type="button" aria-label={REACT_FA} title={REACT_FA} className="hit-area flex size-8 shrink-0 items-center justify-center rounded-control text-fg-secondary motion-hover hover:bg-surface-hover hover:text-fg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"><Icon icon={SmilePlus} size={16} aria-hidden="true" className="size-4"/></button>}/>}
  {text&&<ActionButton label={copied?COPIED_FA:COPY_FA} icon={copied?Check:Copy} onClick={copy}/>}
  {onRerun&&<ActionButton label={RERUN_FA} icon={RotateCcw} onClick={onRerun} disabled={rerunDisabled}/>}
  <Hint label={faDateTime(at)} render={<time dateTime={at} tabIndex={0} className="rounded-control px-1 type-caption text-fg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"/>}>
   {faRelativeTime(at,now)}
  </Hint>
  <span role="status" className="sr-only">{copied?COPIED_FA:""}</span>
 </div>;
}
