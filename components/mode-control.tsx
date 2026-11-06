"use client";
import {useState,useSyncExternalStore} from "react";
import {ChevronDown,Coins,Gauge,Zap,type LucideIcon} from "lucide-react";
import {Button,DropdownMenu,DropdownMenuContent,DropdownMenuGroup,DropdownMenuLabel,DropdownMenuRadioGroup,DropdownMenuRadioItem,DropdownMenuTrigger,Icon,cn} from "@aleeforoughi/feather-react";
import {DEFAULT_MODE,MODES,MODE_CHANGED_HINT_FA,MODE_STORAGE_KEY,modeLabelFa,parseMode} from "@/lib/mode";
import type {AgentPreference} from "@/lib/types";

const ICONS:Record<AgentPreference,LucideIcon>={cost:Coins,speed:Zap,quality:Gauge};
/** Each mode has its own semantic color, used for its text, icon and border alike: اقتصادی success (green), سریع warning (orange), با کیفیت the brand primary blue (owner, 2026-11-06;
 * its label uses --whoush-primary-ink, a lighter mix of primary in dark so it passes AA as text). The light brand tokens darken success and warning so all three pass AA as text
 * on the background in both themes (brand/tokens.json). */
const TONE:Record<AgentPreference,string>={cost:"border-success text-success hover:bg-success-muted",speed:"border-warning text-warning hover:bg-warning-muted",quality:"border-primary text-(color:--whoush-primary-ink) hover:bg-primary/10"};
const INK:Record<AgentPreference,string>={cost:"text-success",speed:"text-warning",quality:"text-(color:--whoush-primary-ink)"};
/** The send button filled in the current mode's color, with a white icon in light and black in dark (Feather pairs the light green with a faint grey) (owner, 2026-11-06). */
export const SEND_TONE:Record<AgentPreference,string>={
 cost:"bg-success text-(color:--whoush-on-tone) not-disabled:hover:bg-success/90",
 speed:"bg-warning text-(color:--whoush-on-tone) not-disabled:hover:bg-warning/90",
 quality:"" // the default filled primary: با کیفیت is the brand blue (owner, 2026-11-06)
};
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
   {/* Outlined in the mode's own color (text, icon and border), never filled: the only filled control in the composer stays the send button. */}
   <DropdownMenuTrigger render={<Button type="button" variant="outline" aria-label={"حالت ساخت: "+modeLabelFa(value)+"، برای تغییر کلیک کن"} aria-haspopup="menu" className={cn(TONE[value],"bg-transparent")}/>}>
    <Icon icon={ICONS[value]} aria-hidden="true"/>{modeLabelFa(value)}<Icon icon={ChevronDown} aria-hidden="true"/>
   </DropdownMenuTrigger>
   <DropdownMenuContent side="top" align="start" sideOffset={8} className="w-56">
    <DropdownMenuGroup>
    <DropdownMenuLabel>حالت ساخت</DropdownMenuLabel>
    <DropdownMenuRadioGroup value={value}>
     {MODES.map(m=><DropdownMenuRadioItem key={m.preference} value={m.preference} closeOnClick onClick={()=>choose(m.preference)} className="py-2">
      <Icon icon={ICONS[m.preference]} aria-hidden="true" className={INK[m.preference]}/>
      <span className={cn("type-label",INK[m.preference])}>{m.labelFa}</span>
     </DropdownMenuRadioItem>)}
    </DropdownMenuRadioGroup>
    </DropdownMenuGroup>
   </DropdownMenuContent>
  </DropdownMenu>
  {hint&&notify&&<p role="status" className="type-caption text-fg-secondary">{MODE_CHANGED_HINT_FA}</p>}
 </div>;
}
