"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import type {PackageQuote} from "@/lib/types";
interface ApiResult{mode:"demo"|"live";packages:PackageQuote[];quotedAt:string;expiresAt:string;}
const f=(n:number)=>n.toLocaleString("fa-IR");
export function NeuronStore(){
 const [data,setData]=useState<ApiResult|null>(null);
 const [selected,setSelected]=useState("pro");
 useEffect(()=>{let active=true;fetch("/api/pricing/packages",{cache:"no-store"}).then(r=>r.json()).then(d=>{if(active)setData(d);}).catch(()=>{});return()=>{active=false;}},[]);
 const picked=data?.packages.find(p=>p.id===selected);
 return <main className="store-page" dir="rtl">
  <header className="store-header"><Link href="/" className="brand">✳ <strong>whoush</strong></Link><Link href="/studio" className="secondary-link">بازگشت به استودیو</Link></header>
  <div className="store-intro"><span className="eyebrow">WH OUSH / NEURON STORE</span><h1>خرید <em>نورون</em></h1><p>بسته بزرگ‌تر بخر، نورون هدیه بیشتری دریافت کن.</p></div>
  <div className="store-content"><section className="store-grid">
   {(data?.packages??[]).map((p,i)=><button key={p.id} className={"store-card "+(selected===p.id?"active":"")} onClick={()=>setSelected(p.id)} aria-pressed={selected===p.id}>
    <div className="store-card-header"><span>{i===5?"بیشترین هدیه":i===0?"بسته پایه":"بسته نورون"}</span><span className="selection-indicator">{selected===p.id?"●":"○"}</span></div>
    <div className="store-card-main"><strong>{f(p.totalNeurons)}</strong><small>نورون</small></div>
    <div className="store-card-price">{f(p.priceToman)} تومان</div>
    <div className="store-gift">{p.giftNeurons>0?<><b>+ {f(p.giftNeurons)} نورون هدیه</b><span>{f(p.bonusPercent)}٪ نورون بیشتر</span></>:<span>بدون هدیه</span>}</div>
   </button>)}
   {!data&&<p>در حال بارگذاری بسته‌ها…</p>}
  </section>
  <aside className="store-summary"><h2>خلاصه سفارش</h2>
   {picked?<><div className="summary-highlight"><span>مجموع نورون دریافتی</span><strong>{f(picked.totalNeurons)}</strong><small>نورون</small></div>
   <div className="store-row"><span>نورون اصلی</span><strong>{f(picked.baseNeurons)}</strong></div>
   <div className="store-row gift"><span>نورون هدیه</span><strong>+ {f(picked.giftNeurons)}</strong></div>
   <div className="store-row total"><span>مبلغ</span><strong>{f(picked.priceToman)} تومان</strong></div>
   <button className="checkout-disabled" disabled>پرداخت به‌زودی فعال می‌شود</button>
   <p>نورون هدیه در مجموع نورون‌های دریافتی محاسبه شده است.</p>
   </>:<p>دریافت اطلاعات بسته‌ها ممکن نشد.</p>}
   <small className="demo-disclosure">اعداد نمایشی هستند و با نرخ واقعی متصل نشده‌اند. هیچ پرداختی انجام نمی‌شود.</small>
  </aside></div>
 </main>;
}
