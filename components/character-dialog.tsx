"use client";
import Link from "next/link";
import {Plus,UserRound} from "lucide-react";
import {Button,Dialog,DialogBody,DialogClose,DialogContent,DialogDescription,DialogFooter,DialogHeader,DialogTitle,Icon} from "@aleeforoughi/feather-react";
import {characterCoverage,characterUsability,type CharacterProfile} from "@/lib/characters";
import {fa} from "@/lib/format";

/**
 * «کاراکترهای من»: the browser-local characters. Only profiles with every required view and a current consent can be chosen; the others are listed disabled
 * with the reason. With none saved, an empty state links to the Character Studio.
 */
export function CharacterDialog({open,onOpenChange,characters,loaded,selectedId,onPick}:{open:boolean;onOpenChange:(open:boolean)=>void;characters:readonly CharacterProfile[];loaded:boolean;selectedId:string|null;onPick:(id:string|null)=>void}){
 const choose=(id:string|null)=>{onPick(id);onOpenChange(false);};
 return <Dialog open={open} onOpenChange={onOpenChange}>
  <DialogContent showCloseButton={false} className="sm:max-w-md">
   <DialogHeader>
    <DialogTitle>کاراکترهای من</DialogTitle>
    <DialogDescription>یک کاراکتر ذخیره‌شده را برای درخواست‌های بعدی انتخاب کن.</DialogDescription>
   </DialogHeader>
   <DialogBody>
    {!loaded?<p role="status" className="type-body-sm text-fg-secondary">در حال خواندن کاراکترها…</p>
     :characters.length===0?<div className="flex flex-col items-start gap-3 rounded-card border border-line-secondary bg-surface-subtle p-4">
      <p className="type-body-sm text-fg-primary">هنوز کاراکتری نساخته‌ای.</p>
      <Button variant="outline" render={<Link href="/characters"/>} nativeButton={false}><Icon icon={Plus} aria-hidden="true"/>ساخت کاراکتر</Button>
     </div>
     :<ul className="flex flex-col gap-2">
      {characters.map(c=>{
       const usable=characterUsability(c),cov=characterCoverage(c.references),on=c.id===selectedId;
       return <li key={c.id}>
        <Button type="button" variant={on?"secondary":"outline"} disabled={!usable.ok} aria-pressed={on} onClick={()=>choose(c.id)} className="h-auto min-h-control w-full justify-start gap-3 whitespace-normal py-2 text-start">
         <Icon icon={UserRound} aria-hidden="true"/>
         <span className="flex min-w-0 flex-1 flex-col items-start">
          <span className="type-label">{c.name}</span>
          <span className="type-caption text-fg-secondary">{usable.ok?"ضروری "+fa(cov.requiredCount)+" از "+fa(cov.requiredTotal)+" · "+fa(cov.count)+" نما":usable.reason}</span>
         </span>
        </Button>
       </li>;
      })}
     </ul>}
   </DialogBody>
   <DialogFooter className="flex-wrap">
    {selectedId&&<Button type="button" variant="ghost" onClick={()=>choose(null)}>بدون کاراکتر</Button>}
    {loaded&&characters.length>0&&<Button variant="ghost" render={<Link href="/characters"/>} nativeButton={false}>مدیریت کاراکترها</Button>}
    <DialogClose render={<Button variant="outline"/>}>بستن</DialogClose>
   </DialogFooter>
  </DialogContent>
 </Dialog>;
}
