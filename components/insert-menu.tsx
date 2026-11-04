"use client";
import {Fragment} from "react";
import {Brush,Clapperboard,FastForward,FileText,Flag,Film,Mountain,Move,Music,Package,PencilLine,Play,Plus,Scissors,Shapes,Shirt,Sparkles,UserRound,Users,AudioLines,type LucideIcon} from "lucide-react";
import {Button,DropdownMenu,DropdownMenuContent,DropdownMenuGroup,DropdownMenuItem,DropdownMenuLabel,DropdownMenuSeparator,DropdownMenuTrigger,Icon,ScrollArea} from "@aleeforoughi/feather-react";
import {INSERT_MENU,type InsertIconKey,type InsertItem} from "@/lib/insert-menu";

export const INSERT_ICONS:Record<InsertIconKey,LucideIcon>={auto:Sparkles,character:UserRound,characters:Users,start_frame:Play,end_frame:Flag,environment:Mountain,object:Package,outfit:Shirt,hairstyle:Scissors,makeup:Brush,graphic:Shapes,edit_image:PencilLine,motion:Move,edit_video:Clapperboard,continue:FastForward,speech:AudioLines,music:Music,document:FileText};

/**
 * The «+» insert menu (Notion style): «پرکاربردترین» first (upload with an automatic role and the most used roles), then a group per kind. Each upload entry adds an empty upload card
 * (title and icon) inside the chat input, which takes one file of that kind with that role; «کاراکترهای من» opens the saved-character dialog. Built from `INSERT_MENU`, so the roles here are exactly the role table.
 * It opens upwards (the composer sits at the bottom), stays inside the viewport and scrolls.
 */
export function InsertMenu({disabled,onPick}:{disabled?:boolean;onPick:(item:InsertItem)=>void}){
 return <DropdownMenu>
  <DropdownMenuTrigger render={<Button type="button" variant="ghost" size="icon" aria-label="افزودن پیوست یا مرجع" aria-haspopup="menu" disabled={disabled}/>}>
   <Icon icon={Plus} aria-hidden="true"/>
  </DropdownMenuTrigger>
  <DropdownMenuContent side="top" align="start" sideOffset={8} className="w-[min(22rem,calc(100vw-2rem))] overflow-hidden p-0">
   <ScrollArea className="[&>[data-slot=scroll-area-viewport]]:max-h-[min(60dvh,var(--available-height))]">
    <div className="p-1">
     {INSERT_MENU.map((g,gi)=><Fragment key={g.id}>
      {gi>0&&<DropdownMenuSeparator/>}
      <DropdownMenuGroup>
       <DropdownMenuLabel>{g.labelFa}</DropdownMenuLabel>
       {g.items.map(i=><DropdownMenuItem key={i.id} onClick={()=>onPick(i)} className="items-start py-2">
        <Icon icon={INSERT_ICONS[i.icon]} aria-hidden="true" className="mt-0.5"/>
        <span className="flex min-w-0 flex-1 flex-col text-start">
         <span className="type-label">{i.titleFa}</span>
         <span className="type-caption text-fg-secondary">{i.hintFa}</span>
        </span>
       </DropdownMenuItem>)}
      </DropdownMenuGroup>
     </Fragment>)}
    </div>
   </ScrollArea>
  </DropdownMenuContent>
 </DropdownMenu>;
}
