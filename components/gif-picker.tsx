"use client";
import {useEffect,useRef,useState,type ReactElement} from "react";
import {Input,Popover,PopoverContent,PopoverTrigger} from "@aleeforoughi/feather-react";
import type {GifSnapshot} from "@/lib/projects";
import {POWERED_BY_GIPHY} from "@/components/chat-gif";

/** Quick searches under the field, in Persian with the English query sent to GIPHY. */
const QUICK:readonly [string,string][]=[["خنده","laugh"],["ایول","yes"],["دمت گرم","thank you"],["هیجان","excited"],["فکر","thinking"],["تشویق","applause"],["باحال","cool"],["اوه","oops"]];
export const GIFS_OFF_FA="گیف فعلاً فعال نیست.";

/**
 * The composer's GIF picker: a search field (Persian or English; quick chips for common moods) and a grid of G-rated results from the server (`/api/gifs`; the
 * GIPHY key never reaches the browser). Picking one sends it as a GIF message. Shows «Powered by GIPHY» as GIPHY requires.
 */
export function GifPicker({trigger,onPick}:{trigger:ReactElement;onPick:(gif:GifSnapshot)=>void}){
 const [open,setOpen]=useState(false),[q,setQ]=useState(""),[gifs,setGifs]=useState<GifSnapshot[]>([]),[state,setState]=useState<"idle"|"loading"|"off"|"empty">("idle");
 const seq=useRef(0);
 useEffect(()=>{
  if(!open||!q.trim())return;
  const n=++seq.current,t=window.setTimeout(async()=>{
   setState("loading");
   const r=await fetch("/api/gifs?q="+encodeURIComponent(q.trim()),{cache:"no-store"}).catch(()=>null);
   if(n!==seq.current)return;
   if(!r||r.status===404){setGifs([]);setState("off");return;}
   const body=await r.json().catch(()=>({gifs:[]})) as {gifs?:GifSnapshot[]};
   setGifs(body.gifs??[]);setState(body.gifs?.length?"idle":"empty");
  },300);
  return()=>window.clearTimeout(t);
 },[q,open]);
 return <Popover open={open} onOpenChange={o=>{setOpen(o);if(o&&!q)setQ("yes");}}>
  <PopoverTrigger render={trigger}/>
  <PopoverContent side="top" align="start" sideOffset={8} aria-label="فرستادن گیف" className="flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2 p-2!">
   <Input type="search" value={q==="yes"?"":q} onChange={e=>setQ(e.target.value)} placeholder="جستجوی گیف…" aria-label="جستجوی گیف" autoComplete="off"/>
   <div className="flex flex-wrap gap-1">{QUICK.map(([fa,en])=><button key={en} type="button" onClick={()=>setQ(en)} aria-pressed={q===en}
    className={"h-7 rounded-control border px-2 type-caption motion-hover "+(q===en?"border-primary bg-surface-selected text-fg-primary":"border-line-secondary text-fg-secondary hover:bg-surface-hover")}>{fa}</button>)}</div>
   <div className="scrollbar-right max-h-72 overflow-y-auto">
    {state==="off"?<p role="status" className="p-4 text-center type-caption text-fg-secondary">{GIFS_OFF_FA}</p>
     :state==="empty"?<p role="status" className="p-4 text-center type-caption text-fg-secondary">گیفی پیدا نشد</p>
     :<ul aria-label="گیف‌ها" aria-busy={state==="loading"} className="grid grid-cols-2 gap-1">
      {gifs.map(g=><li key={g.id}><button type="button" onClick={()=>{setOpen(false);onPick(g);}} aria-label={"فرستادن گیف "+g.title}
       className="block w-full overflow-hidden rounded-control bg-surface-subtle motion-hover hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring" style={{aspectRatio:String(g.width/g.height)}}>
       {/* eslint-disable-next-line @next/next/no-img-element -- GIPHY media must load from GIPHY's own URL */}
       <img src={g.stillUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-full object-cover"/>
      </button></li>)}
     </ul>}
   </div>
   <p className="text-end type-caption text-fg-tertiary" dir="ltr">{POWERED_BY_GIPHY}</p>
  </PopoverContent>
 </Popover>;
}
