import type {ProgressFacts} from "./job-progress";
import type {GenerationProposal,UnsupportedReason} from "@/lib/types";
import type {PublicCreativePlan} from "@/lib/creative-plan";

/** What POST /api/agent returns for a compatible request: the proposal plus the turn id and the public plan. */
export type AgentProposal=GenerationProposal&{turnId?:string;plan:PublicCreativePlan};
/** What POST /api/agent returns with 422 `no_compatible_model`. */
export type NoModelResult={message:string;plan?:PublicCreativePlan;reason?:UnsupportedReason};
/** The public job view from /api/generation/jobs/:id (only the fields the UI uses). */
export type JobView={state:string;messageFa:string;outputs?:{kind:"image"|"video";url:string}[];
 /** The server's job id, so the preview and the transcript follow the same job. */
 jobId?:string;
 /** Refused by the model's own content rules, and another model to try (owner, 2026-11-08). */
 refused?:true;alternative?:{modelId:string;name:string;neurons:number};
 /** The model's measured typical duration, when known: paces the progress estimate. */
 typicalMs?:number;
 /** While it works: the lines written for this job, and the facts the stage lines state (lib/job-progress.ts liveStatusFa). */
 progressFa?:string[];progressFacts?:ProgressFacts;
 /** Client only: the generation this job belongs to (#تولید-۱), for the preview's status line. */
 tag?:string;
 /** Why a finished video is silent: its soundtrack failed the check and was removed (lib/audio-check.ts). */audioNoteFa?:string;
 /** «زیباسازی»'s self-check of the result: share-ready or not, the sentence, and the one fix (lib/beauty-check.ts). */beauty?:{shareReady:boolean;samePerson:boolean;verdictFa:string};
 /** What Whoush would still fix (lib/beauty-check.ts), in its own words; `reviewDone` once fixed or kept («همین خوبه»). */review?:{sayFa:string};reviewDone?:true};
