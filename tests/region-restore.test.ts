import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
process.env.WHOUSH_MEDIA_DIR=mkdtempSync(join(tmpdir(),"whoush-restore-test-"));
import sharp from "sharp";
import {restoreOutsideEdit,rememberRegionEdit,restoreTurnOutputs} from "../lib/region-restore";
import {storeMedia,readMedia,MEDIA_ROUTE} from "../lib/media-store";

const W=320,H=200;
/** A textured source (fine detail everywhere, like skin and hair), the same with paint, and a model answer that drifts everywhere and edits one area. */
async function scene(){
 const src=Buffer.alloc(W*H*3);for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*3,v=120+((x*7+y*13)%23)*3;src[i]=v;src[i+1]=v-20;src[i+2]=v-40;}
 const guide=Buffer.from(src),out=Buffer.from(src);
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*3;
  if(Math.abs(y-100)<6&&x>140&&x<180){guide[i]=255;guide[i+1]=31;guide[i+2]=75;}                 // the paint (red)
  const drift=((x*31+y*17)%9)-4;out[i]=out[i]+drift;out[i+1]=out[i+1]+drift;out[i+2]=out[i+2]+drift; // regeneration drift everywhere
  if(Math.abs(y-100)<10&&x>130&&x<190){out[i]=200;out[i+1]=10;out[i+2]=30;}                          // the real edit, a little wider than the paint
 }
 const png=(b:Buffer)=>sharp(b,{raw:{width:W,height:H,channels:3}}).png().toBuffer();
 return {src,source:await png(src),guide:await png(guide),output:await png(out)};
}

test("restore: everything outside the edited area comes back from the source exactly; the edit itself is kept whole, past the brush stroke",async()=>{
 const s=await scene();
 const r=await restoreOutsideEdit({source:s.source,guide:s.guide,output:s.output});
 assert.ok(!("skipped" in r),JSON.stringify(r));
 const R=await sharp((r as {bytes:Buffer}).bytes).removeAlpha().raw().toBuffer();
 const px=(x:number,y:number)=>{const i=(y*W+x)*3;return [R[i],R[i+1],R[i+2]];};
 for(const [x,y] of [[10,10],[300,190],[60,150],[250,40],[160,60]])assert.deepEqual(px(x,y),[...s.src.subarray((y*W+x)*3,(y*W+x)*3+3)],"source pixel at "+x+","+y);
 for(const [x,y] of [[160,100],[135,100],[185,95]])assert.deepEqual(px(x,y),[200,10,30],"the edit at "+x+","+y+" (outside the stroke too)");
});

test("restore: no paint found, or a model that redrew the whole photo, keeps the model's result untouched",async()=>{
 const s=await scene();
 assert.deepEqual(await restoreOutsideEdit({source:s.source,guide:s.source,output:s.output}),{skipped:"no_paint_found"});
 const all=await sharp({create:{width:W,height:H,channels:3,background:{r:0,g:200,b:0}}}).png().toBuffer();
 assert.deepEqual(await restoreOutsideEdit({source:s.source,guide:s.guide,output:all}),{skipped:"model_redrew_the_photo"},"pasting into a redrawn photo would ghost");
});

test("restore wiring: a brush-edit turn's finished image is replaced by the restored one; other turns and videos are untouched",async()=>{
 const s=await scene();
 const src=await storeMedia(new Uint8Array(s.source),"image/png"),guide=await storeMedia(new Uint8Array(s.guide),"image/png"),out=await storeMedia(new Uint8Array(s.output),"image/png");
 const turn=crypto.randomUUID();rememberRegionEdit(turn,{sourceId:src.id,guideId:guide.id});
 const [img,vid]=await restoreTurnOutputs(turn,[{kind:"image",url:out.url},{kind:"video",url:"https://x/v.mp4"}]);
 assert.notEqual(img.url,out.url);assert.equal(vid.url,"https://x/v.mp4");
 const restored=await readMedia(img.url.slice(MEDIA_ROUTE.length));assert.equal(restored?.mime,"image/png");
 const other=await restoreTurnOutputs(crypto.randomUUID(),[{kind:"image",url:out.url}]);assert.equal(other[0].url,out.url,"not a brush edit: unchanged");
});
