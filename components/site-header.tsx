"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {NavigationMenu,NavigationMenuItem,NavigationMenuLink,NavigationMenuList} from "@aleeforoughi/feather-react";
import {BrandMark} from "@/components/brand-mark";
import {ThemeToggle} from "@/components/theme-toggle";

const links=[
 {href:"/studio",label:"استودیو"},
 {href:"/characters",label:"استودیوی کاراکتر"},
 {href:"/neurons",label:"خرید نورون"}
] as const;

/** The header of the content pages (landing, neurons, characters). The studio has its own navigation rail. */
export function SiteHeader(){
 const pathname=usePathname();
 return <header className="border-b border-line-tertiary">
  <div className="feather-container flex flex-wrap items-center justify-between gap-x-4 py-2">
   <BrandMark/>
   <NavigationMenu aria-label="ناوبری اصلی" className="order-last w-full max-w-none md:order-none md:w-auto">
    <NavigationMenuList className="flex-wrap justify-start gap-1">
     {links.map(l=><NavigationMenuItem key={l.href}>
      <NavigationMenuLink active={pathname===l.href} render={<Link href={l.href}/>}>{l.label}</NavigationMenuLink>
     </NavigationMenuItem>)}
    </NavigationMenuList>
   </NavigationMenu>
   <ThemeToggle/>
  </div>
 </header>;
}
