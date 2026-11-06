"use client";
import type React from "react";
import {Box,CircleOff,Clapperboard,Image as ImageIcon,Sparkles} from "lucide-react";
import {Badge,Button,Card,Icon,Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from "@aleeforoughi/feather-react";
import {SuggestedModelNote} from "@/components/plan-details";
import {TagBadge} from "@/components/attachment-chip";
import type {AgentProposal,NoModelResult} from "@/lib/studio-types";
import {PAST_PROPOSAL_FA,type ProposalSnapshot} from "@/lib/projects";
import {fa} from "@/lib/format";
import {nearestAspectRatio} from "@/lib/aspect";
import {ResearchReport} from "@/components/research-report";

export const GENERATE_FA="بسازش",GENERATE_WITH_REFS_FA="با این مرجع‌ها بسازش",DEMO_NOTE_FA="نسخهٔ نمایشی: نه پولی کسر می‌شود و نه رسانهٔ واقعی ساخته می‌شود.";
const RECOMMENDED_FA="پیشنهاد هووش",ALTERNATE_FA="جایگزین";
/** Latin model names keep their own direction inside Persian text. */
const ModelName=({name}:{name:string})=><bdi dir="ltr">{name}</bdi>;

/** The card's top row: the kind's icon, «تصویر» or «ویدیو», the generation's tag (a button that puts it in the prompt) and the demo badge. */
function Head({kind,tag,onMention}:{kind:"image"|"video";tag?:string;onMention?:()=>void}){
 return <div className="flex items-center gap-2">
  <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-surface-hover text-fg-secondary"><Icon icon={kind==="video"?Clapperboard:ImageIcon} size={20} aria-hidden="true"/></span>
  <span className="type-label text-fg-primary">{kind==="video"?"ساخت ویدیو":"ساخت تصویر"}</span>
  {tag&&<TagBadge tag={tag} onMention={onMention}/>}
  <Badge variant="outline" className="ms-auto">نسخه نمایشی</Badge>
 </div>;
}

/**
 * The live generation card: short and actionable, the plan itself is in the conversation above it. The kind, the tag (#تولید-۱), the model (recommendation first,
 * alternates marked «جایگزین», each with its fixed Neurons), its settings, its notes, then a full-width bar at its very bottom: [✦ بسازش] on the right, its cost
 * («۱۰ نورون») on the left. Tapping the tag mentions it in the chat to ask for changes.
 */
export function ProposalCard({proposal,tag,adjusted,selected,onSelect,aspect,onAspect,busy,onApprove,onMention,excludedReferences,onToggleReference}:{proposal:AgentProposal;tag?:string;
 /** The scene was arranged in «بوم»: «بساز» builds exactly that scene. */adjusted?:boolean;selected:string;onSelect:(id:string)=>void;
 /** The aspect ratio the generation will use (Whoush's from the brief or «بوم», unless the user picked one here). */aspect?:string;onAspect?:(r:string)=>void;
 busy:boolean;onApprove:()=>void;onMention?:()=>void;
 /** Research references the user removed from the package, and the toggle (remove or restore). */excludedReferences?:ReadonlySet<string>;onToggleReference?:(id:string)=>void}){
 const chosen=proposal.suggestions.find(s=>s.modelId===selected);
 const price=chosen?.neurons??proposal.fixedNeurons;
 const ordered=[...proposal.suggestions].sort((a,b)=>Number(b.modelId===proposal.recommendedModelId)-Number(a.modelId===proposal.recommendedModelId));
 // The model menu lists families («Seedance 2.5»); a family's versions (resolution, duration) are settings below it. Each version is its own priced SKU.
 const familyOf=(n:string)=>n.split(" · ")[0].trim();
 const fam=chosen?familyOf(chosen.name):undefined,family=ordered.filter(s=>familyOf(s.name)===fam);
 const heads=ordered.filter((s,i)=>ordered.findIndex(x=>familyOf(x.name)===familyOf(s.name))===i);
 const items=heads.map(s=>({value:s.modelId,label:familyOf(s.name)}));
 const headOf=(id:string)=>{const s=ordered.find(x=>x.modelId===id);return s?heads.find(h=>familyOf(h.name)===familyOf(s.name))!.modelId:id;};
 const resolutions=[...new Set(family.map(s=>s.resolution).filter((r):r is string=>Boolean(r)))];
 const durations=[...new Set(family.map(s=>s.durationSeconds).filter((d):d is number=>Boolean(d)))].sort((a,b)=>a-b);
 /** The family's version with this resolution and duration (keeping the other setting when possible). */
 const pick=(res?:string,dur?:number)=>{const m=family.find(s=>(res===undefined||s.resolution===res)&&(dur===undefined||s.durationSeconds===dur))??family.find(s=>res!==undefined?s.resolution===res:s.durationSeconds===dur);if(m)onSelect(m.modelId);};
 const ratios=chosen?.aspectRatios??[];
 // The ratio that will really be used: the wanted one, or the nearest this model offers (the same rule as the quote in studio.tsx).
 const shownAspect=nearestAspectRatio(aspect,ratios)??aspect;
 return <Card size="sm" data-testid="proposal" data-generation={tag} className="gap-3 p-3">
  <Head kind={proposal.operation==="generate_video"?"video":"image"} tag={tag} onMention={onMention}/>
  {heads.length>1
   ?<Select value={headOf(selected)} onValueChange={v=>onSelect(String(v))} items={items}>
    <SelectTrigger size="sm" aria-label="مدل تولید" className="w-full"><span className="text-fg-secondary">مدل</span><SelectValue/></SelectTrigger>
    <SelectContent>{heads.map(s=><SelectItem key={s.modelId} value={s.modelId}>
     <span className="flex min-w-0 flex-col">
      <span className="flex items-center gap-2"><ModelName name={familyOf(s.name)}/><span className="type-caption text-fg-secondary">{familyOf(s.name)===familyOf(ordered.find(x=>x.modelId===proposal.recommendedModelId)?.name??"")?RECOMMENDED_FA:ALTERNATE_FA} · {fa(s.neurons)} نورون</span></span>
      {s.reason&&<span className="type-caption text-fg-secondary">{s.reason}</span>}
     </span>
    </SelectItem>)}</SelectContent>
   </Select>
   :chosen&&<p className="flex items-center gap-2 type-body-sm text-fg-secondary">مدل: <span className="text-fg-primary"><ModelName name={familyOf(chosen.name)}/></span><Badge variant="secondary">{RECOMMENDED_FA}</Badge></p>}
  {/* The model's settings: Whoush's choice is selected (from the brief, «بوم» and the mode) until the user picks another. Only what this model really offers. */}
  {(ratios.length>0||resolutions.length>0||durations.length>0)&&<div className="flex flex-col gap-2">
   {ratios.length>0&&<Setting label="نسبت تصویر">{ratios.map(r=><Opt key={r} on={shownAspect===r} onClick={()=>onAspect?.(r)} disabled={!onAspect}><bdi dir="ltr">{r}</bdi></Opt>)}</Setting>}
   {resolutions.length>0&&<Setting label="کیفیت">{resolutions.map(r=><Opt key={r} on={chosen?.resolution===r} onClick={()=>pick(r,chosen?.durationSeconds)} disabled={resolutions.length<2}><bdi dir="ltr">{r.toUpperCase()}</bdi></Opt>)}</Setting>}
   {durations.length>0&&<Setting label="مدت">{durations.map(d=><Opt key={d} on={chosen?.durationSeconds===d} onClick={()=>pick(chosen?.resolution,d)} disabled={durations.length<2}>{fa(d)} ثانیه</Opt>)}</Setting>}
  </div>}
  {adjusted&&<p role="status" className="flex items-center gap-2 type-caption text-fg-primary"><Icon icon={Box} size={16} aria-hidden="true" className="size-4 text-primary"/>با صحنه‌ای که توی «بوم» چیدی ساخته می‌شه.</p>}
  {proposal.research&&<ResearchReport research={proposal.research} excluded={excludedReferences} onToggle={onToggleReference}/>}
  <p className="type-caption text-fg-secondary">{DEMO_NOTE_FA}</p>
  {/* The call to action, full width at the card's very bottom: [✦ بسازش] on the right (as Persian reads), the cost on the left. */}
  <div className="-mx-3 -mb-3 mt-1 flex items-center justify-between gap-3 rounded-b-[inherit] border-t border-line-secondary bg-surface-subtle px-3 py-2.5">
   <Button type="button" onClick={onApprove} disabled={busy||!proposal.turnId} className="shrink-0">
    <Icon icon={Sparkles} aria-hidden="true"/>{proposal.research?.usedAsImages&&proposal.research.references.some(r=>!excludedReferences?.has(r.id))?GENERATE_WITH_REFS_FA:GENERATE_FA}
   </Button>
   <span className="type-label text-fg-primary" aria-label={"هزینه: "+fa(price)+" نورون"}>{fa(price)} نورون</span>
  </div>
 </Card>;
}

/** One setting row of the generation card: its label, then its options. */
function Setting({label,children}:{label:string;children:React.ReactNode}){
 return <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label={label}><span className="min-w-14 type-caption text-fg-secondary">{label}</span>{children}</div>;
}
/** One option of a setting (a small pill; the selected one in the brand blue). A single option shows as fixed (nothing else to pick). */
function Opt({on,onClick,disabled,children}:{on:boolean;onClick:()=>void;disabled?:boolean;children:React.ReactNode}){
 return <button type="button" role="radio" aria-checked={on} onClick={onClick} disabled={disabled&&!on?true:undefined}
  className={"flex h-8 items-center rounded-control border px-2.5 type-caption motion-hover disabled:cursor-default "+(on?"border-primary bg-surface-selected text-fg-primary":"border-line-secondary text-fg-secondary hover:bg-surface-hover")}>{children}</button>;
}

/** A generation from earlier in the conversation: its quote has expired (or the page reloaded); its tag mentions it in the chat to ask for changes. */
export function PastProposalCard({snapshot,onMention,adjusted,onBuildScene,busy}:{snapshot:ProposalSnapshot;onMention?:()=>void;
 /** The scene was arranged in «بوم»: «این صحنه رو بساز» asks Whoush for a revision with exactly that scene and a fresh quote. */adjusted?:boolean;onBuildScene?:()=>void;busy?:boolean}){
 return <Card size="sm" data-testid="past-proposal" data-generation={snapshot.tag} className="gap-3 p-3">
  <Head kind={snapshot.operation==="generate_video"?"video":"image"} tag={snapshot.tag} onMention={onMention}/>
  <p className="flex flex-wrap items-center justify-between gap-2 type-body-sm text-fg-secondary">
   <span>مدل: <span className="text-fg-primary"><ModelName name={snapshot.modelName}/></span></span>
   <span className="type-label text-fg-primary">{fa(snapshot.neurons)} نورون</span>
  </p>
  <div className="flex flex-wrap items-center gap-2">
   {adjusted&&onBuildScene&&<Button type="button" onClick={onBuildScene} disabled={busy}><Icon icon={Box} aria-hidden="true"/>این صحنه رو بساز</Button>}
   <p role="note" className="min-w-0 flex-1 type-caption text-fg-secondary">{adjusted?"صحنهٔ «بوم» تغییر کرده؛ هووش با همین صحنه یه پرامپت و قیمت تازه می‌ده.":PAST_PROPOSAL_FA}</p>
  </div>
 </Card>;
}

/** 422 no_compatible_model: no price and nothing to generate; the model that fits but is not active yet, if any. The plan is in the conversation. */
export function NoModelCard({result}:{result:NoModelResult}){
 return <Card size="sm" className="gap-3 p-3">
  <div className="flex items-center gap-2">
   <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-surface-hover text-fg-secondary"><Icon icon={CircleOff} size={20} aria-hidden="true"/></span>
   <span className="type-label text-fg-primary">مدل سازگاری پیدا نشد</span>
  </div>
  {result.plan?.suggestedModel&&<SuggestedModelNote model={result.plan.suggestedModel}/>}
  <p className="type-caption text-fg-secondary">تا پیدا شدن مدل سازگار، قیمتی نمایش داده نمی‌شود و چیزی برای ساخت وجود ندارد.</p>
 </Card>;
}
