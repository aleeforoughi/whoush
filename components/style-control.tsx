"use client";
import {useSyncExternalStore} from "react";
import {Box,Camera,ChevronDown,Smile,Wand,type LucideIcon} from "lucide-react";
import {Button,DropdownMenu,DropdownMenuContent,DropdownMenuGroup,DropdownMenuLabel,DropdownMenuRadioGroup,DropdownMenuRadioItem,DropdownMenuTrigger,Icon} from "@aleeforoughi/feather-react";
import {AUTO_STYLE_FA,STYLE_OPTIONS,STYLE_STORAGE_KEY,parseStyle,styleLabelFa} from "@/lib/style-setting";
import type {GenerationStyle} from "@/lib/creative-plan";

const ICONS:Record<GenerationStyle|"auto",LucideIcon>={auto:Wand,realistic:Camera,three_d:Box,cartoon:Smile};
const AUTO="auto";
/** Same storage pattern as the build mode: localStorage may throw, and the choice then simply does not persist. */
const listeners=new Set<()=>void>();
const subscribe=(cb:()=>void)=>{listeners.add(cb);window.addEventListener("storage",cb);return()=>{listeners.delete(cb);window.removeEventListener("storage",cb);};};
const read=()=>{try{return parseStyle(window.localStorage.getItem(STYLE_STORAGE_KEY));}catch{return null;}};
const write=(s:GenerationStyle|null)=>{try{if(s)window.localStorage.setItem(STYLE_STORAGE_KEY,s);else window.localStorage.removeItem(STYLE_STORAGE_KEY);}catch{ /* not persisted */ }listeners.forEach(l=>l());};
/** The remembered style (null is «اتوماتیک») and its setter. */
export function useStyleSetting():[GenerationStyle|null,(s:GenerationStyle|null)=>void]{
 const style=useSyncExternalStore(subscribe,read,()=>null);
 return [style,write];
}

/** The pill's text while no style is chosen (owner wording, 2026-11-06). */
export const AUTO_STYLE_PILL_FA="سبک اتوماتیک";
/** «سبک» beside the build mode: a neutral secondary pill showing only the current style; clicking it opens a radio menu (اتوماتیک · واقع‌گرایانه · سه‌بعدی · کارتونی). */
export function StyleControl({value,onChange}:{value:GenerationStyle|null;onChange:(s:GenerationStyle|null)=>void}){
 return <DropdownMenu>
  <DropdownMenuTrigger render={<Button type="button" variant="outline" aria-label={(value?"سبک: "+styleLabelFa(value):AUTO_STYLE_PILL_FA)+"، برای تغییر کلیک کن"} aria-haspopup="menu"/>}>
   <Icon icon={ICONS[value??AUTO]} aria-hidden="true"/>{value?styleLabelFa(value):AUTO_STYLE_PILL_FA}<Icon icon={ChevronDown} aria-hidden="true"/>
  </DropdownMenuTrigger>
  <DropdownMenuContent side="top" align="start" sideOffset={8} className="w-64">
   <DropdownMenuGroup>
    <DropdownMenuLabel>سبک</DropdownMenuLabel>
    <DropdownMenuRadioGroup value={value??AUTO}>
     {[{style:AUTO,...AUTO_STYLE_FA},...STYLE_OPTIONS].map(o=><DropdownMenuRadioItem key={o.style} value={o.style} closeOnClick onClick={()=>onChange(o.style===AUTO?null:o.style as GenerationStyle)} className="items-start py-2">
      <Icon icon={ICONS[o.style as GenerationStyle|"auto"]} aria-hidden="true" className="mt-0.5"/>
      <span className="flex min-w-0 flex-1 flex-col text-start">
       <span className="type-label">{o.titleFa}</span>
       <span className="type-caption text-fg-secondary">{o.hintFa}</span>
      </span>
     </DropdownMenuRadioItem>)}
    </DropdownMenuRadioGroup>
   </DropdownMenuGroup>
  </DropdownMenuContent>
 </DropdownMenu>;
}
