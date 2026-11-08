import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {lockToSelection} from "../lib/region-restore";

const W=320,H=240;
/** A textured source (gradients and stripes, so a shift is measurable). */
function source(){const b=Buffer.alloc(W*H*3);for(let y=0;y<H;y++)for(let x=0;x<W;x++){const q=(y*W+x)*3;b[q]=(x*3+y)%256;b[q+1]=(Math.floor(x/9)%2)*120+(y%40)*2;b[q+2]=(x*y)%251;}return b;}
const png=(raw:Buffer,ch:1|3)=>sharp(raw,{raw:{width:W,height:H,channels:ch}}).png().toBuffer();

test("selection lock: outside the selection stays exactly the source; the edit lands where the selection is, even when the model shifted the picture",async()=>{
 const S=source();
 // The selection: a 60×60 square at (130,90).
 const M=Buffer.alloc(W*H);for(let y=90;y<150;y++)for(let x=130;x<190;x++)M[y*W+x]=255;
 // The model's answer: the whole picture moved 6 px right and 4 px down, 2% brighter, with the edit (pure green) drawn at the shifted place.
 const O=Buffer.alloc(W*H*3);
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const sx=Math.min(W-1,Math.max(0,x-6)),sy=Math.min(H-1,Math.max(0,y-4)),q=(y*W+x)*3,p=(sy*W+sx)*3;
  for(let c=0;c<3;c++)O[q+c]=Math.min(255,Math.round(S[p+c]*1.02));
  if(sx>=135&&sx<185&&sy>=95&&sy<145){O[q]=0;O[q+1]=255;O[q+2]=0;}}
 const r=await lockToSelection({source:await png(S,3),mask:await png(M,1),output:await png(O,3)});
 assert.ok(!("skipped" in r),"locked");
 if("skipped" in r)return;
 assert.ok(Math.abs(r.aligned.dx-6)<=1&&Math.abs(r.aligned.dy-4)<=1,"found the shift: "+JSON.stringify(r.aligned));
 const out=await sharp(r.bytes).raw().toBuffer();
 let outsideDiff=0;for(let p=0;p<W*H;p++)if(!M[p])for(let c=0;c<3;c++)outsideDiff=Math.max(outsideDiff,Math.abs(out[p*3+c]-S[p*3+c]));
 assert.equal(outsideDiff,0,"every pixel outside the selection is the source's");
 const mid=(120*W+160)*3;assert.deepEqual([out[mid],out[mid+1],out[mid+2]],[0,255,0],"the edit sits in the selection, where it belongs");
});

test("selection lock: an empty mask changes nothing",async()=>{
 const S=source(),r=await lockToSelection({source:await png(S,3),mask:await png(Buffer.alloc(W*H),1),output:await png(S,3)});
 assert.ok("skipped" in r);
});

test("selection lock: a result of another shape is scaled proportionally, never stretched",async()=>{
 const S=source();
 const M=Buffer.alloc(W*H);for(let y=90;y<150;y++)for(let x=130;x<190;x++)M[y*W+x]=255;
 // The model answered square (240×240): the source's centre, uncropped height, edit drawn as a green square in the middle.
 const SQ=240,O=Buffer.alloc(SQ*SQ*3),off=(W-SQ)/2;
 for(let y=0;y<SQ;y++)for(let x=0;x<SQ;x++){const q=(y*SQ+x)*3,p=(y*W+x+off)*3;for(let c=0;c<3;c++)O[q+c]=S[p+c];if(x+off>=135&&x+off<185&&y>=95&&y<145){O[q]=0;O[q+1]=255;O[q+2]=0;}}
 const r=await lockToSelection({source:await png(S,3),mask:await png(M,1),output:await sharp(O,{raw:{width:SQ,height:SQ,channels:3}}).png().toBuffer()});
 assert.ok(!("skipped" in r));if("skipped" in r)return;
 const out=await sharp(r.bytes).raw().toBuffer(),mid=(120*W+160)*3;
 assert.deepEqual([out[mid],out[mid+1],out[mid+2]],[0,255,0],"the edit lands in place, at its own proportions");
});
