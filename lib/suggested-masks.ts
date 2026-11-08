/**
 * The areas Whoush marked on a photo (boxes in 0..1, lib/edit-card.ts) as brush masks, one canvas per area at the photo's own size: what the editor
 * opens with, and what «بساز» on the edit card sends without opening the editor. Browser only.
 */
import {MAX_NOTE,MAX_REGIONS,REGION_COLORS,type Region} from "./region-edit";

export type SuggestedArea={note:string;boxes:readonly (readonly [number,number,number,number])[]};

/** Paints one area's boxes onto its layer, in its colour. */
export function paintSuggested(ctx:CanvasRenderingContext2D,slot:number,boxes:SuggestedArea["boxes"],w:number,h:number){
 ctx.fillStyle=REGION_COLORS[slot].css;
 for(const [x0,y0,x1,y1] of boxes){const x=x0*w,y=y0*h,bw=(x1-x0)*w,bh=(y1-y0)*h;
  ctx.beginPath();ctx.ellipse(x+bw/2,y+bh/2,Math.max(2,bw/2),Math.max(2,bh/2),0,0,Math.PI*2);ctx.fill();}
}

/** Loads the photo and returns one mask per area (at most five) with its region (#ادیت-n, colour, comment). */
export async function suggestedMasks(photoUrl:string,areas:readonly SuggestedArea[]):Promise<{masks:HTMLCanvasElement[];regions:Region[]}>{
 const img=new Image();img.src=photoUrl;await img.decode();
 const w=img.naturalWidth,h=img.naturalHeight,masks:HTMLCanvasElement[]=[],regions:Region[]=[];
 areas.slice(0,MAX_REGIONS).forEach((a,slot)=>{
  const c=document.createElement("canvas");c.width=w;c.height=h;
  const ctx=c.getContext("2d");if(!ctx)return;
  paintSuggested(ctx,slot,a.boxes,w,h);
  masks.push(c);regions.push({n:slot+1,color:REGION_COLORS[slot].name,note:a.note.trim().slice(0,MAX_NOTE)});
 });
 return {masks,regions};
}
