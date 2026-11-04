import {test} from "node:test";
import assert from "node:assert/strict";
import {SHARE_TARGETS,downloadFileName,extensionFor,fitsTarget,instagramFit,slugTitle,INSTAGRAM_NOT_DIRECT_FA} from "../lib/share";

test("downloadFileName: Persian slug, Persian digits and the extension from the mime",()=>{
 assert.equal(downloadFileName({projectTitle:"یک عکس از دریاچه",tag:"image1",mime:"image/png"}),"whoush-یک-عکس-از-دریاچه-تصویر-۱.png");
 assert.equal(downloadFileName({projectTitle:"ویدیوی شهر",tag:"video12",mime:"video/mp4"}),"whoush-ویدیوی-شهر-ویدیو-۱۲.mp4");
 assert.equal(downloadFileName({tag:"audio3",mime:"audio/x-m4a"}),"whoush-صدا-۳.m4a");
 assert.equal(downloadFileName({projectTitle:"گزارش",tag:"file2",mime:"application/pdf"}),"whoush-گزارش-فایل-۲.pdf");
});
test("downloadFileName: falls back without a usable title",()=>{
 assert.equal(downloadFileName({tag:"image1",mime:"image/jpeg"}),"whoush-تصویر-۱.jpg");
 assert.equal(downloadFileName({projectTitle:"",tag:"image1",mime:"image/jpeg"}),"whoush-تصویر-۱.jpg");
 assert.equal(downloadFileName({projectTitle:"  ///???  ",tag:"image1",mime:"image/jpeg"}),"whoush-تصویر-۱.jpg");
});
test("extensionFor: every supported mime, unknown is bin",()=>{
 const table:Record<string,string>={"image/jpeg":"jpg","image/png":"png","image/webp":"webp","video/mp4":"mp4","video/quicktime":"mov","video/webm":"webm","audio/mpeg":"mp3","audio/wav":"wav","audio/x-wav":"wav","audio/mp4":"m4a","audio/x-m4a":"m4a","audio/ogg":"ogg","audio/webm":"webm","application/pdf":"pdf","application/json":"json","text/markdown":"md","text/x-markdown":"md","text/plain":"md"};
 for(const [m,e] of Object.entries(table))assert.equal(extensionFor(m),e,m);
 assert.equal(extensionFor("IMAGE/PNG; charset=x"),"png");
 assert.equal(extensionFor("application/x-unknown"),"bin");
});
test("slugTitle: unsafe characters removed, capped at 40 characters",()=>{
 assert.equal(slugTitle("a/b\\c:d*e?f\"g<h>i|j"),"abcdefghij");
 assert.equal(slugTitle("../../etc/passwd"),"etcpasswd");
 assert.equal(slugTitle("سلام!  دنیا؟ 😀"),"سلام-دنیا");
 assert.equal(slugTitle("a‮b‏c‎d"),"abcd","bidi controls are dropped");
 assert.equal(slugTitle("می‌خواهم ۱۲۳"),"می‌خواهم-۱۲۳","ZWNJ and Persian digits stay");
 assert.equal(slugTitle("ا".repeat(60)),"ا".repeat(40));
 assert.equal(Array.from(slugTitle("😀".repeat(5)+"ب".repeat(50))).length,40);
 assert.ok(!slugTitle(("الف ".repeat(20)).trim()).endsWith("-"),"no trailing dash after the cap");
 assert.equal(slugTitle("  --  "),"");
});
test("downloadFileName: a very long title stays bounded",()=>{
 const name=downloadFileName({projectTitle:"ب".repeat(500),tag:"image1",mime:"image/png"});
 assert.ok(Array.from(name).length<=7+40+1+8+4,name.length+"");
 assert.ok(!/[\\/:*?"<>|]/.test(name));
});
test("instagramFit: each ratio bucket",()=>{
 assert.deepEqual(instagramFit({kind:"image",width:1080,height:1920}),{formats:["reels","story"],noteFa:"مناسب ریلز و استوری"});
 assert.deepEqual(instagramFit({kind:"image",width:1080,height:1350}),{formats:["feed_portrait"],noteFa:"مناسب پست (عمودی ۴:۵)"});
 assert.deepEqual(instagramFit({kind:"image",width:1080,height:1080}),{formats:["feed_square"],noteFa:"مناسب پست (مربع)"});
 assert.deepEqual(instagramFit({kind:"image",width:1910,height:1000}).formats,["feed_landscape"]);
 assert.deepEqual(instagramFit({kind:"image",width:640,height:480}),{formats:[],noteFa:"اینستاگرام ممکن است تصویر را برش بدهد"});
 assert.deepEqual(instagramFit({kind:"image"}),{formats:[],noteFa:"اینستاگرام ممکن است تصویر را برش بدهد"},"no size, no claim");
});
test("instagramFit: the ±3% tolerance edges",()=>{
 const at=(ratio:number)=>instagramFit({kind:"image",width:Math.round(ratio*100000),height:100000}).formats;
 const r=9/16;
 assert.deepEqual(at(r*1.029),["reels","story"]);assert.deepEqual(at(r*0.971),["reels","story"]);
 assert.deepEqual(at(r*1.04),[]);assert.deepEqual(at(r*0.96),[]);
 assert.deepEqual(at(0.8*1.029),["feed_portrait"]);assert.deepEqual(at(0.8*1.05),[]);
 assert.deepEqual(at(1.029),["feed_square"]);assert.deepEqual(at(0.971),["feed_square"]);assert.deepEqual(at(1.04),[]);
 assert.deepEqual(at(1.91*1.029),["feed_landscape"]);assert.deepEqual(at(1.91*0.96),[]);
});
test("instagramFit: video, and the 90 second Reels note only for longer clips",()=>{
 assert.equal(instagramFit({kind:"video",width:1080,height:1920,durationSeconds:90}).noteFa,"مناسب ریلز و استوری");
 assert.equal(instagramFit({kind:"video",width:1080,height:1920,durationSeconds:12}).noteFa,"مناسب ریلز و استوری");
 assert.equal(instagramFit({kind:"video",width:1080,height:1920,durationSeconds:91}).noteFa,"مناسب ریلز و استوری · ریلز تا ۹۰ ثانیه");
 assert.equal(instagramFit({kind:"video",width:1920,height:1080,durationSeconds:200}).noteFa,"اینستاگرام ممکن است ویدیو را برش بدهد · ریلز تا ۹۰ ثانیه");
 assert.ok(!instagramFit({kind:"image",width:1080,height:1920,durationSeconds:500}).noteFa.includes("ریلز تا"),"images carry no duration note");
});
test("instagramFit: audio and documents cannot be posted directly",()=>{
 for(const kind of ["audio","pdf","json","md"] as const)assert.deepEqual(instagramFit({kind,width:1080,height:1920}),{formats:[],noteFa:INSTAGRAM_NOT_DIRECT_FA});
 assert.equal(INSTAGRAM_NOT_DIRECT_FA,"این نوع فایل را نمی‌توان مستقیم در اینستاگرام منتشر کرد");
});
test("fitsTarget: story and reel need 9:16, a post any feed shape, documents nothing",()=>{
 const fit=(w:number,h:number)=>instagramFit({kind:"image",width:w,height:h});
 assert.deepEqual(["story","post","reel"].map(t=>fitsTarget(fit(1080,1920),t as never)),[true,false,true]);
 assert.deepEqual(["story","post","reel"].map(t=>fitsTarget(fit(1080,1350),t as never)),[false,true,false]);
 assert.deepEqual(["story","post","reel"].map(t=>fitsTarget(fit(1080,1080),t as never)),[false,true,false]);
 assert.deepEqual(["story","post","reel"].map(t=>fitsTarget(fit(1910,1000),t as never)),[false,true,false]);
 assert.deepEqual(["story","post","reel"].map(t=>fitsTarget(fit(640,480),t as never)),[false,false,false]);
 assert.deepEqual(["story","post","reel"].map(t=>fitsTarget(instagramFit({kind:"pdf"}),t as never)),[false,false,false]);
 assert.deepEqual(SHARE_TARGETS.map(t=>t.labelFa),["استوری","پست","ریلز"]);
});
