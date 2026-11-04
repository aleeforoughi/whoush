import type {MediaConfiguration} from "./catalog";
import type {ProviderOutput} from "./media-provider";
export type QACheck={id:string;labelFa:string;result:"pass"|"fail"|"unverified";noteFa?:string};
export type OutputQA={status:"pending_inspection"|"failed_checks"|"not_applicable";checks:QACheck[]};
export const ALLOWED_OUTPUT_MIME=["image/png","image/jpeg","image/webp","video/mp4","video/webm","video/quicktime"] as const;
const NEEDS_HUMAN="نیازمند بازبینی انسانی یا چندوجهی است؛ به‌صورت خودکار تأیید نشده.";
const ratio=(a:string)=>{const [w,h]=a.split(":").map(Number);return w/h;};
/** Metadata-only checks. Identity, continuity, lip sync and text accuracy are NEVER passed automatically. Provider-reported completion is not a quality claim. */
export function evaluateOutputQA(job:{mode:"demo"|"live";configuration:MediaConfiguration},outputs:readonly ProviderOutput[]):OutputQA{
 if(job.mode==="demo")return {status:"not_applicable",checks:[]};
 const checks:QACheck[]=[{id:"output_count",labelFa:"وجود خروجی",result:outputs.length>0?"pass":"fail"}];
 const withMime=outputs.filter(o=>o.mime);
 checks.push({id:"mime",labelFa:"نوع فایل مجاز",result:!outputs.length||withMime.length<outputs.length?"unverified":outputs.every(o=>(ALLOWED_OUTPUT_MIME as readonly string[]).includes(o.mime!))?"pass":"fail"});
 const wantAspect=job.configuration.aspectRatio;
 if(wantAspect){const dims=outputs.filter(o=>o.width&&o.height);checks.push({id:"aspect_ratio",labelFa:"نسبت تصویر",result:!outputs.length||dims.length<outputs.length?"unverified":dims.every(o=>Math.abs(o.width!/o.height!-ratio(wantAspect))/ratio(wantAspect)<0.02)?"pass":"fail"});}
 const wantDur=job.configuration.durationSeconds;
 if(wantDur!==undefined){const d=outputs.filter(o=>o.durationSeconds!==undefined);checks.push({id:"duration",labelFa:"مدت‌زمان",result:!outputs.length||d.length<outputs.length?"unverified":d.every(o=>Math.abs(o.durationSeconds!-wantDur)<=0.5)?"pass":"fail"});}
 for(const [id,labelFa] of [["identity","حفظ هویت کاراکتر"],["continuity","پیوستگی"],["lip_sync","همگام‌سازی لب"],["text_accuracy","درستی متن روی تصویر"]] as const)checks.push({id,labelFa,result:"unverified",noteFa:NEEDS_HUMAN});
 return {status:checks.some(c=>c.result==="fail")?"failed_checks":"pending_inspection",checks};
}
