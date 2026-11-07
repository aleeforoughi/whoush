import {test} from "node:test";
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {mkdtempSync,readFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {AUDIO_REMOVED_FA,checkVideoAudio,hasFfmpeg,stripSoundtrack,type AudioCheckDeps} from "../lib/audio-check";
import {buildSeedanceRequest} from "../lib/providers/byteplus";
import {buildHiggsfieldPayload} from "../lib/media-provider";
import {findMediaModel} from "../lib/catalog";

const VIDEO=new Uint8Array([1,2,3]),SILENT=new Uint8Array([9]);
const stubs=(o:Partial<AudioCheckDeps>):AudioCheckDeps=>({extract:async()=>new Uint8Array([7]),strip:async()=>SILENT,transcribe:async()=>"",review:async()=>"none",...o});

test("owner (2026-11-08): a video with no soundtrack, or with music and no words, keeps what it has",async()=>{
 assert.deepEqual(await checkVideoAudio(VIDEO,stubs({extract:async()=>null})),{verdict:{audio:"none"},bytes:VIDEO});
 assert.deepEqual(await checkVideoAudio(VIDEO,stubs({transcribe:async()=>"  "})),{verdict:{audio:"checked"},bytes:VIDEO});
});
test("words that pass the lexical and the semantic check keep the sound",async()=>{
 assert.deepEqual(await checkVideoAudio(VIDEO,stubs({transcribe:async()=>"سلام، به کافه‌ی ما خوش اومدین"})),{verdict:{audio:"checked"},bytes:VIDEO});
});
test("words that fail either check remove the sound: the silent copy is kept, with the general reason",async()=>{
 const sem=await checkVideoAudio(VIDEO,stubs({transcribe:async()=>"some words",review:async()=>"politics"}));
 assert.deepEqual(sem,{verdict:{audio:"removed",reason:"politics"},bytes:SILENT});
 let reviewed=false;
 const lex=await checkVideoAudio(VIDEO,stubs({transcribe:async()=>"بیا با هم شراب بخوریم",review:async()=>{reviewed=true;return "none";}}));
 assert.equal(lex.verdict.audio,"removed");assert.equal(reviewed,false,"a lexical block needs no review");assert.equal(lex.bytes,SILENT);
 assert.match(AUDIO_REMOVED_FA.politics,/سیاسی/);
});
test("fail closed: a soundtrack that cannot be checked is removed; one that cannot be removed fails (never shown)",async()=>{
 for(const o of [{extract:async()=>{throw new Error("x");}},{transcribe:async()=>{throw new Error("x");}},{transcribe:async()=>"words",review:async()=>{throw new Error("x");}}] as Partial<AudioCheckDeps>[])
  assert.deepEqual(await checkVideoAudio(VIDEO,stubs(o)),{verdict:{audio:"removed",reason:"unchecked"},bytes:SILENT});
 await assert.rejects(checkVideoAudio(VIDEO,stubs({transcribe:async()=>"words",review:async()=>"sexual",strip:async()=>{throw new Error("x");}})));
});
test("sound is asked only when it will be checked, and only from models with sound at their approved price",()=>{
 const s20=findMediaModel("seedance-2-0-720p-5s")!,s25=findMediaModel("seedance-2-5-5s")!;
 assert.equal(buildSeedanceRequest(s20,"p",{}).generate_audio,false,"silent unless the check can run");
 assert.equal(buildSeedanceRequest(s20,"p",{},true).generate_audio,true);
 assert.equal(buildHiggsfieldPayload(s25,"p",{}).generate_audio,false);
 assert.equal(buildHiggsfieldPayload(s25,"p",{},true).generate_audio,true);
 assert.equal(findMediaModel("kling-3-0-720p-5s")!.capabilities.audio,false,"Kling's native audio costs more than its approved price");
});
test("real ffmpeg: a clip with a tone is found to have sound, and the stripped copy has none",async t=>{
 if(!(await hasFfmpeg())){t.skip("ffmpeg not installed");return;}
 const dir=mkdtempSync(join(tmpdir(),"whoush-audio-test-"));
 try{
  const clip=join(dir,"c.mp4");
  execFileSync("ffmpeg",["-hide_banner","-loglevel","error","-f","lavfi","-i","color=c=blue:s=64x64:d=1","-f","lavfi","-i","sine=frequency=440:duration=1","-shortest","-c:v","libx264","-c:a","aac",clip]);
  const bytes=new Uint8Array(readFileSync(clip));
  let heard=0;
  const r=await checkVideoAudio(bytes,{transcribe:async mp3=>{heard=mp3.byteLength;return "";},review:async()=>"none"});
  assert.ok(heard>0,"the soundtrack was extracted");assert.deepEqual(r.verdict,{audio:"checked"});
  const silent=await stripSoundtrack(bytes);
  const none=await checkVideoAudio(silent,{transcribe:async()=>{throw new Error("no sound expected");}});
  assert.deepEqual(none.verdict,{audio:"none"});
 }finally{rmSync(dir,{recursive:true,force:true});}
});
