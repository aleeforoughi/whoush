"use client";
import {useRef} from "react";
import Image from "next/image";
import {CircleAlert,ImagePlus,Trash2,UserRound} from "lucide-react";
import {Badge,Button,Card,CardAction,CardContent,CardDescription,CardHeader,CardTitle,Icon} from "@aleeforoughi/feather-react";
import {characterCoverage,characterUsability,referenceWarnings,type CharacterProfile,type CharacterView,type ReferenceMeta} from "@/lib/characters";
import {CHARACTER_VIEWS} from "@/lib/characters";
import {fa,faBytes,faDate,faDimensions} from "@/lib/format";

type ViewDef=typeof CHARACTER_VIEWS[number];

/** One of the six angles: guide, preview, stored size, soft quality warnings and the file actions. */
export function ReferenceCard({view,url,meta,onPick,onRemove}:{view:ViewDef;url?:string;meta?:ReferenceMeta;onPick:(file?:File)=>void;onRemove:()=>void}){
 const input=useRef<HTMLInputElement>(null);
 const warnings=meta?referenceWarnings(view.id as CharacterView,meta):[];
 return <Card className="h-full">
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
   {meta&&<p className="type-caption text-fg-secondary"><bdi dir="ltr">{faDimensions(meta.width,meta.height)}</bdi> پیکسل · {faBytes(meta.bytes)}</p>}
   {warnings.length>0&&<ul className="flex flex-col gap-1">
    {warnings.map(w=><li key={w} className="flex items-start gap-2 type-caption text-fg-primary"><Icon icon={CircleAlert} size={16} className="shrink-0 text-fg-secondary" aria-hidden="true"/>{w}</li>)}
   </ul>}
   <input ref={input} hidden type="file" accept="image/jpeg,image/png,image/webp" aria-label={"آپلود "+view.title} onChange={e=>{onPick(e.target.files?.[0]);e.target.value="";}}/>
   <div className="flex flex-wrap gap-2">
    <Button variant="outline" onClick={()=>input.current?.click()}><Icon icon={ImagePlus} aria-hidden="true"/>{url?"تعویض عکس":"آپلود عکس"}</Button>
    {url&&<Button variant="ghost" size="icon" aria-label={"حذف "+view.title} onClick={onRemove}><Icon icon={Trash2} aria-hidden="true"/></Button>}
   </div>
  </CardContent>
 </Card>;
}

/** Library rows: front-view thumbnail, name, coverage, version, last update and consent state. */
export function CharacterLibrary({profiles,thumbs,activeId,onSelect}:{profiles:CharacterProfile[];thumbs:Record<string,string>;activeId:string|null;onSelect:(p:CharacterProfile)=>void}){
 return <ul className="flex flex-col gap-2">
  {profiles.map(p=>{
   const cov=characterCoverage(p.references),usable=characterUsability(p),thumb=thumbs[p.id];
   return <li key={p.id}>
    <Button variant={activeId===p.id?"secondary":"ghost"} aria-pressed={activeId===p.id} onClick={()=>onSelect(p)} className="h-auto min-h-control w-full justify-start gap-3 py-2 text-start whitespace-normal">
     <span className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-control border border-line-secondary bg-surface-subtle">
      {thumb?<Image src={thumb} alt="" fill unoptimized sizes="48px" className="object-cover"/>:<Icon icon={UserRound} className="text-fg-secondary" aria-hidden="true"/>}
     </span>
     <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
      <span className="w-full truncate type-label text-fg-primary">{p.name}</span>
      <span className="type-caption text-fg-secondary">ضروری {fa(cov.requiredCount)} از {fa(cov.requiredTotal)} · اختیاری {fa(cov.optionalCount)} از {fa(cov.optionalTotal)}</span>
      <span className="type-caption text-fg-secondary">نسخهٔ {fa(p.version)} · {faDate(p.updatedAt)}</span>
      {!usable.ok&&<Badge variant="outline">آمادهٔ استفاده نیست</Badge>}
     </span>
    </Button>
   </li>;
  })}
 </ul>;
}
