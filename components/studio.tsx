"use client";
import {useEffect,useState,type FormEvent} from "react";
import Link from "next/link";
import {ThemeToggle} from "@/components/theme-toggle";
import type {AgentPreference,GenerationProposal} from "@/lib/types";
import {getLocalCharacter} from "@/lib/character-store";
import {characterCoverage,type CharacterProfile} from "@/lib/characters";
type TranscriptItem={role:"user"|"agent";text:string};
const opening="سلام! دوست داری چه تصویر یا ویدیویی بسازیم؟ می‌تونی مدل موردعلاقه‌ات رو هم توی پیام بنویسی.";
export function Studio(){
 const [messages,setMessages]=useState<TranscriptItem[]>([{role:"agent",text:opening}]);
 const [draft,setDraft]=useState("");
 const [preference,setPreference]=useState<AgentPreference>("quality");
 const [proposal,setProposal]=useState<GenerationProposal|null>(null);
 const [selected,setSelected]=useState("");
 const [busy,setBusy]=useState(false);
 const [preview,setPreview]=useState("شروع کن: ایده‌ات رو در چت بنویس.");
 const [activeTab,setActiveTab]=useState<"generations"|"cuts">("generations");
 const [error,setError]=useState("");
 const [character,setCharacter]=useState<CharacterProfile|null>(null);
 useEffect(()=>{const id=new URLSearchParams(window.location.search).get("character");if(id){void getLocalCharacter(id).then(profile=>{if(profile)setCharacter(profile);}).catch(()=>{});}},[]);
 async function send(e:FormEvent){
  e.preventDefault();const text=draft.trim();if(!text||busy)return;
  setDraft("");setError("");setBusy(true);setProposal(null);
  setMessages(m=>[...m,{role:"user",text}]);
  try{
   const r=await fetch("/api/agent",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text,preference})});
   if(!r.ok){const errorBody=await r.json().catch(()=>({}));throw new Error(typeof errorBody.message==="string"?errorBody.message:"خطا در آماده‌سازی پیشنهاد");}
   const data=await r.json() as GenerationProposal;
   setProposal(data);setSelected(data.selectedModelId);setPreview("در انتظار تأیید تولید");
   setMessages(m=>[...m,{role:"agent",text:data.message}]);
  }catch(err){setError(err instanceof Error?err.message:"خطای ناشناخته");}
  finally{setBusy(false);}
 }
 async function approve(){
  if(!proposal||busy)return;setBusy(true);setError("");
  try{
   const q=await fetch("/api/generation/quote",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({modelId:selected})});
   if(!q.ok)throw new Error("مشکل در محاسبه هزینه");
   const execution=await fetch("/api/generation/execute",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({modelId:selected})});
   const result=await execution.json();if(!execution.ok)throw new Error("خطا در اجرای آزمایشی");
   setPreview("تأیید آزمایشی ثبت شد. هیچ تصویری تولید یا نورونی کسر نشده است.");
   setMessages(m=>[...m,{role:"agent",text:result.message}]);setProposal(null);
  }catch(err){setError(err instanceof Error?err.message:"خطای ناشناخته");}
  finally{setBusy(false);}
 }
 const chosen=proposal?.suggestions.find(s=>s.modelId===selected);
 return <main className="app-shell" dir="ltr">
  <aside className="left-rail">
    <Link href="/" className="brand">✳ <strong>whoush</strong></Link>
    <button className="rail-primary" onClick={()=>{setMessages([{role:"agent",text:opening}]);setProposal(null);setPreview("شروع کن: ایده‌ات رو در چت بنویس.");setError("");}}>＋ گفت‌وگوی جدید</button>
    <div className="nav-caption">WORKSPACE</div>
    <Link href="/studio" className="nav-item selected">◈ <span>دستیار خلاق</span></Link>
    <Link href="/neurons" className="nav-item">✳ <span>خرید نورون</span></Link>
    <Link href="/characters" className="nav-item">◎ <span>استودیوی کاراکتر</span></Link>
    <div className="nav-item muted">▦ <span>پروژه‌ها · به‌زودی</span></div>
    <div className="nav-item muted">▤ <span>فایل‌ها · به‌زودی</span></div>
    <div className="rail-bottom"><span>نسخه آزمایشی</span><ThemeToggle/><span>۰ نورون</span></div>
  </aside>
  <section className="canvas-panel" dir="rtl">
   <header className="panel-header"><div className="tab-group"><button className={activeTab==="generations"?"tab active":"tab"} onClick={()=>setActiveTab("generations")}>تولیدها</button><button className={activeTab==="cuts"?"tab active":"tab"} onClick={()=>setActiveTab("cuts")}>تدوین</button></div><span className="panel-kicker">STUDIO / DEMO</span></header>
   <div className="canvas-body">
    <div className="canvas-art">
     <div className="art-symbol">✳</div>
     <p>{activeTab==="cuts"?"بخش تدوین در مرحله بعد ساخته می‌شود.":preview}</p>
     <small>خروجی تصویری واقعی هنوز فعال نیست</small>
    </div>
    <div className="job-rail"><div className="job-thumb">۱</div><span>پیش‌نمایش · آزمایشی</span></div>
   </div>
  </section>
  <section className="agent-panel" dir="rtl">
   <header className="agent-header"><div><strong>دستیار هووش</strong><p>ساخت تصویر و ویدیو با گفت‌وگو</p></div><span className="status-dot"/></header>
   {character&&<div className="selected-character"><div><strong>کاراکتر انتخاب‌شده: {character.name}</strong><small>{characterCoverage(character.references).count.toLocaleString("fa-IR")} عکس مرجع · فقط در این مرورگر</small></div><Link href="/characters">ویرایش</Link><small>اتصال به Higgsfield در مرحله بعد</small></div>}
   <div className="conversation" aria-live="polite">
    {messages.map((m,i)=><div key={i} className={"message "+m.role}>{m.text}</div>)}
    {proposal&&<div className="proposal">
      <div className="proposal-heading"><span>✳ برنامه تولید</span><span className="demo-pill">DEMO</span></div>
      <p className="proposal-summary">{proposal.operation==="generate_video"?"ویدیو":"تصویر"} · مدل پیشنهادی و گزینه‌های جایگزین</p>
      <div className="model-choices">
       {proposal.suggestions.map(s=><button key={s.modelId} className={"model-choice "+(selected===s.modelId?"active":"")} onClick={()=>setSelected(s.modelId)}><span>{s.name}<small>{s.reason}</small></span><b>{s.neurons.toLocaleString("fa-IR")} نورون</b></button>)}
      </div>
      <div className="proposal-total"><span>هزینه ثابت تولید</span><strong>{(chosen?.neurons??proposal.fixedNeurons).toLocaleString("fa-IR")} نورون</strong></div>
      <button className="approve-btn" disabled={busy} onClick={approve}>تأیید آزمایشی</button>
      <small className="proposal-notice">در این پیش‌نمایش نه پولی دریافت می‌شود و نه رسانه واقعی تولید می‌شود.</small>
    </div>}
    {error&&<div className="inline-error" role="alert">{error}</div>}
   </div>
   <form className="composer" onSubmit={send}>
    <label className="sr-only" htmlFor="whoush-prompt">توضیح تصویر یا ویدیو</label>
    <textarea id="whoush-prompt" value={draft} onChange={e=>setDraft(e.target.value)} placeholder="چی دوست داری بسازیم؟" rows={3} maxLength={4000}/>
    <div className="composer-bottom">
     <select aria-label="اولویت ساخت" value={preference} onChange={e=>setPreference(e.target.value as AgentPreference)}><option value="quality">کیفیت</option><option value="speed">سرعت</option><option value="cost">اقتصادی</option></select>
     <button type="submit" disabled={busy||!draft.trim()}>{busy?"در حال بررسی…":"ارسال ↑"}</button>
    </div>
   </form>
  </section>
 </main>;
}
