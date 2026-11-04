"use client";
import {useSyncExternalStore} from "react";
import {Button,Icon} from "@aleeforoughi/feather-react";
import {Moon,Sun} from "lucide-react";

export const THEME_STORAGE_KEY="whoush-theme";
type ThemeMode="dark"|"light";

/** The DOM is the store: the `dark` class on <html> (set before paint by the inline script in app/layout.tsx). */
function subscribe(onChange:()=>void){
 const observer=new MutationObserver(onChange);
 observer.observe(document.documentElement,{attributes:true,attributeFilter:["class"]});
 return()=>observer.disconnect();
}
const getSnapshot=():ThemeMode=>document.documentElement.classList.contains("dark")?"dark":"light";
const getServerSnapshot=():ThemeMode=>"dark";

function setTheme(next:ThemeMode){
 document.documentElement.classList.toggle("dark",next==="dark");
 try{window.localStorage.setItem(THEME_STORAGE_KEY,next);}catch{/* private mode: the choice lasts for this page only */}
}

export function ThemeToggle({showLabel=false,labelClassName="",className}:{showLabel?:boolean;labelClassName?:string;className?:string}){
 const mode=useSyncExternalStore(subscribe,getSnapshot,getServerSnapshot);
 const dark=mode==="dark";
 return <Button type="button" variant="ghost" size={showLabel?"default":"icon"} className={className} aria-label="حالت تاریک" aria-pressed={dark} onClick={()=>setTheme(dark?"light":"dark")}>
  <Icon icon={dark?Moon:Sun} aria-hidden="true"/>
  {showLabel&&<span className={labelClassName}>حالت تاریک</span>}
 </Button>;
}
