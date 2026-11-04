"use client";
import {Check,CircleHelp} from "lucide-react";
import {Alert,AlertDescription,AlertTitle,Badge,Button,Card,CardAction,CardContent,CardDescription,CardFooter,CardHeader,CardTitle,Field,FieldContent,FieldDescription,FieldLabel,FieldLegend,FieldSet,FieldTitle,Icon,RadioGroup,RadioGroupItem,Separator} from "@aleeforoughi/feather-react";
import {PlanDetails,SuggestedModelNote} from "@/components/plan-details";
import type {AgentProposal,NoModelResult} from "@/lib/studio-types";
import {PAST_PROPOSAL_FA,type ProposalSnapshot} from "@/lib/projects";
import {fa} from "@/lib/format";

/** Latin model names keep their own direction inside Persian text. */
const ModelName=({name}:{name:string})=><bdi dir="ltr">{name}</bdi>;

export function ProposalCard({proposal,selected,onSelect,busy,onApprove}:{proposal:AgentProposal;selected:string;onSelect:(id:string)=>void;busy:boolean;onApprove:()=>void}){
 const chosen=proposal.suggestions.find(s=>s.modelId===selected);
 const price=chosen?.neurons??proposal.fixedNeurons;
 const ordered=[...proposal.suggestions].sort((a,b)=>Number(b.modelId===proposal.recommendedModelId)-Number(a.modelId===proposal.recommendedModelId));
 const question=proposal.plan.clarifyingQuestionFa;
 return <Card data-testid="proposal">
  <CardHeader>
   <CardTitle>برنامه تولید {proposal.operation==="generate_video"?"ویدیو":"تصویر"}</CardTitle>
   <CardDescription>{proposal.plan.intentSummaryFa}</CardDescription>
   <CardAction><Badge variant="outline">نسخه نمایشی</Badge></CardAction>
  </CardHeader>
  <CardContent className="flex flex-col gap-6">
   {question&&<Alert role="status">
    <Icon icon={CircleHelp} aria-hidden="true"/>
    <AlertTitle>یک سؤال برای دقیق‌تر شدن</AlertTitle>
    <AlertDescription>{question}</AlertDescription>
   </Alert>}
   <FieldSet>
    <FieldLegend variant="label">مدل تولید</FieldLegend>
    <RadioGroup value={selected} onValueChange={v=>onSelect(String(v))} aria-label="مدل تولید">
     {ordered.map(s=>{
      const recommended=s.modelId===proposal.recommendedModelId;
      const id="model-"+s.modelId;
      return <FieldLabel key={s.modelId} htmlFor={id}>
       <Field orientation="horizontal">
        <RadioGroupItem id={id} value={s.modelId}/>
        <FieldContent>
         <FieldTitle className="flex-wrap"><ModelName name={s.name}/>{recommended?<Badge>پیشنهاد هووش</Badge>:<Badge variant="outline">جایگزین</Badge>}</FieldTitle>
         <FieldDescription>{s.reason}</FieldDescription>
        </FieldContent>
        <span className="type-label text-fg-primary whitespace-nowrap">{fa(s.neurons)} نورون</span>
       </Field>
      </FieldLabel>;
     })}
    </RadioGroup>
   </FieldSet>
   <div className="flex flex-col gap-1">
    <div className="flex items-baseline justify-between gap-4">
     <span className="type-label text-fg-secondary">هزینه ثابت تولید</span>
     <strong className="type-title text-fg-primary">{fa(price)} نورون</strong>
    </div>
    <p className="type-caption text-fg-secondary">قیمت عدد صحیح و ثابت است و پیش از تأیید تغییر نمی‌کند.</p>
   </div>
   <Separator/>
   <PlanDetails plan={proposal.plan}/>
  </CardContent>
  <CardFooter className="flex-col items-stretch">
   <Button disabled={busy||!proposal.turnId} onClick={onApprove}><Icon icon={Check} aria-hidden="true"/>تأیید آزمایشی</Button>
   <p className="type-caption text-fg-secondary">در این پیش‌نمایش نه پولی دریافت می‌شود و نه رسانهٔ واقعی تولید می‌شود.</p>
  </CardFooter>
 </Card>;
}

/** 422 no_compatible_model: the plan is shown for transparency, with no price and nothing to approve. */
export function NoModelCard({result}:{result:NoModelResult}){
 if(!result.plan)return null;
 return <Card>
  <CardHeader>
   <CardTitle>برنامه بدون مدل سازگار</CardTitle>
   <CardDescription>{result.plan.intentSummaryFa}</CardDescription>
  </CardHeader>
  <CardContent className="flex flex-col gap-4">
   {result.plan.clarifyingQuestionFa&&<Alert role="status">
    <Icon icon={CircleHelp} aria-hidden="true"/>
    <AlertTitle>یک سؤال برای ادامه</AlertTitle>
    <AlertDescription>{result.plan.clarifyingQuestionFa}</AlertDescription>
   </Alert>}
   {result.plan.suggestedModel&&<SuggestedModelNote model={result.plan.suggestedModel}/>}
   <p className="type-body-sm text-fg-secondary">تا پیدا شدن مدل سازگار، قیمتی نمایش داده نمی‌شود و چیزی برای تأیید وجود ندارد.</p>
   <PlanDetails plan={result.plan} defaultOpen/>
  </CardContent>
 </Card>;
}

/** A proposal from earlier in the conversation, read-only: its quote has expired (or the page was reloaded), so there is nothing to approve. */
export function PastProposalCard({snapshot}:{snapshot:ProposalSnapshot}){
 return <Card data-testid="past-proposal">
  <CardHeader>
   <CardTitle>برنامه تولید {snapshot.operation==="generate_video"?"ویدیو":"تصویر"}</CardTitle>
   <CardDescription>{snapshot.intentSummaryFa}</CardDescription>
   <CardAction><Badge variant="outline">نسخه نمایشی</Badge></CardAction>
  </CardHeader>
  <CardContent className="flex flex-col gap-4">
   <div className="flex items-baseline justify-between gap-4">
    <span className="type-body-sm text-fg-secondary">مدل پیشنهادی: <ModelName name={snapshot.modelName}/></span>
    <strong className="type-label text-fg-primary whitespace-nowrap">{fa(snapshot.neurons)} نورون</strong>
   </div>
   <p role="note" className="type-caption text-fg-secondary">{PAST_PROPOSAL_FA}</p>
   <PlanDetails plan={snapshot.plan}/>
  </CardContent>
 </Card>;
}
