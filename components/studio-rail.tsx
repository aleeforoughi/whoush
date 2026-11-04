"use client";
import Link from "next/link";
import type {ComponentType} from "react";
import {FolderOpen,Images,MessageSquarePlus,Sparkles,UserRound,Wand2,Zap} from "lucide-react";
import {Badge,Button,Icon,Tooltip,TooltipContent,TooltipTrigger,buttonVariants,cn} from "@aleeforoughi/feather-react";
import {BrandMark} from "@/components/brand-mark";
import {ThemeToggle} from "@/components/theme-toggle";
import {fa} from "@/lib/format";

type IconType=ComponentType<{className?:string}>;
/** `always`: labels are shown (mobile menu). `responsive`: icons only on tablet, labels from 1024px up. */
export type RailLabels="always"|"responsive";

function labelClass(labels:RailLabels){return labels==="always"?"":"sr-only lg:not-sr-only";}

function RailLink({href,icon,label,active,labels,onNavigate}:{href:string;icon:IconType;label:string;active?:boolean;labels:RailLabels;onNavigate?:()=>void}){
 const link=<Link href={href} aria-current={active?"page":undefined} onClick={onNavigate}
  className={cn(buttonVariants({variant:"ghost"}),"w-full justify-start",active&&"bg-surface-selected")}>
  <Icon icon={icon as never} aria-hidden="true"/><span className={labelClass(labels)}>{label}</span>
 </Link>;
 if(labels==="always")return link;
 return <Tooltip><TooltipTrigger render={link}/><TooltipContent side="left" className="lg:hidden">{label}</TooltipContent></Tooltip>;
}

function SoonItem({icon,label,labels}:{icon:IconType;label:string;labels:RailLabels}){
 return <Button variant="ghost" disabled focusableWhenDisabled aria-disabled="true" className="w-full justify-start aria-disabled:opacity-disabled aria-disabled:hover:bg-transparent">
  <Icon icon={icon as never} aria-hidden="true"/>
  <span className={labelClass(labels)}>{label}</span>
  <Badge variant="secondary" className={cn("ms-auto",labelClass(labels))}>به‌زودی</Badge>
 </Button>;
}

/** The studio's navigation rail: brand, new chat, destinations, theme and balance. */
export function RailContent({labels,onNewChat,onNavigate}:{labels:RailLabels;onNewChat:()=>void;onNavigate?:()=>void}){
 return <div className="flex h-full min-h-0 flex-col gap-4 p-2 lg:p-4">
  {labels==="responsive"&&<>
   <BrandMark className="hidden lg:inline-flex"/>
   <Link href="/" aria-label="هووش، صفحه اصلی" className="flex min-h-control items-center justify-center rounded-control font-heading type-title text-fg-primary lg:hidden"><bdi dir="ltr">w</bdi></Link>
  </>}
  {labels==="always"&&<BrandMark/>}
  <Button onClick={()=>{onNewChat();onNavigate?.();}} className="w-full justify-start" aria-label="گفت‌وگوی جدید">
   <Icon icon={MessageSquarePlus} aria-hidden="true"/><span className={labelClass(labels)}>گفت‌وگوی جدید</span>
  </Button>
  <nav aria-label="ناوبری استودیو" className="flex-1">
   <ul className="flex flex-col gap-1">
    <li><RailLink href="/studio" icon={Sparkles} label="استودیو" active labels={labels} onNavigate={onNavigate}/></li>
    <li><RailLink href="/characters" icon={UserRound} label="استودیوی کاراکتر" labels={labels} onNavigate={onNavigate}/></li>
    <li><RailLink href="/neurons" icon={Zap} label="خرید نورون" labels={labels} onNavigate={onNavigate}/></li>
    <li><SoonItem icon={FolderOpen} label="پروژه‌ها" labels={labels}/></li>
    <li><SoonItem icon={Images} label="دارایی‌ها" labels={labels}/></li>
   </ul>
  </nav>
  <div className="flex flex-col gap-2">
   <Button variant="outline" className="w-full justify-start" render={<Link href="/neurons" onClick={onNavigate} aria-label={"موجودی: "+fa(0)+" نورون (نمایشی)"}/>} nativeButton={false}>
    <Icon icon={Wand2} aria-hidden="true"/><span className={labelClass(labels)}>{fa(0)} نورون</span>
   </Button>
   <ThemeToggle showLabel labelClassName={labelClass(labels)} className="w-full justify-start"/>
  </div>
 </div>;
}
