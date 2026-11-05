"use client";
import {useEffect,useState} from "react";

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

/** «هووش داره کار می‌کنه»: three bouncing dots and the real stage the turn is in, shown from the moment a message is sent. */
export function ThinkingRow({text}:{text:string}){
 return <div role="status" aria-live="polite" className="flex items-center gap-2 type-body-sm text-fg-secondary">
  <span aria-hidden="true" className="flex items-center gap-1">
   {[0,1,2].map(i=><span key={i} className="size-1.5 animate-bounce rounded-full bg-current motion-reduce:animate-none" style={{animationDelay:i*120+"ms"}}/>)}
  </span>
  <span>{text}</span>
 </div>;
}
