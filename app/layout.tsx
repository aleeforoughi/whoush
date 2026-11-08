import type {Metadata,Viewport} from "next";
import {cookies} from "next/headers";
import {Providers} from "@/components/providers";
import {UI_LANG_COOKIE,dirFor,htmlLangFor,isUiLang} from "@/lib/ui-lang";
import "./globals.css";

export const metadata:Metadata={title:"Whoush | هووش",description:"استودیوی هوشمند ساخت تصویر و ویدیو"};
export const viewport:Viewport={width:"device-width",initialScale:1};

/** Runs before first paint: dark is the default (server-rendered class), a saved "light" choice removes it. */
const themeScript=`try{if(localStorage.getItem("whoush-theme")==="light")document.documentElement.classList.remove("dark")}catch(e){}`;

/** The interface language from its cookie (lib/ui-lang.ts): Persian right to left by default, Finglish left to right. */
export default async function RootLayout({children}:Readonly<{children:React.ReactNode}>){
 const saved=(await cookies()).get(UI_LANG_COOKIE)?.value,lang=isUiLang(saved)?saved:"fa";
 return <html lang={htmlLangFor(lang)} dir={dirFor(lang)} className="dark" suppressHydrationWarning>
  <head><script dangerouslySetInnerHTML={{__html:themeScript}}/>{lang==="fi"&&<noscript><style>{"body{visibility:visible!important}"}</style></noscript>}</head>
  <body>
   <a href="#main" className="skip-link rounded-control bg-primary px-control py-control type-label text-primary-foreground">پرش به محتوای اصلی</a>
   <Providers lang={lang}>{children}</Providers>
  </body>
 </html>;
}
