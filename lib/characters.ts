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
export type CharacterProfile={
 id:string;name:string;notes:string;createdAt:string;updatedAt:string;
 consentConfirmedAt:string;references:CharacterReferences;version:number;
};
export const REQUIRED_CHARACTER_VIEWS:readonly CharacterView[]=CHARACTER_VIEWS.filter(v=>v.required).map(v=>v.id);
export const MAX_CHARACTER_IMAGE_BYTES=8*1024*1024;
export const ALLOWED_CHARACTER_IMAGE_TYPES=["image/jpeg","image/png","image/webp"] as const;
export function characterCoverage(refs:CharacterReferences){
 const uploaded=CHARACTER_VIEWS.filter(v=>refs[v.id] instanceof Blob).map(v=>v.id);
 const missing=REQUIRED_CHARACTER_VIEWS.filter(id=>!uploaded.includes(id));
 return {uploaded,missing,requiredReady:missing.length===0,count:uploaded.length,total:CHARACTER_VIEWS.length};
}
export function validateCharacterProfile(profile:CharacterProfile):void{
 if(!profile.id||profile.name.trim().length<2||profile.name.trim().length>80)
  throw new Error("نام کاراکتر باید بین ۲ تا ۸۰ حرف باشد.");
 if(profile.notes.length>1200)throw new Error("توضیحات طولانی‌تر از حد مجاز است.");
 if(!profile.consentConfirmedAt)throw new Error("تأیید حق استفاده از تصاویر لازم است.");
 for(const [angle,blob] of Object.entries(profile.references)){
  if(!CHARACTER_VIEWS.some(v=>v.id===angle))throw new Error("زاویه ناشناخته است.");
  if(!(blob instanceof Blob)||!ALLOWED_CHARACTER_IMAGE_TYPES.includes(blob.type as typeof ALLOWED_CHARACTER_IMAGE_TYPES[number])||blob.size>MAX_CHARACTER_IMAGE_BYTES)
   throw new Error("فایل تصویر نامعتبر است؛ فقط JPEG، PNG یا WebP تا ۸ مگابایت.");
 }
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
