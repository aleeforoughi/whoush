"use client";
import {useId,useMemo,useRef,useState,type KeyboardEvent} from "react";
import {Brush,Clapperboard,FastForward,FileText,Film,Flag,Frame,Images,Mountain,Move,Music,Package,PencilLine,Play,Plus,Scissors,Search,Shapes,Shirt,Sparkles,UserRound,Users,AudioLines,type LucideIcon} from "lucide-react";
import {Button,Icon,Input,Popover,PopoverContent,PopoverTrigger,ScrollArea} from "@aleeforoughi/feather-react";
import {filterInsertMenu,visibleInsertMenu,type InsertIconKey,type InsertItem} from "@/lib/insert-menu";

export const INSERT_ICONS:Record<InsertIconKey,LucideIcon>={auto:Sparkles,reference_image:Images,reference_video:Film,frame:Frame,character:UserRound,characters:Users,start_frame:Play,end_frame:Flag,environment:Mountain,object:Package,outfit:Shirt,hairstyle:Scissors,makeup:Brush,graphic:Shapes,edit_image:PencilLine,motion:Move,edit_video:Clapperboard,continue:FastForward,speech:AudioLines,music:Music,document:FileText};
export const SEARCH_PLACEHOLDER_FA="جستجو…";
export const NO_RESULTS_FA="گزینه‌ای پیدا نشد";

/**
 * The «+» insert menu: a popover anchored to the button, opening upwards, with a search field on top that filters as you type (`filterInsertMenu`: title, hint or
 * group label, Persian letter variants folded) and the entries grouped by kind below (`visibleInsertMenu`: «پرکاربردترین» is hidden for now, the automatic upload
 * entry sits alone at the top). Built as an ARIA combobox: focus stays in the search field, ArrowUp/ArrowDown move the active option (announced through
 * aria-activedescendant), Enter picks it, Escape closes and returns focus to «+». Each upload entry adds an upload card inside the chat input; «کاراکترهای من» opens
 * the saved-character dialog. After a pick, focus is left to that card or dialog instead of returning to «+».
 */
export function InsertMenu({disabled,onPick}:{disabled?:boolean;onPick:(item:InsertItem)=>void}){
 const [open,setOpen]=useState(false),[query,setQuery]=useState(""),[active,setActive]=useState(0),[picked,setPicked]=useState(false);
 const input=useRef<HTMLInputElement>(null),uid=useId(),listId=uid+"-list",optionId=(i:number)=>uid+"-opt-"+i;
 const sections=useMemo(()=>filterInsertMenu(visibleInsertMenu(),query),[query]);
 const flat=useMemo(()=>sections.flatMap(s=>s.items),[sections]);
 const current=Math.min(active,Math.max(0,flat.length-1));
 const choose=(item:InsertItem)=>{setPicked(true);setOpen(false);onPick(item);};
 const move=(i:number)=>{if(!flat.length)return;const n=(i+flat.length)%flat.length;setActive(n);document.getElementById(optionId(n))?.scrollIntoView({block:"nearest"});};
 const onKey=(e:KeyboardEvent<HTMLInputElement>)=>{
  if(e.key==="ArrowDown"){e.preventDefault();move(current+1);}
  else if(e.key==="ArrowUp"){e.preventDefault();move(current-1);}
  else if(e.key==="Enter"){e.preventDefault();if(flat[current])choose(flat[current]);}
 };
 let n=-1;
 return <Popover open={open} onOpenChange={o=>{setOpen(o);if(o){setPicked(false);setQuery("");setActive(0);}}}>
  <PopoverTrigger render={<Button type="button" variant="ghost" size="icon" aria-label="افزودن پیوست یا مرجع" aria-haspopup="dialog" disabled={disabled}/>}>
   <Icon icon={Plus} aria-hidden="true"/>
  </PopoverTrigger>
  <PopoverContent side="top" align="start" sideOffset={8} initialFocus={input} finalFocus={!picked} aria-label="افزودن پیوست یا مرجع" className="flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-0 overflow-hidden p-0!">
   <div className="relative border-b border-line-tertiary p-2">
    <Icon icon={Search} aria-hidden="true" className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-fg-secondary"/>
    <Input ref={input} type="search" value={query} onChange={e=>{setQuery(e.target.value);setActive(0);}} onKeyDown={onKey} placeholder={SEARCH_PLACEHOLDER_FA}
     role="combobox" aria-label="جستجوی گزینه‌ها" aria-expanded="true" aria-controls={listId} aria-autocomplete="list" aria-activedescendant={flat.length?optionId(current):undefined}
     autoComplete="off" spellCheck={false} className="ps-9"/>
   </div>
   <ScrollArea className="[&>[data-slot=scroll-area-viewport]]:max-h-[min(55dvh,var(--available-height))]">
    <div id={listId} role="listbox" aria-label="گزینه‌ها" className="p-1">
     {sections.map(s=>{
      const head=uid+"-g-"+s.id;
      const opts=s.items.map(i=>{n++;const idx=n,on=idx===current;
       return <div key={i.id} id={optionId(idx)} role="option" aria-selected={on} onClick={()=>choose(i)} onMouseMove={()=>{if(active!==idx)setActive(idx);}}
        className={"flex min-h-control cursor-pointer items-start gap-2 rounded-control px-3 py-2 "+(on?"bg-surface-hover":"")}>
        <Icon icon={INSERT_ICONS[i.icon]} aria-hidden="true" className="mt-0.5 shrink-0"/>
        <span className="flex min-w-0 flex-1 flex-col text-start">
         <span className="type-label">{i.titleFa}</span>
         <span className="type-caption text-fg-secondary">{i.hintFa}</span>
        </span>
       </div>;});
      return s.labelFa
       ?<div key={s.id} role="group" aria-labelledby={head} className="pt-1">
        <div id={head} className="px-3 pb-1 pt-2 type-caption text-fg-secondary">{s.labelFa}</div>
        {opts}
       </div>
       :<div key={s.id} role="group" aria-label={s.items[0]?.titleFa}>{opts}</div>;
     })}
    </div>
    {!flat.length&&<p role="status" className="px-4 py-6 text-center type-caption text-fg-secondary">{NO_RESULTS_FA}</p>}
   </ScrollArea>
  </PopoverContent>
 </Popover>;
}
