import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
process.env.WHOUSH_MEDIA_DIR=mkdtempSync(join(tmpdir(),"whoush-beauty-check-"));
import {storeMedia} from "../lib/media-store";
import {beautyVerdictFor,rememberBeautifyTurn} from "../lib/beauty-check";

const JPEG=(n:number)=>new Uint8Array([0xff,0xd8,0xff,0xe0,n,n,n,n]);

test("«زیباسازی» self-check: the result is judged against the goal (share-ready, beautiful, still them, same mood); a no says the one fix",async()=>{
 const src=await storeMedia(JPEG(1),"image/jpeg"),out=await storeMedia(JPEG(2),"image/jpeg");
 rememberBeautifyTurn("turn-a",src.id);
 let seen:string[]=[];
 const ready=await beautyVerdictFor("turn-a",[{kind:"image",url:out.url}],{check:async(s,o)=>{seen=[String(s.bytes[4]),String(o.bytes[4])];
  return {shareReady:true,beautiful:true,samePerson:true,moodKept:true,verdictFa:"خیلی تمیز و طبیعی شده؛ آماده‌ی پسته.",fixFa:""};}});
 assert.deepEqual(seen,["1","2"],"the original, then the result");
 assert.deepEqual(ready,{shareReady:true,samePerson:true,verdictFa:"خیلی تمیز و طبیعی شده؛ آماده‌ی پسته."});
 const not=await beautyVerdictFor("turn-a",[{kind:"image",url:out.url}],{check:async()=>({shareReady:true,beautiful:true,samePerson:false,moodKept:true,verdictFa:"قشنگه ولی شبیه خودت نیست.",fixFa:"فرم صورت رو کمتر تغییر بده"})});
 assert.equal(not?.shareReady,false,"not the same person: not share-ready, whatever else");assert.equal(not?.fixFa,"فرم صورت رو کمتر تغییر بده");
 const latin=await beautyVerdictFor("turn-a",[{kind:"image",url:out.url}],{check:async()=>({shareReady:false,beautiful:false,samePerson:true,moodKept:true,verdictFa:"not good",fixFa:"fix the light"})});
 assert.ok(latin&&!latin.fixFa&&/[؀-ۿ]/.test(latin.verdictFa),"only Persian text reaches the card");
 const brand=await beautyVerdictFor("turn-a",[{kind:"image",url:out.url}],{check:async()=>({shareReady:true,beautiful:true,samePerson:true,moodKept:true,verdictFa:"برای Instagram عالیه و کاملاً خودتی.",fixFa:""})});
 assert.equal(brand?.verdictFa,"برای Instagram عالیه و کاملاً خودتی.","a brand word in a Persian sentence is fine");
 assert.equal(await beautyVerdictFor("another-turn",[{kind:"image",url:out.url}],{check:async()=>{throw new Error("not called");}}),undefined,"not a «زیباسازی» turn");
 assert.equal(await beautyVerdictFor("turn-a",[{kind:"image",url:out.url}],{check:async()=>{throw new Error("down");}}),undefined,"a check that cannot run says nothing");
});

test("quality assessor: a clear problem on a picture of a person offers «زیباسازی» with only the parts it names; otherwise nothing, and never on a «زیباسازی» result",async()=>{
 const {enhanceOfferFor}=await import("../lib/beauty-check");
 const out=await storeMedia(JPEG(5),"image/jpeg"),src=await storeMedia(JPEG(6),"image/jpeg");
 const bad=async()=>({good:false,person:true,issues:[{part:"light" as const,noteFa:"نور صورت تنده",noteEn:"harsh light on the face"},{part:"light" as const,noteFa:"سایه زیاده",noteEn:"heavy shadows"}]});
 assert.deepEqual(await enhanceOfferFor("gen-1",[{kind:"image",url:out.url}],{assess:bad}),{parts:["light"],notes:{light:"نور صورت تنده"}},"only the light");
 assert.equal(await enhanceOfferFor("gen-2",[{kind:"image",url:out.url}],{assess:async()=>({good:true,person:true,issues:[]})}),undefined,"a good picture: nothing");
 assert.equal(await enhanceOfferFor("gen-3",[{kind:"image",url:out.url}],{assess:async()=>({good:false,person:false,issues:[{part:"color" as const,noteFa:"رنگش کدره",noteEn:"dull colour"}]})}),undefined,"no person: no «زیباسازی» card");
 rememberBeautifyTurn("beautify-turn",src.id);
 assert.equal(await enhanceOfferFor("beautify-turn",[{kind:"image",url:out.url}],{assess:bad}),undefined,"never on a «زیباسازی» result: no fix-the-fix loop");
 assert.equal(await enhanceOfferFor("gen-4",[{kind:"image",url:out.url}],{assess:async()=>{throw new Error("down");}}),undefined,"an assessor that cannot run says nothing");
});
