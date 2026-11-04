"use client";
import {useEffect,useState} from "react";
import {Check,CircleAlert,Info} from "lucide-react";
import {Alert,AlertDescription,AlertTitle,Badge,Button,Card,CardContent,CardDescription,CardHeader,CardTitle,Icon,Separator,Skeleton} from "@aleeforoughi/feather-react";
import {SiteHeader} from "@/components/site-header";
import type {PackageQuote} from "@/lib/types";
import {fa} from "@/lib/format";

interface ApiResult{mode:"demo"|"live";packages:PackageQuote[];quotedAt:string;expiresAt:string;}

export function NeuronStore(){
 const [data,setData]=useState<ApiResult|null>(null);
 const [failed,setFailed]=useState(false);
 const [selected,setSelected]=useState("pro");
 useEffect(()=>{
  let active=true;
  fetch("/api/pricing/packages",{cache:"no-store"}).then(r=>{if(!r.ok)throw new Error("packages");return r.json();}).then(d=>{if(active)setData(d);}).catch(()=>{if(active)setFailed(true);});
  return()=>{active=false;};
 },[]);
 const picked=data?.packages.find(p=>p.id===selected);
 return <div className="flex min-h-dvh flex-col">
  <SiteHeader/>
  <main id="main" className="feather-container flex flex-1 flex-col gap-10 py-12">
   <div className="flex max-w-prose flex-col gap-2">
    <h1 className="type-heading-1 text-fg-primary">خرید نورون</h1>
    <p className="type-body-lg text-fg-secondary">بسته بزرگ‌تر بخر، نورون هدیه بیشتری دریافت کن.</p>
   </div>
   <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
    <section aria-label="بسته‌های نورون" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
     {data?.packages.map((p,i)=>{
      const on=selected===p.id;
      return <Card key={p.id} className={on?"border-primary bg-surface-selected":""}>
       <button type="button" aria-pressed={on} onClick={()=>setSelected(p.id)} className="flex w-full flex-col gap-4 rounded-card text-start inset-content motion-state not-aria-pressed:hover:bg-surface-hover focus-visible:-outline-offset-2">
        <span className="flex items-center justify-between gap-2">
         <span className="type-label text-fg-secondary">{i===5?"بیشترین هدیه":i===0?"بسته پایه":"بسته نورون"}</span>
         {on&&<Icon icon={Check} aria-hidden="true" className="text-primary"/>}
        </span>
        <span className="flex items-baseline gap-2"><strong className="type-heading-2 text-fg-primary">{fa(p.totalNeurons)}</strong><span className="type-body-sm text-fg-secondary">نورون</span></span>
        <span className="type-body text-fg-primary">{fa(p.priceToman)} تومان</span>
        {p.giftNeurons>0
         ?<span className="flex flex-wrap items-center gap-2"><Badge variant="secondary">+{fa(p.giftNeurons)} نورون هدیه</Badge><span className="type-caption text-fg-secondary">{fa(p.bonusPercent)}٪ نورون بیشتر</span></span>
         :<span className="type-caption text-fg-secondary">بدون هدیه</span>}
       </button>
      </Card>;
     })}
     {!data&&!failed&&[0,1,2,3,4,5].map(i=><Skeleton key={i} className="h-48 rounded-card" aria-hidden="true"/>)}
     {failed&&<Alert variant="destructive" role="alert" className="sm:col-span-2 xl:col-span-3">
      <Icon icon={CircleAlert} aria-hidden="true"/>
      <AlertTitle>بسته‌ها بارگذاری نشد</AlertTitle>
      <AlertDescription>دریافت اطلاعات بسته‌ها ممکن نشد. صفحه را دوباره باز کن.</AlertDescription>
     </Alert>}
    </section>
    <aside aria-label="خلاصه سفارش" className="lg:sticky lg:top-6">
     <Card>
      <CardHeader><CardTitle>خلاصه سفارش</CardTitle><CardDescription>نورون هدیه در مجموع نورون‌های دریافتی محاسبه شده است.</CardDescription></CardHeader>
      <CardContent className="flex flex-col gap-4">
       {picked?<>
        <dl className="flex flex-col gap-3">
         <div className="flex flex-col gap-1"><dt className="type-label text-fg-secondary">مجموع نورون دریافتی</dt><dd className="type-heading-2 text-fg-primary">{fa(picked.totalNeurons)} <span className="type-body-sm text-fg-secondary">نورون</span></dd></div>
         <Separator/>
         <div className="flex items-baseline justify-between gap-4"><dt className="type-body-sm text-fg-secondary">نورون اصلی</dt><dd className="type-label text-fg-primary">{fa(picked.baseNeurons)}</dd></div>
         <div className="flex items-baseline justify-between gap-4"><dt className="type-body-sm text-fg-secondary">نورون هدیه</dt><dd className="type-label text-fg-primary">+{fa(picked.giftNeurons)}</dd></div>
         <Separator/>
         <div className="flex items-baseline justify-between gap-4"><dt className="type-label text-fg-primary">مبلغ</dt><dd className="type-title text-fg-primary">{fa(picked.priceToman)} تومان</dd></div>
        </dl>
        <Button disabled className="w-full">پرداخت به‌زودی فعال می‌شود</Button>
       </>:<p className="type-body-sm text-fg-secondary">{failed?"دریافت اطلاعات بسته‌ها ممکن نشد.":"در حال بارگذاری…"}</p>}
       <Alert role="note">
        <Icon icon={Info} aria-hidden="true"/>
        <AlertDescription>اعداد نمایشی هستند و با نرخ واقعی متصل نشده‌اند. هیچ پرداختی انجام نمی‌شود.</AlertDescription>
       </Alert>
      </CardContent>
     </Card>
    </aside>
   </div>
  </main>
 </div>;
}
