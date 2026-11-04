"use client";
import {useEffect,useRef,useState} from "react";
import Image from "next/image";
import Link from "next/link";
import {Camera,Check,CircleAlert,Download,ImagePlus,Info,LockKeyhole,Plus,ShieldCheck,Trash2,UserRound,WandSparkles} from "lucide-react";
import {Alert,AlertDescription,AlertTitle,Badge,Button,Card,CardAction,CardContent,CardDescription,CardFooter,CardHeader,CardTitle,Checkbox,Dialog,DialogClose,DialogContent,DialogDescription,DialogFooter,DialogHeader,DialogTitle,Field,FieldContent,FieldDescription,FieldGroup,FieldLabel,Icon,Input,Label,Progress,ProgressLabel,Textarea} from "@aleeforoughi/feather-react";
import {SiteHeader} from "@/components/site-header";
import {ALLOWED_CHARACTER_IMAGE_TYPES,MAX_CHARACTER_IMAGE_BYTES,CHARACTER_VIEWS,characterCoverage,type CharacterProfile,type CharacterView,type CharacterReferences} from "@/lib/characters";
import {deleteLocalCharacter,listLocalCharacters,saveLocalCharacter} from "@/lib/character-store";
import {fa} from "@/lib/format";

type Urls=Partial<Record<CharacterView,string>>;
function checkImage(file:File):Promise<void>{
 return new Promise((resolve,reject)=>{
  if(!ALLOWED_CHARACTER_IMAGE_TYPES.includes(file.type as typeof ALLOWED_CHARACTER_IMAGE_TYPES[number])||file.size>MAX_CHARACTER_IMAGE_BYTES){
   reject(new Error("فقط عکس‌های JPEG، PNG یا WebP تا ۸ مگابایت مجازند."));return;
  }
  const url=URL.createObjectURL(file);
  const img=new window.Image();
  img.onload=()=>{URL.revokeObjectURL(url);if(img.naturalWidth<512||img.naturalHeight<512)reject(new Error("تصویر باید حداقل ۵۱۲ پیکسل عرض و ارتفاع داشته باشد."));else resolve();};
  img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("تصویر بارگذاری‌شده قابل خواندن نیست."));};
  img.src=url;
 });
}
async function drawReference(ctx:CanvasRenderingContext2D,blob:Blob,x:number,y:number,w:number,h:number):Promise<void>{
 const url=URL.createObjectURL(blob);
 const img=new window.Image();
 try{
  await new Promise<void>((resolve,reject)=>{img.onload=()=>resolve();img.onerror=()=>reject(new Error("تصویر قابل نمایش نیست."));img.src=url;});
  const scale=Math.min(w/img.naturalWidth,h/img.naturalHeight);
  const iw=img.naturalWidth*scale,ih=img.naturalHeight*scale;
  ctx.drawImage(img,x+(w-iw)/2,y+(h-ih)/2,iw,ih);
 }finally{URL.revokeObjectURL(url);}
}
/** Colors for the exported sheet come from the live theme's CSS variables, never from hard-coded values. */
function themeColors(){
 const style=getComputedStyle(document.documentElement);
 const read=(name:string,fallback:string)=>style.getPropertyValue(name).trim()||fallback;
 return {
  background:read("--background","canvas"),card:read("--card","canvas"),text:read("--text-primary","canvastext"),
  muted:read("--text-secondary","graytext"),line:read("--border-secondary","gray"),font:getComputedStyle(document.body).fontFamily||"sans-serif"
 };
}
async function exportContactSheet(name:string,refs:CharacterReferences):Promise<void>{
 const width=1500,height=1190,margin=30,gap=18,header=115;
 const cellW=(width-2*margin-2*gap)/3,cellH=(height-header-2*margin-gap)/2;
 const c=themeColors();
 const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext("2d");if(!ctx)throw new Error("خروجی تصویر در این مرورگر پشتیبانی نمی‌شود.");
 ctx.fillStyle=c.background;ctx.fillRect(0,0,width,height);
 ctx.textAlign="right";ctx.fillStyle=c.text;ctx.font="700 36px "+c.font;ctx.fillText(name,width-margin,53);
 ctx.font="20px "+c.font;ctx.fillStyle=c.muted;ctx.fillText("WHOUSH · CHARACTER REFERENCE SHEET",width-margin,88);
 for(let i=0;i<CHARACTER_VIEWS.length;i++){
  const view=CHARACTER_VIEWS[i],x=margin+(i%3)*(cellW+gap),y=header+Math.floor(i/3)*(cellH+gap);
  ctx.fillStyle=c.card;ctx.fillRect(x,y,cellW,cellH);
  ctx.strokeStyle=c.line;ctx.lineWidth=1;ctx.strokeRect(x+0.5,y+0.5,cellW-1,cellH-1);
  const blob=refs[view.id];
  if(blob)await drawReference(ctx,blob,x+10,y+10,cellW-20,cellH-65);
  else {ctx.fillStyle=c.muted;ctx.font="25px "+c.font;ctx.textAlign="center";ctx.fillText("ارائه نشده",x+cellW/2,y+cellH/2);ctx.textAlign="right";}
  ctx.fillStyle=c.background;ctx.fillRect(x,y+cellH-49,cellW,49);
  ctx.fillStyle=c.text;ctx.font="21px "+c.font;ctx.fillText(view.title,x+cellW-15,y+cellH-18);
 }
 const out=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("خروجی تصویر ناموفق بود.")),"image/png"));
 const url=URL.createObjectURL(out);
 const a=document.createElement("a");a.href=url;a.download="whoush-character-reference-sheet.png";a.click();
 window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function makeUrls(refs:CharacterReferences):Urls{
 const next:Urls={};
 for(const view of CHARACTER_VIEWS){const blob=refs[view.id];if(blob)next[view.id]=URL.createObjectURL(blob);}
 return next;
}
const revokeAll=(urls:Urls)=>{Object.values(urls).forEach(u=>URL.revokeObjectURL(u));};

export function CharacterStudio(){
 const [profiles,setProfiles]=useState<CharacterProfile[]>([]);
 const [activeId,setActiveId]=useState<string|null>(null);
 const [name,setName]=useState("");
 const [notes,setNotes]=useState("");
 const [refs,setRefs]=useState<CharacterReferences>({});
 const [urls,setUrls]=useState<Urls>({});
 const [consent,setConsent]=useState(false);
 const [dirty,setDirty]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [info,setInfo]=useState("");
 const [deletePending,setDeletePending]=useState(false);
 const [loaded,setLoaded]=useState(false);
 const urlsRef=useRef<Urls>({});
 const inputs=useRef<Partial<Record<CharacterView,HTMLInputElement|null>>>({});
 useEffect(()=>{
  let alive=true;
  listLocalCharacters().then(items=>{if(alive){setProfiles(items);setLoaded(true);}})
   .catch(()=>{if(alive){setError("کتابخانه محلی در این مرورگر در دسترس نیست.");setLoaded(true);}});
  return()=>{alive=false;};
 },[]);
 // Object URLs are created in the handlers that change the references; this only releases them on unmount.
 useEffect(()=>()=>{revokeAll(urlsRef.current);},[]);
 /** Replace all references and their preview URLs together. */
 function applyReferences(next:CharacterReferences){
  revokeAll(urlsRef.current);
  const nextUrls=makeUrls(next);urlsRef.current=nextUrls;
  setRefs(next);setUrls(nextUrls);
 }
 const coverage=characterCoverage(refs);
 const saved=profiles.find(p=>p.id===activeId);
 const canUse=Boolean(activeId&&!dirty&&coverage.requiredReady&&consent);
 function newProfile(){setActiveId(null);setName("");setNotes("");applyReferences({});setConsent(false);setDirty(true);setError("");setInfo("");setDeletePending(false);}
 function selectProfile(p:CharacterProfile){setActiveId(p.id);setName(p.name);setNotes(p.notes);applyReferences(p.references);setConsent(Boolean(p.consentConfirmedAt));setDirty(false);setError("");setInfo("");setDeletePending(false);}
 async function upload(view:CharacterView,file?:File){
  if(!file)return;setError("");setInfo("");
  try{await checkImage(file);applyReferences({...refs,[view]:file});setDirty(true);}
  catch(e){setError(e instanceof Error?e.message:"خطای عکس");}
 }
 function remove(view:CharacterView){const next={...refs};delete next[view];applyReferences(next);setDirty(true);}
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
  finally{setBusy(false);setDeletePending(false);}
 }
 async function contactSheet(){
  if(coverage.count===0){setError("اول یک عکس مرجع اضافه کن.");return;}
  setBusy(true);setError("");
  try{await exportContactSheet(name.trim()||"Character",refs);}
  catch(e){setError(e instanceof Error?e.message:"خروجی گرفتن ناموفق بود.");}
  finally{setBusy(false);}
 }
 return <div className="flex min-h-dvh flex-col">
  <SiteHeader/>
  <main id="main" className="feather-container flex flex-1 flex-col gap-10 py-12">
   <div className="flex max-w-prose flex-col gap-4">
    <h1 className="type-heading-1 text-fg-primary">استودیوی کاراکتر</h1>
    <p className="type-body-lg text-fg-secondary">شخصیت خودت رو با چند عکس واقعی از زاویه‌های مختلف معرفی کن تا در پروژه‌های عکس و ویدیو از یک مرجع ثابت استفاده کنی.</p>
    <ul className="flex flex-wrap gap-2">
     <li><Badge variant="outline"><Icon icon={LockKeyhole} size={16} aria-hidden="true"/>قفل چهره، در حد قابلیت مدل</Badge></li>
     <li><Badge variant="outline"><Icon icon={Camera} size={16} aria-hidden="true"/>{fa(6)} زاویه مرجع</Badge></li>
     <li><Badge variant="outline"><Icon icon={ShieldCheck} size={16} aria-hidden="true"/>فقط ذخیره روی دستگاه</Badge></li>
    </ul>
   </div>
   <div className="grid items-start gap-8 lg:grid-cols-[18rem_minmax(0,1fr)]">
    <aside aria-label="کاراکترهای من">
     <Card>
      <CardHeader>
       <CardTitle>کاراکترهای من</CardTitle>
       <CardDescription>آرشیو خصوصی همین مرورگر، بدون آپلود سرور.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
       <Button variant="outline" onClick={newProfile} className="w-full justify-start"><Icon icon={Plus} aria-hidden="true"/>کاراکتر جدید</Button>
       {!loaded&&<p className="type-body-sm text-fg-secondary" role="status">در حال بارگذاری…</p>}
       {loaded&&profiles.length===0&&<p className="flex items-center gap-2 type-body-sm text-fg-secondary"><Icon icon={UserRound} aria-hidden="true"/>هنوز کاراکتری نداری.</p>}
       <ul className="flex flex-col gap-1">
        {profiles.map(p=><li key={p.id}>
         <Button variant={activeId===p.id?"secondary":"ghost"} aria-pressed={activeId===p.id} onClick={()=>selectProfile(p)} className="w-full justify-start">
          <Icon icon={UserRound} aria-hidden="true"/>
          <span className="truncate">{p.name}</span>
          <span className="ms-auto type-caption text-fg-secondary">{fa(characterCoverage(p.references).count)} عکس</span>
         </Button>
        </li>)}
       </ul>
      </CardContent>
      <CardFooter><p className="type-caption text-fg-secondary">تصاویر فعلاً فقط در حافظه همین مرورگر می‌مونن. برای بکاپ از شیت مرجع خروجی بگیر. پاک کردن داده‌های مرورگر ممکنه آرشیو رو حذف کنه.</p></CardFooter>
     </Card>
    </aside>
    <div className="flex flex-col gap-10">
     <section aria-labelledby="step-profile" className="flex flex-col gap-4">
      <div><h2 id="step-profile" className="type-heading-3 text-fg-primary">{fa(1)}. پروفایل شخصیت</h2><p className="type-body-sm text-fg-secondary">اسم و مشخصات اختیاری برای حفظ هویت ظاهری در پروژه‌ها</p></div>
      <FieldGroup>
       <Field>
        <FieldLabel htmlFor="character-name">نام کاراکتر</FieldLabel>
        <Input id="character-name" value={name} onChange={e=>{setName(e.target.value);setDirty(true);}} maxLength={80} placeholder="مثلاً: کاراکتر شماره یک"/>
       </Field>
       <Field>
        <FieldLabel htmlFor="character-notes">ویژگی‌های ظاهری قابل حفظ (اختیاری)</FieldLabel>
        <Textarea id="character-notes" value={notes} onChange={e=>{setNotes(e.target.value);setDirty(true);}} maxLength={1200} rows={3} placeholder="مثلاً: مو و فرم ریش ثابت بماند؛ فقط محیط و لباس تغییر کند."/>
       </Field>
      </FieldGroup>
     </section>
     <section aria-labelledby="step-refs" className="flex flex-col gap-4">
      <div><h2 id="step-refs" className="type-heading-3 text-fg-primary">{fa(2)}. عکس‌های مرجع</h2><p className="type-body-sm text-fg-secondary">چهار نمای ضروری + دو زاویه تکمیلی برای شناسایی دقیق‌تر ظاهر</p></div>
      <Progress value={coverage.count} max={coverage.total} getAriaValueText={(_,v)=>fa(v??0)+" از "+fa(coverage.total)+" نما آماده"}>
       <ProgressLabel>{fa(coverage.count)} از {fa(coverage.total)} نما آماده</ProgressLabel>
       <span className="type-body-sm text-fg-secondary">{coverage.requiredReady?"نماهای ضروری کامل‌اند.":"عکس‌های ضروری را تکمیل کن."}</span>
      </Progress>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
       {CHARACTER_VIEWS.map(view=>{
        const url=urls[view.id];
        return <li key={view.id}><Card className="h-full">
         <CardHeader>
          <CardTitle>{view.title}</CardTitle>
          <CardDescription><bdi dir="ltr">{view.english}</bdi></CardDescription>
          <CardAction>{view.required?<Badge>ضروری</Badge>:<Badge variant="outline">اختیاری</Badge>}</CardAction>
         </CardHeader>
         <CardContent className="flex flex-col gap-4">
          <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-control border border-line-secondary bg-surface-subtle">
           {url?<Image src={url} alt={"عکس مرجع "+view.title} fill unoptimized sizes="(min-width: 1280px) 20vw, (min-width: 640px) 40vw, 90vw" className="object-contain"/>:<Icon icon={UserRound} size={32} className="text-fg-secondary" aria-hidden="true"/>}
          </div>
          <p className="type-body-sm text-fg-secondary">{view.guide}</p>
          <input ref={el=>{inputs.current[view.id]=el;}} hidden type="file" accept="image/jpeg,image/png,image/webp" aria-label={"آپلود "+view.title} onChange={e=>{void upload(view.id,e.target.files?.[0]);e.target.value="";}}/>
          <div className="flex flex-wrap gap-2">
           <Button variant="outline" onClick={()=>inputs.current[view.id]?.click()}><Icon icon={ImagePlus} aria-hidden="true"/>{url?"تعویض عکس":"آپلود عکس"}</Button>
           {url&&<Button variant="ghost" size="icon" aria-label={"حذف "+view.title} onClick={()=>remove(view.id)}><Icon icon={Trash2} aria-hidden="true"/></Button>}
          </div>
         </CardContent>
        </Card></li>;
       })}
      </ul>
      <Alert role="note">
       <Icon icon={Camera} aria-hidden="true"/>
       <AlertTitle>راهنمای عکاسی حرفه‌ای</AlertTitle>
       <AlertDescription>از یک شخص ثابت، با نور نرم و یکنواخت، بدون فیلتر زیبایی یا تغییر چهره عکس بگیر. چشم‌ها واضح، موها مشخص و در عکس تمام‌قد، سر تا پا داخل کادر باشه. <bdi dir="ltr">JPEG / PNG / WebP</bdi>، حداقل {fa(512)} پیکسل و حداکثر {fa(8)} مگابایت.</AlertDescription>
      </Alert>
     </section>
     <section aria-labelledby="step-save" className="flex flex-col gap-4">
      <div><h2 id="step-save" className="type-heading-3 text-fg-primary">{fa(3)}. ذخیره و استفاده</h2><p className="type-body-sm text-fg-secondary">مرجع تصویری رو نگه دار و برای پروژه‌های بعدی انتخابش کن.</p></div>
      <Field orientation="horizontal" className="items-start">
       <Checkbox id="character-consent" checked={consent} onCheckedChange={v=>{setConsent(v===true);setDirty(true);}}/>
       <FieldContent><FieldLabel htmlFor="character-consent" className="font-normal">مالک این تصاویر هستم یا اجازه استفاده از چهره و شباهت فرد را برای تولید محتوای تصویری دارم.</FieldLabel><FieldDescription>بدون این تأیید، کاراکتر ذخیره نمی‌شود.</FieldDescription></FieldContent>
      </Field>
      <div aria-live="polite" className="flex flex-col gap-2 empty:hidden">
       {error&&<Alert variant="destructive" role="alert"><Icon icon={CircleAlert} aria-hidden="true"/><AlertDescription>{error}</AlertDescription></Alert>}
       {info&&<Alert role="status"><Icon icon={Check} aria-hidden="true"/><AlertDescription>{info}</AlertDescription></Alert>}
      </div>
      <div className="flex flex-wrap gap-3">
       <Button onClick={()=>void save()} disabled={busy}><Icon icon={Check} aria-hidden="true"/>{busy?"در حال انجام…":"ذخیره کاراکتر"}</Button>
       <Button variant="outline" disabled={busy||coverage.count===0} onClick={()=>void contactSheet()}><Icon icon={Download} aria-hidden="true"/>خروجی شیت مرجع <bdi dir="ltr">PNG</bdi></Button>
       {canUse&&activeId&&!busy
        ?<Button variant="secondary" render={<Link href={"/studio?character="+encodeURIComponent(activeId)}/>} nativeButton={false}><Icon icon={WandSparkles} aria-hidden="true"/>استفاده در استودیو</Button>
        :<Button variant="secondary" disabled><Icon icon={WandSparkles} aria-hidden="true"/>استفاده در استودیو</Button>}
      </div>
      <Alert role="note">
       <Icon icon={Info} aria-hidden="true"/>
       <AlertDescription>انتخاب کاراکتر در نسخه فعلی صرفاً برای آماده‌سازی پروژه است. عکس‌ها هنوز به <bdi dir="ltr">Higgsfield</bdi> ارسال نمی‌شوند، زاویه مفقود تولید نمی‌شود و نتیجه «قفل چهره» تضمین نشده است.</AlertDescription>
      </Alert>
      {activeId&&<div><Button variant="destructive" onClick={()=>setDeletePending(true)}><Icon icon={Trash2} aria-hidden="true"/>حذف این کاراکتر</Button></div>}
     </section>
    </div>
   </div>
  </main>
  <Dialog open={deletePending} onOpenChange={setDeletePending}>
   <DialogContent showCloseButton={false}>
    <DialogHeader>
     <DialogTitle>حذف کاراکتر؟</DialogTitle>
     <DialogDescription>کاراکتر و تمام عکس‌هایش از این مرورگر حذف شود؟ این کار قابل بازگشت نیست.</DialogDescription>
    </DialogHeader>
    <DialogFooter>
     <DialogClose render={<Button variant="outline"/>}>انصراف</DialogClose>
     <Button variant="destructive" disabled={busy} onClick={()=>void confirmDelete()}>بله، حذف کن</Button>
    </DialogFooter>
   </DialogContent>
  </Dialog>
 </div>;
}
