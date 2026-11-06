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

// ---- wiring: a brush-edit turn remembers its source and marked copy; its finished outputs are restored before they are shown ----
import {readMedia,storeMedia,MEDIA_ROUTE} from "./media-store";
type RegionTurn={sourceId:string;guideId:string};
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
   const res=await restoreOutsideEdit({source:src.bytes,guide:guide.bytes,output:out.bytes}).catch(()=>({skipped:"error"}) as RestoreResult);
   if("skipped" in res)return o;
   const s=await storeMedia(new Uint8Array(res.bytes),res.mime);
   return {...o,url:s.url,mime:res.mime};
  }));
 }catch{return outputs;}
}
