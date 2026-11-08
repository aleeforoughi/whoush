"use client";
import {useEffect,useState,type FormEvent} from "react";
import Link from "next/link";
import {FolderOpen,MoreHorizontal,Pencil,Trash2} from "lucide-react";
import {Button,Dialog,DialogBody,DialogClose,DialogContent,DialogDescription,DialogFooter,DialogHeader,DialogTitle,DropdownMenu,DropdownMenuContent,DropdownMenuItem,DropdownMenuTrigger,Icon,Input,Label,Popover,PopoverContent,PopoverTrigger,ScrollArea,Skeleton,Tooltip,TooltipContent,TooltipTrigger,buttonVariants,cn} from "@aleeforoughi/feather-react";
import {deleteProject,listProjects,renameProject,subscribeProjects} from "@/lib/project-store";
import {MAX_TITLE,cleanTitle,relativeTimeFa,type ProjectSummary} from "@/lib/projects";

/** The projects in this browser, newest first; refreshes whenever one is saved, renamed or deleted (also from another tab). `null` while loading. */
export function useProjects():{projects:ProjectSummary[]|null;error:string}{
 const [projects,setProjects]=useState<ProjectSummary[]|null>(null);
 const [error,setError]=useState("");
 useEffect(()=>{
  let alive=true;
  const load=()=>listProjects().then(list=>{if(alive){setProjects(list);setError("");}}).catch(e=>{if(alive){setProjects([]);setError(e instanceof Error?e.message:"خواندن پروژه‌ها ناموفق بود.");}});
  void load();
  const off=subscribeProjects(()=>void load());
  return()=>{alive=false;off();};
 },[]);
 return {projects,error};
}

type Pending={kind:"rename"|"delete";project:ProjectSummary}|null;

function ProjectRow({project,active,onNavigate,onAction}:{project:ProjectSummary;active:boolean;onNavigate?:()=>void;onAction:(kind:"rename"|"delete")=>void}){
 const link=<Link href={"/studio?project="+project.id} aria-current={active?"page":undefined} onClick={onNavigate}
  className={cn(buttonVariants({variant:"ghost"}),"h-auto min-h-control min-w-0 flex-1 flex-col items-start justify-center gap-0 py-1 text-start",active&&"bg-surface-selected")}>
  <span className="block w-full truncate type-label">{project.title}</span>
  <span className="type-caption text-fg-secondary">{relativeTimeFa(project.updatedAt)}</span>
 </Link>;
 return <li className="flex items-center gap-1">
  <Tooltip><TooltipTrigger render={link}/><TooltipContent side="inline-end" className="max-w-64 break-words">{project.title}</TooltipContent></Tooltip>
  <DropdownMenu>
   <DropdownMenuTrigger render={<Button type="button" variant="ghost" size="icon" aria-label={"گزینه‌های پروژهٔ «"+project.title+"»"}/>}><Icon icon={MoreHorizontal} aria-hidden="true"/></DropdownMenuTrigger>
   <DropdownMenuContent align="start" className="w-40">
    <DropdownMenuItem onClick={()=>onAction("rename")}><Icon icon={Pencil} aria-hidden="true"/>تغییر نام</DropdownMenuItem>
    <DropdownMenuItem variant="destructive" onClick={()=>onAction("delete")}><Icon icon={Trash2} aria-hidden="true"/>حذف</DropdownMenuItem>
   </DropdownMenuContent>
  </DropdownMenu>
 </li>;
}

function List({projects,error,activeId,onNavigate,onAction}:{projects:ProjectSummary[]|null;error:string;activeId?:string|null;onNavigate?:()=>void;onAction:(p:Pending)=>void}){
 if(projects===null)return <div role="status" aria-label="در حال خواندن پروژه‌ها" className="flex flex-col gap-2 px-1"><Skeleton className="h-10 w-full"/><Skeleton className="h-10 w-full"/></div>;
 if(error)return <p role="alert" className="px-3 type-body-sm text-destructive">{error}</p>;
 if(projects.length===0)return <p className="px-3 type-body-sm text-fg-secondary">هنوز پروژه‌ای نداری؛ اولین پیام، پروژه را می‌سازد.</p>;
 return <ul className="flex flex-col gap-1">{projects.map(p=><ProjectRow key={p.id} project={p} active={p.id===activeId} onNavigate={onNavigate} onAction={kind=>onAction({kind,project:p})}/>)}</ul>;
}

function RenameDialog({project,onClose,onRenamed}:{project:ProjectSummary|null;onClose:()=>void;onRenamed:(id:string)=>void}){
 const [value,setValue]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 const [seen,setSeen]=useState<string|null>(null);
 // Each time the dialog opens for a project, start from its current title.
 if((project?.id??null)!==seen){setSeen(project?.id??null);setValue(project?.title??"");setError("");}
 async function submit(e:FormEvent){
  e.preventDefault();if(!project||busy)return;
  const title=cleanTitle(value);
  if(!title){setError("عنوان باید بین ۱ تا "+MAX_TITLE.toLocaleString("fa-IR")+" نویسه باشد.");return;}
  setBusy(true);
  try{await renameProject(project.id,title);onRenamed(project.id);onClose();}
  catch(err){setError(err instanceof Error?err.message:"تغییر نام ناموفق بود.");}
  finally{setBusy(false);}
 }
 return <Dialog open={project!==null} onOpenChange={o=>{if(!o)onClose();}}>
  <DialogContent showCloseButton={false} className="sm:max-w-md">
   <form onSubmit={e=>void submit(e)} className="grid">
    <DialogHeader><DialogTitle>تغییر نام پروژه</DialogTitle><DialogDescription>نام تازه فقط در همین مرورگر ذخیره می‌شود.</DialogDescription></DialogHeader>
    <DialogBody>
     <Label htmlFor="project-title">نام پروژه</Label>
     <Input id="project-title" value={value} onChange={e=>{setValue(e.target.value);setError("");}} maxLength={MAX_TITLE} aria-invalid={error?true:undefined} aria-describedby={error?"project-title-error":undefined} autoComplete="off"/>
     {error&&<p id="project-title-error" role="alert" className="type-caption text-destructive">{error}</p>}
    </DialogBody>
    <DialogFooter>
     <Button type="submit" disabled={busy||!value.trim()}>ذخیره</Button>
     <DialogClose render={<Button type="button" variant="outline"/>}>انصراف</DialogClose>
    </DialogFooter>
   </form>
  </DialogContent>
 </Dialog>;
}

function DeleteDialog({project,onClose,onDeleted}:{project:ProjectSummary|null;onClose:()=>void;onDeleted:(id:string)=>void}){
 const [error,setError]=useState(""),[busy,setBusy]=useState(false);
 async function confirm(){
  if(!project||busy)return;
  setBusy(true);setError("");
  try{await deleteProject(project.id);onDeleted(project.id);onClose();}
  catch(err){setError(err instanceof Error?err.message:"حذف ناموفق بود.");}
  finally{setBusy(false);}
 }
 return <Dialog open={project!==null} onOpenChange={o=>{if(!o){setError("");onClose();}}}>
  <DialogContent showCloseButton={false} className="sm:max-w-md">
   <DialogHeader>
    <DialogTitle>حذف پروژه</DialogTitle>
    <DialogDescription>پروژه و همهٔ فایل‌هایش از این مرورگر حذف شود؟</DialogDescription>
   </DialogHeader>
   <DialogBody>
    <p className="break-words type-body-sm text-fg-primary">«{project?.title}»</p>
    <p className="type-caption text-fg-secondary">این کار برگشت‌پذیر نیست.</p>
    {error&&<p role="alert" className="type-caption text-destructive">{error}</p>}
   </DialogBody>
   <DialogFooter>
    <Button type="button" variant="destructive" disabled={busy} onClick={()=>void confirm()}><Icon icon={Trash2} aria-hidden="true"/>حذف</Button>
    <DialogClose render={<Button type="button" variant="outline"/>}>انصراف</DialogClose>
   </DialogFooter>
  </DialogContent>
 </Dialog>;
}

/**
 * «پروژه‌ها» in the rail: the recent projects (the active one is `aria-current="page"`), each with a «تغییر نام / حذف» menu, and the note that they live only in this browser.
 * `always` (mobile menu) and `lg` rails show the list; on the tablet icon rail one button opens it in a popover.
 */
export function ProjectsSection({mode,activeId,onNavigate,onDeleted}:{mode:"always"|"responsive";activeId?:string|null;onNavigate?:()=>void;onDeleted?:(id:string)=>void}){
 const {projects,error}=useProjects();
 const [pending,setPending]=useState<Pending>(null);
 const [popover,setPopover]=useState(false);
 const list=<List projects={projects} error={error} activeId={activeId} onNavigate={()=>{setPopover(false);onNavigate?.();}} onAction={setPending}/>;
 const note=<p className="px-3 type-caption text-fg-secondary">فقط در همین مرورگر</p>;
 const full=<section aria-labelledby="rail-projects" className={cn("min-h-0 flex-1 flex-col gap-2",mode==="always"?"flex":"hidden lg:flex")}>
  <h2 id="rail-projects" className="px-3 type-label text-fg-secondary">پروژه‌ها</h2>
  <ScrollArea className="min-h-0 flex-1">{list}</ScrollArea>
  {note}
 </section>;
 return <>
  {full}
  {mode==="responsive"&&<div className="lg:hidden">
   <Popover open={popover} onOpenChange={setPopover}>
    <Tooltip>
     <TooltipTrigger render={<PopoverTrigger render={<Button type="button" variant="ghost" aria-label="پروژه‌ها" className="w-full justify-start"/>}><Icon icon={FolderOpen} aria-hidden="true"/></PopoverTrigger>}/>
     <TooltipContent side="inline-end">پروژه‌ها</TooltipContent>
    </Tooltip>
    <PopoverContent side="inline-end" align="start" className="w-72">
     <h2 className="type-label text-fg-primary">پروژه‌ها</h2>
     <ScrollArea className="max-h-80">{list}</ScrollArea>
     {note}
    </PopoverContent>
   </Popover>
  </div>}
  <RenameDialog project={pending?.kind==="rename"?pending.project:null} onClose={()=>setPending(null)} onRenamed={()=>setPopover(false)}/>
  <DeleteDialog project={pending?.kind==="delete"?pending.project:null} onClose={()=>setPending(null)} onDeleted={id=>{setPopover(false);onDeleted?.(id);}}/>
 </>;
}
