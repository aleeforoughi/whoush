import {test} from "node:test";
import assert from "node:assert/strict";
import {asStartFrame,continuedGeneration,continuesWork,namedWorkKind,type EarlierWork} from "../lib/follow-up";

// Newest first: a finished video (#تولید-۲) after a finished photo (#تولید-۱).
const works:EarlierWork[]=[{tag:"generation2",kind:"video",done:true},{tag:"generation1",kind:"image",done:true}];

test("owner (2026-11-07): a follow-up about the latest work keeps it, in everyday Persian and English",()=>{
 for(const t of ["روشن‌ترش کن","آسمونشو آبی‌تر کن","کفشش رو قرمز کن","پس‌زمینه رو عوض کن","make it brighter","همین عکس رو سیاه سفید کن","ویدیو رو کوتاه‌تر کن","یه ویدیو از همین عکس بساز"])
  assert.equal(continuesWork(t),true,t);
});
test("a brand-new request starts clean",()=>{
 for(const t of ["یه عکس از دریا بساز","یه گربه بساز","یه عکس جدید از کوه","یه ویدیو از جنگل","start over with a forest"])assert.equal(continuesWork(t),false,t);
});
test("the generation a follow-up continues: the kind it names, else the latest finished work",()=>{
 assert.equal(continuedGeneration("همین عکس رو سیاه سفید کن",works),"generation1","names a photo: the latest photo");
 assert.equal(continuedGeneration("ویدیو رو کوتاه‌تر کن",works),"generation2","names a video: the latest video");
 assert.equal(continuedGeneration("روشن‌ترش کن",works),"generation2","names nothing: the latest work");
 assert.equal(continuedGeneration("یه عکس از دریا بساز",works),undefined,"a new request links nothing");
 assert.equal(continuedGeneration("روشن‌ترش کن",[{tag:"generation3",kind:"image",done:false},...works]),undefined,"a newer plan not made yet is continued as a plan, not an older generation");
 assert.equal(continuedGeneration("روشن‌ترش کن",[]),undefined);
});
test("«a video of this photo» uses the photo as the first frame; a change keeps it a photo to edit",()=>{
 assert.equal(namedWorkKind("یه ویدیو از همین عکس بساز"),"image");
 assert.equal(asStartFrame("یه ویدیو از همین عکس بساز"),true);
 assert.equal(asStartFrame("همین عکس رو متحرک کن"),true);
 assert.equal(asStartFrame("کفشش رو قرمز کن"),false);
});
