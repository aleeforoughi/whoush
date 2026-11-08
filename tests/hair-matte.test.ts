import test from "node:test";
import assert from "node:assert/strict";
import {refineHairEdge} from "../lib/hair-matte";

const W=200,H=160;
/** A beige wall with white hair (x ≥ 120) and thin strands: one straight 1-px strand out to x 90, one diagonal to x 95. Skin (pink) at the bottom left. */
function photo(){
 const px=new Uint8Array(W*H*3),set=(x:number,y:number,c:number[])=>{const q=(y*W+x)*3;px[q]=c[0];px[q+1]=c[1];px[q+2]=c[2];};
 for(let y=0;y<H;y++)for(let x=0;x<W;x++)set(x,y,[176+Math.round(x/40),160,138]);
 for(let y=0;y<H;y++)for(let x=120;x<W;x++)set(x,y,[244,244,242]);
 for(let x=90;x<120;x++)set(x,40,[226,224,220]);
 for(let k=0;k<25;k++)set(119-k,70+k,[230,228,224]);
 for(let y=120;y<H;y++)for(let x=60;x<118;x++)set(x,y,[150,110,100]);
 return px;
}
const coarse=()=>{const m=new Uint8Array(W*H);for(let y=0;y<H;y++)for(let x=120;x<W;x++)m[y*W+x]=1;return m;};
const opts={band:0.2,rim:0.01,cut:0.15,minContrast:24};

test("hair edge: thin strands beyond the coarse outline are added, straight and diagonal, one pixel wide",()=>{
 const out=refineHairEdge(photo(),3,W,H,coarse(),undefined,opts);
 assert.equal(out[40*W+95],1,"the straight strand");
 assert.equal(out[(70+20)*W+(119-20)],1,"the diagonal strand");
 assert.equal(out[100*W+60],0,"the plain wall is not hair");
});

test("hair edge: only adds, never over skin, nothing when hair and background are alike",()=>{
 const px=photo(),m=coarse(),skin=new Uint8Array(W*H);for(let y=120;y<H;y++)for(let x=60;x<118;x++)skin[y*W+x]=1;
 const out=refineHairEdge(px,3,W,H,m,skin,opts);
 assert.ok(m.every((v,i)=>!v||out[i]),"every coarse hair pixel stays");
 for(let y=120;y<H;y++)for(let x=60;x<118;x++)assert.equal(out[y*W+x],0,"skin is never taken as hair");
 // A wall the colour of the hair: no contrast, nothing added.
 const same=new Uint8Array(W*H*3).fill(240);
 const flat=refineHairEdge(same,3,W,H,m,undefined,opts);let added=0;for(let i=0;i<W*H;i++)if(flat[i]&&!m[i])added++;
 assert.equal(added,0);
});
