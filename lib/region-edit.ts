"use client";
/**
 * «ویرایش با قلم» (owner, 2026-11-06; automatic masking is a later feature): the photo opens full screen; the user pinches to zoom, paints the parts to change
 * and leaves a comment on each, like comments in a design tool. Each brush is its own region with its own colour and tag (#ویرایش-۱, #ویرایش-۲ …). Whoush sends
 * the photo and a marked copy (every region in its colour, translucent) to an image-editing model in one generation; the prompt changes only the painted areas,
 * each as its comment says, and locks everything else. The marked copy is checked like any photo before it is used.
 */
import {fa} from "./format";
import type {RegionColorName} from "./attachments";

export const BRUSH_EDIT_FA="ادیت";
export const BRUSH_HINT_FA="روی جایی که می‌خوای عوض بشه بکش و برای هر قسمت بنویس چی بشه. بقیهٔ عکس دست نمی‌خوره.";
export const BRUSH_NOTE_PLACEHOLDER_FA="اینجا رو چه تغییری بدیم؟";
export const BRUSH_DONE_FA="ثبت";
export const BRUSH_NEW_FA="قلم جدید";
export const BRUSH_MARKED_FA="ناحیه‌ها مشخص شدن";
export const BRUSH_MISSING_NOTE_FA="برای هر قسمتی که رنگ کردی یه توضیح بنویس.";
export const MAX_NOTE=300;
export const MAX_REGIONS=5;
/** Five region colours, far apart, each with the English name the prompt uses. */
/** Neon, so the paint stands out on any photo (owner, 2026-11-06); `ink` is the readable text colour on it (dark on the light neons). */
export const REGION_COLORS:readonly {name:RegionColor;css:string;ink:string}[]=[
 {name:"red",css:"#ff1f4b",ink:"#fff"},{name:"blue",css:"#1f6bff",ink:"#fff"},{name:"green",css:"#39ff14",ink:"#0a0a0a"},{name:"yellow",css:"#fff01f",ink:"#0a0a0a"},{name:"magenta",css:"#ff00e6",ink:"#fff"}
];
/** The thin, smooth edge that keeps a neon dot or tag apart from any background: a 1px ring at 25% opacity (owner, 2026-11-06). */
export const NEON_SHADOW="0 0 0 1px rgba(255,255,255,.25)";
export type RegionColor=RegionColorName;
/** Five brush sizes, in screen pixels (so zooming in paints finer). */
export const BRUSH_SIZES=[{id:"xs",px:6,labelFa:"خیلی کوچک"},{id:"s",px:12,labelFa:"کوچک"},{id:"m",px:22,labelFa:"متوسط"},{id:"l",px:38,labelFa:"بزرگ"},{id:"xl",px:64,labelFa:"خیلی بزرگ"}] as const;
export type Region={n:number;color:RegionColor;note:string};
export type RegionEdit={regions:Region[];guideId:string;guideUrl:string};
/** A region's tag as the user sees it: #ادیت-۱. */
export const regionTagFa=(n:number)=>"#ادیت-"+fa(n);
export const colorCss=(c:RegionColor)=>REGION_COLORS.find(x=>x.name===c)!.css;
/** The marked copy: the photo with every region's paint over it, translucent. `masks` are drawn at the photo's own scale. */
export async function renderGuide(photo:Blob,masks:readonly HTMLCanvasElement[]):Promise<Blob>{
 const bmp=await createImageBitmap(photo,{imageOrientation:"from-image"});
 const k=Math.min(1,2048/Math.max(bmp.width,bmp.height)),w=Math.round(bmp.width*k),h=Math.round(bmp.height*k);
 const c=document.createElement("canvas");c.width=w;c.height=h;
 const ctx=c.getContext("2d");if(!ctx){bmp.close();throw new Error("no canvas");}
 ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";
 ctx.drawImage(bmp,0,0,w,h);bmp.close();ctx.globalAlpha=.55;
 for(const m of masks)ctx.drawImage(m,0,0,w,h);
 const out=await new Promise<Blob|null>(r=>c.toBlob(r,"image/jpeg",0.95));
 if(!out)throw new Error("no image");
 return out;
}
/**
 * The exact selection for the lock (owner, 2026-11-08): every area's paint as white on black, at most 1536 pixels on its longer side, as a base64 PNG.
 * It goes to Whoush's server only, to keep every pixel outside it as it was; never to a model.
 */
export async function renderMask(masks:readonly HTMLCanvasElement[]):Promise<string>{
 const m0=masks[0];if(!m0)throw new Error("no mask");
 const k=Math.min(1,1536/Math.max(m0.width,m0.height)),w=Math.max(1,Math.round(m0.width*k)),h=Math.max(1,Math.round(m0.height*k));
 const c=document.createElement("canvas");c.width=w;c.height=h;
 const ctx=c.getContext("2d");if(!ctx)throw new Error("no canvas");
 for(const m of masks)ctx.drawImage(m,0,0,w,h);
 // Paint (any colour, any opacity) becomes white; the rest black.
 ctx.globalCompositeOperation="source-in";ctx.fillStyle="#fff";ctx.fillRect(0,0,w,h);
 ctx.globalCompositeOperation="destination-over";ctx.fillStyle="#000";ctx.fillRect(0,0,w,h);
 const blob=await new Promise<Blob|null>(r=>c.toBlob(r,"image/png"));
 if(!blob)throw new Error("no image");
 const bytes=new Uint8Array(await blob.arrayBuffer());let bin="";for(let i=0;i<bytes.length;i+=0x8000)bin+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
 return btoa(bin);
}
/** Whether anything was painted on a mask. */
export function maskHasPaint(mask:HTMLCanvasElement):boolean{
 const ctx=mask.getContext("2d");if(!ctx||!mask.width)return false;
 const d=ctx.getImageData(0,0,mask.width,mask.height).data;
 for(let i=3;i<d.length;i+=16)if(d[i]>0)return true;
 return false;
}
