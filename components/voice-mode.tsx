"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {ArrowUp,LoaderCircle,Mic,RotateCcw,X} from "lucide-react";
import {Dialog as DialogPrimitive} from "@base-ui/react/dialog";
import {Button,Dialog,DialogPortal,Icon} from "@aleeforoughi/feather-react";
import {equalizerBars,micErrorFa,pickRecorderType,voiceTimerFa} from "@/lib/voice-client";

export const VOICE_MODE_LABEL_FA="پیام صوتی";
const HINT_FA="حرف بزن؛ برای فرستادن روی دایره بزن.",SENDING_FA="دارم حرفات رو می‌نویسم…",STARTING_FA="در حال روشن کردن میکروفون…";
const BARS=56;
type Phase="starting"|"recording"|"sending"|"error";

/**
 * Full-screen voice mode: a round equalizer around a central button, with a timer. The user talks; a tap on the circle stops and sends the recording, which
 * the server turns into chat text (`/api/voice`); `onTranscript` then sends that text like a typed message. Closing (X, Escape) throws the recording away.
 * Recording stops on its own at `maxSeconds` and is sent. Nothing is uploaded until the user sends; the audio is kept nowhere.
 */
export function VoiceMode({open,maxSeconds,onClose,onTranscript}:{open:boolean;maxSeconds:number;onClose:()=>void;onTranscript:(text:string)=>void}){
 // Each attempt is a fresh recorder: «دوباره» after a failed transcription starts a new recording.
 const [attempt,setAttempt]=useState(0);
 return <Dialog open={open} onOpenChange={o=>{if(!o)onClose();}}>
  <DialogPortal>
   <DialogPrimitive.Popup data-slot="voice-mode" aria-label={VOICE_MODE_LABEL_FA} aria-modal="true"
    className="dark motion-dialog fixed inset-0 z-50 m-0 flex h-dvh w-screen max-w-none flex-col items-center justify-center overflow-hidden border-0 bg-background p-4 text-fg-primary opacity-100 outline-none data-starting-style:opacity-0">
    {open&&<VoiceRecorder key={attempt} maxSeconds={maxSeconds} onClose={onClose} onTranscript={onTranscript} onRetry={()=>setAttempt(n=>n+1)}/>}
   </DialogPrimitive.Popup>
  </DialogPortal>
 </Dialog>;
}

function VoiceRecorder({maxSeconds,onClose,onTranscript,onRetry}:{maxSeconds:number;onClose:()=>void;onTranscript:(text:string)=>void;onRetry:()=>void}){
 const [phase,setPhase]=useState<Phase>("starting"),[error,setError]=useState(""),[elapsed,setElapsed]=useState(0);
 /** After a failed transcription the circle records again; after a microphone problem it closes. */
 const [retryable,setRetryable]=useState(false);
 // The parent's callbacks change on every render of the studio; the recording must not restart when they do, so the effect reads them from a ref.
 const calls=useRef({onClose,onTranscript});
 useEffect(()=>{calls.current={onClose,onTranscript};},[onClose,onTranscript]);
 const canvas=useRef<HTMLCanvasElement>(null),recorder=useRef<MediaRecorder|null>(null),stream=useRef<MediaStream|null>(null),audio=useRef<AudioContext|null>(null);
 const chunks=useRef<Blob[]>([]),started=useRef(0),frame=useRef(0),discard=useRef(false),sending=useRef(false);

 /** Stops the microphone and the drawing; the recorder's onstop decides whether anything is sent. */
 const release=useCallback(()=>{
  cancelAnimationFrame(frame.current);
  stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;
  void audio.current?.close().catch(()=>undefined);audio.current=null;
 },[]);

 const upload=useCallback(async(blob:Blob)=>{
  setPhase("sending");
  try{
   const form=new FormData();form.append("audio",blob,"voice");
   const r=await fetch("/api/voice",{method:"POST",body:form});
   const body=await r.json().catch(()=>({})) as {text?:string;message?:string};
   if(!r.ok||!body.text){setError(body.message??"تبدیل صدا به متن انجام نشد. دوباره امتحان کن.");setRetryable(r.status!==404);setPhase("error");return;}
   calls.current.onTranscript(body.text);calls.current.onClose();
  }catch{setError("اتصال برقرار نشد. دوباره امتحان کن.");setRetryable(true);setPhase("error");}
 },[]);

 /** Stops recording and sends what was said. */
 const send=useCallback(()=>{
  const r=recorder.current;
  if(!r||r.state==="inactive"||sending.current)return;
  sending.current=true;discard.current=false;r.stop();
 },[]);

 useEffect(()=>{
  let alive=true;
  (async()=>{
   if(typeof MediaRecorder==="undefined"||!navigator.mediaDevices?.getUserMedia){setError(micErrorFa("unsupported"));setPhase("error");return;}
   let s:MediaStream;
   try{s=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});}
   catch(e){if(alive){setError(micErrorFa(e instanceof DOMException?e.name:undefined));setPhase("error");}return;}
   if(!alive){s.getTracks().forEach(t=>t.stop());return;}
   stream.current=s;
   const type=pickRecorderType(t=>MediaRecorder.isTypeSupported(t));
   const rec=new MediaRecorder(s,type?{mimeType:type,audioBitsPerSecond:32_000}:{audioBitsPerSecond:32_000});
   recorder.current=rec;chunks.current=[];
   rec.ondataavailable=e=>{if(e.data.size>0)chunks.current.push(e.data);};
   rec.onstop=()=>{
    release();
    const blob=new Blob(chunks.current,{type:rec.mimeType||type||"audio/webm"});chunks.current=[];
    if(!discard.current)void upload(blob);
   };
   rec.start(250);started.current=performance.now();setPhase("recording");
   // The equalizer: the analyser reads the same stream; nothing from it is kept.
   const ctx=new AudioContext();audio.current=ctx;
   const analyser=ctx.createAnalyser();analyser.fftSize=256;analyser.smoothingTimeConstant=0.6;ctx.createMediaStreamSource(s).connect(analyser);
   const freq=new Uint8Array(analyser.frequencyBinCount),calm=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
   let bars:number[]=[];
   const draw=()=>{
    const ms=performance.now()-started.current;setElapsed(ms);
    if(ms>=maxSeconds*1000){send();return;}
    analyser.getByteFrequencyData(freq);bars=equalizerBars(freq,BARS,bars,calm?0.12:0.35);
    paint(canvas.current,bars);
    frame.current=requestAnimationFrame(draw);
   };
   frame.current=requestAnimationFrame(draw);
  })();
  return()=>{
   alive=false;discard.current=!sending.current;
   const r=recorder.current;if(r&&r.state!=="inactive")r.stop();else release();
  };
 },[maxSeconds,release,send,upload]);

 const recording=phase==="recording",left=Math.max(0,maxSeconds*1000-elapsed);
 return <>
  <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="بستن و دور انداختن صدا" className="absolute end-4 top-4"><Icon icon={X} aria-hidden="true"/></Button>
  <div className="relative flex size-[min(80vw,22rem)] items-center justify-center">
   <canvas ref={canvas} aria-hidden="true" className="absolute inset-0 size-full text-primary"/>
   <button type="button" onClick={phase==="error"?(retryable?onRetry:onClose):send} disabled={phase==="starting"||phase==="sending"}
    aria-label={recording?"فرستادن پیام صوتی":phase==="error"?(retryable?"ضبط دوباره":"بستن"):phase==="sending"?SENDING_FA:STARTING_FA}
    className="relative z-10 flex size-[42%] items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg outline-none transition-transform focus-visible:ring-4 focus-visible:ring-ring enabled:hover:scale-105 enabled:active:scale-95 disabled:opacity-80 motion-reduce:transition-none">
    <Icon icon={phase==="sending"||phase==="starting"?LoaderCircle:recording?ArrowUp:phase==="error"&&retryable?RotateCcw:Mic} size={32} aria-hidden="true" className={phase==="sending"||phase==="starting"?"animate-spin motion-reduce:animate-none":undefined}/>
   </button>
  </div>
  <div className="mt-8 flex min-h-20 flex-col items-center gap-2 text-center" aria-live="polite">
   {recording&&<p className="type-heading tabular-nums" aria-label={"زمان ضبط "+voiceTimerFa(elapsed)}>{voiceTimerFa(elapsed)}</p>}
   <p className={"type-body "+(phase==="error"?"text-fg-primary":"text-fg-secondary")}>{phase==="error"?error+(retryable?" برای ضبط دوباره روی دایره بزن.":""):phase==="sending"?SENDING_FA:phase==="starting"?STARTING_FA:HINT_FA}</p>
   {recording&&left<=10_000&&<p className="type-caption text-fg-secondary">{voiceTimerFa(left)} تا پایان ضبط</p>}
  </div>
 </>;
}

/** Draws the round equalizer: bars pointing outwards from just outside the central button, in the theme's primary color. */
function paint(c:HTMLCanvasElement|null,bars:readonly number[]){
 if(!c)return;
 const dpr=window.devicePixelRatio||1,w=c.clientWidth,h=c.clientHeight;
 if(c.width!==Math.round(w*dpr)||c.height!==Math.round(h*dpr)){c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);}
 const g=c.getContext("2d");if(!g)return;
 g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,w,h);
 const cx=w/2,cy=h/2,inner=Math.min(w,h)*0.25,reach=Math.min(w,h)*0.22,color=getComputedStyle(c).color;
 g.strokeStyle=color;g.lineCap="round";g.lineWidth=Math.max(2,Math.min(w,h)*0.012);
 bars.forEach((v,i)=>{
  const a=(i/bars.length)*Math.PI*2-Math.PI/2,len=4+v*reach;
  g.globalAlpha=0.35+0.65*v;
  g.beginPath();g.moveTo(cx+Math.cos(a)*inner,cy+Math.sin(a)*inner);g.lineTo(cx+Math.cos(a)*(inner+len),cy+Math.sin(a)*(inner+len));g.stroke();
 });
 g.globalAlpha=1;
}
