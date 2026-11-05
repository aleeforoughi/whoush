import {test} from "node:test";
import assert from "node:assert/strict";
import {faDate,faDateTime,faRelativeTime} from "../lib/format";
import {rerunSource,uniqueById} from "../lib/projects";

const at="2026-11-05T10:00:00.000Z",t=Date.parse(at);
const ago=(s:number)=>faRelativeTime(at,t+s*1000);

test("a message's time reads «همین الان», then minutes, hours and days ago in Persian, then the date",()=>{
 assert.equal(ago(0),"همین الان");assert.equal(ago(44),"همین الان");
 assert.equal(ago(-120),"همین الان","a clock running ahead never shows a future time");
 assert.equal(ago(6*60),"۶ دقیقه پیش");
 assert.equal(ago(59*60),"۵۹ دقیقه پیش");
 assert.equal(ago(2*3600),"۲ ساعت پیش");
 assert.equal(ago(26*3600),"دیروز");
 assert.equal(ago(3*86400),"۳ روز پیش");
 assert.equal(ago(8*86400),faDate(at),"from a week on, the calendar date");
 assert.equal(faRelativeTime("not a date",t),"");
});
test("the hover label is the full Persian date and time",()=>{
 const full=faDateTime(at);
 assert.match(full,/^\S+ [۰-۹]+ \S+ ۱۴۰۵، ساعت [۰-۹]+:[۰-۹]{2}$/,"weekday, day, month, Jalali year, then the time");
 assert.ok(full.includes("آبان"));assert.ok(!/[0-9,]/.test(full),"no Latin digits or comma");
 assert.equal(faDateTime("not a date"),"");
});
test("«اجرای دوباره» sends the user message itself, or the user message an agent message answered",()=>{
 const m=[{id:"a0",role:"agent" as const},{id:"u1",role:"user" as const},{id:"a1",role:"agent" as const},{id:"a2",role:"agent" as const},{id:"u2",role:"user" as const},{id:"a3",role:"agent" as const}];
 assert.equal(rerunSource(m,"u1")?.id,"u1");
 assert.equal(rerunSource(m,"a2")?.id,"u1","the nearest user message before it");
 assert.equal(rerunSource(m,"a3")?.id,"u2");
 assert.equal(rerunSource(m,"a0"),undefined,"nothing to run again before the first user message");
 assert.equal(rerunSource(m,"zz"),undefined);
});
test("a message sent again shares its files with the original; the conversation lists each file once",()=>{
 assert.deepEqual(uniqueById([{id:"f1",n:1},{id:"f2",n:2},{id:"f1",n:3}]),[{id:"f1",n:1},{id:"f2",n:2}]);
});
