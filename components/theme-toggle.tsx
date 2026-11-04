"use client";
import {useEffect,useState} from "react";
import {Moon,Sun} from "lucide-react";
export type ThemeMode="dark"|"light";
export function ThemeToggle(){
 const [mode,setMode]=useState<ThemeMode>("dark");
 useEffect(()=>{
  const saved=window.localStorage.getItem("whoush-theme");
  const initial:ThemeMode=saved==="light"?"light":"dark";
  document.documentElement.dataset.theme=initial;
  setMode(initial);
 },[]);
 function toggle(){
  const next:ThemeMode=mode==="dark"?"light":"dark";
  document.documentElement.dataset.theme=next;
  window.localStorage.setItem("whoush-theme",next);
  setMode(next);
 }
 return <button type="button" className="theme-toggle" onClick={toggle} aria-label={mode==="dark"?"تغییر به حالت روشن":"تغییر به حالت تاریک"} title={mode==="dark"?"حالت روشن":"حالت تاریک"} aria-pressed={mode==="light"}>
  {mode==="dark"?<Sun size={17} aria-hidden="true"/>:<Moon size={17} aria-hidden="true"/>}
  <span>{mode==="dark"?"روشن":"تاریک"}</span>
 </button>;
}
