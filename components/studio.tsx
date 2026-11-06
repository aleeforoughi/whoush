"use client";
import {useEffect,useRef,useState,type ClipboardEvent,type DragEvent,type FormEvent} from "react";
import Link from "next/link";
import {useRouter,useSearchParams} from "next/navigation";
import {ArrowUp,ChevronLeft,CircleAlert,Clapperboard,Eye,Hash,Info,LoaderCircle,MessageCircle,Mic,Smile,Sparkles,Star,Upload as UploadIcon,UserRound,X} from "lucide-react";
import {Alert,AlertDescription,AlertTitle,Badge,Button,Icon,ScrollArea,Tabs,TabsContent,TabsList,TabsTrigger,Label,Tooltip,TooltipContent,TooltipTrigger} from "@aleeforoughi/feather-react";
import {BACK_TO_CHAT_FA,CLOSE_PREVIEW_FA,OPEN_PREVIEW_FA,PreviewCard} from "@/components/preview-card";
import {ChatEmpty} from "@/components/chat-empty";
import {GalleryThumbs,GenerationGallery,galleryFocusOn,type GalleryFocus,type GalleryItem} from "@/components/generation-gallery";
import {isFinalJobState,isOwnedOutputUrl} from "@/lib/job-progress";
import {followJobUntilDone,jobSnapshot,UNTRACKED_JOB_FA} from "@/lib/job-follow";
import {NoModelCard,PastProposalCard,ProposalCard,noModelTitle} from "@/components/proposal-card";
import {CharacterDialog} from "@/components/character-dialog";
import {InsertMenu} from "@/components/insert-menu";
import {VoiceMode} from "@/components/voice-mode";
import {UploadSlotCard} from "@/components/upload-slot";
import {SLOTS_FULL_FA,addSlot,composerCards,fillSlotWith,forgetAttachment,removeSlot,reserveSlotTag,slotFor,tagsInUse,uploadRejection,type Upload,type UploadSlot} from "@/lib/upload-slots";
import {AttachmentCard,MentionRefCard,SentAttachmentCard} from "@/components/attachment-card";
import {MessageActions,useNow} from "@/components/message-actions";
import {ModeControl,SEND_TONE,useMode} from "@/components/mode-control";
import {StyleControl,useStyleSetting} from "@/components/style-control";
import type {AttachmentPatch} from "@/components/attachment-chip";
import {MediaViewer,type ViewerItem} from "@/components/media-viewer";
import {MentionTextarea,attachmentOption,type MentionEditorHandle,type MentionOption} from "@/components/mention-textarea";
import {GenerationRefCard} from "@/components/generation-ref-card";
import {AgentQuestion,PlanStory,RegionChip} from "@/components/plan-details";
import {MessageText} from "@/components/message-text";
import {AttachmentTray,type AttachmentProblem} from "@/components/attachment-tray";
import {RailShell} from "@/components/studio-rail";
import type {AgentProposal,JobView,NoModelResult} from "@/lib/studio-types";
import {getLocalCharacter,listLocalCharacters} from "@/lib/character-store";
import {characterCoverage,characterUsability,type CharacterProfile} from "@/lib/characters";
import {fa,faBytes,faDimensions,faDuration} from "@/lib/format";
import {REVIEW_FAILED_FA,WAITING_FA,photoReviewEnabled,reviewPhoto,reviewStopFa,type PhotoReview} from "@/lib/photo-review";
import {PhotoReviewOverlay,ReviewRing} from "@/components/photo-review-badge";
import {RegionEditor} from "@/components/region-editor";
import {renderGuide,type Region} from "@/lib/region-edit";
import type {SuggestedEdit} from "@/lib/edit-card";
import {STORAGE_FULL_FA,getProject,listAssets,saveAsset,saveProject} from "@/lib/project-store";
import {MAX_MESSAGES,assetToAttachment,attachmentToAsset,autoTitle,rerunSource,uniqueById,answerBrief,historyFor,toggleReaction,generationTagsIn,referencedGenerations,toGenerationRef,withGenerationTags,type GifSnapshot,type ProposalSnapshot,type JobSnapshot,type Project,type StoredMessage} from "@/lib/projects";
import {MAX_GENERATION_REFS,type ReactionEmoji,type Staging} from "@/lib/creative-plan";
import {LIGHT_SOURCE_FA,describeStagingChangesFa,followUpFocus,lightTags,propTags,sectionsFromWords} from "@/lib/staging";
import {normalizePersian} from "@/lib/safety";
import {isReferenceRequest,type ReferenceRequest} from "@/lib/reference-needs";
import {isQuestionChoices} from "@/lib/media-intent";
import {MAIN_SUBJECT_FA,shownTag} from "@/lib/main-subject";
import {PLAN_FIRST_FA,STAGE_DONE_TEXT,STAGE_TEXT,postAgentTurn} from "@/lib/agent-stream";
import type {TurnStage} from "@/lib/orchestrator-stages";
import {replyScriptFor} from "@/lib/finglish";
import {TurnProgress,TypeOut} from "@/components/type-out";
import {ChatGif} from "@/components/chat-gif";
import {COMPOSER_EMOJIS,EmojiPalette} from "@/components/emoji-palette";
import {GifPicker} from "@/components/gif-picker";
import {TAG_PICKER_LABEL_FA,TagPicker} from "@/components/tag-picker";
import {MessageReactions} from "@/components/message-reactions";
import type {GenerationStyle} from "@/lib/creative-plan";
import {UNSUPPORTED_REASONS,type AgentPreference,type UnsupportedReason} from "@/lib/types";
import {ATTACHMENT_ACCEPT,ATTACHMENT_ERRORS_FA,MAX_ATTACHMENTS,acceptFor,roleAllowed,bumpTagCounters,displayTag,insertMention,lowestFreeTag,nextGenerationTag,newTagCounters,parseMentions,tooManyFa,toWireAttachment,validateAttachmentSet,withRole,withoutRole,type AttachmentKind,type AttachmentRole,type LocalAttachment} from "@/lib/attachments";
import {readAttachment} from "@/lib/attachment-files";
import {ATTACHMENT_KINDS,REGION_COLOR_FA,isGenerationTag,roleLabelFa,splitMentions} from "@/lib/attachments";
import type {InsertItem} from "@/lib/insert-menu";
import {nearestAspectRatio} from "@/lib/aspect";
/** The preview panel's «تدوین» (editing) tab: off for now, until editing exists. */
const EDIT_TAB_ENABLED=false;
/** Emoji and GIF buttons in the composer: off for now by owner decision (2026-11-06). */
const COMPOSER_EXTRAS_ENABLED=false;

/** A stored message plus the live attachments of its turn (object URLs, not persisted). */
type TranscriptItem=StoredMessage&{attachments?:LocalAttachment[]};
/** The project being edited. `persisted` turns true with the first successful save; the title and creation time are owned by the store once it exists. */
type ActiveProject={id:string;createdAt:string;title:string;titleSource:"auto"|"user";persisted:boolean};
const item=(m:Omit<TranscriptItem,"id"|"at">):TranscriptItem=>({...m,id:crypto.randomUUID(),at:new Date().toISOString()} as TranscriptItem);
const toStored=({attachments,...m}:TranscriptItem):StoredMessage=>({...m,...(attachments?.length?{attachmentIds:attachments.map(a=>a.id)}:{})} as StoredMessage);
const NOT_FOUND_FA="این پروژه در این مرورگر پیدا نشد؛ گفت‌وگوی تازه‌ای شروع شد.";
const LIMIT_FA="این گفت‌وگو به سقف تعداد پیام‌ها رسیده؛ یک گفت‌وگوی جدید شروع کن.";
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
 /** Which generation the preview gallery should bring into view (a chat preview card, a new generation, an opened project). */
 const [galleryFocus,setGalleryFocus]=useState<GalleryFocus|null>(null);
 /** Research references the user removed from the live proposal's package (sent with the quote; the server binds the rest). */
 const [excludedRefs,setExcludedRefs]=useState<ReadonlySet<string>>(new Set());
 /** The live proposal whose cheap draft has been made: its card then offers the video itself. */
 const [draftedFor,setDraftedFor]=useState<string|null>(null);
 /** Voice messages: offered only when the server can transcribe now (`/api/voice`); `voiceOpen` shows the full-screen voice mode. */
 const [voice,setVoice]=useState<{enabled:boolean;maxSeconds:number}>({enabled:false,maxSeconds:60}),[voiceOpen,setVoiceOpen]=useState(false);
 useEffect(()=>{let alive=true;fetch("/api/voice").then(r=>r.ok?r.json():undefined).then((v:{enabled?:boolean;maxSeconds?:number}|undefined)=>{if(alive&&v?.enabled)setVoice({enabled:true,maxSeconds:v.maxSeconds??60});}).catch(()=>undefined);return()=>{alive=false;};},[]);
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
 /** «سوژه اصلی» of the next message (optional): the tag of a file, generation or scene prop the whole work is built around (lib/main-subject.ts). */
 const [mainSubject,setMainSubject]=useState<string|null>(null);
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
 /** Whether the preview fits beside the chat (the side panel from the `md` breakpoint); on a phone it would cover the chat, so it opens only when asked. */
 const previewFits=()=>typeof window!=="undefined"&&window.matchMedia("(min-width: 768px)").matches;
 const blobs=useRef(new Map<string,Blob>());
 // The photo safety check (lib/photo-review.ts): each photo's state by attachment id, the checks still running, and the photos a sent message waits for.
 const [reviewOn,setReviewOn]=useState(false);
 const [reviews,setReviews]=useState<Record<string,PhotoReview>>({});
 const reviewsRef=useRef<Record<string,PhotoReview>>({});
 const reviewJobs=useRef(new Map<string,Promise<PhotoReview>>());
 const [waitingFor,setWaitingFor]=useState<LocalAttachment[]|null>(null);
 // «ویرایش با قلم» (lib/region-edit.ts): the photo open in the full-screen editor, and whether it came from the chat box.
 const [editing,setEditing]=useState<{a:LocalAttachment;fromTray:boolean;suggested?:readonly SuggestedEdit[]}|null>(null);
 useEffect(()=>{let alive=true;void photoReviewEnabled().then(on=>{if(alive)setReviewOn(on);});return()=>{alive=false;};},[]);
 const savedAssets=useRef(new Set<string>());
 const latest=useRef({messages,mode,style,character:null as CharacterProfile|null});
 const character=characters.find(c=>c.id===characterId)??null;
 useEffect(()=>{latest.current={messages,mode,style,character};});
 /** Every attachment of this conversation that still exists: sent messages first, then the tray. */
 const conversation=uniqueById([...messages.flatMap(m=>m.attachments??[]),...attachments]);
 /** While a turn runs: the real stage the server reports, in the script of the user's message. Shown at once as «هووش داره کار می‌کنه». */
 /** The turn in progress: its current stage and the stages already done (the expandable progress list). */
 const [thinking,setThinking]=useState<{stage:TurnStage;done:TurnStage[];script:"fa"|"finglish"}|null>(null);
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
 // Every # option carries a thumbnail (owner, 2026-11-06): the photo, the generated image, or the kind's icon.
 const genThumb=(tag:string)=>(messages.find(m=>m.kind==="job"&&m.snapshot.tag===tag)?.snapshot as {outputs?:{kind:string;url:string}[]}|undefined)?.outputs?.find(o=>o.kind==="image")?.url;
 // Last used first (owner, 2026-11-06): a #'s recency is the latest message that sent, mentioned or generated it; the chat box's own files are newest.
 const recency=new Map<string,number>();
 messages.forEach((m,i)=>{const bump=(t:string)=>recency.set(t,i);(m.attachments??[]).forEach(a=>bump(a.tag));(m.generationTags??[]).forEach(bump);
  parseMentions(m.brief??m.text).forEach(bump);if((m.kind==="proposal"||m.kind==="job")&&m.snapshot.tag)bump(m.snapshot.tag);});
 attachments.forEach((a,i)=>recency.set(a.tag,messages.length+1+i));
 const byRecency=<T extends {tag:string}>(list:readonly T[])=>list.map((x,i)=>({x,i})).sort((a,b)=>(recency.get(b.x.tag)??-1)-(recency.get(a.x.tag)??-1)||a.i-b.i).map(o=>o.x);
 // No duplicates: one entry per picture. The same file sent twice keeps its latest #; a photo copy of a generation is listed as the generation itself.
 const distinctFiles=byRecency(conversation).filter((a,i,all)=>all.findIndex(b=>b.kind===a.kind&&b.sha256===a.sha256)===i&&!(a.fromGeneration&&generationMap.has(a.fromGeneration)));
 const mentionOptions:MentionOption[]=byRecency([...distinctFiles.map(attachmentOption),...[...generationMap.values()].map(g=>{const u=genThumb(g.tag);return {id:"gen-"+g.tag,tag:g.tag,badgeFa:"تولید",captionFa:g.intentSummaryFa,thumbKind:g.plan.mediaKind==="video"?"video" as const:"image" as const,...(u?{thumbUrl:u}:{})};}),
  ...(scene?.props?propTags(scene.props).map((t,i)=>({id:"prop-"+i,tag:t,badgeFa:"پراپ",captionFa:scene.props![i].label+sceneGen,thumbKind:"prop" as const})):[]),
  ...(scene?lightTags(scene.lights).map((t,i)=>({id:"light-"+i,tag:t,badgeFa:"نور",captionFa:LIGHT_SOURCE_FA[scene.lights[i].source]+sceneGen,thumbKind:"light" as const})):[])])
  .filter((o,i,all)=>all.findIndex(x=>x.tag===o.tag)===i);
 // A # in the draft that points at a photo sent earlier or a generation shows as a card beside the new files (owner, 2026-11-06), like a reference.
 const sentFiles=uniqueById([...messages].reverse().flatMap(m=>m.attachments??[]));
 type DraftRef={tag:string;kind:AttachmentKind|"generation";thumbUrl?:string;label:string;file?:LocalAttachment};
 const draftRefs=byRecency([...new Set(parseMentions(draft))].map(tag=>({tag}))).map(x=>x.tag).filter(t=>!attachments.some(a=>a.tag===t)).flatMap((t):DraftRef[]=>{
  if(isGenerationTag(t)){const g=generationMap.get(t);return g?[{tag:t,kind:"generation" as const,thumbUrl:genThumb(t),label:"تولید · "+(g.plan.mediaKind==="video"?"ویدیو":"عکس")}]:[];}
  const a=sentFiles.find(x=>x.tag===t);return a?[{tag:t,kind:a.kind,thumbUrl:a.kind==="image"?a.previewUrl:undefined,label:"از همین گفت‌وگو",file:a}]:[];
 });
 /** Takes a # out of the draft (every spelling of it), from its card's ✕. */
 const dropMention=(tag:string)=>setDraft(d=>splitMentions(d).map(seg=>"tag" in seg?(seg.tag===tag?"":seg.raw):seg.text).join("").replace(/[ \t]{2,}/g," ").trim());
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
 /**
  * Follows one job in the background until it ends (lib/job-follow.ts), so a slow model (Seedream ~2.5 min) is not left showing «running» at 95%. The chat
  * stays usable meanwhile. Each change updates the job's transcript message (saved with the project) and the preview when it shows this job. Opening another
  * project stops it; reopening this one follows the job again.
  */
 function followJob(messageId:string,start:JobSnapshot){
  const project=active.current?.id;
  void followJobUntilDone(start,next=>{
   setMessages(m=>m.map(x=>x.id===messageId&&x.kind==="job"?{...x,text:next.messageFa,snapshot:next} as TranscriptItem:x));
   setJob(j=>j&&j.jobId===next.jobId?{...next}:j);
   if(isFinalJobState(next.state))setPreview(next.messageFa);
   touch();
  },()=>active.current?.id===project);
 }
 /** The first successful turn of a draft creates the project (so there are never empty projects) and puts it in the URL. */
 function adoptProject(firstText:string,characterId:string|null){
  if(active.current)return touch();
  const a:ActiveProject={id:crypto.randomUUID(),createdAt:new Date().toISOString(),title:autoTitle(firstText),titleSource:"auto",persisted:false};
  active.current=a;setProjectId(a.id);setLocal({mode,style});syncUrl(a.id,characterId);touch();
 }
 // Save when the page is hidden or the studio unmounts (for example a click on «گالری»).
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
   // A job saved mid-generation by an older version has no id to ask about, so it can never finish: show it as unknown rather than at 95% forever.
   for(const m of restored)if(m.kind==="job"&&!m.snapshot.jobId&&!isFinalJobState(m.snapshot.state))m.snapshot={...m.snapshot,state:"lost",messageFa:UNTRACKED_JOB_FA};
   setProjectId(p.id);setLocal({mode:p.mode,style:p.style});setMessages(withGenerationTags(restored));
   const lastJob=[...restored].reverse().find(m=>m.kind==="job");
   if(lastJob?.kind==="job"){setJob(lastJob.snapshot);setPreview(lastJob.snapshot.messageFa);setPreviewOpen(previewFits());setGalleryFocus(galleryFocusOn(lastJob.id));}
   // A generation that was still running when the project was saved: ask the server again and follow it to its end.
   for(const m of restored)if(m.kind==="job"&&m.snapshot.jobId&&!isFinalJobState(m.snapshot.state))followJob(m.id,m.snapshot);
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
 /**
  * Everything viewable in this chat for the full-screen viewer (owner, 2026-11-06), newest first: the files (one per picture) and every generated image or
  * video, each with its essentials: title, date, the brief, the model and a few facts.
  */
 function viewerItems():ViewerItem[]{
  const sentAt=(id:string)=>messages.find(m=>(m.attachments??[]).some(a=>a.id===id))?.at;
  const files:ViewerItem[]=distinctFiles.map(c=>{const r=reviews[c.id];return {id:c.id,kind:c.kind,mime:c.mime,bytes:c.bytes,name:c.name,tag:c.tag,role:c.role,width:c.width,height:c.height,durationSeconds:c.durationSeconds,url:c.previewUrl,blob:blobs.current.get(c.id),
   info:{titleFa:displayTag(c.tag)+(c.role?" · "+roleLabelFa(c.role,c.kind):""),dateIso:sentAt(c.id),facts:[
    {labelFa:"نوع",value:ATTACHMENT_KINDS[c.kind].labelFa},{labelFa:"حجم",value:faBytes(c.bytes)},
    ...(c.width&&c.height?[{labelFa:"ابعاد",value:faDimensions(c.width,c.height)}]:[]),...(c.durationSeconds!==undefined?[{labelFa:"مدت",value:faDuration(c.durationSeconds)}]:[]),
    ...(r?.state==="safe"?[{labelFa:"بررسی ایمنی",value:"تأیید شد"}]:[])]}};});
  const gens:ViewerItem[]=messages.flatMap(m=>{
   if(m.kind!=="job"||!m.snapshot.tag)return [];
   const tag=m.snapshot.tag,g=generationMap.get(tag),outs=(m.snapshot.outputs??(m.snapshot.messageFa===job?.messageFa?job?.outputs:undefined))??[];
   return outs.filter(o=>(o.kind==="image"||o.kind==="video")&&isOwnedOutputUrl(o.url,window.location.origin)).map((o,k):ViewerItem=>({id:"gen-"+tag+"-"+k,kind:o.kind as "image"|"video",mime:o.kind==="video"?"video/mp4":"image/png",bytes:0,
    name:displayTag(tag).slice(1)+(o.kind==="video"?".mp4":".png"),tag,url:o.url,info:{titleFa:displayTag(tag),dateIso:m.at,briefFa:g?.plan.intentSummaryFa,model:g?.modelName||undefined,facts:[
     {labelFa:"نوع",value:o.kind==="video"?"ویدیو":"عکس"},...(g?.plan.camera?.aspectRatio?[{labelFa:"نسبت",value:g.plan.camera.aspectRatio==="original"?"اصلی":g.plan.camera.aspectRatio}]:[]),
     ...(g?.plan.shot?.durationSeconds?[{labelFa:"مدت",value:fa(g.plan.shot.durationSeconds)+" ثانیه"}]:[]),...(g?.neurons?[{labelFa:"هزینه",value:fa(g.neurons)+" نورون"}]:[])]}}));
  });
  return byRecency([...files,...gens]);
 }
 function openViewerAt(id:string){const items=viewerItems(),index=items.findIndex(i=>i.id===id);if(index>=0)setViewer({items,index,title:active.current?.title});}
 function openViewer(a:LocalAttachment){
  // A repeated file opens as the one picture it is (the # list keeps the latest #).
  const same=distinctFiles.find(c=>c.kind===a.kind&&c.sha256===a.sha256);openViewerAt(same?.id??a.id);
 }
 /** A generated image or video, full screen (from the chat or the preview). */
 const openGenerationViewer=(tag:string)=>openViewerAt("gen-"+tag+"-0");
 /** «ادیت» in the viewer: the viewer closes and the picture opens in the brush editor. */
 function editFromViewer(item:ViewerItem){
  setViewer(null);
  if(item.id.startsWith("gen-"))return void editGeneration(item.tag);
  const inTray=attachments.find(a=>a.id===item.id),sent=conversation.find(a=>a.id===item.id);
  if(inTray)editAttachment(inTray,true);else if(sent)editAttachment(sent,false);
 }
 function releaseUrl(a:LocalAttachment){if(a.previewUrl){URL.revokeObjectURL(a.previewUrl);urls.current.delete(a.previewUrl);}}
 function setReview(id:string,r:PhotoReview){reviewsRef.current={...reviewsRef.current,[id]:r};setReviews(reviewsRef.current);}
 /**
  * Checks one photo (right after it is added, or when a message needs it): a known verdict is reused, a running check is joined, a failed one is tried again.
  * `force`: check again even when known (the server forgot it after a restart). A blocked photo says why and how to replace it, right away under the chat box.
  */
 function checkPhoto(a:LocalAttachment,force=false):Promise<PhotoReview>{
  const known=reviewsRef.current[a.id];
  if(!force&&known&&(known.state==="safe"||known.state==="blocked"))return Promise.resolve(known);
  const running=reviewJobs.current.get(a.id);if(running&&!force)return running;
  const blob=blobs.current.get(a.id);
  if(!blob){const r:PhotoReview={state:"failed",reasonFa:REVIEW_FAILED_FA};setReview(a.id,r);return Promise.resolve(r);}
  setReview(a.id,{state:"checking",progress:0});
  const job=reviewPhoto(blob,p=>{if(reviewJobs.current.get(a.id)===job)setReview(a.id,{state:"checking",progress:p});}).then(r=>{
   if(reviewJobs.current.get(a.id)!==job)return r;
   reviewJobs.current.delete(a.id);setReview(a.id,r);
   if(r.state==="blocked")setProblems(list=>[...list,{key:crypto.randomUUID(),name:displayTag(a.tag),message:r.reasonFa+(r.fixFa?" "+r.fixFa:"")}]);
   return r;
  });
  reviewJobs.current.set(a.id,job);return job;
 }
 /** The id a photo's safe check got, sent with it so the server can find its own record. */
 const reviewIdOf=(a:LocalAttachment)=>{const r=reviewsRef.current[a.id];return r?.state==="safe"?r.reviewId:undefined;};
 /** Verifies the picked files one by one; the good ones join the tray, each rejected one gets its own Persian reason. Returns how many were added. */
 async function addFiles(files:File[],upload?:Upload,reservedTag?:string):Promise<LocalAttachment[]>{
  if(!files.length||readingRef.current)return [];
  readingRef.current=true;setReading(true);setProblems([]);setAnnounce("");
  const next=[...attachments],added:LocalAttachment[]=[],bad:AttachmentProblem[]=[];
  for(const file of files){
   const name=file.name||"فایل",fail=(message:string)=>bad.push({key:crypto.randomUUID(),name,message});
   if(next.length>=MAX_ATTACHMENTS){fail(tooManyFa());continue;}
   try{
    const read=await readAttachment(file);
    // No duplicates (owner, 2026-11-06): a file already in the chat box is not added twice; one sent earlier comes back with its own # (and its check).
    const sameInTray=next.find(x=>x.kind===read.kind&&x.sha256===read.sha256);
    if(sameInTray){if(read.previewUrl)URL.revokeObjectURL(read.previewUrl);fail("همین فایل الان توی پیامه: "+displayTag(sameInTray.tag));continue;}
    const sameSent=reservedTag?undefined:[...messages].reverse().flatMap(m=>m.attachments??[]).find(x=>x.kind===read.kind&&x.sha256===read.sha256&&x.previewUrl);
    if(sameSent){
     if(read.previewUrl)URL.revokeObjectURL(read.previewUrl);
     if(!blobs.current.has(sameSent.id))blobs.current.set(sameSent.id,file);
     const again={...(upload?.role?withRole(sameSent,upload.role):sameSent),regionEdit:undefined};next.push(again);added.push(again);continue;
    }
    const check=validateAttachmentSet([...next,read]);
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
  // Each photo is checked right away, so it is ready by the time the message goes.
  if(reviewOn)for(const a of added)if(a.kind==="image"&&reviewsRef.current[a.id]?.state!=="safe")void checkPhoto(a);
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
 /** The marked copy of a photo, as its own checkable photo (same tag, its own id). */
 const guideOf=(a:LocalAttachment):LocalAttachment|undefined=>a.regionEdit?{...a,id:a.regionEdit.guideId,regionEdit:undefined}:undefined;
 /** Opens a photo of this chat (in the chat box or sent) in the full-screen editor; it is checked meanwhile, so it is ready when the edit goes. */
 function editAttachment(a:LocalAttachment,fromTray:boolean,suggested?:readonly SuggestedEdit[]){
  if(a.kind!=="image"||!a.previewUrl||!blobs.current.get(a.id)){setError("این عکس دیگه توی این مرورگر نیست؛ دوباره اضافه‌ش کن.");return;}
  setEditing({a:{...a,regionEdit:undefined},fromTray,...(suggested?.length?{suggested}:{})});if(reviewOn)void checkPhoto(a);
 }
 /** Opens a generated image in the editor: it joins the chat as a new photo (#تصویر-n), checked like any photo. */
 async function editGeneration(tag:string,suggested?:readonly SuggestedEdit[]){
  // One copy per generation: a second «ادیت» opens the copy made the first time (same #, already checked).
  const copy=[...attachments,...[...messages].reverse().flatMap(m=>m.attachments??[])].find(a=>a.fromGeneration===tag&&a.previewUrl&&blobs.current.has(a.id));
  if(copy){setEditing({a:{...copy,regionEdit:undefined},fromTray:false,...(suggested?.length?{suggested}:{})});if(reviewOn)void checkPhoto(copy);return;}
  const snap=messages.find(m=>m.kind==="job"&&m.snapshot.tag===tag)?.snapshot as {outputs?:{kind:string;url:string}[]}|undefined;
  const url=snap?.outputs?.find(o=>o.kind==="image"&&isOwnedOutputUrl(o.url,window.location.origin))?.url;
  if(!url){setError("تصویر این تولید هنوز آماده نیست.");return;}
  try{
   const blob=await fetch(url).then(r=>{if(!r.ok)throw new Error();return r.blob();});
   const read=await readAttachment(new File([blob],displayTag(tag).slice(1)+".jpg",{type:blob.type||"image/jpeg"}));
   const newTag=lowestFreeTag([...tagsInUse(messages.flatMap(m=>m.attachments??[]),slots),...attachments.map(x=>x.tag)],"image");
   if(!newTag||!read.previewUrl){setError(ATTACHMENT_ERRORS_FA.tagsExhausted);return;}
   tagCounters.current=bumpTagCounters(tagCounters.current,newTag);
   const a:LocalAttachment={...read,tag:newTag,fromGeneration:tag};urls.current.add(read.previewUrl);blobs.current.set(a.id,blob);
   setEditing({a,fromTray:false,...(suggested?.length?{suggested}:{})});if(reviewOn)void checkPhoto(a);
  }catch{setError("تصویر این تولید باز نشد. دوباره امتحان کن.");}
 }
 /** A photo or generation of this chat by its tag, for the edit card: its thumbnail, and opening it in the editor. */
 function thumbFor(tag:string):string|undefined{
  if(isGenerationTag(tag))return (messages.find(m=>m.kind==="job"&&m.snapshot.tag===tag)?.snapshot as {outputs?:{kind:string;url:string}[]}|undefined)?.outputs?.find(o=>o.kind==="image")?.url;
  return [...attachments,...messages.flatMap(m=>m.attachments??[])].find(a=>a.tag===tag)?.previewUrl;
 }
 async function openEditFor(tag:string,suggested?:readonly SuggestedEdit[]){
  if(isGenerationTag(tag))return editGeneration(tag,suggested);
  const inTray=attachments.find(a=>a.tag===tag),sent=[...messages].reverse().flatMap(m=>m.attachments??[]).find(a=>a.tag===tag);
  if(inTray)editAttachment(inTray,true,suggested);else if(sent)editAttachment(sent,false,suggested);
 }
 /** The editor is done: the marked copy is made and checked, and the edit goes straight to Whoush (as the answer, when Whoush asked for it). */
 async function applyEdit({masks,regions}:{masks:HTMLCanvasElement[];regions:Region[]}){
  const e=editing;if(!e)return;setEditing(null);
  const blob=blobs.current.get(e.a.id);if(!blob)return;
  let guide:Blob;try{guide=await renderGuide(blob,masks);}catch{setError("علامت‌ها ذخیره نشد. دوباره امتحان کن.");return;}
  const guideId=crypto.randomUUID(),guideUrl=URL.createObjectURL(guide);urls.current.add(guideUrl);blobs.current.set(guideId,guide);
  const edited:LocalAttachment={...e.a,regionEdit:{regions,guideId,guideUrl}};
  if(reviewOn)void checkPhoto(guideOf(edited)!);
  if(e.fromTray){setAttachments(l=>l.filter(x=>x.id!==e.a.id));setSlots(l=>forgetAttachment(l,e.a.id));}
  const text=displayTag(edited.tag)+" رو ادیت کن — "+regions.map(r=>"ادیت "+fa(r.n)+" ("+REGION_COLOR_FA[r.color]+"): "+r.note).join("؛ ");
  const asked=questionAwaitingAnswer();
  void runTurn(text,[edited],[],false,asked?answerBrief(asked.brief??asked.text,text):undefined);
 }
 function removeAttachment(id:string){
  const a=attachments.find(x=>x.id===id);if(a)releaseUrl(a);
  if(a&&mainSubject===a.tag)setMainSubject(null);
  blobs.current.delete(id);
  setAttachments(list=>list.filter(x=>x.id!==id));setSlots(list=>forgetAttachment(list,id));
 }
 function patchAttachment(id:string,patch:AttachmentPatch){setAttachments(list=>list.map(x=>x.id!==id?x:patch.role===null?withoutRole(x):patch.role?withRole(x,patch.role):{...x,...(patch.speech?{speech:patch.speech}:{})}));}
 /** Puts the tag (`#تصویر-۱`) into the prompt as a badge at the caret (at the end when the prompt is not focused), with focus in the prompt after it. */
 function mentionTag(tag:string){promptRef.current?.insertTag(tag);}
 /** The star: makes this the main subject (only one), or clears it. A # that is not in the message yet is dropped into the prompt, so it goes with it. */
 function toggleMain(tag:string){
  if(mainSubject===tag){setMainSubject(null);return;}
  setMainSubject(tag);
  const inTray=attachments.some(a=>a.tag===tag),inText=tag.startsWith("#")?draft.includes(tag):parseMentions(draft).includes(tag);
  if(!inTray&&!inText)mentionTag(tag);
 }
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
 /** A + menu entry adds an empty upload card (title and icon) inside the chat input and moves focus to it; «کاراکتر» (saved characters) opens the saved-character dialog. */
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
  // Photos sent earlier in this chat (details only, no bytes): Whoush reuses ones it asked for instead of asking again. The latest ten, at most.
  const priorPhotos=uniqueById(messages.flatMap(m=>m.attachments??[])).filter(a=>a.kind==="image"&&!outgoing.some(o=>o.id===a.id)).slice(-MAX_ATTACHMENTS);
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
  const main=fromComposer?mainSubject:null;
  if(fromComposer){setDraft("");setAttachments([]);setSlots([]);setProblems([]);setMainSubject(null);}
  setError("");setNotice("");setBusy(true);setProposal(null);setLiveId(null);setAnnounce("");
  const userMsg=item({role:"user",text,...(sent.length?{attachments:sent}:{}),...(cardRefs.length?{generationTags:cardRefs}:{}),...(brief?{brief}:{})});
  setMessages(m=>[...m,userMsg]);touch();
  // Whoush's emoji reaction lands on this message (Slack-style), when it chose one.
  const whoushReacts=(emoji?:ReactionEmoji)=>{if(emoji)react(userMsg.id,emoji,"whoush");};
  const characterRef=current?{id:current.id,name:current.name,angles:characterCoverage(current.references).uploaded,version:current.version}:undefined;
  try{
   // The photos this turn sends must be checked first (lib/photo-review.ts). Usually they already are (checked right after upload); otherwise Whoush waits
   // in the chat with their progress and then goes on by itself. Earlier photos that cannot be used are simply left out.
   let prior=priorPhotos;
   if(reviewOn){
    // A painted photo's marked copy is checked like the photo itself.
    const mine=outgoing.filter(a=>a.kind==="image").flatMap(a=>{const g=guideOf(a);return g?[a,g]:[a];}),unsure=[...mine,...prior].filter(a=>reviewsRef.current[a.id]?.state!=="safe");
    if(unsure.length){
     setWaitingFor(unsure);
     await Promise.all(unsure.map(a=>checkPhoto(a)));
     setWaitingFor(null);
     const bad=mine.filter(a=>reviewsRef.current[a.id]?.state!=="safe");
     if(bad.length){
      setMessages(m=>[...m,agentItem({role:"agent",text:reviewStopFa(bad.map(a=>({tagFa:displayTag(a.tag),review:reviewsRef.current[a.id]}))),kind:"text"})]);
      adoptProject(firstText,characterId);return;
     }
     prior=prior.filter(a=>reviewsRef.current[a.id]?.state==="safe");
    }
   }
   setThinking({stage:"reading",done:[],script:replyScriptFor(sentText)});
 // Keeping the thread (lib/follow-up.ts): the photos the latest plan was built on, with the roles that plan gave them; the server keeps them for a
   // follow-up that continues the work.
   let lastPlan:AgentProposal["plan"]|undefined;
   for(const m of [...messages].reverse()){if((m.kind==="proposal"||m.kind==="no_model")&&m.snapshot.plan){lastPlan=m.snapshot.plan;break;}}
   const planRoles=new Map<string,string>((lastPlan?.references??[]).map(r=>[r.tag,r.role]));
   const continueWith=outgoing.length?[]:prior.filter(a=>planRoles.has(a.tag)).map(a=>a.tag);
   const withPlanRole=(a:LocalAttachment)=>{const r=planRoles.get(a.tag);return !a.role&&r&&roleAllowed(a.kind,r as AttachmentRole)?withRole(a,r as AttachmentRole):a;};
   const body=()=>JSON.stringify({text:sentText,...(brief?{answersQuestion:true}:{}),...(messages.length?{history:historyFor(messages)}:{}),...(scene?{stagingOverride:scene.stagingOverride,...(scene.aspectOverride?{aspectOverride:scene.aspectOverride}:{})}:{}),preference:mode,...(style?{style}:{}),...(characterRef&&characterRef.angles.length>0?{characterRef}:{}),...(outgoing.length?{attachments:outgoing.map(a=>toWireAttachment(a,reviewIdOf(a),a.regionEdit?reviewIdOf(guideOf(a)!):undefined))}:{}),...(prior.length?{priorAttachments:prior.map(a=>toWireAttachment(withPlanRole(a),reviewIdOf(a)))}:{}),...(continueWith.length?{continueWith}:{}),...(main?{mainSubject:main}:{}),...(generations.length?{generations}:{})}),onStage=(stage:TurnStage)=>setThinking(t=>t&&(t.stage===stage?t:{...t,done:[...t.done,t.stage],stage}));
   type ErrorBody={editCards?:unknown;error?:string;reason?:UnsupportedReason;unreviewed?:unknown;message?:string;question?:string;reaction?:ReactionEmoji;plan?:AgentProposal["plan"];references?:unknown;choices?:unknown};
   const postTurn=async()=>{const res=await postAgentTurn(body(),onStage);return {r:res,errorBody:(res.ok?{}:await res.json().catch(()=>({}))) as ErrorBody};};
   // The server no longer knows a check (it restarted): check those photos again, then send once more.
   const recheck=async(first:Awaited<ReturnType<typeof postTurn>>)=>{
    const unreviewed=Array.isArray(first.errorBody.unreviewed)?first.errorBody.unreviewed:[];
    const again=reviewOn&&first.r.status===422&&first.errorBody.reason==="media_review"?uniqueById([...outgoing,...prior]).filter(a=>unreviewed.includes(a.tag)).flatMap(a=>{const g=guideOf(a);return g?[a,g]:[a];}):[];
    if(!again.length)return first;
    setThinking(null);setWaitingFor(again);
    await Promise.all(again.map(a=>checkPhoto(a,true)));
    setWaitingFor(null);
    if(!again.every(a=>reviewsRef.current[a.id]?.state==="safe"))return first;
    setThinking({stage:"reading",done:[],script:replyScriptFor(sentText)});
    return postTurn();
   };
   const {r,errorBody}=await recheck(await postTurn());
   if(!r.ok){
    if(r.status===422&&errorBody.error==="no_compatible_model"){
     const message=typeof errorBody.message==="string"?errorBody.message:"مدل سازگاری برای این درخواست پیدا نشد.";
     const reason=errorBody.reason&&UNSUPPORTED_REASONS.includes(errorBody.reason)?errorBody.reason:undefined;
     setMessages(m=>[...m,agentItem({role:"agent",text:message,kind:"no_model",snapshot:{message,...(errorBody.plan?{plan:errorBody.plan}:{}),...(reason?{reason}:{})}})]);setPreview(noModelTitle(reason));
     adoptProject(firstText,characterId);
     return;
    }
    if(r.status===422&&errorBody.error==="needs_input"&&typeof errorBody.question==="string"){
     const references=isReferenceRequest(errorBody.references)?errorBody.references:undefined,choices=isQuestionChoices(errorBody.choices)?errorBody.choices:undefined;
     const editCards=Array.isArray(errorBody.editCards)?errorBody.editCards.flatMap(c=>{const x=c as {tag?:unknown;suggested?:unknown};
      return typeof x.tag==="string"?[{tag:x.tag,...(Array.isArray(x.suggested)?{suggested:(x.suggested as SuggestedEdit[]).slice(0,5)}:{})}]:[];}).slice(0,10):[];
     setMessages(m=>[...m,agentItem({role:"agent",text:typeof errorBody.message==="string"?errorBody.message:"",kind:"question",snapshot:{question:errorBody.question!,...(references?{references}:{}),...(choices?{choices}:{}),...(editCards.length?{editCards}:{})}})]);whoushReacts(errorBody.reaction);
     adoptProject(firstText,characterId);
     return;
    }
    if(r.status===422&&errorBody.error==="content_restricted"){
     const choices=isQuestionChoices(errorBody.choices)?errorBody.choices:undefined;
     setMessages(m=>[...m,agentItem({role:"agent",text:typeof errorBody.message==="string"?errorBody.message:"این درخواست را نمی‌توانم انجام بدهم.",kind:"restricted",...(choices?{snapshot:{choices}}:{})})]);
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
   setProposal(data);setLiveId(reply.id);setSelected(data.selectedModelId);setAspectChoice(null);setExcludedRefs(new Set());setDraftedFor(null);setPreview("در انتظار تأیید تولید");setJob(null);
   // Like a friend: the reply, then (sometimes) a GIF as its own message.
   setMessages(m=>[...m,reply,...(data.gif?[agentItem({role:"agent",text:"",kind:"gif",snapshot:data.gif})]:[])]);whoushReacts(data.reaction);
   adoptProject(firstText,characterId);
  }catch(err){setError(err instanceof Error?err.message:"خطای ناشناخته");}
  finally{setBusy(false);setThinking(null);}
 }
 /**
  * Generates the live proposal. `draft` (video only): the cheap opening-frame still on its own private turn first; the proposal stays live so the user can
  * then make the video, or change it in the chat. Without it, the final generation, which closes the proposal.
  */
 async function approve(draft=false){
  if(!proposal||busy)return;setBusy(true);setError("");
  try{
   const d=draft?proposal.draft:undefined;if(draft&&!d)return;
   const turnId=d?d.turnId:proposal.turnId;
   if(!turnId)throw new Error("پیشنهاد منقضی شده است؛ دوباره درخواستت را بفرست.");
   const post=(url:string,body:unknown)=>fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
   // The canvas is the source of truth: an arranged scene goes with the quote (the server applies it to this turn's private plan), and the frame's aspect
   // ratio goes as the model's real aspect-ratio setting, so the output frame matches the canvas exactly where the model supports it.
   const live=messages.find(m=>m.id===liveId),edit=sceneEdit&&sceneEdit.id===liveId?sceneEdit:null;
   const planAspect=live?.kind==="proposal"?live.snapshot.plan.camera?.aspectRatio:undefined,wanted=aspectChoice??edit?.aspect??planAspect;
   // A ratio this model lacks snaps to the nearest one it offers (4:5 → 3:4), never to the model's square default.
   const offered=d?undefined:proposal.suggestions.find(s=>s.modelId===selected)?.aspectRatios,aspect=offered?.length?nearestAspectRatio(wanted,offered)??wanted:wanted;
   // A draft quotes the draft model on the draft's own turn (no canvas override: that belongs to the video turn).
   const quoteBody={modelId:d?d.modelId:selected,turnId,...(!d&&edit?{stagingOverride:edit.staging,...(edit.aspect!==planAspect?{aspectOverride:edit.aspect}:{})}:{}),
    ...(excludedRefs.size?{excludeReferences:[...excludedRefs]}:{})};
   let q=await post("/api/generation/quote",{...quoteBody,...(aspect?{configuration:{aspectRatio:aspect}}:{})});
   if(q.status===422&&aspect)q=await post("/api/generation/quote",quoteBody); // last resort if the ratio is still refused (invalid_configuration): the prompt still carries it
   if(!q.ok){
    // A refusal that says why (a photo edit that changes the camera and the light together; a prop hiding the subject) is shown as is.
    const why=await q.json().then((b:{error?:string;message?:string})=>b.error==="edit_scope_mixed"||b.error==="composition_occluded"||b.error==="dev_cap_reached"||b.error==="price_pending"?b.message:undefined).catch(()=>undefined);
    throw new Error(why??(q.status===410?"پیشنهاد منقضی شده است؛ دوباره درخواستت را بفرست.":"مشکل در محاسبه هزینه"));
   }
   const quote=await q.json() as {token:string};
   const execution=await post("/api/generation/execute",{token:quote.token,approved:true,idempotencyKey:crypto.randomUUID()});
   if(!execution.ok)throw new Error("خطا در شروع تولید");
   const current=await execution.json() as {id:string;state:string;messageFa:string;outputs?:JobView["outputs"];typicalMs?:number;progressFacts?:JobView["progressFacts"]};
   const genTag=liveId?(messages.find(m=>m.id===liveId)?.snapshot as ProposalSnapshot|undefined)?.tag:undefined;
   // The job's message goes into the transcript now (with its id), and is updated in place as the job moves: a project saved or reopened mid-generation
   // still knows which job to follow, and a finished one keeps its outputs.
   const snap:JobSnapshot={...jobSnapshot(current,genTag),...(d?{draft:{modelName:d.modelName}}:{})},msg=item({role:"agent",text:current.messageFa,kind:"job",snapshot:snap});
   // On a phone the preview would cover the chat: the generation stays in the chat as its card, and «نمایش» opens the preview when wanted (owner, 2026-11-06).
   setPreview(current.messageFa);setJob(snap);setPreviewOpen(previewFits());setGalleryFocus(galleryFocusOn(msg.id));
   setMessages(m=>[...m,msg]);
   if(d)setDraftedFor(liveId);else{setProposal(null);setLiveId(null);}
   touch();
   followJob(msg.id,snap);
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
 /** Every generation of this chat for the preview gallery, oldest first. An older saved job without outputs borrows the live job's when it is that job. */
 const galleryItems:GalleryItem[]=messages.flatMap(m=>m.kind!=="job"?[]:[{id:m.id,
  job:{...m.snapshot,outputs:m.snapshot.outputs??(m.snapshot.messageFa===job?.messageFa?job?.outputs:undefined)},
  kind:m.snapshot.draft?"image":m.snapshot.tag?generationMap.get(m.snapshot.tag)?.plan.mediaKind:undefined,
  model:m.snapshot.draft?"پیش‌نویس · "+m.snapshot.draft.modelName:m.snapshot.tag?generationMap.get(m.snapshot.tag)?.modelName:undefined}]);
 const showPreview=hasPreview&&previewOpen;
 /** Opens the preview panel, on a given generation's job when a preview card asks (the latest job keeps its live outputs). */
 function openPreview(snapshot?:JobSnapshot,messageId?:string){
  if(snapshot&&(snapshot.jobId?snapshot.jobId!==job?.jobId:snapshot.messageFa!==job?.messageFa)){setJob({...snapshot});setPreview(snapshot.messageFa);}
  if(messageId)setGalleryFocus(galleryFocusOn(messageId));
  setPreviewOpen(true);
 }
 function minimizePreview(){setPreviewOpen(false);requestAnimationFrame(()=>promptRef.current?.focus());}
 return <RailShell current="studio" activeProjectId={projectId} onNewChat={newChat} onProjectDeleted={onProjectDeleted}>
  {/* Desktop: the chat (right after the side nav, at the start side) and the preview share the row; the preview grows in and out (flex-grow transition) and,
      while it is closed, the chat takes the whole width. Mobile: one at a time; the preview covers the chat until minimized. */}
  <main id="main" className="flex min-h-0 flex-1 flex-col md:flex-row">
   <h1 className="sr-only">استودیوی هووش</h1>
   {/* Preview: after the chat on desktop (md:order-last), first on mobile */}
   <section id="whoush-preview" aria-label="پیش‌نمایش" inert={!showPreview||undefined} aria-hidden={!showPreview||undefined}
    className={(showPreview?"flex":"hidden")+" surface-preview min-h-0 flex-1 flex-col md:order-last md:flex md:min-w-0 md:basis-0 md:overflow-hidden md:transition-[flex-grow,opacity] md:duration-300 md:ease-out motion-reduce:transition-none "+(showPreview?"md:grow md:opacity-100":"md:grow-0 md:opacity-0")}>
    <Tabs value={activeTab} onValueChange={v=>setActiveTab(v as "generations"|"cuts")} className="min-h-0 flex-1 gap-0">
     {/* The header: the tabs only while «تدوین» exists (one tab needs no tab bar); otherwise it holds just the phones' «بازگشت به چت», so desktop hides it. */}
     <div className={"flex items-center justify-between gap-4 border-b border-line-tertiary px-4 py-2 lg:px-6"+(EDIT_TAB_ENABLED?"":" md:hidden")}>
      {EDIT_TAB_ENABLED?<TabsList><TabsTrigger value="generations">تولیدها</TabsTrigger><TabsTrigger value="cuts">تدوین</TabsTrigger></TabsList>:<span/>}
      <div className="flex items-center gap-2">
       {/* Phones: the preview covers the chat, so the toggle lives here as «بازگشت به چت» (on desktop the chat header's «بستن نمایش» closes it). */}
       <Button type="button" variant="outline" className="md:hidden" onClick={minimizePreview} aria-controls="whoush-preview"><Icon icon={MessageCircle} aria-hidden="true"/>{BACK_TO_CHAT_FA}</Button>
      </div>
     </div>
     {/* «تولیدها»: every generation of the chat in one scroll with a thumbnail strip (its own two scroll areas, so the strip stays put). */}
     <TabsContent value="generations" className="flex min-h-0 flex-1 flex-col">
      {galleryItems.length>0
       ?<GenerationGallery items={galleryItems} focus={galleryFocus} placeholder="خروجی تصویری واقعی هنوز فعال نیست" onEdit={busy?undefined:tag=>{setPreviewOpen(false);void editGeneration(tag);}} onView={openGenerationViewer}/>
       :<div className="p-4 lg:p-6"><div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-card border border-line-secondary bg-surface-subtle p-8 text-center md:aspect-video">
        <Icon icon={Clapperboard} size={32} className="text-fg-secondary" aria-hidden="true"/>
        <p className="type-body text-fg-primary">{preview}</p>
       </div></div>}
     </TabsContent>
     {EDIT_TAB_ENABLED&&<TabsContent value="cuts" className="min-h-0 flex-1">
      <ScrollArea className="h-full">
       <div className="p-4 lg:p-6"><div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-card border border-line-secondary bg-surface-subtle p-8 text-center">
        <p className="type-body text-fg-primary">بخش تدوین در مرحله بعد ساخته می‌شود.</p>
       </div></div>
      </ScrollArea>
     </TabsContent>}
    </Tabs>
   </section>
   {/* End side: agent panel */}
   {/* Desktop, preview closed: the thumbnail strip stays at the far edge; picking one opens the preview on that generation. */}
   {!showPreview&&galleryItems.length>0&&<div className="surface-preview hidden border-s border-line-tertiary px-2 py-4 md:order-last md:flex">
    <GalleryThumbs items={galleryItems} current={galleryFocus?.id??galleryItems.at(-1)!.id} onPick={id=>{const m=messages.find(x=>x.id===id);if(m?.kind==="job")openPreview(m.snapshot,id);}}/>
   </div>}
   <section aria-label="دستیار هووش" className={(showPreview?"hidden md:flex":"flex")+" relative min-h-0 flex-1 flex-col border-line-tertiary md:min-w-0 md:basis-[22rem] md:transition-[flex-grow] md:duration-300 md:ease-out motion-reduce:transition-none lg:basis-[26rem] "+(showPreview?"md:grow-0 md:border-e":"md:grow")}
    onDragEnter={e=>{if(!hasFiles(e))return;e.preventDefault();dragDepth.current+=1;setDragging(true);}}
    onDragOver={e=>{if(hasFiles(e))e.preventDefault();}}
    onDragLeave={e=>{if(!hasFiles(e))return;dragDepth.current=Math.max(0,dragDepth.current-1);if(!dragDepth.current)setDragging(false);}}
    onDrop={onDrop}>
    {dragging&&<div aria-hidden="true" className="pointer-events-none absolute inset-2 z-10 flex flex-col items-center justify-center gap-2 rounded-card border border-dashed border-primary bg-surface-base/90 type-title text-fg-primary">
     <Icon icon={UploadIcon} size={32} aria-hidden="true"/>فایل‌ها را اینجا رها کن
    </div>}
    <div role="status" aria-live="polite" className="sr-only">{dragging?"فایل‌ها را اینجا رها کن":announce}</div>
    {/* The welcome line is the empty view (components/chat-empty.tsx), never a fixed header; the bar is only the preview toggle, once there is a preview. */}
    {hasPreview&&<div className="border-b border-line-tertiary px-4 py-2">
     <div className="mx-auto flex w-full max-w-3xl items-center justify-end gap-3">
     {/* A toggle that shows the preview («نمایش») or closes it («بستن نمایش»). */}
     <Button type="button" variant="outline" onClick={()=>showPreview?minimizePreview():openPreview()} aria-expanded={showPreview} aria-controls="whoush-preview" className="shrink-0">
      <Icon icon={showPreview?ChevronLeft:Eye} aria-hidden="true"/>{showPreview?CLOSE_PREVIEW_FA:OPEN_PREVIEW_FA}</Button>
     </div>
    </div>}
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
     <div aria-live="polite" aria-label="گفت‌وگو" role="log" className="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-4 p-4">
      {!messages.length&&!loadingProject&&<ChatEmpty/>}
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
         {(m.attachments??[]).map(a=><SentAttachmentCard key={a.id} item={a} onPreview={()=>openViewer(a)} onMention={()=>mentionTag(a.tag)} review={reviews[a.id]} onBrush={a.kind==="image"&&!busy?()=>editAttachment(a,false):undefined}/>)}
        </ul>}
        {/* A brush edit shows each region with its comment under the photo, like comments on it (memory: a reopened chat shows them in the plan). */}
        {(m.attachments??[]).some(a=>a.regionEdit)&&<ul aria-label="ادیت‌ها" className="flex flex-col gap-1.5">
         {(m.attachments??[]).flatMap(a=>a.regionEdit?a.regionEdit.regions.map(r=><li key={a.id+"-"+r.n} className="flex items-start gap-2 type-body-sm text-fg-primary"><RegionChip n={r.n} color={r.color}/><span className="min-w-0 break-words">{r.note}</span></li>):[])}
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
          <div className="flex min-w-0 flex-col gap-2">
           <p className="whitespace-pre-wrap break-words"><span className="sr-only">هووش: </span>{m.text}</p>
           {/* Safe ideas, one tap each (lib/safe-alternatives.ts): each is sent as a new message. Only under the latest message. */}
           {m.snapshot?.choices&&i===messages.length-1&&!busy&&<div role="group" aria-label="پیشنهادهای جایگزین" className="flex flex-wrap gap-2">
            {m.snapshot.choices.map((c,k)=><Button key={k} type="button" size="sm" variant="secondary" onClick={()=>void runTurn(c.replyFa,[],[],false)}><Icon icon={Sparkles} aria-hidden="true"/>{c.labelFa}</Button>)}
           </div>}
          </div>
         </div>
         :m.kind==="gif"?<div><span className="sr-only">هووش: </span><ChatGif gif={m.snapshot}/></div>
         :m.kind!=="job"&&<p className="whitespace-pre-wrap break-words type-body-sm text-fg-primary">
          <span className="sr-only">هووش: </span><TypeOut text={m.text} animate={fresh.has(m.id)}/>
         </p>}
        {m.kind==="job"&&<PreviewCard tag={m.snapshot.tag} state={m.snapshot.state} messageFa={m.snapshot.messageFa} job={m.snapshot} model={m.snapshot.draft?"پیش‌نویس · "+m.snapshot.draft.modelName:m.snapshot.tag?generationMap.get(m.snapshot.tag)?.modelName:undefined}
         output={(m.snapshot.outputs??(m.snapshot.messageFa===job?.messageFa?job?.outputs:undefined))?.find(o=>isOwnedOutputUrl(o.url,window.location.origin))} video={m.snapshot.tag?generationMap.get(m.snapshot.tag)?.plan.mediaKind==="video":false} onOpen={()=>openPreview(m.snapshot,m.id)}
         onView={m.snapshot.tag?()=>openGenerationViewer(m.snapshot.tag!):undefined}
         onEdit={m.snapshot.tag&&!busy?()=>void editGeneration(m.snapshot.tag!):undefined}/>}
        {/* «بوم» is adjustable on every generation: on the live one it feeds «بساز» directly; on an older one its card offers a revision with that scene. */}
        {(m.kind==="proposal"||m.kind==="no_model")&&m.snapshot.plan&&<PlanStory plan={m.snapshot.plan} focus={m.kind==="proposal"?refineFocus(m.snapshot.focus,messages.slice(0,i).reverse().find(x=>x.role==="user")?.text):undefined}
         onStagingChange={m.kind==="proposal"?(s,aspect,changed)=>{
          if(proposal&&m.id===liveId)setSceneEdit(changed?{id:m.id,staging:s,aspect}:null);
          else setPastEdits(p=>{const n={...p};if(changed)n[m.id]={staging:s,aspect};else delete n[m.id];return n;});
         }:undefined}/>}
        {m.kind==="proposal"&&(proposal&&m.id===liveId
         ?<ProposalCard proposal={proposal} tag={m.snapshot.tag} adjusted={sceneEdit?.id===m.id} selected={selected} onSelect={setSelected}
          drafted={draftedFor===m.id} onDraft={proposal.draft?()=>void approve(true):undefined}
          excludedReferences={excludedRefs} onToggleReference={id=>setExcludedRefs(prev=>{const n=new Set(prev);if(n.has(id))n.delete(id);else n.add(id);return n;})}
          aspect={aspectChoice??(sceneEdit?.id===m.id?sceneEdit.aspect:undefined)??m.snapshot.plan.camera?.aspectRatio} onAspect={setAspectChoice} busy={busy} onApprove={()=>void approve()} onMention={m.snapshot.tag?()=>changeGeneration(m.snapshot.tag!):undefined}/>
         :<PastProposalCard snapshot={m.snapshot} adjusted={Boolean(pastEdits[m.id])} busy={busy||reading||loadingProject}
          onBuildScene={pastEdits[m.id]&&m.snapshot.tag&&m.snapshot.plan.staging?()=>buildScene(m.id,m.snapshot.tag!,m.snapshot.plan.staging!,m.snapshot.plan.camera?.aspectRatio):undefined} onMention={m.snapshot.tag?()=>changeGeneration(m.snapshot.tag!):undefined}/>)}
        {m.kind==="no_model"&&<NoModelCard result={m.snapshot}/>}
        {/* The question is always the last item of the agent's message; it waits for an answer until something is sent after it. */}
        {m.kind==="question"&&<AgentQuestion question={m.snapshot.question} waiting={i===messages.length-1&&!busy} onAnswer={()=>promptRef.current?.focus()}
         choices={m.snapshot.choices} onChoose={reply=>answer(reply)}
         editCards={(m.snapshot.editCards??(m.snapshot.editCard?[m.snapshot.editCard]:[])).map((c:{tag:string;suggested?:SuggestedEdit[]})=>({tag:c.tag,thumbUrl:thumbFor(c.tag),...(c.suggested?{suggested:c.suggested}:{})}))}
         onEdit={(tag,suggested)=>void openEditFor(tag,suggested)}
         references={m.snapshot.references} uploaded={m.snapshot.references?Object.fromEntries(m.snapshot.references.angles.map(a=>[a.id,Boolean(slots.find(s=>s.id==="ref-"+m.id+"-"+a.id)?.attachmentId)])):undefined}
         onUpload={m.snapshot.references?a=>uploadForRequest(m.id,m.snapshot.references!,a):undefined}
         onContinue={m.snapshot.references&&i===messages.length-1&&!busy?()=>answer(replyScriptFor(m.text)==="finglish"?"aksa ro gozashtam":"عکس‌ها رو گذاشتم"):undefined}/>}
        {(m.kind==="proposal"||m.kind==="no_model")&&m.snapshot.plan?.clarifyingQuestionFa&&<AgentQuestion question={m.snapshot.plan.clarifyingQuestionFa} waiting={i===messages.length-1&&!busy} onAnswer={()=>promptRef.current?.focus()}/>}
        {reactions}
        <div className="-mt-2">{actions}</div>
       </div>;
      })}
      {editing&&editing.a.previewUrl&&<RegionEditor tag={editing.a.tag} photoUrl={editing.a.previewUrl} suggested={editing.suggested} onClose={()=>setEditing(null)} onDone={r=>void applyEdit(r)}/>}
      {waitingFor&&<div role="status" aria-live="polite" className="flex max-w-prose flex-col gap-2 rounded-card bg-surface-subtle p-3">
       <span className="type-body text-fg-primary">{WAITING_FA}</span>
       <ul className="flex flex-wrap gap-2">{waitingFor.map(a=>{const r=reviews[a.id];return <li key={a.id} className="relative size-16 overflow-hidden rounded-control bg-surface-hover">
        {/* eslint-disable-next-line @next/next/no-img-element -- a local blob: URL */}
        {a.previewUrl&&<img src={a.previewUrl} alt={displayTag(a.tag)} className="size-full object-cover"/>}
        {r?.state==="checking"?<span className="absolute inset-0 flex items-center justify-center bg-background/60"><ReviewRing progress={r.progress}/></span>:<PhotoReviewOverlay review={r}/>}
       </li>;})}</ul>
      </div>}
      {thinking&&<TurnProgress current={STAGE_TEXT[thinking.script][thinking.stage]} done={thinking.done} doneText={thinking.done.map(d=>STAGE_DONE_TEXT[thinking.script][d])} why={PLAN_FIRST_FA[thinking.script]}/>}
      <div ref={endRef}/>
     </div>
    </ScrollArea>
    {error&&<div className="mx-auto w-full max-w-3xl px-4 pb-2"><Alert variant="destructive" role="alert">
     <Icon icon={CircleAlert} aria-hidden="true"/>
     <AlertTitle>خطا</AlertTitle>
     <AlertDescription>{error}</AlertDescription>
    </Alert></div>}
    {/* The chip tray and the composer scroll together under the chat, so on a short screen the prompt and the send button stay reachable. */}
    <div className="scrollbar-right flex max-h-[64dvh] min-h-0 shrink-0 flex-col overflow-y-auto border-t border-line-tertiary bg-surface-base">
    <form ref={formRef} onSubmit={e=>void send(e)} className="mx-auto flex w-full max-w-3xl shrink-0 flex-col gap-3 bg-surface-base p-4">
     <AttachmentTray items={attachments} cards={cards.length} problems={problems} reading={reading} onDismiss={key=>setProblems(list=>list.filter(p=>p.key!==key))}/>
     <input ref={fileInput} type="file" multiple hidden accept={ATTACHMENT_ACCEPT} data-testid="attachment-input" onChange={e=>{const files=Array.from(e.target.files??[]),upload=pendingUpload.current,slot=pendingSlot.current;pendingUpload.current=undefined;pendingSlot.current=undefined;e.target.value="";e.target.multiple=true;const card=slot?slots.find(x=>x.id===slot):undefined;if(card)void fillSlot(card,files);else void addFiles(files,upload);}}/>
     <Label className="sr-only" id="whoush-prompt-label">توضیح تصویر یا ویدیو</Label>
     <MentionTextarea id="whoush-prompt" handleRef={promptRef} value={draft} onValueChange={setDraft} options={mentionOptions} onPaste={onPaste} placeholder="چی می‌خوای بسازیم؟" labelledBy="whoush-prompt-label" describedBy="prompt-hint" maxLength={4000}
      onSubmitShortcut={()=>{if(draft.trim()&&!busy&&!reading)formRef.current?.requestSubmit();}}
      startPad={COMPOSER_EXTRAS_ENABLED?"ps-40":"ps-24"}
      startAction={<div className="flex items-center">
       <InsertMenu disabled={reading} onPick={pickInsert}/>
       <TagPicker options={mentionOptions} onPick={mentionTag} main={mainSubject} onToggleMain={toggleMain}
        trigger={<button type="button" aria-label={TAG_PICKER_LABEL_FA} title={TAG_PICKER_LABEL_FA} className={COMPOSER_TOOL}><Icon icon={Hash} aria-hidden="true"/></button>}/>
       {COMPOSER_EXTRAS_ENABLED&&<>
        <EmojiPalette emojis={COMPOSER_EMOJIS} label="ایموجی" onPick={e=>promptRef.current?.insertText(e)}
         trigger={<button type="button" aria-label="ایموجی" title="ایموجی" className={COMPOSER_TOOL}><Icon icon={Smile} aria-hidden="true"/></button>}/>
        <GifPicker onPick={sendGif} trigger={<button type="button" aria-label="فرستادن گیف" title="گیف" className={COMPOSER_TOOL+" type-label"}>GIF</button>}/>
       </>}
      </div>}
      top={cards.length>0||draftRefs.length>0?<ul aria-label="پیوست‌ها" className="flex items-stretch gap-2 overflow-x-auto pb-2">
       {draftRefs.map(r=><MentionRefCard key={"ref-"+r.tag} tag={r.tag} thumbUrl={r.thumbUrl} kind={r.kind} label={r.label} onRemove={()=>dropMention(r.tag)}
        onPreview={r.file?()=>openViewer(r.file!):undefined}/>)}
       {cards.map(c=>c.type==="slot"
        ?<UploadSlotCard key={c.slot.id} slot={c.slot} disabled={reading} onUpload={()=>openSlotPicker(c.slot)} onDropFiles={f=>void fillSlot(c.slot,f)} onRemove={()=>dropSlot(c.slot.id)}/>
        :<AttachmentCard key={c.attachment.id} item={c.attachment} onBrush={()=>editAttachment(c.attachment,true)} review={reviews[c.attachment.id]} onRetryReview={()=>void checkPhoto(c.attachment,true)} onChange={patch=>patchAttachment(c.attachment.id,patch)} onRemove={()=>removeAttachment(c.attachment.id)} onPreview={()=>openViewer(c.attachment)} onMention={()=>mentionTag(c.attachment.tag)}
         main={mainSubject===c.attachment.tag} onToggleMain={()=>toggleMain(c.attachment.tag)}/>)}
      </ul>:undefined}
      endPad={voice.enabled?"pe-24":"pe-14"}
      // The blue button always sends. Beside it, a borderless mic opens voice mode when the server can transcribe (the transcript is sent like a typed message).
      endAction={<div className="flex items-center gap-1">
       {voice.enabled&&<button type="button" disabled={busy||reading||loadingProject} onClick={()=>setVoiceOpen(true)} aria-label="پیام صوتی" title="پیام صوتی"
        className={COMPOSER_TOOL+" disabled:pointer-events-none disabled:opacity-50"}><Icon icon={Mic} aria-hidden="true"/></button>}
       <Button type="submit" size="icon" className={SEND_TONE[mode]} disabled={busy||reading||!draft.trim()} aria-busy={busy||undefined} aria-label={busy?"در حال ارسال…":"ارسال"} title="ارسال">
        <Icon icon={busy?LoaderCircle:ArrowUp} aria-hidden="true" className={busy?"animate-spin motion-reduce:animate-none":undefined}/>
       </Button>
      </div>}/>
     <VoiceMode open={voiceOpen} maxSeconds={voice.maxSeconds} onClose={()=>setVoiceOpen(false)} onTranscript={text=>answer(text)}/>
     {mainSubject&&<p role="status" className="flex w-fit items-center gap-1.5 rounded-control bg-surface-selected py-0.5 ps-2 pe-0.5 type-caption text-fg-primary">
      <Icon icon={Star} size={16} aria-hidden="true" className="size-3.5 shrink-0 fill-current text-primary"/>{MAIN_SUBJECT_FA}: <bdi className="type-label">{shownTag(mainSubject)}</bdi>
      <button type="button" onClick={()=>setMainSubject(null)} aria-label={"برداشتن "+MAIN_SUBJECT_FA} className="hit-area flex size-6 items-center justify-center rounded-control text-fg-secondary motion-hover hover:bg-surface-hover hover:text-fg-primary focus-visible:outline-2 focus-visible:outline-ring"><Icon icon={X} size={16} aria-hidden="true" className="size-3.5"/></button>
     </p>}
     <p id="prompt-hint" className="flex items-start gap-1 type-caption text-fg-secondary"><Icon icon={Info} size={16} aria-hidden="true" className="mt-0.5 shrink-0"/>با # می‌تونی به پیوست‌ها اشاره کنی؛ با ستاره یکی رو {MAIN_SUBJECT_FA} کن (اختیاری).</p>
     <div className="flex flex-wrap items-start gap-2">
      <ModeControl value={mode} onChange={changeMode} notify={Boolean(proposal)}/>
      <StyleControl value={style} onChange={changeStyle}/>
     </div>
    </form>
    </div>
   </section>
   <MediaViewer items={viewer?.items??[]} index={viewer?viewer.index:null} onIndexChange={i=>setViewer(v=>v&&{...v,index:i})} onClose={()=>setViewer(null)} onEdit={busy?undefined:editFromViewer}
    projectTitleOf={()=>viewer?.title}
    restoreFocusTo={item=>document.querySelector<HTMLElement>('[data-viewer-open="'+CSS.escape(item.id)+'"]')}/>
   <CharacterDialog open={charactersOpen} onOpenChange={setCharactersOpen} characters={characters} loaded={charactersLoaded} selectedId={characterId} onPick={pickCharacter}/>
  </main>
 </RailShell>;
}
