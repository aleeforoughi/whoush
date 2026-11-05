/**
 * One-time generator for the plan-diagram asset pack (docs/VISUAL_ASSETS.md). Each object is its own transparent PNG in one consistent style, so diagrams are
 * composed and rearranged in code (position, scale, mirror) without regenerating. Generated once with OpenAI's image model, trimmed and resized with sharp,
 * saved to public/visuals/ and committed. Re-run only to replace the pack (or one asset: pass its id), never at runtime.
 *
 *   node --import tsx scripts/generate-visual-assets.ts [asset-id ...]
 *
 * Needs OPENAI_API_KEY (development only; never shipped). Raw outputs go to public/visuals/raw/ (git-ignored).
 */
import {mkdir,readFile,writeFile} from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const MODEL=process.env.VISUALS_IMAGE_MODEL??"gpt-image-1.5";
const STYLE="Isolated single object, 3D render in a soft matte clay style with a subtle satin sheen, light neutral grey-white material (#d9dadd), gentle soft studio lighting from the upper left with soft ambient occlusion, smooth rounded simplified forms, no texture noise, no text, no logo, no face details, no background, fully transparent background, no ground, no cast shadow, no reflection, centered with generous margins, clean silhouette. Minimal premium product-UI illustration style.";
/**
 * `person-side` is the style anchor: every other asset is generated from it (and from `ref`, an earlier asset of the same family) so material, colour, sheen,
 * lighting and level of simplification match across the pack. The list is in dependency order.
 */
export const ANCHOR="person-side";
export const ASSETS:{id:string;ref?:string;prompt:string;size:"1024x1024"|"1024x1536"|"1536x1024"}[]=[
 {id:"person-side",size:"1024x1536",prompt:"A stylized faceless mannequin person standing upright, seen exactly from the side (profile, facing right), full body from head to feet: a smooth sphere head, a rounded capsule torso with the arm resting along the side, two straight rounded legs together. Neutral pose."},
 {id:"person-front",ref:"person-side",size:"1024x1536",prompt:"A stylized faceless mannequin person standing upright, seen exactly from the front, full body from head to feet: a smooth sphere head, a rounded capsule torso with arms resting along the sides, two straight rounded legs slightly apart. Neutral pose, symmetrical."},
 {id:"person-top",ref:"person-front",size:"1024x1024",prompt:"The same faceless mannequin seen from DIRECTLY OVERHEAD like a floor plan, camera looking straight down: only the top of the round head in the centre and the two rounded shoulders forming a wide oval around it; no face, no arms below the shoulders, no legs, no feet visible. A tiny rounded nose bump on the head points toward the bottom edge."},
 {id:"camera-side",size:"1536x1024",prompt:"A compact modern cinema camera seen exactly from the side, the lens pointing straight to the LEFT: a rounded rectangular body, a small top handle, a short lens barrel with a flared lens hood on the left side."},
 {id:"camera-top",ref:"camera-side",size:"1024x1024",prompt:"A compact modern cinema camera seen exactly from directly above (top-down orthographic view), the lens pointing straight UP toward the top edge: rounded rectangular body, a short lens barrel with a flared lens hood at the top."},
 {id:"object-side",size:"1024x1024",prompt:"A simple generic product object seen exactly from the side: a rounded bottle-like vessel with a short neck and a smooth cap, standing upright."},
 {id:"object-top",ref:"object-side",size:"1024x1024",prompt:"The same simple rounded bottle-like product object seen exactly from directly above (top-down orthographic view): a round body with the small round cap in the middle."},
 {id:"animal-side",size:"1536x1024",prompt:"A stylized sitting cat seen exactly from the side, facing right, simple smooth rounded forms, small rounded ears, tail curled around the paws."},
 {id:"animal-top",ref:"animal-side",size:"1024x1024",prompt:"A stylized curled-up cat seen exactly from directly above (top-down orthographic view), simple smooth rounded forms, head toward the bottom edge."},
 {id:"vehicle-side",size:"1536x1024",prompt:"A stylized compact modern car seen exactly from the side, facing right, smooth rounded toy-like forms, simple round wheels, no logos."},
 {id:"vehicle-top",ref:"vehicle-side",size:"1024x1536",prompt:"A stylized compact modern car seen exactly from directly above (top-down orthographic view), the front pointing down toward the bottom edge, smooth rounded toy-like forms, no logos."},
 {id:"env-mountains",size:"1536x1024",prompt:"A stylized wide mountain range of three smooth rounded peaks of different heights, seen from the front at eye level, soft simplified forms, flat bottom edge."},
 {id:"env-tree",ref:"env-mountains",size:"1024x1536",prompt:"A stylized simple tree with a smooth rounded lollipop-like canopy and a short straight trunk, seen from the side."},
 {id:"env-building",ref:"env-tree",size:"1024x1536",prompt:"A stylized simple modern building block, a rounded tall box with a few rounded rectangular windows, seen from the front three-quarter."},
 {id:"env-top",ref:"env-building",size:"1024x1024",prompt:"A small stylized landscape scene seen exactly from directly above (top-down orthographic view): three rounded tree canopies and one small rounded square building roof, arranged in a loose cluster."},
 {id:"tree-top",ref:"env-tree",size:"1024x1024",prompt:"The same single stylized tree seen exactly from directly above (top-down orthographic view): one round fluffy canopy, no trunk visible."},
 {id:"building-top",ref:"env-building",size:"1024x1024",prompt:"The same single stylized building seen exactly from directly above (top-down orthographic view): a rounded rectangular flat roof with a small rooftop box."},
 {id:"light-softbox",size:"1024x1024",prompt:"A photography softbox light on a short stand, seen from the front three-quarter: a square diffuser panel glowing softly warm white, rounded edges."},
 {id:"light-led-panel",ref:"light-softbox",size:"1024x1024",prompt:"A flat rectangular LED panel light on a small yoke mount, seen from the front three-quarter, the panel face glowing softly white."},
 {id:"light-practical",ref:"light-softbox",size:"1024x1024",prompt:"A small modern table lamp with a rounded shade, the bulb glowing warm amber inside the shade."},
 {id:"light-window",ref:"light-softbox",size:"1024x1024",prompt:"A tall simple window frame with four panes, soft daylight glowing through the panes, rounded frame edges."},
 {id:"light-neon",ref:"light-softbox",size:"1024x1024",prompt:"A curved neon light tube shaped like a gentle wave, glowing soft electric blue, mounted on small clear clips."},
 {id:"light-flash",ref:"light-softbox",size:"1024x1024",prompt:"A speedlight camera flash unit seen from the front three-quarter, the flash head glowing bright white."},
 {id:"light-sun",ref:"light-softbox",size:"1024x1024",prompt:"A stylized sun: a glowing soft warm yellow-orange sphere with a gentle halo, no rays, no face."},
 {id:"light-moon",ref:"light-sun",size:"1024x1024",prompt:"A stylized crescent moon, soft cool blue-white glow, smooth surface, no face."},
 {id:"light-sky",ref:"light-sun",size:"1024x1024",prompt:"A stylized soft fluffy cloud with a gentle cool daylight glow behind it."},
 {id:"light-fire",ref:"light-sun",size:"1024x1024",prompt:"A stylized small campfire flame, soft rounded flame shapes glowing warm orange, on two small rounded logs."}
];
const OUT=path.join(process.cwd(),"public","visuals"),RAW=path.join(OUT,"raw");

const REF_PREFIX="Use the reference image(s) ONLY as the style guide: match exactly their clay material, light grey-white colour, satin sheen, soft lighting from the upper left, ambient occlusion, level of simplification and rounded forms, so this new image belongs to the same set. Do not copy their subject unless asked. Create: ";
async function readRaw(id:string):Promise<Blob>{return new Blob([new Uint8Array(await readFile(path.join(RAW,id+".png")))],{type:"image/png"});}
/** The anchor itself is generated from text; every other asset from the anchor (and its family reference) through the edits endpoint. */
async function generate(a:(typeof ASSETS)[number]):Promise<Buffer>{
 const common={model:MODEL,size:a.size,background:"transparent",output_format:"png",quality:"high"};
 let res:Response;
 if(a.id===ANCHOR){
  res=await fetch("https://api.openai.com/v1/images/generations",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+process.env.OPENAI_API_KEY},
   body:JSON.stringify({...common,prompt:a.prompt+" "+STYLE,n:1})});
 }else{
  const form=new FormData();
  for(const [k,v] of Object.entries(common))form.append(k,v);
  form.append("input_fidelity","high");
  form.append("prompt",REF_PREFIX+(a.ref&&a.ref!==ANCHOR?"(the second reference is the same family; when this is another view of the same object, keep its exact design) ":"")+a.prompt+" "+STYLE);
  form.append("image[]",await readRaw(ANCHOR),ANCHOR+".png");
  if(a.ref&&a.ref!==ANCHOR)form.append("image[]",await readRaw(a.ref),a.ref+".png");
  res=await fetch("https://api.openai.com/v1/images/edits",{method:"POST",headers:{Authorization:"Bearer "+process.env.OPENAI_API_KEY},body:form});
 }
 const body=await res.json() as {data?:{b64_json?:string}[];error?:{message?:string}};
 if(!res.ok||!body.data?.[0]?.b64_json)throw new Error(a.id+": "+(body.error?.message??res.status));
 return Buffer.from(body.data[0].b64_json,"base64");
}
/** Trims the transparent margin, fits the object in 640px on its long side and saves an optimized PNG; returns the final size for the manifest. */
async function finish(id:string,raw:Buffer):Promise<{width:number;height:number}>{
 const trimmed=await sharp(raw).trim({threshold:1}).toBuffer();
 const out=await sharp(trimmed).resize({width:640,height:640,fit:"inside",withoutEnlargement:true}).png({compressionLevel:9,palette:false}).toBuffer();
 await writeFile(path.join(OUT,id+".png"),out);
 const m=await sharp(out).metadata();
 return {width:m.width!,height:m.height!};
}
async function main(){
 if(!process.env.OPENAI_API_KEY)throw new Error("OPENAI_API_KEY is not set");
 await mkdir(RAW,{recursive:true});
 const only=process.argv.slice(2),list=only.length?ASSETS.filter(a=>only.includes(a.id)):ASSETS;
 const sizes:Record<string,{width:number;height:number}>={};
 for(const a of list){
  const raw=await generate(a);
  await writeFile(path.join(RAW,a.id+".png"),raw);
  sizes[a.id]=await finish(a.id,raw);
  console.log(a.id,sizes[a.id]);
 }
 console.log(JSON.stringify(sizes));
}
main().catch(e=>{console.error(e instanceof Error?e.message:e);process.exit(1);});
