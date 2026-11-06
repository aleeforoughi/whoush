import "server-only";
/**
 * Research references (docs/RESEARCH_PIPELINE.md): for what the planner marked as needing research, Whoush finds open-licensed reference images, has a
 * vision model inspect each one for relevance and safety, and keeps only those that pass, in its own store, with their source and license.
 * Sources (owner decision 2026-11-06): Wikimedia Commons and Openverse only, both open-licensed. Evidence: docs/evidence/WIKIMEDIA.md, OPENVERSE.md.
 * Requests run one at a time (Wikimedia's etiquette); nothing here reaches a customer except the kept references and their attribution.
 */
import type {ResearchPlan} from "./creative-plan";
import {storeMedia,type StoredMime} from "./media-store";

/** Sent with every request: Wikimedia's API etiquette asks for a client name and contact. Production needs the owner's contact address here. */
export const RESEARCH_USER_AGENT="WhoushResearch/0.1 (development; https://github.com/aleeforoughi/whoush)";
const COMMONS_API="https://commons.wikimedia.org/w/api.php";
const OPENVERSE_API="https://api.openverse.org/v1/images/";
/**
 * Quick, effective, cheap (owner, 2026-11-06): few candidates, Openverse only when Wikimedia is short, one inspection call for everything, small images,
 * a 10-second budget for the whole research (what is ready by then is used), and searches remembered for a day.
 */
export const CANDIDATES_PER_SUBJECT=3,KEEP_PER_SUBJECT=2,MAX_REFERENCES=4,RESEARCH_BUDGET_MS=10_000;
const THUMB_WIDTH=512,MAX_IMAGE_BYTES=2_000_000,REQUEST_TIMEOUT_MS=6_000,CACHE_MS=24*60*60*1000,MAX_CACHED=300;

export type ReferenceCandidate={source:"wikimedia"|"openverse";title:string;imageUrl:string;sourceUrl:string;license:string;creator:string;mime?:string};
export type ResearchReference={id:string;url:string;subjectFa:string;title:string;license:string;creator:string;sourceUrl:string;source:"wikimedia"|"openverse";mime:StoredMime};
export type ResearchSubjectReport={labelFa:string;factsFa:string[];found:number;kept:number};
export type ResearchResult={subjects:ResearchSubjectReport[];references:ResearchReference[];
 /** Why fewer references than hoped (none found, inspection unavailable): shown in the report, never a provider or model name. */notesFa:string[]};
export type InspectVerdict={relevant:boolean;safe:boolean};
export type InspectGroup={subject:{labelFa:string;queries:string[];factsFa:string[]};images:{bytes:Uint8Array;mime:StoredMime}[]};
/** Inspects every subject's images in one call; returns, per group, one verdict per image in order. Throws when unavailable (then nothing is used). */
export type Inspector=(groups:InspectGroup[])=>Promise<InspectVerdict[][]>;
type Io={fetch:typeof fetch;inspect:Inspector;store:(bytes:Uint8Array,mime:StoredMime)=>Promise<{id:string;url:string}>};

/** Licenses Whoush may use as references: public domain, CC0, CC BY and CC BY-SA. Never non-commercial (NC) or no-derivatives (ND). */
export function isUsableLicense(name:string):boolean{
 const n=name.trim().toLowerCase().replace(/[_-]/g," ").replace(/\s+/g," ");
 if(!n||/\bnc\b|\bnd\b|non ?commercial|no ?deriv/.test(n))return false;
 if(/^(public domain|pd|pdm|cc0|cc zero|cc pdm|no restrictions)\b/.test(n))return true;
 return /^(cc )?by( sa)?( \d+(\.\d+)?)?\b/.test(n);
}
const plain=(html:string)=>html.replace(/<[^>]+>/g," ").replace(/&amp;/g,"&").replace(/&quot;/g,"\"").replace(/&#0?39;/g,"'").replace(/\s+/g," ").trim();

/** Wikimedia Commons file search (generator=search in the File namespace) with image info and license metadata. */
export async function searchWikimedia(query:string,limit:number,f:typeof fetch):Promise<ReferenceCandidate[]>{
 const q=new URLSearchParams({action:"query",format:"json",formatversion:"2",generator:"search",gsrnamespace:"6",gsrlimit:String(limit*2),
  gsrsearch:query+" filetype:bitmap",prop:"imageinfo",iiprop:"url|mime|size|extmetadata",iiurlwidth:String(THUMB_WIDTH),
  iiextmetadatafilter:"LicenseShortName|Artist|Copyrighted"});
 const r=await f(COMMONS_API+"?"+q,{headers:{"User-Agent":RESEARCH_USER_AGENT,"Api-User-Agent":RESEARCH_USER_AGENT},signal:AbortSignal.timeout(REQUEST_TIMEOUT_MS)});
 if(!r.ok)return [];
 const d=await r.json().catch(()=>undefined) as {query?:{pages?:{title:string;index?:number;imageinfo?:{thumburl?:string;url:string;mime:string;descriptionurl:string;extmetadata?:Record<string,{value:string}>}[]}[]}}|undefined;
 const pages=[...(d?.query?.pages??[])].sort((a,b)=>(a.index??0)-(b.index??0));
 const out:ReferenceCandidate[]=[];
 for(const p of pages){
  const ii=p.imageinfo?.[0];if(!ii||!/^image\/(jpeg|png|webp)$/.test(ii.mime))continue;
  const license=plain(ii.extmetadata?.LicenseShortName?.value??"");if(!isUsableLicense(license))continue;
  out.push({source:"wikimedia",title:p.title.replace(/^File:/,"").replace(/\.[a-z]+$/i,""),imageUrl:ii.thumburl??ii.url,sourceUrl:ii.descriptionurl,license,
   creator:plain(ii.extmetadata?.Artist?.value??"").slice(0,120)||"Wikimedia Commons",mime:ii.mime});
  if(out.length>=limit)break;
 }
 return out;
}
/** Openverse image search, commercial use and modification allowed (no NC, no ND), mature results excluded by default. */
export async function searchOpenverse(query:string,limit:number,f:typeof fetch):Promise<ReferenceCandidate[]>{
 const q=new URLSearchParams({q:query,license_type:"commercial,modification",page_size:String(limit*2)});
 const r=await f(OPENVERSE_API+"?"+q,{headers:{"User-Agent":RESEARCH_USER_AGENT},signal:AbortSignal.timeout(REQUEST_TIMEOUT_MS)});
 if(!r.ok)return [];
 const d=await r.json().catch(()=>undefined) as {results?:{title?:string;url:string;thumbnail?:string;foreign_landing_url?:string;license:string;license_version?:string;creator?:string;filetype?:string}[]}|undefined;
 const out:ReferenceCandidate[]=[];
 for(const x of d?.results??[]){
  const license=x.license==="cc0"?"CC0":x.license==="pdm"?"Public domain":("CC "+x.license.toUpperCase()+(x.license_version?" "+x.license_version:""));
  if(!isUsableLicense(license)||!x.foreign_landing_url)continue;
  out.push({source:"openverse",title:(x.title??"").slice(0,120)||"Openverse",imageUrl:x.url,sourceUrl:x.foreign_landing_url,license,creator:(x.creator??"").slice(0,120)||"Openverse"});
  if(out.length>=limit)break;
 }
 return out;
}
async function download(c:ReferenceCandidate,f:typeof fetch):Promise<{bytes:Uint8Array;mime:StoredMime}|undefined>{
 try{
  const r=await f(c.imageUrl,{headers:{"User-Agent":RESEARCH_USER_AGENT},signal:AbortSignal.timeout(REQUEST_TIMEOUT_MS)});
  if(!r.ok)return undefined;
  const mime=(r.headers.get("content-type")??"").split(";")[0].trim().toLowerCase();
  if(mime!=="image/jpeg"&&mime!=="image/png"&&mime!=="image/webp")return undefined;
  const bytes=new Uint8Array(await r.arrayBuffer());
  return bytes.byteLength>0&&bytes.byteLength<=MAX_IMAGE_BYTES?{bytes,mime}:undefined;
 }catch{return undefined;}
}

/** Search results remembered for a day (per server process), so the same subject is instant the next time. */
const cache=()=>((globalThis as {__whoushResearchCache?:Map<string,{at:number;results:ReferenceCandidate[]}>}).__whoushResearchCache??=new Map());
async function cachedSearch(kind:"wikimedia"|"openverse",query:string,f:typeof fetch,cacheable:boolean):Promise<ReferenceCandidate[]>{
 const key=kind+"|"+query.toLowerCase().trim(),hit=cache().get(key);
 if(cacheable&&hit&&Date.now()-hit.at<CACHE_MS)return hit.results;
 const results=await (kind==="wikimedia"?searchWikimedia:searchOpenverse)(query,CANDIDATES_PER_SUBJECT,f).catch(()=>[]);
 if(cacheable&&results.length){const c=cache();c.set(key,{at:Date.now(),results});while(c.size>MAX_CACHED)c.delete(c.keys().next().value as string);}
 return results;
}

/**
 * Researches the plan's subjects within RESEARCH_BUDGET_MS: per subject, Wikimedia first and Openverse only when Wikimedia is short; downloads the
 * candidates in parallel; inspects them all in one call (relevance and safety); stores and keeps at most KEEP_PER_SUBJECT that pass, MAX_REFERENCES in all.
 * Inspection unavailable means no references (fail closed), with a note for the report.
 */
export async function researchReferences(plan:ResearchPlan,io:Partial<Io>&{inspect:Inspector;now?:()=>number}):Promise<ResearchResult>{
 const f=io.fetch??fetch,store=io.store??storeMedia,now=io.now??Date.now,deadline=now()+RESEARCH_BUDGET_MS,cacheable=!io.fetch;
 const subjects:ResearchSubjectReport[]=plan.subjects.map(s=>({labelFa:s.labelFa,factsFa:[...s.factsFa],found:0,kept:0}));
 const notes=new Set<string>(),groups:{at:number;loaded:{c:ReferenceCandidate;img:{bytes:Uint8Array;mime:StoredMime}}[]}[]=[];
 for(let k=0;k<plan.subjects.length;k++){
  if(now()>deadline){notes.add("تحقیق برای سریع‌تر شدن کوتاه شد.");break;}
  const s=plan.subjects[k],candidates:ReferenceCandidate[]=[],seen=new Set<string>();
  for(const kind of ["wikimedia","openverse"] as const)for(const q of s.queries){
   if(candidates.length>=CANDIDATES_PER_SUBJECT||now()>deadline)break;
   for(const c of await cachedSearch(kind,q,f,cacheable))if(!seen.has(c.imageUrl)&&candidates.length<CANDIDATES_PER_SUBJECT){seen.add(c.imageUrl);candidates.push(c);}
  }
  const loaded=(await Promise.all(candidates.map(async c=>({c,img:await download(c,f)})))).filter((x):x is {c:ReferenceCandidate;img:{bytes:Uint8Array;mime:StoredMime}}=>Boolean(x.img));
  subjects[k].found=loaded.length;
  if(loaded.length)groups.push({at:k,loaded});else notes.add("برای «"+s.labelFa+"» مرجع آزادِ مناسبی پیدا نشد.");
 }
 const references:ResearchReference[]=[];
 if(groups.length){
  let verdicts:InspectVerdict[][];
  try{verdicts=await io.inspect(groups.map(g=>({subject:{labelFa:plan.subjects[g.at].labelFa,queries:plan.subjects[g.at].queries,factsFa:plan.subjects[g.at].factsFa},images:g.loaded.map(l=>l.img)})));}
  catch{notes.add("بررسی تصویری مرجع‌ها در دسترس نبود؛ برای اطمینان از هیچ مرجعی استفاده نشد.");verdicts=[];}
  for(let gi=0;gi<groups.length&&verdicts.length;gi++){
   const g=groups[gi],report=subjects[g.at];
   for(let i=0;i<g.loaded.length&&report.kept<KEEP_PER_SUBJECT&&references.length<MAX_REFERENCES;i++){
    const v=verdicts[gi]?.[i];if(!v?.relevant||!v.safe)continue;
    const {c,img}=g.loaded[i],saved=await store(img.bytes,img.mime);
    references.push({id:saved.id,url:saved.url,subjectFa:report.labelFa,title:c.title,license:c.license,creator:c.creator,sourceUrl:c.sourceUrl,source:c.source,mime:img.mime});
    report.kept++;
   }
   if(!report.kept)notes.add("مرجع‌های «"+report.labelFa+"» بعد از بررسی کنار گذاشته شدند (نامرتبط یا نامناسب).");
  }
 }
 return {subjects,references,notesFa:[...notes]};
}
