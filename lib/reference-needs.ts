/**
 * Things only a photo can keep: when a brief asks to keep the user's own tattoos, logo, product, face or outfit, Whoush needs a reference of it. Without one,
 * Whoush asks for exactly the photos it needs (the angles), as upload slots in the conversation; with them, it assigns the right role, maps them to the right
 * prop and makes keeping it a hard constraint. Pure: safe in the browser and on the server.
 */
import type {AttachmentRole} from "./attachments";

export type ReferenceNeedId="tattoo"|"logo"|"product"|"face"|"outfit"|"face_angle"|"full_body"|"smile"|"eyes_open";
export type ReferenceAngle={id:string;titleFa:string};
export type ReferenceNeed={
 id:ReferenceNeedId;
 /** What it is, for the card: «تتوها». */titleFa:string;
 /** The role the uploads get. A tattoo is a detail of the person, not their identity: a general reference mapped to the person. */role:AttachmentRole;
 /** The scene prop the photos describe. */mapsTo:"person"|"object";
 /** The photos that let a model keep it: one slot each. */angles:readonly ReferenceAngle[];
 /** Whoush asking for them, in Persian and in Finglish. */askFa:string;askFinglish:string;
 /** The hard constraint once the photos are here (`refs`: their tags as the user sees them, or the provider-facing descriptions). */
 keepFa:(refs:string)=>string;keepEn:(refs:string)=>string;
};

export const REFERENCE_NEEDS:readonly ReferenceNeed[]=[
 {id:"tattoo",titleFa:"تتوها",role:"reference",mapsTo:"person",
  angles:[{id:"close",titleFa:"تتو از نزدیک، روبه‌رو و با نور خوب"},{id:"placement",titleFa:"جای تتو روی بدن (یه نمای بازتر)"}],
  askFa:"حتماً! برای اینکه تتوهات دقیقاً همون بمونن، یکی دو تا عکس ازشون لازم دارم 👇",
  askFinglish:"hatman! baraye inke tattoo-hat daghighan hamoon bemoonan, ye-do ta aks azashoon lazem daram 👇",
  keepFa:r=>"تتوها دقیقاً مثل "+r+" بمانند: همان طرح، همان جا، همان اندازه و رنگ",
  keepEn:r=>"Keep the person's tattoos exactly as in "+r+": the same designs, placement, size and colours."},
 {id:"logo",titleFa:"لوگو",role:"graphic",mapsTo:"object",
  angles:[{id:"flat",titleFa:"فایل یا عکس لوگو، روبه‌رو و واضح"}],
  askFa:"اوکی! برای اینکه لوگو دقیق و بی‌نقص دربیاد، خود لوگو رو برام بفرست 👇",
  askFinglish:"okay! baraye inke logo daghigh dar biad, khod-e logo ro bara-m befrest 👇",
  keepFa:r=>"لوگو دقیقاً مثل "+r+" باشد: همان شکل، رنگ و نوشته",
  keepEn:r=>"Reproduce the logo exactly as in "+r+": the same shapes, colours and lettering."},
 {id:"product",titleFa:"محصول",role:"object",mapsTo:"object",
  angles:[{id:"front",titleFa:"محصول از روبه‌رو"},{id:"three_quarter",titleFa:"محصول از سه‌رخ"},{id:"back",titleFa:"محصول از پشت یا بغل"}],
  askFa:"باشه! برای اینکه محصولت عین خودش دربیاد، چندتا عکس ازش لازمه 👇",
  askFinglish:"bashe! baraye inke mahsool-et eyn-e khodesh dar biad, chand ta aks azash lazeme 👇",
  keepFa:r=>"محصول دقیقاً مثل "+r+" باشد: همان شکل، رنگ، برچسب و جزئیات",
  keepEn:r=>"Keep the product exactly as in "+r+": the same shape, colours, label and details."},
 {id:"face",titleFa:"چهره",role:"character",mapsTo:"person",
  angles:[{id:"front",titleFa:"صورت از روبه‌رو"},{id:"three_quarter",titleFa:"صورت از سه‌رخ"},{id:"profile",titleFa:"صورت از نیم‌رخ"}],
  askFa:"حتماً! برای اینکه دقیقاً خودت باشی، چندتا عکس از صورتت لازمه 👇",
  askFinglish:"hatman! baraye inke daghighan khodet bashi, chand ta aks az soorat-et lazeme 👇",
  keepFa:r=>"چهره دقیقاً مثل "+r+" باشد",
  keepEn:r=>"Keep the person's face and identity exactly as in "+r+"."},
 // Drift awareness (lib/drift.ts): the photos of the person that a request needs and their photos do not show. Asked by the drift check with its own
 // words and slots (driftAskFa, driftAngles); never found by the keep-words below.
 {id:"face_angle",titleFa:"زاویه‌ی دیگه‌ی صورت",role:"character",mapsTo:"person",angles:[{id:"profile",titleFa:"صورت از نیم‌رخ"}],
  askFa:"",askFinglish:"",keepFa:r=>"چهره از همه‌ی زاویه‌ها مثل "+r+" باشد",keepEn:r=>"Keep the person's face from every angle exactly as in "+r+"."},
 {id:"full_body",titleFa:"عکس تمام‌قد",role:"character",mapsTo:"person",angles:[{id:"full_front",titleFa:"تمام‌قد از روبه‌رو"}],
  askFa:"",askFinglish:"",keepFa:r=>"اندام و قد مثل "+r+" باشد",keepEn:r=>"Keep the person's body shape and height exactly as in "+r+"."},
 {id:"smile",titleFa:"عکس با لبخند",role:"character",mapsTo:"person",angles:[{id:"smile",titleFa:"صورت با لبخند، دندون‌ها پیدا"}],
  askFa:"",askFinglish:"",keepFa:r=>"لبخند و دندان‌ها مثل "+r+" باشد",keepEn:r=>"Keep the person's smile and teeth exactly as in "+r+"."},
 {id:"eyes_open",titleFa:"عکس با چشم باز",role:"character",mapsTo:"person",angles:[{id:"eyes_open",titleFa:"صورت با چشم‌های باز"}],
  askFa:"",askFinglish:"",keepFa:r=>"شکل و رنگ چشم‌ها مثل "+r+" باشد",keepEn:r=>"Keep the person's eye shape and colour exactly as in "+r+"."},
 {id:"outfit",titleFa:"لباس",role:"outfit",mapsTo:"person",
  angles:[{id:"front",titleFa:"لباس کامل از روبه‌رو"},{id:"back",titleFa:"لباس از پشت (اگه داری)"}],
  askFa:"اوکی! برای اینکه لباست دقیق همون باشه، یه عکس ازش بفرست 👇",
  askFinglish:"okay! baraye inke lebas-et daghigh hamoon bashe, ye aks azash befrest 👇",
  keepFa:r=>"لباس دقیقاً مثل "+r+" باشد: همان مدل، پارچه و رنگ",
  keepEn:r=>"Dress the person exactly in the outfit from "+r+": the same cut, fabric and colours."}
];

/** The words that name each thing (normalized text: ی/ک, ZWNJ as a space). */
const NAMES:Record<ReferenceNeedId,string[]>={
 tattoo:["تتو","تتوها","تتوهام","تتوهای","تتوم","تتوی","تاتو","خالکوبی","خال کوبی","tattoo","tattoos","tatto","ink"],
 logo:["لوگو","لوگوی","لوگوم","logo","brand logo"],
 product:["محصولم","محصول من","محصولمون","محصولمو","my product","our product"],
 face:["صورت خودم","چهره خودم","صورتم","چهره ام","my face","myself","خودم"],
 outfit:["لباس خودم","لباسم","لباسمو","my outfit","my dress","my clothes"],
 face_angle:[],full_body:[],smile:[],eyes_open:[]
};
const NAMES_POSSESSIVE=["تتوهام","تتوهامو","تتوم","تتومو","لوگومون","لوگوم","لوگومو","محصولم","محصولمون","لباسم","لباسمو","صورتم"];
/** A brief that wants it kept as it really is: keep, intact, unchanged, exactly, my own... */
const KEEP=["keep","intact","unchanged","don't change","dont change","do not change","same","exactly","preserve","my","mine","our",
 "حفظ","بمونه","بمونن","بمانند","بماند","دست نخورده","عوض نشه","عوض نشن","تغییر نکنه","تغییر نکنن","همون","همین","دقیقا","خودم","خودمون"];

/** The things a brief asks to keep that need a photo (in the order of REFERENCE_NEEDS). */
export function detectReferenceNeeds(normalizedText:string):ReferenceNeed[]{
 const t=" "+normalizedText.toLowerCase().replace(/[‌،,.!?؟:;«»"()]/g," ").replace(/\s+/g," ")+" ";
 const has=(w:string)=>t.includes(" "+w+" ");
 // Keeping words, or a Persian possessive on the thing itself (تتوهام، لوگومون، لباسم).
 const keep=KEEP.some(has)||NAMES_POSSESSIVE.some(has);
 // «a man with tattoos» needs nothing; «keep my tattoos», «تتوهام عوض نشه» do.
 return REFERENCE_NEEDS.filter(n=>NAMES[n.id].some(has)&&keep);
}
/** What the conversation's card needs to ask for the photos (sent with the question). */
export type ReferenceRequest={need:ReferenceNeedId;titleFa:string;role:AttachmentRole;angles:ReferenceAngle[]};
/** A reference request as received from the server (it crosses the network: checked before use). */
export function isReferenceRequest(v:unknown):v is ReferenceRequest{
 if(!v||typeof v!=="object")return false;const r=v as Record<string,unknown>;
 return typeof r.need==="string"&&Boolean(findReferenceNeed(r.need))&&typeof r.titleFa==="string"&&typeof r.role==="string"&&Array.isArray(r.angles)&&r.angles.length<=6
  &&r.angles.every(a=>a&&typeof a==="object"&&typeof (a as Record<string,unknown>).id==="string"&&typeof (a as Record<string,unknown>).titleFa==="string");
}
export const findReferenceNeed=(id:string)=>REFERENCE_NEEDS.find(n=>n.id===id);
