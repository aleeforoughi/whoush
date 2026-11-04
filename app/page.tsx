import Link from "next/link";
export default function Home(){
 return <main className="landing"><div className="landing-box">
 <div className="brand-mark">✳</div><p className="eyebrow">WH OUSH / CREATIVE AI STUDIO</p>
 <h1>ایده‌ات رو بگو.<br/><span>هووش می‌سازتش.</span></h1>
 <p>با گفت‌وگو تصویر و ویدیو بساز. مدل مناسب رو هووش پیشنهاد می‌ده و قبل از هر تولید، تعداد نورون‌ها رو می‌بینی.</p>
 <div className="home-actions"><Link className="primary-link" href="/studio">شروع ساختن ←</Link><Link className="secondary-link" href="/neurons">خرید نورون</Link></div>
 <p className="small muted">نسخه نمایشی توسعه. ساخت واقعی و پرداخت تا تأیید ارائه‌دهنده فعال نیست.</p>
 </div></main>;
}
