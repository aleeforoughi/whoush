/** Labels and geometry for the plan diagrams (camera angle, framing, lighting). Pure: no React, safe on the server and in tests. */
import type {Staging,StagingLight} from "./creative-plan";

export const CAMERA_ANGLE_FA:Record<Staging["cameraAngle"],string>={birds_eye:"از بالا (نمای پرنده)",high:"زاویهٔ بالا",eye_level:"هم‌سطح چشم",low:"زاویهٔ پایین",worms_eye:"از پایین (نمای کرم)",dutch:"زاویهٔ کج (داچ)"};
export const SHOT_SIZE_FA:Record<Staging["shotSize"],string>={extreme_close_up:"خیلی نزدیک",close_up:"نمای نزدیک",medium_close_up:"نزدیک متوسط",medium:"نمای متوسط",medium_full:"تا زانو",full:"تمام‌قد",wide:"نمای باز",extreme_wide:"خیلی باز"};
export const LIGHT_ROLE_FA:Record<StagingLight["role"],string>={key:"نور اصلی",fill:"نور پرکننده",rim:"نور پشت",background:"نور پس‌زمینه",practical:"منبع داخل صحنه"};
export const LIGHT_SOURCE_FA:Record<StagingLight["source"],string>={sun:"خورشید",sky:"نور آسمان",window:"پنجره",softbox:"سافت‌باکس",led_panel:"پنل LED",practical:"چراغ صحنه",neon:"نئون",fire:"آتش",moon:"ماه",flash:"فلاش"};
export const LIGHT_QUALITY_FA:Record<StagingLight["quality"],string>={soft:"نرم",hard:"سخت"};
export const LIGHT_DIRECTION_FA:Record<StagingLight["direction"],string>={front:"از روبه‌رو",front_left:"جلو، چپ",left:"از چپ",back_left:"پشت، چپ",back:"از پشت",back_right:"پشت، راست",right:"از راست",front_right:"جلو، راست",top:"از بالا"};
export const LIGHT_HEIGHT_FA:Record<StagingLight["height"],string>={low:"پایین",eye:"هم‌سطح",high:"بالا"};

/**
 * Where the camera sits in the side view, as degrees above the subject's eye line (90 is straight above, negative is below). Dutch is eye level with the camera
 * rolled, which the diagram draws as a tilt.
 */
export const CAMERA_ELEVATION:Record<Staging["cameraAngle"],number>={birds_eye:80,high:35,eye_level:0,low:-25,worms_eye:-55,dutch:0};
/** Light direction in the top view, in SVG degrees (0 is to the right of the frame, 90 is down towards the camera, 270 is behind the subject). */
export const LIGHT_ANGLE:Record<Exclude<StagingLight["direction"],"top">,number>={front:90,front_left:135,left:180,back_left:225,back:270,back_right:315,right:0,front_right:45};
/** A point at `deg` degrees on a circle of radius `r` around (cx, cy), in SVG coordinates (y grows downwards), rounded to 0.1. */
export function polar(cx:number,cy:number,r:number,deg:number):[number,number]{
 const a=deg*Math.PI/180,round=(v:number)=>Math.round(v*10)/10;
 return [round(cx+r*Math.cos(a)),round(cy+r*Math.sin(a))];
}
/**
 * How much of a standing person the frame shows, in body heights (1 is head to toe), for the framing diagram: a close-up shows the top fifth, a wide shot shows the
 * person at under half the frame height.
 */
export const SHOT_BODY_FRACTION:Record<Staging["shotSize"],number>={extreme_close_up:0.09,close_up:0.2,medium_close_up:0.32,medium:0.5,medium_full:0.75,full:1.1,wide:2.4,extreme_wide:5};

/** An approximate sRGB colour of a black-body light at `kelvin` (Tanner Helland's fit), as `#rrggbb`: 2700 K is warm orange, 6500 K near white, 10000 K blue. */
export function kelvinToHex(kelvin:number):string{
 const t=Math.min(40000,Math.max(1000,kelvin))/100;
 const r=t<=66?255:329.698727446*Math.pow(t-60,-0.1332047592);
 const g=t<=66?99.4708025861*Math.log(t)-161.1195681661:288.1221695283*Math.pow(t-60,-0.0755148492);
 const b=t>=66?255:t<=19?0:138.5177312231*Math.log(t-10)-305.0447927307;
 const h=(v:number)=>Math.round(Math.min(255,Math.max(0,v))).toString(16).padStart(2,"0");
 return "#"+h(r)+h(g)+h(b);
}
/** The colour a light is drawn in: its gel or neon colour when it has one, otherwise its colour temperature. */
export const lightHex=(l:StagingLight)=>l.colorHex?.toLowerCase()??kelvinToHex(l.colorTemperatureK);
/** A short Persian word for the colour of a light, for the legend: گرم, خنثی, سرد, or رنگی for a gel or neon colour. */
export function lightToneFa(l:StagingLight):string{
 if(l.colorHex)return "رنگی";
 return l.colorTemperatureK<4500?"گرم":l.colorTemperatureK<=6000?"خنثی":"سرد";
}

export const SUBJECT_FA:Record<NonNullable<Staging["subject"]>,string>={person:"آدم",object:"شیء",animal:"حیوان",vehicle:"وسیله نقلیه",environment:"فقط محیط"};
const ANGLE_EN:Record<Staging["cameraAngle"],string>={birds_eye:"bird's-eye (top-down)",high:"high angle",eye_level:"eye level",low:"low angle",worms_eye:"worm's-eye (from the ground)",dutch:"eye level with a dutch tilt"};
const SHOT_EN:Record<Staging["shotSize"],string>={extreme_close_up:"extreme close-up",close_up:"close-up",medium_close_up:"medium close-up",medium:"medium shot",medium_full:"medium full shot",full:"full shot",wide:"wide shot",extreme_wide:"extreme wide shot"};
const DIR_EN:Record<StagingLight["direction"],string>={front:"front",front_left:"front-left",left:"left",back_left:"back-left",back:"behind",back_right:"back-right",right:"right",front_right:"front-right",top:"overhead"};
/** Where the subject sits in the frame, in words: «وسط قاب», «سمت چپ قاب، یک‌سوم پایین». Within ±0.12 of an axis counts as centred on it. */
export function placementFa(f?:{x:number;y:number}):string{
 if(!f)return "وسط قاب";
 const h=f.x<-0.12?"سمت چپ":f.x>0.12?"سمت راست":"",v=f.y<-0.12?"یک‌سوم بالا":f.y>0.12?"یک‌سوم پایین":"";
 return !h&&!v?"وسط قاب":[h?h+" قاب":"وسط افقی",v].filter(Boolean).join("، ");
}
export function placementEn(f?:{x:number;y:number}):string{
 if(!f)return "centred in frame";
 const h=f.x<-0.12?"left":f.x>0.12?"right":"",v=f.y<-0.12?"upper third":f.y>0.12?"lower third":"";
 return !h&&!v?"centred in frame":"subject placed "+[h?"on the "+h+" third":"horizontally centred",v?"in the "+v:""].filter(Boolean).join(", ");
}
/** The arranged scene in Persian, for the plan's hard constraints (what the user set in the diagrams). */
export function describeStagingFa(s:Staging):string{
 const lights=s.lights.map(l=>LIGHT_ROLE_FA[l.role]+": "+LIGHT_SOURCE_FA[l.source]+"، "+LIGHT_QUALITY_FA[l.quality]+"، "+LIGHT_DIRECTION_FA[l.direction]+"، ارتفاع "+LIGHT_HEIGHT_FA[l.height]+"، "+l.colorTemperatureK+" کلوین"+(l.colorHex?"، رنگ "+l.colorHex:""));
 return "صحنهٔ تنظیم‌شده: زاویهٔ دوربین «"+CAMERA_ANGLE_FA[s.cameraAngle]+"»، کادر «"+SHOT_SIZE_FA[s.shotSize]+"»"+(s.subject?"، سوژه: "+SUBJECT_FA[s.subject]:"")+"، جای سوژه: "+placementFa(s.framing)+"؛ "+lights.join("؛ ");
}
/** The arranged scene in English, appended to the provider-facing media prompt. */
export function describeStagingEn(s:Staging):string{
 const lights=s.lights.map(l=>l.role+" light: "+l.quality+" "+l.source.replace("_"," ")+" from "+DIR_EN[l.direction]+", "+l.height+" height, "+l.colorTemperatureK+"K"+(l.colorHex?" "+l.colorHex+" gel":""));
 return "Staging: "+ANGLE_EN[s.cameraAngle]+" camera, "+SHOT_EN[s.shotSize]+", "+placementEn(s.framing)+"; "+lights.join("; ")+".";
}
/** The subject a brief is about, from its words: a person, an animal, a vehicle, a product or object, or an environment when there is no single main subject. */
export function detectSubject(normalizedText:string,hasCharacter=false):NonNullable<Staging["subject"]>{
 const has=(words:readonly string[])=>words.some(w=>(" "+normalizedText+" ").includes(" "+w+" "));
 if(hasCharacter||has(["portrait","person","people","man","woman","girl","boy","model","child","face","selfie","پرتره","آدم","مرد","زن","دختر","پسر","بچه","چهره","مدل","سلفی","پیرمرد","پیرزن"]))return "person";
 if(has(["cat","dog","horse","bird","animal","pet","گربه","سگ","اسب","پرنده","حیوان","گوسفند","آهو"]))return "animal";
 if(has(["car","motorcycle","bike","bus","truck","vehicle","ماشین","خودرو","موتور","دوچرخه","اتوبوس","کامیون"]))return "vehicle";
 if(has(["product","bottle","perfume","shoe","shoes","watch","cup","mug","phone","bag","محصول","بطری","عطر","کفش","ساعت","لیوان","فنجان","گوشی","کیف","شیشه"]))return "object";
 return "environment";
}

// ---- interactive editor geometry (pure) ----
/** Camera angles in vertical order, lowest first: arrow keys and dragging move through these. Dutch is a roll, toggled separately. */
export const ANGLE_ORDER=["worms_eye","low","eye_level","high","birds_eye"] as const satisfies readonly Staging["cameraAngle"][];
/** The camera angle nearest to an elevation in degrees (dragging the camera on its arc snaps to it). */
export function snapElevation(deg:number):(typeof ANGLE_ORDER)[number]{
 return ANGLE_ORDER.reduce((best,a)=>Math.abs(CAMERA_ELEVATION[a]-deg)<Math.abs(CAMERA_ELEVATION[best]-deg)?a:best,"eye_level" as (typeof ANGLE_ORDER)[number]);
}
/** The next or previous angle in ANGLE_ORDER (clamped); dutch steps from eye level. */
export function stepAngle(a:Staging["cameraAngle"],step:1|-1):(typeof ANGLE_ORDER)[number]{
 const i=ANGLE_ORDER.indexOf(a==="dutch"?"eye_level":a);
 return ANGLE_ORDER[Math.min(ANGLE_ORDER.length-1,Math.max(0,i+step))];
}
const DIRS=Object.entries(LIGHT_ANGLE) as [Exclude<StagingLight["direction"],"top">,number][];
/** The light direction nearest to an SVG angle in degrees (dragging a light around the subject snaps to the eight directions). */
export function snapDirection(deg:number):Exclude<StagingLight["direction"],"top">{
 const d=((deg%360)+360)%360,dist=(a:number)=>Math.min(Math.abs(a-d),360-Math.abs(a-d));
 return DIRS.reduce((best,cur)=>dist(cur[1])<dist(best[1])?cur:best)[0];
}
/** Rotates a light one step around the subject (clockwise for +1 in the top view); top stays top. */
export function stepDirection(d:StagingLight["direction"],step:1|-1):StagingLight["direction"]{
 if(d==="top")return d;
 return snapDirection(LIGHT_ANGLE[d]+step*45);
}
/** The asset pack (public/visuals): which image shows each subject and light source. */
export const SUBJECT_ASSETS:Record<NonNullable<Staging["subject"]>,{side:string;front:string;top:string}>={
 person:{side:"person-side",front:"person-front",top:"person-top"},
 object:{side:"object-side",front:"object-side",top:"object-top"},
 animal:{side:"animal-side",front:"animal-side",top:"animal-top"},
 vehicle:{side:"vehicle-side",front:"vehicle-side",top:"vehicle-top"},
 environment:{side:"env-mountains",front:"env-mountains",top:"env-top"}
};
export const LIGHT_ASSETS:Record<StagingLight["source"],string>={sun:"light-sun",sky:"light-sky",window:"light-window",softbox:"light-softbox",led_panel:"light-led-panel",practical:"light-practical",neon:"light-neon",fire:"light-fire",moon:"light-moon",flash:"light-flash"};
/** Gel colours offered for a light (none means its colour temperature). */
export const GEL_COLORS=["#ff5a5f","#ff9f1c","#ffd23f","#3ddc97","#4f8cff","#b07cff"] as const;
/**
 * What the user changed in the diagrams, as short Persian lines for the message sent to Whoush («زاویهٔ دوربین: هم‌سطح چشم ← زاویهٔ پایین»). Lights are compared by
 * position in the list; added and removed lights are named. Empty when nothing changed.
 */
export function describeStagingChangesFa(before:Staging,after:Staging,aspectBefore?:string,aspectAfter?:string):string[]{
 const out:string[]=[],arrow=(a:string,b:string)=>a+" ← "+b;
 if((before.subject??"person")!==(after.subject??"person"))out.push("سوژه: "+arrow(SUBJECT_FA[before.subject??"person"],SUBJECT_FA[after.subject??"person"]));
 if(before.cameraAngle!==after.cameraAngle)out.push("زاویهٔ دوربین: "+arrow(CAMERA_ANGLE_FA[before.cameraAngle],CAMERA_ANGLE_FA[after.cameraAngle]));
 if(before.shotSize!==after.shotSize)out.push("کادر: "+arrow(SHOT_SIZE_FA[before.shotSize],SHOT_SIZE_FA[after.shotSize]));
 if(placementFa(before.framing)!==placementFa(after.framing))out.push("جای سوژه: "+arrow(placementFa(before.framing),placementFa(after.framing)));
 if(aspectAfter&&aspectBefore!==aspectAfter)out.push("نسبت تصویر: "+arrow(aspectBefore??"—",aspectAfter));
 const n=Math.max(before.lights.length,after.lights.length);
 for(let i=0;i<n;i++){
  const a=before.lights[i],b=after.lights[i];
  if(!a&&b){out.push("نور تازه: "+LIGHT_ROLE_FA[b.role]+"، "+LIGHT_SOURCE_FA[b.source]+"، "+LIGHT_DIRECTION_FA[b.direction]);continue;}
  if(a&&!b){out.push("حذف "+LIGHT_ROLE_FA[a.role]);continue;}
  const d:string[]=[];
  if(a.role!==b.role)d.push("نقش "+arrow(LIGHT_ROLE_FA[a.role],LIGHT_ROLE_FA[b.role]));
  if(a.source!==b.source)d.push("منبع "+arrow(LIGHT_SOURCE_FA[a.source],LIGHT_SOURCE_FA[b.source]));
  if(a.direction!==b.direction)d.push("جهت "+arrow(LIGHT_DIRECTION_FA[a.direction],LIGHT_DIRECTION_FA[b.direction]));
  if(a.height!==b.height)d.push("ارتفاع "+arrow(LIGHT_HEIGHT_FA[a.height],LIGHT_HEIGHT_FA[b.height]));
  if(a.quality!==b.quality)d.push(arrow(LIGHT_QUALITY_FA[a.quality],LIGHT_QUALITY_FA[b.quality]));
  if(a.colorTemperatureK!==b.colorTemperatureK)d.push(arrow(String(a.colorTemperatureK),String(b.colorTemperatureK))+" کلوین");
  if((a.colorHex??"")!==(b.colorHex??""))d.push("ژل "+arrow(a.colorHex??"بدون ژل",b.colorHex??"بدون ژل"));
  if(d.length)out.push(LIGHT_ROLE_FA[b.role]+": "+d.join("، "));
 }
 return out;
}
/** The colour-temperature slider's track: the colour of light from 1500 K (left) to 12000 K (right). */
export const TEMPERATURE_GRADIENT="linear-gradient(to right,"+[1500,2700,4000,5600,7500,12000].map(kelvinToHex).join(",")+")";
