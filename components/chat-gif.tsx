"use client";
import {useState} from "react";
import {Play} from "lucide-react";
import {Icon} from "@aleeforoughi/feather-react";
import type {GifSnapshot} from "@/lib/projects";

export const POWERED_BY_GIPHY="Powered by GIPHY";
const reducedMotion=()=>typeof window!=="undefined"&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * A GIF in the chat, loaded straight from GIPHY's media URL (GIPHY's terms: no caching, proxying or rewriting) with the required «Powered by GIPHY» line. Under
 * reduced motion it shows the still frame with a play button; playing is the viewer's choice. Width follows the GIF, at most 16rem.
 */
export function ChatGif({gif}:{gif:GifSnapshot}){
 // Chat messages render only in the browser, so the motion preference can be read once when the GIF appears.
 const [play,setPlay]=useState(()=>!reducedMotion());
 const ratio=gif.width/gif.height;
 return <figure className="flex w-64 max-w-full flex-col gap-1">
  <div className="relative overflow-hidden rounded-card bg-surface-subtle" style={{aspectRatio:String(ratio)}}>
   {/* eslint-disable-next-line @next/next/no-img-element -- GIPHY media must load from GIPHY's own URL */}
   <img src={play?gif.url:gif.stillUrl} alt={gif.title||"GIF"} loading="lazy" referrerPolicy="no-referrer" className="size-full object-cover"/>
   {!play&&<button type="button" onClick={()=>setPlay(true)} aria-label={"پخش گیف"+(gif.title?" "+gif.title:"")}
    className="absolute inset-0 flex items-center justify-center bg-background/30 text-fg-primary focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring">
    <span className="flex size-10 items-center justify-center rounded-control bg-background/70"><Icon icon={Play} size={20} aria-hidden="true"/></span>
   </button>}
  </div>
  <figcaption className="type-caption text-fg-tertiary" dir="ltr">{POWERED_BY_GIPHY}</figcaption>
 </figure>;
}
