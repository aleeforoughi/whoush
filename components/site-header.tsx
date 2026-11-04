"use client";
import {useState} from "react";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {Menu,X} from "lucide-react";
import {Button,Icon,NavigationMenu,NavigationMenuItem,NavigationMenuLink,NavigationMenuList,Sheet,SheetClose,SheetContent,SheetDescription,SheetTitle,SheetTrigger,buttonVariants,cn} from "@aleeforoughi/feather-react";
import {BrandMark} from "@/components/brand-mark";
import {ThemeToggle} from "@/components/theme-toggle";

const links=[
 {href:"/studio",label:"استودیو"},
 {href:"/characters",label:"استودیوی کاراکتر"},
 {href:"/neurons",label:"خرید نورون"}
] as const;

/** The header of the content pages (landing, neurons, characters). The studio has its own navigation rail.
 * Below md the links move into a sheet, so three Persian labels never stack beside the brand on a phone. */
export function SiteHeader(){
 const pathname=usePathname();
 const [open,setOpen]=useState(false);
 return <header className="border-b border-line-tertiary">
  <div className="feather-container flex items-center justify-between gap-4 py-2">
   <BrandMark/>
   <NavigationMenu aria-label="ناوبری اصلی" className="hidden md:flex">
    <NavigationMenuList className="gap-1">
     {links.map(l=><NavigationMenuItem key={l.href}>
      <NavigationMenuLink active={pathname===l.href} render={<Link href={l.href}/>}>{l.label}</NavigationMenuLink>
     </NavigationMenuItem>)}
    </NavigationMenuList>
   </NavigationMenu>
   <div className="flex items-center gap-1">
    <ThemeToggle/>
    <Sheet open={open} onOpenChange={setOpen}>
     <SheetTrigger render={<Button variant="ghost" size="icon" aria-label="منو" className="md:hidden"/>}><Icon icon={Menu} aria-hidden="true"/></SheetTrigger>
     <SheetContent side="right" showCloseButton={false} className="w-3/4 max-w-xs">
      <div className="flex items-center justify-between">
       <SheetTitle className="type-title text-fg-primary">منو</SheetTitle>
       <SheetClose render={<Button variant="ghost" size="icon" aria-label="بستن منو"/>}><Icon icon={X} aria-hidden="true"/></SheetClose>
      </div>
      <SheetDescription className="sr-only">دسترسی به بخش‌های هووش</SheetDescription>
      <nav aria-label="ناوبری اصلی" className="mt-4 flex flex-col gap-1">
       {links.map(l=><Link key={l.href} href={l.href} onClick={()=>setOpen(false)} aria-current={pathname===l.href?"page":undefined}
        className={cn(buttonVariants({variant:pathname===l.href?"secondary":"ghost"}),"justify-start")}>{l.label}</Link>)}
      </nav>
     </SheetContent>
    </Sheet>
   </div>
  </div>
 </header>;
}
