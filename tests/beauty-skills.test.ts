import {test,beforeEach,afterEach} from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
process.env.WHOUSH_MEDIA_DIR=mkdtempSync(join(tmpdir(),"whoush-beauty-test-"));
import {SKILLS,resolveCreativeSkills,compileSkillInstructions} from "../lib/skills";
import {inferAttachmentRoles} from "../lib/attachments";
import {evaluateTextSafety} from "../lib/safety";
import {forgetReviewsForTests,reviewUpload} from "../lib/upload-review";
import {orchestrateCreativeTurn,getPrivateMediaPrompt,type OrchestratorResult} from "../lib/orchestrator";
import {resetRouterStateForTests} from "../lib/llm-routing";

const ENV_KEYS=["LLM_PROVIDER_AUTHORIZED","ALLOW_LIVE_LLM","ANTHROPIC_API_KEY","OPENAI_API_KEY"];
let saved:Record<string,string|undefined>={};
beforeEach(()=>{resetRouterStateForTests();forgetReviewsForTests();saved=Object.fromEntries(ENV_KEYS.map(k=>[k,process.env[k]]));for(const k of ENV_KEYS)delete process.env[k];});
afterEach(()=>{for(const k of ENV_KEYS){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}});

test("influencer skills (owner, 2026-11-06): 14 professional specialists, private, each switched on by its own work",()=>{
 for(const id of ["makeup_artist","beauty_retoucher","anatomy_specialist","beauty_fashion","fashion_trends","wardrobe_stylist","hairstylist","model_director",
  "body_language","marketing_psychologist","social_media_marketing","influencer_marketing","tiktok_viral","instagram_viral"] as const)assert.ok(SKILLS[id]?.checks.length>=3,id);
 const retouch=resolveCreativeSkills({prompt:"این عکس منه، روتوش طبیعی کن، آرایش ملایم",kind:"image",attachmentRoles:["edit_reference"]});
 for(const id of ["beauty_retoucher","makeup_artist","anatomy_specialist","photo_editor","beauty_fashion","body_language"])assert.ok(retouch.includes(id as never),id);
 const plain=resolveCreativeSkills({prompt:"یه عکس از یه دریاچه",kind:"image"});
 assert.ok(!plain.some(id=>["makeup_artist","beauty_retoucher","marketing_psychologist","influencer_marketing"].includes(id)),"a lake needs none of them");
 const ad=resolveCreativeSkills({prompt:"یه ریلز اینستاگرام برای همکاری با برند رژ لب",kind:"video"});
 for(const id of ["influencer_marketing","social_media_marketing","marketing_psychologist","makeup_artist","instagram_viral"])assert.ok(ad.includes(id as never),id);
 assert.ok(resolveCreativeSkills({prompt:"یه ویدیو وایرال برای تیک تاک",kind:"video"}).includes("tiktok_viral"));
 for(const id of ["tiktok_viral","instagram_viral"] as const)assert.ok(SKILLS[id].checks.some(c=>c.includes("Never claim")),id+": no invented trends");
 const sys=compileSkillInstructions({prompt:"روتوش طبیعی پوست",kind:"image",attachmentRoles:["edit_reference"]});
 assert.ok(sys.includes("Professional Beauty Photo Retoucher")&&sys.includes("keep pores"),"compiled into the private instructions");
 assert.ok(SKILLS.marketing_psychologist.checks.some(c=>c.includes("Never manipulate")),"honest persuasion only");
});

test("a retouch, makeup or beautify request on a photo edits that photo in place; a makeup photo with no edit words stays a makeup reference",()=>{
 const role=(text:string)=>inferAttachmentRoles(text,[{tag:"image1",kind:"image"}])[0].role;
 for(const t of ["این عکس منه، یه روتوش طبیعی کن","#تصویر-۱ رو زیباتر کن","پوستمو صاف کن #تصویر-۱","#تصویر-۱ رو آرایش کن با رژ قرمز","retouch #image1, natural","beautify @image1","#تصویر-۱ رو یه کم لاغرتر کن"])
  assert.equal(role(t),"edit_reference",t);
 assert.equal(role("آرایش این عکس رو روی مدل دیگه بذار #تصویر-۱"),"makeup","a look to copy, not an edit");
});

test("influencer requests pass the content rules; only sexualizing body edits are refused, kindly and with safe ideas",()=>{
 for(const t of ["پوستمو صاف‌تر کن و جوش‌ها رو بردار","آرایش عروس با رژ لب نود و سایه طلایی","کمرمو یه کم باریک‌تر کن","فرم صورتم و فکمو مشخص‌تر کن","موهامو بلوند کن",
  "دندونامو سفیدتر کن","یه عکس فشن با مانتو و روسری ابریشمی","ریلز معرفی کرم ضدآفتاب","retouch my skin, keep the pores","slimmer waist and better posture"])
  assert.equal(evaluateTextSafety(t).decision,"allow",t);
 const r=evaluateTextSafety("سینه هاش بزرگتر کن");assert.equal(r.category,"sexualized_content");assert.ok(r.choices?.length);
});

test("a checked photo with a retouch request becomes an in-place edit priced with the photo; the plan keeps the person and the photo",async()=>{
 const me=await reviewUpload(new Uint8Array([0xff,0xd8,0xff,0xe0,1,2,3,4,5,6,7,8]),"image/jpeg",{inspect:async()=>({category:"none",person:true})});
 const r=await orchestrateCreativeTurn({text:"#تصویر-۱ رو روتوش کن: پوست صاف‌تر، آرایش ملایم",attachments:[{id:crypto.randomUUID(),tag:"image1",kind:"image",mime:"image/jpeg",bytes:2048,sha256:"c".repeat(64),reviewId:me.reviewId}]});
 assert.equal(r.status,"planned",JSON.stringify(r).slice(0,300));
 const p=r as Extract<OrchestratorResult,{status:"planned"}>;
 assert.equal(p.plan.references[0]?.role,"edit_reference");
 assert.ok(p.proposal.suggestions.length>0);
 assert.match(getPrivateMediaPrompt(p.turnId)!,/reference image 1|edit/i);
});
