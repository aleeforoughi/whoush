"use client";
import {useRef,useState,useSyncExternalStore,type KeyboardEvent} from "react";
import {Coins,Sparkles,Zap,type LucideIcon} from "lucide-react";
import {Button,Icon} from "@aleeforoughi/feather-react";
import {DEFAULT_MODE,MODES,MODE_CHANGED_HINT_FA,MODE_STORAGE_KEY,parseMode,stepMode} from "@/lib/mode";
import type {AgentPreference} from "@/lib/types";

const ICONS:Record<AgentPreference,LucideIcon>={cost:Coins,speed:Zap,quality:Sparkles};
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
 * «حالت ساخت»: a segmented radio group (اقتصادی · سریع · با کیفیت) under the prompt. One tab stop (the selected segment); arrow keys move and select, and in RTL
 * ArrowLeft goes to the segment on the left, which is the next one in reading order. `notify` says a proposal is on screen: a change then applies to the next message only.
 */
export function ModeControl({value,onChange,notify}:{value:AgentPreference;onChange:(m:AgentPreference)=>void;notify:boolean}){
 const group=useRef<HTMLDivElement>(null);
 const [hint,setHint]=useState(false);
 function choose(m:AgentPreference,focus:boolean){
  if(m!==value){onChange(m);setHint(notify);}
  if(focus)requestAnimationFrame(()=>group.current?.querySelector<HTMLElement>('[role=radio][data-mode="'+m+'"]')?.focus());
 }
 function onKey(e:KeyboardEvent){
  const rtl=group.current?getComputedStyle(group.current).direction==="rtl":true;
  const toLeft=e.key==="ArrowLeft",toRight=e.key==="ArrowRight";
  // The DOM order is the reading order: the next segment is on the left in RTL and on the right in LTR.
  const step=e.key==="ArrowDown"||(rtl?toLeft:toRight)?1:e.key==="ArrowUp"||(rtl?toRight:toLeft)?-1:0;
  if(!step)return;
  e.preventDefault();choose(stepMode(value,step),true);
 }
 return <div className="flex flex-col gap-1">
  <div ref={group} role="radiogroup" aria-label="حالت ساخت" onKeyDown={onKey} className="grid grid-cols-3 gap-1 rounded-control border border-line-secondary bg-surface-subtle p-1">
   {MODES.map(m=>{
    const on=m.preference===value;
    return <Button key={m.preference} type="button" role="radio" aria-checked={on} data-mode={m.preference} tabIndex={on?0:-1} variant={on?"default":"ghost"} onClick={()=>choose(m.preference,false)} className="min-w-0 px-2">
     <Icon icon={ICONS[m.preference]} aria-hidden="true" className="hidden sm:block"/>{m.labelFa}
    </Button>;
   })}
  </div>
  {hint&&notify&&<p role="status" className="type-caption text-fg-secondary">{MODE_CHANGED_HINT_FA}</p>}
 </div>;
}
