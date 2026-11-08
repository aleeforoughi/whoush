import "server-only";
/**
 * Restore after a brush edit (owner, 2026-11-06: change only that part, nothing else; strict skin-texture, anti-drift and colour locks). An image model
 * regenerates the whole picture even when told to change one area, so untouched skin, hair and background drift a little (measured live: about 3x the
 * noise of a plain JPEG re-save). After the edit, Whoush puts every pixel outside the edited areas back from the source, exactly:
 *  1. the painted areas are found by comparing the marked copy with the source (the translucent neon paint);
 *  2. the edit is followed outward from them through the model's real change, so a necklace drawn around the whole neck is kept whole;
 *  3. that region is grown a little and feathered, and the result is the model's pixels inside it and the source's everywhere else.
 * Deterministic image arithmetic, no model. When the change covers most of the picture (not a local edit), or anything fails, the model's result stays.
 */
export type RestoreInput={source:Uint8Array;guide:Uint8Array;output:Uint8Array};
export type RestoreResult={bytes:Buffer;mime:"image/png";keptFraction:number}|{skipped:string};

/** Paint shows as a strong difference; a real edit (lipstick, gold, a new object) as a strong change, while the model's drift elsewhere stays faint (about 6
 * of 255 measured live), so the follow threshold sits well above drift. The follow also stays within a reach of the paint, so drift never carries it across
 * the face. */
export type RestoreTuning={changeDiff:number;bridge:number;reach:number};
export const RESTORE_TUNING:RestoreTuning={changeDiff:18,bridge:1,reach:.13};
const PAINT_DIFF=40,MAX_EDIT_FRACTION=.5,MAX_FAR_CHANGE=.3;

function dilate(mask:Uint8Array,w:number,h:number,r:number):Uint8Array{
 if(r<=0)return mask;
 const tmp=new Uint8Array(w*h),out=new Uint8Array(w*h);
 for(let y=0;y<h;y++){let last=-1e9;for(let x=0;x<w;x++){if(mask[y*w+x])last=x;tmp[y*w+x]=x-last<=r?1:0;}last=1e9;for(let x=w-1;x>=0;x--){if(mask[y*w+x])last=x;if(last-x<=r)tmp[y*w+x]=1;}}
 for(let x=0;x<w;x++){let last=-1e9;for(let y=0;y<h;y++){if(tmp[y*w+x])last=y;out[y*w+x]=y-last<=r?1:0;}last=1e9;for(let y=h-1;y>=0;y--){if(tmp[y*w+x])last=y;if(last-y<=r)out[y*w+x]=1;}}
 return out;
}
function boxBlur(src:Float32Array,w:number,h:number,r:number):Float32Array{
 const tmp=new Float32Array(w*h),out=new Float32Array(w*h),n=2*r+1;
 for(let y=0;y<h;y++){let s=0;for(let x=-r;x<=r;x++)s+=src[y*w+Math.min(w-1,Math.max(0,x))];for(let x=0;x<w;x++){tmp[y*w+x]=s/n;s+=src[y*w+Math.min(w-1,x+r+1)]-src[y*w+Math.max(0,x-r)];}}
 for(let x=0;x<w;x++){let s=0;for(let y=-r;y<=r;y++)s+=tmp[Math.min(h-1,Math.max(0,y))*w+x];for(let y=0;y<h;y++){out[y*w+x]=s/n;s+=tmp[Math.min(h-1,y+r+1)*w+x]-tmp[Math.max(0,y-r)*w+x];}}
 return out;
}

export async function restoreOutsideEdit(i:RestoreInput,t:RestoreTuning=RESTORE_TUNING):Promise<RestoreResult>{
 const sharp=(await import("sharp")).default;
 // The result has the SOURCE photo's size (owner, 2026-11-06: no quality loss): the model may answer at a smaller size (1K), so only its edited area is
 // scaled up (Lanczos), and every other pixel is the source's own, at full resolution.
 const src=await sharp(i.source).rotate().removeAlpha().raw().toBuffer({resolveWithObject:true});
 const S=src.data,w=src.info.width,h=src.info.height;
 if(!w||!h||src.info.channels!==3)return {skipped:"no_size"};
 const raw=(b:Uint8Array)=>sharp(b).rotate().resize(w,h,{fit:"fill",kernel:"lanczos3"}).removeAlpha().raw().toBuffer();
 const [G,O]=await Promise.all([raw(i.guide),raw(i.output)]);
 const N=w*h,paint=new Uint8Array(N),change=new Uint8Array(N);
 let painted=0;
 for(let p=0,k=0;p<N;p++,k+=3){
  const pd=Math.max(Math.abs(G[k]-S[k]),Math.abs(G[k+1]-S[k+1]),Math.abs(G[k+2]-S[k+2]));if(pd>PAINT_DIFF){paint[p]=1;painted++;}
  if((Math.abs(O[k]-S[k])+Math.abs(O[k+1]-S[k+1])+Math.abs(O[k+2]-S[k+2]))/3>t.changeDiff)change[p]=1;
 }
 if(painted<20)return {skipped:"no_paint_found"};
 // Seeds: the paint, grown a little (a brush rarely covers the whole lip line). Then the edit is followed through connected real change.
 const seedR=Math.round(.02*Math.max(w,h)),seeds=dilate(paint,w,h,seedR),bridge=dilate(change,w,h,t.bridge);
 const region=new Uint8Array(N),queue=new Int32Array(N);let head=0,tail=0;
 for(let p=0;p<N;p++)if(seeds[p]){region[p]=1;queue[tail++]=p;}
 const reach=dilate(paint,w,h,Math.round(t.reach*Math.max(w,h)));
 // Strong change far from the paint means the model redrew the photo (moved, zoomed or re-coloured it): pasting its edit back would ghost, so its result stays.
 let far=0,farChanged=0;for(let p=0;p<N;p++)if(!reach[p]){far++;if(change[p])farChanged++;}
 if(far&&farChanged/far>MAX_FAR_CHANGE)return {skipped:"model_redrew_the_photo"};
 while(head<tail){const p=queue[head++],x=p%w,y=(p-x)/w;
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=w||ny>=h)continue;const q=ny*w+nx;if(!region[q]&&bridge[q]&&reach[q]){region[q]=1;queue[tail++]=q;}}}
 const grown=dilate(region,w,h,Math.max(3,Math.round(.004*Math.max(w,h))));
 let edited=0;for(let p=0;p<N;p++)if(grown[p])edited++;
 if(edited/N>MAX_EDIT_FRACTION)return {skipped:"edit_covers_most_of_the_photo"};
 const alphaIn=new Float32Array(N);for(let p=0;p<N;p++)alphaIn[p]=grown[p];
 const alpha=boxBlur(alphaIn,w,h,Math.max(3,Math.round(.005*Math.max(w,h))));
 const out=Buffer.alloc(N*3);
 for(let p=0,k=0;p<N;p++,k+=3){const a=alpha[p];out[k]=Math.round(O[k]*a+S[k]*(1-a));out[k+1]=Math.round(O[k+1]*a+S[k+1]*(1-a));out[k+2]=Math.round(O[k+2]*a+S[k+2]*(1-a));}
 const bytes=await sharp(out,{raw:{width:w,height:h,channels:3}}).png().toBuffer();
 return {bytes,mime:"image/png",keptFraction:1-edited/N};
}

/**
 * The selection lock (owner, 2026-11-08: "lock the selection… the model must not change or affect any area outside it; accurate inpaint with one
 * generation"). With the exact mask the editor drew (the wand's and the brush's selection, not guessed from the paint), the result is the model's pixels
 * inside the selection and the source's own pixels everywhere else, exactly:
 *  1. the model's picture is brought to the source's size and, when it moved or rescaled the scene a little, lined up with the source first (the best
 *     scale and shift, found on a small grey copy by matching the area outside the selection), so the edit sits where it belongs;
 *  2. the blend fades in over a few pixels INSIDE the selection's edge, so nothing outside it changes at all and the seam is invisible.
 * Unlike the guessed restore above, it never skips: the area outside the selection is always the source's.
 */
export type LockResult={bytes:Buffer;mime:"image/png";aligned:{scale:number;dx:number;dy:number}}|{skipped:string};
function erode(mask:Uint8Array,w:number,h:number,r:number):Uint8Array{
 const inv=new Uint8Array(w*h);for(let i=0;i<inv.length;i++)inv[i]=mask[i]?0:1;
 const d=dilate(inv,w,h,r),out=new Uint8Array(w*h);for(let i=0;i<out.length;i++)out[i]=d[i]?0:1;return out;
}
/** The scale and shift (source → output coordinates, about the centre) that best line the output up with the source outside the selection. */
export function alignOutside(S:Uint8Array,O:Uint8Array,outside:Uint8Array,w:number,h:number):{scale:number;dx:number;dy:number;gain:number}{
 const cx=w/2,cy=h/2;
 const err=(s:number,dx:number,dy:number)=>{let e=0,n=0;
  for(let y=0;y<h;y+=2)for(let x=0;x<w;x+=2){const p=y*w+x;if(!outside[p])continue;
   const ox=Math.round(cx+s*(x-cx)+dx),oy=Math.round(cy+s*(y-cy)+dy);if(ox<0||oy<0||ox>=w||oy>=h)continue;
   e+=Math.abs(S[p]-O[oy*w+ox]);n++;}
  return n?e/n:Infinity;};
 const base=err(1,0,0);let best={scale:1,dx:0,dy:0,e:base};
 const R=Math.max(2,Math.round(.03*Math.max(w,h)));
 for(let s=.95;s<=1.0501;s+=.01)for(let dy=-R;dy<=R;dy++)for(let dx=-R;dx<=R;dx++){const e=err(s,dx,dy);if(e<best.e)best={scale:s,dx,dy,e};}
 return {scale:best.scale,dx:best.dx,dy:best.dy,gain:base>0?1-best.e/base:0};
}
export type Crop={x:number;y:number;w:number;h:number};
/** The model's close-up result scaled to its crop and placed back into the full source (raw RGB at the source's size). */
async function stitch(sharp:typeof import("sharp").default,source:Uint8Array,output:Uint8Array,c:Crop,w:number,h:number):Promise<Buffer>{
 const piece=await sharp(output).rotate().resize(c.w,c.h,{fit:"cover",position:"centre",kernel:"lanczos3"}).removeAlpha().png().toBuffer();
 return sharp(source).rotate().removeAlpha().composite([{input:piece,left:c.x,top:c.y}]).resize(w,h,{fit:"fill"}).raw().toBuffer();
}
/**
 * Crop and stitch (owner, 2026-11-08): a small selection (lips, an eye, a necklace) gets a close-up instead of the whole photo, so the model spends its
 * resolution on it. The crop is the selection's box with generous context around it (lighting and geometry), grown to a standard ratio and kept inside
 * the photo. Null when the selection, with its context, would cover most of the photo anyway.
 */
export function planCrop(box:{x0:number;y0:number;x1:number;y1:number},w:number,h:number,ratios:readonly string[]):(Crop&{ratio:string})|null{
 const bw=box.x1-box.x0,bh=box.y1-box.y0;if(bw<=0||bh<=0)return null;
 // Context around the selection: 30% of its size, at least 5% of the photo (enough light and geometry, while the selection keeps most of the pixels).
 const m=Math.max(.3*Math.max(bw,bh),.05*Math.max(w,h));
 let cw=bw+2*m,ch=bh+2*m;
 const value=(r:string)=>{const [a,b]=r.split(":").map(Number);return a/b;};
 let ratio=ratios[0],bestD=Infinity;for(const r of ratios){const d=Math.abs(Math.log(value(r)/(cw/ch)));if(d<bestD){bestD=d;ratio=r;}}
 const v=value(ratio);if(cw/ch<v)cw=ch*v;else ch=cw/v;
 if(cw>w){cw=w;ch=cw/v;}if(ch>h){ch=h;cw=ch*v;}
 if(cw*ch>.55*w*h)return null;
 const cx=(box.x0+box.x1)/2,cy=(box.y0+box.y1)/2;
 const x=Math.round(Math.min(w-cw,Math.max(0,cx-cw/2))),y=Math.round(Math.min(h-ch,Math.max(0,cy-ch/2)));
 return {x,y,w:Math.round(cw),h:Math.round(ch),ratio};
}
/**
 * The close-ups for a brush edit: the photo and its region map cut to the crop (planCrop), stored as Whoush's own media. Both are cut from media that
 * already passed their checks, so no unchecked pixel reaches a model. Null when no crop is worth it or anything fails (the whole photo is then sent).
 */
export async function cropForEdit(sourceId:string,guideId:string,mask:Buffer,ratios:readonly string[]):Promise<{photo:{id:string;url:string};map:{id:string;url:string};crop:Crop;ratio:string}|null>{
 try{
  const sharp=(await import("sharp")).default;
  const why=(r:string)=>{if(process.env.NODE_ENV!=="production")console.info("[whoush dev-live] edit close-up skipped:",r);return null;};
  const [src,guide]=await Promise.all([readMedia(sourceId),readMedia(guideId)]);if(!src||!guide)return why("media_missing");
  const meta=await sharp(src.bytes).rotate().toBuffer({resolveWithObject:true}),w=meta.info.width,h=meta.info.height;
  const M=await sharp(mask).resize(w,h,{fit:"fill"}).removeAlpha().greyscale().raw().toBuffer();
  let x0=w,y0=h,x1=-1,y1=-1;for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(M[y*w+x]>127){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}
  if(x1<0)return why("empty_mask");
  const c=planCrop({x0,y0,x1:x1+1,y1:y1+1},w,h,ratios);if(!c)return why("selection_too_big "+Math.round((x1-x0)/w*100)+"x"+Math.round((y1-y0)/h*100)+"%");
  const photo=await sharp(meta.data).extract({left:c.x,top:c.y,width:c.w,height:c.h}).jpeg({quality:95}).toBuffer();
  const gm=await sharp(guide.bytes).metadata(),gw=gm.width??w,gh=gm.height??h,k=gw/w;
  const map=await sharp(guide.bytes).extract({left:Math.round(c.x*k),top:Math.round(c.y*(gh/h)),width:Math.max(1,Math.min(gw-Math.round(c.x*k),Math.round(c.w*k))),height:Math.max(1,Math.min(gh-Math.round(c.y*(gh/h)),Math.round(c.h*(gh/h))))}).jpeg({quality:95}).toBuffer();
  const [p,g]=await Promise.all([storeMedia(new Uint8Array(photo),"image/jpeg"),storeMedia(new Uint8Array(map),"image/jpeg")]);
  return {photo:p,map:g,crop:{x:c.x,y:c.y,w:c.w,h:c.h},ratio:c.ratio};
 }catch(e){if(process.env.NODE_ENV!=="production")console.info("[whoush dev-live] edit close-up failed:",e instanceof Error?e.message.slice(0,120):"error");return null;}
}

export async function lockToSelection(i:{source:Uint8Array;mask:Uint8Array;output:Uint8Array;
 /** Crop and stitch: the model edited this close-up of the source (source pixels); its result goes back there first. */crop?:Crop}):Promise<LockResult>{
 const sharp=(await import("sharp")).default;
 const src=await sharp(i.source).rotate().removeAlpha().raw().toBuffer({resolveWithObject:true});
 const S=src.data,w=src.info.width,h=src.info.height,N=w*h;
 if(!w||!h||src.info.channels!==3)return {skipped:"no_size"};
 const [M,O]=await Promise.all([
  sharp(i.mask).resize(w,h,{fit:"fill",kernel:"lanczos3"}).removeAlpha().greyscale().raw().toBuffer(),
  // Never stretched (owner, 2026-11-08: a result of another shape came back with a stretched face): scaled to cover the source and centred, then lined up.
  // A close-up edit (crop and stitch) is scaled to its crop and put back in its place in the source.
  i.crop?stitch(sharp,i.source,i.output,i.crop,w,h):sharp(i.output).rotate().resize(w,h,{fit:"cover",position:"centre",kernel:"lanczos3"}).removeAlpha().raw().toBuffer()]);
 const sel=new Uint8Array(N);let n=0;for(let p=0;p<N;p++)if(M[p]>127){sel[p]=1;n++;}
 if(n<20)return {skipped:"empty_mask"};
 // 1. Line the model's picture up with the source, measured outside the selection (kept clear of its edge) on a small grey copy.
 const k=Math.min(1,256/Math.max(w,h)),sw=Math.max(8,Math.round(w*k)),sh=Math.max(8,Math.round(h*k));
 const small=(b:Buffer)=>sharp(b,{raw:{width:w,height:h,channels:3}}).resize(sw,sh,{fit:"fill"}).greyscale().raw().toBuffer();
 const [Ss,Os,Ms]=await Promise.all([small(S),small(O),sharp(Buffer.from(sel.map(v=>v*255)),{raw:{width:w,height:h,channels:1}}).resize(sw,sh,{fit:"fill"}).raw().toBuffer()]);
 const near=dilate(Uint8Array.from(Ms,v=>v>0?1:0),sw,sh,2),outside=Uint8Array.from(near,v=>v?0:1);
 const a=alignOutside(Uint8Array.from(Ss),Uint8Array.from(Os),outside,sw,sh);
 let A:Buffer=O;const moved=a.gain>.15&&(a.scale!==1||a.dx||a.dy);
 if(moved){
  const s=a.scale,dx=a.dx/k,dy=a.dy/k,cx=w/2,cy=h/2;A=Buffer.alloc(N*3);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const fx=Math.min(w-1,Math.max(0,cx+s*(x-cx)+dx)),fy=Math.min(h-1,Math.max(0,cy+s*(y-cy)+dy)),x0=Math.floor(fx),y0=Math.floor(fy),x1=Math.min(w-1,x0+1),y1=Math.min(h-1,y0+1),tx=fx-x0,ty=fy-y0,q=(y*w+x)*3;
   for(let c=0;c<3;c++){const v=(O[(y0*w+x0)*3+c]*(1-tx)+O[(y0*w+x1)*3+c]*tx)*(1-ty)+(O[(y1*w+x0)*3+c]*(1-tx)+O[(y1*w+x1)*3+c]*tx)*ty;A[q+c]=Math.round(v);}
  }
 }
 // 1b. Each selected area is lined up on its own too (owner, 2026-11-08: a retouch showed doubled lips): a model may move one feature a few pixels while
 // the rest stays put, and the source's own lips then show beside the model's. The best small shift for each area is found on a thin ring just outside
 // it (where the result must match the source), and that area takes the model's pixels from there.
 const gray=(b:Buffer)=>{const g=new Float32Array(N);for(let p=0,q=0;p<N;p++,q+=3)g[p]=.299*b[q]+.587*b[q+1]+.114*b[q+2];return g;};
 const Sg=gray(S),Ag=gray(A);
 const label=new Int32Array(N),stack:number[]=[];let next=0;const areas:{pix:number[]}[]=[];
 for(let p0=0;p0<N;p0++){if(!sel[p0]||label[p0])continue;next++;const pix:number[]=[];stack.push(p0);label[p0]=next;
  while(stack.length){const p=stack.pop()!,x=p%w;pix.push(p);for(const q of [x>0?p-1:-1,x<w-1?p+1:-1,p-w,p+w])if(q>=0&&q<N&&sel[q]&&!label[q]){label[q]=next;stack.push(q);}}
  if(pix.length>=50)areas.push({pix});}
 const ringR=Math.max(4,Math.round(.012*Math.max(w,h))),R=Math.max(3,Math.round(.02*Math.max(w,h)));
 let local:Buffer|null=null;
 for(const a of areas){
  const own=new Uint8Array(N);for(const p of a.pix)own[p]=1;
  const grown=dilate(own,w,h,ringR),ring:number[]=[];for(let p=0;p<N;p+=2)if(grown[p]&&!sel[p])ring.push(p);
  if(ring.length<30)continue;
  const err=(dx:number,dy:number)=>{let e=0,n=0;for(const p of ring){const x=p%w+dx,y=(p-p%w)/w+dy;if(x<0||y<0||x>=w||y>=h)continue;e+=Math.abs(Sg[p]-Ag[y*w+x]);n++;}return n?e/n:Infinity;};
  const base=err(0,0);let best={dx:0,dy:0,e:base};
  for(let dy=-R;dy<=R;dy+=2)for(let dx=-R;dx<=R;dx+=2){const e=err(dx,dy);if(e<best.e)best={dx,dy,e};}
  for(let dy=best.dy-1;dy<=best.dy+1;dy++)for(let dx=best.dx-1;dx<=best.dx+1;dx++){const e=err(dx,dy);if(e<best.e)best={dx,dy,e};}
  if(!(best.e<base*.9)||(!best.dx&&!best.dy))continue;
  local??=Buffer.from(A);
  const reach=dilate(own,w,h,ringR);
  for(let p=0;p<N;p++){if(!reach[p])continue;const x=Math.min(w-1,Math.max(0,p%w+best.dx)),y=Math.min(h-1,Math.max(0,(p-p%w)/w+best.dy)),q=(y*w+x)*3,o=p*3;local[o]=A[q];local[o+1]=A[q+1];local[o+2]=A[q+2];}
 }
 if(local)A=local;
 // 2. The blend fades in inside the selection only: outside it every pixel is the source's.
 const r=Math.max(1,Math.round(.003*Math.max(w,h))),inner=erode(sel,w,h,r);
 let soft=boxBlur(Float32Array.from(inner),w,h,r);
 let total=0;for(let p=0;p<N;p++){soft[p]*=sel[p];total+=soft[p];}
 if(total<.3*n)soft=Float32Array.from(sel); // a selection too thin to fade (a line, an eyelash) is taken whole
 const out=Buffer.alloc(N*3);
 for(let p=0,q=0;p<N;p++,q+=3){const t=soft[p];out[q]=Math.round(A[q]*t+S[q]*(1-t));out[q+1]=Math.round(A[q+1]*t+S[q+1]*(1-t));out[q+2]=Math.round(A[q+2]*t+S[q+2]*(1-t));}
 const bytes=await sharp(out,{raw:{width:w,height:h,channels:3}}).png().toBuffer();
 return {bytes,mime:"image/png",aligned:moved?{scale:a.scale,dx:a.dx/k,dy:a.dy/k}:{scale:1,dx:0,dy:0}};
}

// ---- wiring: a brush-edit turn remembers its source and marked copy; its finished outputs are restored before they are shown ----
import {readMedia,storeMedia,MEDIA_ROUTE} from "./media-store";
/** `mask`: the exact selection the editor drew (a PNG, white = selected), when the edit has one: the result is then locked to it. */
type RegionTurn={sourceId:string;guideId:string;mask?:Buffer;/** Crop and stitch: the close-up the model edited (source pixels). */crop?:Crop};
const turns=()=>((globalThis as {__whoushRegionTurns?:Map<string,RegionTurn>}).__whoushRegionTurns??=new Map());
/** The orchestrator records a brush edit's source photo and marked copy (Whoush-owned media ids) for its turn. */
export function rememberRegionEdit(turnId:string,r:RegionTurn){const m=turns();m.set(turnId,r);if(m.size>500)m.delete(m.keys().next().value!);}
export const regionEditFor=(turnId:string)=>turns().get(turnId);
/**
 * Restores every finished image of a brush-edit turn (lib/region-restore.ts above). Each restored image is stored as a new Whoush-owned file and replaces the
 * model's in the outputs; anything that cannot be restored stays as the model made it. Never throws.
 */
export async function restoreTurnOutputs<T extends {kind:string;url:string;mime?:string}>(turnId:string,outputs:T[]):Promise<T[]>{
 const r=regionEditFor(turnId);if(!r)return outputs;
 try{
  const [src,guide]=await Promise.all([readMedia(r.sourceId),readMedia(r.guideId)]);if(!src||!guide)return outputs;
  return await Promise.all(outputs.map(async o=>{
   if(o.kind!=="image"||!o.url.startsWith(MEDIA_ROUTE))return o;
   const out=await readMedia(o.url.slice(MEDIA_ROUTE.length));if(!out)return o;
   const res:RestoreResult|LockResult=r.mask
    ?await lockToSelection({source:src.bytes,mask:r.mask,output:out.bytes,...(r.crop?{crop:r.crop}:{})}).catch(()=>({skipped:"error"}) as LockResult)
    :await restoreOutsideEdit({source:src.bytes,guide:guide.bytes,output:out.bytes}).catch(()=>({skipped:"error"}) as RestoreResult);
   if("skipped" in res)return o;
   const s=await storeMedia(new Uint8Array(res.bytes),res.mime);
   return {...o,url:s.url,mime:res.mime};
  }));
 }catch{return outputs;}
}
