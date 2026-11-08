/**
 * «زیباسازی» (owner, 2026-11-08): one package that turns an everyday photo of a person into an editorial one that they love to share, with slight,
 * natural changes only: the same person, the same place, the same outfit, hairstyle and beard style. Whoush first recognises what the photo needs
 * (the vision step in lib/reference-inspect.ts names the issues it sees, part by part), offers the card only when the user is trying to look better
 * (lib/orchestrator.ts), and writes one structured brief from the parts left on and the issues found. Pure: the studio shows it, the server writes it.
 */
import {normalizePersian} from "./safety";

/** The package's name in the interface (owner, 2026-11-08: «زیباسازی» is «زیباسازی» in Persian). */
export const BEAUTIFY_NAME="زیباسازی";
/** The parts, in the card's order (the owner's list, 2026-11-08). */
export const BEAUTIFY_PARTS=["camera","pose","light","skin","grooming","shape","clothes","background","color"] as const;
export type BeautifyPart=typeof BEAUTIFY_PARTS[number];
export const BEAUTIFY_PART_FA:Record<BeautifyPart,string>={camera:"اصلاح لنز، کادر و فوکوس",pose:"حالت بدن و چهره",light:"نور",skin:"پوست",
 grooming:"مو، ریش و ابرو",shape:"فرم و اجزای صورت (ظریف)",clothes:"لباس",background:"زمینه",color:"رنگ و تنظیمات عکس"};
/** A person who looks under 18 gets the photo-craft parts only: nothing on the face, body or grooming. */
export const BEAUTIFY_PARTS_MINOR:readonly BeautifyPart[]=["camera","light","clothes","background","color"];
/** One thing the vision step saw in the photo, for one part: shown under its switch (Persian) and given to the model (English). */
export type BeautifyIssue={part:BeautifyPart;noteFa:string;noteEn:string};

/** The offer, under the card's title. */
export const BEAUTIFY_OFFER_FA="با «زیباسازی» این عکس رو آماده‌ی انتشار می‌کنم، طبیعی و با همون حس‌وحال؛ هر بخشی رو نخوای خاموشش کن.";
export const BEAUTIFY_OFFER_FINGLISH="Ba \"Zibasazi\" in akso ba taghirhaye zarif o tabiee editorial mikonam: khodet, hamunja, ba hamun lebas o hamun model mu o rish; faghat behtarin noskhash. Inha ro tuye aks didam; har kodum ro nakhay khamushesh kon.";
/** Under the switches for a person who looks under 18. */
export const BEAUTIFY_MINOR_FA="برای این عکس فقط لنز و کادر، نور، لباس و رنگ بهتر می‌شه.";
export const BEAUTIFY_GO_FA="زیباسازی کن";
/** Turning the offer down (owner, 2026-11-08). */
export const BEAUTIFY_SKIP_FA="لازم نیست";

/** Words of someone trying to look better in their photo (a hint; the vision step decides too). */
const WORDS=["خوشگلم کن","خوشگلش کن","خوشگل ترم کن","خوشگلترم کن","خوشگل ترش کن","خوشگلترش کن","زیبام کن","زیباترم کن","زیباترش کن","جذاب ترم کن","جذابترم کن",
 "بهترم کن","عکسمو بهتر کن","عکسم رو بهتر کن","عکسمو حرفه ای کن","حرفه ای ترش کن","حرفه ای ترم کن","مثل عکس مجله","مثل مجله","مجله ای","ادیتوریال","ووگ","مثل مدل ها","مثل مدلا",
 "عکس پروفایل حرفه ای","بی نقص","زیباسازی","گلو آپ","گلوآپ","روتوش حرفه ای","روتوش کامل","سلفیمو","سلفیم رو","beautify","glow up","glowup","make me look better","look better","editorial","vogue",
 "professional portrait","professional headshot","headshot","make me pretty","make me beautiful","make me handsome","make it look professional","fix my photo","fix my selfie"];
export function wantsBeautify(text:string):boolean{
 const t=" "+normalizePersian(text).toLowerCase()+" ";
 return WORDS.some(w=>t.includes(normalizePersian(w).toLowerCase()));
}

/** Each part as a professional instruction (on), and what stays when it is off. Every one slight and natural (owner, 2026-11-08). */
const ON:Record<BeautifyPart,string>={
 camera:"CAMERA: undo the low/high angle and close wide lens that deform the face: a slight move to eye level, 85 mm look, a perspective warp of the face to its true shape. One camera for the whole frame: the background's horizon, lines and vanishing points match the new viewpoint, never a person on the old background. Head keeps its turn; level, centred; focus on the eyes, f/2.8.",
 pose:"POSE: keep the face's emotion, refined into a slight model gesture: eyes to the lens with a slight squinch, chin a touch forward and down, gentle tilt, relaxed angled shoulders; confident, never sexualised.",
 light:"LIGHT: soften harsh, top or back light; soft frontal fill on face and eyes, even flattering exposure, catchlights.",
 skin:"SKIN: even tone, no shine; acne, bumps, blemishes and irregular or enlarged pores polished away; tired under-eyes rested; natural fine pores and texture kept.",
 grooming:"GROOMING: hair cleanly brushed and styled, neat edges, no flyaways; thinning filled with the hairline unchanged. Beard freshly barber-trimmed to an even length; the upper cheeks above the beard line (stray stubble included) and the neck below the neckline clean-shaven and smooth, crisp lines; same style. Brows shaped.",
 shape:"FACE: within their features: less puffiness, a natural defined jawline; the nose visibly but naturally refined (a slimmer bridge, a neater, slightly lifted tip, in proportion with the face); lips even.",
 clothes:"CLOTHES: same garment, freshly laundered and steamed: no lint, hair or creases.",
 background:"BACKGROUND: the same place made presentable: clutter, mess, rubbish, cables and stray unwanted objects removed; layout, main objects, colours and light kept.",
 color:"COLOUR: natural pro grade in the photo's mood: balanced exposure and contrast, richer true colour, recovered highlights, lifted shadows."
};
const OFF:Record<BeautifyPart,string>={
 camera:"Camera: the same angle, lens and focus.",pose:"Posture and expression: exactly as in the photo.",light:"Light: the photo's own light.",
 skin:"Skin: as in the photo.",grooming:"Hair, beard and brows: as in the photo.",shape:"Face and features: exactly as in the photo.",
 clothes:"Clothes: exactly as in the photo.",background:"Background: as in the photo.",color:"Colour: the photo's own colours."
};

/**
 * The provider brief for a Beautify edit of one photo (`ref`: how the prompt names it, «[reference image 1 · #تصویر-۱]»): identity, place, outfit,
 * hairstyle and beard style are locked; each chosen part is a professional instruction with what was seen in this photo; every other part stays.
 * `minor` keeps it to the photo-craft parts, whatever was chosen.
 */
export function beautifyPrompt(ref:string,parts:readonly BeautifyPart[],issues:readonly BeautifyIssue[]=[],minor=false):string{
 const on=new Set(parts.filter(p=>!minor||BEAUTIFY_PARTS_MINOR.includes(p)));
 // What was seen, in a few words per part (the brief stays within the plan's 3,000-character prompt).
 const short=(t:string)=>{const x=t.trim().replace(/[.;\s]+$/,"");if(x.length<=40)return x;const c=x.slice(0,40);return c.slice(0,Math.max(c.lastIndexOf(" "),20)).replace(/[,;\s]+$/,"");};
 const seen=(p:BeautifyPart)=>{const n=issues.filter(i=>i.part===p).map(i=>short(i.noteEn)).filter(Boolean);return n.length?" Seen: "+n.join("; ")+".":"";};
 return ["TASK: EDITORIAL BEAUTIFY of "+ref+": a pro photographer's and retoucher's version of this photo. Every fix below done fully and visibly, all natural.",
  "GOAL: social-media ready, they proudly post it for likes. Ask before finishing: would I share it? Beautiful? Still them? All three yes.",
  "MOOD: keep the vibe: same moment, setting and background in view, same daylight and colour mood, their own expression.",
  "KEEP: identity (bones, eye shape and colour, skin tone, marks, age), hairline, hairstyle, beard style, outfit, place.",
  "NEVER GUESS: invent nothing hidden: no hidden side of the face or head, no teeth if the mouth is closed, no opening closed eyes.",
  "REAL: a real photograph, never CGI, plastic or airbrushed skin: full detail and sharpness, every pore and fine texture kept, no pixelation, smearing or blur.",
  ...BEAUTIFY_PARTS.map(p=>on.has(p)?ON[p]+seen(p):OFF[p])].join("\n");
}

/** The user's request as sent from the card (it is their message in the chat): «#تصویر-۱ رو Beautify it کن: نور، رنگ…». */
export function beautifyRequestFa(tagFa:string,parts:readonly BeautifyPart[]):string{
 return tagFa+" رو "+BEAUTIFY_NAME+" کن: "+parts.map(p=>BEAUTIFY_PART_FA[p]).join("، ");
}

/**
 * The parts offered: only those the photo needs (owner, 2026-11-08: "it can be only the light, or the camera, or several"), or all of them when nothing
 * specific was found.
 */
export function startingParts(issues:readonly BeautifyIssue[],minor:boolean):BeautifyPart[]{
 const allowed=minor?BEAUTIFY_PARTS_MINOR:BEAUTIFY_PARTS,need=new Set<BeautifyPart>(issues.map(i=>i.part));
 return BEAUTIFY_PARTS.filter(p=>allowed.includes(p)&&(!issues.length||need.has(p)));
}

/** «زیباسازی» offered on a photo: the parts the card starts with, the note under each (what the photo check saw), and the under-18 limit. */
export type BeautifyOffer={tag:string;parts:BeautifyPart[];notes?:Partial<Record<BeautifyPart,string>>;minor?:true};
export function beautifyOffer(tag:string,issues:readonly BeautifyIssue[],minor:boolean):BeautifyOffer{
 const notes=Object.fromEntries(issues.map(i=>[i.part,i.noteFa]));
 return {tag,parts:startingParts(issues,minor),...(issues.length?{notes}:{}),...(minor?{minor:true as const}:{})};
}
/** An offer as it arrives from the server (the photo check or a turn), checked: known parts only, short notes, the under-18 flag; else undefined. */
export function parseBeautifyOffer(v:unknown):Omit<BeautifyOffer,"tag">|undefined{
 if(typeof v!=="object"||v===null)return undefined;const o=v as {parts?:unknown;notes?:unknown;minor?:unknown};
 if(!Array.isArray(o.parts)||!o.parts.length||!o.parts.every(p=>(BEAUTIFY_PARTS as readonly unknown[]).includes(p)))return undefined;
 const notes=typeof o.notes==="object"&&o.notes!==null?Object.fromEntries(Object.entries(o.notes as Record<string,unknown>).filter(([k,n])=>(BEAUTIFY_PARTS as readonly string[]).includes(k)&&typeof n==="string"&&n.length<=120)):{};
 return {parts:[...new Set(o.parts as BeautifyPart[])],...(Object.keys(notes).length?{notes:notes as Partial<Record<BeautifyPart,string>>}:{}),...(o.minor===true?{minor:true as const}:{})};
}
/** On upload (owner, 2026-11-08): Whoush saw this photo can look much better, and offers to edit it first. */
export const BEAUTIFY_UPLOAD_FA="این عکس رو دیدم؛ قبل از هر کاری می‌تونم با «زیباسازی» آماده‌ی انتشارش کنم، طبیعی و با همون حس‌وحال.";

/**
 * The card's switches (owner, 2026-11-08: "not a long checklist; very generic, so users are not overwhelmed"): four general groups over the eight parts.
 * The detailed findings still go into the brief; the card says only what it saw, in one line.
 */
export const BEAUTIFY_GROUPS=[
 // The owner's wording (2026-11-08); `seenFa` is the short name in the line of what was seen.
 {id:"face",labelFa:"اصلاح چهره و پوست",seenFa:"چهره و پوست",parts:["skin","shape","grooming"]},
 {id:"pose",labelFa:"اصلاح ژست و زاویه",seenFa:"ژست و زاویه",parts:["camera","pose"]},
 {id:"light",labelFa:"اصلاح نور و رنگ",seenFa:"نور و رنگ",parts:["light","color"]},
 {id:"clothes",labelFa:"مرتب‌سازی لباس و زمینه",seenFa:"لباس و زمینه",parts:["clothes","background"]}
] as const satisfies readonly {id:string;labelFa:string;seenFa:string;parts:readonly BeautifyPart[]}[];
export type BeautifyGroup=typeof BEAUTIFY_GROUPS[number];
/** One short line of what Whoush saw, by group: «توی عکست دیدم چهره و پوست، نور و رنگ و لباس جای بهتر شدن دارن.» */
export function beautifySeenFa(notes:Partial<Record<BeautifyPart,string>>|undefined):string|undefined{
 const g=BEAUTIFY_GROUPS.filter(x=>(x.parts as readonly BeautifyPart[]).some(p=>notes?.[p])).map(x=>x.seenFa);
 if(!g.length)return undefined;
 return "توی عکست دیدم "+(g.length===1?g[0]:g.slice(0,-1).join("، ")+" و "+g[g.length-1])+" جای بهتر شدن "+(g.length===1?"داره":"دارن")+".";
}
