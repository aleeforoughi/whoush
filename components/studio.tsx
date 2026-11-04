"use client";
import {Fragment,useEffect,useRef,useState,type ClipboardEvent,type DragEvent,type FormEvent} from "react";
import Link from "next/link";
import {useRouter,useSearchParams} from "next/navigation";
import {ArrowUp,CircleAlert,Clapperboard,Info,LoaderCircle,Upload as UploadIcon,UserRound,X} from "lucide-react";
import {Alert,AlertDescription,AlertTitle,Badge,Button,Icon,ScrollArea,Tabs,TabsContent,TabsList,TabsTrigger,Label} from "@aleeforoughi/feather-react";
import {JobSteps} from "@/components/job-steps";
import {NoModelCard,PastProposalCard,ProposalCard} from "@/components/proposal-card";
import {CharacterDialog} from "@/components/character-dialog";
import {InsertMenu} from "@/components/insert-menu";
import {UploadSlotCard} from "@/components/upload-slot";
import {SLOTS_FULL_FA,addSlot,removeSlot,reserveSlotTag,slotFor,uploadRejection,type Upload,type UploadSlot} from "@/lib/upload-slots";
import {ModeControl,useMode} from "@/components/mode-control";
import {StyleControl,useStyleSetting} from "@/components/style-control";
import {AttachmentChip,type AttachmentPatch} from "@/components/attachment-chip";
import {MediaViewer,type ViewerItem} from "@/components/media-viewer";
import {MentionTextarea} from "@/components/mention-textarea";
import {MessageText} from "@/components/message-text";
import {AttachmentTray,type AttachmentProblem} from "@/components/attachment-tray";
import {RailShell} from "@/components/studio-rail";
import type {AgentProposal,JobView,NoModelResult} from "@/lib/studio-types";
import {getLocalCharacter,listLocalCharacters} from "@/lib/character-store";
import {characterCoverage,characterUsability,type CharacterProfile} from "@/lib/characters";
import {fa} from "@/lib/format";
import {STORAGE_FULL_FA,getProject,listAssets,saveAsset,saveProject} from "@/lib/project-store";
import {MAX_MESSAGES,assetToAttachment,attachmentToAsset,autoTitle,jobStateFa,type Project,type StoredMessage} from "@/lib/projects";
import type {GenerationStyle} from "@/lib/creative-plan";
import type {AgentPreference} from "@/lib/types";
import {ATTACHMENT_ACCEPT,ATTACHMENT_ERRORS_FA,MAX_ATTACHMENTS,acceptFor,allocateTag,insertMention,newTagCounters,parseMentions,tooManyFa,toWireAttachment,validateAttachmentSet,withRole,withoutRole,type AttachmentKind,type AttachmentRole,type LocalAttachment} from "@/lib/attachments";
import {readAttachment} from "@/lib/attachment-files";
import type {InsertItem} from "@/lib/insert-menu";

/** A stored message plus the live attachments of its turn (object URLs, not persisted). */
type TranscriptItem=StoredMessage&{attachments?:LocalAttachment[]};
/** The project being edited. `persisted` turns true with the first successful save; the title and creation time are owned by the store once it exists. */
type ActiveProject={id:string;createdAt:string;title:string;titleSource:"auto"|"user";persisted:boolean};
const item=(m:Omit<TranscriptItem,"id"|"at">):TranscriptItem=>({...m,id:crypto.randomUUID(),at:new Date().toISOString()} as TranscriptItem);
const toStored=({attachments,...m}:TranscriptItem):StoredMessage=>({...m,...(attachments?.length?{attachmentIds:attachments.map(a=>a.id)}:{})} as StoredMessage);
const NOT_FOUND_FA="این پروژه در این مرورگر پیدا نشد؛ گفت‌وگوی تازه‌ای شروع شد.";
const LIMIT_FA="این گفت‌وگو به سقف تعداد پیام‌ها رسیده؛ یک گفت‌وگوی جدید شروع کن.";
type StudioView="chat"|"canvas";
const opening="سلام! دوست داری چه تصویر یا ویدیویی بسازیم؟ می‌تونی مدل موردعلاقه‌ات رو هم توی پیام بنویسی.";
const idlePreview="شروع کن: ایده‌ات رو در چت بنویس.";
const CHARACTER_KEY="whoush-character";

/** sessionStorage can throw (private windows, blocked storage); the selection then simply does not persist. */
const rememberCharacter=(id:string|null)=>{try{if(id)window.sessionStorage.setItem(CHARACTER_KEY,id);else window.sessionStorage.removeItem(CHARACTER_KEY);}catch{ /* not persisted */ }};
const hasFiles=(e:DragEvent)=>Array.from(e.dataTransfer.types).includes("Files");
const rememberedCharacter=()=>{try{return window.sessionStorage.getItem(CHARACTER_KEY);}catch{return null;}};

export function Studio(){
 const router=useRouter();
 const projectParam=useSearchParams().get("project");
 const [messages,setMessages]=useState<TranscriptItem[]>([]);
 const [draft,setDraft]=useState("");
 const [proposal,setProposal]=useState<AgentProposal|null>(null);
 /** The message that carries the live (approvable) proposal; every other proposal in the transcript is a read-only record. */
 const [liveId,setLiveId]=useState<string|null>(null);
 const [charactersOpen,setCharactersOpen]=useState(false);
 /** «سبک» and the build mode beside the prompt: remembered settings for a new chat; once a project exists its own values override them and changes go to the project. */
 const [globalStyle,setGlobalStyle]=useStyleSetting();
 const [globalMode,setGlobalMode]=useMode();
 const [local,setLocal]=useState<{mode:AgentPreference;style:GenerationStyle|null}|null>(null);
 const mode=local?.mode??globalMode,style=local?local.style:globalStyle;
 const [selected,setSelected]=useState("");
 const [busy,setBusy]=useState(false);
 const [preview,setPreview]=useState(idlePreview);
 const [job,setJob]=useState<JobView|null>(null);
 const [activeTab,setActiveTab]=useState<"generations"|"cuts">("generations");
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [storageNote,setStorageNote]=useState("");
 const [loadingProject,setLoadingProject]=useState(false);
 const [projectId,setProjectId]=useState<string|null>(null);
 const [characters,setCharacters]=useState<CharacterProfile[]>([]);
 const [charactersLoaded,setCharactersLoaded]=useState(false);
 const [characterId,setCharacterId]=useState<string|null>(null);
 const [characterNote,setCharacterNote]=useState("");
 const [view,setView]=useState<StudioView>("chat");
 const [attachments,setAttachments]=useState<LocalAttachment[]>([]);
 const [problems,setProblems]=useState<AttachmentProblem[]>([]);
 const [reading,setReading]=useState(false);
 const [dragging,setDragging]=useState(false);
 const [announce,setAnnounce]=useState("");
 /** The full-screen viewer: the conversation's files as they were when it opened, and the project title to show. */
 const [viewer,setViewer]=useState<{items:ViewerItem[];index:number;title?:string}|null>(null);
 const endRef=useRef<HTMLDivElement>(null);
 const fileInput=useRef<HTMLInputElement>(null);
 const formRef=useRef<HTMLFormElement>(null);
 /** What the next file picker is for; set by an upload card and consumed when files are chosen. */
 const pendingUpload=useRef<Upload|undefined>(undefined);
 /** The upload card the open picker fills (one file); removed once its file is attached. */
 const pendingSlot=useRef<string|undefined>(undefined);
 /** Empty upload cards inside the chat input, one per «+» entry picked. They hold no file and are dropped on send. */
 const [slots,setSlots]=useState<UploadSlot[]>([]);
 const promptRef=useRef<HTMLTextAreaElement>(null);
 /** Tags count up for the whole conversation and are never reused after a removal; a project saves them, "new chat" starts over. */
 const tagCounters=useRef(newTagCounters());
 const readingRef=useRef(false);
 const dragDepth=useRef(0);
 /** Every live object URL (composer tray and sent messages). Revoked on remove, new chat, project switch and unmount. */
 const urls=useRef(new Set<string>());
 // ---- persistence: the project lives in this browser (IndexedDB) and is created lazily by the first successful turn ----
 const active=useRef<ActiveProject|null>(null);
 const dirty=useRef(false);
 const timer=useRef(0);
 const queue=useRef<Promise<void>>(Promise.resolve());
 const loadSeq=useRef(0);
 /** The files of this conversation: their bytes (to store with the project) and which ones are already stored. Replaced, never cleared, so a save in flight keeps its own. */
 const blobs=useRef(new Map<string,Blob>());
 const savedAssets=useRef(new Set<string>());
 const latest=useRef({messages,mode,style,character:null as CharacterProfile|null});
 const character=characters.find(c=>c.id===characterId)??null;
 useEffect(()=>{latest.current={messages,mode,style,character};});
 /** Every attachment of this conversation that still exists: sent messages first, then the tray. */
 const conversation=[...messages.flatMap(m=>m.attachments??[]),...attachments];
 const byTag=new Map(conversation.map(a=>[a.tag,a]));
 /** Keep ?project= and ?character= in step with the state without reloading or adding history entries. */
 function syncUrl(project:string|null,character:string|null){
  const query=new URLSearchParams(window.location.search);
  if(project)query.set("project",project);else query.delete("project");
  if(character)query.set("character",character);else query.delete("character");
  const qs=query.toString();
  router.replace("/studio"+(qs?"?"+qs:""),{scroll:false});
 }
 function pickCharacter(id:string|null){
  setCharacterId(id);setCharacterNote("");rememberCharacter(id);syncUrl(active.current?.id??null,id);touch();
 }
 /** Writes the project and then its newly sent files. Works from a snapshot taken when it was asked for, so it is safe across a project switch. */
 async function persist(a:ActiveProject,snap:{messages:TranscriptItem[];mode:AgentPreference;style:GenerationStyle|null;character:CharacterProfile|null;counters:typeof tagCounters.current;blobs:Map<string,Blob>;saved:Set<string>}){
  try{
   const prior=await getProject(a.id);
   // Deleted from the rail or another tab while this was pending: never bring it back.
   if(a.persisted&&!prior)return;
   const ref=snap.character&&characterUsability(snap.character).ok?{id:snap.character.id,name:snap.character.name,angles:characterCoverage(snap.character.references).uploaded as string[],version:snap.character.version}:undefined;
   const project:Project={id:a.id,title:prior?.title??a.title,titleSource:prior?.titleSource??a.titleSource,createdAt:prior?.createdAt??a.createdAt,updatedAt:new Date().toISOString(),version:1,
    messages:snap.messages.map(toStored),tagCounters:snap.counters,mode:snap.mode,style:snap.style,...(ref&&ref.angles.length>0?{characterRef:ref}:{})};
   await saveProject(project);
   a.persisted=true;
   for(const m of snap.messages)for(const att of m.attachments??[]){
    if(snap.saved.has(att.id))continue;
    snap.saved.add(att.id);
    try{if(await saveAsset(attachmentToAsset(att,a.id,m.at,snap.blobs.get(att.id)))==="metadata_only")setStorageNote(STORAGE_FULL_FA);}
    catch(err){snap.saved.delete(att.id);setStorageNote(err instanceof Error?err.message:STORAGE_FULL_FA);}
   }
  }catch(err){
   setStorageNote(err instanceof Error?err.message:"ذخیرهٔ پروژه ناموفق بود.");
   // The very first save failed (for example no IndexedDB): this is still a draft, kept in memory only.
   if(!a.persisted&&active.current===a){active.current=null;setProjectId(null);setLocal(null);syncUrl(null,latest.current.character?.id??null);}
  }
 }
 /** Saves now if anything changed. The snapshot is taken synchronously; writes are queued so they never overlap. */
 function save():Promise<void>{
  window.clearTimeout(timer.current);
  const a=active.current;
  if(!a||!dirty.current)return queue.current;
  dirty.current=false;
  const snap={...latest.current,counters:tagCounters.current,blobs:blobs.current,saved:savedAssets.current};
  queue.current=queue.current.then(()=>persist(a,snap));
  return queue.current;
 }
 /** Something about the open project changed: save it shortly (debounced). A draft has no project yet, so nothing is written. */
 function touch(){
  if(!active.current)return;
  dirty.current=true;window.clearTimeout(timer.current);
  timer.current=window.setTimeout(()=>void save(),400);
 }
 /** The first successful turn of a draft creates the project (so there are never empty projects) and puts it in the URL. */
 function adoptProject(firstText:string,characterId:string|null){
  if(active.current)return touch();
  const a:ActiveProject={id:crypto.randomUUID(),createdAt:new Date().toISOString(),title:autoTitle(firstText),titleSource:"auto",persisted:false};
  active.current=a;setProjectId(a.id);setLocal({mode,style});syncUrl(a.id,characterId);touch();
 }
 // Save when the page is hidden or the studio unmounts (for example a click on «دارایی‌ها»).
 useEffect(()=>{
  const onHide=()=>{if(document.visibilityState==="hidden")void save();};
  document.addEventListener("visibilitychange",onHide);
  return()=>{document.removeEventListener("visibilitychange",onHide);void save();};
  // eslint-disable-next-line react-hooks/exhaustive-deps -- save only reads refs
 },[]);
 function changeMode(m:AgentPreference){if(local){setLocal({...local,mode:m});touch();}else setGlobalMode(m);}
 function changeStyle(s:GenerationStyle|null){if(local){setLocal({...local,style:s});touch();}else setGlobalStyle(s);}
 function releaseAll(){
  urls.current.forEach(u=>URL.revokeObjectURL(u));urls.current.clear();
  blobs.current=new Map();savedAssets.current=new Set();
  setAttachments([]);setSlots([]);setProblems([]);setAnnounce("");setViewer(null);tagCounters.current=newTagCounters();
  setMessages([]);setProposal(null);setLiveId(null);setJob(null);
  setPreview(idlePreview);setError("");setNotice("");setStorageNote("");setDraft("");
 }
 /**
  * Opens a project, or (null) an empty draft. With no ?project= the studio always opens a fresh draft, never the latest project: the rail is the way back to earlier chats (like Runway).
  * The open conversation is saved first; an unknown id gives a notice and a draft.
  */
 async function openProject(id:string|null){
  const seq=++loadSeq.current;
  save();
  releaseAll();active.current=null;setProjectId(null);setLocal(null);
  if(!id)return;
  setLoadingProject(true);
  try{
   await queue.current;
   const [p,assets,items]=await Promise.all([getProject(id),listAssets(id),listLocalCharacters().catch(()=>[] as CharacterProfile[])]);
   if(seq!==loadSeq.current)return;
   setCharacters(items);setCharactersLoaded(true);
   if(!p){setNotice(NOT_FOUND_FA);syncUrl(null,characterId);return;}
   const byId=new Map(assets.map(a=>[a.id,a]));
   const restored:TranscriptItem[]=p.messages.map(({attachmentIds,...m})=>{
    const list=(attachmentIds??[]).flatMap(aid=>{
     const a=byId.get(aid);if(!a)return [];
     const url=a.blob?URL.createObjectURL(a.blob):undefined;
     if(url)urls.current.add(url);
     if(a.blob)blobs.current.set(a.id,a.blob);
     return [assetToAttachment(a,url)];
    });
    return {...m,...(list.length?{attachments:list}:{})} as TranscriptItem;
   });
   savedAssets.current=new Set(assets.map(a=>a.id));
   tagCounters.current=p.tagCounters;
   active.current={id:p.id,createdAt:p.createdAt,title:p.title,titleSource:p.titleSource,persisted:true};
   setProjectId(p.id);setLocal({mode:p.mode,style:p.style});setMessages(restored);
   const lastJob=[...restored].reverse().find(m=>m.kind==="job");
   if(lastJob?.kind==="job"){setJob(lastJob.snapshot);setPreview(lastJob.snapshot.messageFa);}
   // The character: an explicit ?character= link wins, otherwise the project's own, and either must still be usable.
   const fromUrl=new URLSearchParams(window.location.search).get("character"),wanted=fromUrl??p.characterRef?.id??null;
   const found=wanted?items.find(c=>c.id===wanted):undefined,usable=found&&characterUsability(found);
   if(found&&usable?.ok){setCharacterId(found.id);setCharacterNote("");}
   else{
    setCharacterId(null);
    if(wanted)setCharacterNote(found&&usable&&!usable.ok?"«"+found.name+"» هنوز قابل انتخاب نیست: "+usable.reason:"کاراکتر این گفت‌وگو دیگر در این مرورگر پیدا نشد.");
   }
   syncUrl(p.id,found&&usable?.ok?found.id:null);
  }catch(err){
   if(seq!==loadSeq.current)return;
   setNotice(err instanceof Error?err.message:NOT_FOUND_FA);syncUrl(null,characterId);
  }finally{if(seq===loadSeq.current)setLoadingProject(false);}
 }
 // The URL is the source of truth for which project is open. Our own router.replace after creating a project lands here with the id already active and does nothing.
 useEffect(()=>{
  if((projectParam??null)===(active.current?.id??null))return;
  void openProject(projectParam);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- reacts to the URL only; openProject reads refs and stable setters
 },[projectParam]);
 // The ?character= deep link wins over the remembered selection; either must name a usable character. (With ?project= the project's own load decides.)
 useEffect(()=>{
  let alive=true;
  const fromUrl=new URLSearchParams(window.location.search).get("character"),hasProject=new URLSearchParams(window.location.search).has("project");
  listLocalCharacters().then(items=>{
   if(!alive)return;
   setCharacters(items);setCharactersLoaded(true);
   if(hasProject)return;
   const wanted=fromUrl??rememberedCharacter();
   if(!wanted)return;
   const found=items.find(c=>c.id===wanted),usable=found&&characterUsability(found);
   if(found&&usable?.ok){setCharacterId(found.id);rememberCharacter(found.id);if(!fromUrl)syncUrl(null,found.id);}
   else if(fromUrl)setCharacterNote(found&&usable&&!usable.ok?"«"+found.name+"» هنوز قابل انتخاب نیست: "+usable.reason:"کاراکتر این پیوند در این مرورگر پیدا نشد.");
  }).catch(()=>{if(alive)setCharactersLoaded(true);});
  return()=>{alive=false;};
  // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on mount; syncUrl only needs the router, which is stable
 },[]);
 useEffect(()=>{const live=urls.current;return()=>{live.forEach(u=>URL.revokeObjectURL(u));live.clear();};},[]);
 useEffect(()=>{endRef.current?.scrollIntoView({block:"end"});},[messages,proposal,error]);
 const blobFor=(id:string)=>blobs.current.get(id);
 /** Opens the viewer on one attachment, with every attachment of this conversation (sent messages first, then the tray) to step through. */
 function openViewer(a:LocalAttachment){
  const items:ViewerItem[]=conversation.map(c=>({id:c.id,kind:c.kind,mime:c.mime,bytes:c.bytes,name:c.name,tag:c.tag,role:c.role,width:c.width,height:c.height,durationSeconds:c.durationSeconds,url:c.previewUrl,blob:blobFor(c.id)}));
  const index=items.findIndex(i=>i.id===a.id);
  if(index>=0)setViewer({items,index,title:active.current?.title});
 }
 function releaseUrl(a:LocalAttachment){if(a.previewUrl){URL.revokeObjectURL(a.previewUrl);urls.current.delete(a.previewUrl);}}
 /** Verifies the picked files one by one; the good ones join the tray, each rejected one gets its own Persian reason. Returns how many were added. */
 async function addFiles(files:File[],upload?:Upload,reservedTag?:string):Promise<number>{
  if(!files.length||readingRef.current)return 0;
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
    // An upload card reserved its tag when it was made (the card already shows it); the kind check above guarantees the prefix matches.
    const tagged=reservedTag&&!added.length?{tag:reservedTag,counters:tagCounters.current}:allocateTag(tagCounters.current,read.kind);
    if(!tagged){if(read.previewUrl)URL.revokeObjectURL(read.previewUrl);fail(ATTACHMENT_ERRORS_FA.tagsExhausted);continue;}
    tagCounters.current=tagged.counters;
    const tagged1:LocalAttachment={...read,tag:tagged.tag},a=upload?.role?withRole(tagged1,upload.role):tagged1;
    if(a.previewUrl)urls.current.add(a.previewUrl);
    blobs.current.set(a.id,file);
    next.push(a);added.push(a);
   }catch(err){fail(err instanceof Error?err.message:ATTACHMENT_ERRORS_FA.unreadable);}
  }
  setAttachments(cur=>[...cur,...added]);setProblems(bad);
  setAnnounce((added.length?fa(added.length)+" فایل اضافه شد. ":"")+(bad.length?fa(bad.length)+" فایل رد شد.":""));
  readingRef.current=false;setReading(false);
  return added.length;
 }
 /** Fills an upload card with one file (picked or dropped); the card goes away only when the file was accepted, so a rejected file leaves it for another try. */
 async function fillSlot(slot:UploadSlot,files:File[]){
  if(await addFiles(files.slice(0,1),slot.upload,slot.tag))setSlots(list=>removeSlot(list,slot.id));
 }
 function openSlotPicker(slot:UploadSlot){
  const el=fileInput.current;if(!el)return;
  pendingUpload.current=slot.upload;pendingSlot.current=slot.id;
  el.accept=slot.upload?acceptFor(slot.upload.kind==="file"?"file":slot.upload.kind):ATTACHMENT_ACCEPT;
  el.multiple=false;
  el.click();
 }
 function dropSlot(id:string){
  const s=slots.find(x=>x.id===id);
  setSlots(list=>removeSlot(list,id));
  if(s)setAnnounce("کارت "+s.titleFa+" حذف شد.");
  requestAnimationFrame(()=>promptRef.current?.focus());
 }
 function removeAttachment(id:string){
  const a=attachments.find(x=>x.id===id);if(a)releaseUrl(a);
  blobs.current.delete(id);
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
 /** A + menu entry adds an empty upload card (title and icon) inside the chat input and moves focus to it; «کاراکترهای من» opens the saved-character dialog. */
 function pickInsert(item:InsertItem){
  const slot=slotFor(item,crypto.randomUUID());
  if(!slot){setCharactersOpen(true);return;}
  const r=addSlot(slots,slot,attachments.length);
  if(r.full){setProblems([{key:crypto.randomUUID(),name:item.titleFa,message:SLOTS_FULL_FA}]);return;}
  // Reserve the tag now so the card can show it (#تصویر-۱) before the upload; the automatic card gets its tag when its file arrives.
  if(slot.upload){
   const t=reserveSlotTag(tagCounters.current,slot.upload);
   if(!t){setProblems([{key:crypto.randomUUID(),name:item.titleFa,message:ATTACHMENT_ERRORS_FA.tagsExhausted}]);return;}
   tagCounters.current=t.counters;r.slots[r.slots.length-1]={...slot,tag:t.tag};
  }
  setSlots(r.slots);setAnnounce("کارت آپلود "+slot.titleFa+" اضافه شد.");
  requestAnimationFrame(()=>document.querySelector<HTMLButtonElement>('[data-slot-id="'+slot.id+'"]')?.focus());
 }
 function onDrop(e:DragEvent){
  if(!hasFiles(e))return;
  e.preventDefault();dragDepth.current=0;setDragging(false);void addFiles(Array.from(e.dataTransfer.files));
 }
 function onPaste(e:ClipboardEvent){
  const files=Array.from(e.clipboardData.files);
  if(files.length){e.preventDefault();void addFiles(files);}
 }
 /** «گفت‌وگوی جدید»: an unsaved draft (no project until the first successful send). The previous project was saved first. */
 function newChat(){
  void openProject(null);
  syncUrl(null,characterId);
 }
 /** The rail deleted a project; if it is the open one, the studio goes back to a fresh draft. */
 function onProjectDeleted(id:string){
  if(active.current?.id!==id)return;
  dirty.current=false;window.clearTimeout(timer.current);
  newChat();
 }
 async function send(e:FormEvent){
  e.preventDefault();const text=draft.trim();if(!text||busy||reading||loadingProject)return;
  if(messages.length>=MAX_MESSAGES-4){setError(LIMIT_FA);return;}
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
  // The tray clears, but the files stay (with their object URLs) on the sent message; they are released on new chat, project switch or unmount.
  const sent=attachments,firstText=messages.find(m=>m.role==="user")?.text??text,characterId=current?.id??null;
  setDraft("");setError("");setNotice("");setBusy(true);setProposal(null);setLiveId(null);setAttachments([]);setSlots([]);setProblems([]);setAnnounce("");
  setMessages(m=>[...m,item({role:"user",text,...(sent.length?{attachments:sent}:{})})]);touch();
  const characterRef=current?{id:current.id,name:current.name,angles:characterCoverage(current.references).uploaded,version:current.version}:undefined;
  try{
   const r=await fetch("/api/agent",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text,preference:mode,...(style?{style}:{}),...(characterRef&&characterRef.angles.length>0?{characterRef}:{}),...(outgoing.length?{attachments:outgoing.map(toWireAttachment)}:{})})});
   if(!r.ok){
    const errorBody=await r.json().catch(()=>({})) as {error?:string;message?:string;plan?:AgentProposal["plan"]};
    if(r.status===422&&errorBody.error==="no_compatible_model"){
     const message=typeof errorBody.message==="string"?errorBody.message:"مدل سازگاری برای این درخواست پیدا نشد.";
     setMessages(m=>[...m,item({role:"agent",text:message,kind:"no_model",snapshot:{message,...(errorBody.plan?{plan:errorBody.plan}:{})}})]);setPreview("مدل سازگار پیدا نشد");
     adoptProject(firstText,characterId);
     return;
    }
    if(r.status===422&&errorBody.error==="content_restricted"){
     setMessages(m=>[...m,item({role:"agent",text:typeof errorBody.message==="string"?errorBody.message:"این درخواست را نمی‌توانم انجام بدهم.",kind:"restricted"})]);
     adoptProject(firstText,characterId);
     return;
    }
    throw new Error(typeof errorBody.message==="string"?errorBody.message:"خطا در آماده‌سازی پیشنهاد");
   }
   const data=await r.json() as AgentProposal&{message:string};
   const picked=data.suggestions.find(s=>s.modelId===data.recommendedModelId)??data.suggestions[0];
   const reply=item({role:"agent",text:data.message,kind:"proposal",snapshot:{operation:data.operation,modelName:picked?.name??"",neurons:picked?.neurons??data.fixedNeurons,intentSummaryFa:data.plan.intentSummaryFa,plan:data.plan}});
   setProposal(data);setLiveId(reply.id);setSelected(data.selectedModelId);setPreview("در انتظار تأیید تولید");setJob(null);
   setMessages(m=>[...m,reply]);
   adoptProject(firstText,characterId);
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
   let current=await execution.json() as {id:string;state:string;messageFa:string;outputs?:JobView["outputs"]};
   const done=["completed","completed_demo","failed","canceled","released"];
   setPreview(current.messageFa);setJob({state:current.state,messageFa:current.messageFa,outputs:current.outputs});setView("canvas");
   for(let i=0;i<10&&!done.includes(current.state);i++){
    await new Promise(r=>setTimeout(r,1500));
    const poll=await fetch("/api/generation/jobs/"+current.id,{cache:"no-store"});if(!poll.ok)break;
    current=await poll.json();setPreview(current.messageFa);setJob({state:current.state,messageFa:current.messageFa,outputs:current.outputs});
   }
   setMessages(m=>[...m,item({role:"agent",text:current.messageFa,kind:"job",snapshot:{state:current.state,messageFa:current.messageFa}})]);setProposal(null);setLiveId(null);touch();
  }catch(err){setError(err instanceof Error?err.message:"خطای ناشناخته");}
  finally{setBusy(false);}
 }
 const showChat=view==="chat";
 return <RailShell current="studio" activeProjectId={projectId} onNewChat={newChat} onProjectDeleted={onProjectDeleted}>
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
     <Icon icon={UploadIcon} size={32} aria-hidden="true"/>فایل‌ها را اینجا رها کن
    </div>}
    <div role="status" aria-live="polite" className="sr-only">{dragging?"فایل‌ها را اینجا رها کن":announce}</div>
    <div className="border-b border-line-tertiary px-4 py-3">
     <h2 className="type-title text-fg-primary">دستیار هووش</h2>
     <p className="type-body-sm text-fg-secondary">ساخت تصویر و ویدیو با گفت‌وگو</p>
    </div>
    {notice&&<div className="border-b border-line-tertiary px-4 py-3"><Alert role="status"><Icon icon={Info} aria-hidden="true"/><AlertDescription>{notice}</AlertDescription></Alert></div>}
    {storageNote&&<div className="border-b border-line-tertiary px-4 py-3"><Alert role="status"><Icon icon={Info} aria-hidden="true"/><AlertDescription>{storageNote}</AlertDescription></Alert></div>}
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
      <div className="type-body-sm text-fg-primary"><span className="sr-only">هووش: </span>{opening}</div>
      {loadingProject&&<p role="status" className="type-body-sm text-fg-secondary">در حال باز کردن پروژه…</p>}
      {messages.map(m=><Fragment key={m.id}>
       {m.kind==="restricted"
        ?<Alert role="status">
         <Icon icon={Info} aria-hidden="true"/>
         <AlertTitle>این درخواست قابل انجام نیست</AlertTitle>
         <AlertDescription>{m.text}</AlertDescription>
        </Alert>
        :<div className={m.role==="user"?"max-w-[85%] self-end rounded-card bg-surface-subtle px-4 py-3 type-body-sm text-fg-primary":"type-body-sm text-fg-primary"}>
         <span className="sr-only">{m.role==="user"?"شما: ":"هووش: "}</span>{m.role==="user"?<MessageText text={m.text} attachments={byTag} onOpen={openViewer}/>:m.text}
         {m.kind==="job"&&<> <Badge variant="outline">{jobStateFa(m.snapshot.state)}</Badge></>}
         {m.attachments&&<ul aria-label="پیوست‌های این پیام" className="mt-2 flex flex-wrap gap-2">{m.attachments.map(a=><AttachmentChip key={a.id} item={a} onPreview={()=>openViewer(a)} onMention={()=>mentionTag(a.tag)}/>)}</ul>}
        </div>}
       {m.kind==="proposal"&&(proposal&&m.id===liveId
        ?<ProposalCard proposal={proposal} selected={selected} onSelect={setSelected} busy={busy} onApprove={()=>void approve()}/>
        :<PastProposalCard snapshot={m.snapshot}/>)}
       {m.kind==="no_model"&&<NoModelCard result={m.snapshot}/>}
      </Fragment>)}
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
     <AttachmentTray items={attachments} problems={problems} reading={reading} onChange={patchAttachment} onRemove={removeAttachment} onPreview={openViewer} onMention={mentionTag} onDismiss={key=>setProblems(list=>list.filter(p=>p.key!==key))}/>
     <input ref={fileInput} type="file" multiple hidden accept={ATTACHMENT_ACCEPT} data-testid="attachment-input" onChange={e=>{const files=Array.from(e.target.files??[]),upload=pendingUpload.current,slot=pendingSlot.current;pendingUpload.current=undefined;pendingSlot.current=undefined;e.target.value="";e.target.multiple=true;const card=slot?slots.find(x=>x.id===slot):undefined;if(card)void fillSlot(card,files);else void addFiles(files,upload);}}/>
     <Label className="sr-only" htmlFor="whoush-prompt">توضیح تصویر یا ویدیو</Label>
     <MentionTextarea id="whoush-prompt" inputRef={promptRef} value={draft} onValueChange={setDraft} options={conversation} onPaste={onPaste} placeholder="چی می‌خوای بسازیم؟" aria-describedby="prompt-hint" rows={3} maxLength={4000} className="max-h-40 resize-none"
      onSubmitShortcut={()=>{if(draft.trim()&&!busy&&!reading)formRef.current?.requestSubmit();}}
      startAction={<InsertMenu disabled={reading} onPick={pickInsert}/>}
      top={slots.length>0?<ul aria-label="کارت‌های آپلود" className="flex gap-2 overflow-x-auto pb-1">
       {slots.map(s=><UploadSlotCard key={s.id} slot={s} disabled={reading} onUpload={()=>openSlotPicker(s)} onDropFiles={f=>void fillSlot(s,f)} onRemove={()=>dropSlot(s.id)}/>)}
      </ul>:undefined}
      endAction={<Button type="submit" size="icon" disabled={busy||reading||!draft.trim()} aria-busy={busy||undefined} aria-label={busy?"در حال ارسال…":"ارسال"}>
       <Icon icon={busy?LoaderCircle:ArrowUp} aria-hidden="true" className={busy?"animate-spin motion-reduce:animate-none":undefined}/>
      </Button>}/>
     <p id="prompt-hint" className="flex items-start gap-1 type-caption text-fg-secondary"><Icon icon={Info} size={16} aria-hidden="true" className="mt-0.5 shrink-0"/>با # می‌تونی به پیوست‌ها اشاره کنی.</p>
     <div className="flex flex-wrap items-start gap-2">
      <ModeControl value={mode} onChange={changeMode} notify={Boolean(proposal)}/>
      <StyleControl value={style} onChange={changeStyle}/>
     </div>
    </form>
    </div>
   </section>
   <MediaViewer items={viewer?.items??[]} index={viewer?viewer.index:null} onIndexChange={i=>setViewer(v=>v&&{...v,index:i})} onClose={()=>setViewer(null)}
    projectTitleOf={()=>viewer?.title}
    restoreFocusTo={item=>document.querySelector<HTMLElement>('[data-viewer-open="'+CSS.escape(item.id)+'"]')}/>
   <CharacterDialog open={charactersOpen} onOpenChange={setCharactersOpen} characters={characters} loaded={charactersLoaded} selectedId={characterId} onPick={pickCharacter}/>
  </main>
 </RailShell>;
}
