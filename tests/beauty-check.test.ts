import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
process.env.WHOUSH_MEDIA_DIR=mkdtempSync(join(tmpdir(),"whoush-beauty-check-"));
import {storeMedia} from "../lib/media-store";
import {beautyVerdictFor,rememberBeautifyTurn,rememberFixedTurn,reviewFor} from "../lib/beauty-check";

const JPEG=(n:number)=>new Uint8Array([0xff,0xd8,0xff,0xe0,n,n,n,n]);
const share=(o:Partial<{shareReady:boolean;beautiful:boolean;samePerson:boolean;moodKept:boolean;verdictFa:string;fixFa:string;fixEn:string}>)=>async()=>({shareReady:true,beautiful:true,samePerson:true,moodKept:true,verdictFa:"خیلی تمیز و طبیعی شده.",fixFa:"",fixEn:"",...o});

test("«زیباسازی» self-check: judged against the goal; when not ready, Whoush says in its own words what it would fix, with instructions kept on the server",async()=>{
 const src=await storeMedia(JPEG(1),"image/jpeg"),out=await storeMedia(JPEG(2),"image/jpeg");
 rememberBeautifyTurn("turn-a",src.id);
 let seen:string[]=[];
 const ready=await beautyVerdictFor("turn-a",[{kind:"image",url:out.url}],{check:async(s,o)=>{seen=[String(s.bytes[4]),String(o.bytes[4])];return share({verdictFa:"آماده‌ی پسته."})();}});
 assert.deepEqual(seen,["1","2"],"the original, then the result");
 assert.deepEqual(ready,{verdict:{shareReady:true,samePerson:true,verdictFa:"آماده‌ی پسته."}},"ready: no fix to offer");
 const not=await beautyVerdictFor("turn-a",[{kind:"image",url:out.url}],{check:share({samePerson:false,verdictFa:"قشنگه ولی شبیه خودت نیست.",fixFa:"باید پوست رو طبیعی نگه دارم، ابرو رو برگردونم.",fixEn:"Keep the skin texture natural; restore the original eyebrow shape."})});
 assert.equal(not?.verdict.shareReady,false,"not the same person: not share-ready");
 assert.deepEqual(not?.review,{sayFa:"باید پوست رو طبیعی نگه دارم، ابرو رو برگردونم.",fixEn:"Keep the skin texture natural; restore the original eyebrow shape."});
 const brand=await beautyVerdictFor("turn-a",[{kind:"image",url:out.url}],{check:share({verdictFa:"برای Instagram عالیه و کاملاً خودتی."})});
 assert.equal(brand?.verdict.verdictFa,"برای Instagram عالیه و کاملاً خودتی.","a brand word in a Persian sentence is fine");
 const latin=await beautyVerdictFor("turn-a",[{kind:"image",url:out.url}],{check:share({shareReady:false,verdictFa:"not good",fixFa:"fix the light",fixEn:"Fix the light."})});
 assert.ok(latin&&!latin.review&&/[؀-ۿ]/.test(latin.verdict.verdictFa),"only Persian words reach the card; no fix without them");
 assert.equal(await beautyVerdictFor("another-turn",[{kind:"image",url:out.url}],{check:async()=>{throw new Error("not called");}}),undefined,"not a «زیباسازی» turn");
 assert.equal(await beautyVerdictFor("turn-a",[{kind:"image",url:out.url}],{check:async()=>{throw new Error("down");}}),undefined,"a check that cannot run says nothing");
});

test("quality assessor: any picture with a clear problem gets Whoush's own words and fixes; a good one, a «زیباسازی» result or a fixed result gets none",async()=>{
 const out=await storeMedia(JPEG(5),"image/jpeg"),src=await storeMedia(JPEG(6),"image/jpeg");
 const bad=async()=>({good:false,person:false,issues:[{part:"light" as const,noteFa:"نور تنده",noteEn:"harsh light"}],sayFa:"باید نور رو نرم‌تر کنم و پس‌زمینه رو مرتب کنم.",fixEn:"Soften the light and tidy the background."});
 assert.deepEqual(await reviewFor("gen-1",[{kind:"image",url:out.url}],{assess:bad}),{sayFa:"باید نور رو نرم‌تر کنم و پس‌زمینه رو مرتب کنم.",fixEn:"Soften the light and tidy the background."},"any picture, a person or not");
 assert.equal(await reviewFor("gen-2",[{kind:"image",url:out.url}],{assess:async()=>({good:true,person:true,issues:[],sayFa:"",fixEn:""})}),undefined,"a good picture: nothing");
 rememberBeautifyTurn("beautify-turn",src.id);
 assert.equal(await reviewFor("beautify-turn",[{kind:"image",url:out.url}],{assess:bad}),undefined,"a «زیباسازی» result has its own self-check");
 rememberFixedTurn("fixed-turn");
 assert.equal(await reviewFor("fixed-turn",[{kind:"image",url:out.url}],{assess:bad}),undefined,"a fixed result is never offered another fix (no loops)");
 assert.equal(await reviewFor("gen-4",[{kind:"image",url:out.url}],{assess:async()=>{throw new Error("down");}}),undefined,"an assessor that cannot run says nothing");
});
