"use client";
import {useState,useSyncExternalStore} from "react";
import {ChevronDown,Coins,Gauge,Zap,type LucideIcon} from "lucide-react";
import {Button,DropdownMenu,DropdownMenuContent,DropdownMenuGroup,DropdownMenuLabel,DropdownMenuRadioGroup,DropdownMenuRadioItem,DropdownMenuTrigger,Icon,cn} from "@aleeforoughi/feather-react";
import {DEFAULT_MODE,MODES,MODE_CHANGED_HINT_FA,MODE_STORAGE_KEY,modeLabelFa,parseMode} from "@/lib/mode";
import type {AgentPreference} from "@/lib/types";

const ICONS:Record<AgentPreference,LucideIcon>={cost:Coins,speed:Zap,quality:Gauge};
/** Each mode has its own semantic color: اقتصادی success (green), سریع warning (orange), با کیفیت primary (the brand blue). Filled with the matching
 * foreground token, so the pair passes AA in both themes even where the bare color would not as text (warning on white). */
const FILL:Record<AgentPreference,string>={cost:"bg-success text-success-foreground",speed:"bg-warning text-warning-foreground",quality:"bg-primary text-primary-foreground"};
/** localStorage can throw (private windows, blocked storage); the choice then simply does not persist. Read through useSyncExternalStore so server and client markup agree. */
const listeners=new Set<()=>void>();
const subscribe=(cb:()=>void)=>{listeners.add(cb);window.addEventListener("storage",cb);return()=>{listeners.delete(cb);window.removeEventListener("storage",cb);};};
const read=()=>{try{return parseMode(window.localStorage.getItem(MODE_STORAGE_KEY));}catch{return DEFAULT_MODE;}};
const write=(m:AgentPreference)=>{try{window.localStorage.setItem(MODE_STORAGE_KEY,m);}catch{ /* not persisted */ }listeners.forEach(l=>l());};
/** The remembered build mode (default quality) and its setter. */
export function useMode():[AgentPreference,(m:AgentPreference)=>void]{
 const mode=useSyncExternalStore(subscribe,read,()=>DEFAULT_MODE);
 return [mode,write];
}

/**
 * «حالت ساخت»: shows only the selected mode as a colored pill under the prompt; clicking it opens a radio menu (اقتصادی · سریع · با کیفیت) to change it.
 * `notify` says a proposal is on screen: a change then applies to the next message only.
 */
export function ModeControl({value,onChange,notify}:{value:AgentPreference;onChange:(m:AgentPreference)=>void;notify:boolean}){
 const [hint,setHint]=useState(false);
 function choose(m:AgentPreference){if(m!==value){onChange(m);setHint(notify);}}
 return <div className="flex flex-wrap items-center gap-2">
  <DropdownMenu>
   {/* Outline secondary, like «سبک»: the only filled blue control in the composer stays the send button. The mode's color lives in the small icon disc. */}
   <DropdownMenuTrigger render={<Button type="button" variant="outline" aria-label={"حالت ساخت: "+modeLabelFa(value)+"، برای تغییر کلیک کن"} aria-haspopup="menu" className="rounded-full"/>}>
    <span aria-hidden="true" className={cn(FILL[value],"inline-flex size-6 shrink-0 items-center justify-center rounded-full")}><Icon icon={ICONS[value]} className="size-3.5"/></span>{modeLabelFa(value)}<Icon icon={ChevronDown} aria-hidden="true"/>
   </DropdownMenuTrigger>
   <DropdownMenuContent side="top" align="start" sideOffset={8} className="w-56">
    <DropdownMenuGroup>
    <DropdownMenuLabel>حالت ساخت</DropdownMenuLabel>
    <DropdownMenuRadioGroup value={value}>
     {MODES.map(m=><DropdownMenuRadioItem key={m.preference} value={m.preference} closeOnClick onClick={()=>choose(m.preference)} className="py-2">
      <span aria-hidden="true" className={cn(FILL[m.preference],"inline-flex size-6 shrink-0 items-center justify-center rounded-full")}><Icon icon={ICONS[m.preference]} className="size-3.5"/></span>
      <span className="type-label">{m.labelFa}</span>
     </DropdownMenuRadioItem>)}
    </DropdownMenuRadioGroup>
    </DropdownMenuGroup>
   </DropdownMenuContent>
  </DropdownMenu>
  {hint&&notify&&<p role="status" className="type-caption text-fg-secondary">{MODE_CHANGED_HINT_FA}</p>}
 </div>;
}
