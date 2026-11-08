import "server-only";
import {devLiveTest} from "./policy";
import {VOICE_VOCABULARY} from "./voice-vocabulary";

/**
 * Voice messages: the user's recording is turned into chat text by a private speech-to-text model, then sent like a typed message (the same safety
 * prefilter, planner and quote). Evidence: docs/evidence/GOOGLE.md#voice-transcription. The model, provider, cost and audio never reach the browser, and
 * neither the audio nor the transcript is stored or logged by Whoush.
 */
const TRANSCRIBE_URL="https://generativelanguage.googleapis.com/v1beta/interactions";
const TRANSCRIBE_MODEL="gemini-3.5-transcribe";
/** The longest recording the voice mode allows (the browser stops at this length and sends). */
export const VOICE_MAX_SECONDS=60;
/** About 60 s of Opus at the browser's default bitrate, with headroom; well under the provider's 20 MB inline limit. */
export const VOICE_MAX_BYTES=2_000_000;
/**
 * Recording types the browser may send, mapped to the provider's documented audio types. Safari records `audio/mp4` (AAC in an MP4 container); the
 * provider lists that as `audio/m4a`, so it is sent under that name (not yet checked live).
 */
const MIME_MAP:Record<string,string>={"audio/webm":"audio/webm","audio/ogg":"audio/ogg","audio/mp4":"audio/m4a","audio/m4a":"audio/m4a","audio/mpeg":"audio/mpeg","audio/wav":"audio/wav"};
export const providerAudioMime=(browserMime:string):string|undefined=>MIME_MAP[browserMime.split(";")[0].trim().toLowerCase()];


/**
 * The transcription request: Persian first (users speak Persian, often with English model names), verbatim (owner, 2026-11-08: "it needs to be exactly what
 * the user says"; smart mode removed fillers and self-corrections, so the sent text was not what was said), with the jargon vocabulary for spelling.
 */
export function buildTranscribeRequest(base64:string,mime:string):Record<string,unknown>{
 return {model:TRANSCRIBE_MODEL,input:[{type:"audio",mime_type:mime,data:base64}],
  generation_config:{transcription_config:{language_codes:["fa-IR","en-US"],mode:"verbatim",custom_vocabulary:[...VOICE_VOCABULARY]}},store:false};
}

/** The transcript text from the provider's reply (model_output steps, text blocks), trimmed; empty when nothing was said. */
export function transcriptText(body:unknown):string{
 const b=body as {status?:string;steps?:{type?:string;content?:{type?:string;text?:string}[]}[]};
 if(b?.status&&b.status!=="completed")throw new VoiceError("transcription_incomplete");
 const parts:string[]=[];
 for(const step of b?.steps??[])if(step.type==="model_output")for(const c of step.content??[])if(c.type==="text"&&typeof c.text==="string")parts.push(c.text);
 return parts.join(" ").replace(/\s+/g," ").trim();
}

export type VoiceErrorCode="voice_off"|"bad_audio"|"too_long"|"transcription_incomplete"|"transcription_failed"|"busy";
export class VoiceError extends Error{constructor(readonly code:VoiceErrorCode){super(code);this.name="VoiceError";}}
/** What the user reads for each failure, in everyday Persian; never a provider or model name. */
export const VOICE_ERROR_FA:Record<VoiceErrorCode,string>={
 voice_off:"پیام صوتی فعلاً فعال نیست؛ لطفاً تایپ کن.",
 bad_audio:"صدا ضبط نشد یا قالبش پشتیبانی نمی‌شه. دوباره امتحان کن.",
 too_long:"پیام صوتی حداکثر یک دقیقه می‌تونه باشه.",
 transcription_incomplete:"نتونستم صدات رو کامل بفهمم. دوباره بگو.",
 transcription_failed:"تبدیل صدا به متن انجام نشد. دوباره امتحان کن.",
 busy:"الان شلوغه؛ چند لحظه دیگه دوباره امتحان کن."
};

/**
 * Whether voice messages may be transcribed now. Owner dev testing (WHOUSH_DEV_LIVE_TEST under `next dev`) needs only the key; anything else also needs the
 * owner's VOICE_TRANSCRIPTION_AUTHORIZED, which stands for the provider's written terms for end users (regions, 18+; docs/evidence/GOOGLE.md).
 */
export function voiceGate():{live:boolean;reason:string}{
 const e=process.env;
 if(!e.GEMINI_API_KEY)return {live:false,reason:"no_key"};
 if(devLiveTest().enabled)return {live:true,reason:"dev_live_test"};
 if(e.VOICE_TRANSCRIPTION_AUTHORIZED!=="true")return {live:false,reason:"not_authorized"};
 return {live:true,reason:"live"};
}

/** Transcribes one recording. Throws VoiceError; logs only status codes, never audio or text. */
export async function transcribeVoice(bytes:Uint8Array,browserMime:string):Promise<string>{
 if(!voiceGate().live)throw new VoiceError("voice_off");
 const mime=providerAudioMime(browserMime);
 if(!mime||bytes.byteLength<200)throw new VoiceError("bad_audio");
 if(bytes.byteLength>VOICE_MAX_BYTES)throw new VoiceError("too_long");
 let r:Response;
 try{
  r=await fetch(TRANSCRIBE_URL,{method:"POST",headers:{"x-goog-api-key":process.env.GEMINI_API_KEY!,"Content-Type":"application/json"},
   body:JSON.stringify(buildTranscribeRequest(Buffer.from(bytes).toString("base64"),mime)),cache:"no-store",signal:AbortSignal.timeout(45_000)});
 }catch{throw new VoiceError("transcription_failed");}
 const json=await r.json().catch(()=>undefined) as {error?:{code?:string;message?:string}}|undefined;
 if(!r.ok){
  console.warn("[whoush] voice transcription error",r.status,json?.error?.code??"",(json?.error?.message??"").slice(0,300));
  throw new VoiceError(r.status===429?"busy":r.status===400?"bad_audio":"transcription_failed");
 }
 return transcriptText(json);
}

/** A generated soundtrack is at most this large once extracted (a 30 s mono MP3 is ~200 KB); far under the provider's 20 MB inline limit. */
export const SOUNDTRACK_MAX_BYTES=8_000_000;
/**
 * Transcribes a generated video's soundtrack for the audio check (lib/audio-check.ts): verbatim (the provider's default mode, every word kept, which is what
 * a moderation check needs) and with the language detected by the model (a video model may speak any language). The same gate as voice messages.
 * Throws on any failure (the caller then removes the sound); logs only status codes, never audio or text.
 */
export async function transcribeMedia(bytes:Uint8Array,mime:"audio/mpeg"):Promise<string>{
 if(!voiceGate().live)throw new VoiceError("voice_off");
 if(bytes.byteLength>SOUNDTRACK_MAX_BYTES)throw new VoiceError("too_long");
 const r=await fetch(TRANSCRIBE_URL,{method:"POST",headers:{"x-goog-api-key":process.env.GEMINI_API_KEY!,"Content-Type":"application/json"},
  body:JSON.stringify({model:TRANSCRIBE_MODEL,input:[{type:"audio",mime_type:mime,data:Buffer.from(bytes).toString("base64")}],
   generation_config:{transcription_config:{mode:"verbatim"}},store:false}),cache:"no-store",signal:AbortSignal.timeout(60_000)});
 const json=await r.json().catch(()=>undefined) as {error?:{code?:string}}|undefined;
 if(!r.ok){console.warn("[whoush] soundtrack transcription error",r.status,json?.error?.code??"");throw new VoiceError("transcription_failed");}
 return transcriptText(json);
}
