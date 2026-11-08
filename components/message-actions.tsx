"use client";
import {useEffect,useRef,useState,type ReactElement,type ReactNode,type RefObject} from "react";
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

/** The focus band on a touch screen: 200px tall, centred at 60% of the screen's height, where the eye rests while reading a chat. */
export const FOCUS_BAND={heightPx:200,centre:.6};
/**
 * Whether the element is inside the focus band now (touch screens only: with hover there is no band, and this stays false). Measured on scroll (any scroll
 * area: the listener captures them all), on resize and once at start, at most once a frame. Plain geometry, so it works the same in a frame or a page.
 */
export function useInFocusBand(ref:RefObject<HTMLElement|null>):boolean{
 const [inside,setInside]=useState(false);
 useEffect(()=>{
  const el=ref.current;
  if(!el||!window.matchMedia("(hover: none)").matches)return;
  let frame=0;
  const measure=()=>{frame=0;const r=el.getBoundingClientRect(),mid=window.innerHeight*FOCUS_BAND.centre,half=FOCUS_BAND.heightPx/2;
   setInside(r.height>0&&r.bottom>=mid-half&&r.top<=mid+half);};
  const schedule=()=>{if(!frame)frame=window.requestAnimationFrame(measure);};
  schedule();
  document.addEventListener("scroll",schedule,{capture:true,passive:true});window.addEventListener("resize",schedule);
  return()=>{document.removeEventListener("scroll",schedule,{capture:true});window.removeEventListener("resize",schedule);if(frame)window.cancelAnimationFrame(frame);};
 },[ref]);
 return inside;
}
/** Whether the element is on screen (clipped by its scrolling chat too); only watched while `active`. */
function useOnScreen(ref:RefObject<HTMLElement|null>,active:boolean):boolean{
 const [on,setOn]=useState(false);
 useEffect(()=>{
  const el=ref.current;if(!active||!el||typeof IntersectionObserver==="undefined")return;
  const io=new IntersectionObserver(es=>setOn(es.some(e=>e.isIntersecting)));io.observe(el);return()=>io.disconnect();
 },[ref,active]);
 return active&&on;
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
 * or focus is inside it, so keyboard users reach it too. On touch screens, which have no hover (owner, 2026-11-07: always showing every bar is crowded and
 * repetitive), a bar fades in quickly only while its message passes through the focus band (useInFocusBand). At the very top or bottom of the chat
 * (`edge`; owner, 2026-11-08: the band cannot reach the first and last messages there) every bar on screen shows, its time included.
 */
export function MessageActions({text,at,now,onRerun,rerunDisabled,onReact,edge=false}:{text:string;at:string;now:number;onRerun?:()=>void;rerunDisabled?:boolean;
 /** Slack-style reaction: opens the reaction palette; picking toggles the user's reaction on this message. */onReact?:(emoji:ReactionEmoji)=>void;
 /** The chat is scrolled to its very top or bottom: the bar shows while it is on screen. */edge?:boolean}){
 const bar=useRef<HTMLDivElement>(null),near=useInFocusBand(bar),onScreen=useOnScreen(bar,edge);
 const [copied,setCopied]=useState(false);
 const timer=useRef(0);
 useEffect(()=>()=>window.clearTimeout(timer.current),[]);
 const copy=()=>{
  void navigator.clipboard?.writeText(text).then(()=>{
   setCopied(true);window.clearTimeout(timer.current);timer.current=window.setTimeout(()=>setCopied(false),2000);
  }).catch(()=>{ /* clipboard blocked: nothing copied, nothing claimed */ });
 };
 return <div ref={bar} data-near={near||(edge&&onScreen)} className="flex h-8 items-center gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:transition-none [@media(hover:none)]:pointer-events-none [@media(hover:none)]:data-[near=true]:pointer-events-auto [@media(hover:none)]:data-[near=true]:opacity-100">
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
