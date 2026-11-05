"use client";
import {Box,CircleOff,Clapperboard,Image as ImageIcon,Sparkles} from "lucide-react";
import {Badge,Button,Card,Icon,Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from "@aleeforoughi/feather-react";
import {SuggestedModelNote} from "@/components/plan-details";
import {TagBadge} from "@/components/attachment-chip";
import type {AgentProposal,NoModelResult} from "@/lib/studio-types";
import {PAST_PROPOSAL_FA,type ProposalSnapshot} from "@/lib/projects";
import {fa} from "@/lib/format";

export const GENERATE_FA="بساز",CHANGE_FA="اصلاح",DEMO_NOTE_FA="نسخهٔ نمایشی: نه پولی کسر می‌شود و نه رسانهٔ واقعی ساخته می‌شود.";
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
/** «اصلاح» (text only): puts this generation as a card in the chat input, so the next message asks for changes to it. */
const ChangeButton=({onChange,disabled}:{onChange:()=>void;disabled?:boolean})=>
 <Button type="button" variant="outline" onClick={onChange} disabled={disabled}>{CHANGE_FA}</Button>;

/**
 * The live generation card: short and actionable, the plan itself is in the conversation above it. The kind, the tag (#تولید-۱), the model (recommendation first,
 * alternates marked «جایگزین», each with its fixed Neurons), then [بساز · ۱۰ نورون] and [اصلاح].
 */
export function ProposalCard({proposal,tag,adjusted,selected,onSelect,busy,onApprove,onChange,onMention}:{proposal:AgentProposal;tag?:string;
 /** The scene was arranged in «بوم»: «بساز» builds exactly that scene. */adjusted?:boolean;selected:string;onSelect:(id:string)=>void;busy:boolean;onApprove:()=>void;onChange:()=>void;onMention?:()=>void}){
 const chosen=proposal.suggestions.find(s=>s.modelId===selected);
 const price=chosen?.neurons??proposal.fixedNeurons;
 const ordered=[...proposal.suggestions].sort((a,b)=>Number(b.modelId===proposal.recommendedModelId)-Number(a.modelId===proposal.recommendedModelId));
 const items=ordered.map(s=>({value:s.modelId,label:s.name}));
 return <Card size="sm" data-testid="proposal" data-generation={tag} className="gap-3 p-3">
  <Head kind={proposal.operation==="generate_video"?"video":"image"} tag={tag} onMention={onMention}/>
  {ordered.length>1
   ?<Select value={selected} onValueChange={v=>onSelect(String(v))} items={items}>
    <SelectTrigger size="sm" aria-label="مدل تولید" className="w-full"><span className="text-fg-secondary">مدل</span><SelectValue/></SelectTrigger>
    <SelectContent>{ordered.map(s=><SelectItem key={s.modelId} value={s.modelId}>
     <span className="flex min-w-0 flex-col">
      <span className="flex items-center gap-2"><ModelName name={s.name}/><span className="type-caption text-fg-secondary">{s.modelId===proposal.recommendedModelId?RECOMMENDED_FA:ALTERNATE_FA} · {fa(s.neurons)} نورون</span></span>
      {s.reason&&<span className="type-caption text-fg-secondary">{s.reason}</span>}
     </span>
    </SelectItem>)}</SelectContent>
   </Select>
   :chosen&&<p className="flex items-center gap-2 type-body-sm text-fg-secondary">مدل: <span className="text-fg-primary"><ModelName name={chosen.name}/></span><Badge variant="secondary">{RECOMMENDED_FA}</Badge></p>}
  <div className="flex flex-wrap gap-2">
   <Button type="button" onClick={onApprove} disabled={busy||!proposal.turnId} className="min-w-0 flex-1 justify-between">
    <span className="flex items-center gap-2"><Icon icon={Sparkles} aria-hidden="true"/>{GENERATE_FA}</span>
    <span className="type-label">{fa(price)} نورون</span>
   </Button>
   <ChangeButton onChange={onChange}/>
  </div>
  {adjusted&&<p role="status" className="flex items-center gap-2 type-caption text-fg-primary"><Icon icon={Box} size={16} aria-hidden="true" className="size-4 text-primary"/>با صحنه‌ای که توی «بوم» چیدی ساخته می‌شه.</p>}
  <p className="type-caption text-fg-secondary">{DEMO_NOTE_FA}</p>
 </Card>;
}

/** A generation from earlier in the conversation: its quote has expired (or the page reloaded), so only «اصلاح» remains; the plan is in the conversation. */
export function PastProposalCard({snapshot,onChange,onMention,disabled,adjusted,onBuildScene,busy}:{snapshot:ProposalSnapshot;onChange:()=>void;onMention?:()=>void;disabled?:boolean;
 /** The scene was arranged in «بوم»: «این صحنه رو بساز» asks Whoush for a revision with exactly that scene and a fresh quote. */adjusted?:boolean;onBuildScene?:()=>void;busy?:boolean}){
 return <Card size="sm" data-testid="past-proposal" data-generation={snapshot.tag} className="gap-3 p-3">
  <Head kind={snapshot.operation==="generate_video"?"video":"image"} tag={snapshot.tag} onMention={onMention}/>
  <p className="flex flex-wrap items-center justify-between gap-2 type-body-sm text-fg-secondary">
   <span>مدل: <span className="text-fg-primary"><ModelName name={snapshot.modelName}/></span></span>
   <span className="type-label text-fg-primary">{fa(snapshot.neurons)} نورون</span>
  </p>
  <div className="flex flex-wrap items-center gap-2">
   {adjusted&&onBuildScene&&<Button type="button" onClick={onBuildScene} disabled={busy}><Icon icon={Box} aria-hidden="true"/>این صحنه رو بساز</Button>}
   <ChangeButton onChange={onChange} disabled={disabled}/>
   <p role="note" className="min-w-0 flex-1 type-caption text-fg-secondary">{adjusted?"صحنهٔ «بوم» تغییر کرده؛ هووش با همین صحنه یه برنامه و قیمت تازه می‌ده.":PAST_PROPOSAL_FA}</p>
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
