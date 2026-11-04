"use client";
import Link from "next/link";
import {Plus} from "lucide-react";
import {Button,Icon,Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from "@aleeforoughi/feather-react";
import {characterCoverage,characterUsability,type CharacterProfile} from "@/lib/characters";
import {fa} from "@/lib/format";

const NONE="none";
/**
 * Chooses a browser-local character for the next prompts. Only profiles with every required view and a current consent
 * can be picked; the others are listed disabled with the reason.
 */
export function CharacterPicker({characters,value,onChange,loaded}:{characters:CharacterProfile[];value:string|null;onChange:(id:string|null)=>void;loaded:boolean}){
 const items=[{value:NONE,label:"بدون کاراکتر"},...characters.map(c=>({value:c.id,label:c.name}))];
 return <div className="flex flex-wrap items-center gap-2">
  <Select value={value??NONE} onValueChange={v=>onChange(v===NONE?null:String(v))} items={items}>
   <SelectTrigger aria-label="کاراکتر"><span className="text-fg-secondary">کاراکتر</span><SelectValue/></SelectTrigger>
   <SelectContent>
    <SelectItem value={NONE}>بدون کاراکتر</SelectItem>
    {characters.map(c=>{
     const usable=characterUsability(c),cov=characterCoverage(c.references);
     return <SelectItem key={c.id} value={c.id} disabled={!usable.ok}>
      <span className="flex flex-col items-start">
       <span>{c.name}</span>
       <span className="type-caption text-fg-secondary">{usable.ok?"ضروری "+fa(cov.requiredCount)+" از "+fa(cov.requiredTotal)+" · "+fa(cov.count)+" نما":usable.reason}</span>
      </span>
     </SelectItem>;
    })}
   </SelectContent>
  </Select>
  <Button variant="link" size="sm" render={<Link href="/characters"/>} nativeButton={false}><Icon icon={Plus} aria-hidden="true"/>{loaded&&characters.length===0?"ساخت کاراکتر":"مدیریت کاراکترها"}</Button>
 </div>;
}
