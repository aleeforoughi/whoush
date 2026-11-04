/**
 * Private task-based routing of the creative planner across several models. Pure: no network, no server-only imports, no LLM call decides routing.
 * Nothing here ever reaches a customer (CLAUDE.md): classes, scores, bands, ladders and model ids are privileged audit data.
 */
import {z} from "zod";
import {COMPLEX_BRIEF} from "./router";
import type {CreativeTurnInput} from "./creative-plan";
import type {PrivateRouting} from "./llm";
import defaultConfigJson from "../config/llm-routing.json";

export const TASK_CLASSES=["quick_image","standard_image","video","edit","character","lip_sync","multi_shot","document_heavy"] as const;
export type TaskClass=(typeof TASK_CLASSES)[number];
export type TaskProfile={taskClass:TaskClass;score:number;signals:string[]};

/** Provider by model-id prefix (single source for lib/llm.ts): `claude-*` anthropic, `gpt-*` openai, anything else null. */
export const providerForModelId=(id:string):PrivateRouting["provider"]|null=>id.startsWith("claude-")?"anthropic":id.startsWith("gpt-")?"openai":null;

// ---- config ----
const ESCALATE_ON=["invalid_output","refused","planner_unavailable","leak_filtered"] as const;
const modelId=z.string().min(1).refine(id=>providerForModelId(id)!==null,"model id must start with claude- or gpt-");
const ladder=z.array(modelId).min(1).max(4).refine(l=>new Set(l).size===l.length,"ladder rungs must be unique");
export const RoutingConfigSchema=z.object({
 version:z.literal(1),
 bands:z.array(z.object({id:z.enum(["quick","standard","complex","exceptional"]),maxScore:z.number().int().min(0).max(100),ladder}).strict()).length(4),
 classOverrides:z.partialRecord(z.enum(TASK_CLASSES),ladder),
 escalation:z.object({maxAttemptsPerTurn:z.number().int().min(1).max(4),escalateOnCorrectionsAtLeast:z.number().int().min(1).max(50),escalateOn:z.array(z.enum(ESCALATE_ON))}).strict(),
 providerCooldownSeconds:z.number().int().min(0).max(3600),
 maxEstimatedCostUsdPerTurn:z.number().positive().max(100),
 astra:z.object({requiresEnv:z.string().regex(/^[A-Z][A-Z0-9_]*$/),maxCallsPerDay:z.number().int().min(0).max(10000),modelId:modelId.default("gpt-6-astra")}).strict(),
 prices:z.record(z.string(),z.tuple([z.number().nonnegative(),z.number().nonnegative()]))
}).strict().superRefine((c,ctx)=>{
 const ids=c.bands.map(b=>b.id).join();
 if(ids!=="quick,standard,complex,exceptional")ctx.addIssue({code:"custom",message:"bands must be quick, standard, complex, exceptional in that order"});
 if(c.bands.some((b,i)=>i>0&&b.maxScore<=c.bands[i-1].maxScore))ctx.addIssue({code:"custom",message:"band maxScore must be strictly ascending"});
 if(c.bands[3].maxScore!==100)ctx.addIssue({code:"custom",message:"the last band must end at 100"});
 const used=new Set([...c.bands.flatMap(b=>b.ladder),...Object.values(c.classOverrides).flat(),c.astra.modelId]);
 for(const m of used)if(!c.prices[m])ctx.addIssue({code:"custom",message:"no price for "+m});
});
export type RoutingConfig=z.infer<typeof RoutingConfigSchema>;
/** Parses and validates a routing config (throws a ZodError on anything invalid: the loader never guesses). */
export const parseRoutingConfig=(raw:unknown):RoutingConfig=>RoutingConfigSchema.parse(raw);
let cached:RoutingConfig|undefined;
export const loadRoutingConfig=():RoutingConfig=>cached??=parseRoutingConfig(defaultConfigJson);

// ---- task profile ----
export type ProfileAttachment={kind:string;role?:string;textExcerpt?:string};
/**
 * Deterministic, explainable score 0..100. Weights (each adds once; the total is capped at 100):
 *  prompt length 81-180 chars +8, 181-400 +16, 401-1000 +26, >1000 +36 | video +12 | edit (task or edit_reference) +14 | character (characterRef or character image) +14, 4+ angles +4
 *  attachments +4 each (max 16) | distinct media roles +3 each (max 9) | lip sync / speech +16 | style chosen +3 | multi-shot or identity wording +28
 *  text excerpts >0 chars +4, >2000 +10, >8000 +18 | creative_copywriter skill +6 | iranian_geography skill +6
 * Class precedence: multi_shot, lip_sync, character, edit, document_heavy (excerpts >2000 chars or 3+ files), video, then quick_image (score <= 24) or standard_image.
 */
export function profileTask(input:Pick<CreativeTurnInput,"text"|"task"|"style"|"characterRef"|"audio">&{attachments?:readonly ProfileAttachment[]},kind:"image"|"video",activeSkillIds:readonly string[],attachments:readonly ProfileAttachment[]=(input.attachments??[])):TaskProfile{
 const signals:string[]=[];let score=0;
 const add=(w:number,s:string)=>{score+=w;signals.push(s+":+"+w);};
 const len=input.text.length;
 if(len>1000)add(36,"prompt_len>1000");else if(len>400)add(26,"prompt_len>400");else if(len>180)add(16,"prompt_len>180");else if(len>80)add(8,"prompt_len>80");
 if(kind==="video")add(12,"video");
 const roles=attachments.flatMap(a=>a.role?[a.role]:[]);
 const edit=input.task==="edit"||roles.includes("edit_reference");
 if(edit)add(14,"edit");
 const character=Boolean(input.characterRef)||attachments.some(a=>a.kind==="image"&&a.role==="character");
 if(character)add(14,"character");
 if((input.characterRef?.angles.length??0)>=4)add(4,"character_angles>=4");
 if(attachments.length)add(Math.min(16,attachments.length*4),"attachments="+attachments.length);
 const media=new Set(roles);if(media.size)add(Math.min(9,media.size*3),"media_roles="+media.size);
 const lip=roles.includes("lip_sync")||Boolean(input.audio?.hasSpeech);
 if(lip)add(16,"lip_sync");
 if(input.style)add(3,"style");
 const multi=COMPLEX_BRIEF.test(input.text);
 if(multi)add(28,"multi_shot_wording");
 const excerpt=attachments.reduce((n,a)=>n+(a.textExcerpt?.length??0),0);
 if(excerpt>8000)add(18,"excerpts>8000");else if(excerpt>2000)add(10,"excerpts>2000");else if(excerpt>0)add(4,"excerpts");
 if(activeSkillIds.includes("creative_copywriter"))add(6,"skill:creative_copywriter");
 if(activeSkillIds.includes("iranian_geography"))add(6,"skill:iranian_geography");
 score=Math.min(100,score);
 const files=attachments.filter(a=>a.kind==="pdf"||a.kind==="md"||a.kind==="json").length;
 const taskClass:TaskClass=multi?"multi_shot":lip?"lip_sync":character?"character":edit?"edit":(excerpt>2000||files>=3)?"document_heavy":kind==="video"?"video":score<=24?"quick_image":"standard_image";
 return {taskClass,score,signals};
}

// ---- route planning ----
export type RouterState={cooldowns:Map<string,number>;astra:{day:string;n:number}};
export const createRouterState=():RouterState=>({cooldowns:new Map(),astra:{day:"",n:0}});
const g=globalThis as {__whoushRouterState?:RouterState};
/** Process-wide in-memory state (cooldowns, Astra daily counter). Lost on restart by design; a shared store is a later concern. */
export const defaultRouterState=():RouterState=>g.__whoushRouterState??=createRouterState();
export const resetRouterStateForTests=()=>{g.__whoushRouterState=createRouterState();};
const utcDay=(d:Date)=>d.toISOString().slice(0,10);
export function markProviderCooldown(provider:string,now:Date,cfg:RoutingConfig,state:RouterState=defaultRouterState()){if(cfg.providerCooldownSeconds>0)state.cooldowns.set(provider,now.getTime()+cfg.providerCooldownSeconds*1000);}
export function countAstraCall(now:Date,state:RouterState=defaultRouterState()){const d=utcDay(now);if(state.astra.day!==d)state.astra={day:d,n:0};state.astra.n++;}
const astraCalls=(now:Date,s:RouterState)=>s.astra.day===utcDay(now)?s.astra.n:0;
const KEY={anthropic:"ANTHROPIC_API_KEY",openai:"OPENAI_API_KEY"} as const;
export type RouteSkip={modelId:string;why:"no_key"|"cooldown"|"astra_disabled"|"astra_daily_cap"|"cost_ceiling"|"unknown_provider"};
export type PlannedRoute={band:"quick"|"standard"|"complex"|"exceptional";ladder:string[];reason:string;skipped:RouteSkip[]};
export const estimateTurnCostUsd=(cfg:RoutingConfig,model:string,inputChars:number):number=>{const p=cfg.prices[model];return p?(Math.ceil(inputChars/4)*p[0]+2500*p[1])/1e6:0;};
export const bandFor=(cfg:RoutingConfig,score:number)=>cfg.bands.find(b=>score<=b.maxScore)??cfg.bands[cfg.bands.length-1];
/** The legacy tier variables replace the first rung of quick, standard and complex (never exceptional). */
function legacyFirstRung(band:PlannedRoute["band"],env:Record<string,string|undefined>):string|undefined{
 const v=band==="quick"?env.LLM_FAST_MODEL:band==="standard"?env.LLM_BALANCED_MODEL:band==="complex"?env.LLM_DEEP_MODEL:undefined;
 return v&&providerForModelId(v)?v:undefined;
}
/**
 * The ordered ladder for a profile after skipping: models whose provider has no key, providers in cooldown, Astra unless enabled and under its daily cap,
 * and models whose estimated cost exceeds the per-turn ceiling (the cheapest remaining rung is always kept so a route still exists).
 */
export function planRoute(profile:TaskProfile,opts:{cfg?:RoutingConfig;env?:Record<string,string|undefined>;now?:Date;state?:RouterState;inputChars?:number}={}):PlannedRoute{
 const cfg=opts.cfg??loadRoutingConfig(),env=opts.env??process.env,now=opts.now??new Date(),state=opts.state??defaultRouterState();
 const band=bandFor(cfg,profile.score),override=cfg.classOverrides[profile.taskClass];
 let base=[...(override??band.ladder)];
 const legacy=override?undefined:legacyFirstRung(band.id,env);
 if(legacy)base=[legacy,...base.slice(1).filter(m=>m!==legacy)];
 const skipped:RouteSkip[]=[];let ladder:string[]=[];
 for(const m of base){
  const provider=providerForModelId(m);
  if(!provider){skipped.push({modelId:m,why:"unknown_provider"});continue;}
  if(!env[KEY[provider]]){skipped.push({modelId:m,why:"no_key"});continue;}
  if((state.cooldowns.get(provider)??0)>now.getTime()){skipped.push({modelId:m,why:"cooldown"});continue;}
  if(m===cfg.astra.modelId){
   if(env[cfg.astra.requiresEnv]!=="true"){skipped.push({modelId:m,why:"astra_disabled"});continue;}
   if(astraCalls(now,state)>=cfg.astra.maxCallsPerDay){skipped.push({modelId:m,why:"astra_daily_cap"});continue;}
  }
  ladder.push(m);
 }
 const chars=opts.inputChars??0;
 if(ladder.length){
  const cost=(m:string)=>estimateTurnCostUsd(cfg,m,chars),ok=ladder.filter(m=>cost(m)<=cfg.maxEstimatedCostUsdPerTurn);
  const keep=ok.length?ok:[ladder.reduce((a,b)=>cost(b)<cost(a)?b:a)];
  for(const m of ladder)if(!keep.includes(m))skipped.push({modelId:m,why:"cost_ceiling"});
  ladder=ladder.filter(m=>keep.includes(m));
 }
 return {band:band.id,ladder,reason:ladder.length?"band_"+band.id+(override?"_class_override":"")+(legacy?"_legacy_env":""):"no_route_available",skipped};
}

// ---- audit ----
export type RoutingAttempt={modelId:string;provider:string;outcome:string;latencyMs:number;usage?:unknown;estCostUsd:number|null};
export type RoutingAudit=TaskProfile&{band:string;ladder:string[];skipped:RouteSkip[];attempts:RoutingAttempt[];chosenModelId:string|null};
