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
export const BEAUTIFY_PARTS=["camera","pose","light","skin","grooming","shape","clothes","color"] as const;
export type BeautifyPart=typeof BEAUTIFY_PARTS[number];
export const BEAUTIFY_PART_FA:Record<BeautifyPart,string>={camera:"اصلاح لنز، کادر و فوکوس",pose:"حالت بدن و چهره",light:"نور",skin:"پوست",
 grooming:"مو، ریش و ابرو",shape:"فرم صورت و فک (خیلی کم)",clothes:"لباس",color:"رنگ و تنظیمات عکس"};
/** A person who looks under 18 gets the photo-craft parts only: nothing on the face, body or grooming. */
export const BEAUTIFY_PARTS_MINOR:readonly BeautifyPart[]=["camera","light","clothes","color"];
/** One thing the vision step saw in the photo, for one part: shown under its switch (Persian) and given to the model (English). */
export type BeautifyIssue={part:BeautifyPart;noteFa:string;noteEn:string};

/** The offer, under the card's title. */
export const BEAUTIFY_OFFER_FA="با «زیباسازی» این عکس رو با تغییرهای ظریف و طبیعی ادیتوریال می‌کنم: خودت، همون‌جا، با همون لباس و همون مدل مو و ریش؛ فقط بهترین نسخه‌ش. این‌ها رو توی عکس دیدم؛ هر کدوم رو نخوای خاموشش کن.";
export const BEAUTIFY_OFFER_FINGLISH="Ba \"Zibasazi\" in akso ba taghirhaye zarif o tabiee editorial mikonam: khodet, hamunja, ba hamun lebas o hamun model mu o rish; faghat behtarin noskhash. Inha ro tuye aks didam; har kodum ro nakhay khamushesh kon.";
/** Under the switches for a person who looks under 18. */
export const BEAUTIFY_MINOR_FA="برای این عکس فقط لنز و کادر، نور، لباس و رنگ بهتر می‌شه.";
export const BEAUTIFY_GO_FA="زیباسازی کن";

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
 camera:"CAMERA AND LENS: the same viewpoint: the same camera position, height and angle, the same head angle and turn, the same background composition. Correct only the optical errors of a close phone lens: remove the wide-angle distortion (the widened face, the enlarged chin, jaw or nose nearest the lens), so the face has its true proportions; level the frame slightly and centre the face, balanced and ready to share. Never re-shoot from another angle or height, never rotate the head, never show any side of the face, head or hair that is not visible. Slight refocus: focus on the eyes and a slightly wider aperture (around f/2.8), so the background softens a little while staying recognisable.",
 pose:"POSTURE AND EXPRESSION: slightly more relaxed and confident: shoulders relaxed and level, neck long, a calm, engaged look. The head keeps its own angle; the mouth stays as it is (closed stays closed: never show teeth that are not visible), the eyes stay as they are (closed or half-closed eyes stay so: never open them or change their shape or colour), and no new smile; only small changes to what is already visible.",
 light:"LIGHT: clearly better light on the person: soften harsh, top or back light; open the shadows on the face, eye sockets and neck with a soft fill as from a large window or softbox in front; an even, flattering exposure across the face; a soft catchlight in the eyes; a natural falloff. The light stays plausible for this place and time of day.",
 skin:"SKIN: a clean, polished, natural finish: even out redness and uneven tone, remove shine, soften temporary blemishes and under-eye darkness, while pores and fine skin texture stay fully visible (never smooth, blurred or plastic).",
 grooming:"HAIR, BEARD AND BROWS: freshly groomed in the same style: hair neatly brushed with tidy edges and no flyaways, slightly fuller only where it is visibly thinning, the same hairline shape and length; the beard the same style, length and colour (grey hairs kept), freshly trimmed with clean, defined cheek and neck lines and every stray hair removed; eyebrows tidied, stray hairs between and under them removed, the same shape and thickness.",
 shape:"FACE SHAPE: a very slight refinement only: the face a touch less wide and the jawline a little more defined, at most a few percent; the person stays instantly recognisable.",
 clothes:"CLOTHES: the same garment, colour and fit, freshly cleaned and pressed: every bit of lint, hair, fluff and dust removed, creases smoothed, the fabric's colour even and deep.",
 color:"COLOUR SETTINGS: a professional, clearly improved but natural grade: balanced brightness and exposure, refined contrast, slightly richer but true saturation, highlights recovered, shadows lifted, gentle clarity and sharpness, a subtle HDR balance between face and bright background, true-to-life skin tones; no heavy filter."
};
const OFF:Record<BeautifyPart,string>={
 camera:"Camera: the same angle, lens and focus.",pose:"Posture and expression: exactly as in the photo.",light:"Light: the photo's own light.",
 skin:"Skin: as in the photo.",grooming:"Hair, beard and brows: as in the photo.",shape:"Face shape: exactly as in the photo.",
 clothes:"Clothes: exactly as in the photo.",color:"Colour: the photo's own colours."
};

/**
 * The provider brief for a Beautify edit of one photo (`ref`: how the prompt names it, «[reference image 1 · #تصویر-۱]»): identity, place, outfit,
 * hairstyle and beard style are locked; each chosen part is a professional instruction with what was seen in this photo; every other part stays.
 * `minor` keeps it to the photo-craft parts, whatever was chosen.
 */
export function beautifyPrompt(ref:string,parts:readonly BeautifyPart[],issues:readonly BeautifyIssue[]=[],minor=false):string{
 const on=new Set(parts.filter(p=>!minor||BEAUTIFY_PARTS_MINOR.includes(p)));
 const seen=(p:BeautifyPart)=>{const n=issues.filter(i=>i.part===p).map(i=>i.noteEn.trim()).filter(Boolean);return n.length?" Seen in this photo: "+n.join("; ")+".":"";};
 return ["TASK: EDITORIAL BEAUTIFY EDIT of "+ref+": the same photo, retouched and refined by a professional photographer and retoucher, so that the person loves to share it. Carry out every fix below completely and cleanly, so the improvement is obvious side by side with the original, while the result stays natural and true to the person: the same moment, photographed and retouched by a professional. Only identity, face shape and expression stay at most slightly changed.",
  "KEEP (never changes): the person's identity and face (bone structure, eyes, nose, lips, skin tone, marks, age), their hairstyle and beard style, the outfit and accessories, the camera's viewpoint, and the place: the same background with the same objects, lines, sky and composition (only lit, graded and softened slightly).",
  "NEVER GUESS (owner, 2026-11-08): change only what the photo shows. Nothing that is not visible is invented: no new head or face angle, no teeth when the mouth is closed, no opened eyes when they are closed, no hidden ear, side of the face or hair revealed. When unsure whether something is visible, keep that part as it is.",
  ...BEAUTIFY_PARTS.map(p=>on.has(p)?ON[p]+seen(p):OFF[p]),
  "QUALITY: photoreal, sharp eyes, real skin texture and pores, believable light and anatomy; no over-smoothing, no AI look, no text or watermark.",
  "OUTPUT: one photo of the same person in the same place, editorially refined as above."].join("\n");
}

/** The user's request as sent from the card (it is their message in the chat): «#تصویر-۱ رو Beautify it کن: نور، رنگ…». */
export function beautifyRequestFa(tagFa:string,parts:readonly BeautifyPart[]):string{
 return tagFa+" رو "+BEAUTIFY_NAME+" کن: "+parts.map(p=>BEAUTIFY_PART_FA[p]).join("، ");
}

/** The parts the card starts with: those the photo needs (and the colour, which every photo gets), or all of them when nothing was listed. */
export function startingParts(issues:readonly BeautifyIssue[],minor:boolean):BeautifyPart[]{
 const allowed=minor?BEAUTIFY_PARTS_MINOR:BEAUTIFY_PARTS,need=new Set([...issues.map(i=>i.part),"color" as const]);
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
export const BEAUTIFY_UPLOAD_FA="این عکس رو دیدم؛ با «زیباسازی» می‌تونم قبل از هر کاری حرفه‌ای و ادیتوریالش کنم، با تغییرهای ظریف و طبیعی. این‌ها رو توش دیدم:";
