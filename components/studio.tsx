"use client";
import {useEffect,useRef,useState,type ClipboardEvent,type DragEvent,type FormEvent} from "react";
import Link from "next/link";
import {useRouter,useSearchParams} from "next/navigation";
import {ArrowUp,CircleAlert,Clapperboard,Info,LoaderCircle,Minimize2,PanelLeftOpen,Smile,Upload as UploadIcon,UserRound,X} from "lucide-react";
import {Alert,AlertDescription,AlertTitle,Badge,Button,Icon,ScrollArea,Tabs,TabsContent,TabsList,TabsTrigger,Label,Tooltip,TooltipContent,TooltipTrigger} from "@aleeforoughi/feather-react";
import {OPEN_PREVIEW_FA,PreviewCard} from "@/components/preview-card";
import {GenerationPreview} from "@/components/generation-preview";
import {isOwnedOutputUrl} from "@/lib/job-progress";
import {NoModelCard,PastProposalCard,ProposalCard} from "@/components/proposal-card";
import {CharacterDialog} from "@/components/character-dialog";
import {InsertMenu} from "@/components/insert-menu";
import {UploadSlotCard} from "@/components/upload-slot";
import {SLOTS_FULL_FA,addSlot,composerCards,fillSlotWith,forgetAttachment,removeSlot,reserveSlotTag,slotFor,tagsInUse,uploadRejection,type Upload,type UploadSlot} from "@/lib/upload-slots";
import {AttachmentCard,SentAttachmentCard} from "@/components/attachment-card";
import {MessageActions,useNow} from "@/components/message-actions";
import {ModeControl,useMode} from "@/components/mode-control";
import {StyleControl,useStyleSetting} from "@/components/style-control";
import type {AttachmentPatch} from "@/components/attachment-chip";
import {MediaViewer,type ViewerItem} from "@/components/media-viewer";
import {MentionTextarea,attachmentOption,type MentionEditorHandle,type MentionOption} from "@/components/mention-textarea";
import {GenerationRefCard} from "@/components/generation-ref-card";
import {AgentQuestion,PlanStory} from "@/components/plan-details";
import {MessageText} from "@/components/message-text";
import {AttachmentTray,type AttachmentProblem} from "@/components/attachment-tray";
import {RailShell} from "@/components/studio-rail";
import type {AgentProposal,JobView,NoModelResult} from "@/lib/studio-types";
import {getLocalCharacter,listLocalCharacters} from "@/lib/character-store";
import {characterCoverage,characterUsability,type CharacterProfile} from "@/lib/characters";
import {fa} from "@/lib/format";
import {STORAGE_FULL_FA,getProject,listAssets,saveAsset,saveProject} from "@/lib/project-store";
import {MAX_MESSAGES,assetToAttachment,attachmentToAsset,autoTitle,rerunSource,uniqueById,answerBrief,historyFor,toggleReaction,generationTagsIn,referencedGenerations,toGenerationRef,withGenerationTags,type GifSnapshot,type ProposalSnapshot,type Project,type StoredMessage} from "@/lib/projects";
import {MAX_GENERATION_REFS,type ReactionEmoji,type Staging} from "@/lib/creative-plan";
import {LIGHT_SOURCE_FA,describeStagingChangesFa,followUpFocus,lightTags,propTags,sectionsFromWords} from "@/lib/staging";
import {normalizePersian} from "@/lib/safety";
import {isReferenceRequest,type ReferenceRequest} from "@/lib/reference-needs";
import {STAGE_TEXT,postAgentTurn} from "@/lib/agent-stream";
import type {TurnStage} from "@/lib/orchestrator-stages";
import {replyScriptFor} from "@/lib/finglish";
import {ThinkingRow,TypeOut} from "@/components/type-out";
import {ChatGif} from "@/components/chat-gif";
import {COMPOSER_EMOJIS,EmojiPalette} from "@/components/emoji-palette";
import {GifPicker} from "@/components/gif-picker";
import {MessageReactions} from "@/components/message-reactions";
import type {GenerationStyle} from "@/lib/creative-plan";
import type {AgentPreference} from "@/lib/types";
import {ATTACHMENT_ACCEPT,ATTACHMENT_ERRORS_FA,MAX_ATTACHMENTS,acceptFor,bumpTagCounters,displayTag,insertMention,lowestFreeTag,nextGenerationTag,newTagCounters,parseMentions,tooManyFa,toWireAttachment,validateAttachmentSet,withRole,withoutRole,type AttachmentKind,type AttachmentRole,type LocalAttachment} from "@/lib/attachments";
import {readAttachment} from "@/lib/attachment-files";
import type {InsertItem} from "@/lib/insert-menu";
import {nearestAspectRatio} from "@/lib/aspect";

/** A stored message plus the live attachments of its turn (object URLs, not persisted). */
type TranscriptItem=StoredMessage&{attachments?:LocalAttachment[]};
/** The project being edited. `persisted` turns true with the first successful save; the title and creation time are owned by the store once it exists. */
type ActiveProject={id:string;createdAt:string;title:string;titleSource:"auto"|"user";persisted:boolean};
const item=(m:Omit<TranscriptItem,"id"|"at">):TranscriptItem=>({...m,id:crypto.randomUUID(),at:new Date().toISOString()} as TranscriptItem);
const toStored=({attachments,...m}:TranscriptItem):StoredMessage=>({...m,...(attachments?.length?{attachmentIds:attachments.map(a=>a.id)}:{})} as StoredMessage);
const NOT_FOUND_FA="این پروژه در این مرورگر پیدا نشد؛ گفت‌وگوی تازه‌ای شروع شد.";
const LIMIT_FA="این گفت‌وگو به سقف تعداد پیام‌ها رسیده؛ یک گفت‌وگوی جدید شروع کن.";
const opening="سلام! دوست داری چه تصویر یا ویدیویی بسازیم؟ می‌تونی مدل موردعلاقه‌ات رو هم توی پیام بنویسی.";
const idlePreview="شروع کن: ایده‌ات رو در چت بنویس.";
const CHARACTER_KEY="whoush-character";
/** The composer's compact tool buttons beside «+» (emoji, GIF): 36px to the eye, 44px touch targets. */
const COMPOSER_TOOL="hit-area flex size-9 shrink-0 items-center justify-center rounded-control text-fg-secondary motion-hover hover:bg-surface-hover hover:text-fg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

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
 // The aspect ratio picked on the generation card (null: Whoush's, from the brief or «بوم»).
 const [aspectChoice,setAspectChoice]=useState<string|null>(null);
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
 /**
  * The preview panel: hidden while there is no preview (the chat takes the whole width), opened when a generation starts or a project with one opens. The user
  * can minimize it; then a button at the top of the chat, and every preview card in the chat, opens it again.
  */
 const [previewOpen,setPreviewOpen]=useState(false);
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
 /** Everything for the next message, shown as cards inside the chat input: «+» cards in place (filled ones show their file), then dropped or pasted files. */
 const cards=composerCards(slots,attachments);
 const promptRef=useRef<MentionEditorHandle>(null);
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
 const conversation=uniqueById([...messages.flatMap(m=>m.attachments??[]),...attachments]);
 /** While a turn runs: the real stage the server reports, in the script of the user's message. Shown at once as «هووش داره کار می‌کنه». */
 const [thinking,setThinking]=useState<{stage:TurnStage;script:"fa"|"finglish"}|null>(null);
 /** Agent messages that arrived in this session: their text types out once. */
 const [fresh,setFresh]=useState<ReadonlySet<string>>(()=>new Set());
 /** The live generation's scene as the user arranged it in «بوم» (only while it differs from Whoush's): «بساز» builds exactly this scene. */
 const [sceneEdit,setSceneEdit]=useState<{id:string;staging:Staging;aspect:string}|null>(null);
 /** Arranged scenes on older generations (their quotes expired): their card offers «این صحنه رو بساز», a revision turn with exactly that scene. */
 const [pastEdits,setPastEdits]=useState<Record<string,{staging:Staging;aspect:string}>>({});
 /** For the «۶ دقیقه پیش» under each message. */
 const now=useNow();
 const markFresh=(...ids:string[])=>setFresh(f=>new Set([...f,...ids]));
 /** An agent message from this turn: it types out once when it appears. */
 const agentItem=(m:Parameters<typeof item>[0])=>{const it=item(m);markFresh(it.id);return it;};
 const byTag=new Map(conversation.map(a=>[a.tag,a]));
 /** The generations of this chat by tag (#تولید-۱ ...): every proposal is one. Only these can be referenced from this chat. */
 const generationMap=new Map(messages.flatMap(m=>m.kind==="proposal"&&m.snapshot.tag?[[m.snapshot.tag,m.snapshot as ProposalSnapshot&{tag:string}] as const]:[]));
 const generationSet=new Set(generationMap.keys());
 // The latest scene («بوم» of the newest generation, as the user arranged it): its props and lights can be named in the chat (#زن, #نور-۱).
 const sceneMsg=[...messages].reverse().find(m=>m.kind==="proposal"&&m.snapshot.plan?.staging);
 const scene=sceneMsg&&sceneMsg.kind==="proposal"?(sceneEdit?.id===sceneMsg.id?sceneEdit.staging:sceneMsg.snapshot.plan.staging):undefined;
 const sceneGen=sceneMsg&&sceneMsg.kind==="proposal"&&sceneMsg.snapshot.tag?" · "+displayTag(sceneMsg.snapshot.tag):"";
 const mentionOptions:MentionOption[]=[...conversation.map(attachmentOption),...[...generationMap.values()].map(g=>({id:"gen-"+g.tag,tag:g.tag,badgeFa:"تولید",captionFa:g.intentSummaryFa})),
  ...(scene?.props?propTags(scene.props).map((t,i)=>({id:"prop-"+i,tag:t,badgeFa:"پراپ",captionFa:scene.props![i].label+sceneGen})):[]),
  ...(scene?lightTags(scene.lights).map((t,i)=>({id:"light-"+i,tag:t,badgeFa:"نور",captionFa:LIGHT_SOURCE_FA[scene.lights[i].source]+sceneGen})):[])];
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
  setMessages([]);setProposal(null);setLiveId(null);setJob(null);setPreviewOpen(false);
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
   setProjectId(p.id);setLocal({mode:p.mode,style:p.style});setMessages(withGenerationTags(restored));
   const lastJob=[...restored].reverse().find(m=>m.kind==="job");
   if(lastJob?.kind==="job"){setJob(lastJob.snapshot);setPreview(lastJob.snapshot.messageFa);setPreviewOpen(true);}
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
 useEffect(()=>{endRef.current?.scrollIntoView({block:"end"});},[messages,proposal,error,thinking?.stage]);
 const blobFor=(id:string)=>blobs.current.get(id);
 /** Opens the viewer on one attachment, with every attachment of this conversation (sent messages first, then the tray) to step through. */
 function openViewer(a:LocalAttachment){
  const items:ViewerItem[]=conversation.map(c=>({id:c.id,kind:c.kind,mime:c.mime,bytes:c.bytes,name:c.name,tag:c.tag,role:c.role,width:c.width,height:c.height,durationSeconds:c.durationSeconds,url:c.previewUrl,blob:blobFor(c.id)}));
  const index=items.findIndex(i=>i.id===a.id);
  if(index>=0)setViewer({items,index,title:active.current?.title});
 }
 function releaseUrl(a:LocalAttachment){if(a.previewUrl){URL.revokeObjectURL(a.previewUrl);urls.current.delete(a.previewUrl);}}
 /** Verifies the picked files one by one; the good ones join the tray, each rejected one gets its own Persian reason. Returns how many were added. */
 async function addFiles(files:File[],upload?:Upload,reservedTag?:string):Promise<LocalAttachment[]>{
  if(!files.length||readingRef.current)return [];
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
    // Otherwise the lowest free number of the kind: a number freed by a removal is used again, one used in a sent message never is.
    const tag=reservedTag&&!added.length?reservedTag:lowestFreeTag([...tagsInUse(messages.flatMap(m=>m.attachments??[]),slots),...next.map(x=>x.tag)],read.kind);
    if(!tag){if(read.previewUrl)URL.revokeObjectURL(read.previewUrl);fail(ATTACHMENT_ERRORS_FA.tagsExhausted);continue;}
    tagCounters.current=bumpTagCounters(tagCounters.current,tag);
    const tagged1:LocalAttachment={...read,tag},a=upload?.role?withRole(tagged1,upload.role):tagged1;
    if(a.previewUrl)urls.current.add(a.previewUrl);
    blobs.current.set(a.id,file);
    next.push(a);added.push(a);
   }catch(err){fail(err instanceof Error?err.message:ATTACHMENT_ERRORS_FA.unreadable);}
  }
  setAttachments(cur=>[...cur,...added]);setProblems(bad);
  setAnnounce((added.length?fa(added.length)+" فایل اضافه شد. ":"")+(bad.length?fa(bad.length)+" فایل رد شد.":""));
  readingRef.current=false;setReading(false);
  return added;
 }
 /** Fills an upload card with one file (picked or dropped). The card stays in place and shows the file; a rejected file leaves it empty for another try. */
 async function fillSlot(slot:UploadSlot,files:File[]){
  const [a]=await addFiles(files.slice(0,1),slot.upload,slot.tag);
  if(a)setSlots(list=>fillSlotWith(list,slot.id,a.id));
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
  setAttachments(list=>list.filter(x=>x.id!==id));setSlots(list=>forgetAttachment(list,id));
 }
 function patchAttachment(id:string,patch:AttachmentPatch){setAttachments(list=>list.map(x=>x.id!==id?x:patch.role===null?withoutRole(x):patch.role?withRole(x,patch.role):{...x,...(patch.speech?{speech:patch.speech}:{})}));}
 /** Puts the tag (`#تصویر-۱`) into the prompt as a badge at the caret (at the end when the prompt is not focused), with focus in the prompt after it. */
 function mentionTag(tag:string){promptRef.current?.insertTag(tag);}
 /**
  * A generation card's tag (#تولید-۱): puts it into the prompt as a dismissable badge, where the user writes the changes. The mention is what
  * sends the generation to the planner (at most MAX_GENERATION_REFS per message).
  */
 function changeGeneration(tag:string){
  if(!generationSet.has(tag))return;
  if(parseMentions(draft).filter(t=>generationSet.has(t)).length>=MAX_GENERATION_REFS&&!parseMentions(draft).includes(tag))return;
  if(!parseMentions(draft).includes(tag))mentionTag(tag);else promptRef.current?.focus();
  setAnnounce(displayTag(tag)+" به پیام اضافه شد؛ تغییرها را بنویس.");
 }
 /**
  * «این صحنه رو بساز» on an older generation (its quote expired): sends a message naming it and listing what changed in «بوم», with the arranged scene as
  * structured data the server applies exactly; Whoush answers with a revised plan and a fresh quote.
  */
 function buildScene(id:string,tag:string,before:Staging,beforeAspect:string|undefined){
  const e=pastEdits[id];if(!e)return;
  const lines=describeStagingChangesFa(before,e.staging,beforeAspect,e.aspect);
  if(!lines.length)return;
  const text=displayTag(tag)+" رو با این صحنه بساز:\n"+lines.map(l=>"• "+l).join("\n");
  setPastEdits(p=>{const n={...p};delete n[id];return n;});
  void runTurn(text.slice(0,4000),[],[],false,undefined,{stagingOverride:{...e.staging,subject:e.staging.subject??"person"},...(e.aspect&&e.aspect!==beforeAspect?{aspectOverride:e.aspect}:{})});
 }
 /** Toggles a Slack-style reaction on a message (the user's from the palette or a chip; Whoush's from its reply). */
 function react(id:string,emoji:ReactionEmoji,by:"user"|"whoush"){
  setMessages(ms=>ms.map(x=>x.id!==id?x:{...x,reactions:toggleReaction(x.reactions,emoji,by)}));touch();
 }
 /** Sends a GIF from the picker as the user's own message. It stays in the chat and in what Whoush remembers, but it is not a brief: no plan is made for it. */
 function sendGif(gif:GifSnapshot){
  setMessages(m=>[...m,item({role:"user",text:"",kind:"gif",snapshot:gif})]);touch();
  setAnnounce("گیف فرستاده شد.");
 }
 /** Scrolls to a generation's card in the conversation and moves focus to it. */
 function showGeneration(tag:string){
  const el=document.querySelector<HTMLElement>('[data-generation="'+CSS.escape(tag)+'"]');
  if(!el)return;
  el.scrollIntoView({block:"center",behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});
  el.querySelector<HTMLElement>("button")?.focus({preventScroll:true});
 }
 /** A + menu entry adds an empty upload card (title and icon) inside the chat input and moves focus to it; «کاراکترهای من» opens the saved-character dialog. */
 /** Adds an upload card to the chat input (with its tag reserved), or reports why it cannot; returns the card as added. */
 function createSlot(slot:UploadSlot):UploadSlot|undefined{
  const r=addSlot(slots,slot,attachments.length);
  if(r.full){setProblems([{key:crypto.randomUUID(),name:slot.titleFa,message:SLOTS_FULL_FA}]);return undefined;}
  // Reserve the tag now so the card can show it (#تصویر-۱) before the upload; the automatic card gets its tag when its file arrives.
  let added=slot;
  if(slot.upload){
   const t=reserveSlotTag(tagsInUse(conversation,slots),slot.upload);
   if(!t){setProblems([{key:crypto.randomUUID(),name:slot.titleFa,message:ATTACHMENT_ERRORS_FA.tagsExhausted}]);return undefined;}
   tagCounters.current=bumpTagCounters(tagCounters.current,t);added={...slot,tag:t};r.slots[r.slots.length-1]=added;
  }
  setSlots(r.slots);setAnnounce("کارت آپلود "+slot.titleFa+" اضافه شد.");
  return added;
 }
 /**
  * Whoush asked for photos (a reference request): each angle's «آپلود» makes (or reuses) its card in the chat input, with the role Whoush chose, and opens
  * the file picker for it; the card in the conversation shows which angles are in.
  */
 function uploadForRequest(messageId:string,req:ReferenceRequest,angle:{id:string;titleFa:string}){
  const id="ref-"+messageId+"-"+angle.id,existing=slots.find(s=>s.id===id);
  const slot=existing??createSlot({id,titleFa:angle.titleFa,icon:"reference_image",upload:{kind:"image",role:req.role}});
  if(slot)openSlotPicker(slot);
 }
 function pickInsert(item:InsertItem){
  const slot=slotFor(item,crypto.randomUUID());
  if(!slot){setCharactersOpen(true);return;}
  if(!createSlot(slot))return;
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
 /** The user message Whoush's latest message asked about, when that message is a question still waiting for its answer. */
 function questionAwaitingAnswer(){
  const lastMsg=messages[messages.length-1];
  return lastMsg?.kind==="question"?rerunSource(messages,lastMsg.id):undefined;
 }
 function send(e:FormEvent){
  e.preventDefault();const text=draft.trim();if(!text)return;
  answer(text);
 }
 /** Sends `text`; an answer to Whoush's question goes with the original request (and its files), so the planner sees the whole brief and decides instead of asking again. */
 function answer(text:string){
  const asked=questionAwaitingAnswer();
  void runTurn(text,asked?[...(asked.attachments??[]).filter(a=>!attachments.some(x=>x.id===a.id)),...attachments]:attachments,[],true,asked?answerBrief(asked.brief??asked.text,text):undefined);
 }
 /** «اجرای دوباره» under a message: sends that user message (or the one an agent message answered) again as a new turn, with its files and today's settings. */
 function rerun(id:string){
  const source=rerunSource(messages,id);
  if(source)void runTurn(source.text,source.attachments??[],source.generationTags??[],false,source.brief);
 }
 /**
  * One turn: a user message with `files` and the generations it asks to change (`changes`, the «اصلاح» cards) goes to the agent, with every generation of this
  * chat it mentions (#تولید-۱). From the composer (`fromComposer`) the draft, cards and tray clear; a rerun leaves them alone. `brief` is what is sent when the
  * message answers Whoush's question (the original request plus the answer); the transcript keeps the answer as typed.
  */
 async function runTurn(text:string,files:LocalAttachment[],changes:string[],fromComposer:boolean,brief?:string,scene?:{stagingOverride:Staging;aspectOverride?:string}){
  if(!text||busy||reading||loadingProject)return;
  if(messages.length>=MAX_MESSAGES-4){setError(LIMIT_FA);return;}
  // This message's own files plus any earlier file it mentions as #تصویر-۱ or @image1 (metadata only, as before).
  const sentText=brief??text,mentioned=parseMentions(sentText),own=new Set(files.map(a=>a.id));
  const outgoing=uniqueById([...messages.flatMap(m=>m.attachments??[]).filter(a=>mentioned.includes(a.tag)&&!own.has(a.id)),...files]);
  const refs=referencedGenerations(changes,mentioned,generationSet),cardRefs=changes.filter(t=>generationSet.has(t));
  const generations=refs.flatMap(t=>{const g=generationMap.get(t);return g?[toGenerationRef(g)]:[];});
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
  const sent=files,firstText=messages.find(m=>m.role==="user")?.text??text,characterId=current?.id??null;
  if(fromComposer){setDraft("");setAttachments([]);setSlots([]);setProblems([]);}
  setError("");setNotice("");setBusy(true);setProposal(null);setLiveId(null);setAnnounce("");
  const userMsg=item({role:"user",text,...(sent.length?{attachments:sent}:{}),...(cardRefs.length?{generationTags:cardRefs}:{}),...(brief?{brief}:{})});
  setMessages(m=>[...m,userMsg]);touch();
  // Whoush's emoji reaction lands on this message (Slack-style), when it chose one.
  const whoushReacts=(emoji?:ReactionEmoji)=>{if(emoji)react(userMsg.id,emoji,"whoush");};
  const characterRef=current?{id:current.id,name:current.name,angles:characterCoverage(current.references).uploaded,version:current.version}:undefined;
  try{
   setThinking({stage:"reading",script:replyScriptFor(sentText)});
   const r=await postAgentTurn(JSON.stringify({text:sentText,...(brief?{answersQuestion:true}:{}),...(messages.length?{history:historyFor(messages)}:{}),...(scene?{stagingOverride:scene.stagingOverride,...(scene.aspectOverride?{aspectOverride:scene.aspectOverride}:{})}:{}),preference:mode,...(style?{style}:{}),...(characterRef&&characterRef.angles.length>0?{characterRef}:{}),...(outgoing.length?{attachments:outgoing.map(toWireAttachment)}:{}),...(generations.length?{generations}:{})}),stage=>setThinking(t=>t&&{...t,stage}));
   if(!r.ok){
    const errorBody=await r.json().catch(()=>({})) as {error?:string;message?:string;question?:string;reaction?:ReactionEmoji;plan?:AgentProposal["plan"];references?:unknown};
    if(r.status===422&&errorBody.error==="no_compatible_model"){
     const message=typeof errorBody.message==="string"?errorBody.message:"مدل سازگاری برای این درخواست پیدا نشد.";
     setMessages(m=>[...m,agentItem({role:"agent",text:message,kind:"no_model",snapshot:{message,...(errorBody.plan?{plan:errorBody.plan}:{})}})]);setPreview("مدل سازگار پیدا نشد");
     adoptProject(firstText,characterId);
     return;
    }
    if(r.status===422&&errorBody.error==="needs_input"&&typeof errorBody.question==="string"){
     const references=isReferenceRequest(errorBody.references)?errorBody.references:undefined;
     setMessages(m=>[...m,agentItem({role:"agent",text:typeof errorBody.message==="string"?errorBody.message:"",kind:"question",snapshot:{question:errorBody.question!,...(references?{references}:{})}})]);whoushReacts(errorBody.reaction);
     adoptProject(firstText,characterId);
     return;
    }
    if(r.status===422&&errorBody.error==="content_restricted"){
     setMessages(m=>[...m,agentItem({role:"agent",text:typeof errorBody.message==="string"?errorBody.message:"این درخواست را نمی‌توانم انجام بدهم.",kind:"restricted"})]);
     adoptProject(firstText,characterId);
     return;
    }
    throw new Error(typeof errorBody.message==="string"?errorBody.message:"خطا در آماده‌سازی پیشنهاد");
   }
   const data=await r.json() as AgentProposal&{message:string;gif?:GifSnapshot;reaction?:ReactionEmoji};
   const picked=data.suggestions.find(s=>s.modelId===data.recommendedModelId)??data.suggestions[0];
   const tag=nextGenerationTag(generationTagsIn(messages));
   // A follow-up about one part of the scene (the camera angle, the light...): «بوم» opens on just that part. The previous scene is the generation the
   // message names, else the latest one in this chat.
   const named=mentioned.find(t=>generationSet.has(t)),prevSnap=named?generationMap.get(named):[...messages].reverse().find(m=>m.kind==="proposal")?.snapshot as ProposalSnapshot|undefined;
   const focus=followUpFocus(normalizePersian(sentText),prevSnap?.plan.staging,data.plan.staging);
   const reply=agentItem({role:"agent",text:data.message,kind:"proposal",snapshot:{...(tag?{tag}:{}),...(focus?{focus}:{}),operation:data.operation,modelName:picked?.name??"",neurons:picked?.neurons??data.fixedNeurons,intentSummaryFa:data.plan.intentSummaryFa,plan:data.plan}});
   setProposal(data);setLiveId(reply.id);setSelected(data.selectedModelId);setAspectChoice(null);setPreview("در انتظار تأیید تولید");setJob(null);
   // Like a friend: the reply, then (sometimes) a GIF as its own message.
   setMessages(m=>[...m,reply,...(data.gif?[agentItem({role:"agent",text:"",kind:"gif",snapshot:data.gif})]:[])]);whoushReacts(data.reaction);
   adoptProject(firstText,characterId);
  }catch(err){setError(err instanceof Error?err.message:"خطای ناشناخته");}
  finally{setBusy(false);setThinking(null);}
 }
 async function approve(){
  if(!proposal||busy)return;setBusy(true);setError("");
  try{
   const turnId=proposal.turnId;
   if(!turnId)throw new Error("پیشنهاد منقضی شده است؛ دوباره درخواستت را بفرست.");
   const post=(url:string,body:unknown)=>fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
   // The canvas is the source of truth: an arranged scene goes with the quote (the server applies it to this turn's private plan), and the frame's aspect
   // ratio goes as the model's real aspect-ratio setting, so the output frame matches the canvas exactly where the model supports it.
   const live=messages.find(m=>m.id===liveId),edit=sceneEdit&&sceneEdit.id===liveId?sceneEdit:null;
   const planAspect=live?.kind==="proposal"?live.snapshot.plan.camera?.aspectRatio:undefined,wanted=aspectChoice??edit?.aspect??planAspect;
   // A ratio this model lacks snaps to the nearest one it offers (4:5 → 3:4), never to the model's square default.
   const offered=proposal.suggestions.find(s=>s.modelId===selected)?.aspectRatios,aspect=offered?.length?nearestAspectRatio(wanted,offered)??wanted:wanted;
   const quoteBody={modelId:selected,turnId,...(edit?{stagingOverride:edit.staging,...(edit.aspect!==planAspect?{aspectOverride:edit.aspect}:{})}:{})};
   let q=await post("/api/generation/quote",{...quoteBody,...(aspect?{configuration:{aspectRatio:aspect}}:{})});
   if(q.status===422&&aspect)q=await post("/api/generation/quote",quoteBody); // last resort if the ratio is still refused (invalid_configuration): the prompt still carries it
   if(!q.ok){
    // A refusal that says why (a photo edit that changes the camera and the light together; a prop hiding the subject) is shown as is.
    const why=await q.json().then((b:{error?:string;message?:string})=>b.error==="edit_scope_mixed"||b.error==="composition_occluded"?b.message:undefined).catch(()=>undefined);
    throw new Error(why??(q.status===410?"پیشنهاد منقضی شده است؛ دوباره درخواستت را بفرست.":"مشکل در محاسبه هزینه"));
   }
   const quote=await q.json() as {token:string};
   const execution=await post("/api/generation/execute",{token:quote.token,approved:true,idempotencyKey:crypto.randomUUID()});
   if(!execution.ok)throw new Error("خطا در شروع تولید");
   let current=await execution.json() as {id:string;state:string;messageFa:string;outputs?:JobView["outputs"]};
   const done=["completed","completed_demo","failed","canceled","released"];
   const genTag=liveId?(messages.find(m=>m.id===liveId)?.snapshot as ProposalSnapshot|undefined)?.tag:undefined,tagged=genTag?{tag:genTag}:{};
   setPreview(current.messageFa);setJob({state:current.state,messageFa:current.messageFa,outputs:current.outputs,...tagged});setPreviewOpen(true);
   for(let i=0;i<10&&!done.includes(current.state);i++){
    await new Promise(r=>setTimeout(r,1500));
    const poll=await fetch("/api/generation/jobs/"+current.id,{cache:"no-store"});if(!poll.ok)break;
    current=await poll.json();setPreview(current.messageFa);setJob({state:current.state,messageFa:current.messageFa,outputs:current.outputs,...tagged});
   }
   setMessages(m=>[...m,item({role:"agent",text:current.messageFa,kind:"job",snapshot:{state:current.state,messageFa:current.messageFa,...(genTag?{tag:genTag}:{})}})]);setProposal(null);setLiveId(null);touch();
  }catch(err){setError(err instanceof Error?err.message:"خطای ناشناخته");}
  finally{setBusy(false);}
 }
 /** A focus saved before the camera was split into angle, distance and lens («camera»): read again from the user's words when they name the part. */
 function refineFocus(focus:string[]|undefined,userText:string|undefined){
  if(!focus?.includes("camera")||!userText)return focus;
  const words=sectionsFromWords(normalizePersian(userText));
  return words.length?words:focus;
 }
 /** Whether there is a preview to show: a generation has started (or the opened project has one). */
 const hasPreview=job!==null;
 const showPreview=hasPreview&&previewOpen;
 /** Opens the preview panel, on a given generation's job when a preview card asks (the latest job keeps its live outputs). */
 function openPreview(snapshot?:{state:string;messageFa:string;tag?:string}){
  if(snapshot&&snapshot.messageFa!==job?.messageFa){setJob({state:snapshot.state,messageFa:snapshot.messageFa,...(snapshot.tag?{tag:snapshot.tag}:{})});setPreview(snapshot.messageFa);}
  setPreviewOpen(true);
 }
 function minimizePreview(){setPreviewOpen(false);requestAnimationFrame(()=>promptRef.current?.focus());}
 return <RailShell current="studio" activeProjectId={projectId} onNewChat={newChat} onProjectDeleted={onProjectDeleted}>
  {/* Desktop: the preview (centre) and the chat (end side) share the row; the preview grows in and out (flex-grow transition) and, while it is closed, the chat
      takes the whole width. Mobile: one at a time; the preview covers the chat until minimized. */}
  <main id="main" className="flex min-h-0 flex-1 flex-col md:flex-row">
   <h1 className="sr-only">استودیوی هووش</h1>
   {/* Centre: preview */}
   <section aria-label="پیش‌نمایش" inert={!showPreview||undefined} aria-hidden={!showPreview||undefined}
    className={(showPreview?"flex":"hidden")+" min-h-0 flex-1 flex-col md:flex md:min-w-0 md:basis-0 md:overflow-hidden md:transition-[flex-grow,opacity] md:duration-300 md:ease-out motion-reduce:transition-none "+(showPreview?"md:grow md:opacity-100":"md:grow-0 md:opacity-0")}>
    <Tabs value={activeTab} onValueChange={v=>setActiveTab(v as "generations"|"cuts")} className="min-h-0 flex-1 gap-0">
     <div className="flex items-center justify-between gap-4 border-b border-line-tertiary px-4 py-2 lg:px-6">
      <TabsList><TabsTrigger value="generations">تولیدها</TabsTrigger><TabsTrigger value="cuts">تدوین</TabsTrigger></TabsList>
      <div className="flex items-center gap-2">
       <Badge variant="outline">نسخه نمایشی</Badge>
       <Tooltip><TooltipTrigger render={<Button type="button" variant="ghost" size="icon" aria-label="کوچک کردن پیش‌نمایش" onClick={minimizePreview}/>}><Icon icon={Minimize2} aria-hidden="true"/></TooltipTrigger><TooltipContent side="bottom">کوچک کردن پیش‌نمایش</TooltipContent></Tooltip>
      </div>
     </div>
     <ScrollArea className="min-h-0 flex-1">
      <div className="flex flex-col gap-8 p-4 lg:p-6">
       <TabsContent value="generations" className="flex flex-col gap-8">
        {/* The generation box: live status, estimated progress and the generating gradient inside it; no separate step list. */}
        {job
         ?<GenerationPreview job={job} kind={job.tag?generationMap.get(job.tag)?.plan.mediaKind:undefined} model={job.tag?generationMap.get(job.tag)?.modelName:undefined} placeholder="خروجی تصویری واقعی هنوز فعال نیست"/>
         :<div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-card border border-line-secondary bg-surface-subtle p-8 text-center md:aspect-video">
          <Icon icon={Clapperboard} size={32} className="text-fg-secondary" aria-hidden="true"/>
          <p className="type-body text-fg-primary">{preview}</p>
         </div>}
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
   <section aria-label="دستیار هووش" className={(showPreview?"hidden md:flex":"flex")+" relative min-h-0 flex-1 flex-col border-line-tertiary md:min-w-0 md:basis-[22rem] md:transition-[flex-grow] md:duration-300 md:ease-out motion-reduce:transition-none lg:basis-[26rem] "+(showPreview?"md:grow-0 md:border-s":"md:grow")}
    onDragEnter={e=>{if(!hasFiles(e))return;e.preventDefault();dragDepth.current+=1;setDragging(true);}}
    onDragOver={e=>{if(hasFiles(e))e.preventDefault();}}
    onDragLeave={e=>{if(!hasFiles(e))return;dragDepth.current=Math.max(0,dragDepth.current-1);if(!dragDepth.current)setDragging(false);}}
    onDrop={onDrop}>
    {dragging&&<div aria-hidden="true" className="pointer-events-none absolute inset-2 z-10 flex flex-col items-center justify-center gap-2 rounded-card border border-dashed border-primary bg-surface-base/90 type-title text-fg-primary">
     <Icon icon={UploadIcon} size={32} aria-hidden="true"/>فایل‌ها را اینجا رها کن
    </div>}
    <div role="status" aria-live="polite" className="sr-only">{dragging?"فایل‌ها را اینجا رها کن":announce}</div>
    <div className="border-b border-line-tertiary px-4 py-3">
     <div className="mx-auto flex w-full max-w-3xl items-start justify-between gap-3">
     <div className="min-w-0">
      <h2 className="type-title text-fg-primary">دستیار هووش</h2>
      <p className="type-body-sm text-fg-secondary">ساخت تصویر و ویدیو با گفت‌وگو</p>
     </div>
     {/* Only while there is a preview and it is minimized: brings it back, then hides until the preview is minimized again. */}
     {hasPreview&&!showPreview&&<Button type="button" variant="outline" onClick={()=>openPreview()} className="shrink-0"><Icon icon={PanelLeftOpen} aria-hidden="true"/>{OPEN_PREVIEW_FA}</Button>}
     </div>
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
     <div aria-live="polite" aria-label="گفت‌وگو" role="log" className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
      <div className="type-body-sm text-fg-primary"><span className="sr-only">هووش: </span>{opening}</div>
      {loadingProject&&<p role="status" className="type-body-sm text-fg-secondary">در حال باز کردن پروژه…</p>}
      {/* User messages: on the right (the start in RTL), in a filled grey bubble with no border, their files and «اصلاح» generations above it as the same cards
          they were in the chat input. Agent messages: full-width plain text, then the plan as part of the conversation (icons and diagrams), then the compact card
          that carries the actions (generate, change). Each message gets the hover action bar (copy, run again, time). */}
      {messages.map((m,i)=>{
       const actions=<MessageActions text={m.text} at={m.at} now={now} onRerun={m.kind==="gif"?undefined:()=>rerun(m.id)} rerunDisabled={busy||reading||loadingProject} onReact={e=>react(m.id,e,"user")}/>;
       const reactions=<MessageReactions reactions={m.reactions} onToggle={e=>react(m.id,e,"user")}/>;
       if(m.role==="user")return <div key={m.id} className="group flex flex-col items-start gap-2">
        {((m.attachments?.length??0)>0||(m.generationTags?.length??0)>0)&&<ul aria-label="پیوست‌های این پیام" className="flex max-w-full flex-wrap gap-2">
         {(m.generationTags??[]).flatMap(t=>{const g=generationMap.get(t);return g?[<GenerationRefCard key={t} snapshot={g} onMention={()=>mentionTag(t)} onOpen={()=>showGeneration(t)}/>]:[];})}
         {(m.attachments??[]).map(a=><SentAttachmentCard key={a.id} item={a} onPreview={()=>openViewer(a)} onMention={()=>mentionTag(a.tag)}/>)}
        </ul>}
        {m.kind==="gif"
         ?<div><span className="sr-only">شما: </span><ChatGif gif={m.snapshot}/></div>
         :<div className="max-w-[85%] whitespace-pre-wrap break-words rounded-card bg-secondary px-4 py-3 type-body-sm text-fg-primary">
          <span className="sr-only">شما: </span><MessageText text={m.text} attachments={byTag} onOpen={openViewer} generations={generationSet} onGeneration={showGeneration}/>
         </div>}
        {reactions}
        <div className="-mt-1">{actions}</div>
       </div>;
       return <div key={m.id} className="group flex flex-col gap-3">
        {m.kind==="restricted"
         ?<div role="status" className="flex items-start gap-2 type-body-sm text-fg-primary">
          <Icon icon={Info} size={16} aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-fg-secondary"/>
          <p className="min-w-0 whitespace-pre-wrap break-words"><span className="sr-only">هووش: </span><span className="type-label">این درخواست قابل انجام نیست.</span> {m.text}</p>
         </div>
         :m.kind==="gif"?<div><span className="sr-only">هووش: </span><ChatGif gif={m.snapshot}/></div>
         :m.kind!=="job"&&<p className="whitespace-pre-wrap break-words type-body-sm text-fg-primary">
          <span className="sr-only">هووش: </span><TypeOut text={m.text} animate={fresh.has(m.id)}/>
         </p>}
        {m.kind==="job"&&<PreviewCard tag={m.snapshot.tag} state={m.snapshot.state} messageFa={m.snapshot.messageFa}
         output={m.snapshot.messageFa===job?.messageFa?job?.outputs?.find(o=>isOwnedOutputUrl(o.url,window.location.origin)):undefined} video={m.snapshot.tag?generationMap.get(m.snapshot.tag)?.plan.mediaKind==="video":false} onOpen={()=>openPreview(m.snapshot)}/>}
        {/* «بوم» is adjustable on every generation: on the live one it feeds «بساز» directly; on an older one its card offers a revision with that scene. */}
        {(m.kind==="proposal"||m.kind==="no_model")&&m.snapshot.plan&&<PlanStory plan={m.snapshot.plan} focus={m.kind==="proposal"?refineFocus(m.snapshot.focus,messages.slice(0,i).reverse().find(x=>x.role==="user")?.text):undefined}
         onStagingChange={m.kind==="proposal"?(s,aspect,changed)=>{
          if(proposal&&m.id===liveId)setSceneEdit(changed?{id:m.id,staging:s,aspect}:null);
          else setPastEdits(p=>{const n={...p};if(changed)n[m.id]={staging:s,aspect};else delete n[m.id];return n;});
         }:undefined}/>}
        {m.kind==="proposal"&&(proposal&&m.id===liveId
         ?<ProposalCard proposal={proposal} tag={m.snapshot.tag} adjusted={sceneEdit?.id===m.id} selected={selected} onSelect={setSelected}
          aspect={aspectChoice??(sceneEdit?.id===m.id?sceneEdit.aspect:undefined)??m.snapshot.plan.camera?.aspectRatio} onAspect={setAspectChoice} busy={busy} onApprove={()=>void approve()} onMention={m.snapshot.tag?()=>changeGeneration(m.snapshot.tag!):undefined}/>
         :<PastProposalCard snapshot={m.snapshot} adjusted={Boolean(pastEdits[m.id])} busy={busy||reading||loadingProject}
          onBuildScene={pastEdits[m.id]&&m.snapshot.tag&&m.snapshot.plan.staging?()=>buildScene(m.id,m.snapshot.tag!,m.snapshot.plan.staging!,m.snapshot.plan.camera?.aspectRatio):undefined} onMention={m.snapshot.tag?()=>changeGeneration(m.snapshot.tag!):undefined}/>)}
        {m.kind==="no_model"&&<NoModelCard result={m.snapshot}/>}
        {/* The question is always the last item of the agent's message; it waits for an answer until something is sent after it. */}
        {m.kind==="question"&&<AgentQuestion question={m.snapshot.question} waiting={i===messages.length-1&&!busy} onAnswer={()=>promptRef.current?.focus()}
         references={m.snapshot.references} uploaded={m.snapshot.references?Object.fromEntries(m.snapshot.references.angles.map(a=>[a.id,Boolean(slots.find(s=>s.id==="ref-"+m.id+"-"+a.id)?.attachmentId)])):undefined}
         onUpload={m.snapshot.references?a=>uploadForRequest(m.id,m.snapshot.references!,a):undefined}
         onContinue={m.snapshot.references&&i===messages.length-1&&!busy?()=>answer(replyScriptFor(m.text)==="finglish"?"aksa ro gozashtam":"عکس‌ها رو گذاشتم"):undefined}/>}
        {(m.kind==="proposal"||m.kind==="no_model")&&m.snapshot.plan?.clarifyingQuestionFa&&<AgentQuestion question={m.snapshot.plan.clarifyingQuestionFa} waiting={i===messages.length-1&&!busy} onAnswer={()=>promptRef.current?.focus()}/>}
        {reactions}
        <div className="-mt-2">{actions}</div>
       </div>;
      })}
      {thinking&&<ThinkingRow text={STAGE_TEXT[thinking.script][thinking.stage]}/>}
      <div ref={endRef}/>
     </div>
    </ScrollArea>
    {error&&<div className="mx-auto w-full max-w-3xl px-4 pb-2"><Alert variant="destructive" role="alert">
     <Icon icon={CircleAlert} aria-hidden="true"/>
     <AlertTitle>خطا</AlertTitle>
     <AlertDescription>{error}</AlertDescription>
    </Alert></div>}
    {/* The chip tray and the composer scroll together under the chat, so on a short screen the prompt and the send button stay reachable. */}
    <div className="flex max-h-[64dvh] min-h-0 shrink-0 flex-col overflow-y-auto border-t border-line-tertiary bg-surface-base">
    <form ref={formRef} onSubmit={e=>void send(e)} className="mx-auto flex w-full max-w-3xl shrink-0 flex-col gap-3 bg-surface-base p-4">
     <AttachmentTray items={attachments} cards={cards.length} problems={problems} reading={reading} onDismiss={key=>setProblems(list=>list.filter(p=>p.key!==key))}/>
     <input ref={fileInput} type="file" multiple hidden accept={ATTACHMENT_ACCEPT} data-testid="attachment-input" onChange={e=>{const files=Array.from(e.target.files??[]),upload=pendingUpload.current,slot=pendingSlot.current;pendingUpload.current=undefined;pendingSlot.current=undefined;e.target.value="";e.target.multiple=true;const card=slot?slots.find(x=>x.id===slot):undefined;if(card)void fillSlot(card,files);else void addFiles(files,upload);}}/>
     <Label className="sr-only" id="whoush-prompt-label">توضیح تصویر یا ویدیو</Label>
     <MentionTextarea id="whoush-prompt" handleRef={promptRef} value={draft} onValueChange={setDraft} options={mentionOptions} onPaste={onPaste} placeholder="چی می‌خوای بسازیم؟" labelledBy="whoush-prompt-label" describedBy="prompt-hint" maxLength={4000}
      onSubmitShortcut={()=>{if(draft.trim()&&!busy&&!reading)formRef.current?.requestSubmit();}}
      startPad="ps-32"
      startAction={<div className="flex items-center">
       <InsertMenu disabled={reading} onPick={pickInsert}/>
       <EmojiPalette emojis={COMPOSER_EMOJIS} label="ایموجی" onPick={e=>promptRef.current?.insertText(e)}
        trigger={<button type="button" aria-label="ایموجی" title="ایموجی" className={COMPOSER_TOOL}><Icon icon={Smile} aria-hidden="true"/></button>}/>
       <GifPicker onPick={sendGif} trigger={<button type="button" aria-label="فرستادن گیف" title="گیف" className={COMPOSER_TOOL+" type-label"}>GIF</button>}/>
      </div>}
      top={cards.length>0?<ul aria-label="پیوست‌ها" className="flex items-stretch gap-2 overflow-x-auto pb-2 [scrollbar-width:thin]">
       {cards.map(c=>c.type==="slot"
        ?<UploadSlotCard key={c.slot.id} slot={c.slot} disabled={reading} onUpload={()=>openSlotPicker(c.slot)} onDropFiles={f=>void fillSlot(c.slot,f)} onRemove={()=>dropSlot(c.slot.id)}/>
        :<AttachmentCard key={c.attachment.id} item={c.attachment} onChange={patch=>patchAttachment(c.attachment.id,patch)} onRemove={()=>removeAttachment(c.attachment.id)} onPreview={()=>openViewer(c.attachment)} onMention={()=>mentionTag(c.attachment.tag)}/>)}
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
