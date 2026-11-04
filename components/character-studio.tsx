"use client";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import Link from "next/link";
import {ThemeToggle} from "@/components/theme-toggle";
import {Camera,Check,CheckCircle2,Download,ImagePlus,LockKeyhole,Plus,ShieldCheck,Trash2,UserRound,WandSparkles,ArrowLeft} from "lucide-react";
import {ALLOWED_CHARACTER_IMAGE_TYPES,MAX_CHARACTER_IMAGE_BYTES,CHARACTER_VIEWS,characterCoverage,type CharacterProfile,type CharacterView,type CharacterReferences} from "@/lib/characters";
import {deleteLocalCharacter,getLocalCharacter,listLocalCharacters,saveLocalCharacter} from "@/lib/character-store";
const fa=(n:number)=>n.toLocaleString("fa-IR");
function checkImage(file:File):Promise<void>{
 return new Promise((resolve,reject)=>{
  if(!ALLOWED_CHARACTER_IMAGE_TYPES.includes(file.type as typeof ALLOWED_CHARACTER_IMAGE_TYPES[number])||file.size>MAX_CHARACTER_IMAGE_BYTES){
   reject(new Error("فقط عکس‌های JPEG، PNG یا WebP تا ۸ مگابایت مجازند."));return;
  }
  const url=URL.createObjectURL(file);
  const img=new Image();
  img.onload=()=>{URL.revokeObjectURL(url);if(img.naturalWidth<512||img.naturalHeight<512)reject(new Error("تصویر باید حداقل ۵۱۲ پیکسل عرض و ارتفاع داشته باشد."));else resolve();};
  img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("تصویر بارگذاری‌شده قابل خواندن نیست."));};
  img.src=url;
 });
}
async function drawReference(ctx:CanvasRenderingContext2D,blob:Blob,x:number,y:number,w:number,h:number):Promise<void>{
 const url=URL.createObjectURL(blob);
 const img=new Image();
 try{
  await new Promise<void>((resolve,reject)=>{img.onload=()=>resolve();img.onerror=()=>reject(new Error("تصویر قابل نمایش نیست."));img.src=url;});
  const scale=Math.min(w/img.naturalWidth,h/img.naturalHeight);
  const iw=img.naturalWidth*scale,ih=img.naturalHeight*scale;
  ctx.drawImage(img,x+(w-iw)/2,y+(h-ih)/2,iw,ih);
 }finally{URL.revokeObjectURL(url);}
}
async function exportContactSheet(name:string,refs:CharacterReferences):Promise<void>{
 const width=1500,height=1190,margin=30,gap=18,header=115;
 const cellW=(width-2*margin-2*gap)/3,cellH=(height-header-2*margin-gap)/2;
 const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext("2d");if(!ctx)throw new Error("خروجی تصویر در این مرورگر پشتیبانی نمی‌شود.");
 ctx.fillStyle="#0d0d12";ctx.fillRect(0,0,width,height);
 ctx.textAlign="right";ctx.fillStyle="#fff";ctx.font="700 36px Tahoma, sans-serif";ctx.fillText(name,width-margin,53);
 ctx.font="20px Tahoma, sans-serif";ctx.fillStyle="#c3aaff";ctx.fillText("WH OUSH · CHARACTER REFERENCE SHEET",width-margin,88);
 for(let i=0;i<CHARACTER_VIEWS.length;i++){
  const view=CHARACTER_VIEWS[i],x=margin+(i%3)*(cellW+gap),y=header+Math.floor(i/3)*(cellH+gap);
  ctx.fillStyle="#21212a";ctx.fillRect(x,y,cellW,cellH);
  const blob=refs[view.id];
  if(blob)await drawReference(ctx,blob,x+10,y+10,cellW-20,cellH-65);
  else {ctx.fillStyle="#a4a0af";ctx.font="25px Tahoma, sans-serif";ctx.textAlign="center";ctx.fillText("Not provided",x+cellW/2,y+cellH/2);ctx.textAlign="right";}
  ctx.fillStyle="#111018";ctx.fillRect(x,y+cellH-49,cellW,49);
  ctx.fillStyle="#eee";ctx.font="21px Tahoma, sans-serif";ctx.fillText(view.title,x+cellW-15,y+cellH-18);
 }
 const out=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("خروجی تصویر ناموفق بود.")),"image/png"));
 const url=URL.createObjectURL(out);
 const a=document.createElement("a");a.href=url;a.download="whoush-character-reference-sheet.png";a.click();
 window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function CharacterStudio(){
 const router=useRouter();
 const [profiles,setProfiles]=useState<CharacterProfile[]>([]);
 const [activeId,setActiveId]=useState<string|null>(null);
 const [name,setName]=useState("");
 const [notes,setNotes]=useState("");
 const [refs,setRefs]=useState<CharacterReferences>({});
 const [consent,setConsent]=useState(false);
 const [dirty,setDirty]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [info,setInfo]=useState("");
 const [deletePending,setDeletePending]=useState(false);
 const [urls,setUrls]=useState<Partial<Record<CharacterView,string>>>({});
 const [loaded,setLoaded]=useState(false);
 useEffect(()=>{
  let alive=true;
  listLocalCharacters().then(items=>{if(alive){setProfiles(items);setLoaded(true);}})
   .catch(()=>{if(alive){setError("کتابخانه محلی در این مرورگر در دسترس نیست.");setLoaded(true);}});
  return()=>{alive=false;};
 },[]);
 useEffect(()=>{
  const next:Partial<Record<CharacterView,string>>={};
  for(const view of CHARACTER_VIEWS){const blob=refs[view.id];if(blob)next[view.id]=URL.createObjectURL(blob);}
  setUrls(next);
  return()=>{Object.values(next).forEach(x=>URL.revokeObjectURL(x));};
 },[refs]);
 const coverage=characterCoverage(refs);
 const saved=profiles.find(p=>p.id===activeId);
 const canUse=Boolean(activeId&&!dirty&&coverage.requiredReady&&consent);
 function newProfile(){setActiveId(null);setName("");setNotes("");setRefs({});setConsent(false);setDirty(true);setError("");setInfo("");setDeletePending(false);}
 function selectProfile(p:CharacterProfile){setActiveId(p.id);setName(p.name);setNotes(p.notes);setRefs(p.references);setConsent(Boolean(p.consentConfirmedAt));setDirty(false);setError("");setInfo("");setDeletePending(false);}
 async function upload(view:CharacterView,file?:File){
  if(!file)return;setError("");setInfo("");
  try{await checkImage(file);setRefs(prev=>({...prev,[view]:file}));setDirty(true);}
  catch(e){setError(e instanceof Error?e.message:"خطای عکس");}
 }
 function remove(view:CharacterView){setRefs(prev=>{const next={...prev};delete next[view];return next;});setDirty(true);}
 async function save(){
  setError("");setInfo("");
  if(!consent){setError("برای ذخیره، حق استفاده از تصاویر را تأیید کن.");return;}
  const now=new Date().toISOString();
  const profile:CharacterProfile={
   id:activeId??crypto.randomUUID(),name:name.trim(),notes:notes.trim(),references:refs,
   createdAt:saved?.createdAt??now,updatedAt:now,consentConfirmedAt:now,version:(saved?.version??0)+1
  };
  setBusy(true);
  try{
   await saveLocalCharacter(profile);
   setProfiles(await listLocalCharacters());setActiveId(profile.id);setDirty(false);
   setInfo("پروفایل کاراکتر فقط در همین مرورگر ذخیره شد.");
  }catch(e){setError(e instanceof Error?e.message:"خطا در ذخیره کاراکتر.");}
  finally{setBusy(false);}
 }
 async function confirmDelete(){
  if(!activeId)return;setBusy(true);setError("");
  try{await deleteLocalCharacter(activeId);setProfiles(await listLocalCharacters());newProfile();setInfo("پروفایل از این مرورگر پاک شد.");}
  catch(e){setError(e instanceof Error?e.message:"حذف ناموفق بود.");}
  finally{setBusy(false);}
 }
 async function contactSheet(){
  if(coverage.count===0){setError("اول یک عکس مرجع اضافه کن.");return;}
  setBusy(true);setError("");
  try{await exportContactSheet(name.trim()||"Character",refs);}
  catch(e){setError(e instanceof Error?e.message:"خروجی گرفتن ناموفق بود.");}
  finally{setBusy(false);}
 }
 return <main className="characters-page" dir="rtl">
  <header className="characters-header">
   <Link href="/studio" className="characters-back"><ArrowLeft size={16}/> بازگشت به استودیو</Link>
   <div style={{display:"flex",alignItems:"center",gap:"16px"}}><ThemeToggle/><Link href="/" className="brand">✳ <strong>whoush</strong></Link></div>
  </header>
  <section className="characters-hero">
   <div className="characters-hero-text"><div className="character-eyebrow"><UserRound size={15}/> CHARACTER STUDIO / استودیوی کاراکتر</div>
    <h1>یک چهره. <span>هزار داستان.</span></h1>
    <p>شخصیت خودت رو با چند عکس واقعی از زاویه‌های مختلف معرفی کن تا در پروژه‌های عکس و ویدیو از یک مرجع ثابت استفاده کنی.</p>
    <div className="character-hero-tags"><span><LockKeyhole size={14}/> قفل چهره، در حد قابلیت مدل</span><span><Camera size={14}/> ۶ زاویه مرجع</span><span><ShieldCheck size={14}/> فقط ذخیره روی دستگاه</span></div>
   </div>
   <div className="hero-geometry" aria-hidden="true"><span className="hero-face">◉</span><span>FRONT · 3/4 · PROFILE</span></div>
  </section>
  <div className="characters-layout">
   <aside className="characters-library">
    <div className="library-heading"><h2>کاراکترهای من</h2><button type="button" onClick={newProfile} aria-label="کاراکتر جدید"><Plus size={18}/></button></div>
    <p className="character-secondary">آرشیو خصوصی همین مرورگر، بدون آپلود سرور.</p>
    {!loaded&&<p className="character-secondary">در حال بارگذاری…</p>}
    {loaded&&profiles.length===0&&<div className="empty-character"><UserRound size={28}/><span>هنوز کاراکتری نداری.</span></div>}
    {profiles.map(p=><button key={p.id} type="button" onClick={()=>selectProfile(p)} className={"library-character "+(activeId===p.id?"active":"")}>
     <span className="library-icon"><UserRound size={20}/></span>
     <span className="library-title"><b>{p.name}</b><small>{fa(characterCoverage(p.references).count)} عکس مرجع</small></span>
     {activeId===p.id&&<Check size={15} color="#c0a2ff"/>}
    </button>)}
    <div className="character-library-note"><ShieldCheck size={17}/><p>تصاویر فعلاً فقط در حافظه همین مرورگر می‌مونن. برای بکاپ از شیت مرجع خروجی بگیر. پاک کردن داده‌های مرورگر ممکنه آرشیو رو حذف کنه.</p></div>
   </aside>
   <section className="characters-editor">
    <div className="character-step-header"><div className="step-number">۱</div><div><h2>پروفایل شخصیت</h2><p>اسم و مشخصات اختیاری برای حفظ هویت ظاهری در پروژه‌ها</p></div></div>
    <div className="character-identity-grid">
     <label className="character-field"><span>نام کاراکتر</span><input value={name} onChange={e=>{setName(e.target.value);setDirty(true);}} maxLength={80} placeholder="مثلاً: کاراکتر شماره یک" /></label>
     <label className="character-field"><span>ویژگی‌های ظاهری قابل حفظ (اختیاری)</span><textarea value={notes} onChange={e=>{setNotes(e.target.value);setDirty(true);}} maxLength={1200} rows={3} placeholder="مثلاً: مو و فرم ریش ثابت بماند؛ فقط محیط و لباس تغییر کند."/></label>
    </div>
    <div className="character-step-header step-spaced"><div className="step-number">۲</div><div><h2>عکس‌های مرجع</h2><p>چهار نمای ضروری + دو زاویه تکمیلی برای شناسایی دقیق‌تر ظاهر</p></div></div>
    <div className="reference-progress"><div><strong>{fa(coverage.count)} از {fa(coverage.total)}</strong> نما آماده <small>{coverage.requiredReady?"نماهای ضروری کامل‌اند.":"عکس‌های ضروری را تکمیل کن."}</small></div><div className="progress-rail"><div style={{width:(coverage.count/coverage.total*100)+"%"}}/></div></div>
    <div className="character-angle-grid">
     {CHARACTER_VIEWS.map(view=><div className="character-angle-card" key={view.id}>
      <div className="angle-top"><span>{view.title}</span>{view.required?<small>ضروری</small>:<small className="optional">اختیاری</small>}</div>
      <div className="angle-photo">
       {urls[view.id]?<img src={urls[view.id]} alt={"عکس مرجع "+view.title}/>:<div className="angle-placeholder"><UserRound size={42}/><span>{view.english}</span></div>}
       {urls[view.id]&&<span className="angle-check"><CheckCircle2 size={19}/></span>}
      </div>
      <p>{view.guide}</p>
      <div className="angle-actions">
       <label className="angle-upload"><ImagePlus size={15}/>{urls[view.id]?"تعویض عکس":"آپلود عکس"}
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{void upload(view.id,e.target.files?.[0]);e.target.value="";}} aria-label={"آپلود "+view.title}/>
       </label>
       {urls[view.id]&&<button type="button" onClick={()=>remove(view.id)} aria-label={"حذف "+view.title}><Trash2 size={15}/></button>}
      </div>
     </div>)}
    </div>
    <div className="character-tip"><Camera size={19}/><div><strong>راهنمای عکاسی حرفه‌ای</strong><p>از یک شخص ثابت، با نور نرم و یکنواخت، بدون فیلتر زیبایی یا تغییر چهره عکس بگیر. چشم‌ها واضح، موها مشخص و در عکس تمام‌قد، سر تا پا داخل کادر باشه. JPEG / PNG / WebP، حداقل ۵۱۲ پیکسل و حداکثر ۸ مگابایت.</p></div></div>
    <div className="character-step-header step-spaced"><div className="step-number">۳</div><div><h2>ذخیره و استفاده</h2><p>مرجع تصویری رو نگه دار و برای پروژه‌های بعدی انتخابش کن.</p></div></div>
    <label className="consent-label"><input type="checkbox" checked={consent} onChange={e=>{setConsent(e.target.checked);setDirty(true);}}/><span>مالک این تصاویر هستم یا اجازه استفاده از چهره و شباهت فرد را برای تولید محتوای تصویری دارم.</span></label>
    {error&&<div className="character-error" role="alert">{error}</div>}
    {info&&<div className="character-info" role="status">{info}</div>}
    <div className="character-actions">
     <button type="button" className="character-save" onClick={()=>void save()} disabled={busy}><Check size={16}/> {busy?"در حال انجام…":"ذخیره کاراکتر"}</button>
     <button type="button" className="character-secondary-button" disabled={busy||coverage.count===0} onClick={()=>void contactSheet()}><Download size={16}/> خروجی شیت مرجع PNG</button>
     <button type="button" className="character-use" disabled={!canUse||busy} onClick={()=>{if(activeId)router.push("/studio?character="+encodeURIComponent(activeId));}}><WandSparkles size={16}/> استفاده در استودیو</button>
    </div>
    <div className="characters-caution"><LockKeyhole size={17}/> انتخاب کاراکتر در نسخه فعلی صرفاً برای آماده‌سازی پروژه است. عکس‌ها هنوز به Higgsfield ارسال نمی‌شوند، زاویه مفقود تولید نمی‌شود و نتیجه «قفل چهره» تضمین نشده است.</div>
    {activeId&&!deletePending&&<button type="button" className="character-delete-link" onClick={()=>setDeletePending(true)}><Trash2 size={15}/> حذف این کاراکتر</button>}
    {activeId&&deletePending&&<div className="delete-confirm"><span>کاراکتر و تمام عکس‌هایش از این مرورگر حذف شود؟</span><button type="button" onClick={()=>void confirmDelete()} disabled={busy}>بله، حذف کن</button><button type="button" onClick={()=>setDeletePending(false)}>انصراف</button></div>}
   </section>
  </div>
 </main>;
}
