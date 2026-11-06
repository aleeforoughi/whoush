import {test} from "node:test";
import assert from "node:assert/strict";
import {evaluateTextSafety} from "../lib/safety";
import {SAFE_ALTERNATIVES} from "../lib/safe-alternatives";

const decide=(t:string)=>{const r=evaluateTextSafety(t);return r.decision==="allow"?"allow":r.category;};

test("owner's rules (2026-11-06): Iranian politics and what is sensitive for the government are refused, in Persian, English and Finglish",()=>{
 for(const t of ["یه عکس از خامنه ای","پوستر زن زندگی آزادی","تصویر حقوق بشر در ایران","صحنهٔ اعدام","تجمع اعتراضی در تهران","یه عکس از گشت ارشاد","آیت الله در حال سخنرانی",
  "woman life freedom poster","human rights in iran","free iran","mahsa amini","zan zendegi azadi","sepah"])
  assert.ok(["iran_politics","politics"].includes(decide(t)),t+" → "+decide(t));
 for(const t of ["پرچم شیر و خورشید","یه عکس از رضا پهلوی","تاج پهلوی","لباس پهلوی","lion and sun flag","shir o khorshid"])assert.equal(decide(t),"iran_royal",t);
 for(const t of ["یه مرد با یه لیوان شراب","ویسکی روی میز","a glass of red wine","sharab"])assert.equal(decide(t),"alcohol",t);
 for(const t of ["حشیش کشیدن","مواد مخدر روی میز","cocaine on a table","teryak"])assert.equal(decide(t),"drugs",t);
 for(const t of ["صحنه پر از خون","قتل عام","a bloody murder scene","khoon"])assert.equal(decide(t),"graphic_violence",t);
 for(const t of ["یه عکس لخت","porn","سکس"])assert.equal(decide(t),"sexualized_content",t);
});

test("owner's rules: Iran's official flag, culture, history, palaces, cities and food, everyday summer clothes and foreign figures are allowed; common words are not caught",()=>{
 for(const t of ["پرچم ایران روی برج میلاد","یه عکس از برج آزادی موقع غروب","میدان آزادی در شب","یه عکس از کاخ گلستان","کاخ سعدآباد در پاییز","تخت جمشید و کوروش کبیر",
  "خط پهلوی روی سنگ‌نوشته","سفره یلدا با انار","قورمه سبزی و برنج","بازار تبریز","یه زن با تیشرت و شلوارک تابستونی کنار دریا","یه دختر با پیراهن تابستونی در پارک",
  "یه عکس از ترامپ تو ساحل","رژیم غذایی سالم","رهبری تیم فوتبال","پرتقال خونی روی میز","یه لباس کوکتل شیک","ادامه بده","a well executed logo"])
  assert.equal(decide(t),"allow",t);
});

test("Whoush is the user's advocate: every refusal is kind and comes with safe ideas that pass the same check; alcohol gets the user's own scene with tea",()=>{
 for(const [topic,a] of Object.entries(SAFE_ALTERNATIVES)){
  assert.ok(/[؀-ۿ]/.test(a.messageFa),topic);
  for(const c of a.choices)assert.equal(evaluateTextSafety(c.replyFa).decision,"allow",topic+": "+c.replyFa);
 }
 const r=evaluateTextSafety("یه مرد با یه لیوان شراب توی کافه");
 assert.deepEqual(r.choices?.map(c=>c.replyFa),["یه مرد با یه لیوان چای توی کافه","یه مرد با یه لیوان قهوه توی کافه","یه مرد با یه لیوان شربت آلبالو توی کافه"]);
 const fin=evaluateTextSafety("Ye aks az sharab");assert.ok(fin.choices?.length&&fin.choices.every(c=>evaluateTextSafety(c.replyFa).decision==="allow"),"Finglish: the standard safe ideas");
 assert.ok(evaluateTextSafety("پوستر زن زندگی آزادی").choices?.every(c=>!/آزادی|سیاس|اعتراض/.test(c.replyFa)),"the ideas leave the subject out entirely");
});

test("beauty influencers, models and bloggers (owner, 2026-11-06): everyday beauty and fashion requests are never caught, in the brief or in the planner's own text",()=>{
 for(const t of ["یه عکس پرتره با رژ لب قرمز و آرایش ملایم","nude lipstick and soft glam makeup","nude nails with a gold ring","wine red lips, editorial beauty shot","a champagne gold evening gown on a runway",
  "blood red nails close-up","عکس فشن با لباس مجلسی بلند","یه عکس تبلیغاتی برای کرم مرطوب‌کننده","عکس بیوتی کلوزآپ از چشم با ریمل و خط چشم","مدل با پیراهن تابستونی توی کافه",
  "یه ویدیو از روتین مراقبت پوست صبحگاهی","outfit of the day photo for instagram","یه عکس از موهای فر با نور طلایی","hijab fashion editorial in a garden","یه عکس از یه بلاگر با کیف و عینک آفتابی",
  "Soft natural light, nude-tone makeup, wine-red lip, champagne satin dress, no political banners"])
  assert.equal(decide(t.replace("no political banners","")),"allow",t);
 assert.equal(decide("a glass of red wine on the table"),"alcohol","a drink is still a drink");
 assert.equal(decide("nude photo"),"sexualized_content","nudity is still nudity");
});
