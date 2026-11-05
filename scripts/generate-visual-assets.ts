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
import {pathToFileURL} from "node:url";
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
 {id:"person-3q",ref:"person-front",size:"1024x1536",prompt:"The same faceless mannequin person standing upright, full body from head to feet, seen in a THREE-QUARTER view: the body turned 45 degrees so its front faces toward the viewer's RIGHT (we see the front and the left side of the body), arms resting along the sides, legs together. Neutral pose."},
 {id:"person-top",ref:"person-front",size:"1024x1024",prompt:"The same faceless mannequin seen from DIRECTLY OVERHEAD like a floor plan, camera looking straight down: only the top of the round head in the centre and the two rounded shoulders forming a wide oval around it; no face, no arms below the shoulders, no legs, no feet visible. A tiny rounded nose bump on the head points toward the bottom edge."},
 {id:"animal-3q",ref:"animal-side",size:"1024x1024",prompt:"The same stylized sitting cat in a THREE-QUARTER view: turned 45 degrees so its face and chest point toward the viewer's RIGHT (we see the front and the left side), simple smooth rounded forms, small rounded ears, tail curled around the paws."},
 {id:"vehicle-3q",ref:"vehicle-side",size:"1536x1024",prompt:"The same stylized compact modern car in a front THREE-QUARTER view: turned 45 degrees so its front points toward the viewer's RIGHT (we see the front with its round headlights and the left side), smooth rounded toy-like forms, simple round wheels, no logos."},
 {id:"vehicle-3q-rear",ref:"vehicle-side",size:"1536x1024",prompt:"The same stylized compact modern car in a rear THREE-QUARTER view: turned 45 degrees so its rear points toward the viewer's LEFT and its front away to the right (we see the back with its tail lights and the right side), smooth rounded toy-like forms, simple round wheels, no logos."},
 // The person with grey hair, so the back of the head reads differently from the face side (the face itself stays smooth and featureless).
 {id:"human-side",ref:"person-side",size:"1024x1536",prompt:"The same faceless mannequin person standing upright, seen exactly from the side, the body facing to the RIGHT (chest, toes and the face side of the head toward the right edge), full body from head to feet, arms along the sides. It has short smooth sculpted hair in a medium GREY clay (clearly darker than the body, about #8a8d93), like a rounded cap covering the top and the BACK of the head (on the LEFT side of the head in this view); the face side of the head stays bare and smooth."},
 {id:"human-front",ref:"human-side",size:"1024x1536",prompt:"The same grey-haired faceless mannequin person standing upright, seen exactly from the FRONT, full body, arms along the sides, legs slightly apart, symmetrical. The short smooth sculpted hair in a medium GREY clay (clearly darker than the body, about #8a8d93), like a rounded cap shows only as a thin rim on the top of the head; the whole face area is bare, smooth and featureless."},
 {id:"human-back",ref:"human-side",size:"1024x1536",prompt:"The same grey-haired faceless mannequin person standing upright, seen exactly from BEHIND, full body, arms along the sides, legs slightly apart, symmetrical. The back of the head is fully covered by the short smooth sculpted hair in a medium GREY clay (clearly darker than the body, about #8a8d93), like a rounded cap, down to the neck."},
 {id:"human-3q",ref:"human-front",size:"1024x1536",prompt:"The same grey-haired faceless mannequin person standing upright, full body, in a FRONT THREE-QUARTER view: turned 45 degrees so its front faces toward the viewer's RIGHT (we see the bare face side and the front of the body, plus its left side). The short smooth sculpted hair in a medium GREY clay (clearly darker than the body, about #8a8d93), like a rounded cap covers the top and the back-left of the head."},
 {id:"human-3q-back",ref:"human-back",size:"1024x1536",prompt:"The same grey-haired faceless mannequin person standing upright, full body, in a REAR THREE-QUARTER view: we see its back and its right side, its front turned away toward the upper RIGHT. Most of the visible head is covered by the short smooth sculpted hair in a medium GREY clay (clearly darker than the body, about #8a8d93), like a rounded cap."},
 {id:"human-top",ref:"human-back",size:"1024x1024",prompt:"The same grey-haired mannequin seen from DIRECTLY OVERHEAD like a floor plan: the round head in the centre covered by the short smooth sculpted hair in a medium GREY clay (clearly darker than the body, about #8a8d93), like a rounded cap, except a small bare crescent of the face side toward the BOTTOM edge; the two rounded shoulders form a wide oval around it. No arms below the shoulders, no legs."},
 // A woman, in the same set: the same faceless mannequin with a slimmer, softer figure and shoulder-length grey hair, so a man and a woman read apart.
 {id:"woman-side",ref:"human-side",size:"1024x1536",prompt:"The same faceless mannequin style but a WOMAN: a slightly slimmer, softer figure, standing upright, seen exactly from the side, the body facing to the LEFT (face side of the head, chest and toes toward the left edge), arms along the sides, full body. longer smooth sculpted hair in the same medium GREY clay (about #8a8d93), a rounded shoulder-length bob that clearly reads as a woman's hairstyle, covering the top and back of the head (on the RIGHT side of the head in this view); the face side stays bare and smooth."},
 {id:"woman-front",ref:"human-front",size:"1024x1536",prompt:"The same faceless mannequin style but a WOMAN: a slightly slimmer, softer figure, standing upright, seen exactly from the FRONT, symmetrical, arms along the sides. longer smooth sculpted hair in the same medium GREY clay (about #8a8d93), a rounded shoulder-length bob that clearly reads as a woman's hairstyle, framing the bare, smooth, featureless face."},
 {id:"woman-back",ref:"human-back",size:"1024x1536",prompt:"The same faceless mannequin style but a WOMAN: a slightly slimmer, softer figure, standing upright, seen exactly from BEHIND, symmetrical, arms along the sides. longer smooth sculpted hair in the same medium GREY clay (about #8a8d93), a rounded shoulder-length bob that clearly reads as a woman's hairstyle, fully covering the back of the head down to the shoulders."},
 {id:"woman-3q",ref:"human-3q",size:"1024x1536",prompt:"The same faceless mannequin style but a WOMAN: a slightly slimmer, softer figure, standing upright, in a FRONT THREE-QUARTER view turned 45 degrees so its front faces toward the viewer's LEFT (we see the bare face side and the front of the body). longer smooth sculpted hair in the same medium GREY clay (about #8a8d93), a rounded shoulder-length bob that clearly reads as a woman's hairstyle."},
 {id:"woman-3q-back",ref:"human-3q-back",size:"1024x1536",prompt:"The same faceless mannequin style but a WOMAN: a slightly slimmer, softer figure, standing upright, in a REAR THREE-QUARTER view: we see her back, her front turned away toward the upper LEFT. longer smooth sculpted hair in the same medium GREY clay (about #8a8d93), a rounded shoulder-length bob that clearly reads as a woman's hairstyle, covering most of the visible head."},
 {id:"woman-top",ref:"human-top",size:"1024x1024",prompt:"The same mannequin WOMAN seen from DIRECTLY OVERHEAD like a floor plan: the round head in the centre covered by longer smooth sculpted hair in the same medium GREY clay (about #8a8d93), a rounded shoulder-length bob that clearly reads as a woman's hairstyle spreading slightly onto the shoulders, a small bare crescent of the face side toward the BOTTOM edge; narrower rounded shoulders around it. No arms below the shoulders, no legs."},
 // Every angle of the props that look different from each side, so the frame and camera views show exactly how each faces the camera.
 {id:"vehicle-front",ref:"vehicle-3q",size:"1024x1024",prompt:"The same stylized compact modern car seen exactly from the FRONT (head-on, symmetrical): round headlights, a simple grille, the windscreen, both front wheels, smooth rounded toy-like forms, no logos."},
 {id:"vehicle-rear",ref:"vehicle-3q-rear",size:"1024x1024",prompt:"The same stylized compact modern car seen exactly from BEHIND (symmetrical): the rear window, the tail lights, the rear bumper, both rear wheels, smooth rounded toy-like forms, no logos."},
 {id:"animal-front",ref:"animal-3q",size:"1024x1024",prompt:"The same stylized sitting cat seen exactly from the FRONT (symmetrical): its smooth face and chest toward the viewer, both small rounded ears, front paws together, the tail curled at the side."},
 {id:"animal-back",ref:"animal-side",size:"1024x1024",prompt:"The same stylized sitting cat seen exactly from BEHIND (symmetrical): the back of its head with both small rounded ears, its back, and the tail curled on the ground; no face visible."},
 {id:"animal-3q-back",ref:"animal-3q",size:"1024x1024",prompt:"The same stylized sitting cat in a REAR THREE-QUARTER view: we see its back and its right side, its face turned away toward the upper RIGHT (no face visible), the tail curled around."},
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
/**
 * Every camera height (docs/VISUAL_ASSETS.md, «بوم» angle stops): the frame draws each prop at the stop nearest to how the camera sees it, top, high, eye
 * level, low or bottom, from the side it faces (front, 3/4, side, rear 3/4, back; the other side is the mirror): a matrix, every height with every side.
 * Eye level is the side images above; these add top, high, low and bottom (the old straight-down `-top` images stay for the plan views). Each comes from
 * the same side's eye-level image, so its design, facing and style stay the same.
 * Ids: `<family>-<height>-<side>` (`human-high-3q`), or `<family>-<height>-round` for the things that look the same all round (`tree-low-round`).
 */
const HEIGHTS={
 top:"seen from a BIRD'S-EYE VIEW: the camera is high above it, about 80 degrees up, looking almost straight DOWN at it. Very strong downward perspective: we mostly see its top, and the rest of it is steeply foreshortened below.",
 high:"seen from a HIGH ANGLE: the camera is above it, about 35 degrees above, looking DOWN at it. Show this downward perspective clearly: we see more of its top, and its lower parts are foreshortened and smaller.",
 low:"seen from a LOW ANGLE: the camera is below its middle, about 25 degrees below, looking UP at it. Show this upward perspective clearly: its lower parts look larger and closer, we see a little of its undersides, and its top is foreshortened and smaller.",
 bottom:"seen from a dramatic WORM'S-EYE VIEW: the camera lies on the ground right in front of it, looking steeply UP at it (about 55 degrees). Extreme upward perspective: the parts touching the ground are huge in the foreground and we see their undersides, everything converges strongly upward and its top is tiny and far away."
} as const;
const SIDES={front:"seen from the FRONT, symmetrical",["3q"]:"in a FRONT THREE-QUARTER view, turned exactly the same way as the second reference",side:"in exact PROFILE, facing exactly the same way as the second reference",
 ["3q-back"]:"in a REAR THREE-QUARTER view, turned exactly the same way as the second reference",back:"seen from BEHIND, symmetrical"} as const;
type Side=keyof typeof SIDES;
const ANGLED:{family:string;what:string;size:(typeof ASSETS)[number]["size"];eye:Partial<Record<Side,string>>}[]=[
 {family:"human",what:"The same grey-haired faceless mannequin man as the second reference (short smooth sculpted hair in a medium GREY clay like a rounded cap), standing upright, full body from head to feet, arms along the sides,",size:"1024x1536",
  eye:{front:"human-front",["3q"]:"human-3q",side:"human-side",["3q-back"]:"human-3q-back",back:"human-back"}},
 {family:"woman",what:"The same faceless mannequin woman as the second reference (a slimmer, softer figure with a rounded shoulder-length bob in a medium GREY clay), standing upright, full body from head to feet, arms along the sides,",size:"1024x1536",
  eye:{front:"woman-front",["3q"]:"woman-3q",side:"woman-side",["3q-back"]:"woman-3q-back",back:"woman-back"}},
 {family:"vehicle",what:"The same stylized compact modern car as the second reference (smooth rounded toy-like forms, simple round wheels, no logos),",size:"1536x1024",
  eye:{front:"vehicle-front",["3q"]:"vehicle-3q",side:"vehicle-side",["3q-back"]:"vehicle-3q-rear",back:"vehicle-rear"}},
 {family:"animal",what:"The same stylized sitting cat as the second reference (simple smooth rounded forms, small rounded ears, the tail curled around),",size:"1024x1024",
  eye:{front:"animal-front",["3q"]:"animal-3q",side:"animal-side",["3q-back"]:"animal-3q-back",back:"animal-back"}},
 {family:"object",what:"The same simple rounded bottle-like product object as the second reference, standing upright,",size:"1024x1024",eye:{side:"object-side"}},
 {family:"tree",what:"The same single stylized tree as the second reference (a smooth rounded lollipop-like canopy on a short straight trunk),",size:"1024x1536",eye:{side:"env-tree"}},
 {family:"building",what:"The same stylized simple modern building block as the second reference (a rounded tall box with rounded rectangular windows),",size:"1024x1536",eye:{side:"env-building"}}
];
for(const f of ANGLED)for(const h of Object.keys(HEIGHTS) as (keyof typeof HEIGHTS)[]){
 const sides=Object.entries(f.eye) as [Side,string][],round=sides.length===1;
 for(const [side,ref] of sides)ASSETS.push({id:f.family+"-"+h+"-"+(round?"round":side),ref,size:f.size,
  prompt:f.what+" "+(round?"":SIDES[side]+", ")+HEIGHTS[h]+" Keep exactly its design, proportions, colours and level of simplification."});
}
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
// Run only as a script (importing it, to read ASSETS, generates nothing).
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(e=>{console.error(e instanceof Error?e.message:e);process.exit(1);});
