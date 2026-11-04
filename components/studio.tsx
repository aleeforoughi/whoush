"use client";
import {useEffect,useRef,useState,type ClipboardEvent,type DragEvent,type FormEvent} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {ArrowUp,CircleAlert,Clapperboard,Info,LoaderCircle,Menu,Upload,UserRound,X} from "lucide-react";
import {Alert,AlertDescription,AlertTitle,Badge,Button,Icon,ScrollArea,Sheet,SheetClose,SheetContent,SheetDescription,SheetTitle,SheetTrigger,Tabs,TabsContent,TabsList,TabsTrigger,Label} from "@aleeforoughi/feather-react";
import {BrandMark} from "@/components/brand-mark";
import {JobSteps} from "@/components/job-steps";
import {NoModelCard,ProposalCard} from "@/components/proposal-card";
import {CharacterDialog} from "@/components/character-dialog";
import {InsertMenu} from "@/components/insert-menu";
import {ModeControl,useMode} from "@/components/mode-control";
import {StyleControl,useStyleSetting} from "@/components/style-control";
import {AttachmentChip,AttachmentPreview,type AttachmentPatch} from "@/components/attachment-chip";
import {MentionTextarea} from "@/components/mention-textarea";
import {MessageText} from "@/components/message-text";
import {AttachmentTray,type AttachmentProblem} from "@/components/attachment-tray";
import {RailContent} from "@/components/studio-rail";
import type {AgentProposal,JobView,NoModelResult} from "@/lib/studio-types";
import {getLocalCharacter,listLocalCharacters} from "@/lib/character-store";
import {characterCoverage,characterUsability,type CharacterProfile} from "@/lib/characters";
import {fa} from "@/lib/format";
import {ATTACHMENT_ACCEPT,ATTACHMENT_ERRORS_FA,MAX_ATTACHMENTS,acceptFor,allocateTag,insertMention,newTagCounters,parseMentions,tooManyFa,toWireAttachment,validateAttachmentSet,withRole,withoutRole,type AttachmentKind,type AttachmentRole,type LocalAttachment} from "@/lib/attachments";
import {readAttachment} from "@/lib/attachment-files";
import type {InsertAction} from "@/lib/insert-menu";

type TranscriptItem={role:"user"|"agent";text:string;attachments?:LocalAttachment[]};
type StudioView="chat"|"canvas";
const opening="سلام! دوست داری چه تصویر یا ویدیویی بسازیم؟ می‌تونی مدل موردعلاقه‌ات رو هم توی پیام بنویسی.";
const idlePreview="شروع کن: ایده‌ات رو در چت بنویس.";
const CHARACTER_KEY="whoush-character";
/** A file picked through the + menu: its kind must match the entry, and `role` (absent for documents) is what the user chose. */
type Upload={kind:"image"|"video"|"audio"|"file";role?:AttachmentRole};
const UPLOAD_KIND_FA={image:"تصویر",video:"ویدیو",audio:"صدا",file:"سند (PDF، JSON یا Markdown)"} as const;
const uploadRejection=(u:Upload,kind:AttachmentKind)=>(u.kind==="file"?kind==="pdf"||kind==="json"||kind==="md":u.kind===kind)?undefined:"این گزینه فقط "+UPLOAD_KIND_FA[u.kind]+" می‌پذیرد.";

/** sessionStorage can throw (private windows, blocked storage); the selection then simply does not persist. */
const rememberCharacter=(id:string|null)=>{try{if(id)window.sessionStorage.setItem(CHARACTER_KEY,id);else window.sessionStorage.removeItem(CHARACTER_KEY);}catch{ /* not persisted */ }};
const hasFiles=(e:DragEvent)=>Array.from(e.dataTransfer.types).includes("Files");
const rememberedCharacter=()=>{try{return window.sessionStorage.getItem(CHARACTER_KEY);}catch{return null;}};

export function Studio(){
 const router=useRouter();
 const [messages,setMessages]=useState<TranscriptItem[]>([{role:"agent",text:opening}]);
 const [draft,setDraft]=useState("");
 const [proposal,setProposal]=useState<AgentProposal|null>(null);
 const [noModel,setNoModel]=useState<NoModelResult|null>(null);
 const [restricted,setRestricted]=useState("");
 const [charactersOpen,setCharactersOpen]=useState(false);
 /** «سبک» beside the build mode: a remembered setting (null is «خودکار»). */
 const [style,setStyle]=useStyleSetting();
 const [mode,setMode]=useMode();
 const [selected,setSelected]=useState("");
 const [busy,setBusy]=useState(false);
 const [preview,setPreview]=useState(idlePreview);
 const [job,setJob]=useState<JobView|null>(null);
 const [activeTab,setActiveTab]=useState<"generations"|"cuts">("generations");
 const [error,setError]=useState("");
 const [characters,setCharacters]=useState<CharacterProfile[]>([]);
 const [charactersLoaded,setCharactersLoaded]=useState(false);
 const [characterId,setCharacterId]=useState<string|null>(null);
 const [characterNote,setCharacterNote]=useState("");
 const [view,setView]=useState<StudioView>("chat");
 const [menuOpen,setMenuOpen]=useState(false);
 const [attachments,setAttachments]=useState<LocalAttachment[]>([]);
 const [problems,setProblems]=useState<AttachmentProblem[]>([]);
 const [reading,setReading]=useState(false);
 const [dragging,setDragging]=useState(false);
 const [announce,setAnnounce]=useState("");
 const [previewing,setPreviewing]=useState<LocalAttachment|null>(null);
 const endRef=useRef<HTMLDivElement>(null);
 const fileInput=useRef<HTMLInputElement>(null);
 const formRef=useRef<HTMLFormElement>(null);
 /** What the next file picker is for; set by a + menu entry and consumed when files are chosen. */
 const pendingUpload=useRef<Upload|undefined>(undefined);
 const promptRef=useRef<HTMLTextAreaElement>(null);
 /** Tags count up for the whole conversation and are never reused after a removal; "new chat" starts over. */
 const tagCounters=useRef(newTagCounters());
 const readingRef=useRef(false);
 const dragDepth=useRef(0);
 /** Every live object URL (composer tray and sent messages). Revoked on remove, new chat and unmount. */
 const urls=useRef(new Set<string>());
 const character=characters.find(c=>c.id===characterId)??null;
 /** Every attachment of this conversation that still exists: sent messages first, then the tray. */
 const conversation=[...messages.flatMap(m=>m.attachments??[]),...attachments];
 const byTag=new Map(conversation.map(a=>[a.tag,a]));
 /** Keep ?character=<id> in step with the selection without reloading or adding history entries. */
 function syncUrl(id:string|null){
  const query=new URLSearchParams(window.location.search);
  if(id)query.set("character",id);else query.delete("character");
  const qs=query.toString();
  router.replace("/studio"+(qs?"?"+qs:""),{scroll:false});
 }
 function pickCharacter(id:string|null){
  setCharacterId(id);setCharacterNote("");rememberCharacter(id);syncUrl(id);
 }
 // The ?character= deep link wins over the remembered selection; either must name a usable character.
 useEffect(()=>{
  let alive=true;
  const fromUrl=new URLSearchParams(window.location.search).get("character");
  listLocalCharacters().then(items=>{
   if(!alive)return;
   setCharacters(items);setCharactersLoaded(true);
   const wanted=fromUrl??rememberedCharacter();
   if(!wanted)return;
   const found=items.find(c=>c.id===wanted),usable=found&&characterUsability(found);
   if(found&&usable?.ok){setCharacterId(found.id);rememberCharacter(found.id);if(!fromUrl)syncUrl(found.id);}
   else if(fromUrl)setCharacterNote(found&&usable&&!usable.ok?"«"+found.name+"» هنوز قابل انتخاب نیست: "+usable.reason:"کاراکتر این پیوند در این مرورگر پیدا نشد.");
  }).catch(()=>{if(alive)setCharactersLoaded(true);});
  return()=>{alive=false;};
  // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on mount; syncUrl only needs the router, which is stable
 },[]);
 useEffect(()=>{const live=urls.current;return()=>{live.forEach(u=>URL.revokeObjectURL(u));live.clear();};},[]);
 useEffect(()=>{endRef.current?.scrollIntoView({block:"end"});},[messages,proposal,noModel,restricted,error]);
 function releaseUrl(a:LocalAttachment){if(a.previewUrl){URL.revokeObjectURL(a.previewUrl);urls.current.delete(a.previewUrl);}}
 /** Verifies the picked files one by one; the good ones join the tray, each rejected one gets its own Persian reason. */
 async function addFiles(files:File[],upload?:Upload){
  if(!files.length||readingRef.current)return;
  readingRef.current=true;setReading(true);setProblems([]);setAnnounce("");
  const next=[...attachments],added:LocalAttachment[]=[],bad:AttachmentProblem[]=[];
  for(const file of files){
   const name=file.name||"فایل",fail=(message:string)=>bad.push({key:crypto.randomUUID(),name,message});
   if(next.length>=MAX_ATTACHMENTS){fail(tooManyFa());continue;}
   try{
    const read=await readAttachment(file),check=validateAttachmentSet([...next,read]);
    if(!check.ok){if(read.previewUrl)URL.revokeObjectURL(read.previewUrl);fail(check.error);continue;}
    // A file added through a + menu entry must be of that entry's kind; the check runs before a tag is spent.
    const rejection=upload?uploadRejection(upload,read.kind):undefined;
    if(rejection){if(read.previewUrl)URL.revokeObjectURL(read.previewUrl);fail(rejection);continue;}
    const tagged=allocateTag(tagCounters.current,read.kind);
    if(!tagged){if(read.previewUrl)URL.revokeObjectURL(read.previewUrl);fail(ATTACHMENT_ERRORS_FA.tagsExhausted);continue;}
    tagCounters.current=tagged.counters;
    const tagged1:LocalAttachment={...read,tag:tagged.tag},a=upload?.role?withRole(tagged1,upload.role):tagged1;
    if(a.previewUrl)urls.current.add(a.previewUrl);
    next.push(a);added.push(a);
   }catch(err){fail(err instanceof Error?err.message:ATTACHMENT_ERRORS_FA.unreadable);}
  }
  setAttachments(cur=>[...cur,...added]);setProblems(bad);
  setAnnounce((added.length?fa(added.length)+" فایل اضافه شد. ":"")+(bad.length?fa(bad.length)+" فایل رد شد.":""));
  readingRef.current=false;setReading(false);
 }
 function removeAttachment(id:string){
  const a=attachments.find(x=>x.id===id);if(a)releaseUrl(a);
  setAttachments(list=>list.filter(x=>x.id!==id));
 }
 function patchAttachment(id:string,patch:AttachmentPatch){setAttachments(list=>list.map(x=>x.id!==id?x:patch.role===null?withoutRole(x):patch.role?withRole(x,patch.role):{...x,...(patch.speech?{speech:patch.speech}:{})}));}
 /** Puts the Persian tag (`#تصویر-۱ `) into the prompt at the caret (or over the selection) and returns focus to it. */
 function mentionTag(tag:string){
  const el=promptRef.current;if(!el)return;
  const r=insertMention(draft,el.selectionStart,el.selectionEnd,tag);
  if(r.text.length>4000)return;
  setDraft(r.text);requestAnimationFrame(()=>{el.focus();el.setSelectionRange(r.caret,r.caret);});
 }
 /** A + menu entry: open the file picker for that kind (or the saved-character dialog). The picker is one hidden input whose `accept` follows the entry. */
 function pickInsert(action:InsertAction){
  if(action.type==="characters"){setCharactersOpen(true);return;}
  const el=fileInput.current;if(!el)return;
  pendingUpload.current=action.type==="auto"?undefined:action.type==="file"?{kind:"file"}:{kind:action.kind,role:action.role};
  el.accept=action.type==="auto"?ATTACHMENT_ACCEPT:acceptFor(action.type==="file"?"file":action.kind);
  el.click();
 }
 function onDrop(e:DragEvent){
  if(!hasFiles(e))return;
  e.preventDefault();dragDepth.current=0;setDragging(false);void addFiles(Array.from(e.dataTransfer.files));
 }
 function onPaste(e:ClipboardEvent){
  const files=Array.from(e.clipboardData.files);
  if(files.length){e.preventDefault();void addFiles(files);}
 }
 function newChat(){
  urls.current.forEach(u=>URL.revokeObjectURL(u));urls.current.clear();
  setAttachments([]);setProblems([]);setAnnounce("");setPreviewing(null);tagCounters.current=newTagCounters();
  setMessages([{role:"agent",text:opening}]);setProposal(null);setNoModel(null);setRestricted("");setJob(null);
  setPreview(idlePreview);setError("");setDraft("");
 }
 async function send(e:FormEvent){
  e.preventDefault();const text=draft.trim();if(!text||busy||reading)return;
  // This message's new files plus any earlier file it mentions as #تصویر-۱ or @image1 (metadata only, as before).
  const mentioned=parseMentions(text),inTray=new Set(attachments.map(a=>a.id));
  const outgoing=[...messages.flatMap(m=>m.attachments??[]).filter(a=>mentioned.includes(a.tag)&&!inTray.has(a.id)),...attachments];
  const fits=validateAttachmentSet(outgoing);
  if(!fits.ok){setError(fits.error);return;}
  // The profile may have been edited or withdrawn in another tab: send what is stored now, and only if it is still usable.
  let current=character;
  if(character){
   setBusy(true);
   current=await getLocalCharacter(character.id).catch(()=>undefined)??null;
   if(!current||!characterUsability(current).ok){
    setBusy(false);setCharacters(await listLocalCharacters().catch(()=>[]));pickCharacter(null);
    setError("کاراکتر انتخاب‌شده دیگر آمادهٔ استفاده نیست (حذف شده یا رضایتش نیاز به تأیید دارد). درخواستت ارسال نشد؛ دوباره انتخاب کن یا بدون کاراکتر بفرست.");return;
   }
   const fresh=current;setCharacters(list=>list.map(c=>c.id===fresh.id?fresh:c));
  }
  // The tray clears, but the files stay (with their object URLs) on the sent message; they are released on new chat or unmount.
  const sent=attachments;
  setDraft("");setError("");setRestricted("");setBusy(true);setProposal(null);setNoModel(null);setAttachments([]);setProblems([]);setAnnounce("");
  setMessages(m=>[...m,{role:"user",text,...(sent.length?{attachments:sent}:{})}]);
  const characterRef=current?{id:current.id,name:current.name,angles:characterCoverage(current.references).uploaded,version:current.version}:undefined;
  try{
   const r=await fetch("/api/agent",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text,preference:mode,...(style?{style}:{}),...(characterRef&&characterRef.angles.length>0?{characterRef}:{}),...(outgoing.length?{attachments:outgoing.map(toWireAttachment)}:{})})});
   if(!r.ok){
    const errorBody=await r.json().catch(()=>({})) as {error?:string;message?:string;plan?:AgentProposal["plan"]};
    if(r.status===422&&errorBody.error==="no_compatible_model"){
     const message=typeof errorBody.message==="string"?errorBody.message:"مدل سازگاری برای این درخواست پیدا نشد.";
     setMessages(m=>[...m,{role:"agent",text:message}]);setNoModel({message,plan:errorBody.plan});setPreview("مدل سازگار پیدا نشد");
     return;
    }
    if(r.status===422&&errorBody.error==="content_restricted"){
     setRestricted(typeof errorBody.message==="string"?errorBody.message:"این درخواست را نمی‌توانم انجام بدهم.");
     return;
    }
    throw new Error(typeof errorBody.message==="string"?errorBody.message:"خطا در آماده‌سازی پیشنهاد");
   }
   const data=await r.json() as AgentProposal&{message:string};
   setProposal(data);setSelected(data.selectedModelId);setPreview("در انتظار تأیید تولید");setJob(null);
   setMessages(m=>[...m,{role:"agent",text:data.message}]);
  }catch(err){setError(err instanceof Error?err.message:"خطای ناشناخته");}
  finally{setBusy(false);}
 }
 async function approve(){
  if(!proposal||busy)return;setBusy(true);setError("");
  try{
   const turnId=proposal.turnId;
   if(!turnId)throw new Error("پیشنهاد منقضی شده است؛ دوباره درخواستت را بفرست.");
   const post=(url:string,body:unknown)=>fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
   const q=await post("/api/generation/quote",{modelId:selected,turnId});
   if(!q.ok)throw new Error(q.status===410?"پیشنهاد منقضی شده است؛ دوباره درخواستت را بفرست.":"مشکل در محاسبه هزینه");
   const quote=await q.json() as {token:string};
   const execution=await post("/api/generation/execute",{token:quote.token,approved:true,idempotencyKey:crypto.randomUUID()});
   if(!execution.ok)throw new Error("خطا در شروع تولید");
   let current=await execution.json() as {id:string;state:string;messageFa:string};
   const done=["completed","completed_demo","failed","canceled","released"];
   setPreview(current.messageFa);setJob({state:current.state,messageFa:current.messageFa});setView("canvas");
   for(let i=0;i<10&&!done.includes(current.state);i++){
    await new Promise(r=>setTimeout(r,1500));
    const poll=await fetch("/api/generation/jobs/"+current.id,{cache:"no-store"});if(!poll.ok)break;
    current=await poll.json();setPreview(current.messageFa);setJob({state:current.state,messageFa:current.messageFa});
   }
   setMessages(m=>[...m,{role:"agent",text:current.messageFa}]);setProposal(null);
  }catch(err){setError(err instanceof Error?err.message:"خطای ناشناخته");}
  finally{setBusy(false);}
 }
 const showChat=view==="chat";
 return <div className="flex h-dvh flex-col overflow-hidden md:grid md:grid-cols-[4.5rem_minmax(0,1fr)] lg:grid-cols-[16rem_minmax(0,1fr)]">
  {/* Mobile: top bar with brand and menu */}
  <header className="flex items-center justify-between border-b border-line-tertiary px-4 py-1 md:hidden">
   <BrandMark/>
   <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
    <SheetTrigger render={<Button variant="ghost" size="icon" aria-label="منو"/>}><Icon icon={Menu} aria-hidden="true"/></SheetTrigger>
    <SheetContent side="right" showCloseButton={false} className="w-3/4 max-w-xs">
     <div className="flex items-center justify-between ps-4 pe-2 pt-2">
      <SheetTitle className="type-title text-fg-primary">منوی استودیو</SheetTitle>
      <SheetClose render={<Button variant="ghost" size="icon" aria-label="بستن منو"/>}><Icon icon={X} aria-hidden="true"/></SheetClose>
     </div>
     <SheetDescription className="sr-only">دسترسی به بخش‌های هووش</SheetDescription>
     <RailContent labels="always" onNewChat={newChat} onNavigate={()=>setMenuOpen(false)}/>
    </SheetContent>
   </Sheet>
  </header>
  {/* Tablet and desktop: navigation rail on the start side */}
  <header className="hidden border-e border-line-tertiary md:block">
   <RailContent labels="responsive" onNewChat={newChat}/>
  </header>
  <main id="main" className="flex min-h-0 flex-1 flex-col md:grid md:grid-cols-[minmax(0,1fr)_22rem] lg:grid-cols-[minmax(0,1fr)_26rem]">
   <h1 className="sr-only">استودیوی هووش</h1>
   {/* Mobile: one focus at a time */}
   <div role="group" aria-label="نمای استودیو" className="grid grid-cols-2 gap-1 border-b border-line-tertiary p-2 md:hidden">
    <Button variant={showChat?"secondary":"ghost"} aria-pressed={showChat} onClick={()=>setView("chat")}>گفت‌وگو</Button>
    <Button variant={showChat?"ghost":"secondary"} aria-pressed={!showChat} onClick={()=>setView("canvas")}>بوم</Button>
   </div>
   {/* Center: canvas */}
   <section aria-label="بوم" className={(showChat?"hidden":"flex")+" min-h-0 flex-1 flex-col md:flex"}>
    <Tabs value={activeTab} onValueChange={v=>setActiveTab(v as "generations"|"cuts")} className="min-h-0 flex-1 gap-0">
     <div className="flex items-center justify-between gap-4 border-b border-line-tertiary px-4 py-2 lg:px-6">
      <TabsList><TabsTrigger value="generations">تولیدها</TabsTrigger><TabsTrigger value="cuts">تدوین</TabsTrigger></TabsList>
      <Badge variant="outline">نسخه نمایشی</Badge>
     </div>
     <ScrollArea className="min-h-0 flex-1">
      <div className="flex flex-col gap-8 p-4 lg:p-6">
       <TabsContent value="generations" className="flex flex-col gap-8">
        <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-card border border-line-secondary bg-surface-subtle p-8 text-center md:aspect-video">
         <Icon icon={Clapperboard} size={32} className="text-fg-secondary" aria-hidden="true"/>
         <p className="type-body text-fg-primary">{preview}</p>
         <p className="type-caption text-fg-secondary">خروجی تصویری واقعی هنوز فعال نیست</p>
        </div>
        <div aria-live="polite">{job&&<JobSteps job={job}/>}</div>
       </TabsContent>
       <TabsContent value="cuts">
        <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-card border border-line-secondary bg-surface-subtle p-8 text-center">
         <p className="type-body text-fg-primary">بخش تدوین در مرحله بعد ساخته می‌شود.</p>
        </div>
       </TabsContent>
      </div>
     </ScrollArea>
    </Tabs>
   </section>
   {/* End side: agent panel */}
   <section aria-label="دستیار هووش" className={(showChat?"flex":"hidden")+" relative min-h-0 flex-1 flex-col border-line-tertiary md:flex md:border-s"}
    onDragEnter={e=>{if(!hasFiles(e))return;e.preventDefault();dragDepth.current+=1;setDragging(true);}}
    onDragOver={e=>{if(hasFiles(e))e.preventDefault();}}
    onDragLeave={e=>{if(!hasFiles(e))return;dragDepth.current=Math.max(0,dragDepth.current-1);if(!dragDepth.current)setDragging(false);}}
    onDrop={onDrop}>
    {dragging&&<div aria-hidden="true" className="pointer-events-none absolute inset-2 z-10 flex flex-col items-center justify-center gap-2 rounded-card border border-dashed border-primary bg-surface-base/90 type-title text-fg-primary">
     <Icon icon={Upload} size={32} aria-hidden="true"/>فایل‌ها را اینجا رها کن
    </div>}
    <div role="status" aria-live="polite" className="sr-only">{dragging?"فایل‌ها را اینجا رها کن":announce}</div>
    <div className="border-b border-line-tertiary px-4 py-3">
     <h2 className="type-title text-fg-primary">دستیار هووش</h2>
     <p className="type-body-sm text-fg-secondary">ساخت تصویر و ویدیو با گفت‌وگو</p>
    </div>
    {characterNote&&<div className="border-b border-line-tertiary px-4 py-3"><Alert role="status"><Icon icon={Info} aria-hidden="true"/><AlertDescription>{characterNote}</AlertDescription></Alert></div>}
    {character&&<div className="flex flex-col gap-1 border-b border-line-tertiary px-4 py-3">
     <div className="flex flex-wrap items-center gap-2">
      <Badge variant="secondary"><Icon icon={UserRound} size={16} aria-hidden="true"/><span className="sr-only">کاراکتر انتخاب‌شده: </span>{character.name}</Badge>
      <Button variant="ghost" render={<Link href="/characters"/>} nativeButton={false}>ویرایش</Button>
      <Button type="button" variant="ghost" size="icon" aria-label="حذف کاراکتر انتخاب‌شده" onClick={()=>pickCharacter(null)}><Icon icon={X} aria-hidden="true"/></Button>
     </div>
     <p className="type-caption text-fg-secondary">{fa(characterCoverage(character.references).count)} عکس مرجع · فقط در این مرورگر. مشخصات کاراکتر همراه درخواست برای برنامه‌ریزی ارسال می‌شود؛ خود عکس‌ها هنوز به سرویس تولید فرستاده نمی‌شوند.</p>
    </div>}
    <ScrollArea className="min-h-0 flex-1">
     <div aria-live="polite" aria-label="گفت‌وگو" role="log" className="flex flex-col gap-4 p-4">
      {messages.map((m,i)=><div key={i} className={m.role==="user"?"max-w-[85%] self-end rounded-card bg-surface-subtle px-4 py-3 type-body-sm text-fg-primary":"type-body-sm text-fg-primary"}>
       <span className="sr-only">{m.role==="user"?"شما: ":"هووش: "}</span>{m.role==="user"?<MessageText text={m.text} attachments={byTag} onOpen={setPreviewing}/>:m.text}
       {m.attachments&&<ul aria-label="پیوست‌های این پیام" className="mt-2 flex flex-wrap gap-2">{m.attachments.map(a=><AttachmentChip key={a.id} item={a} onPreview={()=>setPreviewing(a)} onMention={()=>mentionTag(a.tag)}/>)}</ul>}
      </div>)}
      {proposal&&<ProposalCard proposal={proposal} selected={selected} onSelect={setSelected} busy={busy} onApprove={()=>void approve()}/>}
      {noModel&&<NoModelCard result={noModel}/>}
      {restricted&&<Alert role="status">
       <Icon icon={Info} aria-hidden="true"/>
       <AlertTitle>این درخواست قابل انجام نیست</AlertTitle>
       <AlertDescription>{restricted}</AlertDescription>
      </Alert>}
      <div ref={endRef}/>
     </div>
    </ScrollArea>
    {error&&<div className="px-4 pb-2"><Alert variant="destructive" role="alert">
     <Icon icon={CircleAlert} aria-hidden="true"/>
     <AlertTitle>خطا</AlertTitle>
     <AlertDescription>{error}</AlertDescription>
    </Alert></div>}
    {/* The chip tray and the composer scroll together under the chat, so on a short screen the prompt and the send button stay reachable. */}
    <div className="flex max-h-[64dvh] min-h-0 shrink-0 flex-col overflow-y-auto border-t border-line-tertiary bg-surface-base">
    <form ref={formRef} onSubmit={e=>void send(e)} className="flex shrink-0 flex-col gap-3 bg-surface-base p-4">
     <AttachmentTray items={attachments} problems={problems} reading={reading} onChange={patchAttachment} onRemove={removeAttachment} onPreview={setPreviewing} onMention={mentionTag} onDismiss={key=>setProblems(list=>list.filter(p=>p.key!==key))}/>
     <input ref={fileInput} type="file" multiple hidden accept={ATTACHMENT_ACCEPT} data-testid="attachment-input" onChange={e=>{const files=Array.from(e.target.files??[]),upload=pendingUpload.current;pendingUpload.current=undefined;e.target.value="";void addFiles(files,upload);}}/>
     <Label className="sr-only" htmlFor="whoush-prompt">توضیح تصویر یا ویدیو</Label>
     <MentionTextarea id="whoush-prompt" inputRef={promptRef} value={draft} onValueChange={setDraft} options={conversation} onPaste={onPaste} placeholder="چی می‌خوای بسازیم؟" aria-describedby="prompt-hint" rows={3} maxLength={4000} className="max-h-40 resize-none"
      onSubmitShortcut={()=>{if(draft.trim()&&!busy&&!reading)formRef.current?.requestSubmit();}}
      startAction={<InsertMenu disabled={reading} onPick={pickInsert}/>}
      endAction={<Button type="submit" size="icon" disabled={busy||reading||!draft.trim()} aria-busy={busy||undefined} aria-label={busy?"در حال ارسال…":"ارسال"}>
       <Icon icon={busy?LoaderCircle:ArrowUp} aria-hidden="true" className={busy?"animate-spin motion-reduce:animate-none":undefined}/>
      </Button>}/>
     <p id="prompt-hint" className="flex items-start gap-1 type-caption text-fg-secondary"><Icon icon={Info} size={16} aria-hidden="true" className="mt-0.5 shrink-0"/>با # می‌تونی به پیوست‌ها اشاره کنی.</p>
     <div className="flex flex-wrap items-start gap-2">
      <ModeControl value={mode} onChange={setMode} notify={Boolean(proposal)}/>
      <StyleControl value={style} onChange={setStyle}/>
     </div>
    </form>
    </div>
   </section>
   <AttachmentPreview item={previewing} onClose={()=>setPreviewing(null)}/>
   <CharacterDialog open={charactersOpen} onOpenChange={setCharactersOpen} characters={characters} loaded={charactersLoaded} selectedId={characterId} onPick={pickCharacter}/>
  </main>
 </div>;
}
