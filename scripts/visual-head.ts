/**
 * Where a person's head is in each of its pictures (the asset pack, docs/VISUAL_ASSETS.md): the top of the head and the neck (its narrowest row between
 * the head and the shoulders), as shares of the picture's height from its top, and the head's middle across, as a share of its width. The frame places a
 * close-up by the face (lib/frame-css.ts), so the face stays where the camera aims at every angle. Used by scripts/visual-manifest.ts.
 */
import sharp from "sharp";
export type Head={top:number;neck:number;x:number};
export async function headOf(file:string):Promise<Head|undefined>{
 const {data,info}=await sharp(file).ensureAlpha().extractChannel(3).raw().toBuffer({resolveWithObject:true});
 const W=info.width,H=info.height,on=(x:number,y:number)=>data[y*W+x]>96;
 const rows:{l:number;r:number;n:number}[]=[];
 for(let y=0;y<H;y++){let l=-1,r=-1,n=0;for(let x=0;x<W;x++)if(on(x,y)){if(l<0)l=x;r=x;n++;}rows.push({l,r,n});}
 const top=rows.findIndex(r=>r.n>0);if(top<0)return undefined;
 let bottom=H-1;while(bottom>top&&rows[bottom].n===0)bottom--;
 const tall=bottom-top,widest=Math.max(...rows.slice(top,top+Math.round(tall*0.12)).map(r=>r.n));
 // The neck: the narrowest row below the head's widest part, within the upper part of the figure.
 let neck=-1,least=Infinity,headMax=0;
 for(let y=top;y<top+tall*0.5;y++){const n=rows[y].n;if(n>headMax)headMax=n;
  if(y>top+tall*0.04&&n<headMax*0.92&&n<least){least=n;neck=y;}
  if(neck>0&&n>least*1.6&&y>neck+tall*0.02)break;}
 if(neck<0)return undefined;void widest;
 let sx=0,sn=0;for(let y=top;y<neck;y++)for(let x=0;x<W;x++)if(on(x,y)){sx+=x;sn++;}
 return {top:(top)/H,neck:neck/H,x:sn?sx/sn/W:0.5};
}
