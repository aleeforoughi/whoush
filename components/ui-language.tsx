"use client";
import {createContext,useContext,useEffect,type ReactNode} from "react";
import {Button} from "@aleeforoughi/feather-react";
import {UI_LANG_COOKIE,type UiLang} from "@/lib/ui-lang";
import {toFinglish} from "@/lib/i18n/translate";
import {finglishTags,setTagScript} from "@/lib/attachments";

/** The language the server rendered this page in (app/layout.tsx, from the cookie): the same on the server and in the browser. */
const LangContext=createContext<UiLang>("fa");
export const useUiLang=()=>useContext(LangContext);
export function UiLangProvider({lang,children}:{lang:UiLang;children:ReactNode}){
 // Tags drawn by the app itself (the chat box, menus) in the page's script, «#tasvir-1» in Finglish; the server keeps Persian (it renders no tags).
 if(typeof window!=="undefined")setTagScript(lang);
 return <LangContext.Provider value={lang}>{children}<PageTranslator/></LangContext.Provider>;
}

/**
 * The language switch in the top bar (owner, 2026-11-08): «فا» ⇄ «Fin». The cookie is read by the server, which renders the page in that direction
 * from the first paint; the page reloads so everything (direction, menus, the studio) starts again in the new language.
 */
export function LanguageToggle({showLabel=false,labelClassName="",className}:{showLabel?:boolean;labelClassName?:string;className?:string}){
 const lang=useUiLang();
 const set=(l:UiLang)=>{document.cookie=UI_LANG_COOKIE+"="+l+";path=/;max-age=31536000;samesite=lax";window.location.reload();};
 return <Button type="button" variant="ghost" size={showLabel?"default":"icon"} className={className} aria-label={lang==="fi"?"Zaban: Farsi ya Finglish":"زبان: فارسی یا فینگلیش"}
  onClick={()=>set(lang==="fi"?"fa":"fi")} data-no-translate="">
  <span aria-hidden="true" className="type-label" lang={lang==="fi"?"fa":"en"}>{lang==="fi"?"فا":"Fin"}</span>
  {showLabel&&<span className={labelClassName}>{lang==="fi"?"Farsi":"Finglish"}</span>}
 </Button>;
}

const ATTRS=["aria-label","title","placeholder","alt","aria-description"] as const;
/** Inside these the text is the user's own (typed, pasted or sent) or is not shown: never translated. */
const SKIP="textarea,input,[contenteditable],script,style,code,pre,[data-no-translate]";
/** Never touched at all: what the user is typing. A sent message's own words stay, but its tags are shown in Finglish. */
const EDITING="textarea,input,[contenteditable],script,style,code,pre";
function translateNode(root:Node){
 if(root.nodeType===Node.TEXT_NODE){
  const t=root as Text,p=t.parentElement;if(!p||p.closest(EDITING))return;
  const v=t.nodeValue??"",next=finglishTags(p.closest("[data-no-translate]")?v:toFinglish(v,Boolean(p.closest("[data-translate-exact]"))));if(next!==v)t.nodeValue=next;return;
 }
 if(root.nodeType!==Node.ELEMENT_NODE)return;
 const el=root as Element;if(el.closest(EDITING))return;
 // Labels are translated outside the user's own words; text everywhere goes through translateNode (a sent message keeps its words, gets Finglish tags).
 const labels=(e:Element)=>{if(e.closest(SKIP))return;for(const a of ATTRS){const v=e.getAttribute(a);if(v){const next=finglishTags(toFinglish(v));if(next!==v)e.setAttribute(a,next);}}};
 labels(el);
 const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT);
 for(let n=walker.nextNode();n;n=walker.nextNode()){
  if(n.nodeType===Node.ELEMENT_NODE)labels(n as Element);
  else translateNode(n);
 }
}
/**
 * Finglish mode only: translates the page as React renders it (text and the labels screen readers read), and keeps doing so as it changes. React keeps
 * its own text values, so a changed text is written again in Persian and translated again; nothing is restructured, so React's updates stay correct.
 * The page is shown once the first pass is done (app/globals.css), so the Persian never flashes.
 */
function PageTranslator(){
 const lang=useUiLang();
 useEffect(()=>{
  if(lang!=="fi")return;
  const body=document.body;
  try{translateNode(body);document.title=toFinglish(document.title);}finally{body.setAttribute("data-translated","");}
  const mo=new MutationObserver(list=>{
   mo.disconnect();
   try{for(const m of list){
    if(m.type==="characterData")translateNode(m.target);
    else if(m.type==="attributes"&&m.attributeName){const e=m.target as Element,v=e.getAttribute(m.attributeName);if(v&&!e.closest(SKIP)){const next=toFinglish(v);if(next!==v)e.setAttribute(m.attributeName,next);}}
    else m.addedNodes.forEach(translateNode);
   }}finally{mo.observe(body,OPTS);}
  });
  const OPTS:MutationObserverInit={subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:[...ATTRS]};
  mo.observe(body,OPTS);
  return()=>mo.disconnect();
 },[lang]);
 return null;
}
