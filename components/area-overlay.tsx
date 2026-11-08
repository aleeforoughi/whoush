"use client";
import {useEffect,useRef,useState} from "react";
import {exactAreas,type SuggestedArea} from "@/lib/suggested-masks";
import {paintMask} from "@/lib/segment";
import {REGION_COLORS} from "@/lib/region-edit";

/**
 * The areas Whoush marked, drawn exactly over the photo on the edit card (owner, 2026-11-08: "use the accurate selecting in the widget too… not
 * inaccurate circles"): the same exact areas the editor and «بساز» use (lib/suggested-masks.ts exactAreas). While they are found, a short note shows;
 * where the device cannot find one, nothing is drawn for it (never a rough oval).
 */
export function AreaOverlay({photoUrl,areas}:{photoUrl:string;areas:readonly SuggestedArea[]}){
 const canvas=useRef<HTMLCanvasElement>(null);
 const [state,setState]=useState<"working"|"ready">("working");
 useEffect(()=>{
  let live=true;
  exactAreas(photoUrl,areas).then(masks=>{
   const c=canvas.current;if(!live||!c)return;
   const first=masks.find(m=>m);if(first){c.width=first.w;c.height=first.h;}
   const ctx=c.getContext("2d");if(ctx)masks.forEach((m,i)=>{if(m)paintMask(ctx,m,REGION_COLORS[i%REGION_COLORS.length].css);});
   setState("ready");
  }).catch(()=>{if(live)setState("ready");});
  return()=>{live=false;};
 },[photoUrl,areas]);
 return <>
  <canvas ref={canvas} aria-hidden="true" className="pointer-events-none absolute inset-0 size-full opacity-55"/>
  {state==="working"&&<span role="status" className="absolute inset-x-0 bottom-2 mx-auto w-fit rounded-control bg-background/85 px-2.5 py-1 type-caption text-fg-primary">دارم دقیق علامت می‌زنم…</span>}
 </>;
}
