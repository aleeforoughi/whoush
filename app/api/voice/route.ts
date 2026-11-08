import {NextResponse} from "next/server";
import {transcribeVoice,voiceGate,VoiceError,VOICE_ERROR_FA,VOICE_MAX_BYTES,VOICE_MAX_SECONDS} from "@/lib/voice";
const headers={"Cache-Control":"no-store"};
/** At most this many recordings are transcribed at once per server process; the rest are told to try again. */
const MAX_IN_FLIGHT=4;
const inFlight=()=>((globalThis as {__whoushVoice?:{n:number}}).__whoushVoice??={n:0});

/** Whether the composer offers voice messages now, and the longest recording it may send. Never says why it is off. */
export function GET(){
 return NextResponse.json({enabled:voiceGate().live,maxSeconds:VOICE_MAX_SECONDS},{headers});
}

/**
 * One voice message (multipart field `audio`) to chat text: `{text}`. The recording is passed through once and kept nowhere; the text is returned to the
 * browser, which sends it as the user's message through the normal chat path (safety prefilter, planner). Errors are `{error,message}` in Persian.
 */
export async function POST(request:Request){
 const fail=(code:VoiceError["code"],status:number)=>NextResponse.json({error:code,message:VOICE_ERROR_FA[code]},{status,headers});
 if(!voiceGate().live)return fail("voice_off",404);
 const length=Number(request.headers.get("content-length")??"0");
 if(length>VOICE_MAX_BYTES+64_000)return fail("too_long",413);
 let audio:File|null=null;
 try{const form=await request.formData(),f=form.get("audio");audio=f instanceof File?f:null;}catch{return fail("bad_audio",400);}
 if(!audio)return fail("bad_audio",400);
 if(audio.size>VOICE_MAX_BYTES)return fail("too_long",413);
 const slots=inFlight();if(slots.n>=MAX_IN_FLIGHT)return fail("busy",429);
 slots.n++;
 try{
  const text=await transcribeVoice(new Uint8Array(await audio.arrayBuffer()),audio.type);
  if(!text)return fail("transcription_incomplete",422);
  return NextResponse.json({text:text.slice(0,4000)},{headers});
 }catch(e){
  if(e instanceof VoiceError)return fail(e.code,e.code==="busy"?429:e.code==="too_long"?413:e.code==="bad_audio"?400:e.code==="voice_off"?404:502);
  return fail("transcription_failed",502);
 }finally{slots.n--;}
}
