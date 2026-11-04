"use client";
import {useEffect,useRef,useState,type FormEvent} from "react";
import Link from "next/link";
import {ArrowUp,CircleAlert,Clapperboard,Info,Menu,UserRound,X} from "lucide-react";
import {Alert,AlertDescription,AlertTitle,Badge,Button,Icon,ScrollArea,Select,SelectContent,SelectItem,SelectTrigger,SelectValue,Sheet,SheetClose,SheetContent,SheetDescription,SheetTitle,SheetTrigger,Tabs,TabsContent,TabsList,TabsTrigger,Textarea,Label} from "@aleeforoughi/feather-react";
import {BrandMark} from "@/components/brand-mark";
import {JobSteps} from "@/components/job-steps";
import {NoModelCard,ProposalCard} from "@/components/proposal-card";
import {RailContent} from "@/components/studio-rail";
import type {AgentPreference} from "@/lib/types";
import type {AgentProposal,JobView,NoModelResult} from "@/lib/studio-types";
import {getLocalCharacter} from "@/lib/character-store";
import {characterCoverage,type CharacterProfile} from "@/lib/characters";
import {fa} from "@/lib/format";

type TranscriptItem={role:"user"|"agent";text:string};
type StudioView="chat"|"canvas";
const opening="سلام! دوست داری چه تصویر یا ویدیویی بسازیم؟ می‌تونی مدل موردعلاقه‌ات رو هم توی پیام بنویسی.";
const idlePreview="شروع کن: ایده‌ات رو در چت بنویس.";
const PREFERENCES=[{value:"quality",label:"کیفیت"},{value:"speed",label:"سرعت"},{value:"cost",label:"اقتصادی"}] as const;

export function Studio(){
 const [messages,setMessages]=useState<TranscriptItem[]>([{role:"agent",text:opening}]);
 const [draft,setDraft]=useState("");
 const [preference,setPreference]=useState<AgentPreference>("quality");
 const [proposal,setProposal]=useState<AgentProposal|null>(null);
 const [noModel,setNoModel]=useState<NoModelResult|null>(null);
 const [restricted,setRestricted]=useState("");
 const [selected,setSelected]=useState("");
 const [busy,setBusy]=useState(false);
 const [preview,setPreview]=useState(idlePreview);
 const [job,setJob]=useState<JobView|null>(null);
 const [activeTab,setActiveTab]=useState<"generations"|"cuts">("generations");
 const [error,setError]=useState("");
 const [character,setCharacter]=useState<CharacterProfile|null>(null);
 const [view,setView]=useState<StudioView>("chat");
 const [menuOpen,setMenuOpen]=useState(false);
 const endRef=useRef<HTMLDivElement>(null);
 useEffect(()=>{const id=new URLSearchParams(window.location.search).get("character");if(id){void getLocalCharacter(id).then(profile=>{if(profile)setCharacter(profile);}).catch(()=>{});}},[]);
 useEffect(()=>{endRef.current?.scrollIntoView({block:"end"});},[messages,proposal,noModel,restricted,error]);
 function newChat(){
  setMessages([{role:"agent",text:opening}]);setProposal(null);setNoModel(null);setRestricted("");setJob(null);
  setPreview(idlePreview);setError("");setDraft("");
 }
 async function send(e:FormEvent){
  e.preventDefault();const text=draft.trim();if(!text||busy)return;
  setDraft("");setError("");setRestricted("");setBusy(true);setProposal(null);setNoModel(null);
  setMessages(m=>[...m,{role:"user",text}]);
  const characterRef=character?{id:character.id,name:character.name,angles:characterCoverage(character.references).uploaded,version:character.version}:undefined;
  try{
   const r=await fetch("/api/agent",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text,preference,...(characterRef&&characterRef.angles.length>0?{characterRef}:{})})});
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
   <section aria-label="دستیار هووش" className={(showChat?"flex":"hidden")+" min-h-0 flex-1 flex-col border-line-tertiary md:flex md:border-s"}>
    <div className="border-b border-line-tertiary px-4 py-3">
     <h2 className="type-title text-fg-primary">دستیار هووش</h2>
     <p className="type-body-sm text-fg-secondary">ساخت تصویر و ویدیو با گفت‌وگو</p>
    </div>
    {character&&<div className="flex flex-col gap-1 border-b border-line-tertiary px-4 py-3">
     <div className="flex flex-wrap items-center gap-2">
      <Badge variant="secondary"><Icon icon={UserRound} size={16} aria-hidden="true"/><span className="sr-only">کاراکتر انتخاب‌شده: </span>{character.name}</Badge>
      <Button variant="link" size="sm" render={<Link href="/characters"/>} nativeButton={false}>ویرایش</Button>
     </div>
     <p className="type-caption text-fg-secondary">{fa(characterCoverage(character.references).count)} عکس مرجع · فقط در این مرورگر. مشخصات کاراکتر همراه درخواست برای برنامه‌ریزی ارسال می‌شود؛ خود عکس‌ها هنوز به سرویس تولید فرستاده نمی‌شوند.</p>
    </div>}
    <ScrollArea className="min-h-0 flex-1">
     <div aria-live="polite" aria-label="گفت‌وگو" role="log" className="flex flex-col gap-4 p-4">
      {messages.map((m,i)=><div key={i} className={m.role==="user"?"max-w-[85%] self-end rounded-card bg-surface-subtle px-4 py-3 type-body-sm text-fg-primary":"type-body-sm text-fg-primary"}>
       <span className="sr-only">{m.role==="user"?"شما: ":"هووش: "}</span>{m.text}
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
    <form onSubmit={e=>void send(e)} className="flex shrink-0 flex-col gap-3 border-t border-line-tertiary bg-surface-base p-4">
     <Label className="sr-only" htmlFor="whoush-prompt">توضیح تصویر یا ویدیو</Label>
     <Textarea id="whoush-prompt" value={draft} onChange={e=>setDraft(e.target.value)} placeholder="چی دوست داری بسازیم؟" rows={3} maxLength={4000} className="max-h-40 resize-none"/>
     <div className="flex items-center justify-between gap-2">
      <Select value={preference} onValueChange={v=>setPreference(v as AgentPreference)} items={PREFERENCES as unknown as {value:string;label:string}[]}>
       <SelectTrigger aria-label="اولویت ساخت"><span className="text-fg-secondary">اولویت</span><SelectValue/></SelectTrigger>
       <SelectContent>{PREFERENCES.map(p=><SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
      </Select>
      <Button type="submit" disabled={busy||!draft.trim()}>{busy?"در حال بررسی…":"ارسال"}<Icon icon={ArrowUp} aria-hidden="true"/></Button>
     </div>
    </form>
   </section>
  </main>
 </div>;
}
