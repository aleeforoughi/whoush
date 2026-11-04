"use client";
import Link from "next/link";
import {ArrowLeft} from "lucide-react";
import {Badge,Button,Icon,Separator} from "@aleeforoughi/feather-react";
import {SiteHeader} from "@/components/site-header";

const steps=[
 {title:"ایده‌ات را بگو",body:"در یک گفت‌وگوی ساده توضیح بده چه تصویر یا ویدیویی می‌خواهی."},
 {title:"هووش مدل مناسب را پیشنهاد می‌دهد",body:"یک مدل پیشنهادی و چند گزینه جایگزین، همراه با دلیل انتخاب."},
 {title:"هزینه را می‌بینی و تأیید می‌کنی",body:"قیمت ثابت و به نورون، قبل از هر تولید. بدون تأیید تو چیزی ساخته یا کم نمی‌شود."}
] as const;

export function Landing(){
 return <div className="flex min-h-dvh flex-col">
  <SiteHeader/>
  <main id="main" className="feather-container flex flex-1 flex-col gap-24 py-16 md:py-24">
   <section aria-labelledby="landing-title" className="flex max-w-3xl flex-col items-start gap-6">
    <Badge variant="outline">نسخه نمایشی</Badge>
    <h1 id="landing-title" className="type-heading-1 text-fg-primary md:type-display">ایده‌ات رو بگو.<br/>هووش می‌سازتش.</h1>
    <p className="max-w-prose type-body-lg text-fg-secondary">با گفت‌وگو تصویر و ویدیو بساز. مدل مناسب رو هووش پیشنهاد می‌ده و قبل از هر تولید، تعداد نورون‌ها رو می‌بینی.</p>
    <div className="flex flex-wrap items-center gap-3">
     <Button size="lg" render={<Link href="/studio"/>} nativeButton={false}>شروع ساختن<Icon icon={ArrowLeft} aria-hidden="true"/></Button>
     <Button size="lg" variant="outline" render={<Link href="/neurons"/>} nativeButton={false}>خرید نورون</Button>
     <Button size="lg" variant="outline" render={<Link href="/characters"/>} nativeButton={false}>استودیوی کاراکتر</Button>
    </div>
    <p className="max-w-prose type-body-sm text-fg-secondary">این یک نسخه نمایشی در حال توسعه است: ساخت واقعی رسانه و پرداخت هنوز فعال نیست و هیچ مبلغی دریافت نمی‌شود.</p>
   </section>
   <section aria-labelledby="how-title" className="flex flex-col gap-8">
    <Separator/>
    <h2 id="how-title" className="type-heading-3 text-fg-primary">چطور کار می‌کند</h2>
    <ol className="grid gap-8 md:grid-cols-3">
     {steps.map((s,i)=><li key={s.title} className="flex flex-col gap-2">
      <span className="type-label text-fg-secondary" aria-hidden="true">{(i+1).toLocaleString("fa-IR")}</span>
      <h3 className="type-title text-fg-primary">{s.title}</h3>
      <p className="type-body text-fg-secondary">{s.body}</p>
     </li>)}
    </ol>
   </section>
  </main>
  <footer className="border-t border-line-tertiary">
   <p className="feather-container py-6 type-caption text-fg-secondary">هووش · نسخه آزمایشی توسعه</p>
  </footer>
 </div>;
}
