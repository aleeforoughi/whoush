"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {useRouter,useSearchParams} from "next/navigation";
import {AudioLines,CircleAlert,FileJson,FileText,Film,FileQuestion,Images,Info,Play} from "lucide-react";
import {Alert,AlertDescription,AlertTitle,Badge,Button,Card,CardContent,Icon,Select,SelectContent,SelectItem,SelectTrigger,SelectValue,Skeleton,Tabs,TabsList,TabsTrigger} from "@aleeforoughi/feather-react";
import {AUTO_ROLE_FA,AttachmentPreview} from "@/components/attachment-chip";
import {useProjects} from "@/components/projects-section";
import {ShareActions} from "@/components/share-actions";
import {RailShell} from "@/components/studio-rail";
import {ATTACHMENT_KINDS,displayTag,roleLabelFa,type AttachmentKind} from "@/lib/attachments";
import {fa,faBytes,faDimensions,faDuration} from "@/lib/format";
import {listAssets,subscribeProjects} from "@/lib/project-store";
import {ASSET_FILTERS,LOCAL_ONLY_FA,UNTITLED_FA,assetToAttachment,filterAssets,parseKindFilter,relativeTimeFa,sortAssets,type AssetKindFilter,type StoredAsset} from "@/lib/projects";

const ALL="all";
const NONE:StoredAsset[]=[];
const NO_URLS=new Map<string,string>();
const ICONS:Record<AttachmentKind,typeof FileText>={image:Images,video:Film,audio:AudioLines,pdf:FileText,json:FileJson,md:FileText};

function Thumb({asset,url}:{asset:StoredAsset;url?:string}){
 const frame="relative flex aspect-4/3 w-full items-center justify-center overflow-hidden bg-surface-subtle text-fg-secondary";
 if(!asset.blob||!url)return <span className={frame+" flex-col gap-2 p-3 text-center"}>
  <Icon icon={FileQuestion} size={32} aria-hidden="true"/><span className="type-caption">فایل در این مرورگر موجود نیست</span>
 </span>;
 // eslint-disable-next-line @next/next/no-img-element -- a local blob: URL; next/image cannot optimize it
 if(asset.kind==="image")return <span className={frame}><img src={url} alt="" className="size-full object-cover"/></span>;
 if(asset.kind==="video")return <span className={frame}>
  <video src={url+"#t=0.1"} preload="metadata" muted playsInline aria-hidden="true" tabIndex={-1} className="size-full object-cover"/>
  <span className="absolute inset-0 flex items-center justify-center"><Icon icon={Play} size={32} aria-hidden="true" className="text-fg-primary"/></span>
 </span>;
 return <span className={frame}><Icon icon={ICONS[asset.kind]} size={32} aria-hidden="true"/></span>;
}

function AssetCard({asset,url,projectTitle,onOpen}:{asset:StoredAsset;url?:string;projectTitle:string;onOpen:()=>void}){
 const media=asset.kind==="image"||asset.kind==="video"||asset.kind==="audio";
 const label=(media?"پیش‌نمایش ":"جزئیات ")+displayTag(asset.tag)+" از پروژهٔ "+projectTitle;
 return <li className="min-w-0"><Card className="h-full">
  {/* The preview button and the project link are siblings, never nested. */}
  <button type="button" onClick={onOpen} aria-label={label} className="flex min-w-0 flex-1 flex-col text-start motion-hover not-disabled:hover:bg-surface-hover">
   <Thumb asset={asset} url={url}/>
   <span className="flex min-w-0 flex-col gap-1 p-3">
    <span className="type-label text-fg-primary"><bdi>{displayTag(asset.tag)}</bdi></span>
    {media&&<span className="type-caption text-fg-secondary">{asset.role?roleLabelFa(asset.role,asset.kind):AUTO_ROLE_FA}</span>}
    <span className="type-caption text-fg-secondary">
     {ATTACHMENT_KINDS[asset.kind].labelFa} · {faBytes(asset.bytes)}
     {asset.durationSeconds!==undefined&&<> · <bdi>{faDuration(asset.durationSeconds)}</bdi></>}
     {asset.width!==undefined&&asset.height!==undefined&&<> · <bdi>{faDimensions(asset.width,asset.height)}</bdi></>}
    </span>
    <span className="type-caption text-fg-secondary">{relativeTimeFa(asset.createdAt)}</span>
   </span>
  </button>
  <div className="flex min-w-0 px-3 pb-3 pt-0">
   <Badge variant="secondary" render={<Link href={"/studio?project="+asset.projectId} aria-label={"باز کردن پروژهٔ "+projectTitle}/>} className="max-w-full"><span className="min-w-0 truncate">{projectTitle}</span></Badge>
  </div>
  <div className="min-w-0 px-3 pb-3">
   <ShareActions compact file={{blob:asset.blob,name:asset.name,mime:asset.mime,kind:asset.kind,tag:asset.tag,width:asset.width,height:asset.height,durationSeconds:asset.durationSeconds,projectTitle}}/>
  </div>
 </Card></li>;
}

/** «دارایی‌ها»: every file uploaded in a project, from this browser's storage. Generated outputs will join once real generation is enabled. */
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
 const open=assets?.find(a=>a.id===openId)??null;
 const openItem=open?assetToAttachment(open,urls.get(open.id)):null;
 return <RailShell current="assets" onNewChat={()=>router.push("/studio")}>
  <main id="main" className="min-h-0 flex-1 overflow-y-auto">
   <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 lg:p-6">
    <div className="flex flex-col gap-1">
     <h1 className="font-heading type-headline text-fg-primary">دارایی‌ها</h1>
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
     ?<div role="status" aria-label="در حال خواندن فایل‌ها" className="grid grid-cols-1 gap-4 min-[390px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4"><Skeleton className="aspect-4/3 w-full"/><Skeleton className="aspect-4/3 w-full"/></div>
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
       :<ul aria-label="فایل‌ها" className="grid grid-cols-1 gap-4 min-[390px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
        {shown.map(a=><AssetCard key={a.id} asset={a} url={urls.get(a.id)} projectTitle={titles.get(a.projectId)??UNTITLED_FA} onOpen={()=>setOpenId(a.id)}/>)}
       </ul>}
   </div>
  </main>
  <AttachmentPreview item={openItem} onClose={()=>setOpenId(null)} blobFor={id=>assets?.find(a=>a.id===id)?.blob} projectTitle={open?titles.get(open.projectId):undefined}/>
 </RailShell>;
}
