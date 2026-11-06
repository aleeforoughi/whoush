"use client";
import {useEffect,useRef,useState} from "react";
import {Clapperboard,Image as ImageIcon,LoaderCircle} from "lucide-react";
import {Icon} from "@aleeforoughi/feather-react";
import {GenerationPreview} from "@/components/generation-preview";
import type {JobView} from "@/lib/studio-types";
import {displayTag} from "@/lib/attachments";
import {isActiveJob,isOwnedOutputUrl} from "@/lib/job-progress";

export type GalleryItem={id:string;job:JobView;kind?:"image"|"video";model?:string};
/** A request to bring one generation into view; `n` changes on every request so the same item can be asked for twice. */
export type GalleryFocus={id:string;n:number};
let focusSeq=0;
/** A new focus request for one generation. */
export const galleryFocusOn=(id:string):GalleryFocus=>({id,n:++focusSeq});
/** A jump's smooth scroll is over once the list has not moved for this long; until then its in-between items do not take the highlight. */
const SCROLL_IDLE_MS=160;

/** Smooth scrolling unless the user asked for reduced motion. */
const behavior=():ScrollBehavior=>typeof window!=="undefined"&&window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth";
/** Scrolls one container (never its ancestors) so `el` sits at its top (`start`) or just inside it (`nearest`). */
const scrollWithin=(box:HTMLElement|null,el:HTMLElement|undefined,align:"start"|"nearest")=>{
 if(!box||!el)return;
 const b=box.getBoundingClientRect(),r=el.getBoundingClientRect(),now=box.scrollTop;
 const top=align==="start"?now+r.top-b.top:r.top<b.top?now+r.top-b.top-4:r.bottom>b.bottom?now+r.bottom-b.bottom+4:now;
 if(Math.abs(top-now)>1)box.scrollTo({top,behavior:behavior()});
};

/**
 * The preview panel's «تولیدها»: every generation of this chat, oldest first, in one vertical scroll, each at its own ratio, with a vertical strip of
 * thumbnails beside it. Picking a thumbnail (or a chat preview card, through `focus`) scrolls the list to that generation; scrolling the list highlights its
 * thumbnail and keeps it in view in the strip.
 */
export function GenerationGallery({items,focus,placeholder}:{items:GalleryItem[];focus:GalleryFocus|null;placeholder:string}){
 const list=useRef<HTMLDivElement>(null),strip=useRef<HTMLDivElement>(null);
 const cards=useRef(new Map<string,HTMLElement>()),thumbs=useRef(new Map<string,HTMLElement>());
 const [current,setCurrent]=useState<string|null>(focus?.id??items.at(-1)?.id??null),jumping=useRef(false),lastScroll=useRef(0),order=useRef<string[]>([]);
 useEffect(()=>{order.current=items.map(it=>it.id);},[items]);

 /** Scrolls the list to one generation and its thumbnail into view. */
 const jump=(id:string)=>{
  setCurrent(id);jumping.current=true;
  // Already in place, the jump scrolls nothing: release the hold if no scroll starts soon.
  const at=performance.now();window.setTimeout(()=>{if(lastScroll.current<at)jumping.current=false;},SCROLL_IDLE_MS*2);
  scrollWithin(list.current,cards.current.get(id),"start");
  scrollWithin(strip.current,thumbs.current.get(id),"nearest");
 };
 // A focus request from outside (a chat preview card, a new generation, an opened project): once the item is rendered.
 useEffect(()=>{
  if(!focus)return;
  const t=window.setTimeout(()=>jump(focus.id),0);
  return()=>window.clearTimeout(t);
 },[focus]);

 // Scrolling the list: the current generation is the first one with at least 40% of itself (or of the view, for a tall one) inside the list's visible
 // area, so when several fit the top one wins. Its thumbnail is highlighted and kept in view. A jump holds the highlight until the scroll comes to rest.
 useEffect(()=>{
  const root=list.current;if(!root)return;
  let frame=0,idle=0;
  const pick=()=>{
   const box=root.getBoundingClientRect();
   for(const id of order.current){
    const r=cards.current.get(id)?.getBoundingClientRect();if(!r)continue;
    const seen=Math.min(r.bottom,box.bottom)-Math.max(r.top,box.top);
    if(seen>=0.4*Math.min(r.height,box.height))return id;
   }
   return undefined;
  };
  const check=()=>{
   frame=0;if(jumping.current)return;
   const best=pick();
   if(best){setCurrent(c=>c===best?c:best);scrollWithin(strip.current,thumbs.current.get(best),"nearest");}
  };
  const onScroll=()=>{
   lastScroll.current=performance.now();window.clearTimeout(idle);idle=window.setTimeout(()=>{jumping.current=false;},SCROLL_IDLE_MS);
   if(!frame)frame=window.setTimeout(check,60);
  };
  root.addEventListener("scroll",onScroll,{passive:true});
  return()=>{root.removeEventListener("scroll",onScroll);window.clearTimeout(frame);window.clearTimeout(idle);};
 },[]);

 const register=(which:"cards"|"thumbs",id:string)=>(el:HTMLElement|null)=>{const map=(which==="cards"?cards:thumbs).current;if(el)map.set(id,el);else map.delete(id);};
 return <div className="flex min-h-0 flex-1 gap-3 p-4 lg:p-6">
  {items.length>1&&<nav aria-label="تولیدهای این گفت‌وگو" className="flex w-16 shrink-0 flex-col">
   <div ref={strip} className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain pb-2 [scrollbar-width:thin]">
    {items.map(it=>{
     const out=it.job.outputs?.find(o=>isOwnedOutputUrl(o.url)),on=it.id===current,tag=it.job.tag?displayTag(it.job.tag):"";
     return <button key={it.id} ref={register("thumbs",it.id)} type="button" onClick={()=>jump(it.id)} aria-current={on||undefined}
      aria-label={"نمایش "+(tag||"تولید")}
      className={"flex shrink-0 flex-col items-center gap-1 rounded-control p-1 motion-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring "+(on?"bg-surface-hover ring-2 ring-primary":"hover:bg-surface-hover")}>
      <span className="flex w-full items-center justify-center overflow-hidden rounded-control bg-surface-subtle text-fg-secondary">
       {out?.kind==="image"
        // eslint-disable-next-line @next/next/no-img-element -- a Whoush-owned output thumbnail
        ?<img src={out.url} alt="" loading="lazy" className="block h-auto max-h-20 w-full"/>
        :<span className="flex aspect-square w-full items-center justify-center">
         <Icon icon={isActiveJob(it.job.state)?LoaderCircle:it.kind==="video"||out?.kind==="video"?Clapperboard:ImageIcon} size={20} aria-hidden="true"
          className={isActiveJob(it.job.state)?"animate-spin text-primary motion-reduce:animate-none":undefined}/>
        </span>}
      </span>
      {tag&&<bdi className="max-w-full truncate type-caption text-fg-secondary">{tag}</bdi>}
     </button>;
    })}
   </div>
  </nav>}
  <div ref={list} className="flex min-h-0 min-w-0 flex-1 snap-y snap-proximity flex-col gap-8 overflow-y-auto overscroll-contain pb-[30vh] [scrollbar-width:thin]">
   {items.map(it=><section key={it.id} ref={register("cards",it.id)} data-gallery-id={it.id} aria-label={it.job.tag?displayTag(it.job.tag):"تولید"}
    className="flex shrink-0 scroll-mt-1 snap-start flex-col gap-2">
    {(it.job.tag||it.model)&&<p className="flex items-center gap-2 type-label text-fg-secondary">
     {it.job.tag&&<bdi className="text-fg-primary">{displayTag(it.job.tag)}</bdi>}{it.model&&<span>· {it.model}</span>}
    </p>}
    <GenerationPreview job={it.job} kind={it.kind} model={it.model} placeholder={placeholder}/>
   </section>)}
  </div>
 </div>;
}
