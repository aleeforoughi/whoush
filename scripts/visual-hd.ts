/**
 * HD versions of the characters' images, for close-ups: each from its raw generation (public/visuals/raw, git-ignored), trimmed exactly as the pack's
 * 640 px PNG was (scripts/generate-visual-assets.ts, finish) so it lines up with it, up to 1536 px on the long side, as WebP. The frame switches to it only
 * when a character is drawn larger than its 640 px image. Run after generating; then scripts/visual-manifest.ts.
 *
 *   node --import tsx scripts/visual-hd.ts
 */
import {mkdir,readdir,writeFile} from "node:fs/promises";
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
 const trimmed=await sharp(raw).trim({threshold:1}).toBuffer();
 const out=await sharp(trimmed).resize({width:1536,height:1536,fit:"inside",withoutEnlargement:true}).webp({quality:82,alphaQuality:90}).toBuffer();
 await writeFile(path.join(HD,id+".webp"),out);n++;
}
console.log(n,"HD images");
