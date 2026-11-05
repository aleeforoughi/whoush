/**
 * HD versions of the characters' images, for close-ups: each from its raw generation (public/visuals/raw, git-ignored), trimmed exactly as the pack's
 * 640 px PNG was (scripts/generate-visual-assets.ts, finish) so it lines up with it, up to 1536 px on the long side, as WebP. The frame switches to it only
 * when a character is drawn larger than its 640 px image. Run after generating; then scripts/visual-manifest.ts.
 *
 *   node --import tsx scripts/visual-hd.ts
 */
import {mkdir,readdir,rm,writeFile} from "node:fs/promises";
import {existsSync} from "node:fs";
import path from "node:path";
import sharp from "sharp";

const DIR=path.join(process.cwd(),"public","visuals"),RAW=path.join(DIR,"raw"),HD=path.join(DIR,"hd");
/** The characters: people and the pets (everything else is a vector box or far away). */
const CHARACTER=/^(human|woman|person|animal|dog|horse)-/;
await mkdir(HD,{recursive:true});
let n=0;
for(const f of (await readdir(DIR)).filter(f=>f.endsWith(".png")&&CHARACTER.test(f))){
 const id=f.replace(/\.png$/,""),raw=path.join(RAW,f);
 if(!existsSync(raw)){console.log("no raw:",id);continue;}
 // Trimmed to what is really there (a faint shadow or speck, mostly transparent, does not count), as the pack's PNG was.
 const {data,info}=await sharp(raw).ensureAlpha().extractChannel(3).raw().toBuffer({resolveWithObject:true});
 let x0=info.width,y0=info.height,x1=-1,y1=-1;
 for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[y*info.width+x]>96){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}
 if(x1<0){console.log("empty raw:",id);continue;}
 let trimmed=await sharp(raw).extract({left:x0,top:y0,width:x1-x0+1,height:y1-y0+1}).png().toBuffer();
 // When that still differs from the PNG's shape, the colour trim the pack used.
 {const [pm,tm]=await Promise.all([sharp(path.join(DIR,f)).metadata(),sharp(trimmed).metadata()]);
  if(Math.abs(Math.log((pm.width!/pm.height!)/(tm.width!/tm.height!)))>0.015)trimmed=await sharp(raw).trim({threshold:1}).toBuffer();}
 // The HD picture must line up with the PNG exactly (the frame draws either in the same place): a raw that trims to another shape (it was
 // regenerated or refinished since) gets no HD version, and the PNG is used up close.
 const [png,hdm]=await Promise.all([sharp(path.join(DIR,f)).metadata(),sharp(trimmed).metadata()]);
 if(Math.abs(Math.log((png.width!/png.height!)/(hdm.width!/hdm.height!)))>0.015){console.log("shape differs, no HD:",id);await rm(path.join(HD,id+".webp"),{force:true});continue;}
 const out=await sharp(trimmed).resize({width:1536,height:1536,fit:"inside",withoutEnlargement:true}).webp({quality:82,alphaQuality:90}).toBuffer();
 await writeFile(path.join(HD,id+".webp"),out);n++;
}
// HD versions whose picture is gone.
for(const f of await readdir(HD)){const id=f.replace(/\.webp$/,"");if(!existsSync(path.join(DIR,id+".png"))){await rm(path.join(HD,f));console.log("removed",f);}}
console.log(n,"HD images");
