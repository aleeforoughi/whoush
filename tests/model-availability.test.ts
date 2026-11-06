import {test,afterEach} from "node:test";
import assert from "node:assert/strict";
import {markModelNotOpen,offerable,runnableNow} from "../lib/model-availability";
import {findMediaModel,MEDIA_CATALOG} from "../lib/catalog";
import {recommendMediaModels} from "../lib/router";

const KEYS=["NODE_ENV","WHOUSH_DEV_LIVE_TEST","GEMINI_API_KEY","BYTEPLUS_API_KEY","KLING_API_KEY","HIGGSFIELD_API_KEY","WHOUSH_MODELS_NOT_OPEN"];
const saved=Object.fromEntries(KEYS.map(k=>[k,process.env[k]]));
afterEach(()=>{for(const k of KEYS){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}});
const env=(e:Record<string,string|undefined>)=>{for(const [k,v] of Object.entries(e)){if(v===undefined)delete process.env[k];else process.env[k]=v;}};

test("offers: in demo mode every model; with real generation on, only models that can run now (key, verified path, open on the account)",()=>{
 env({WHOUSH_DEV_LIVE_TEST:undefined,GEMINI_API_KEY:undefined,BYTEPLUS_API_KEY:undefined,KLING_API_KEY:undefined,HIGGSFIELD_API_KEY:undefined});
 assert.equal(offerable(MEDIA_CATALOG).length,MEDIA_CATALOG.length,"demo: unchanged");
 // The owner's setup on 2026-11-06: Google, BytePlus and Higgsfield keys, no Kling key, dev testing on.
 env({NODE_ENV:"development",WHOUSH_DEV_LIVE_TEST:"true",GEMINI_API_KEY:"x",BYTEPLUS_API_KEY:"x",HIGGSFIELD_API_KEY:"x",KLING_API_KEY:undefined,WHOUSH_MODELS_NOT_OPEN:undefined});
 const m=(id:string)=>findMediaModel(id)!;
 assert.ok(runnableNow(m("nano-banana-2-1"))&&runnableNow(m("seedream-5-pro-2k"))&&runnableNow(m("seedance-2-5-5s")));
 assert.ok(!runnableNow(m("seedream-5-lite")),"not open on the account (404 ModelNotOpen)");
 assert.ok(!runnableNow(m("seedance-2-0-mini-720p-5s")),"not open on the account");
 assert.ok(!runnableNow(m("kling-3-0-720p-5s")),"no key");
 assert.ok(!runnableNow(m("kling-4-0-5s")),"no verified API path");
 const video=recommendMediaModels("یه ویدیو از دریا").ranked.map(x=>x.id);
 assert.ok(video.length>0&&video.every(id=>id.startsWith("seedance-2-5")),"video offers only what can run: "+video.join());
 assert.ok(!recommendMediaModels("یه عکس از دریا").ranked.some(x=>x.id==="seedream-5-lite"));
 // Activated later: the owner clears the list; a refusal at runtime takes a model out again.
 env({WHOUSH_MODELS_NOT_OPEN:"none"});assert.ok(runnableNow(m("seedream-5-lite")));
 markModelNotOpen("seedream-5-lite");assert.ok(!runnableNow(m("seedream-5-lite")));
});
