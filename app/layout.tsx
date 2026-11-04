import type {Metadata,Viewport} from "next";
import {Providers} from "@/components/providers";
import "./globals.css";

export const metadata:Metadata={title:"Whoush | هووش",description:"استودیوی هوشمند ساخت تصویر و ویدیو"};
export const viewport:Viewport={width:"device-width",initialScale:1};

/** Runs before first paint: dark is the default (server-rendered class), a saved "light" choice removes it. */
const themeScript=`try{if(localStorage.getItem("whoush-theme")==="light")document.documentElement.classList.remove("dark")}catch(e){}`;

export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){
 return <html lang="fa" dir="rtl" className="dark" suppressHydrationWarning>
  <head><script dangerouslySetInnerHTML={{__html:themeScript}}/></head>
  <body>
   <a href="#main" className="skip-link rounded-control bg-primary px-control py-control type-label text-primary-foreground">پرش به محتوای اصلی</a>
   <Providers>{children}</Providers>
  </body>
 </html>;
}
