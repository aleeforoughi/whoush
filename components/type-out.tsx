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


/**
 * The turn's progress, conversational and expandable: collapsed, the current step with the typing dots; opened, the steps already done (ticked), the
 * current one, and why Whoush plans first.
 */
export function TurnProgress({current,done,doneText,why}:{current:string;done:string[];doneText:string[];why:string}){
 const [open,setOpen]=useState(false);
 return <div role="status" aria-live="polite" className="flex flex-col gap-1.5 type-body-sm text-fg-secondary">
  <button type="button" onClick={()=>setOpen(o=>!o)} aria-expanded={open} className="flex items-center gap-2 self-start rounded-control text-start motion-hover hover:text-fg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
   <span aria-hidden="true" className="flex items-center gap-1">
    {[0,1,2].map(i=><span key={i} className="size-1.5 animate-bounce rounded-full bg-current motion-reduce:animate-none" style={{animationDelay:i*120+"ms"}}/>)}
   </span>
   <span>{current}</span>
   {done.length>0&&<Icon icon={ChevronDown} size={16} aria-hidden="true" className={"size-4 motion-state "+(open?"rotate-180":"")}/>}
  </button>
  {open&&done.length>0&&<ul className="flex flex-col gap-1 ps-6">
   {doneText.map(t=><li key={t} className="flex items-center gap-1.5 type-caption text-fg-secondary"><Icon icon={Check} size={16} aria-hidden="true" className="size-3.5 text-primary"/>{t}</li>)}
   <li className="type-caption text-fg-secondary">{why}</li>
  </ul>}
 </div>;
}

