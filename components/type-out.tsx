"use client";
import {useEffect,useState} from "react";
import {Check,ChevronDown} from "lucide-react";
import {Icon} from "@aleeforoughi/feather-react";

/**
 * Types a new message out quickly, like a chat app: the whole text is already final (it passed every check on the server), so this is presentation only.
 * About 20 characters per frame-step, at most 1.2 s for any message; under reduced motion, or for messages from earlier, it shows at once. Screen readers get the
 * full text immediately (the typed part is aria-hidden).
 */
export function TypeOut({text,animate}:{text:string;animate:boolean}){
 const [n,setN]=useState(()=>animate&&!(typeof window!=="undefined"&&window.matchMedia("(prefers-reduced-motion: reduce)").matches)?0:text.length);
 useEffect(()=>{
  if(n>=text.length)return;
  const step=Math.max(2,Math.ceil(text.length/60)),id=window.setTimeout(()=>setN(v=>Math.min(text.length,v+step)),20);
  return()=>window.clearTimeout(id);
 },[n,text.length]);
 if(n>=text.length)return <>{text}</>;
 return <><span className="sr-only">{text}</span><span aria-hidden="true">{text.slice(0,n)}<span className="ms-0.5 inline-block h-[1em] w-0.5 animate-pulse bg-current align-middle motion-reduce:animate-none"/></span></>;
}


/** How long each live line stays before the next one types in. */
export const LIVE_LINE_MS=3400;
/**
 * The turn's progress, conversational and expandable (owner, 2026-11-07: alive and specific, never one static line). Collapsed: the current step, and when
 * the server sent lines for it (what Whoush is working out for this brief, then what it chose or found), those lines one after another, each typed in with
 * a soft shimmer. Opened: the steps already done (ticked), each with what it decided, the current one, and why Whoush plans first.
 */
export function TurnProgress({current,live,done,why}:{current:string;live:string[];done:{text:string;details:string[]}[];why:string}){
 const [open,setOpen]=useState(false);
 const [tick,setTick]=useState(0);
 // A new step starts its lines from the first one; the lines then cycle at an even pace.
 const key=current+"|"+(live[0]??"");
 const [shownKey,setShownKey]=useState(key);
 if(shownKey!==key){setShownKey(key);setTick(0);}
 useEffect(()=>{if(live.length<2)return;const id=window.setInterval(()=>setTick(t=>t+1),LIVE_LINE_MS);return()=>window.clearInterval(id);},[live.length,key]);
 const line=live.length?live[tick%live.length]:current;
 return <div role="status" aria-live="polite" className="flex flex-col gap-1.5 type-body-sm text-fg-secondary">
  <button type="button" onClick={()=>setOpen(o=>!o)} aria-expanded={open} className="flex items-center gap-2 self-start rounded-control text-start motion-hover hover:text-fg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
   <span aria-hidden="true" className="flex shrink-0 items-center gap-1">
    {[0,1,2].map(i=><span key={i} className="size-1.5 animate-bounce rounded-full bg-current motion-reduce:animate-none" style={{animationDelay:i*120+"ms"}}/>)}
   </span>
   <span key={line} className="whoush-shimmer"><TypeOut text={line} animate/></span>
   {(done.length>0||live.length>0)&&<Icon icon={ChevronDown} size={16} aria-hidden="true" className={"size-4 shrink-0 motion-state "+(open?"rotate-180":"")}/>}
  </button>
  {open&&<ul className="flex flex-col gap-1.5 ps-6">
   {done.map(d=><li key={d.text} className="flex flex-col gap-0.5 type-caption text-fg-secondary">
    <span className="flex items-center gap-1.5"><Icon icon={Check} size={16} aria-hidden="true" className="size-3.5 text-primary"/>{d.text}</span>
    {d.details.map(x=><span key={x} className="ps-5 text-fg-tertiary">{x}</span>)}
   </li>)}
   <li className="flex flex-col gap-0.5 type-caption text-fg-primary">
    <span>{current}</span>
    {live.map(x=><span key={x} className="ps-5 text-fg-tertiary">{x}</span>)}
   </li>
   <li className="type-caption text-fg-secondary">{why}</li>
  </ul>}
 </div>;
}
