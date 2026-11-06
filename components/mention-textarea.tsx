"use client";
import {useEffect,useId,useImperativeHandle,useLayoutEffect,useRef,useState,type ClipboardEvent,type KeyboardEvent,type ReactNode,type RefObject} from "react";
import {Badge,Card} from "@aleeforoughi/feather-react";
import {ATTACHMENT_KINDS,displayTag,insertMention,isMediaKind,isPropTag,mentionTrigger,propMatchesQuery,propMention,roleLabelFa,tagMatchesQuery,type LocalAttachment} from "@/lib/attachments";
import {editorSegments,removeBadge,type EditorSegment} from "@/lib/mention-editor";
import {enterAction,isTouchOnly} from "@/lib/composer-keys";

/** One entry of the `#` picker: a file or a generation of this chat, with a short badge («تصویر», «تولید») and an optional caption (role, intent). */
export type MentionOption={id:string;tag:string;badgeFa:string;captionFa?:string};
/** A conversation file as a picker entry: its kind, and for media its role or «انتخاب خودکار هووش». */
export const attachmentOption=(a:Pick<LocalAttachment,"id"|"tag"|"kind"|"role">):MentionOption=>({id:a.id,tag:a.tag,badgeFa:ATTACHMENT_KINDS[a.kind].labelFa,...(isMediaKind(a.kind)?{captionFa:a.role?roleLabelFa(a.role,a.kind):"انتخاب خودکار هووش"}:{})});
/** What the studio can do with the prompt: focus it, or put a tag badge at the caret (at the end when the prompt is not focused). */
export type MentionEditorHandle={focus:()=>void;insertTag:(tag:string)=>void;/** Inserts plain text (an emoji) at the caret, or at the end when the prompt is not focused. */insertText:(text:string)=>void};
const NAV_KEYS=["ArrowUp","ArrowDown","Enter","Tab","Escape"];
const ZWSP="​";
const BADGE_CLASS="mx-0.5 inline-flex h-6 items-center gap-1 rounded-control bg-secondary ps-2 pe-0.5 align-middle type-caption font-medium text-fg-primary select-none";
const REMOVE_CLASS="flex size-5 items-center justify-center rounded-control text-fg-secondary hover:bg-surface-hover hover:text-fg-primary";
const X_SVG='<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';

// ---- DOM <-> text: badges are non-editable spans carrying data-tag; their text is the canonical tag ----
function serializeNode(n:Node,root:Node):string{
 if(n.nodeType===Node.TEXT_NODE)return (n as Text).data.replaceAll(ZWSP,"");
 if(!(n instanceof HTMLElement)){let s="";n.childNodes.forEach(c=>{s+=serializeNode(c,root);});return s;}
 if(n.dataset.tag)return displayTag(n.dataset.tag);
 if(n.tagName==="BR")return n===root.lastChild?"":"\n";
 let s=(n.tagName==="DIV"||n.tagName==="P")&&n.previousSibling?"\n":"";
 n.childNodes.forEach(c=>{s+=serializeNode(c,root);});
 return s;
}
const serialize=(root:HTMLElement)=>{let s="";root.childNodes.forEach(c=>{s+=serializeNode(c,root);});return s;};
/** The caret as an offset in the serialized text, or undefined when the selection is not inside the editor. */
function caretOf(root:HTMLElement):number|undefined{
 const sel=window.getSelection();if(!sel?.rangeCount)return undefined;
 const r=sel.getRangeAt(0);if(!root.contains(r.endContainer))return undefined;
 const pre=document.createRange();pre.selectNodeContents(root);pre.setEnd(r.endContainer,r.endOffset);
 const box=document.createElement("div");box.appendChild(pre.cloneContents());
 return serialize(box).length;
}
function placeCaret(root:HTMLElement,offset:number){
 const sel=window.getSelection();if(!sel)return;
 let left=offset;
 const walk=(parent:Node):boolean=>{
  for(let i=0;i<parent.childNodes.length;i++){
   const n=parent.childNodes[i];
   if(n.nodeType===Node.TEXT_NODE){
    const data=(n as Text).data,len=data.replaceAll(ZWSP,"").length;
    if(left<=len){let raw=0,count=0;while(raw<data.length&&(count<left||data[raw]===ZWSP)){if(data[raw]!==ZWSP)count++;raw++;}sel.collapse(n,raw);return true;}
    left-=len;continue;
   }
   if(n instanceof HTMLElement&&n.dataset.tag){
    if(left<=0){sel.collapse(parent,i);return true;}
    left-=displayTag(n.dataset.tag).length;
    if(left<=0){sel.collapse(parent,i+1);return true;}
    continue;
   }
   if(n instanceof HTMLElement&&n.tagName==="BR"){if(left<=0){sel.collapse(parent,i);return true;}left-=1;continue;}
   if(walk(n))return true;
  }
  return false;
 };
 if(!walk(root))sel.collapse(root,root.childNodes.length);
}
function badgeNode(tag:string):HTMLElement{
 const shown=displayTag(tag),span=document.createElement("span");
 span.contentEditable="false";span.dataset.tag=tag;span.className=BADGE_CLASS;
 const label=document.createElement("bdi");label.textContent=shown;span.appendChild(label);
 const x=document.createElement("button");x.type="button";x.tabIndex=-1;x.dataset.badgeRemove="";x.className=REMOVE_CLASS;x.setAttribute("aria-label","حذف "+shown);x.innerHTML=X_SVG;
 span.appendChild(x);
 return span;
}
function renderSegments(root:HTMLElement,segments:readonly EditorSegment[]){
 root.replaceChildren(...segments.map(s=>"tag" in s?badgeNode(s.tag):document.createTextNode(s.text)));
 // A caret needs a text node after a trailing badge to sit in.
 if(root.lastChild instanceof HTMLElement)root.appendChild(document.createTextNode(ZWSP));
}

/**
 * The prompt field: a plain-text editable area where every `#` mention of a file or generation of this chat is a badge with a small × to dismiss it, and a `#`
 * mention picker (`@` works too), built as an ARIA combobox: focus stays in the field, the list is a listbox whose active option is announced through
 * aria-activedescendant. Typing `#` (at the start or after whitespace) opens every conversation file and generation; more characters filter by tag word (Persian or
 * English, either digit set, hyphen or not). Choosing one inserts its badge. A typed tag becomes a badge once the caret moves past it (a space); an unknown tag or an
 * ordinary hashtag (`#نوروز`) stays text. Backspace and Delete remove a badge as one unit; the × removes it with the pointer.
 * The value is plain text: a badge counts as its canonical tag (`#تصویر-۱`). The field looks like one input: the container owns the border, radius and focus ring.
 * `startAction` (the «+» menu) and `endAction` (send) are pinned to the bottom corners; the text reserves both with padding. Enter (and Ctrl/Cmd+Enter)
 * calls `onSubmitShortcut` and Shift+Enter starts a new line, but never while the mention list is open (there Enter and Tab insert a mention).
 */
export function MentionTextarea({id,value,onValueChange,options,handleRef,startAction,endAction,top,onSubmitShortcut,onPaste,placeholder,maxLength,labelledBy,describedBy,startPad="ps-14",endPad="pe-14"}:{
 id?:string;value:string;onValueChange:(v:string)=>void;options:readonly MentionOption[];handleRef:RefObject<MentionEditorHandle|null>;startAction?:ReactNode;endAction?:ReactNode;
 /** Content inside the field's border, above the text (the upload cards). */top?:ReactNode;onSubmitShortcut?:()=>void;onPaste?:(e:ClipboardEvent<HTMLDivElement>)=>void;
 placeholder?:string;maxLength?:number;labelledBy?:string;describedBy?:string;/** Inline-start padding reserved for `startAction` (wider when it holds several buttons). */startPad?:string;
 /** Inline-end padding reserved for `endAction` (wider when it holds several buttons). */endPad?:string}){
 const listId=useId(),optionId=(i:number)=>listId+"-"+i;
 const el=useRef<HTMLDivElement>(null);
 const rendered=useRef<string|null>(null);
 const composing=useRef(false);
 const [trigger,setTrigger]=useState<{start:number;query:string;prop?:string}|null>(null);
 const [active,setActive]=useState(0);
 /** The `#` or `@` position the user closed with Escape: the list stays closed until the token changes. */
 const dismissed=useRef(-1);
 const known=new Set(options.map(o=>o.tag));
 const knownKey=[...known].sort().join(",");
 const props=options.filter(o=>isPropTag(o.tag)).map(o=>o.tag);
 // After «#زن:» the list is the images to map the prop to; otherwise files, generations and the scene's props.
 const matches=!trigger?[]:trigger.prop?options.filter(o=>/^image\d/.test(o.tag)&&tagMatchesQuery(o.tag,trigger.query))
  :options.filter(o=>isPropTag(o.tag)?propMatchesQuery(o.tag,trigger.query):tagMatchesQuery(o.tag,trigger.query));
 const open=trigger!==null&&matches.length>0,current=Math.min(active,Math.max(0,matches.length-1));
 useEffect(()=>{if(open)document.getElementById(optionId(current))?.scrollIntoView({block:"nearest"});});

 /** Shows `text` with its badges and puts the caret at `caret` (only when the field has focus), then reports the canonical text. */
 function show(text:string,caret?:number){
  const root=el.current;if(!root)return text;
  const r=editorSegments(text,known,caret);
  renderSegments(root,r.segments);rendered.current=r.value;
  if(caret!==undefined&&document.activeElement===root)placeCaret(root,r.caret);
  return r.value;
 }
 // Outside changes (send clears it, the picker, a badge from «اصلاح», a project switch) are drawn; the user's own typing is already in the DOM.
 useLayoutEffect(()=>{
  const root=el.current;if(!root)return;
  if(value!==rendered.current||value!==serialize(root))show(value,document.activeElement===root?caretOf(root)??value.length:undefined);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- redraw when the text or the set of known tags changes
 },[value,knownKey]);
 function sync(){
  const root=el.current;if(!root)return;
  const caret=caretOf(root);
  const t=caret===undefined?undefined:mentionTrigger(serialize(root),caret,props);
  if(!t)dismissed.current=-1;
  if(!t||t.start===dismissed.current){setTrigger(null);return;}
  if(!trigger||trigger.start!==t.start||trigger.query!==t.query||trigger.prop!==t.prop)setActive(0);
  setTrigger(t);
 }
 function onInput(){
  const root=el.current;if(!root||composing.current)return;
  const text=serialize(root),caret=caretOf(root)??text.length;
  if(maxLength&&text.length>maxLength){show(rendered.current??value,Math.min(caret,(rendered.current??value).length));return;}
  const r=editorSegments(text,known,caret);
  const badges=r.segments.filter(s=>"tag" in s).length;
  // Redraw only when a tag just became a badge (or was rewritten); plain typing keeps the browser's own DOM and caret.
  if(r.value!==text||badges!==root.querySelectorAll("[data-tag]").length)show(text,caret);
  else rendered.current=text;
  onValueChange(r.value);
  sync();
 }
 /** Inserts the canonical tag over [start,end) and draws it as a badge, with the caret after it. */
 function insertAt(start:number,end:number,tag:string){
  const base=rendered.current??value,r=insertMention(base,start,end,tag);
  if(maxLength&&r.text.length>maxLength)return;
  el.current?.focus();
  const v=show(r.text,r.caret);
  onValueChange(v);setTrigger(null);
 }
 function pick(o:MentionOption){
  const root=el.current;if(!root||!trigger)return;
  const base=rendered.current??value,caret=caretOf(root)??base.length;
  const end=caret+(/^[\p{L}\p{N}‌ـ‐‑–−\-]*/u.exec(base.slice(caret))?.[0].length??0);
  insertAt(trigger.start,end,trigger.prop?propMention(trigger.prop,o.tag):o.tag);
 }
 useImperativeHandle(handleRef,()=>({
  focus:()=>{const root=el.current;if(!root)return;root.focus();if(caretOf(root)===undefined)placeCaret(root,(rendered.current??value).length);},
  insertText:(text:string)=>{
   const root=el.current;if(!root)return;
   const base=rendered.current??value,caret=caretOf(root)??base.length,next=base.slice(0,caret)+text+base.slice(caret);
   if(maxLength&&next.length>maxLength)return;
   root.focus();
   onValueChange(show(next,caret+text.length));
  },
  insertTag:(tag:string)=>{
   const root=el.current;if(!root)return;
   const base=rendered.current??value,caret=caretOf(root)??base.length;
   insertAt(caret,caret,tag);
  }
 }));
 /** The × on a badge: removes that badge and keeps focus in the field, with the caret where it was. */
 function removeAt(target:HTMLElement){
  const root=el.current,badge=target.closest<HTMLElement>("[data-tag]");if(!root||!badge)return;
  const index=[...root.querySelectorAll("[data-tag]")].indexOf(badge);
  const segs=editorSegments(rendered.current??value,known).segments;
  const r=removeBadge(segs,index);
  root.focus();
  const v=show(r.value,r.caret);
  onValueChange(v);
 }
 const empty=value==="";
 return <div className="relative">
  <div className={"relative rounded-control border border-line-primary bg-transparent motion-state has-[[contenteditable]:focus-visible]:outline-2 has-[[contenteditable]:focus-visible]:outline-offset-2 has-[[contenteditable]:focus-visible]:outline-ring"}>
  {startAction&&<div className="absolute bottom-1 start-1 z-10">{startAction}</div>}
  {endAction&&<div className="absolute bottom-1 end-1 z-10">{endAction}</div>}
  {top&&<div className="px-2 pt-2">{top}</div>}
  <div className="relative">
   {empty&&placeholder&&<span aria-hidden="true" className={"pointer-events-none absolute inset-y-0 start-0 truncate px-control py-control type-body text-fg-tertiary "+(startAction?startPad+" ":"")+(endAction?endPad:"")}>{placeholder}</span>}
   <div ref={el} id={id} contentEditable="plaintext-only" suppressContentEditableWarning spellCheck={false} tabIndex={0}
    role="combobox" aria-labelledby={labelledBy} aria-describedby={describedBy}
    aria-autocomplete="list" aria-haspopup="listbox" aria-controls={listId} aria-expanded={open} aria-activedescendant={open?optionId(current):undefined}
    className={"block max-h-40 min-h-13 overflow-y-auto whitespace-pre-wrap break-words px-control py-control type-body text-fg-primary outline-hidden "+(startAction?startPad+" ":"")+(endAction?endPad:"")}
    onInput={onInput}
    onCompositionStart={()=>{composing.current=true;}}
    onCompositionEnd={()=>{composing.current=false;onInput();}}
    onClick={sync}
    onKeyUp={e=>{if(!NAV_KEYS.includes(e.key))sync();}}
    onBlur={()=>setTrigger(null)}
    onPaste={onPaste}
    onMouseDown={e=>{if((e.target as HTMLElement).closest("[data-badge-remove]"))e.preventDefault();}}
    onClickCapture={e=>{const t=e.target as HTMLElement;if(t.closest("[data-badge-remove]")){e.preventDefault();e.stopPropagation();removeAt(t);}}}
    onKeyDown={(e:KeyboardEvent<HTMLDivElement>)=>{
     if(e.nativeEvent.isComposing)return;
     if(!open){
      // Enter sends, Shift+Enter starts a new line (the browser's own line break), Ctrl/Cmd+Enter sends (lib/composer-keys.ts).
      if(onSubmitShortcut&&enterAction({key:e.key,shiftKey:e.shiftKey,ctrlKey:e.ctrlKey,metaKey:e.metaKey,altKey:e.altKey,isComposing:e.nativeEvent.isComposing},isTouchOnly())==="send"){e.preventDefault();onSubmitShortcut();}
      return;
     }
     if(e.key==="ArrowDown"){e.preventDefault();setActive((current+1)%matches.length);}
     else if(e.key==="ArrowUp"){e.preventDefault();setActive((current-1+matches.length)%matches.length);}
     else if(e.key==="Enter"||(e.key==="Tab"&&!e.shiftKey)){e.preventDefault();pick(matches[current]);}
     else if(e.key==="Escape"){e.preventDefault();e.stopPropagation();dismissed.current=trigger?.start??-1;setTrigger(null);}
    }}/>
  </div>
  </div>
  <Card id={listId} role="listbox" aria-label={trigger?.prop?"تصویرهای مرجع برای "+trigger.prop:"پیوست‌ها، تولیدها و پراپ‌های صحنهٔ این گفت‌وگو"} size="sm" className={open?"absolute inset-x-0 bottom-full z-20 mb-1 max-h-56 overflow-y-auto bg-popover p-1 shadow-2":"hidden"}>
   {matches.map((o,i)=><div key={o.id} id={optionId(i)} role="option" aria-selected={i===current}
    onMouseDown={e=>{e.preventDefault();pick(o);}} onMouseMove={()=>{if(i!==current)setActive(i);}}
    className={"flex min-h-control cursor-pointer flex-wrap items-center gap-x-2 gap-y-1 rounded-control px-3 py-2 "+(i===current?"bg-surface-hover":"")}>
    <bdi className="type-label text-fg-primary">{trigger?.prop?propMention(trigger.prop,o.tag):displayTag(o.tag)}</bdi>
    <Badge variant="outline">{o.badgeFa}</Badge>
    {o.captionFa&&<span className="min-w-0 truncate type-caption text-fg-secondary">{o.captionFa}</span>}
   </div>)}
  </Card>
 </div>;
}
