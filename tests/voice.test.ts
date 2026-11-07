import test from "node:test";
import assert from "node:assert/strict";
import {buildTranscribeRequest,providerAudioMime,transcribeVoice,transcriptText,voiceGate,VoiceError,VOICE_ERROR_FA,VOICE_MAX_BYTES} from "../lib/voice";
import {VOICE_VOCABULARY} from "../lib/voice-vocabulary";
import {equalizerBars,micErrorFa,pickRecorderType,voiceTimerFa} from "../lib/voice-client";
import {GET,POST} from "../app/api/voice/route";

const VENDORS=/higgsfield|anthropic|claude|openai|gpt|gemini|google|bytedance|byteplus|fal\.ai/i;
function withEnv(env:Record<string,string|undefined>,fn:()=>Promise<void>|void){
 const saved:Record<string,string|undefined>={};
 for(const k of Object.keys(env)){saved[k]=process.env[k];if(env[k]===undefined)delete process.env[k];else process.env[k]=env[k];}
 const restore=()=>{for(const k of Object.keys(saved)){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}};
 try{const r=fn();if(r instanceof Promise)return r.finally(restore);restore();}catch(e){restore();throw e;}
}
const DEV={GEMINI_API_KEY:"test-key",WHOUSH_DEV_LIVE_TEST:"true",NODE_ENV:"development",VOICE_TRANSCRIPTION_AUTHORIZED:undefined};
const reply=(text:string)=>({status:"completed",steps:[{type:"user_input"},{type:"model_output",content:[{type:"text",text}]}]});

test("voice: the request is Persian first, smart mode, with the jargon vocabulary, and never stored",()=>{
 const r=buildTranscribeRequest("QUJD","audio/webm") as {model:string;input:{type:string;mime_type:string;data:string}[];store:boolean;generation_config:{transcription_config:{language_codes:string[];mode:string;custom_vocabulary:string[]}}};
 assert.equal(r.model,"gemini-3.5-transcribe");assert.equal(r.store,false);
 assert.deepEqual(r.input,[{type:"audio",mime_type:"audio/webm",data:"QUJD"}]);
 const c=r.generation_config.transcription_config;
 assert.equal(c.language_codes[0],"fa-IR");assert.equal(c.mode,"smart");assert.deepEqual(c.custom_vocabulary,[...VOICE_VOCABULARY]);
});

test("voice vocabulary: at most 100 terms, every model family a customer may name, Persian loanword spellings, no provider or LLM vendor",()=>{
 assert.ok(VOICE_VOCABULARY.length<=100,"provider advice: 100 terms or fewer, got "+VOICE_VOCABULARY.length);
 assert.equal(new Set(VOICE_VOCABULARY).size,VOICE_VOCABULARY.length);
 for(const t of ["Nano Banana","نانو بنانا","Seedream","سیدریم","Seedance","Kling","کلینگ","prompt","پرامپت","close-up","کلوزآپ","bokeh","golden hour","Reels"])assert.ok(VOICE_VOCABULARY.includes(t),t);
 for(const t of VOICE_VOCABULARY)assert.ok(!VENDORS.test(t),"no vendor names: "+t);
});

test("voice: the transcript is read from model_output text blocks; an unfinished reply is an error",()=>{
 assert.equal(transcriptText(reply("  یک عکس از   استکان چای  ")),"یک عکس از استکان چای");
 assert.equal(transcriptText({status:"completed",steps:[]}),"");
 assert.throws(()=>transcriptText({status:"incomplete"}),VoiceError);
});

test("voice: browser recording types map to the provider's documented audio types; anything else is refused",()=>{
 assert.equal(providerAudioMime("audio/webm;codecs=opus"),"audio/webm");
 assert.equal(providerAudioMime("audio/ogg; codecs=opus"),"audio/ogg");
 assert.equal(providerAudioMime("audio/mp4"),"audio/m4a");
 assert.equal(providerAudioMime("video/webm"),undefined);assert.equal(providerAudioMime(""),undefined);
});

test("voice gate: off without a key; owner dev testing needs only the key; otherwise the owner's authorization is required",()=>{
 withEnv({...DEV,GEMINI_API_KEY:undefined},()=>assert.equal(voiceGate().live,false));
 withEnv(DEV,()=>assert.equal(voiceGate().live,true));
 withEnv({...DEV,WHOUSH_DEV_LIVE_TEST:"false"},()=>assert.deepEqual(voiceGate(),{live:false,reason:"not_authorized"}));
 withEnv({...DEV,WHOUSH_DEV_LIVE_TEST:"false",VOICE_TRANSCRIPTION_AUTHORIZED:"true"},()=>assert.equal(voiceGate().live,true));
});

test("voice: user-facing messages are Persian and never name a provider or model",()=>{
 for(const m of Object.values(VOICE_ERROR_FA)){assert.match(m,/[؀-ۿ]/);assert.ok(!VENDORS.test(m),m);}
});

test("voice: transcription sends the audio once with the key in a header, and fails closed on provider errors",async()=>{
 const real=globalThis.fetch,calls:{url:string;init:RequestInit}[]=[];
 try{
  await withEnv(DEV,async()=>{
   globalThis.fetch=(async(url:string,init:RequestInit)=>{calls.push({url,init});return new Response(JSON.stringify(reply("سلام هووش")),{status:200});}) as typeof fetch;
   assert.equal(await transcribeVoice(new Uint8Array(1000),"audio/webm;codecs=opus"),"سلام هووش");
   assert.equal(calls.length,1);assert.ok(!calls[0].url.includes("key="),"never a key in the URL");
   assert.equal((calls[0].init.headers as Record<string,string>)["x-goog-api-key"],"test-key");
   globalThis.fetch=(async()=>new Response(JSON.stringify({error:{code:"too_many_requests"}}),{status:429})) as typeof fetch;
   await assert.rejects(transcribeVoice(new Uint8Array(1000),"audio/webm"),(e:unknown)=>e instanceof VoiceError&&e.code==="busy");
   await assert.rejects(transcribeVoice(new Uint8Array(10),"audio/webm"),(e:unknown)=>e instanceof VoiceError&&e.code==="bad_audio");
   await assert.rejects(transcribeVoice(new Uint8Array(VOICE_MAX_BYTES+1),"audio/webm"),(e:unknown)=>e instanceof VoiceError&&e.code==="too_long");
   await assert.rejects(transcribeVoice(new Uint8Array(1000),"text/plain"),(e:unknown)=>e instanceof VoiceError&&e.code==="bad_audio");
  });
 }finally{globalThis.fetch=real;}
});

test("voice route: says whether voice is on; returns only the text, or a Persian message without internals",async()=>{
 const real=globalThis.fetch;
 try{
  await withEnv({...DEV,GEMINI_API_KEY:undefined},async()=>{
   assert.deepEqual(await GET().json(),{enabled:false,maxSeconds:60});
   const off=await POST(new Request("http://x/api/voice",{method:"POST",body:new FormData()}));assert.equal(off.status,404);
  });
  await withEnv(DEV,async()=>{
   globalThis.fetch=(async()=>new Response(JSON.stringify(reply("یک ویدیو با کلینگ بساز")),{status:200})) as typeof fetch;
   const form=new FormData();form.append("audio",new Blob([new Uint8Array(2000)],{type:"audio/webm"}),"voice");
   const ok=await POST(new Request("http://x/api/voice",{method:"POST",body:form}));
   assert.equal(ok.status,200);assert.deepEqual(await ok.json(),{text:"یک ویدیو با کلینگ بساز"});
   const none=await POST(new Request("http://x/api/voice",{method:"POST",body:new FormData()}));
   const b=await none.json() as {error:string;message:string};assert.equal(none.status,400);assert.equal(b.error,"bad_audio");assert.ok(!VENDORS.test(JSON.stringify(b)));
   globalThis.fetch=(async()=>new Response(JSON.stringify(reply("   ")),{status:200})) as typeof fetch;
   const form2=new FormData();form2.append("audio",new Blob([new Uint8Array(2000)],{type:"audio/webm"}),"voice");
   assert.equal((await POST(new Request("http://x/api/voice",{method:"POST",body:form2}))).status,422,"silence is not sent as an empty message");
  });
 }finally{globalThis.fetch=real;}
});

test("voice mode helpers: recorder type preference, Persian timer, mic errors, a symmetric easing equalizer",()=>{
 assert.equal(pickRecorderType(t=>t==="audio/mp4"),"audio/mp4");
 assert.equal(pickRecorderType(()=>true),"audio/webm;codecs=opus");
 assert.equal(pickRecorderType(()=>{throw new Error("x");}),undefined);
 assert.equal(voiceTimerFa(7_400),"۰:۰۷");assert.equal(voiceTimerFa(65_000),"۱:۰۵");
 assert.match(micErrorFa("NotAllowedError"),/اجازه/);assert.match(micErrorFa(undefined),/میکروفون/);
 const loud=new Uint8Array(128).fill(255),bars=equalizerBars(loud,8,[]);
 assert.equal(bars.length,8);assert.ok(bars.every(v=>v>0&&v<=1));
 assert.deepEqual(bars.slice(0,4),bars.slice(4).reverse(),"mirrored ring");
 const next=equalizerBars(loud,8,bars);assert.ok(next[0]>bars[0]&&next[0]<=1,"eases towards the level");
});
