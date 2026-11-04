"use client";
import {useEffect,useRef,useState} from "react";
import Link from "next/link";
import {Camera,Check,CircleAlert,CircleHelp,Download,FileJson,Info,LockKeyhole,Plus,ShieldCheck,Trash2,UserRound,WandSparkles} from "lucide-react";
import {Alert,AlertDescription,AlertTitle,Badge,Button,Card,CardContent,CardDescription,CardFooter,CardHeader,CardTitle,Checkbox,Dialog,DialogClose,DialogContent,DialogDescription,DialogFooter,DialogHeader,DialogTitle,Field,FieldContent,FieldDescription,FieldGroup,FieldLabel,Icon,Input,Progress,ProgressLabel,Textarea} from "@aleeforoughi/feather-react";
import {SiteHeader} from "@/components/site-header";
import {CharacterLibrary,ReferenceCard} from "@/components/character-parts";
import {CHARACTER_VIEWS,CONSENT_TEXT_FA,CONSENT_VERSION,characterCoverage,characterUsability,consentProblem,createCharacterConsent,duplicateReferenceMessage,findDuplicateReference,hasCurrentConsent,missingViewTitles,nextCharacterVersion,type CharacterProfile,type CharacterReferenceMeta,type CharacterReferences,type CharacterView} from "@/lib/characters";
import {deleteLocalCharacter,listLocalCharacters,saveLocalCharacter} from "@/lib/character-store";
import {describeReferenceFile} from "@/lib/character-files";
import {exportManifest,exportReferenceSheet} from "@/lib/character-export";
import {fa,faDate} from "@/lib/format";

type Urls=Partial<Record<CharacterView,string>>;
type Dialogs="delete"|"withdraw"|null;
const CONSENT_RESET_NOTE="عکس‌های مرجع تغییر کرده‌اند؛ برای ذخیره، رضایت را دوباره تأیید کن.";
const revoke=(urls:Record<string,string>)=>{Object.values(urls).forEach(u=>URL.revokeObjectURL(u));};
const errorText=(e:unknown,fallback:string)=>e instanceof Error?e.message:fallback;

export function CharacterStudio(){
 const [profiles,setProfiles]=useState<CharacterProfile[]>([]);
 const [thumbs,setThumbs]=useState<Record<string,string>>({});
 const [activeId,setActiveId]=useState<string|null>(null);
 const [name,setName]=useState("");
 const [notes,setNotes]=useState("");
 const [refs,setRefs]=useState<CharacterReferences>({});
 const [meta,setMeta]=useState<CharacterReferenceMeta>({});
 const [urls,setUrls]=useState<Urls>({});
 const [consent,setConsent]=useState(false);
 const [consentNote,setConsentNote]=useState("");
 const [refsChanged,setRefsChanged]=useState(false);
 const [dirty,setDirty]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [info,setInfo]=useState("");
 const [dialog,setDialog]=useState<Dialogs>(null);
 const [loaded,setLoaded]=useState(false);
 // Mirrors of state that async handlers need current (two uploads can overlap).
 const refsRef=useRef<CharacterReferences>({});
 const metaRef=useRef<CharacterReferenceMeta>({});
 const urlsRef=useRef<Urls>({});
 const thumbsRef=useRef<Record<string,string>>({});
 const consentRef=useRef(false);
 /** Replace the library and its thumbnails together; the previous thumbnail URLs are released here. */
 function commitProfiles(items:CharacterProfile[]){
  revoke(thumbsRef.current);
  const next:Record<string,string>={};
  for(const p of items){const front=p.references.front;if(front)next[p.id]=URL.createObjectURL(front);}
  thumbsRef.current=next;setThumbs(next);setProfiles(items);
 }
 useEffect(()=>{
  let alive=true;
  listLocalCharacters().then(items=>{if(alive){commitProfiles(items);setLoaded(true);}})
   .catch(()=>{if(alive){setError("کتابخانه محلی در این مرورگر در دسترس نیست.");setLoaded(true);}});
  return()=>{alive=false;};
 },[]);
 // Object URLs are created in handlers; this only releases whatever is left on unmount.
 useEffect(()=>()=>{revoke(urlsRef.current as Record<string,string>);revoke(thumbsRef.current);},[]);
 /** Replace the draft references and their preview URLs together (unchanged files keep their URL). */
 function applyDraft(nextRefs:CharacterReferences,nextMeta:CharacterReferenceMeta){
  const prevUrls=urlsRef.current,next:Urls={};
  for(const v of CHARACTER_VIEWS){
   const blob=nextRefs[v.id],old=prevUrls[v.id];
   if(!blob){if(old)URL.revokeObjectURL(old);continue;}
   if(old&&refsRef.current[v.id]===blob)next[v.id]=old;
   else{if(old)URL.revokeObjectURL(old);next[v.id]=URL.createObjectURL(blob);}
  }
  refsRef.current=nextRefs;metaRef.current=nextMeta;urlsRef.current=next;
  setRefs(nextRefs);setMeta(nextMeta);setUrls(next);
 }
 function setConsentChecked(v:boolean){consentRef.current=v;setConsent(v);if(v)setConsentNote("");}
 const coverage=characterCoverage(refs);
 const missing=missingViewTitles(refs);
 const saved=profiles.find(p=>p.id===activeId);
 const usable=saved?characterUsability(saved):undefined;
 const canUse=Boolean(saved&&!dirty&&usable?.ok);
 const exportable=Boolean(saved&&!dirty);
 function newProfile(){
  setActiveId(null);setName("");setNotes("");applyDraft({},{});setConsentChecked(false);setConsentNote("");setRefsChanged(false);setDirty(true);setError("");setInfo("");setDialog(null);
 }
 function selectProfile(p:CharacterProfile){
  setActiveId(p.id);setName(p.name);setNotes(p.notes);applyDraft(p.references,p.referenceMeta);
  const problem=consentProblem(p.consent,p.referenceMeta);
  setConsentChecked(!problem);setConsentNote(problem??"");
  setRefsChanged(false);setDirty(false);setError("");setInfo("");setDialog(null);
 }
 /** Any change to the references voids the confirmation: the person confirms again for the new set. */
 function referencesChanged(){
  setDirty(true);setRefsChanged(true);
  if(consentRef.current){setConsentChecked(false);setConsentNote(CONSENT_RESET_NOTE);}
 }
 async function upload(view:CharacterView,file?:File){
  if(!file)return;setError("");setInfo("");
  try{
   const described=await describeReferenceFile(file,new Date().toISOString());
   const duplicate=findDuplicateReference(metaRef.current,described.sha256,view);
   if(duplicate){setError(duplicateReferenceMessage(duplicate));return;}
   applyDraft({...refsRef.current,[view]:file},{...metaRef.current,[view]:described});
   referencesChanged();
  }catch(e){setError(errorText(e,"خطای عکس"));}
 }
 function remove(view:CharacterView){
  const nextRefs={...refsRef.current},nextMeta={...metaRef.current};
  delete nextRefs[view];delete nextMeta[view];
  applyDraft(nextRefs,nextMeta);referencesChanged();
 }
 async function save(){
  setError("");setInfo("");
  if(!consent){setError("برای ذخیره، رضایت‌نامه را تأیید کن.");return;}
  const now=new Date().toISOString();
  const cleanName=name.trim(),cleanNotes=notes.trim();
  // A consent that is still current for unchanged images keeps its original time; anything else is confirmed now.
  const keepConsent=Boolean(saved&&hasCurrentConsent(saved)&&!refsChanged);
  const profile:CharacterProfile={
   id:activeId??crypto.randomUUID(),name:cleanName,notes:cleanNotes,references:refsRef.current,referenceMeta:metaRef.current,
   createdAt:saved?.createdAt??now,updatedAt:now,consent:keepConsent?saved!.consent:createCharacterConsent(now),
   version:nextCharacterVersion(saved,{name:cleanName,notes:cleanNotes,referenceMeta:metaRef.current})
  };
  setBusy(true);
  try{
   await saveLocalCharacter(profile);
   commitProfiles(await listLocalCharacters());setActiveId(profile.id);setDirty(false);setRefsChanged(false);setConsentNote("");
   setInfo("پروفایل کاراکتر فقط در همین مرورگر ذخیره شد (نسخهٔ "+fa(profile.version)+").");
  }catch(e){setError(errorText(e,"خطا در ذخیره کاراکتر."));}
  finally{setBusy(false);}
 }
 async function confirmDelete(){
  if(!activeId)return;const withdrawn=dialog==="withdraw";setBusy(true);setError("");
  try{
   await deleteLocalCharacter(activeId);commitProfiles(await listLocalCharacters());newProfile();
   setInfo(withdrawn?"رضایت پس گرفته شد و کاراکتر با همهٔ عکس‌هایش از این مرورگر حذف شد.":"پروفایل از این مرورگر پاک شد.");
  }catch(e){setError(errorText(e,"حذف ناموفق بود."));}
  finally{setBusy(false);setDialog(null);}
 }
 async function runExport(kind:"sheet"|"manifest"){
  if(!saved)return;setBusy(true);setError("");setInfo("");
  try{
   const fileName=kind==="sheet"?await exportReferenceSheet(saved):exportManifest(saved);
   setInfo("فایل «"+fileName+"» ساخته شد.");
  }catch(e){setError(errorText(e,"خروجی گرفتن ناموفق بود."));}
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
   <div className="grid items-start gap-8 lg:grid-cols-[20rem_minmax(0,1fr)]">
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
       <CharacterLibrary profiles={profiles} thumbs={thumbs} activeId={activeId} onSelect={selectProfile}/>
      </CardContent>
      <CardFooter><p className="type-caption text-fg-secondary">تصاویر فعلاً فقط در حافظه همین مرورگر می‌مونن؛ ذخیره‌سازی امن روی سرور به حساب کاربری نیاز دارد و هنوز وجود ندارد. پاک کردن داده‌های مرورگر ممکنه آرشیو رو حذف کنه. از شیت مرجع و فایل مانیفست برای بایگانی خودت استفاده کن.</p></CardFooter>
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
       <span className="type-body-sm text-fg-secondary">ضروری: {fa(coverage.requiredCount)} از {fa(coverage.requiredTotal)} · اختیاری: {fa(coverage.optionalCount)} از {fa(coverage.optionalTotal)}</span>
      </Progress>
      {missing.length>0
       ?<Alert role="status">
        <Icon icon={CircleHelp} aria-hidden="true"/>
        <AlertTitle>نماهای ضروری که هنوز اضافه نشده‌اند</AlertTitle>
        <AlertDescription><ul className="list-disc ps-5">{missing.map(t=><li key={t}>{t}</li>)}</ul>تا این نماها کامل نشوند، کاراکتر در استودیو قابل انتخاب نیست. نمای ناموجود هرگز ساخته نمی‌شود.</AlertDescription>
       </Alert>
       :<p className="flex items-center gap-2 type-body-sm text-fg-secondary"><Icon icon={Check} size={16} aria-hidden="true"/>همهٔ نماهای ضروری آماده‌اند.</p>}
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
       {CHARACTER_VIEWS.map(view=><li key={view.id}>
        <ReferenceCard view={view} url={urls[view.id]} meta={meta[view.id]} onPick={file=>void upload(view.id,file)} onRemove={()=>remove(view.id)}/>
       </li>)}
      </ul>
      <Alert role="note">
       <Icon icon={Camera} aria-hidden="true"/>
       <AlertTitle>راهنمای عکاسی حرفه‌ای</AlertTitle>
       <AlertDescription>از یک شخص ثابت، با نور نرم و یکنواخت، بدون فیلتر زیبایی یا تغییر چهره عکس بگیر. چشم‌ها واضح، موها مشخص و در عکس تمام‌قد، سر تا پا داخل کادر باشه. <bdi dir="ltr">JPEG / PNG / WebP</bdi>، حداقل {fa(512)} پیکسل (پیشنهاد: {fa(1024)} پیکسل یا بیشتر) و حداکثر {fa(8)} مگابایت. هر زاویه عکس جداگانه می‌خواهد.</AlertDescription>
      </Alert>
     </section>
     <section aria-labelledby="step-save" className="flex flex-col gap-4">
      <div><h2 id="step-save" className="type-heading-3 text-fg-primary">{fa(3)}. رضایت، ذخیره و استفاده</h2><p className="type-body-sm text-fg-secondary">مرجع تصویری رو نگه دار و برای پروژه‌های بعدی انتخابش کن.</p></div>
      <Field orientation="horizontal" className="items-start">
       <Checkbox id="character-consent" checked={consent} onCheckedChange={v=>setConsentChecked(v===true)}/>
       <FieldContent>
        <FieldLabel htmlFor="character-consent" className="font-normal">{CONSENT_TEXT_FA}</FieldLabel>
        <FieldDescription>رضایت‌نامهٔ نسخهٔ <bdi dir="ltr">{CONSENT_VERSION}</bdi> · فقط برای برنامه‌ریزی با مرجع کاراکتر. بدون این تأیید، کاراکتر ذخیره نمی‌شود.{saved?.consent&&hasCurrentConsent(saved)&&<> آخرین تأیید: {faDate(saved.consent.confirmedAt)}.</>}</FieldDescription>
       </FieldContent>
      </Field>
      {consentNote&&<Alert role="status">
       <Icon icon={Info} aria-hidden="true"/>
       <AlertDescription>{consentNote}</AlertDescription>
      </Alert>}
      <div aria-live="polite" className="flex flex-col gap-2 empty:hidden">
       {error&&<Alert variant="destructive" role="alert"><Icon icon={CircleAlert} aria-hidden="true"/><AlertDescription>{error}</AlertDescription></Alert>}
       {info&&<Alert role="status"><Icon icon={Check} aria-hidden="true"/><AlertDescription>{info}</AlertDescription></Alert>}
      </div>
      <div className="flex flex-wrap gap-3">
       <Button onClick={()=>void save()} disabled={busy}><Icon icon={Check} aria-hidden="true"/>{busy?"در حال انجام…":"ذخیره کاراکتر"}</Button>
       <Button variant="outline" disabled={busy||!exportable||coverage.count===0} onClick={()=>void runExport("sheet")}><Icon icon={Download} aria-hidden="true"/>شیت مرجع <bdi dir="ltr">PNG</bdi></Button>
       <Button variant="outline" disabled={busy||!exportable} onClick={()=>void runExport("manifest")}><Icon icon={FileJson} aria-hidden="true"/>مانیفست <bdi dir="ltr">JSON</bdi></Button>
       {canUse&&saved&&!busy
        ?<Button variant="secondary" render={<Link href={"/studio?character="+encodeURIComponent(saved.id)}/>} nativeButton={false}><Icon icon={WandSparkles} aria-hidden="true"/>استفاده در استودیو</Button>
        :<Button variant="secondary" disabled><Icon icon={WandSparkles} aria-hidden="true"/>استفاده در استودیو</Button>}
      </div>
      <p className="type-caption text-fg-secondary">
       {!exportable?"خروجی‌ها از نسخهٔ ذخیره‌شده ساخته می‌شوند؛ اول ذخیره کن. ":"مانیفست فقط مشخصات و تاریخ رضایت را دارد، نه خود عکس‌ها. "}
       {saved&&usable&&!usable.ok&&<>برای استفاده در استودیو: {usable.reason}</>}
      </p>
      <Alert role="note">
       <Icon icon={Info} aria-hidden="true"/>
       <AlertDescription>انتخاب کاراکتر در نسخه فعلی صرفاً برای آماده‌سازی پروژه است. عکس‌ها فقط در همین مرورگر می‌مانند و به <bdi dir="ltr">Higgsfield</bdi> ارسال نمی‌شوند، زاویه مفقود تولید نمی‌شود و نتیجه «قفل چهره» تضمین نشده است. ذخیره‌سازی سمت سرور و ارسال مرجع به سرویس تولید، پس از ورود به حساب و وجود یک مدل تأییدشده با ورودی تصویر مرجع اضافه می‌شود.</AlertDescription>
      </Alert>
      {saved&&<div className="flex flex-wrap gap-3">
       <Button variant="outline" onClick={()=>setDialog("withdraw")}><Icon icon={ShieldCheck} aria-hidden="true"/>پس گرفتن رضایت</Button>
       <Button variant="destructive" onClick={()=>setDialog("delete")}><Icon icon={Trash2} aria-hidden="true"/>حذف این کاراکتر</Button>
      </div>}
     </section>
    </div>
   </div>
  </main>
  <Dialog open={dialog!==null} onOpenChange={o=>{if(!o)setDialog(null);}}>
   <DialogContent showCloseButton={false}>
    <DialogHeader>
     <DialogTitle>{dialog==="withdraw"?"پس گرفتن رضایت و حذف کاراکتر؟":"حذف کاراکتر؟"}</DialogTitle>
     <DialogDescription>{dialog==="withdraw"
      ?"با پس گرفتن رضایت، «"+(saved?.name??"")+"» و همهٔ عکس‌های مرجعش برای همیشه از حافظهٔ این مرورگر پاک می‌شود و دیگر در استودیو قابل انتخاب نیست. نسخه‌ای از این عکس‌ها روی سرور هووش نگهداری نمی‌شود. فایل‌هایی که قبلاً دانلود کرده‌ای (شیت مرجع و مانیفست) پاک نمی‌شوند. این کار قابل بازگشت نیست."
      :"کاراکتر و تمام عکس‌هایش از این مرورگر حذف شود؟ این کار قابل بازگشت نیست."}</DialogDescription>
    </DialogHeader>
    <DialogFooter>
     <DialogClose render={<Button variant="outline"/>}>انصراف</DialogClose>
     <Button variant="destructive" disabled={busy} onClick={()=>void confirmDelete()}>{dialog==="withdraw"?"بله، رضایت را پس می‌گیرم و حذف می‌کنم":"بله، حذف کن"}</Button>
    </DialogFooter>
   </DialogContent>
  </Dialog>
 </div>;
}
