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

test("selection lock: an area the model moved on its own is lined up locally, so nothing shows twice",async()=>{
 const S=source();
 const M=Buffer.alloc(W*H);for(let y=100;y<130;y++)for(let x=140;x<200;x++)M[y*W+x]=255;
 // The model kept the picture in place but drew the edited feature (a red bar with the source's texture around it) 5 px lower and 4 px to the right.
 const O=Buffer.from(S);
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){if(x<130||x>=210||y<90||y>=140)continue;const sx=x-4,sy=y-5,q=(y*W+x)*3,p=(sy*W+sx)*3;for(let c=0;c<3;c++)O[q+c]=S[p+c];}
 for(let y=105;y<135;y++)for(let x=144;x<204;x++){const q=(y*W+x)*3;O[q]=220;O[q+1]=30;O[q+2]=40;}
 const r=await lockToSelection({source:await png(S,3),mask:await png(M,1),output:await png(O,3)});
 assert.ok(!("skipped" in r));if("skipped" in r)return;
 const out=await sharp(r.bytes).raw().toBuffer();
 const at=(x:number,y:number)=>{const q=(y*W+x)*3;return [out[q],out[q+1],out[q+2]];};
 assert.deepEqual(at(150,110),[220,30,40],"the feature fills the selection near its top-left…");
 assert.deepEqual(at(190,122),[220,30,40],"…and near its bottom-right: it was moved back into place, not cut off");
 assert.deepEqual(at(170,103),[220,30,40],"just inside the top edge: the edit, not the source's texture peeking through (the doubled-lips ghost)");
 let outside=0;for(let p=0;p<W*H;p++)if(!M[p])for(let c=0;c<3;c++)outside=Math.max(outside,Math.abs(out[p*3+c]-S[p*3+c]));
 assert.equal(outside,0,"outside the selection is still exactly the source");
});

test("crop and stitch: a small selection gets a close-up at a standard ratio inside the photo; a big one does not",async()=>{
 const {planCrop}=await import("../lib/region-restore");
 const R=["9:16","16:9","1:1","4:5","3:4","4:3","2:3","3:2","21:9"];
 const c=planCrop({x0:560,y0:400,x1:700,y1:450},1264,848,R)!;
 assert.ok(c,"lips get a close-up");
 assert.ok(c.x<=560&&c.y<=400&&c.x+c.w>=700&&c.y+c.h>=450,"the selection is inside the crop");
 assert.ok(c.x>=0&&c.y>=0&&c.x+c.w<=1264&&c.y+c.h<=848,"inside the photo");
 const [a,b]=c.ratio.split(":").map(Number);assert.ok(Math.abs(c.w/c.h-a/b)<0.02,"at its standard ratio "+c.ratio);
 assert.ok(c.w*c.h<0.55*1264*848,"a close-up, not the whole photo");
 const face=planCrop({x0:520,y0:150,x1:836,y1:540},1264,848,R)!;
 assert.ok(face&&face.w*face.h<0.4*1264*848,"a face (25% × 46% of the photo) still gets a close-up: "+JSON.stringify(face));
 assert.equal(planCrop({x0:100,y0:80,x1:1150,y1:800},1264,848,R),null,"a selection covering most of the photo is sent whole");
});

test("crop and stitch: the model's close-up goes back in its place, and outside the selection is the source",async()=>{
 const S=source();
 const M=Buffer.alloc(W*H);for(let y=100;y<130;y++)for(let x=140;x<200;x++)M[y*W+x]=255;
 const crop={x:100,y:70,w:140,h:90};
 // The model's answer for the close-up: the crop's own pixels at twice the size, with the selection painted green.
 const O=Buffer.alloc(crop.w*2*crop.h*2*3);
 for(let y=0;y<crop.h*2;y++)for(let x=0;x<crop.w*2;x++){const sx=crop.x+Math.floor(x/2),sy=crop.y+Math.floor(y/2),q=(y*crop.w*2+x)*3,p=(sy*W+sx)*3;
  for(let c=0;c<3;c++)O[q+c]=S[p+c];if(sx>=140&&sx<200&&sy>=100&&sy<130){O[q]=0;O[q+1]=255;O[q+2]=0;}}
 const r=await lockToSelection({source:await png(S,3),mask:await png(M,1),output:await sharp(O,{raw:{width:crop.w*2,height:crop.h*2,channels:3}}).png().toBuffer(),crop});
 assert.ok(!("skipped" in r));if("skipped" in r)return;
 const out=await sharp(r.bytes).raw().toBuffer(),mid=(115*W+170)*3;
 assert.deepEqual([out[mid],out[mid+1],out[mid+2]],[0,255,0],"the edit is back in place");
 let outside=0;for(let p=0;p<W*H;p++)if(!M[p])for(let c=0;c<3;c++)outside=Math.max(outside,Math.abs(out[p*3+c]-S[p*3+c]));
 assert.equal(outside,0,"outside the selection is exactly the source");
});
