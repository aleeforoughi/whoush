import type { Metadata } from "next";
import "./globals.css";
export const metadata:Metadata={title:"Whoush | هووش",description:"استودیوی هوشمند ساخت تصویر و ویدیو"};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){
 return <html lang="fa" dir="rtl"><body>{children}</body></html>;
}
