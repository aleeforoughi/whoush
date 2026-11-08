/**
 * Strand-accurate hair edges (owner, 2026-11-08: "a more accurate hair masking, even thin hairs on the edge"). The segmenter's hair class comes from a
 * 256×256 model scaled up, so flyaway strands and the soft edge sit outside it and kept their old colour after a hair edit. This refines the edge the way
 * a "refine hair" brush does, with colour alone (pure, so it runs in the browser and in tests):
 *  1. a band around the coarse outline is uncertain; inside it (minus a thin rim) is surely hair, outside the band is surely not;
 *  2. for each band pixel, the local hair colour and the local background colour are the averages of the sure pixels around it;
 *  3. the pixel is added when its colour lies at least `cut` of the way from that background colour towards that hair colour;
 *  4. only strands connected to the hair are added (a patch of wall the colour of the hair, away from it, is not hair).
 * It only ever adds: for an edit locked to its selection, a missed strand keeps its old colour, while a little background taken in comes back from
 * the model's lined-up picture unchanged. Pixels in `exclude` (the segmenter's skin) are never added: shadowed skin beside the hair is hair-coloured.
 * Where hair and background have nearly the same colour, nothing is added.
 */
export type HairMatteOptions={/** Band width beyond the coarse outline, as a share of the longer side. */band:number;/** Rim inside the outline that is uncertain too. */rim:number;
 /** How far from background towards hair a pixel's colour must be. */cut:number;/** Below this colour difference (0..255 per channel, Euclidean) the outline is kept. */minContrast:number};
export const HAIR_MATTE_DEFAULTS:HairMatteOptions={band:0.035,rim:0.003,cut:0.15,minContrast:24};

/** Square dilation by r (running sums), in place of a copy. */
function grow(m:Uint8Array,w:number,h:number,r:number):Uint8Array{
 const row=new Uint8Array(w*h),out=new Uint8Array(w*h);if(r<1){out.set(m);return out;}
 for(let y=0;y<h;y++){const o=y*w;let n=0;for(let x=0;x<Math.min(w,r);x++)n+=m[o+x];for(let x=0;x<w;x++){if(x+r<w)n+=m[o+x+r];if(x-r-1>=0)n-=m[o+x-r-1];row[o+x]=n>0?1:0;}}
 for(let x=0;x<w;x++){let n=0;for(let y=0;y<Math.min(h,r);y++)n+=row[y*w+x];for(let y=0;y<h;y++){if(y+r<h)n+=row[(y+r)*w+x];if(y-r-1>=0)n-=row[(y-r-1)*w+x];out[y*w+x]=n>0?1:0;}}
 return out;
}
/** Box sums of radius r (running sums), clamped at the edges by shrinking the window. */
function boxSum(src:Float32Array,w:number,h:number,r:number):Float32Array{
 const tmp=new Float32Array(w*h),out=new Float32Array(w*h);
 for(let y=0;y<h;y++){const o=y*w;let a=0;for(let x=0;x<Math.min(w,r+1);x++)a+=src[o+x];for(let x=0;x<w;x++){tmp[o+x]=a;if(x+r+1<w)a+=src[o+x+r+1];if(x-r>=0)a-=src[o+x-r];}}
 for(let x=0;x<w;x++){let a=0;for(let y=0;y<Math.min(h,r+1);y++)a+=tmp[y*w+x];for(let y=0;y<h;y++){out[y*w+x]=a;if(y+r+1<h)a+=tmp[(y+r+1)*w+x];if(y-r>=0)a-=tmp[(y-r)*w+x];}}
 return out;
}

/**
 * The hair mask with its strands: `pixels` is the photo (RGBA or RGB, `channels`), `mask` the coarse hair (0/1, w×h). Only the hair's box plus the band
 * is worked on, so a large photo costs little.
 */
export function refineHairEdge(pixels:ArrayLike<number>,channels:3|4,w:number,h:number,mask:Uint8Array,exclude?:Uint8Array,o:HairMatteOptions=HAIR_MATTE_DEFAULTS):Uint8Array{
 let x0=w,y0=h,x1=-1,y1=-1;for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(mask[y*w+x]){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}
 const out=Uint8Array.from(mask);if(x1<0)return out;
 const L=Math.max(w,h),band=Math.max(3,Math.round(o.band*L)),rim=Math.max(1,Math.round(o.rim*L)),win=2*band;
 // The crop worked on: the hair's box, the band and the window around it.
 const cx0=Math.max(0,x0-band-win),cy0=Math.max(0,y0-band-win),cx1=Math.min(w-1,x1+band+win),cy1=Math.min(h-1,y1+band+win),cw=cx1-cx0+1,ch=cy1-cy0+1,N=cw*ch;
 const m=new Uint8Array(N);for(let y=0;y<ch;y++)for(let x=0;x<cw;x++)m[y*cw+x]=mask[(y+cy0)*w+x+cx0];
 const reach=grow(m,cw,ch,band),inv=new Uint8Array(N);for(let i=0;i<N;i++)inv[i]=m[i]?0:1;
 const notSure=grow(inv,cw,ch,rim),sureHair=new Float32Array(N),sureBg=new Float32Array(N);
 for(let i=0;i<N;i++){sureHair[i]=notSure[i]?0:1;sureBg[i]=reach[i]?0:1;}
 const wf=boxSum(sureHair,cw,ch,win),wb=boxSum(sureBg,cw,ch,win);
 const F:Float32Array[]=[],B:Float32Array[]=[],I:Float32Array[]=[];
 for(let c=0;c<3;c++){
  const v=new Float32Array(N);for(let y=0;y<ch;y++)for(let x=0;x<cw;x++)v[y*cw+x]=pixels[((y+cy0)*w+x+cx0)*channels+c];
  const f=new Float32Array(N),b=new Float32Array(N);for(let i=0;i<N;i++){f[i]=v[i]*sureHair[i];b[i]=v[i]*sureBg[i];}
  F.push(boxSum(f,cw,ch,win));B.push(boxSum(b,cw,ch,win));I.push(v);
 }
 // Each uncertain pixel: hair when its colour is far enough from the local background towards the local hair colour.
 const pick=new Uint8Array(N),min2=o.minContrast*o.minContrast;
 for(let i=0;i<N;i++){
  if(!reach[i])continue;
  if(m[i]){pick[i]=1;continue;}
  if(exclude&&exclude[(Math.floor(i/cw)+cy0)*w+i%cw+cx0])continue;
  if(wf[i]<1||wb[i]<1)continue;
  let dd=0,dot=0;for(let c=0;c<3;c++){const f=F[c][i]/wf[i],b=B[c][i]/wb[i],d=f-b;dd+=d*d;dot+=(I[c][i]-b)*d;}
  pick[i]=dd>=min2&&dot/dd>=o.cut?1:0;
 }
 // Only strands connected to the sure hair.
 const keep=new Uint8Array(N),stack:number[]=[];
 for(let i=0;i<N;i++)if(pick[i]&&!notSure[i]&&!keep[i]){keep[i]=1;stack.push(i);
  // Eight neighbours: a thin strand often runs diagonally, one pixel wide.
  while(stack.length){const p=stack.pop()!,x=p%cw;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const X=x+dx,q=p+dy*cw+dx;
   if(X>=0&&X<cw&&q>=0&&q<N&&pick[q]&&!keep[q]){keep[q]=1;stack.push(q);}}}}
 // Single pixels that passed on colour noise are dropped and the gaps between strands filled: a pixel is added where at least a fifth of its 5×5
 // neighbourhood was (a lone strand one pixel wide still has five of 25), so the strands become one clean halo around the hair, not speckle.
 const added=new Float32Array(N);for(let i=0;i<N;i++)added[i]=keep[i]&&!m[i]?1:0;
 const dense=boxSum(added,cw,ch,2);
 for(let y=0;y<ch;y++)for(let x=0;x<cw;x++){const i=y*cw+x;if(m[i])continue;
  if(reach[i]&&dense[i]>=5&&!(exclude&&exclude[(y+cy0)*w+x+cx0]))out[(y+cy0)*w+x+cx0]=1;}
 return out;
}
