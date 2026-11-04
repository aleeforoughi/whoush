/** Character Studio user-supplied image contract. No facial recognition or identity inference. */
export const CHARACTER_VIEWS=[
 {id:"front",title:"روبرو",english:"Front",required:true,
  guide:"صورت روبه‌دوربین، چشم‌ها مشخص، حالت خنثی و نور ملایم."},
 {id:"three_quarter_left",title:"سه‌رخ چپ",english:"Left 3/4",required:true,
  guide:"سر حدود ۴۵ درجه به چپ؛ همان نور، مو و فاصله دوربین."},
 {id:"three_quarter_right",title:"سه‌رخ راست",english:"Right 3/4",required:false,
  guide:"سر حدود ۴۵ درجه به راست، صورت بدون فیلتر."},
 {id:"profile_left",title:"نیم‌رخ چپ",english:"Left side",required:true,
  guide:"صورت دقیقاً از کنار و بدون پوشاندن خط فک و بینی."},
 {id:"profile_right",title:"نیم‌رخ راست",english:"Right side",required:false,
  guide:"نیم‌رخ سمت دیگر با همان نور و کیفیت."},
 {id:"full_body",title:"تمام‌قد",english:"Full body",required:true,
  guide:"تمام بدن از سر تا پا در کادر، قامت طبیعی و پس‌زمینه ساده."}
] as const;
export type CharacterView=typeof CHARACTER_VIEWS[number]["id"];
export type CharacterReferences=Partial<Record<CharacterView,Blob>>;
export const REQUIRED_CHARACTER_VIEWS:readonly CharacterView[]=CHARACTER_VIEWS.filter(v=>v.required).map(v=>v.id);
export const MAX_CHARACTER_IMAGE_BYTES=8*1024*1024;
export const ALLOWED_CHARACTER_IMAGE_TYPES=["image/jpeg","image/png","image/webp"] as const;
/** Hard minimum on both sides; below the recommended side only a warning is shown. */
export const MIN_CHARACTER_IMAGE_SIDE=512;
export const RECOMMENDED_CHARACTER_IMAGE_SIDE=1024;
const viewTitle=(id:string)=>CHARACTER_VIEWS.find(v=>v.id===id)?.title??id;

// ---- consent: a versioned record of exactly what the person confirmed ----
export const CONSENT_VERSION="1.0";
export type ConsentScope="reference_planning";
/** The exact text shown next to the checkbox for consent v1.0. It is stored with the profile, not looked up later. */
export const CONSENT_TEXT_FA="تأیید می‌کنم که مالک این تصاویر هستم یا از فردِ داخل تصاویر اجازهٔ صریح دارم که از چهره و شباهت او برای برنامه‌ریزی ساخت تصویر و ویدیو در هووش استفاده شود. می‌دانم که تصاویر فعلاً فقط در همین مرورگر ذخیره می‌شوند، به سرویس تولید ارسال نمی‌شوند و حفظ دقیق چهره تضمین‌شده نیست. هر زمان بخواهم می‌توانم رضایت را پس بگیرم؛ در این صورت کاراکتر و همهٔ تصاویرش از این مرورگر حذف می‌شود.";
export type CharacterConsent={version:string;textFa:string;confirmedAt:string;scope:ConsentScope[]};
export function createCharacterConsent(confirmedAt:string):CharacterConsent{
 return {version:CONSENT_VERSION,textFa:CONSENT_TEXT_FA,confirmedAt,scope:["reference_planning"]};
}
/** What profiles saved before consent records existed had next to the checkbox. They keep this text, never the v1.0 one. */
export const LEGACY_CONSENT_VERSION="0.1";
export const LEGACY_CONSENT_TEXT_FA="مالک این تصاویر هستم یا اجازه استفاده از چهره و شباهت فرد را برای تولید محتوای تصویری دارم.";

// ---- per-angle metadata, stored next to each blob ----
export type ReferenceMeta={width:number;height:number;bytes:number;type:string;addedAt:string;sha256:string};
export type CharacterReferenceMeta=Partial<Record<CharacterView,ReferenceMeta>>;
export type CharacterProfile={
 id:string;name:string;notes:string;createdAt:string;updatedAt:string;
 consent:CharacterConsent|null;references:CharacterReferences;referenceMeta:CharacterReferenceMeta;version:number;
};
const isoTime=(v:unknown)=>typeof v==="string"&&v.length>0?Date.parse(v):NaN;
const isAllowedType=(t:string)=>(ALLOWED_CHARACTER_IMAGE_TYPES as readonly string[]).includes(t);
export async function sha256Hex(blob:Blob):Promise<string>{
 const digest=await crypto.subtle.digest("SHA-256",await blob.arrayBuffer());
 return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("");
}
export function buildReferenceMeta(input:{width:number;height:number;blob:Blob;sha256:string;addedAt:string}):ReferenceMeta{
 const meta:ReferenceMeta={width:input.width,height:input.height,bytes:input.blob.size,type:input.blob.type,addedAt:input.addedAt,sha256:input.sha256};
 validateReferenceMeta(meta,input.blob);
 return meta;
}
export function validateReferenceMeta(meta:ReferenceMeta|undefined,blob:Blob):void{
 if(!meta)throw new Error("اطلاعات تصویر مرجع ثبت نشده است.");
 const side=(n:number)=>Number.isInteger(n)&&n>0;
 if(!side(meta.width)||!side(meta.height))throw new Error("ابعاد تصویر مرجع نامعتبر است.");
 if(Math.min(meta.width,meta.height)<MIN_CHARACTER_IMAGE_SIDE)throw new Error("تصویر باید حداقل ۵۱۲ پیکسل عرض و ارتفاع داشته باشد.");
 if(meta.bytes!==blob.size||meta.type!==blob.type||!isAllowedType(meta.type)||meta.bytes>MAX_CHARACTER_IMAGE_BYTES)throw new Error("مشخصات فایل تصویر با خود فایل نمی‌خواند.");
 if(!/^[0-9a-f]{64}$/.test(meta.sha256))throw new Error("اثر انگشت تصویر نامعتبر است.");
 if(Number.isNaN(isoTime(meta.addedAt)))throw new Error("زمان افزودن تصویر نامعتبر است.");
}
/** The angle that already uses this exact image, if any (the angle being replaced is ignored). */
export function findDuplicateReference(meta:CharacterReferenceMeta,sha256:string,exceptView?:CharacterView):CharacterView|undefined{
 return CHARACTER_VIEWS.find(v=>v.id!==exceptView&&meta[v.id]?.sha256===sha256)?.id;
}
export function duplicateReferenceMessage(view:CharacterView):string{
 return "این همان عکسی است که برای نمای «"+viewTitle(view)+"» گذاشته‌ای. برای هر زاویه یک عکس جداگانه لازم است.";
}
/** Soft warnings only; they never block saving. */
export function referenceWarnings(view:CharacterView,meta:ReferenceMeta):string[]{
 const out:string[]=[];
 if(Math.min(meta.width,meta.height)<RECOMMENDED_CHARACTER_IMAGE_SIDE)out.push("کیفیت پایین‌تر از حد توصیه‌شده (ضلع کوتاه کمتر از ۱۰۲۴ پیکسل).");
 if(view==="full_body"&&meta.width>meta.height)out.push("عکس تمام‌قد معمولاً عمودی است؛ این عکس افقی است و ممکن است سر یا پا بریده شده باشد.");
 return out;
}

// ---- coverage ----
export function characterCoverage(refs:CharacterReferences){
 const uploaded=CHARACTER_VIEWS.filter(v=>refs[v.id] instanceof Blob).map(v=>v.id);
 const missing=REQUIRED_CHARACTER_VIEWS.filter(id=>!uploaded.includes(id));
 const requiredTotal=REQUIRED_CHARACTER_VIEWS.length;
 return {uploaded,missing,requiredReady:missing.length===0,count:uploaded.length,total:CHARACTER_VIEWS.length,
  requiredCount:requiredTotal-missing.length,requiredTotal,
  optionalCount:uploaded.length-(requiredTotal-missing.length),optionalTotal:CHARACTER_VIEWS.length-requiredTotal};
}
export const missingViewTitles=(refs:CharacterReferences)=>characterCoverage(refs).missing.map(viewTitle);

// ---- consent checks, migration and usability ----
/** Persian reason the consent is not current for these references, or undefined when it is. */
export function consentProblem(consent:CharacterConsent|null|undefined,meta:CharacterReferenceMeta):string|undefined{
 if(!consent)return "تأیید حق استفاده از تصاویر لازم است.";
 if(consent.version!==CONSENT_VERSION||consent.textFa!==CONSENT_TEXT_FA)return "رضایت ثبت‌شده برای این کاراکتر با متن فعلی رضایت‌نامه نمی‌خواند؛ دوباره تأیید کن.";
 if(!consent.scope.includes("reference_planning"))return "دامنهٔ رضایت برای برنامه‌ریزی با تصاویر مرجع ثبت نشده است.";
 const at=isoTime(consent.confirmedAt);
 if(Number.isNaN(at))return "زمان تأیید رضایت نامعتبر است.";
 if(CHARACTER_VIEWS.some(v=>{const added=isoTime(meta[v.id]?.addedAt);return !Number.isNaN(added)&&added>at;}))
  return "پس از آخرین تأیید رضایت، تصویر جدیدی اضافه شده است؛ دوباره تأیید کن.";
 return undefined;
}
export const hasCurrentConsent=(p:Pick<CharacterProfile,"consent"|"referenceMeta">)=>!consentProblem(p.consent,p.referenceMeta);
/** A stored record, possibly from before consent records and reference metadata existed. */
export type StoredCharacterRecord=Omit<CharacterProfile,"consent"|"referenceMeta">&{consent?:CharacterConsent|null;consentConfirmedAt?:string;referenceMeta?:CharacterReferenceMeta};
/** Old profiles keep the consent time and the text they were given, marked as the legacy version; they are not current and must be re-confirmed. */
export function migrateCharacterProfile(raw:StoredCharacterRecord):CharacterProfile{
 const {consentConfirmedAt,consent,referenceMeta,...rest}=raw;
 const migrated:CharacterConsent|null=consent??(consentConfirmedAt
  ?{version:LEGACY_CONSENT_VERSION,textFa:LEGACY_CONSENT_TEXT_FA,confirmedAt:consentConfirmedAt,scope:["reference_planning"]}:null);
 return {...rest,consent:migrated,referenceMeta:referenceMeta??{}};
}
export type Usability={ok:true}|{ok:false;reason:string};
/** Selectable in chat: every required view plus a current consent. */
export function characterUsability(p:Pick<CharacterProfile,"references"|"consent"|"referenceMeta">):Usability{
 const missing=missingViewTitles(p.references);
 if(missing.length)return {ok:false,reason:"نماهای ضروری ناقص است: "+missing.join("، ")};
 const problem=consentProblem(p.consent,p.referenceMeta);
 return problem?{ok:false,reason:problem}:{ok:true};
}

export function validateCharacterProfile(profile:CharacterProfile):void{
 if(!profile.id||profile.name.trim().length<2||profile.name.trim().length>80)
  throw new Error("نام کاراکتر باید بین ۲ تا ۸۰ حرف باشد.");
 if(profile.notes.length>1200)throw new Error("توضیحات طولانی‌تر از حد مجاز است.");
 if(!Number.isInteger(profile.version)||profile.version<1)throw new Error("نسخهٔ کاراکتر نامعتبر است.");
 const problem=consentProblem(profile.consent,profile.referenceMeta);
 if(problem)throw new Error(problem);
 const seen=new Map<string,string>();
 for(const [angle,blob] of Object.entries(profile.references)){
  if(!CHARACTER_VIEWS.some(v=>v.id===angle))throw new Error("زاویه ناشناخته است.");
  if(!(blob instanceof Blob)||!isAllowedType(blob.type)||blob.size>MAX_CHARACTER_IMAGE_BYTES)
   throw new Error("فایل تصویر نامعتبر است؛ فقط JPEG، PNG یا WebP تا ۸ مگابایت.");
  const meta=profile.referenceMeta[angle as CharacterView];
  validateReferenceMeta(meta,blob);
  const other=seen.get(meta!.sha256);
  if(other)throw new Error(duplicateReferenceMessage(other as CharacterView));
  seen.set(meta!.sha256,angle);
 }
 if(Object.keys(profile.referenceMeta).some(k=>!(profile.references[k as CharacterView] instanceof Blob)))throw new Error("اطلاعات تصویر بدون فایل مرجع ثبت شده است.");
}

// ---- versioning: only a change of name, notes or images makes a new version ----
export function referenceFingerprint(meta:CharacterReferenceMeta):string{
 return CHARACTER_VIEWS.flatMap(v=>meta[v.id]?[v.id+":"+meta[v.id]!.sha256]:[]).join("|");
}
export function nextCharacterVersion(prev:Pick<CharacterProfile,"name"|"notes"|"referenceMeta"|"version">|undefined,next:Pick<CharacterProfile,"name"|"notes"|"referenceMeta">):number{
 if(!prev)return 1;
 const changed=prev.name!==next.name||prev.notes!==next.notes||referenceFingerprint(prev.referenceMeta)!==referenceFingerprint(next.referenceMeta);
 return changed?prev.version+1:prev.version;
}

// ---- export: manifest and file names (no image data) ----
export function characterSlug(name:string,id:string):string{
 const clean=(s:string)=>s.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,40).replace(/-+$/,"");
 return clean(name)||clean(id)||"character";
}
export const characterExportBaseName=(p:Pick<CharacterProfile,"name"|"id"|"version">)=>"whoush-"+characterSlug(p.name,p.id)+"-v"+p.version;
export type CharacterManifest={
 schema:"whoush.character-manifest";schemaVersion:1;exportedAt:string;storage:"browser-local";imagesIncluded:false;
 id:string;name:string;version:number;notes:string;createdAt:string;updatedAt:string;consent:CharacterConsent|null;
 coverage:{uploaded:CharacterView[];missingRequired:CharacterView[];requiredReady:boolean};
 references:Array<{view:CharacterView;titleFa:string;titleEn:string;required:boolean;provided:boolean;meta:ReferenceMeta|null}>;
};
/** Everything about a profile except the pixels; meant for a future server-side import. */
export function buildCharacterManifest(profile:CharacterProfile,exportedAt:string):CharacterManifest{
 const cov=characterCoverage(profile.references);
 return {
  schema:"whoush.character-manifest",schemaVersion:1,exportedAt,storage:"browser-local",imagesIncluded:false,
  id:profile.id,name:profile.name,version:profile.version,notes:profile.notes,createdAt:profile.createdAt,updatedAt:profile.updatedAt,consent:profile.consent,
  coverage:{uploaded:[...cov.uploaded],missingRequired:[...cov.missing],requiredReady:cov.requiredReady},
  references:CHARACTER_VIEWS.map(v=>({view:v.id,titleFa:v.title,titleEn:v.english,required:v.required,provided:profile.references[v.id] instanceof Blob,meta:profile.referenceMeta[v.id]??null}))
 };
}
export function buildCharacterLockBrief(profile:Pick<CharacterProfile,"name"|"notes"|"references">):string{
 const coverage=characterCoverage(profile.references);
 return [
  "CHARACTER REFERENCE PLAN (not an actual generated identity lock).",
  "Character: "+profile.name,
  "Reference angles provided: "+coverage.uploaded.join(", "),
  "Missing recommended angles: "+coverage.missing.join(", "),
  "Identity constraints: keep face geometry, hair, age presentation, body proportions, skin texture, proportions and natural expression matching consented references; modify only requested traits.",
  "Never invent or claim access to missing reference angles. Resolve ambiguity through a user question, not uncontrolled regeneration.",
  "Model-specific identity adherence requires reference-image support and post-generation visual review.",
  profile.notes.trim()?"Approved appearance notes: "+profile.notes.trim():""
 ].filter(Boolean).join("\n");
}
