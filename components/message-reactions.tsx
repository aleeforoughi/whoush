"use client";
import {groupReactions,type Reaction} from "@/lib/projects";
import type {ReactionEmoji} from "@/lib/creative-plan";

/**
 * Slack-style reactions under a message: one chip per emoji with who reacted («تو», «هووش» or both). The chip with your reaction is highlighted and toggles it off;
 * a chip with only Whoush's reaction adds yours.
 */
export function MessageReactions({reactions,onToggle}:{reactions?:readonly Reaction[];onToggle:(emoji:ReactionEmoji)=>void}){
 const groups=groupReactions(reactions);
 if(!groups.length)return null;
 return <ul aria-label="واکنش‌ها" className="flex flex-wrap gap-1">
  {groups.map(g=>{
   const who=[g.user?"تو":"",g.whoush?"هووش":""].filter(Boolean).join(" و ");
   return <li key={g.emoji}>
    <button type="button" onClick={()=>onToggle(g.emoji)} aria-pressed={g.user} aria-label={g.emoji+" از "+who} title={who}
     className={"flex h-7 items-center gap-1 rounded-control border px-2 type-caption motion-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring "+(g.user?"border-primary bg-surface-selected text-fg-primary":"border-line-secondary bg-surface-subtle text-fg-secondary hover:bg-surface-hover")}>
     <span className="text-base leading-none">{g.emoji}</span>{g.user&&g.whoush?<span>۲</span>:null}
    </button>
   </li>;
  })}
 </ul>;
}
