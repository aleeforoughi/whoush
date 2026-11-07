"use client";
import {useEffect,useState} from "react";

/**
 * A video's first frame as a still image (owner, 2026-11-08: an uploaded video shows its first frame as the thumbnail). Safari on iPhone draws nothing for
 * a `<video preload="metadata">` of a local file until it is played, so the frame is grabbed here instead: the video loads muted and inline, plays for a
 * moment (allowed when muted) or seeks just past the start, and the frame is drawn to a small canvas (at most 480 px) as a JPEG. One grab per URL, cached
 * for the page's life; undefined while it works or when the browser cannot decode the video (the card then shows its icon).
 */
const cache=new Map<string,Promise<string|undefined>>();
const MAX_SIDE=480,TIMEOUT_MS=8000;

export function grabFirstFrame(url:string):Promise<string|undefined>{
 const known=cache.get(url);if(known)return known;
 const p=new Promise<string|undefined>(resolve=>{
  const v=document.createElement("video");
  let done=false;
  const finish=(out?:string)=>{if(done)return;done=true;window.clearTimeout(timer);v.pause();v.removeAttribute("src");v.load();resolve(out);};
  const timer=window.setTimeout(()=>finish(undefined),TIMEOUT_MS);
  const draw=()=>{
   if(done||!v.videoWidth||!v.videoHeight)return;
   const k=Math.min(1,MAX_SIDE/Math.max(v.videoWidth,v.videoHeight)),w=Math.max(1,Math.round(v.videoWidth*k)),h=Math.max(1,Math.round(v.videoHeight*k));
   const c=document.createElement("canvas");c.width=w;c.height=h;
   const ctx=c.getContext("2d");if(!ctx)return finish(undefined);
   try{ctx.drawImage(v,0,0,w,h);finish(c.toDataURL("image/jpeg",0.82));}catch{finish(undefined);}
  };
  v.muted=true;v.defaultMuted=true;v.playsInline=true;v.setAttribute("playsinline","");v.preload="auto";v.crossOrigin="anonymous";
  // A frame is ready once data has loaded: seek a hair past the start (the very first frame is often black), then draw when the seek lands.
  v.addEventListener("loadeddata",()=>{try{v.currentTime=Math.min(0.1,(v.duration||1)/2);}catch{draw();}},{once:true});
  v.addEventListener("seeked",draw,{once:true});
  v.addEventListener("error",()=>finish(undefined),{once:true});
  v.src=url;v.load();
  // iPhone loads no data for a video that is never played: a muted inline play starts it, and is paused at once by finish().
  void v.play()?.catch(()=>{});
 });
 cache.set(url,p);return p;
}

/** The first frame of the video at `url` as an image URL, or undefined while it is grabbed or when it cannot be. */
export function useVideoPoster(url:string|undefined):string|undefined{
 const [poster,setPoster]=useState<{url:string;src?:string}>();
 useEffect(()=>{
  if(!url)return;
  let alive=true;
  void grabFirstFrame(url).then(src=>{if(alive)setPoster({url,src});});
  return()=>{alive=false;};
 },[url]);
 return poster&&poster.url===url?poster.src:undefined;
}

/**
 * A video's thumbnail: its first frame as a still once grabbed; until then (or where it cannot be grabbed) the video element itself, which desktop browsers
 * draw at 0.1 s. Decorative: the card around it names the file.
 */
export function VideoThumb({url,className}:{url:string;className?:string}){
 const poster=useVideoPoster(url);
 // eslint-disable-next-line @next/next/no-img-element -- a data: URL drawn in the browser; next/image cannot optimize it
 return poster?<img src={poster} alt="" aria-hidden="true" className={className}/>
  :<video src={url+"#t=0.1"} preload="metadata" muted playsInline aria-hidden="true" tabIndex={-1} className={className}/>;
}
