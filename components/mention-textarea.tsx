"use client";
import {useEffect,useId,useRef,useState,type ComponentProps,type RefObject} from "react";
import {Badge,Card,Textarea} from "@aleeforoughi/feather-react";
import {ATTACHMENT_KINDS,displayTag,insertMention,isMediaKind,mentionTrigger,roleLabelFa,tagMatchesQuery,type LocalAttachment} from "@/lib/attachments";

export type MentionOption=Pick<LocalAttachment,"id"|"tag"|"kind"|"role">;
const NAV_KEYS=["ArrowUp","ArrowDown","Enter","Tab","Escape"];

/**
 * The prompt field with a `#` mention picker (`@` works too), built as an ARIA combobox: focus stays in the textarea, the list is a listbox whose
 * active option is announced through aria-activedescendant. Typing `#` (at the start or after whitespace) opens every conversation
 * attachment; more characters filter by tag word (Persian or English, either digit set). Choosing one writes the canonical `#تصویر۱`. An ordinary
 * hashtag such as `#نوروز` is not the start of any tag word, so the list closes. ArrowUp/ArrowDown move, Enter or Tab insert, Escape closes.
 */
export function MentionTextarea({value,onValueChange,options,inputRef,...props}:Omit<ComponentProps<"textarea">,"value"|"onChange"|"ref">&{value:string;onValueChange:(v:string)=>void;options:readonly MentionOption[];inputRef:RefObject<HTMLTextAreaElement|null>}){
 const listId=useId(),optionId=(i:number)=>listId+"-"+i;
 const [trigger,setTrigger]=useState<{start:number;query:string}|null>(null);
 const [active,setActive]=useState(0);
 /** The `#` or `@` position the user closed with Escape: the list stays closed until the token changes. */
 const dismissed=useRef(-1);
 const matches=trigger?options.filter(o=>tagMatchesQuery(o.tag,trigger.query)):[];
 const open=trigger!==null&&matches.length>0,current=Math.min(active,Math.max(0,matches.length-1));
 useEffect(()=>{if(open)document.getElementById(optionId(current))?.scrollIntoView({block:"nearest"});});
 function sync(el:HTMLTextAreaElement){
  const t=mentionTrigger(el.value,el.selectionStart);
  if(!t)dismissed.current=-1;
  if(!t||t.start===dismissed.current){setTrigger(null);return;}
  if(!trigger||trigger.start!==t.start||trigger.query!==t.query)setActive(0);
  setTrigger(t);
 }
 function pick(o:MentionOption){
  const el=inputRef.current;if(!el||!trigger)return;
  const caret=el.selectionStart,end=caret+(/^[\p{L}\p{N}\u200c\u0640]*/u.exec(value.slice(caret))?.[0].length??0);
  const r=insertMention(value,trigger.start,end,o.tag);
  if(props.maxLength&&r.text.length>props.maxLength)return;
  onValueChange(r.text);setTrigger(null);
  requestAnimationFrame(()=>{el.focus();el.setSelectionRange(r.caret,r.caret);});
 }
 return <div className="relative">
  <Textarea {...props} ref={inputRef} value={value} role="combobox" aria-autocomplete="list" aria-haspopup="listbox" aria-controls={listId} aria-expanded={open} aria-activedescendant={open?optionId(current):undefined}
   onChange={e=>{onValueChange(e.target.value);sync(e.target);}}
   onClick={e=>sync(e.currentTarget)}
   onKeyUp={e=>{if(!NAV_KEYS.includes(e.key))sync(e.currentTarget);}}
   onBlur={()=>setTrigger(null)}
   onKeyDown={e=>{
    if(!open||e.nativeEvent.isComposing)return;
    if(e.key==="ArrowDown"){e.preventDefault();setActive((current+1)%matches.length);}
    else if(e.key==="ArrowUp"){e.preventDefault();setActive((current-1+matches.length)%matches.length);}
    else if(e.key==="Enter"||(e.key==="Tab"&&!e.shiftKey)){e.preventDefault();pick(matches[current]);}
    else if(e.key==="Escape"){e.preventDefault();e.stopPropagation();dismissed.current=trigger?.start??-1;setTrigger(null);}
   }}/>
  <Card id={listId} role="listbox" aria-label="پیوست‌های این گفت‌وگو" size="sm" className={open?"absolute inset-x-0 bottom-full z-20 mb-1 max-h-56 overflow-y-auto bg-popover p-1 shadow-2":"hidden"}>
   {matches.map((o,i)=><div key={o.id} id={optionId(i)} role="option" aria-selected={i===current}
    onMouseDown={e=>{e.preventDefault();pick(o);}} onMouseMove={()=>{if(i!==current)setActive(i);}}
    className={"flex min-h-control cursor-pointer flex-wrap items-center gap-x-2 gap-y-1 rounded-control px-3 py-2 "+(i===current?"bg-surface-hover":"")}>
    <bdi className="type-label text-fg-primary">{displayTag(o.tag)}</bdi>
    <Badge variant="outline">{ATTACHMENT_KINDS[o.kind].labelFa}</Badge>
    {isMediaKind(o.kind)&&<span className="type-caption text-fg-secondary">{o.role?roleLabelFa(o.role):"نقش انتخاب نشده"}</span>}
   </div>)}
  </Card>
 </div>;
}
