"use client";
import {useState,type ReactElement} from "react";
import {Popover,PopoverContent,PopoverTrigger} from "@aleeforoughi/feather-react";

/** Emojis for the composer's emoji button: faces, hands and the creative ones people use most in Persian chats. Any other emoji can be typed from the keyboard. */
export const COMPOSER_EMOJIS=["😂","🤣","😍","🥰","😎","🤩","😉","😊","🙂","😅","😭","🥹","😮","🤔","🙄","😴","👍","👌","👏","🙌","🙏","💪","✌️","🤝","❤️","💙","🔥","✨","💯","🎉","🎬","📸","🎨","🌙","☀️","🌸","☕","🍉","🚀","👀"] as const;

/**
 * A small emoji grid in a popover: the composer's emoji button (inserts at the caret) and the reaction button (toggles a reaction). The trigger is the caller's
 * button, rendered through `render`. Arrow keys move in the grid by the browser's own tab order; Escape closes and returns focus to the trigger.
 */
export function EmojiPalette({emojis,label,trigger,onPick,columns=8}:{emojis:readonly string[];label:string;trigger:ReactElement;onPick:(emoji:string)=>void;columns?:number}){
 const [open,setOpen]=useState(false);
 return <Popover open={open} onOpenChange={setOpen}>
  <PopoverTrigger render={trigger}/>
  <PopoverContent side="top" align="start" sideOffset={8} aria-label={label} className="w-auto p-2!">
   <div role="group" aria-label={label} className="grid gap-1" style={{gridTemplateColumns:"repeat("+columns+", minmax(0, 1fr))"}}>
    {emojis.map(e=><button key={e} type="button" onClick={()=>{setOpen(false);onPick(e);}} aria-label={e}
     className="flex size-9 items-center justify-center rounded-control text-xl motion-hover hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring">{e}</button>)}
   </div>
  </PopoverContent>
 </Popover>;
}
