import {test} from "node:test";
import assert from "node:assert/strict";
import {normalizePersian,evaluateTextSafety,evaluatePlanTextSafety,assertSafeText,ContentPolicyError} from "../lib/safety";
import {SKILLS,resolveCreativeSkills,compileSkillInstructions} from "../lib/skills";
import {createDemoProposal} from "../lib/agent";

test("Persian normalization handles Arabic Yeh, Kaf, joiners and diacritics",()=>{
 assert.equal(normalizePersian("كـتاب‌ های  زیبا"),"کتاب های زیبا");
 assert.equal(normalizePersian("خامنه‌ای"),"خامنه ای");
});
test("nonpolitical Iran locations, flag and daily fashion remain available",()=>{
 for(const p of [
  "یک عکس حرفه‌ای در میدان انقلاب تهران با خیابان‌های واقعی",
  "یک پوستر نوروز با پرچم ایران و شکوفه‌ها",
  "عکس یک عروس با لباس مجلسی در شیراز",
  "برند آرایش با رنگ نود و رژ نود",
  "ورزشکار با لباس ورزشی در سالن"
 ])assert.equal(evaluateTextSafety(p).decision,"allow",p);
});
test("explicit politics and named political figures block in two scripts",()=>{
 for(const p of [
  "Make a campaign poster for President Trump",
  "Generate a political election video",
  "پوستر انتخاباتی با رئیس جمهور",
  "پرتره خامنه‌ای با چهره واقعی",
  "عکس حسن روحانی در جلسه",
  "ویدیو تظاهرات و اعتراضات"
 ]){
  const result=evaluateTextSafety(p);
  assert.equal(result.decision,"block",p);
  assert.ok(result.category==="politics"||result.category==="iran_politics",p);
  assert.ok(result.message&&result.choices?.length,"a kind message with safe ideas: "+p);
  assert.throws(()=>createDemoProposal(p),ContentPolicyError);
 }
});
test("nudity, revealing clothing and sexualized posing block",()=>{
 for(const p of [
  "Generate a bikini swimsuit portrait",
  "woman in lingerie",
  "make a topless portrait",
  "ژست سکسی با لباس زیر",
  "عکس نیمه‌برهنه",
  "با لباس شفاف و ژست اغواگر"
 ]){
  const r=evaluateTextSafety(p);
  assert.equal(r.decision,"block",p);
  assert.equal(r.category,"sexualized_content");
 }
});
test("ambiguous political usage and sensitive slang route to review, not generation",()=>{
 // «لباس پهلوی» is pre-revolution royal imagery: refused outright since the owner's rules of 2026-11-06 (tests/content-rules.test.ts).
 for(const p of ["از روحانی داخل عکس بگیر","متن فحاشی برای پوستر"]){
  const result=evaluateTextSafety(p);
  assert.equal(result.decision,"review",p);
  assert.throws(()=>assertSafeText(p),ContentPolicyError);
 }
});
test("image creation always includes four universal skills plus pro photographer",()=>{
 const skills=resolveCreativeSkills({prompt:"یک عکس پرتره طبیعی",kind:"image"});
 for(const id of ["prompt_engineer","creative_director","persian_language","qa","photographer"])
  assert.ok(skills.includes(id as keyof typeof SKILLS),id);
 const system=compileSkillInstructions({prompt:"عکس پرتره",kind:"image"});
 for(const phrase of ["aperture","ISO","shutter","white balance","lighting","framing","focal length"])
  assert.ok(system.toLowerCase().includes(phrase.toLowerCase()),phrase);
 assert.ok(!skills.includes("cinematographer"));
});
test("video creation always includes cinematography and videography",()=>{
 const skills=resolveCreativeSkills({prompt:"یک ویدیو سینمایی از دریا",kind:"video"});
 for(const id of ["cinematographer","videographer","prompt_engineer","qa"])
  assert.ok(skills.includes(id as keyof typeof SKILLS),id);
 const system=compileSkillInstructions({prompt:"ویدیو",kind:"video"});
 for(const phrase of ["shutter","FPS","continuity","motion"])
  assert.ok(system.includes(phrase),phrase);
});
test("editing brings source preserving specialty skills",()=>{
 assert.ok(resolveCreativeSkills({prompt:"پشت زمینه عکس را تغییر بده",kind:"image",task:"edit"}).includes("photo_editor"));
 assert.ok(resolveCreativeSkills({prompt:"mask video and preserve motion",kind:"video",task:"edit"}).includes("video_editor"));
});
test("social, Persian cultural, graphic design and copy skill routing",()=>{
 const skills=resolveCreativeSkills({prompt:"پوستر اینستاگرام نوروز تهران با کپشن فارسی",kind:"image"});
 for(const id of ["visual_designer","social_media","creative_copywriter","iranian_culture","iranian_geography"])
  assert.ok(skills.includes(id as keyof typeof SKILLS),id);
 assert.ok(resolveCreativeSkills({prompt:"music video",kind:"video",hasAudioReference:true}).includes("audiographer"));
});
test("unrelated skills not loaded for plain product photo",()=>{
 const ids=resolveCreativeSkills({prompt:"product photo of a cup",kind:"image"});
 assert.equal(ids.includes("social_media"),false);
 assert.equal(ids.includes("audiographer"),false);
});
test("core skill registry is complete",()=>{
 assert.equal(Object.keys(SKILLS).length,25);
 for(const [id,skill] of Object.entries(SKILLS)){
  assert.ok(skill.title&&skill.objective&&skill.checks.length,id);
 }
});

test("plan text: negated generic categories are compliance, named figures and explicit terms still block",()=>{
 // Seen live: planners obeying the no-politics rule wrote these and were blocked by the lexical scan.
 for(const t of ["Wide eye-level photograph of Enghelab Square in central Tehran on a calm spring morning, no political banners or slogans visible",
  "هیچ تابلوی سیاسی یا نماد سیاسی قابل خواندن نباشد.","هیچ شعار، بنر، پرچم سیاسی یا چهره سیاسی در تصویر نباشد","بدون هیچ نماد سیاسی",
  "Enghelab (Revolution) Square at sunrise","modest evening dress, nothing revealing, no lingerie","پوشش کامل و بدون لباس بدن نما",
  "صحنه زندگی روزمره شهری باشد؛ چهره سیاسی، تجمع سیاسی یا نماد سیاسی به تصویر اضافه نشود.","از نمایش چهره‌های سیاسی، تصاویر سیاسی برجسته و شعارهای سیاسی پرهیز شود.","در تصویر هیچ پرچم یا پوستر تبلیغات سیاسی وجود نداشته باشد","تصویر عاری از نماد سیاسی است"])
  assert.equal(evaluatePlanTextSafety(t).decision,"allow",t);
 for(const t of ["no political banners, a portrait of Khamenei","a political rally poster","پوستر سیاسی برای انتخابات","protest crowd with no police","bikini model on the beach","تصویر عریان","election campaign poster without logos","تجمع سیاسی بزرگ در میدان","یک چهره سیاسی معروف را نشان بده؛ پس‌زمینه شلوغ نباشد","خامنه ای در تصویر باشد و شعار سیاسی نباشد"])
  assert.notEqual(evaluatePlanTextSafety(t).decision,"allow",t);
 // User input keeps the strict check: the exemption is for planner output only.
 assert.equal(evaluateTextSafety("no political banners").decision,"block");
});

test("historical figures (owner decision 2026-11-06): a pre-1900 ruler in a historical scene is allowed; Iranian modern figures and political use stay blocked (foreign figures are allowed since the owner's rules of the same day)",()=>{
 for(const t of ["یه ویدیو ۳ ثانیه ای می خوام از لحظه ورود کوروش کبیر به بابل","Cyrus the Great entering Babylon, Achaemenid era","پرتره داریوش بزرگ در تخت جمشید","فردوسی در حال نوشتن شاهنامه"])
  assert.notEqual(evaluateTextSafety(t).decision,"block",t);
 for(const t of ["کوروش کبیر با شعار سیاسی","Cyrus the Great at a political protest","پوستر انتخابات با کوروش","محمدرضا شاه در کاخ"])
  assert.equal(evaluateTextSafety(t).decision,"block",t);
});
