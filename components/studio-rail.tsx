"use client";
import {useState,type ComponentType,type ReactNode} from "react";
import Link from "next/link";
import {Menu,MessageSquarePlus,Images,Sparkles,UserRound,Wand2,X,Zap} from "lucide-react";
import {Button,Icon,Sheet,SheetClose,SheetContent,SheetDescription,SheetTitle,SheetTrigger,Tooltip,TooltipContent,TooltipTrigger,buttonVariants,cn} from "@aleeforoughi/feather-react";
import {BrandMark} from "@/components/brand-mark";
import {ProjectsSection} from "@/components/projects-section";
import {ThemeToggle} from "@/components/theme-toggle";
import {LanguageToggle,useUiLang} from "@/components/ui-language";
import {fa} from "@/lib/format";

type IconType=ComponentType<{className?:string}>;
/** `always`: labels are shown (mobile menu). `responsive`: icons only on tablet, labels from 1024px up. */
export type RailLabels="always"|"responsive";
/** Which destination is the current page. */
export type RailCurrent="studio"|"assets";

function labelClass(labels:RailLabels){return labels==="always"?"":"sr-only lg:not-sr-only";}

function RailLink({href,icon,label,active,labels,onNavigate}:{href:string;icon:IconType;label:string;active?:boolean;labels:RailLabels;onNavigate?:()=>void}){
 const link=<Link href={href} aria-current={active?"page":undefined} onClick={onNavigate}
  className={cn(buttonVariants({variant:"ghost"}),"w-full justify-start",active&&"bg-surface-selected")}>
  <Icon icon={icon as never} aria-hidden="true"/><span className={labelClass(labels)}>{label}</span>
 </Link>;
 if(labels==="always")return link;
 return <Tooltip><TooltipTrigger render={link}/><TooltipContent side="inline-end" className="lg:hidden">{label}</TooltipContent></Tooltip>;
}

/** The workspace's navigation rail: brand, new chat, destinations, the recent projects, theme and balance. */
export function RailContent({labels,current,activeProjectId,onNewChat,onProjectDeleted,onNavigate}:{labels:RailLabels;current:RailCurrent;activeProjectId?:string|null;onNewChat:()=>void;onProjectDeleted?:(id:string)=>void;onNavigate?:()=>void}){
 return <div className="flex h-full min-h-0 flex-col gap-4 p-2 lg:p-4">
  {labels==="responsive"&&<>
   <BrandMark className="hidden lg:inline-flex"/>
   <Link href="/" aria-label="هووش، صفحه اصلی" className="flex min-h-control items-center justify-center rounded-control font-heading type-title text-fg-primary lg:hidden"><bdi dir="ltr">w</bdi></Link>
  </>}
  {labels==="always"&&<BrandMark/>}
  <Button onClick={()=>{onNewChat();onNavigate?.();}} className="w-full justify-start" aria-label="گفت‌وگوی جدید">
   <Icon icon={MessageSquarePlus} aria-hidden="true"/><span className={labelClass(labels)}>گفت‌وگوی جدید</span>
  </Button>
  <nav aria-label="ناوبری استودیو" className="shrink-0">
   <ul className="flex flex-col gap-1">
    <li><RailLink href="/studio" icon={Sparkles} label="استودیو" active={current==="studio"} labels={labels} onNavigate={onNavigate}/></li>
    <li><RailLink href="/assets" icon={Images} label="گالری" active={current==="assets"} labels={labels} onNavigate={onNavigate}/></li>
    <li><RailLink href="/characters" icon={UserRound} label="استودیوی کاراکتر" labels={labels} onNavigate={onNavigate}/></li>
    <li><RailLink href="/neurons" icon={Zap} label="خرید نورون" labels={labels} onNavigate={onNavigate}/></li>
   </ul>
  </nav>
  <ProjectsSection mode={labels} activeId={activeProjectId} onNavigate={onNavigate} onDeleted={onProjectDeleted}/>
  <div className="mt-auto flex flex-col gap-2">
   <Button variant="outline" className="w-full justify-start" render={<Link href="/neurons" onClick={onNavigate} aria-label={"موجودی: "+fa(0)+" نورون (نمایشی)"}/>} nativeButton={false}>
    <Icon icon={Wand2} aria-hidden="true"/><span className={labelClass(labels)}>{fa(0)} نورون</span>
   </Button>
   <LanguageToggle showLabel labelClassName={labelClass(labels)} className="w-full justify-start"/>
   <ThemeToggle showLabel labelClassName={labelClass(labels)} className="w-full justify-start"/>
  </div>
 </div>;
}

/**
 * The workspace frame shared by the studio and the assets page: a mobile top bar with a menu sheet, the rail on the start side from 768px up, and `children` (the page's
 * `<main>`) beside it. The sheet and the rail show the same projects list.
 */
export function RailShell({current,activeProjectId,onNewChat,onProjectDeleted,mobileAction,floatingMobileHeader=false,children}:{current:RailCurrent;activeProjectId?:string|null;onNewChat:()=>void;onProjectDeleted?:(id:string)=>void;
 /** Phones only: a control beside the menu button in the top bar (owner, 2026-11-08: the studio's «نمایش»). */mobileAction?:ReactNode;
 /** Phones: the top bar floats over the page as glass (the studio's chat scrolls under it). */floatingMobileHeader?:boolean;children:ReactNode}){
 const lang=useUiLang();
 const [menuOpen,setMenuOpen]=useState(false);
 const rail={current,activeProjectId,onNewChat,onProjectDeleted};
 return <div className="relative flex h-dvh flex-col overflow-hidden md:grid md:grid-cols-[4.5rem_minmax(0,1fr)] md:grid-rows-[minmax(0,1fr)] lg:grid-cols-[16rem_minmax(0,1fr)]">
  {/* Mobile: top bar with brand and menu */}
  <header className={"flex items-center justify-between px-4 py-1 md:hidden "+(floatingMobileHeader?"whoush-glass whoush-glass-top absolute inset-x-0 top-0 z-30":"border-b border-line-tertiary")}>
   <BrandMark/>
   <div className="flex items-center gap-1">
   {mobileAction}
   <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
    <SheetTrigger render={<Button variant="ghost" size="icon" aria-label="منو"/>}><Icon icon={Menu} aria-hidden="true"/></SheetTrigger>
    <SheetContent side={lang==="fi"?"left":"right"} showCloseButton={false} className="w-3/4 max-w-xs">
     <div className="flex items-center justify-between ps-4 pe-2 pt-2">
      <SheetTitle className="type-title text-fg-primary">منوی استودیو</SheetTitle>
      <SheetClose render={<Button variant="ghost" size="icon" aria-label="بستن منو"/>}><Icon icon={X} aria-hidden="true"/></SheetClose>
     </div>
     <SheetDescription className="sr-only">دسترسی به بخش‌های هووش</SheetDescription>
     <RailContent labels="always" {...rail} onNavigate={()=>setMenuOpen(false)}/>
    </SheetContent>
   </Sheet>
   </div>
  </header>
  {/* Tablet and desktop: navigation rail on the start side */}
  <header className="hidden border-e border-line-tertiary md:block">
   <RailContent labels="responsive" {...rail}/>
  </header>
  {children}
 </div>;
}
