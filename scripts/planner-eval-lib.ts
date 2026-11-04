/** Pure helpers of the planner evaluation (scripts/planner-eval.ts): metrics, cost estimate, .env parsing and the HTML report. No network, no server-only imports. */
import {z} from "zod";
import type {PublicCreativePlan} from "../lib/creative-plan";

/** USD per 1M tokens (input, output). ESTIMATE from the provider pricing pages read on 2026-11-04 (docs/LLM_ROUTING.md); never customer-facing. */
export const PRICE_USD_PER_MTOK:Readonly<Record<string,{input:number;output:number}>>={
 "gpt-6-astra":{input:10,output:50},"gpt-6.1-sol":{input:2,output:10},"gpt-6.1-terra":{input:1,output:5},"gpt-6-luna":{input:0.1,output:0.5},
 "claude-opus-5-5":{input:4,output:20},"claude-sonnet-5-5":{input:2,output:10},"claude-haiku-5-5":{input:0.1,output:0.5}
};
export function estimateCostUsd(modelId:string,usage:{input_tokens:number;output_tokens:number}|null|undefined):number|null{
 const p=PRICE_USD_PER_MTOK[modelId];if(!p||!usage)return null;
 return (usage.input_tokens*p.input+usage.output_tokens*p.output)/1e6;
}
/** Anthropic and OpenAI usage objects to plain input and output counts (cache reads and writes count as input). */
export function normalizeUsage(u:unknown):{input_tokens:number;output_tokens:number}|null{
 if(!u||typeof u!=="object")return null;
 const o=u as Record<string,unknown>,n=(k:string)=>typeof o[k]==="number"&&Number.isFinite(o[k])?o[k] as number:0;
 if(typeof o.input_tokens!=="number"&&typeof o.output_tokens!=="number")return null;
 return {input_tokens:n("input_tokens")+n("cache_creation_input_tokens")+n("cache_read_input_tokens"),output_tokens:n("output_tokens")};
}

// ---- prompt file ----
const EvalInputSchema=z.object({text:z.string().min(1)}).passthrough();
export const EvalPromptSchema=z.object({
 id:z.string().regex(/^[a-z0-9-]{3,40}$/),input:EvalInputSchema,
 expect:z.object({kind:z.enum(["image","video"]),mustMention:z.array(z.string().min(1)).optional(),mustNotMention:z.array(z.string().min(1)).optional()}).strict()
}).strict();
export const EvalPromptsSchema=z.array(EvalPromptSchema).min(1).superRefine((l,ctx)=>{if(new Set(l.map(p=>p.id)).size!==l.length)ctx.addIssue({code:"custom",message:"prompt ids must be unique"});});
export type EvalPrompt=z.infer<typeof EvalPromptSchema>;

// ---- metrics on the PUBLIC plan (what a customer would see) ----
const PERSIAN=/[؀-ۿ]/;
/** Camera tokens that are Latin by design (f-stop, shutter, ratio): not counted as language misses. */
const TOKEN_KEYS=new Set(["aperture","shutter","aspectRatio","lens"]);
function collect(v:unknown,key:string|undefined,out:string[]){
 if(typeof v==="string"){if(!(key&&TOKEN_KEYS.has(key))&&v.trim())out.push(v);return;}
 if(Array.isArray(v)){for(const x of v)collect(x,key,out);return;}
 if(v&&typeof v==="object")for(const [k,x] of Object.entries(v))if(k!=="references"&&k!=="mediaKind"&&k!=="style"&&k!=="suggestedModel"&&k!=="characterId"&&k!=="mode"&&k!=="status"&&k!=="providedAngles")collect(x,k,out);
}
/** Every customer-visible string of a public plan (ids, enums and Latin camera tokens excluded). */
export function publicStrings(plan:PublicCreativePlan|undefined|null):string[]{const out:string[]=[];collect(plan,undefined,out);return out;}
export const persianRatio=(strings:readonly string[]):number=>strings.length?strings.filter(s=>PERSIAN.test(s)).length/strings.length:0;
const CAMERA_STRINGS=["look","aperture","shutter","framing","lighting","focus","aspectRatio"],CAMERA_NUMBERS=["focalLengthMm","iso","whiteBalanceK"];
const SHOT_STRINGS=["shotSize","cameraMovement","lens","blocking"],SHOT_NUMBERS=["targetFps","shutterAngle","durationSeconds"];
const filled=(o:Record<string,unknown>|undefined,strs:string[],nums:string[])=>Boolean(o)&&strs.every(k=>typeof o![k]==="string"&&(o![k] as string).trim()!=="")&&nums.every(k=>typeof o![k]==="number"&&Number.isFinite(o![k]));
export const cameraComplete=(c:unknown):boolean=>filled(c as Record<string,unknown>|undefined,CAMERA_STRINGS,CAMERA_NUMBERS);
export const shotComplete=(s:unknown):boolean=>filled(s as Record<string,unknown>|undefined,SHOT_STRINGS,SHOT_NUMBERS)&&Array.isArray((s as {continuityNotes?:unknown}).continuityNotes);
/** Image plans need a complete camera, video plans a complete shot; null when there is no plan. */
export function completeness(plan:PublicCreativePlan|undefined|null,kind:"image"|"video"):boolean|null{
 if(!plan)return null;return kind==="image"?cameraComplete(plan.camera):shotComplete(plan.shot);
}
/** Same folding as the safety prefilter would need for matching: Arabic letter forms, ZWNJ, diacritics and case. */
export const foldFa=(t:string):string=>t.normalize("NFKC").toLowerCase().replace(/[يى]/g,"ی").replace(/ك/g,"ک").replace(/[ً-ٰٟ]/g,"").replace(/[‌‍]/g," ").replace(/\s+/g," ");
/** Share of required keywords present in the plan's public text (null when none are required); plus forbidden keywords found. */
export function scoreMentions(strings:readonly string[],must:readonly string[]|undefined,mustNot:readonly string[]|undefined):{hitRate:number|null;hits:string[];misses:string[];violations:string[]}{
 const hay=foldFa(strings.join(" \n ")),has=(k:string)=>hay.includes(foldFa(k));
 const hits=(must??[]).filter(has),misses=(must??[]).filter(k=>!has(k));
 return {hitRate:must&&must.length?hits.length/must.length:null,hits,misses,violations:(mustNot??[]).filter(has)};
}
const sorted=(xs:readonly number[])=>[...xs].sort((a,b)=>a-b);
/** Nearest-rank percentile (p in 0..100); null for an empty list. */
export function percentile(xs:readonly number[],p:number):number|null{if(!xs.length)return null;const s=sorted(xs);return s[Math.min(s.length-1,Math.max(0,Math.ceil(p/100*s.length)-1))];}
export const mean=(xs:readonly number[]):number|null=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;

// ---- results ----
export type EvalRun={
 promptId:string;model:string;provider:string;ok:boolean;status:string;fallbackReason?:string;error?:string;
 latencyMs:number;usage:{input_tokens:number;output_tokens:number}|null;costUsdEstimate:number|null;
 corrections:number;leakFiltered:boolean;persianRatio:number;complete:boolean|null;
 mentionHitRate:number|null;mentionMisses:string[];mustNotViolations:string[];planChars:number;plan?:PublicCreativePlan;
 /** Task profile of the prompt (lib/llm-routing.ts profileTask). In --route mode `model` is "router" and `chosenModel` the rung that produced the plan. */
 taskClass?:string;score?:number;chosenModel?:string|null;attempts?:number;
};
export type ModelSummary={model:string;runs:number;ok:number;failures:number;latencyMeanMs:number|null;latencyP50Ms:number|null;latencyP95Ms:number|null;costUsdEstimateTotal:number|null;costUsdEstimateMean:number|null;persianRatioMean:number|null;completeRate:number|null;mentionHitRateMean:number|null;violationRuns:number;correctionsMean:number|null;leakFiltered:number;tokensInMean:number|null;tokensOutMean:number|null};
/** Latency and quality are computed over successful runs only (a fallback plan says nothing about the model); failures are counted separately. */
export function summarize(runs:readonly EvalRun[]):ModelSummary[]{
 const models=[...new Set(runs.map(r=>r.model))];
 return models.map(model=>{
  const all=runs.filter(r=>r.model===model),ok=all.filter(r=>r.ok);
  const costs=all.map(r=>r.costUsdEstimate).filter((x):x is number=>x!==null);
  const comp=ok.map(r=>r.complete).filter((x):x is boolean=>x!==null),ment=ok.map(r=>r.mentionHitRate).filter((x):x is number=>x!==null);
  const lat=ok.map(r=>r.latencyMs);
  return {model,runs:all.length,ok:ok.length,failures:all.length-ok.length,latencyMeanMs:mean(lat),latencyP50Ms:percentile(lat,50),latencyP95Ms:percentile(lat,95),
   costUsdEstimateTotal:costs.length?costs.reduce((a,b)=>a+b,0):null,costUsdEstimateMean:mean(costs),
   persianRatioMean:mean(ok.map(r=>r.persianRatio)),completeRate:comp.length?comp.filter(Boolean).length/comp.length:null,mentionHitRateMean:mean(ment),
   violationRuns:all.filter(r=>r.mustNotViolations.length>0).length,correctionsMean:mean(ok.map(r=>r.corrections)),leakFiltered:all.filter(r=>r.leakFiltered).length,
   tokensInMean:mean(all.map(r=>r.usage?.input_tokens).filter((x):x is number=>x!==undefined)),tokensOutMean:mean(all.map(r=>r.usage?.output_tokens).filter((x):x is number=>x!==undefined))};
 });
}

// ---- per-class evaluation and suggested ladders ----
export type ClassRow={taskClass:string;model:string;runs:number;ok:number;failures:number;okRate:number;correctionsMean:number|null;persianRatioMean:number|null;mentionHitRateMean:number|null;costUsdEstimateMean:number|null;latencyMeanMs:number|null};
/** Per task class and per model (the model that produced the plan in --route mode). */
export function classTable(runs:readonly EvalRun[]):ClassRow[]{
 const keys=[...new Set(runs.map(r=>(r.taskClass??"unknown")+"\u0000"+(r.chosenModel??r.model)))];
 return keys.map(k=>{
  const [taskClass,model]=k.split("\u0000"),all=runs.filter(r=>(r.taskClass??"unknown")===taskClass&&(r.chosenModel??r.model)===model),ok=all.filter(r=>r.ok);
  const costs=all.map(r=>r.costUsdEstimate).filter((x):x is number=>x!==null),ment=ok.map(r=>r.mentionHitRate).filter((x):x is number=>x!==null);
  return {taskClass,model,runs:all.length,ok:ok.length,failures:all.length-ok.length,okRate:ok.length/all.length,correctionsMean:mean(ok.map(r=>r.corrections)),persianRatioMean:mean(ok.map(r=>r.persianRatio)),mentionHitRateMean:mean(ment),costUsdEstimateMean:mean(costs),latencyMeanMs:mean(ok.map(r=>r.latencyMs))};
 }).sort((a,b)=>a.taskClass.localeCompare(b.taskClass)||a.model.localeCompare(b.model));
}
const NIL=(x:number|null,worst:number)=>x===null?worst:x;
/** Ranking: ok-rate desc, corrections asc, Persian ratio desc, mustMention desc, cost asc (then model id for a stable order). */
export const compareRows=(a:ClassRow,b:ClassRow):number=>b.okRate-a.okRate||NIL(a.correctionsMean,99)-NIL(b.correctionsMean,99)||NIL(b.persianRatioMean,0)-NIL(a.persianRatioMean,0)||NIL(b.mentionHitRateMean,0)-NIL(a.mentionHitRateMean,0)||NIL(a.costUsdEstimateMean,1e9)-NIL(b.costUsdEstimateMean,1e9)||a.model.localeCompare(b.model);
/** A `classOverrides` snippet (best two models per class that had at least one success). For the OWNER to review and paste; nothing is ever written to config. */
export function suggestClassOverrides(runs:readonly EvalRun[],rungs=2):Record<string,string[]>{
 const out:Record<string,string[]>={},rows=classTable(runs).filter(r=>r.ok>0&&r.taskClass!=="unknown"&&r.model!=="router");
 for(const c of new Set(rows.map(r=>r.taskClass)))out[c]=rows.filter(r=>r.taskClass===c).sort(compareRows).slice(0,rungs).map(r=>r.model);
 return out;
}

// ---- .env parser (values are returned to the caller, never printed here) ----
export function parseEnvFile(text:string):Record<string,string>{
 const out:Record<string,string>={};
 for(const raw of text.split(/\r?\n/)){
  const line=raw.trim();if(!line||line.startsWith("#"))continue;
  const m=/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);if(!m)continue;
  let v=m[2].trim();
  if((v.startsWith("\"")&&v.endsWith("\"")&&v.length>=2)||(v.startsWith("'")&&v.endsWith("'")&&v.length>=2))v=v.slice(1,-1);
  else v=v.replace(/\s+#.*$/,"");
  out[m[1]]=v;
 }
 return out;
}
/** Copies parsed values into `env` without overriding variables already set. Returns the NAMES it set (never values). */
export function applyEnv(parsed:Record<string,string>,env:Record<string,string|undefined>):string[]{
 const set:string[]=[];for(const [k,v] of Object.entries(parsed))if(env[k]===undefined&&v!==""){env[k]=v;set.push(k);}return set;
}

// ---- HTML report ----
const esc=(s:unknown)=>String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const num=(x:number|null,d=1)=>x===null?"-":x.toFixed(d);
const pct=(x:number|null)=>x===null?"-":Math.round(x*100)+"%";
const usd=(x:number|null)=>x===null?"-":"$"+x.toFixed(4);
const ms=(x:number|null)=>x===null?"-":Math.round(x)+" ms";
const ul=(l:readonly string[]|undefined)=>l&&l.length?"<ul>"+l.map(x=>"<li>"+esc(x)+"</li>").join("")+"</ul>":"<p class=\"none\">-</p>";
const dl=(o:Record<string,unknown>|undefined)=>o?"<dl>"+Object.entries(o).map(([k,v])=>"<dt>"+esc(k)+"</dt><dd>"+(Array.isArray(v)?esc(v.join("؛ ")):esc(v))+"</dd>").join("")+"</dl>":"<p class=\"none\">-</p>";
function cell(r:EvalRun|undefined,kind:"image"|"video"){
 if(!r)return "<td class=\"none\">-</td>";
 const p=r.plan,m=[["وضعیت",r.ok?"موفق":"ناموفق"+(r.fallbackReason?" ("+r.fallbackReason+")":"")+(r.error?" ["+r.error+"]":"")],["تأخیر",ms(r.latencyMs)],["توکن ورودی/خروجی",r.usage?r.usage.input_tokens+" / "+r.usage.output_tokens:"-"],["هزینهٔ تخمینی",usd(r.costUsdEstimate)],["اصلاح‌ها",String(r.corrections)],["فارسی",pct(r.persianRatio)],[kind==="image"?"دوربین کامل":"شات کامل",r.complete===null?"-":r.complete?"بله":"خیر"],["کلیدواژه‌ها",pct(r.mentionHitRate)+(r.mentionMisses.length?" (جاافتاده: "+r.mentionMisses.join("، ")+")":"")],["ممنوع‌ها",r.mustNotViolations.length?r.mustNotViolations.join("، "):"-"]];
 return "<td><dl class=\"metrics\">"+m.map(([k,v])=>"<dt>"+esc(k)+"</dt><dd>"+esc(v)+"</dd>").join("")+"</dl>"+
  (p?"<h4>خلاصه</h4><p>"+esc(p.intentSummaryFa)+"</p><h4>"+(kind==="image"?"دوربین":"شات")+"</h4>"+dl((kind==="image"?p.camera:p.shot) as Record<string,unknown>|undefined)+"<h4>محدودیت‌ها</h4>"+ul(p.hardConstraints)+"<h4>ترجیح‌ها</h4>"+ul(p.softPreferences)+"<h4>چک‌لیست کیفیت</h4>"+ul(p.qaChecklist)+(p.clarifyingQuestionFa?"<h4>پرسش روشن‌کننده</h4><p>"+esc(p.clarifyingQuestionFa)+"</p>":""):"<p class=\"none\">بدون برنامهٔ عمومی</p>")+
  "<label class=\"rate\">امتیاز مالک (۱ تا ۵) <input type=\"number\" min=\"1\" max=\"5\" step=\"1\" aria-label=\"امتیاز\"></label></td>";
}
/** Self-contained RTL Persian report: summary table per model, then every prompt with the models side by side. No external assets, no scripts. */
export function renderReport(runs:readonly EvalRun[],prompts:readonly EvalPrompt[],meta:{generatedAt:string;models:readonly string[]}):string{
 const sums=summarize(runs);
 const head="<tr><th>مدل</th><th>اجرا</th><th>موفق</th><th>ناموفق</th><th>تأخیر میانگین</th><th>p50</th><th>p95</th><th>هزینهٔ کل (تخمین)</th><th>هزینهٔ میانگین (تخمین)</th><th>فارسی</th><th>تکمیل دوربین/شات</th><th>کلیدواژه</th><th>تخطی ممنوع</th><th>اصلاح (میانگین)</th><th>فیلتر نشت</th><th>توکن ورودی/خروجی (میانگین)</th></tr>";
 const rows=sums.map(s=>"<tr><th scope=\"row\" dir=\"ltr\">"+esc(s.model)+"</th><td>"+s.runs+"</td><td>"+s.ok+"</td><td>"+s.failures+"</td><td>"+ms(s.latencyMeanMs)+"</td><td>"+ms(s.latencyP50Ms)+"</td><td>"+ms(s.latencyP95Ms)+"</td><td>"+usd(s.costUsdEstimateTotal)+"</td><td>"+usd(s.costUsdEstimateMean)+"</td><td>"+pct(s.persianRatioMean)+"</td><td>"+pct(s.completeRate)+"</td><td>"+pct(s.mentionHitRateMean)+"</td><td>"+s.violationRuns+"</td><td>"+num(s.correctionsMean)+"</td><td>"+s.leakFiltered+"</td><td>"+num(s.tokensInMean,0)+" / "+num(s.tokensOutMean,0)+"</td></tr>").join("");
 const sections=prompts.map(p=>{
  const cols=meta.models.map(m=>runs.find(r=>r.promptId===p.id&&r.model===m));
  return "<section><h3><span dir=\"ltr\">"+esc(p.id)+"</span></h3><blockquote>"+esc(p.input.text)+"</blockquote><table class=\"cmp\"><thead><tr>"+meta.models.map(m=>"<th dir=\"ltr\">"+esc(m)+"</th>").join("")+"</tr></thead><tbody><tr>"+cols.map(r=>cell(r,p.expect.kind)).join("")+"</tr></tbody></table></section>";
 }).join("");
 const ct=classTable(runs),sug=suggestClassOverrides(runs);
 const classSection=ct.length?"<h2>به تفکیک نوع کار</h2><div class=\"wrap\"><table><thead><tr><th>کلاس</th><th>مدل</th><th>اجرا</th><th>موفق</th><th>ناموفق</th><th>اصلاح</th><th>فارسی</th><th>کلیدواژه</th><th>هزینهٔ میانگین (تخمین)</th><th>تأخیر</th></tr></thead><tbody>"+ct.map(r=>"<tr><th scope=\"row\" dir=\"ltr\">"+esc(r.taskClass)+"</th><td dir=\"ltr\">"+esc(r.model)+"</td><td>"+r.runs+"</td><td>"+r.ok+"</td><td>"+r.failures+"</td><td>"+num(r.correctionsMean)+"</td><td>"+pct(r.persianRatioMean)+"</td><td>"+pct(r.mentionHitRateMean)+"</td><td>"+usd(r.costUsdEstimateMean)+"</td><td>"+ms(r.latencyMeanMs)+"</td></tr>").join("")+"</tbody></table></div><h3>پیشنهاد نردبان برای هر کلاس</h3><p class=\"note\">فقط پیشنهاد آماری برای تصمیم مالک؛ هیچ فایل پیکربندی خودکار تغییر نمی‌کند. رتبه‌بندی: نرخ موفقیت، سپس اصلاح‌ها، فارسی، کلیدواژه و در آخر هزینه. نمونه‌ها کم‌اند؛ با دید انسانی بررسی کن.</p><pre dir=\"ltr\">"+esc(JSON.stringify({classOverrides:sug},null,1))+"</pre>":"";
 return "<!doctype html><html lang=\"fa\" dir=\"rtl\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><meta name=\"robots\" content=\"noindex\"><title>ارزیابی برنامه‌ریز</title><style>"+
 ":root{--bg:#fff;--fg:#1a1a1a;--mut:#666;--line:#d8d8d8;--card:#f6f6f6;--acc:#0b6bcb}@media(prefers-color-scheme:dark){:root{--bg:#121212;--fg:#ececec;--mut:#9a9a9a;--line:#333;--card:#1c1c1c;--acc:#6cb2ff}}"+
 "body{margin:0 auto;max-width:1400px;padding:16px;background:var(--bg);color:var(--fg);font:15px/1.7 system-ui,Tahoma,sans-serif}h1,h2{margin:.6em 0}h3{margin:1.6em 0 .3em}h4{margin:.9em 0 .2em;color:var(--mut);font-size:13px}"+
 "table{border-collapse:collapse;width:100%}th,td{border:1px solid var(--line);padding:6px 8px;vertical-align:top;text-align:start}.wrap{overflow-x:auto}blockquote{margin:.4em 0;padding:8px 12px;background:var(--card);border-inline-start:3px solid var(--acc)}"+
 "dl{margin:0;display:grid;grid-template-columns:max-content 1fr;gap:2px 10px}dt{color:var(--mut)}dd{margin:0}ul{margin:.2em 0;padding-inline-start:1.2em}.none{color:var(--mut)}.rate{display:block;margin-top:10px}.rate input{width:3.5em}.note{color:var(--mut)}pre{background:var(--card);padding:10px;overflow-x:auto}"+
 "</style></head><body><h1>ارزیابی برنامه‌ریز خصوصی</h1><p class=\"note\">تولید: "+esc(meta.generatedAt)+" | هزینه‌ها تخمین‌اند و فقط برای مقایسهٔ داخلی؛ مدل‌ها و قیمت‌ها هرگز به مشتری نشان داده نمی‌شوند. تأخیر و کیفیت فقط روی اجراهای موفق حساب شده است.</p>"+
 "<h2>خلاصه</h2><div class=\"wrap\"><table><thead>"+head+"</thead><tbody>"+rows+"</tbody></table></div><h2>مقایسهٔ پرامپت‌ها</h2>"+sections+"</body></html>";
}
