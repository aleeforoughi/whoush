"use client";
import {useEffect,type ReactNode} from "react";
import {FeatherPortalProvider,TooltipProvider} from "@aleeforoughi/feather-react";
import {UiLangProvider} from "@/components/ui-language";
import type {UiLang} from "@/lib/ui-lang";

/**
 * Whoush wraps the app once with what Feather's FeatherProvider provides (portal container and tooltips), minus its
 * ThemeProvider: FeatherProvider 1.17.0 cannot be configured (it defaults to "system" and the "theme" key), its
 * initializer reads localStorage during render and throws on the server, and it binds a global "d" shortcut. Theme is
 * handled by components/theme-toggle.tsx and the inline script in app/layout.tsx. Gap reported to aleeforoughi/feather.
 */
/** How long a scrolled area keeps its scrollbar after the last scroll (app/globals.css shows bars only on hover or while scrolling). */
const SCROLLBAR_LINGER_MS=900;
/** Marks any element the user is scrolling with `data-scrolling` until shortly after it stops, so its minimal scrollbar shows only then. */
function useScrollActivity(){
 useEffect(()=>{
  const timers=new WeakMap<Element,number>();
  const onScroll=(e:Event)=>{
   const el=e.target instanceof Element?e.target:document.scrollingElement;if(!el)return;
   // Only when it changes: a style recalculation on every scroll event made scrolling under the glass bars lag on the iPhone.
   if(!el.hasAttribute("data-scrolling"))el.setAttribute("data-scrolling","");
   window.clearTimeout(timers.get(el));
   timers.set(el,window.setTimeout(()=>el.removeAttribute("data-scrolling"),SCROLLBAR_LINGER_MS));
  };
  document.addEventListener("scroll",onScroll,{capture:true,passive:true});
  return()=>document.removeEventListener("scroll",onScroll,{capture:true});
 },[]);
}
export function Providers({children,lang="fa"}:{children:ReactNode;lang?:UiLang}){
 useScrollActivity();
 return <UiLangProvider lang={lang}><FeatherPortalProvider container={undefined}><TooltipProvider>{children}</TooltipProvider></FeatherPortalProvider></UiLangProvider>;
}
