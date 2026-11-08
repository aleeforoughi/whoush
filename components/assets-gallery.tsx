"use client";
import {VideoThumb} from "@/components/video-poster";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {useRouter,useSearchParams} from "next/navigation";
import {AudioLines,CircleAlert,FileJson,FileText,Film,FileQuestion,Images,Info,Play} from "lucide-react";
import {Alert,AlertDescription,AlertTitle,Badge,Button,Card,CardContent,Icon,Select,SelectContent,SelectItem,SelectTrigger,SelectValue,Skeleton,Tabs,TabsList,TabsTrigger} from "@aleeforoughi/feather-react";
import {AUTO_ROLE_FA} from "@/components/attachment-chip";
import {MediaViewer,VIEWER_LABEL_FA,type ViewerItem} from "@/components/media-viewer";
import {useProjects} from "@/components/projects-section";
import {MISSING_FILE_FA,ShareActions} from "@/components/share-actions";
import {RailShell} from "@/components/studio-rail";
import {ATTACHMENT_KINDS,displayTag,roleLabelFa,type AttachmentKind} from "@/lib/attachments";
import {fa,faBytes,faDimensions,faDuration} from "@/lib/format";
import {listAssets,subscribeProjects} from "@/lib/project-store";
import {ASSET_FILTERS,LOCAL_ONLY_FA,UNTITLED_FA,filterAssets,parseKindFilter,relativeTimeFa,sortAssets,type AssetKindFilter,type StoredAsset} from "@/lib/projects";

const ALL="all";
const NONE:StoredAsset[]=[];
const NO_URLS=new Map<string,string>();
/** Media-first grid: one column below 480px, two from 480px, three from lg, four only from 2xl. */
const GRID="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4";
const ICONS:Record<AttachmentKind,typeof FileText>={image:Images,video:Film,audio:AudioLines,pdf:FileText,json:FileJson,md:FileText};

/** The picture, the poster frame of a video or a large kind icon, filling its 4:5 box. */
function MediaFill({asset,url}:{asset:StoredAsset;url?:string}){
 const center="flex size-full flex-col items-center justify-center gap-2 bg-surface-subtle p-3 text-center text-fg-secondary";
 if(!asset.blob||!url)return <span className={center}>
  <Icon icon={FileQuestion} size={32} aria-hidden="true" className="size-12"/><span className="type-caption">{MISSING_FILE_FA}</span>
 </span>;
 // eslint-disable-next-line @next/next/no-img-element -- a local blob: URL; next/image cannot optimize it
 if(asset.kind==="image")return <img src={url} alt="" className="size-full object-cover"/>;
 if(asset.kind==="video")return <span className="relative block size-full bg-surface-subtle">
  <VideoThumb url={url} className="size-full object-cover"/>
  <span className="absolute inset-0 flex items-center justify-center">
   <span className="flex size-16 items-center justify-center rounded-card bg-background/70 text-fg-primary"><Icon icon={Play} size={32} aria-hidden="true"/></span>
  </span>
 </span>;
 return <span className={center}><Icon icon={ICONS[asset.kind]} size={32} aria-hidden="true" className="size-16"/></span>;
}

/** A media-first card: the file fills a 4:5 area that opens the full-screen viewer, with its tag, actions and duration laid over it and a compact strip below. */
function AssetCard({asset,url,projectTitle,onOpen}:{asset:StoredAsset;url?:string;projectTitle:string;onOpen:()=>void}){
 const media=asset.kind==="image"||asset.kind==="video"||asset.kind==="audio";
 const label=VIEWER_LABEL_FA+" "+displayTag(asset.tag)+" از پروژهٔ "+projectTitle;
 const picture=asset.kind==="image"||asset.kind==="video";
 return <li className="min-w-0"><Card className="h-full">
  {/* The open button, the share buttons and the project link are siblings, never nested. */}
  <div className="relative aspect-4/5 w-full overflow-hidden rounded-t-card bg-surface-subtle">
   <button type="button" onClick={onOpen} data-viewer-open={asset.id} aria-label={label} className="absolute inset-0 block size-full text-start motion-hover focus-visible:-outline-offset-2 not-disabled:hover:opacity-90">
    <MediaFill asset={asset} url={url}/>
   </button>
   {picture&&<span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t from-background/80 to-background/0"/>}
   <Badge variant="secondary" className="pointer-events-none absolute start-2 top-2 max-w-[calc(100%-7.5rem)]"><bdi className="truncate">{displayTag(asset.tag)}</bdi></Badge>
   <div className="absolute end-2 top-2"><ShareActions overlay instagram={false} file={{blob:asset.blob,name:asset.name,mime:asset.mime,kind:asset.kind,tag:asset.tag,width:asset.width,height:asset.height,durationSeconds:asset.durationSeconds,projectTitle}}/></div>
   {(asset.kind==="video"||asset.kind==="audio")&&asset.durationSeconds!==undefined&&<Badge variant="secondary" className="pointer-events-none absolute bottom-2 end-2"><bdi>{faDuration(asset.durationSeconds)}</bdi></Badge>}
  </div>
  <div className="flex min-w-0 flex-col gap-1 p-3">
   <div className="flex min-w-0 items-center justify-between gap-2">
    <Badge variant="secondary" render={<Link href={"/studio?project="+asset.projectId} aria-label={"باز کردن پروژهٔ "+projectTitle}/>} className="min-w-0 max-w-full"><span className="min-w-0 truncate">{projectTitle}</span></Badge>
    <span className="shrink-0 type-caption text-fg-secondary">{relativeTimeFa(asset.createdAt)}</span>
   </div>
   <span className="type-caption text-fg-secondary">
    {media?(asset.role?roleLabelFa(asset.role,asset.kind):AUTO_ROLE_FA):ATTACHMENT_KINDS[asset.kind].labelFa} · {faBytes(asset.bytes)}
    {asset.width!==undefined&&asset.height!==undefined&&<> · <bdi>{faDimensions(asset.width,asset.height)}</bdi></>}
   </span>
  </div>
 </Card></li>;
}

/** «گالری»: every file uploaded in a project, from this browser's storage. Generated outputs will join once real generation is enabled. */
export function AssetsGallery(){
 const router=useRouter();
 const params=useSearchParams();
 const {projects}=useProjects();
 const [data,setData]=useState<{assets:StoredAsset[];urls:Map<string,string>}|null>(null);
 const [error,setError]=useState("");
 const [openId,setOpenId]=useState<string|null>(null);
 const assets=data?.assets??null,urls=data?.urls??NO_URLS;
 // Object URLs for the stored blobs are made with each load and revoked when the next load replaces them or the page closes.
 useEffect(()=>()=>data?.urls.forEach(u=>URL.revokeObjectURL(u)),[data]);
 useEffect(()=>{
  let alive=true;
  const load=()=>listAssets().then(list=>{
   const sorted=sortAssets(list),made=new Map<string,string>();
   for(const a of sorted)if(a.blob)made.set(a.id,URL.createObjectURL(a.blob));
   if(!alive){made.forEach(u=>URL.revokeObjectURL(u));return;}
   setData({assets:sorted,urls:made});setError("");
  }).catch(e=>{if(alive){setData({assets:[],urls:new Map()});setError(e instanceof Error?e.message:"خواندن فایل‌ها ناموفق بود.");}});
  void load();
  const off=subscribeProjects(()=>void load());
  return()=>{alive=false;off();};
 },[]);
 const titles=useMemo(()=>new Map((projects??[]).map(p=>[p.id,p.title])),[projects]);
 const kind=parseKindFilter(params.get("kind"));
 const wanted=params.get("project");
 // A project id that no longer exists (or is not loaded yet) filters nothing.
 const projectId=wanted&&titles.has(wanted)?wanted:null;
 function setFilter(next:{kind?:AssetKindFilter;project?:string|null}){
  const q=new URLSearchParams(params.toString());
  const k=next.kind??kind,p=next.project===undefined?projectId:next.project;
  if(k==="all")q.delete("kind");else q.set("kind",k);
  if(p)q.set("project",p);else q.delete("project");
  const qs=q.toString();
  router.replace("/assets"+(qs?"?"+qs:""),{scroll:false});
 }
 const all=assets??NONE;
 const inProject=filterAssets(all,{projectId});
 const shown=filterAssets(inProject,{kind});
 const count=(k:AssetKindFilter)=>filterAssets(inProject,{kind:k}).length;
 const options=[{value:ALL,label:"همهٔ پروژه‌ها"},...(projects??[]).map(p=>({value:p.id,label:p.title}))];
 // The viewer steps through the filtered list the person sees.
 const viewerItems:ViewerItem[]=shown.map(a=>({id:a.id,kind:a.kind,mime:a.mime,bytes:a.bytes,name:a.name,tag:a.tag,role:a.role,width:a.width,height:a.height,durationSeconds:a.durationSeconds,projectId:a.projectId,url:urls.get(a.id),blob:a.blob}));
 const openIndex=openId===null?-1:shown.findIndex(a=>a.id===openId);
 return <RailShell current="assets" onNewChat={()=>router.push("/studio")}>
  <main id="main" className="scrollbar-right min-h-0 flex-1 overflow-y-auto">
   <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 lg:p-6">
    <div className="flex flex-col gap-1">
     <h1 className="font-heading type-headline text-fg-primary">گالری</h1>
     <p className="type-body-sm text-fg-secondary">فایل‌هایی که در استودیو آپلود کرده‌ای، به تفکیک پروژه. {LOCAL_ONLY_FA}.</p>
    </div>
    <Card size="sm"><CardContent className="flex items-start gap-2">
     <Icon icon={Info} aria-hidden="true" className="mt-0.5 shrink-0 text-fg-secondary"/>
     <p className="type-body-sm text-fg-secondary">خروجی‌های تولیدشده پس از فعال شدن تولید واقعی هم اینجا نمایش داده می‌شوند.</p>
    </CardContent></Card>
    {error&&<Alert variant="destructive" role="alert"><Icon icon={CircleAlert} aria-hidden="true"/><AlertTitle>خطا</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
    {assets!==null&&all.length>0&&<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
     <Tabs value={kind} onValueChange={v=>setFilter({kind:parseKindFilter(v)})}>
      <TabsList aria-label="نوع فایل" className="h-auto w-full flex-wrap sm:w-fit">
       {ASSET_FILTERS.map(f=><TabsTrigger key={f.id} value={f.id} className="min-w-fit">{f.labelFa} ({fa(count(f.id))})</TabsTrigger>)}
      </TabsList>
     </Tabs>
     <Select value={projectId??ALL} onValueChange={v=>setFilter({project:v===ALL?null:String(v)})} items={options}>
      <SelectTrigger aria-label="پروژه" className="w-full max-w-full sm:w-64"><SelectValue/></SelectTrigger>
      <SelectContent>{options.map(o=><SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
     </Select>
    </div>}
    {assets===null
     ?<div role="status" aria-label="در حال خواندن فایل‌ها" className={GRID}><Skeleton className="aspect-4/5 w-full"/><Skeleton className="aspect-4/5 w-full"/></div>
     :all.length===0
      ?<Card><CardContent className="flex flex-col items-start gap-3">
       <p className="type-body text-fg-primary">هنوز فایلی آپلود نکرده‌ای. در استودیو با دکمهٔ + فایل اضافه کن.</p>
       <Button variant="outline" render={<Link href="/studio"/>} nativeButton={false}>رفتن به استودیو</Button>
      </CardContent></Card>
      :shown.length===0
       ?<Card><CardContent className="flex flex-col items-start gap-3">
        <p className="type-body text-fg-primary">فایلی با این فیلترها پیدا نشد.</p>
        <Button variant="outline" onClick={()=>router.replace("/assets",{scroll:false})}>پاک کردن فیلترها</Button>
       </CardContent></Card>
       :<ul aria-label="فایل‌ها" className={GRID}>
        {shown.map(a=><AssetCard key={a.id} asset={a} url={urls.get(a.id)} projectTitle={titles.get(a.projectId)??UNTITLED_FA} onOpen={()=>setOpenId(a.id)}/>)}
       </ul>}
   </div>
  </main>
  <MediaViewer items={viewerItems} index={openIndex>=0?openIndex:null} onIndexChange={i=>setOpenId(shown[i]?.id??null)} onClose={()=>setOpenId(null)}
   projectTitleOf={item=>item.projectId?titles.get(item.projectId)??UNTITLED_FA:undefined}
   restoreFocusTo={item=>document.querySelector<HTMLElement>('[data-viewer-open="'+CSS.escape(item.id)+'"]')}/>
 </RailShell>;
}
