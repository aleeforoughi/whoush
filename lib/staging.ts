/** Labels and geometry for the plan diagrams (camera angle, framing, lighting). Pure: no React, safe on the server and in tests. */
import {PROP_X_RANGE,PROP_Z_RANGE,type Staging,type StagingLight} from "./creative-plan";
import {VISUALS} from "./visual-assets";
import {displayTag,fileTagOf,normalizeMentionText} from "./attachments";

export const CAMERA_ANGLE_FA:Record<Staging["cameraAngle"],string>={birds_eye:"از بالا (نمای پرنده)",high:"زاویهٔ بالا",eye_level:"هم‌سطح چشم",low:"زاویهٔ پایین",worms_eye:"از پایین (نمای کرم)",dutch:"زاویهٔ کج (داچ)"};
export const SHOT_SIZE_FA:Record<Staging["shotSize"],string>={extreme_close_up:"خیلی نزدیک",close_up:"نمای نزدیک",medium_close_up:"نزدیک متوسط",medium:"نمای متوسط",medium_full:"تا زانو",full:"تمام‌قد",wide:"نمای باز",extreme_wide:"خیلی باز"};
export const LIGHT_ROLE_FA:Record<StagingLight["role"],string>={key:"نور اصلی",fill:"نور پرکننده",rim:"نور پشت",background:"نور پس‌زمینه",practical:"منبع داخل صحنه"};
export const LIGHT_SOURCE_FA:Record<StagingLight["source"],string>={sun:"خورشید",sky:"نور آسمان",window:"پنجره",softbox:"سافت‌باکس",led_panel:"پنل LED",practical:"چراغ صحنه",neon:"نئون",fire:"آتش",moon:"ماه",flash:"فلاش"};
export const LIGHT_QUALITY_FA:Record<StagingLight["quality"],string>={soft:"نرم",hard:"سخت"};
export const LIGHT_DIRECTION_FA:Record<StagingLight["direction"],string>={front:"از روبه‌رو",front_left:"جلو، چپ",left:"از چپ",back_left:"پشت، چپ",back:"از پشت",back_right:"پشت، راست",right:"از راست",front_right:"جلو، راست",top:"از بالا"};
export const LIGHT_HEIGHT_FA:Record<StagingLight["height"],string>={floor:"کف",low:"پایین",eye:"هم‌سطح",high:"بالا",ceiling:"سقف"};
const LIGHT_HEIGHT_EN:Record<StagingLight["height"],string>={floor:"at floor level (uplight)",low:"low height",eye:"eye-level height",high:"high height",ceiling:"overhead from the ceiling"};

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
 const lights=s.lights.map(l=>LIGHT_ROLE_FA[l.role]+": "+LIGHT_SOURCE_FA[l.source]+"، "+LIGHT_QUALITY_FA[l.quality]+"، "+LIGHT_DIRECTION_FA[l.direction]+"، ارتفاع "+LIGHT_HEIGHT_FA[l.height]+"، "+l.colorTemperatureK+" کلوین"+(l.intensity!==undefined?"، شدت "+intensityFa(l.intensity):"")+(l.colorHex?"، رنگ "+l.colorHex:""));
 return "صحنهٔ تنظیم‌شده: زاویهٔ دوربین «"+CAMERA_ANGLE_FA[s.cameraAngle]+"»"+(s.cameraElevation!==undefined?" ("+Math.round(s.cameraElevation)+" درجه)":"")+(Math.abs(s.cameraAzimuth??0)>=1?"، دوربین "+orbitFa(s.cameraAzimuth!):"")+(s.cameraRoll?"، زاویهٔ کج (داچ) "+Math.abs(Math.round(s.cameraRoll))+" درجه":"")+(s.shotStyle==="ots"?"، نمای روی شانه":s.shotStyle==="pov"?"، نمای دید سوژه":"")+focusFa(s)+(s.focusDetail?"، تمرکز روی "+FOCUS_DETAIL_FA[s.focusDetail]:"")+"، کادر «"+SHOT_SIZE_FA[s.shotSize]+"»"+(s.shotScale!==undefined?" (زوم "+zoomFactor(s)+"×)":"")+(s.subject?"، سوژه: "+SUBJECT_FA[s.subject]:"")+"، جای سوژه: "+placementFa(s.framing)+(s.props?.length?"؛ "+describeLayoutFa(s.props):"")+"؛ "+lights.join("؛ ");
}
/** The arranged scene in English, appended to the provider-facing media prompt. */
export function describeStagingEn(s:Staging):string{
 const lights=s.lights.map(l=>l.role+" light: "+l.quality+" "+l.source.replace("_"," ")+" from "+DIR_EN[l.direction]+(l.angle!==undefined?" ("+Math.round(l.angle)+"° in top view)":"")+", "+LIGHT_HEIGHT_EN[l.height]+", "+l.colorTemperatureK+"K"+(l.intensity!==undefined?", "+Math.round(l.intensity*100)+"% strength":"")+(l.colorHex?" "+l.colorHex+" gel":""));
 return "Staging: "+ANGLE_EN[s.cameraAngle]+" camera"+(s.cameraElevation!==undefined?" ("+Math.round(s.cameraElevation)+"° from eye level)":"")+(orbitEn(s.cameraAzimuth??0)?", "+orbitEn(s.cameraAzimuth??0):"")+(s.cameraRoll?", Dutch angle tilted "+Math.abs(Math.round(s.cameraRoll))+"° "+(s.cameraRoll>0?"clockwise":"counter-clockwise"):"")+(s.shotStyle==="ots"?", over-the-shoulder shot":s.shotStyle==="pov"?", point-of-view shot through the subject's eyes":"")+(s.environment&&s.environment!=="landscape"?", in "+ENVIRONMENT_EN[s.environment]:"")+(s.environmentDistance!==undefined?", the background about "+Math.round(s.environmentDistance)+" m behind the subject":"")+focusEn(s)+(s.focusDetail?", framed on the main subject's "+(s.focusDetail==="feet"?"feet and shoes":s.focusDetail):"")+", "+SHOT_EN[s.shotSize]+(s.shotScale!==undefined?" ("+zoomFactor(s)+"x of a full shot)":"")+", "+placementEn(s.framing)+"; "+lights.join("; ")+"."+(s.props?.length?" "+describeLayoutEn(s.props):"");
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
/**
 * The camera's five height stops, lowest first (Bottom, Low, Eye level, High, Top), at the named angles' elevations: the height slider, the camera drag and
 * the frame's joystick snap to them, and the frame draws every prop's sprite at the stop nearest to how the camera sees it (lib/sprites.ts).
 */
export const VERTICAL_STOPS=[
 {id:"bottom",angle:"worms_eye",fa:"از پایین"},{id:"low",angle:"low",fa:"پایین"},{id:"eye",angle:"eye_level",fa:"هم‌سطح چشم"},
 {id:"high",angle:"high",fa:"بالا"},{id:"top",angle:"birds_eye",fa:"از بالا"}
].map(v=>({...v,deg:CAMERA_ELEVATION[v.angle as (typeof ANGLE_ORDER)[number]]})) as readonly {id:"bottom"|"low"|"eye"|"high"|"top";angle:(typeof ANGLE_ORDER)[number];fa:string;deg:number}[];
export type VerticalStop=(typeof VERTICAL_STOPS)[number]["id"];
/** The height stop nearest to an elevation in degrees, as its index in VERTICAL_STOPS. */
export const verticalIndex=(deg:number)=>VERTICAL_STOPS.reduce((b,v,i)=>Math.abs(v.deg-deg)<Math.abs(VERTICAL_STOPS[b].deg-deg)?i:b,2);
export const snapVertical=(deg:number)=>VERTICAL_STOPS[verticalIndex(deg)].deg;
/** The sides, every 45°: front, the front 3/4s, the sides, the rear 3/4s, the back. The orbit, the camera drag, a prop's turn and the joystick snap to them. */
export const SIDE_STEP=45;
export const snapSide=(deg:number)=>wrap180(Math.round(deg/SIDE_STEP)*SIDE_STEP);
/** A side in words, from 0 (front) to 180 (back), turned toward frame right for positive angles: «روبه‌رو», «سه‌رخ»، «نیم‌رخ»، «سه‌رخ از پشت»، «پشت». */
export function sideStopFa(deg:number):string{const a=Math.abs(snapSide(deg));return a===0?"روبه‌رو":a===45?"سه‌رخ":a===90?"نیم‌رخ":a===135?"سه‌رخ از پشت":"پشت";}
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
/** The pack's images for the subjects with their own figures (the characters, and an environment-only scene); anything else is a vector cube. */
export const SUBJECT_ASSETS:Partial<Record<NonNullable<Staging["subject"]>,{side:string;front:string;top:string}>>={
 person:{side:"person-side",front:"person-front",top:"person-top"},
 animal:{side:"animal-side",front:"animal-side",top:"animal-top"},
 environment:{side:"env-mountains",front:"env-mountains",top:"env-top"}
}
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
 const eb=elevationOf(before),ea=elevationOf(after);
 if(before.cameraAngle!==after.cameraAngle||Math.abs(eb-ea)>=2)out.push("زاویهٔ دوربین: "+arrow(CAMERA_ANGLE_FA[before.cameraAngle]+" ("+Math.round(eb)+"°)",CAMERA_ANGLE_FA[after.cameraAngle]+" ("+Math.round(ea)+"°)"));
 if(before.shotSize!==after.shotSize||Math.abs(Math.log(scaleOf(before)/scaleOf(after)))>0.03)out.push("کادر: "+arrow(SHOT_SIZE_FA[before.shotSize]+" (زوم "+zoomFactor(before)+"×)",SHOT_SIZE_FA[after.shotSize]+" (زوم "+zoomFactor(after)+"×)"));
 if(Math.abs(wrap180((after.cameraAzimuth??0)-(before.cameraAzimuth??0)))>=2)out.push("چرخش دوربین: "+arrow(orbitFa(before.cameraAzimuth??0),orbitFa(after.cameraAzimuth??0)));
 if(Math.round(before.cameraRoll??0)!==Math.round(after.cameraRoll??0))out.push("زاویهٔ کج (داچ): "+arrow(Math.round(before.cameraRoll??0)+"°",Math.round(after.cameraRoll??0)+"°"));
 const style=(s:Staging)=>s.shotStyle==="ots"?"روی شانه":s.shotStyle==="pov"?"دید سوژه":"معمولی";
 if(style(before)!==style(after))out.push("نوع نما: "+arrow(style(before),style(after)));
 // The lens and aperture only when the user set them (Whoush's own pick follows the other changes by itself).
 const lb=lensFor(before),la=lensFor(after);
 if(before.lensMm!==after.lensMm&&lb.focalLengthMm!==la.focalLengthMm)out.push("لنز: "+arrow(lb.focalLengthMm+"mm",la.focalLengthMm+"mm"));
 if(Boolean(before.fisheye)!==Boolean(after.fisheye))out.push("لنز چشم‌ماهی: "+arrow(before.fisheye?"روشن":"خاموش",after.fisheye?"روشن":"خاموش"));
 if(before.apertureF!==after.apertureF&&lb.aperture!==la.aperture)out.push("دیافراگم: "+arrow(lb.aperture,la.aperture)+(la.deep?"":" (بوکه)"));
 if((before.autopilot!==false)!==(after.autopilot!==false))out.push("اتوپایلوت هووش: "+arrow(before.autopilot===false?"خاموش":"روشن",after.autopilot===false?"خاموش":"روشن"));
 const dom=(s:Staging)=>{const m=(s.props??[]).find(p=>p.main);return m?(s.focusDetail&&m.kind==="person"?FOCUS_DETAIL_FA[s.focusDetail]+"ِ ":"")+m.label:"";};
 if(dom(before)!==dom(after))out.push("سوژهٔ اصلی: "+arrow(dom(before)||"—",dom(after)||"—"));
 if(placementFa(before.framing)!==placementFa(after.framing))out.push("جای سوژه: "+arrow(placementFa(before.framing),placementFa(after.framing)));
 // Props: matched by position in the list (the editor never reorders them); moved, added and removed ones are named.
 const pb=before.props??[],pa=after.props??[];
 for(let i=0;i<Math.max(pb.length,pa.length);i++){
  const a=pb[i],b=pa[i];
  if(!a&&b){out.push("اضافه: "+b.label+" ("+propPlaceFa(b)+")");continue;}
  if(a&&!b){out.push("حذف: "+a.label);continue;}
  if(propPlaceFa(a)!==propPlaceFa(b))out.push(b.label+": "+arrow(propPlaceFa(a),propPlaceFa(b)));
 }
 if(Math.round(backdropM(before))!==Math.round(backdropM(after)))out.push("فاصلهٔ پس‌زمینه: "+arrow(fa2(Math.round(backdropM(before)))+" متر",fa2(Math.round(backdropM(after)))+" متر"));
 if(aspectAfter&&aspectBefore!==aspectAfter)out.push("نسبت تصویر: "+arrow(aspectBefore??"—",aspectAfter));
 const n=Math.max(before.lights.length,after.lights.length);
 for(let i=0;i<n;i++){
  const a=before.lights[i],b=after.lights[i];
  if(!a&&b){out.push("نور تازه: "+LIGHT_ROLE_FA[b.role]+"، "+LIGHT_SOURCE_FA[b.source]+"، "+LIGHT_DIRECTION_FA[b.direction]);continue;}
  if(a&&!b){out.push("حذف "+LIGHT_ROLE_FA[a.role]);continue;}
  const d:string[]=[];
  if(a.role!==b.role)d.push("نقش "+arrow(LIGHT_ROLE_FA[a.role],LIGHT_ROLE_FA[b.role]));
  if(a.source!==b.source)d.push("منبع "+arrow(LIGHT_SOURCE_FA[a.source],LIGHT_SOURCE_FA[b.source]));
  const aa=lightAngleOf(a),ba=lightAngleOf(b);
  if(a.direction!==b.direction||(aa!==undefined&&ba!==undefined&&Math.abs(aa-ba)>=3))d.push("جهت "+arrow(LIGHT_DIRECTION_FA[a.direction]+(aa!==undefined&&b.angle!==undefined?" ("+Math.round(aa)+"°)":""),LIGHT_DIRECTION_FA[b.direction]+(ba!==undefined&&b.angle!==undefined?" ("+Math.round(ba)+"°)":"")));
  if(a.height!==b.height)d.push("ارتفاع "+arrow(LIGHT_HEIGHT_FA[a.height],LIGHT_HEIGHT_FA[b.height]));
  if(Math.abs(intensityOf(a)-intensityOf(b))>=0.03)d.push("شدت "+arrow(intensityFa(intensityOf(a)),intensityFa(intensityOf(b))));
  if(a.quality!==b.quality)d.push(arrow(LIGHT_QUALITY_FA[a.quality],LIGHT_QUALITY_FA[b.quality]));
  if(a.colorTemperatureK!==b.colorTemperatureK)d.push(arrow(String(a.colorTemperatureK),String(b.colorTemperatureK))+" کلوین");
  if((a.colorHex??"")!==(b.colorHex??""))d.push("ژل "+arrow(a.colorHex??"بدون ژل",b.colorHex??"بدون ژل"));
  if(d.length)out.push(LIGHT_ROLE_FA[b.role]+": "+d.join("، "));
 }
 return out;
}
/** The colour-temperature slider's track: the colour of light from 1500 K (left) to 12000 K (right). */
export const TEMPERATURE_GRADIENT="linear-gradient(to right,"+[1500,2700,4000,5600,7500,12000].map(kelvinToHex).join(",")+")";

// ---- props: the scene's movable things (the environment is the backdrop) ----
export type SceneProp=NonNullable<Staging["props"]>[number];
export const PROP_KIND_FA:Record<SceneProp["kind"],string>={person:"آدم",object:"شیء",animal:"حیوان",vehicle:"وسیله نقلیه",tree:"درخت",building:"ساختمان"};
/** Which asset shows a prop from the side (camera view, front) and from above. */
/** The characters' images from the side and from above (anything else is a vector cube: lib/sprites.ts, cubeDims). */
export const PROP_ASSETS:Partial<Record<SceneProp["kind"],{front:string;top:string}>>={person:{front:"human-front",top:"human-top"},animal:{front:"animal-side",top:"animal-top"}};
/** Real-world-ish heights (a person is 1), so props keep plausible proportions in the camera view. */
export const PROP_HEIGHT:Record<SceneProp["kind"],number>={person:1,object:0.35,animal:0.45,vehicle:0.8,tree:2.2,building:3.2};
/** Words that name a prop, with its Persian label: the first match of each group becomes a prop (in the order the groups are listed). */
const PROP_WORDS:[SceneProp["kind"],[string,string][]][]=[
 ["person",[["زن","زن"],["woman","زن"],["مرد","مرد"],["man","مرد"],["دختر","دختر"],["girl","دختر"],["پسر","پسر"],["boy","پسر"],["بچه","بچه"],["child","بچه"],["پیرمرد","پیرمرد"],["old man","پیرمرد"],["ماهیگیر","ماهیگیر"],["fisherman","ماهیگیر"],["آدم","آدم"],["person","آدم"],["portrait","آدم"],["پرتره","آدم"],["مدل","مدل"],["model","مدل"]]],
 ["animal",[["گربه","گربه"],["cat","گربه"],["سگ","سگ"],["dog","سگ"],["اسب","اسب"],["horse","اسب"],["پرنده","پرنده"],["bird","پرنده"]]],
 ["vehicle",[["ماشین","ماشین"],["car","ماشین"],["خودرو","خودرو"],["موتور","موتور"],["motorcycle","موتور"],["دوچرخه","دوچرخه"],["bike","دوچرخه"],["اتوبوس","اتوبوس"],["bus","اتوبوس"]]],
 ["object",[["بطری","بطری"],["bottle","بطری"],["عطر","عطر"],["perfume","عطر"],["کفش","کفش"],["shoe","کفش"],["shoes","کفش"],["ساعت","ساعت"],["watch","ساعت"],["فنجان","فنجان"],["لیوان","لیوان"],["cup","فنجان"],["mug","لیوان"],["کیف","کیف"],["bag","کیف"],["محصول","محصول"],["product","محصول"]]],
 ["tree",[["درخت","درخت"],["tree","درخت"],["trees","درخت"],["جنگل","درخت"],["forest","درخت"]]],
 ["building",[["کافه","کافه"],["cafe","کافه"],["خونه","خونه"],["خانه","خانه"],["house","خونه"],["ساختمان","ساختمان"],["building","ساختمان"],["برج","برج"],["tower","برج"]]]
];
const SLOTS:[number,number][]=[[0,-0.25],[0.55,0.25],[-0.55,0.35],[0.75,0.7],[-0.75,0.7],[0,0.8]];
/** The props a brief names, laid out for the camera: the main subject centre front, the others alternating right and left, further back. */
export function detectProps(normalizedText:string,subject:NonNullable<Staging["subject"]>):SceneProp[]{
 const t=" "+normalizedText+" ",found:{kind:SceneProp["kind"];label:string;at:number}[]=[];
 for(const [kind,words] of PROP_WORDS){
  let best:{label:string;at:number}|undefined;
  for(const [w,label] of words){const at=t.indexOf(" "+w+" ");if(at>=0&&(!best||at<best.at))best={label,at};}
  if(best)found.push({kind,...best});
 }
 // The main subject first (the scene's subject kind), then the rest in the order the brief names them.
 const mainKind:SceneProp["kind"]|undefined=subject==="environment"?undefined:subject;
 found.sort((a,b)=>Number(b.kind===mainKind)-Number(a.kind===mainKind)||a.at-b.at);
 return found.slice(0,6).map((f,i)=>({kind:f.kind,label:f.label,x:SLOTS[i][0],z:SLOTS[i][1],y:0,...(i===0&&f.kind===mainKind?{main:true}:{})}));
}
// A prop's side and depth in words. `cut` (what the canvas frame actually cuts) wins; without it, the stage coordinates (beyond ±1 is outside a full shot's stage).
const isCut=(p:SceneProp,e:"left"|"right"|"bottom")=>p.cut?p.cut.includes(e):e==="left"?p.x<-1:e==="right"?p.x>1:p.z<-1;
const sideFa=(p:SceneProp)=>isCut(p,"left")?"نیمه بیرون از کادر، سمت چپ":isCut(p,"right")?"نیمه بیرون از کادر، سمت راست":p.x<-0.33?"سمت چپ":p.x>0.33?"سمت راست":"وسط";
const depthFa=(p:SceneProp)=>isCut(p,"bottom")?"خیلی نزدیک، بریده از پایین کادر":p.z<-0.33?"جلو":p.z>0.33?"عقب":"وسط عمق";
const sideEn=(p:SceneProp)=>isCut(p,"left")?"partly out of frame on the left":isCut(p,"right")?"partly out of frame on the right":p.x<-0.33?"left":p.x>0.33?"right":"centre";
const depthEn=(p:SceneProp)=>isCut(p,"bottom")?"very close, cut by the bottom of the frame":p.z<-0.33?"foreground":p.z>0.33?"background":"midground";
/** Where a prop stands, in Persian: «سمت راست، عقب، بالاتر از زمین». */
export const propPlaceFa=(p:SceneProp)=>sideFa(p)+"، "+depthFa(p)+(p.y>0.15?"، بالاتر از زمین":"")+(p.facing!==undefined?"، "+facingFa(p.facing):"");
/** The scene layout in Persian («چیدمان: زن (اصلی) وسط، جلو؛ ماشین سمت راست، عقب»), empty without props. */
export function describeLayoutFa(props?:readonly SceneProp[]):string{
 return props?.length?"چیدمان: "+props.map(p=>p.label+(supportOf(p,props)?" (روی "+supportOf(p,props)!.label+")":"")+(p.refs?.length?" (مثل "+p.refs.map(displayTag).join("، ")+")":"")+(p.main?" (اصلی)":"")+" "+propPlaceFa(p)).join("؛ "):"";
}
/** The scene layout in English for the provider prompt, without the Persian labels (kinds only). */
export function describeLayoutEn(props?:readonly SceneProp[]):string{
 return props?.length?"Layout: "+props.map(p=>p.kind+(isCube(p)&&p.size?" (about "+[p.size.w,p.size.h,p.size.d].map(v=>Math.round(v*100)).join(" x ")+" cm)":"")+(supportOf(p,props)?" resting on top of the larger object":"")+(p.refs?.length?" (looks like the attached "+(p.refs.length>1?"references":"reference")+")":"")+(p.main?" (main subject)":"")+" "+sideEn(p)+" "+depthEn(p)+(p.y>0.15?", raised":"")+(p.facing!==undefined?", "+facingEn(p.facing):"")).join("; ")+".":"";
}
/**
 * Tidies a planner's props (never the user's own arrangement): props crowded onto one spot get the default layout (main subject centre front, the others
 * alternating behind it), and when every prop is lifted, `y` was misread as height and is reset to the ground. Order: main subject first.
 */
export function tidyProps(props?:readonly SceneProp[]):SceneProp[]|undefined{
 if(!props?.length)return props?[...props]:undefined;
 const sorted=[...props].sort((a,b)=>Number(Boolean(b.main))-Number(Boolean(a.main)));
 // One object resting on another (a phone on a desk) shares its spot on purpose: that is not crowding.
 const crowded=sorted.some((a,i)=>sorted.some((b,j)=>j>i&&Math.hypot(a.x-b.x,a.z-b.z)<0.25&&supportOf(a,sorted)!==b&&supportOf(b,sorted)!==a));
 const lifted=sorted.length>1&&sorted.every(p=>p.y>0.15);
 return sorted.map((p,i)=>({...p,...(crowded?{x:SLOTS[i][0],z:SLOTS[i][1]}:{}),...(lifted?{y:0}:{})}));
}
/**
 * The camera view's simple perspective for a frame W×H and a person height `unitH` (frame units): where a prop's base stands (x, groundY), where it is drawn
 * (y, lifted by p.y) and how tall (h). The ground runs from the horizon (far, z = 1) to the bottom (near, z = -1); further back is smaller and closer to the
 * centre line. `groundFromView` is the exact inverse on the ground plane, used when a prop is dragged.
 */
export function propInView(p:Pick<SceneProp,"kind"|"x"|"z"|"y">,W:number,H:number,unitH:number){
 const horizon=H*0.5,near=H*0.96,t=depthT(p.z),s=1-t*0.55,spread=W*0.42*(1-t*0.4);
 const groundY=near-t*(near-horizon);
 return {x:W/2+p.x*spread,groundY,y:groundY-p.y*unitH*0.5*s,h:PROP_HEIGHT[p.kind]*unitH*s*0.5};
}
/**
 * Depth on screen for a ground depth z: linear up to the stage's back (z = 1 at t = 1); beyond it (a prop the camera's orbit swung far back) it approaches
 * the horizon without reaching it, so it never floats in the sky.
 */
export function depthT(z:number):number{const t=(z+1)/2;return t<=1?t:1+0.1*(1-Math.exp(-(t-1)*3));}
export function groundFromView(vx:number,vy:number,W:number,H:number):{x:number;z:number}{
 const horizon=H*0.5,near=H*0.96,t=Math.max((PROP_Z_RANGE[0]+1)/2,Math.min(1,(near-vy)/(near-horizon))),spread=W*0.42*(1-t*0.4);
 const r=(v:number)=>Math.round(v*100)/100;
 return {x:r(Math.max(PROP_X_RANGE[0],Math.min(PROP_X_RANGE[1],(vx-W/2)/spread))),z:r(Math.max(PROP_Z_RANGE[0],Math.min(PROP_Z_RANGE[1],t*2-1)))};
}

// ---- the frame's camera (shared by the canvas drawing, its drag limits, its sliders and the cut annotation) ----
/** The frame view's size for an aspect ratio («16:9», «4:5»...): 150 wide when landscape, 110 tall when portrait. */
export function frameSize(aspect:string):{W:number;H:number}{
 const m=/^(\d+(?:\.\d+)?)[:x×/](\d+(?:\.\d+)?)$/.exec(aspect.trim());let r=m?Number(m[1])/Number(m[2]):16/9;if(!(r>0.2&&r<5))r=16/9;
 return r>=1?{W:150,H:Math.round(150/r)}:{W:Math.round(110*r),H:110};
}
/** A prop's width in the frame, from its asset's proportions. */
/** Whether a person prop is a woman or a man, from its label (and so which figure draws it); undefined when the label does not say. */
const FEMALE=["زن","دختر","خانم","بانو","مادر","عروس","مادربزرگ","woman","girl","lady","female","mother","bride","zan","dokhtar","khanom"];
const MALE=["مرد","پسر","آقا","پدر","داماد","پدربزرگ","man","boy","guy","male","father","groom","mard","pesar","agha"];
export function genderOf(p:Pick<SceneProp,"kind"|"label">):"female"|"male"|undefined{
 if(p.kind!=="person")return undefined;
 const words=p.label.toLowerCase().split(/[\s\u200c\-_،,]+/);
 return words.some(w=>FEMALE.includes(w))?"female":words.some(w=>MALE.includes(w))?"male":undefined;
}
// ---- cubes: everything but the characters (people and the pets) is drawn as a cube at its real size: objects, vehicles, buildings, trees, other animals ----
const norm=(label:string)=>" "+label.toLowerCase().replace(/[\u200c\-_،,]+/g," ")+" ";
/** The pets with their own figures in the pack: a cat, a dog, a horse (from the prop's label; any other animal is a cube). */
const PETS:[ "cat"|"dog"|"horse",string[]][]=[["cat",["گربه","پیشی","cat","kitten","kitty"]],["dog",["سگ","توله","dog","puppy"]],["horse",["اسب","کره اسب","horse","pony"]]];
export function petOf(p:Pick<SceneProp,"kind"|"label">):"cat"|"dog"|"horse"|undefined{
 if(p.kind!=="animal")return undefined;const t=norm(p.label);
 return PETS.find(([,ws])=>ws.some(w=>t.includes(" "+w+" ")))?.[0];
}
/**
 * The characters: people and the pets with their own figures. In the beta, «بوم»'s frame draws only these (the other props stay in the scene and in the
 * prompt); a scene without a character (a place alone, or only other props) shows no frame, only the camera and the lighting.
 */
export const isCharacter=(p:Pick<SceneProp,"kind"|"label">)=>p.kind==="person"||Boolean(petOf(p));
/** Whether the frame is shown (beta): only when the scene has at least one character; a place alone, or props without a character, show no frame. */
export const showsFrame=(props:readonly SceneProp[]|undefined)=>Boolean(props?.some(isCharacter));
/** Drawn as a cube at its real size: any object, vehicle, building or tree, and an animal that is not one of the pets. */
export const isCube=(p:Pick<SceneProp,"kind"|"label">)=>p.kind!=="person"&&!petOf(p);
/**
 * Everyday things' real sizes in metres (width, height, depth: front to back), for a cube Whoush did not size itself (a plan without `size`, or the rule
 * planner). The first entry whose word is in the label wins; nothing matches: the kind's usual size.
 */
const OBJECT_SIZES:[string[],{w:number;h:number;d:number}][]=[
 [["بطری","شیشه","نوشابه","bottle"],{w:0.08,h:0.28,d:0.08}],[["عطر","ادکلن","perfume","cologne"],{w:0.07,h:0.12,d:0.04}],
 [["فنجان","cup"],{w:0.09,h:0.09,d:0.09}],[["لیوان","ماگ","mug","glass"],{w:0.09,h:0.11,d:0.09}],[["کفش","کتونی","shoe","shoes","sneaker","sneakers"],{w:0.11,h:0.12,d:0.3}],
 [["ساعت","watch"],{w:0.045,h:0.045,d:0.012}],[["گوشی","موبایل","phone","smartphone"],{w:0.075,h:0.155,d:0.008}],[["کیف","bag","handbag"],{w:0.35,h:0.3,d:0.15}],
 [["کوله","backpack"],{w:0.3,h:0.45,d:0.18}],[["چمدان","suitcase"],{w:0.45,h:0.68,d:0.27}],[["کتاب","book"],{w:0.15,h:0.23,d:0.03}],
 [["لپ تاپ","لپتاپ","laptop"],{w:0.33,h:0.22,d:0.24}],[["میز","table","desk"],{w:1.2,h:0.75,d:0.7}],[["صندلی","chair"],{w:0.45,h:0.9,d:0.5}],
 [["مبل","کاناپه","sofa","couch"],{w:2,h:0.85,d:0.9}],[["گلدان","vase"],{w:0.15,h:0.3,d:0.15}],[["کلاه","hat","cap"],{w:0.3,h:0.15,d:0.3}],
 [["توپ","ball"],{w:0.22,h:0.22,d:0.22}],[["گیتار","guitar"],{w:0.38,h:1,d:0.1}],[["جعبه","box","package"],{w:0.3,h:0.3,d:0.3}],
 [["عینک","glasses","sunglasses"],{w:0.14,h:0.05,d:0.15}],[["کیک","cake"],{w:0.22,h:0.12,d:0.22}],[["محصول","product"],{w:0.2,h:0.25,d:0.2}],
 // Vehicles (their length runs front to back) and buildings.
 [["موتور","motorcycle","motorbike"],{w:0.8,h:1.1,d:2.1}],[["دوچرخه","bike","bicycle"],{w:0.6,h:1,d:1.7}],[["اتوبوس","bus"],{w:2.5,h:3.2,d:12}],
 [["کامیون","truck"],{w:2.5,h:3.5,d:8}],[["ماشین","خودرو","car"],{w:1.8,h:1.5,d:4.3}],
 [["برج","tower","skyscraper"],{w:20,h:60,d:20}],[["کافه","cafe","café","shop","مغازه"],{w:8,h:4,d:10}],[["خونه","خانه","house"],{w:10,h:7,d:10}],
 [["نخل","palm"],{w:4,h:9,d:4}],[["بوته","bush","shrub"],{w:1.5,h:1.2,d:1.5}],[["درخت","tree","trees","جنگل","forest"],{w:3,h:6,d:3}],
 // Animals without their own figure (their length runs front to back).
 [["پرنده","گنجشک","کبوتر","bird","pigeon","sparrow"],{w:0.12,h:0.2,d:0.3}],[["خرگوش","rabbit","bunny"],{w:0.2,h:0.25,d:0.4}],
 [["گوسفند","بره","sheep","lamb"],{w:0.5,h:0.9,d:1.2}],[["بز","goat"],{w:0.45,h:0.9,d:1.1}],[["گاو","cow"],{w:0.8,h:1.5,d:2.4}],
 [["آهو","گوزن","deer"],{w:0.4,h:1.3,d:1.5}],[["شتر","camel"],{w:0.8,h:2.2,d:2.8}],[["شیر","lion"],{w:0.7,h:1.2,d:2.2}],[["ماهی","fish"],{w:0.06,h:0.15,d:0.4}]
];
const KIND_SIZE:Partial<Record<SceneProp["kind"],{w:number;h:number;d:number}>>={object:{w:0.3,h:0.3,d:0.3},vehicle:{w:1.8,h:1.5,d:4.3},building:{w:10,h:14,d:10},tree:{w:3,h:6,d:3},animal:{w:0.4,h:0.5,d:0.8}};
/** A cube's real size in metres: Whoush's own estimate, else the everyday size of what its label names, else its kind's usual size (a 30 cm box). */
export function cubeDims(p:Pick<SceneProp,"kind"|"label">&{size?:SceneProp["size"]}):{w:number;h:number;d:number}{
 if(p.size)return p.size;
 const t=norm(p.label);
 return OBJECT_SIZES.find(([ws])=>ws.some(w=>t.includes(" "+w+" ")))?.[1]??KIND_SIZE[p.kind]??KIND_SIZE.object!;
}
/** Metres per stage unit sideways (the stage's ±1 is a 6 m wide set); depth is METERS_PER_Z. */
export const STAGE_X_M=3;
/** An object's footprint on the ground, metres across (x) and deep (z), turned with it. */
const footprint=(p:SceneProp)=>{const d=cubeDims(p),turned=Math.abs(Math.sin((p.facing??0)*Math.PI/180))>0.7;return turned?{x:d.d,z:d.w}:{x:d.w,z:d.d};};
/**
 * The object another one rests on: a larger object whose top covers its spot (a phone on a desk, a cup on a table). Objects only; the one with the
 * highest top wins, so a cup on a book on a desk rests on the book.
 */
export function supportOf(p:SceneProp,props:readonly SceneProp[]):SceneProp|undefined{
 if(p.kind!=="object")return undefined;
 const a=footprint(p),under=props.filter(q=>q!==p&&q.kind==="object"&&(()=>{const b=footprint(q);
  return b.x*b.z>a.x*a.z&&Math.abs((p.x-q.x)*STAGE_X_M)<=b.x/2&&Math.abs((p.z-q.z)*METERS_PER_Z)<=b.z/2;})());
 return under.sort((q,r)=>topOf(r,props)-topOf(q,props))[0];
}
/** How high something stands because it rests on other objects, metres (0 on the ground). */
export function stackLift(p:SceneProp,props:readonly SceneProp[],depth=0):number{
 const q=depth<4?supportOf(p,props):undefined;
 return q?stackLift(q,props,depth+1)+cubeDims(q).h:0;
}
const topOf=(q:SceneProp,props:readonly SceneProp[])=>stackLift(q,props,3)+cubeDims(q).h;
/** A prop's top-view image: a woman has her own. */
export function topAssetOf(p:Pick<SceneProp,"kind"|"label">&{size?:SceneProp["size"]}):string{
 if(p.kind==="person")return genderOf(p)==="female"&&VISUALS["woman-top"]?"woman-top":"human-top";
 const pet=petOf(p);
 if(pet==="cat")return "animal-top";
 const id=pet?pet+"-top-front":"cube-top-front";
 return VISUALS[id]?id:pet?pet+"-front":"cube-front";
}
/**
 * Soft tints for props of the same kind (four people, two cars): each one its own colour so they read apart; a prop alone of its kind stays plain.
 * No two tinted props share a colour.
 */
export const PROP_TINTS=["#f2b866","#6fcfb8","#f29bb8","#a99bf0","#93cc6e","#f09a6b"] as const;
export function propTints(props:readonly SceneProp[]):(string|undefined)[]{
 // Cubes (objects, vehicles, buildings) all look alike: several of them are told apart by colour, whatever they stand for.
 const kindOf=(p:SceneProp)=>isCube(p)?"cube":p.kind;
 const count=new Map<string,number>();for(const p of props)count.set(kindOf(p),(count.get(kindOf(p))??0)+1);
 let n=0;
 return props.map(p=>(count.get(kindOf(p))??0)>1?PROP_TINTS[n++%PROP_TINTS.length]:undefined);
}
export function propWidth(p:Pick<SceneProp,"kind"|"label">&{size?:SceneProp["size"]},h:number):number{
 if(isCube(p)){const d=cubeDims(p);return h*d.w/d.h;}
 const id=PROP_ASSETS[p.kind]?.front,a=id?VISUALS[id]:undefined;return a?h*a.width/a.height:h;
}
/**
 * The frame's camera: the scene is laid out once in fixed world positions (as a full shot frames it) and the shot size is a pure zoom `k` of that world
 * around `F`, the main subject's focus in the anchor scene (Whoush's original layout, so moving any prop never moves the zoom), plus the crop pan.
 * The frame is centred on that subject by default: `F` sits on the frame's vertical centre line, and, as the shot tightens, on its horizontal one too
 * (a full or wider shot keeps the ground where it is). screen = pan + C + k·(world − F). `visible` is the world rectangle on screen.
 */
/** Where each detail sits on a standing person, as a share of their height from the ground. */
export const DETAIL_HEIGHT:Record<NonNullable<Staging["focusDetail"]>,number>={face:0.88,eyes:0.9,jewelry:0.78,hands:0.45,feet:0.05};
export const FOCUS_DETAIL_FA:Record<NonNullable<Staging["focusDetail"]>,string>={face:"صورت",eyes:"چشم‌ها",hands:"دست‌ها",feet:"پاها و کفش",jewelry:"جواهر و اکسسوری"};
// ---- the frame as a lo-fi previz of the output: one physical camera (full-frame sensor, the lens and aperture Whoush or the user chose) ----
export const SENSOR_H_MM=24,PERSON_M=1.7,METERS_PER_Z=4,REF_FOCAL=35;
/** How far behind the main subject each kind of place's background stands, in metres: a room's back wall is close, mountains are far. */
const ENVIRONMENT_DISTANCE_M:Record<NonNullable<Staging["environment"]>,number>={landscape:200,room:5,studio:3,street:30,forest:22,beach:300,desert:250};
/** How far behind the main subject the background stands, metres: Whoush's estimate from the brief, else the place's usual distance. */
export const backdropM=(s:Staging)=>s.environmentDistance??ENVIRONMENT_DISTANCE_M[s.environment??"landscape"];
/** The background's distance range on the canvas, metres (a wall right behind the subject to mountains on the horizon). */
export const BACKDROP_RANGE=[1,3000] as const;
export const ENVIRONMENT_FA:Record<NonNullable<Staging["environment"]>,string>={landscape:"فضای باز",room:"داخل اتاق",studio:"استودیو",street:"خیابان و شهر",forest:"جنگل و پارک",beach:"ساحل",desert:"بیابان"};
const ENVIRONMENT_EN:Record<NonNullable<Staging["environment"]>,string>={landscape:"an open landscape",room:"an interior room",studio:"a photo studio with a seamless backdrop",street:"a city street",forest:"a forest or park",beach:"a beach by the sea",desert:"a desert"};
const clampN=(v:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,v));
/**
 * The camera as a real one: focal length f and aperture N (lensFor), and its distance d to the centre point, solved from the shot size so a medium shot stays
 * a medium shot at any lens (a longer lens moves the camera back): d = shot share × 1.7 m × f / 24. Props stand METERS_PER_Z per stage unit behind or in
 * front of the main subject. The same numbers reach the provider prompt (lensFor), so the frame and the prompt agree.
 */
export function physicalCamera(s:Staging){
 const l=lensFor(s),props=s.props??[],m=props.find(p=>p.main)??props[0];
 return {f:l.focalLengthMm,N:l.apertureF,d:Math.max(0.12,scaleOf(s)*PERSON_M*l.focalLengthMm/SENSOR_H_MM),zMain:m?.z??0};
}
/** A prop's distance from the camera, in metres. */
const distanceTo=(c:{d:number;zMain:number},z:number)=>Math.max(0.15,c.d+(z-c.zMain)*METERS_PER_Z);
/**
 * Lens perspective: how much bigger or smaller a prop at depth z looks than in the plain drawing (calibrated at 35 mm). A long lens compresses depth: the
 * background looms and near things shrink; a wide lens stretches it: near things loom and the background falls away. The main subject never changes.
 */
export function lensSizeFactor(s:Staging,z:number):number{
 const c=physicalCamera(s),dz=(z-c.zMain)*METERS_PER_Z,dRef=c.d*REF_FOCAL/c.f;
 const rel=c.d/Math.max(0.15,c.d+dz),relRef=dRef/Math.max(0.15,dRef+dz);
 return clampN(rel/relRef,0.35,3);
}
/** The far backdrop's size against the plain drawing: a long lens magnifies it (less of the environment fits), a wide lens shows more of it, smaller. */
export function backdropFactor(s:Staging):number{
 // The same perspective as a prop at the background's distance: far mountains grow with the focal length, a near wall hardly does.
 const c=physicalCamera(s),D=backdropM(s),dRef=c.d*REF_FOCAL/c.f;
 return clampN((c.d/(c.d+D))/(dRef/(dRef+D)),0.55,2.6);
}
/** Where the floor meets a room's back wall (or a studio's backdrop), as a stage depth for the frame's ground. */
export const wallDepth=(s:Staging)=>physicalCamera(s).zMain+backdropM(s)/METERS_PER_Z;
/**
 * Depth-of-field blur at depth z (or the far backdrop), as a share of the frame's height: the thin-lens circle of confusion, f²/(N(d−f)) · |x−d|/x on a
 * 24 mm sensor. The centre point's depth is sharp; f/1.8 at 85 mm melts the background, f/8 at 24 mm keeps everything sharp, a macro distance blurs all but a sliver.
 */
export function blurAt(s:Staging,z:number|"backdrop",focusZ?:number|"backdrop"):number{
 const c=physicalCamera(s),f=c.f,B=backdropM(s),x=(z==="backdrop"?c.d+B:distanceTo(c,z))*1000;
 // The focus plane: the main subject, or wherever the centre point was moved (focusDepth).
 const dmm=(focusZ===undefined?c.d:focusZ==="backdrop"?c.d+B:distanceTo(c,focusZ))*1000;
 const coc=(f*f)/(c.N*Math.max(1,dmm-f))*Math.abs(x-dmm)/x;
 return clampN(coc/SENSOR_H_MM,0,0.08);
}
/** Where the user put the focus (the centre point moved off the main subject), in words for the provider and for Whoush; empty on the main subject. */
function focusTarget(s:Staging){
 // A focus point placed in the frame says what it sits on.
 if(s.pivot){const on=s.pivot.on;if(on==="backdrop")return {en:"the far background",fa:"پس‌زمینهٔ دور"};if(on==="ground")return {en:"that spot on the ground",fa:"همان نقطه روی زمین"};
  const p=(s.props??[])[on];return p&&!p.main?{en:"the "+p.kind,fa:p.label}:undefined;}
 if(!s.focusPoint)return undefined;
 const {W,H}=frameSize("16:9"),z=focusDepth(s,undefined,W,H);
 if(z===undefined)return undefined;
 if(z==="backdrop")return {en:"the far background",fa:"پس‌زمینهٔ دور"};
 const p=(s.props??[]).find(x=>x.z===z&&!x.main);
 return p?{en:"the "+p.kind,fa:p.label}:{en:"that spot on the ground",fa:"همان نقطه روی زمین"};
}
const focusEn=(s:Staging)=>{const t=focusTarget(s);return t?", focus set on "+t.en+" (the main subject may be soft)":"";};
const focusFa=(s:Staging)=>{const t=focusTarget(s);return t?"، فوکوس روی "+t.fa:"";};
/**
 * The depth the camera focuses on: the main subject, unless the user moved the centre point; then whatever sits there: the frontmost prop under it, else
 * the ground at that spot, else (above the horizon) the far backdrop.
 */
export function focusDepth(s:Staging,anchor:Staging|undefined,W:number,H:number):number|"backdrop"|undefined{
 if(!s.focusPoint)return undefined;
 const cam=frameCamera(s,anchor,W,H),[fx,fy]=cam.F;
 const hit=(s.props??[]).filter(p=>{const v=propInView(p,W,H,cam.unitH),lf=lensSizeFactor(s,p.z),h=v.h*lf,w=propWidth(p,h),top=v.groundY-(v.groundY-v.y)*lf-h;
  return fx>=v.x-w/2&&fx<=v.x+w/2&&fy>=top&&fy<=v.groundY;}).sort((a,b)=>a.z-b.z)[0];
 if(hit)return hit.z;
 if(fy<=H*0.5)return "backdrop";
 return groundFromView(fx,fy,W,H).z;
}
/**
 * Where the horizon goes as the camera tilts up or down to keep the subject framed (as a share of the frame's height; negative is up): looking down from
 * above lifts it, looking up from below drops it; a longer lens moves it further.
 */
export function horizonShift(s:Staging):number{
 const e=elevationOf(s)*Math.PI/180,f=physicalCamera(s).f;
 return clampN(-Math.tan(e)*(f/(SENSOR_H_MM/2))*0.5,-1.4,1.4);
}

/**
 * Moves the frame's centre point to the world point now under screen point (sx, sy) without moving the picture: the crop pan absorbs the change, so the
 * dot follows the finger and only later zooms pivot around it. Returns the new centre point and crop (clamped to the crop's range).
 */
export function moveFocusPoint(s:Staging,anchor:Staging|undefined,W:number,H:number,sx:number,sy:number):{focusPoint:{x:number;y:number};framing:{x:number;y:number}}{
 const cam=frameCamera(s,anchor,W,H),[fx,fy]=cam.toWorld(sx,sy);
 const fp={x:fx/W,y:fy/H},moved=frameCamera({...s,focusPoint:fp},anchor,W,H);
 // Keep the world where it was: the same world point must stay at the same place on screen.
 const [a0,b0]=cam.base,[a1,b1]=moved.base,fr=s.framing??{x:0,y:0};
 const c=(v:number)=>Math.max(-1,Math.min(1,v));
 return {focusPoint:fp,framing:{x:c(fr.x+(a0-a1)/(W/2)),y:c(fr.y+(b0-b1)/(H/2))}};
}
/**
 * Where the frame's centre point (the zoom pivot: the dominant subject's face by default, its detail, or the dot the user moved) sits on the dominant
 * subject, for the camera diagrams' sight line: `height` as a share of the subject's height above its ground, `lateral` sideways in the camera's view
 * (ground units, positive to the right).
 */
export function centerOnSubject(s:Staging,anchor:Staging|undefined,aspect:string):{height:number;lateral:number}{
 const {W,H}=frameSize(aspect),cam=frameCamera(s,anchor,W,H),props=s.props??[],m=props.find(p=>p.main)??props[0];
 if(!m)return {height:0.5,lateral:0};
 const v=propInView(m,W,H,cam.unitH),spread=W*0.42*(1-depthT(m.z)*0.4);
 const c=(x:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,x));
 return {height:c((v.groundY-cam.F[1])/Math.max(v.h,1e-6),-0.3,1.8),lateral:c((cam.F[0]-v.x)/spread,-3,3)};
}
export function frameCamera(s:Staging,anchor:Staging|undefined,W:number,H:number){
 const WORLD=SHOT_BODY_FRACTION.full,unitH=H*0.92/WORLD,k=WORLD/Math.max(scaleOf(s),0.05),fr=s.framing??{x:0,y:0};
 const ap=(anchor??s).props??[],am=ap.find(p=>p.main)??ap[0];
 let F:[number,number]=[W/2,H*0.5];
 // The zoom centres on the part the shot is about: the head of a person by default, or the detail the brief names (hands, feet, jewelry...).
 if(am){const v=propInView(am,W,H,unitH);F=[v.x,v.y-v.h*(am.kind==="person"?DETAIL_HEIGHT[s.focusDetail??"face"]:0.5)];}
 // The user's own centre point (the dot they dragged) wins.
 if(s.focusPoint)F=[s.focusPoint.x*W,s.focusPoint.y*H];
 // The centre point sits on the frame's centre (plus the crop pan); the dominant subject's comes to the vertical centre as the shot tightens (a full shot keeps
 // the ground where it is), a centre point the user placed stays exactly where they put it at every zoom.
 const pan:[number,number]=[fr.x*W/2,fr.y*H/2],C:[number,number]=[W/2,s.focusPoint?H/2:F[1]+(H/2-F[1])*Math.max(0,Math.min(1,(k-1)/k))];
 // A Dutch angle rolls the whole picture about the frame's centre; `base` is the unrolled offset: screen = roll(base + k·world).
 const rot=rollOf(s),rr=rot*Math.PI/180,cr=Math.cos(rr),sr=Math.sin(rr),cx=W/2,cy=H/2;
 const roll=(x:number,y:number,dir=1):[number,number]=>[cx+(x-cx)*cr-dir*(y-cy)*sr,cy+dir*(x-cx)*sr+(y-cy)*cr];
 const base:[number,number]=[pan[0]+C[0]-k*F[0],pan[1]+C[1]-k*F[1]];
 const toWorld=(sx:number,sy:number):[number,number]=>{const [x,y]=roll(sx,sy,-1);return [(x-base[0])/k,(y-base[1])/k];};
 const corners=[toWorld(0,0),toWorld(W,0),toWorld(0,H),toWorld(W,H)];
 const l=Math.min(...corners.map(c=>c[0])),r=Math.max(...corners.map(c=>c[0])),t=Math.min(...corners.map(c=>c[1])),b=Math.max(...corners.map(c=>c[1]));
 return {unitH,k,F,pan,C,base,rot,toWorld,visible:{left:l,top:t,right:r,bottom:b},toScreen:(wx:number,wy:number):[number,number]=>roll(base[0]+k*wx,base[1]+k*wy),
  /** A drag on screen, as a move in the unrolled frame (so dragging right moves right even when the frame is tilted). */
  unroll:(dx:number,dy:number):[number,number]=>[dx*cr+dy*sr,-dx*sr+dy*cr]};
}
/** The camera's roll (Dutch angle) in degrees: set, or the planner's «dutch» at 14°. */
export const rollOf=(s:Staging)=>s.cameraRoll??(s.cameraAngle==="dutch"?14:0);
/** How far a prop may go out of the frame: its centre up to this share of its width past a side edge, its ground up to this share of its height below the bottom. */
const OUT_X=0.4,OUT_Z=0.6;
/**
 * Where a prop may be dragged at the current zoom and crop: the same reach on the left and on the right of the visible frame (and into the bottom edge),
 * so it can stand partly out of frame on any side; never further than the stage ranges.
 */
export function propReach(p:SceneProp,s:Staging,anchor:Staging|undefined,aspect:string):{xMin:number;xMax:number;zMin:number;zMax:number}{
 const {W,H}=frameSize(aspect),cam=frameCamera(s,anchor,W,H),v=propInView(p,W,H,cam.unitH),w=propWidth(p,v.h);
 const horizon=H*0.5,near=H*0.96,t=(p.z+1)/2,spread=W*0.42*(1-t*0.4);
 const gx=(vx:number)=>(vx-W/2)/spread;
 const tB=(near-(cam.visible.bottom+v.h*OUT_Z))/(near-horizon);
 const c=(v:number,[lo,hi]:readonly [number,number])=>Math.round(Math.max(lo,Math.min(hi,v))*100)/100;
 return {xMin:c(gx(cam.visible.left-w*OUT_X),PROP_X_RANGE),xMax:c(gx(cam.visible.right+w*OUT_X),PROP_X_RANGE),zMin:c(Math.min(-1,tB*2-1),PROP_Z_RANGE),zMax:PROP_Z_RANGE[1]};
}
/**
 * Which frame edges cut a prop as the canvas draws it (left, right, bottom). A bottom cut is listed only for a prop pulled closer than the stage: a tight shot
 * crops everything at ground level anyway, and the shot size already says so.
 */
export function propCuts(p:SceneProp,s:Staging,anchor:Staging|undefined,aspect:string):NonNullable<SceneProp["cut"]>{
 const {W,H}=frameSize(aspect),cam=frameCamera(s,anchor,W,H),v=propInView(p,W,H,cam.unitH),w=propWidth(p,v.h);
 const [x0]=cam.toScreen(v.x-w/2,0),[x1]=cam.toScreen(v.x+w/2,0),[,gy]=cam.toScreen(0,v.groundY);
 const out:NonNullable<SceneProp["cut"]>=[];
 if(x0<0)out.push("left");if(x1>W)out.push("right");if(!p.main&&p.z<-1&&gy>H+1)out.push("bottom");
 return out;
}
/** The scene with each prop's `cut` set from the frame as drawn, so the words for Whoush and the provider say exactly what the canvas shows. */
export function withFrameCuts(s:Staging,anchor:Staging|undefined,aspect:string):Staging{
 if(!s.props?.length)return s;
 return {...s,props:s.props.map(p=>{const {cut:_,...rest}=p;void _;const c=propCuts(rest,s,anchor,aspect);return c.length?{...rest,cut:c}:rest;})};
}

// ---- props by name: «#ماشین-قرمز», to point at them in the chat ----
/**
 * Each prop's tag, from its label (spaces become dashes); a repeated label gets its number: «#درخت», «#درخت-۲». The tag alone names the prop in the chat;
 * `withRefs` adds the references it is mapped to, as shown on the canvas: «#زن:تصویر-۱».
 */
export function propTags(props:readonly SceneProp[],withRefs=false):string[]{
 const seen=new Map<string,number>();
 return props.map(p=>{const b="#"+p.label.trim().replace(/[\s\u200c]+/g,"-");const n=(seen.get(b)??0)+1;seen.set(b,n);const t=n===1?b:b+"-"+fa2(n);
  return withRefs&&p.refs?.length?t+":"+p.refs.map(r=>displayTag(r).slice(1)).join("،"):t;});
}
/** Each light's tag: «#نور-۱», «#نور-۲», ... in the order of the lighting setup, to point at it in the chat. */
export const lightTags=(lights:readonly StagingLight[])=>lights.map((_,i)=>"#نور-"+fa2(i+1));
const MAP_RE=()=>/(?<![\p{L}\p{N}\p{M}\u200c_@#])#([\p{L}\p{N}\u200c\u0640-]+?):([\p{L}\u200c\u0640]+[-\u2010\u2011\u2013\u2212]?\p{N}+)(?![\p{L}\p{N}\p{M}\u200c\u0640_-])/gu;
/** The mappings the user typed («#زن:تصویر-۱»): which prop tag goes with which file, in order. */
export function typedMappings(text:string):{prop:string;file:string}[]{
 return [...text.matchAll(MAP_RE())].flatMap(m=>{const file=fileTagOf(m[2]);return file?[{prop:"#"+m[1],file}]:[];});
}
/** The brief as the planner reads it: a typed mapping «#زن:تصویر-۱» becomes «#زن (#تصویر-۱)», so the file is an ordinary mention (checked and described). */
export const expandMappings=(text:string)=>text.replace(MAP_RE(),(all,prop:string,word:string)=>fileTagOf(word)?"#"+prop+" (#"+word+")":all);
/** Applies the user's typed mappings to the props whose tags they name: that prop looks like that file (and no other prop does). They win over Whoush's own. */
export function applyTypedMappings(props:readonly SceneProp[]|undefined,maps:readonly {prop:string;file:string}[]):SceneProp[]|undefined{
 if(!props?.length||!maps.length)return props?[...props]:props;
 const tags=propTags(props).map(normalizeMentionText);
 let out=props.map(p=>({...p}));
 for(const m of maps){
  const i=tags.indexOf(normalizeMentionText(m.prop));if(i<0)continue;
  out=out.map((p,j)=>j===i?p:{...p,refs:p.refs?.filter(r=>r!==m.file)}).map(p=>p.refs?.length===0?(({refs:_,...q})=>{void _;return q;})(p):p);
  if(!(out[i].refs??[]).includes(m.file))out[i]={...out[i],refs:[...(out[i].refs??[]),m.file].slice(-4)};
 }
 return out;
}
/** Roles of a reference that describe a person (or an animal character); an object reference describes a product (or a vehicle). */
const LOOK_ROLES=["character","outfit","hairstyle","makeup"];
/**
 * Maps the user's image references to the props they show: a character, outfit, hairstyle or makeup reference to the person (the main one first, else an
 * animal), an object reference to the object (else a vehicle). Others (environment, frames, motion, sound) describe no prop. Existing mappings are kept.
 */
export function mapReferences(props:readonly SceneProp[]|undefined,refs:readonly {tag:string;kind:string;role:string;/** Overrides the role's usual prop (a tattoo photo describes the person). */mapsTo?:"person"|"object"}[]):SceneProp[]|undefined{
 if(!props?.length||!refs.length)return props?[...props]:props;
 const out=props.map(p=>({...p}));
 const pick=(ok:(p:SceneProp)=>boolean)=>out.find(p=>p.main&&ok(p))??out.find(ok);
 const taken=new Set(out.flatMap(p=>p.refs??[]));
 for(const r of refs){
  if(r.kind!=="image"||taken.has(r.tag))continue;
  const toPerson=r.mapsTo?r.mapsTo==="person":LOOK_ROLES.includes(r.role),toObject=r.mapsTo?r.mapsTo==="object":r.role==="object"||r.role==="graphic";
  const t=toPerson?pick(p=>p.kind==="person")??pick(p=>p.kind==="animal"):toObject?pick(p=>p.kind==="object")??pick(p=>p.kind==="vehicle"):undefined;
  if(t&&!(t.refs??[]).includes(r.tag)&&(t.refs?.length??0)<4)t.refs=[...(t.refs??[]),r.tag];
 }
 return out;
}

// ---- the camera's orbit and each prop's facing ----
/** An angle in (-180, 180]. */
export const wrap180=(d:number)=>{const v=((d%360)+540)%360-180;return v===-180?180:v;};
/** The way a prop faces the camera (degrees, 0 faces it): set, or its kind's natural view (vehicles and animals are seen side on, facing frame right). */
export const facingOf=(p:SceneProp)=>p.facing??(p.kind==="vehicle"||p.kind==="animal"?90:0);
/**
 * Orbits the camera by `delta` degrees around the main subject (positive: the camera moves to the viewer's right). The scene is kept as the camera sees it,
 * so everything turns the other way: props swing around the main subject on the ground, each prop shows another side (its facing turns by −delta) and
 * the lights keep their place in the world (their angle around the subject, as the camera sees it, turns by +delta). Exact (unrounded), so orbiting there
 * and back returns the same scene.
 */
export function orbitCamera(s:Staging,delta:number):Staging{
 if(!Number.isFinite(delta)||delta===0)return s;
 const a=delta*Math.PI/180,c=Math.cos(a),n=Math.sin(a),props=s.props??[],m=props.find(p=>p.main)??props[0],px=m?.x??0,pz=m?.z??0;
 const lim=(v:number,[lo,hi]:readonly [number,number])=>Math.max(lo,Math.min(hi,v));
 return {...s,cameraAzimuth:wrap180((s.cameraAzimuth??0)+delta),
  ...(s.props?{props:props.map(p=>{const dx=p.x-px,dz=p.z-pz;const {cut:_,...q}=p;void _;
   return {...q,x:lim(px+dx*c+dz*n,PROP_X_RANGE),z:lim(pz-dx*n+dz*c,PROP_Z_RANGE),facing:wrap180(facingOf(p)-delta)};})}:{}),
  lights:s.lights.map(l=>{const g=lightAngleOf(l);if(g===undefined)return l;const deg=((g+delta)%360+360)%360;return {...l,angle:deg,direction:snapDirection(deg)};})};
}
/** Which way a prop faces, in words (only when it has been set): toward the camera, its back, in profile or three-quarter, toward frame left or right. */
export function facingFa(f:number):string{
 const a=Math.abs(wrap180(f)),side=f>0?"رو به راست کادر":"رو به چپ کادر";
 return a<25?"رو به دوربین":a>155?"پشت به دوربین":a<65?"سه‌رخ، "+side:a<=115?"نیم‌رخ، "+side:"سه‌رخ از پشت، "+side;
}
export function facingEn(f:number):string{
 const a=Math.abs(wrap180(f)),side=f>0?"turned toward frame right":"turned toward frame left";
 return a<25?"facing the camera":a>155?"back to the camera":a<65?"three-quarter view, "+side:a<=115?"in profile, "+side:"three-quarter from behind, "+side;
}
/** The camera's orbit in words, from Whoush's view: «۹۰° دور سوژه، از سمت راستش». */
export function orbitFa(az:number):string{
 const a=Math.round(wrap180(az));if(Math.abs(a)<1)return "روبه‌رو";
 return Math.abs(a)>=170?"از پشت سوژه":fa2(Math.abs(a))+"° دور سوژه، "+(a>0?"به راست":"به چپ");
}
const fa2=(n:number)=>String(n).replace(/\d/g,d=>"۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
export function orbitEn(az:number):string{
 const a=Math.round(wrap180(az));if(Math.abs(a)<1)return "";
 return Math.abs(a)>=170?"camera orbited behind the main subject ("+a+"°)":"camera orbited "+Math.abs(a)+"° around the main subject to the viewer's "+(a>0?"right":"left");
}

// ---- the lens for the scene: Whoush picks the focal length and aperture that serve what the scene shows ----
export type LensChoice={focalLengthMm:number;aperture:string;apertureF:number;iso:number;macro:boolean;deep:boolean;auto:{lens:boolean;aperture:boolean};
 /** Why, in Persian, for the plan («پرتره نزدیک: لنز ۸۵ میلی‌متری با دیافراگم f/1.8 برای پس‌زمینهٔ محو») */fa:string;
 /** The provider-facing direction */en:string};
/**
 * The lens a professional would choose for this scene, from what it shows: how tight the shot is (the zoom), what the subject is, how many subjects must
 * stay sharp and how far apart they stand, and how steep the camera is.
 * - Landscapes and wide shots: a wide lens (16 to 28mm) stopped down (f/8) so everything is sharp.
 * - A very tight shot of an object or animal: a 100mm macro at f/5.6 (macro depth of field is paper thin; stopping down keeps the detail).
 * - Portraits: 85mm wide open (f/1.8 to f/2) for a soft background; a product close-up: 100mm at f/4.
 * - A full or medium shot: 35 to 50mm; another subject that must stay sharp at a different depth stops it down (f/5.6).
 * - A steep worm's-eye or bird's-eye camera: a wider lens for the dramatic perspective.
 */
/** Focal length by the shot's tightness (body share), interpolated on log scales between a photographer's usual choices: 85mm for a head and shoulders, 50mm
 * for a medium shot, 35mm full length, 24mm wide, 16mm extremely wide. */
const FOCAL_ANCHORS:[number,number][]=[[0.32,85],[0.5,50],[1.1,35],[2.4,24],[5,16]];
function focalForScale(sc:number,fallback:number):number{
 const a=FOCAL_ANCHORS;if(sc<=a[0][0])return Math.max(fallback,a[0][1]);if(sc>=a[a.length-1][0])return a[a.length-1][1];
 for(let i=1;i<a.length;i++)if(sc<=a[i][0]){const [s0,f0]=a[i-1],[s1,f1]=a[i],t=Math.log(sc/s0)/Math.log(s1/s0);return Math.round(Math.exp(Math.log(f0)+t*(Math.log(f1)-Math.log(f0))));}
 return fallback;
}
export function lensFor(s:Staging):LensChoice{
 const sc=scaleOf(s),subject=s.subject??"person",props=s.props??[],main=props.find(p=>p.main)??props[0];
 const kind=main?.kind??(subject==="environment"?undefined:subject);
 const others=props.filter(p=>p!==main&&(p.kind==="person"||p.kind==="animal"||p.kind==="vehicle"||p.kind==="object"));
 const depthSpread=others.length&&main?Math.max(...others.map(p=>Math.abs(p.z-main.z))):0;
 const elev=elevationOf(s);
 let f:number,ap:number,macro=false,why:string;
 const detail=kind==="person"?s.focusDetail:undefined;
 if(detail&&detail!=="face"&&sc<=0.3){
  // A detail of a person, close: eyes and jewelry are macro work (100mm, stopped down a little); hands and shoes a 100mm with a soft background.
  f=100;macro=detail==="eyes"||detail==="jewelry";ap=macro?4:2.8;why="نمای جزئیات "+FOCUS_DETAIL_FA[detail];
 }
 else if(subject==="environment"||sc>=2.4){f=sc>=5?16:24;ap=8;why="نمای باز";}
 else if(sc<=0.12&&kind&&kind!=="person"){f=100;ap=5.6;macro=true;why="ماکرو";}
 else if(sc<=0.25){if(kind==="person"){f=85;ap=1.8;why="پرترهٔ نزدیک";}else{f=100;ap=4;why="نمای نزدیک";}}
 else if(sc<=0.4){f=85;ap=kind==="person"?2:2.8;why="نمای سر و شانه";}
 else if(sc<=0.6){f=50;ap=2.8;why="نمای متوسط";}
 else if(sc<=1.2){f=35;ap=4;why="نمای تمام‌قد";}
 else{f=28;ap=5.6;why="نمای نیمه‌باز";}
 // The focal length follows the camera's distance smoothly (between the anchors above), so moving the camera always updates the lens; macro and detail work
 // keep their 100mm.
 if(!macro&&f!==100)f=focalForScale(sc,f);
 // Another subject that must also be sharp, at another depth: stop down.
 const together=others.length>0&&depthSpread>0.4&&!macro&&ap<5.6;
 if(together)ap=5.6;
 // A steep camera: a wider lens for the perspective (not for a macro).
 const steep=!macro&&(elev<=-30||elev>=60);
 if(steep)f=Math.min(f,elev<=-30?24:28);
 // Low light (fire, candles, a lamp, the moon, or very warm light only): open up a stop and raise the ISO instead of losing the shot to noise or blur.
 const lowLight=s.lights.length>0&&s.lights.every(l=>l.source==="fire"||l.source==="practical"||l.source==="moon"||l.colorTemperatureK<=2400);
 if(lowLight&&!macro)ap=Math.max(1.4,ap>=8?4:ap>=5.6?2.8:ap>=4?2:ap);
 // The user's own lens and aperture win over Whoush's pick.
 const userLens=s.lensMm!==undefined,userAp=s.apertureF!==undefined;
 if(userLens){f=Math.round(s.lensMm!);macro=false;}
 if(userAp)ap=Math.round(s.apertureF!*10)/10;
 if(userLens||userAp)why="تنظیم تو";
 const iso=lowLight?1600:sc>=2.4?100:200;
 const deep=ap>=5.6;
 const apText="f/"+(ap<4||!Number.isInteger(ap)?ap.toFixed(1):String(ap));
 const n=(x:number)=>String(x).replace(/\d/g,d=>"۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
 const fa=why+": لنز "+(s.fisheye?"چشم‌ماهی ":"")+(macro?"ماکرو ":"")+n(f)+" میلی‌متری با دیافراگم "+apText+(deep?(together?" تا همهٔ سوژه‌ها واضح بمانند":" تا همه‌چیز واضح بماند"):" برای پس‌زمینهٔ محو (بوکه)")+(steep?"؛ زاویهٔ تند دوربین، لنز بازتر":"")+(lowLight?"؛ نور کم، دیافراگم بازتر و ISO "+n(iso):"")+(detail?"؛ فوکوس روی "+FOCUS_DETAIL_FA[detail]:"");
 const en="Lens: "+f+"mm"+(macro?" macro":"")+(s.fisheye?" fisheye (strong barrel distortion: the picture bulges from the centre and straight lines bow)":"")+" at "+apText+(deep?", deep focus"+(together?" keeping every subject sharp":""):", shallow depth of field with soft bokeh")+(steep?", wide for the steep perspective":"")+(lowLight?", low light: ISO "+iso:"")+(detail?", focus on the subject's "+(detail==="feet"?"feet and shoes":detail)+"":"")+".";
 return {focalLengthMm:f,aperture:apText,apertureF:ap,iso,macro,deep,fa,en,auto:{lens:!userLens,aperture:!userAp}};
}

// ---- continuous adjustment (smooth controls; the named values are the nearest description) ----
const SHOT_ORDER=Object.entries(SHOT_BODY_FRACTION) as [Staging["shotSize"],number][];
/** The shot size whose body share is nearest (on a log scale) to a continuous zoom. */
export function nearestShot(scale:number):Staging["shotSize"]{
 return SHOT_ORDER.reduce((b,c)=>Math.abs(Math.log(c[1]/scale))<Math.abs(Math.log(b[1]/scale))?c:b)[0];
}
/** The zoom bar runs on a log scale from the tightest close-up to the widest shot: position 0..1 ↔ body share. */
export const ZOOM_RANGE=[0.09,5] as const;
export const scaleFromSlider=(v:number)=>Math.round(Math.exp(Math.log(ZOOM_RANGE[0])+v*(Math.log(ZOOM_RANGE[1])-Math.log(ZOOM_RANGE[0])))*1000)/1000;
export const sliderFromScale=(s:number)=>(Math.log(Math.min(ZOOM_RANGE[1],Math.max(ZOOM_RANGE[0],s)))-Math.log(ZOOM_RANGE[0]))/(Math.log(ZOOM_RANGE[1])-Math.log(ZOOM_RANGE[0]));
/** The effective values of a staging: exact ones when set, otherwise the named ones. */
export const elevationOf=(s:Staging)=>s.cameraElevation??CAMERA_ELEVATION[s.cameraAngle];
export const scaleOf=(s:Staging)=>s.shotScale??SHOT_BODY_FRACTION[s.shotSize];
/** A light's strength, 0 to 1: set, or its role's usual share (a key light leads, a fill sits well under it, a rim and practicals in between). */
const ROLE_INTENSITY:Record<StagingLight["role"],number>={key:1,fill:0.45,rim:0.7,background:0.55,practical:0.55};
export const intensityOf=(l:StagingLight)=>l.intensity??ROLE_INTENSITY[l.role];
export const intensityFa=(v:number)=>String(Math.round(v*100)).replace(/\d/g,d=>"۰۱۲۳۴۵۶۷۸۹"[Number(d)])+"٪";
export const lightAngleOf=(l:StagingLight)=>l.angle??(l.direction==="top"?undefined:LIGHT_ANGLE[l.direction]);
/** Zoom relative to a full shot, for people: «۱٫۸×» closer, «۰٫۵×» wider. */
export const zoomFactor=(s:Staging)=>Math.round(SHOT_BODY_FRACTION.full/scaleOf(s)*10)/10;

// ---- which part of «بوم» a message is about (a follow-up that changes one thing shows only that part: less is more) ----
/** The canvas's parts: the frame (crop, layout), the camera's angle (height, orbit, tilt, shot type), its distance (the zoom), the lens and aperture, the light. */
export const CANVAS_SECTIONS=["frame","angle","distance","lens","light"] as const;
export type CanvasSection=typeof CANVAS_SECTIONS[number];
export const CANVAS_SECTION_FA:Record<CanvasSection,string>={frame:"کادر و چیدمان",angle:"زاویهٔ دوربین",distance:"فاصلهٔ دوربین",lens:"لنز و دیافراگم",light:"نورپردازی"};
/** An older saved focus: «camera» meant all of the camera's parts. */
export const expandFocus=(f:readonly string[]):CanvasSection[]=>[...new Set(f.flatMap(x=>x==="camera"?["angle","distance","lens"] as CanvasSection[]:(CANVAS_SECTIONS as readonly string[]).includes(x)?[x as CanvasSection]:[]))];
const SECTION_CUES:Record<CanvasSection,string[]>={
 angle:["hero view","hero shot","hero angle","low angle","high angle","from above","from below","overhead","birds eye","worms eye","dutch","tilt","pov","over the shoulder","orbit","behind","side view","profile","eye level",
  "قهرمانی","از بالا","از پایین","از پشت","نیم رخ","سه رخ","روبرو","روبه رو","داچ","کج","دید سوژه","روی شانه","هم سطح","بالاتر","پایین تر","پایینتر","بچرخ","بچرخون","چرخش"],
 distance:["closer","further","farther","zoom","zoom in","zoom out","distance","nearer","back up","step back",
  "نزدیک","نزدیکتر","نزدیک تر","دور","دورتر","دور تر","زوم","فاصله","عقب تر","جلوتر"],
 lens:["lens","aperture","bokeh","focal","blur the background","depth of field","لنز","دیافراگم","بوکه","فاصله کانونی","پس زمینه محو","عمق میدان"],
 frame:["frame","framing","crop","close up","closeup","wide shot","full body","composition","layout","کادر","کراپ","کلوزآپ","کلوز آپ","نمای باز","نمای بسته","ترکیب بندی","چیدمان","جابه جا","جابجا","تمام قد","وسط کادر"],
 light:["light","lighting","lights","shadow","shadows","sunset","golden hour","backlit","backlight","rim light","neon","brighter","darker","نور","نورپردازی","سایه","غروب","ضدنور","نئون","روشن تر","تاریک تر","روشنتر","تاریکتر"]
};
/** «camera» or «angle» alone, without saying what about it: the camera's angle. */
const CAMERA_WORDS=["camera","angle","camera angle","دوربین","زاویه","زاویهٔ","زاویه‌ی","زاویه ی"];
/**
 * The parts of «بوم» a message talks about, from its words (normalized text, ZWNJ as a space). The action decides: «زاویه دوربین رو نزدیک‌تر کن» is about
 * the camera's distance; «camera» or «زاویه» without a specific action is about the angle.
 */
export function sectionsFromWords(normalizedText:string):CanvasSection[]{
 const t=" "+normalizedText.toLowerCase().replace(/[\u200c،,.!?؟:;«»"()]/g," ").replace(/\s+/g," ")+" ";
 const has=(w:string)=>t.includes(" "+w.replace(/\u200c/g," ")+" ");
 const found=CANVAS_SECTIONS.filter(sec=>SECTION_CUES[sec].some(has));
 if(!found.some(f=>f==="angle"||f==="distance"||f==="lens")&&CAMERA_WORDS.some(has))found.push("angle");
 return CANVAS_SECTIONS.filter(s=>found.includes(s));
}
/** The parts of «بوم» that differ between two scenes (a revision's plan against the generation it revises). */
export function stagingSections(a:Staging,b:Staging):CanvasSection[]{
 const keys:Record<Exclude<CanvasSection,"light">,(keyof Staging)[]>={
  frame:["framing","focusPoint","pivot","focusDetail","props","environmentDistance"],angle:["cameraAngle","cameraElevation","cameraAzimuth","cameraRoll","shotStyle"],
  distance:["shotSize","shotScale"],lens:["lensMm","apertureF","autopilot","fisheye"]};
 const pick=(s:Staging,k:(keyof Staging)[])=>JSON.stringify(k.map(x=>s[x]??null));
 return CANVAS_SECTIONS.filter(sec=>sec==="light"?JSON.stringify(a.lights)!==JSON.stringify(b.lights):pick(a,keys[sec])!==pick(b,keys[sec]));
}
/**
 * The focus of a follow-up's «بوم» widget: the parts its words name, else the parts that changed from the previous scene, when that is not everything.
 * Undefined (the whole canvas) for a first generation or a change to everything.
 */
export function followUpFocus(normalizedText:string,previous:Staging|undefined,next:Staging|undefined):CanvasSection[]|undefined{
 if(!previous||!next)return undefined;
 const words=sectionsFromWords(normalizedText);
 const f=words.length?words:stagingSections(previous,next);
 return f.length>0&&f.length<=3?f:undefined;
}

// ---- reading the brief: what the user said explicitly always wins over a planner's choice ----
const CUES={
 angle:[["birds_eye",["from above","top down","top-down","overhead","birds eye","bird's eye","drone shot","aerial view","از بالا","نمای بالا","نمای هوایی","هوایی","پهپاد"]],["worms_eye",["worms eye","worm's eye","from the ground","از روی زمین","از کف زمین"]],["low",["low angle","from below","hero view","hero shot","hero angle","heroic angle","نمای قهرمانی","زاویهٔ قهرمانی","زاویه قهرمانی","زاویه پایین","زاویهٔ پایین","از پایین"]],["high",["high angle","زاویه بالا","زاویهٔ بالا"]],["dutch",["dutch angle","tilted angle","زاویه کج","زاویهٔ کج","کج"]],["eye_level",["eye level","هم سطح چشم","همسطح چشم"]]] as [Staging["cameraAngle"],string[]][],
 shot:[["extreme_close_up",["extreme close up","extreme closeup","macro","ماکرو","خیلی نزدیک"]],["close_up",["close up","closeup","close-up","کلوزآپ","کلوز آپ","نمای نزدیک"]],["medium_close_up",["medium close up","head and shoulders","سر و شانه"]],["medium",["medium shot","waist up","نمای متوسط","تا کمر"]],["medium_full",["knees up","تا زانو"]],["full",["full body","full length","full shot","تمام قد","تمام‌قد","کل بدن"]],["extreme_wide",["extreme wide","خیلی باز"]],["wide",["wide shot","wide angle","نمای باز","نمای عریض"]]] as [Staging["shotSize"],string[]][],
 side:[[-1/3,["on the left","left side","سمت چپ","طرف چپ"]],[1/3,["on the right","right side","سمت راست","طرف راست"]],[0,["centered","in the center","in the middle","وسط کادر","وسط قاب"]]] as [number,string[]][]
};
const ENVIRONMENT_CUES:[NonNullable<Staging["environment"]>,string[]][]=[
 ["studio",["studio","photo studio","seamless","white background","plain background","استودیو","آتلیه","پس زمینه سفید","بک گراند سفید","پس زمینه ساده"]],
 ["room",["room","indoor","indoors","interior","cafe","café","coffee shop","restaurant","kitchen","bedroom","living room","office","classroom","hall","home","house","bar",
  "اتاق","داخل","کافه","کافی شاپ","رستوران","آشپزخانه","آشپزخونه","اتاق خواب","پذیرایی","دفتر","کلاس","سالن","خانه","خونه","مغازه"]],
 ["street",["street","city","alley","downtown","urban","sidewalk","market","bazaar","خیابان","خیابون","کوچه","شهر","بازار","پیاده رو","میدان"]],
 ["forest",["forest","woods","park","garden","jungle","جنگل","پارک","باغ","درختان"]],
 ["beach",["beach","sea","ocean","shore","coast","ساحل","دریا","اقیانوس","کنار دریا"]],
 ["desert",["desert","dunes","sand dunes","بیابان","کویر","صحرا","تپه های شنی"]],
 ["landscape",["mountain","mountains","landscape","field","meadow","valley","کوه","کوهستان","دشت","دره","چمنزار"]]
];
const DETAIL_CUES:[NonNullable<Staging["focusDetail"]>,string[]][]=[
 ["eyes",["eyes","close up of the eye","چشم","چشم‌ها","چشمها","چشماش"]],
 ["jewelry",["ring","necklace","earring","earrings","bracelet","jewelry","انگشتر","گردنبند","گوشواره","دستبند","جواهر"]],
 ["feet",["shoes","shoe","sneakers","boots","feet","کفش","کفشش","کفش‌ها","کتونی","چکمه","پاهاش"]],
 ["hands",["hands","دست","دست‌ها","دستاش","دستهاش"]],
 ["face",["face","portrait","صورت","چهره","صورتش","پرتره"]]
];
const LIGHT_CUES:{words:string[];apply:(key:StagingLight)=>StagingLight}[]=[
 {words:["backlit","backlight","rim lit","ضدنور","نور از پشت"],apply:l=>({...l,direction:"back",angle:undefined})},
 {words:["side light","side lit","نور کناری","نور از کنار"],apply:l=>({...l,direction:"left",angle:undefined})},
 {words:["window light","natural window","نور پنجره"],apply:l=>({...l,source:"window",quality:"soft"})},
 {words:["golden hour","sunset","غروب","نور طلایی"],apply:l=>({...l,source:"sun",colorTemperatureK:3500,height:"low"})},
 {words:["candle light","candlelight","شمع","fire light","نور آتش"],apply:l=>({...l,source:"fire",colorTemperatureK:1900,quality:"soft"})},
 {words:["neon","نئون"],apply:l=>({...l,source:"neon",colorHex:l.colorHex??"#4f8cff"})},
 {words:["hard light","harsh light","نور سخت","نور تند"],apply:l=>({...l,quality:"hard"})},
 {words:["soft light","diffused light","نور نرم","نور ملایم"],apply:l=>({...l,quality:"soft"})}
];
/**
 * Applies what the brief says explicitly (camera angle, shot size, left/right placement, lighting words) to a staging, so the canvas and the provider prompt
 * follow the user's own words before any planner choice. Words not present change nothing. The key light is the first light (or the first «key»).
 */
export function applyStagingCues(s:Staging,normalizedText:string):Staging{
 const t=" "+normalizedText+" ",has=(w:string)=>t.includes(" "+w+" ");
 const angle=CUES.angle.find(([,ws])=>ws.some(has))?.[0],shot=CUES.shot.find(([,ws])=>ws.some(has))?.[0],side=CUES.side.find(([,ws])=>ws.some(has))?.[0];
 const ki=Math.max(0,s.lights.findIndex(l=>l.role==="key"));
 let key=s.lights[ki];for(const c of LIGHT_CUES)if(c.words.some(has))key=c.apply(key);
 const {framing:_planned,...rest}=s;void _planned;
 // Which way the main subject faces: «از پشت» / "from behind" shows its back, «نیم‌رخ» / "profile" its side (a light «از پشت» is a light cue, not this).
 const back=["from behind","back view","rear view","از پشت سر","نمای پشت"].some(has)||(has("از پشت")&&!t.includes(" نور از پشت")),profile=["profile","side view","نیم رخ","نیمرخ","نیم‌رخ","از بغل"].some(has);
 const facing=back?180:profile?90:undefined,mi=(s.props??[]).findIndex(p=>p.main);
 // The kind of place (room, studio, street, forest, beach, desert, else open land), unless the scene already has one.
 // A fisheye lens, when the brief asks for one.
 if(["fisheye","fish eye","fish-eye","فیش آی","فیش‌آی","فیشای","چشم ماهی","چشم‌ماهی"].some(has))rest.fisheye=true;
 const env=ENVIRONMENT_CUES.find(([,ws])=>ws.some(has))?.[0];
 if(env&&!rest.environment)rest.environment=env;
 // The part of the subject the brief is about (the dominant detail): the frame and the lens centre on it.
 // How far the background is, from the brief's words: right behind the subject, or far away (unless the planner already estimated it).
 const near=["against the wall","in front of a wall","right behind","close behind","جلوی دیوار","کنار دیوار","چسبیده به دیوار","به دیوار تکیه","پشت سرش دیوار"].some(has);
 const far=["far away","in the distance","on the horizon","distant mountains","دوردست","در دوردست","خیلی دور","در افق","کوه های دور","کوههای دور"].some(has);
 if(rest.environmentDistance===undefined&&(near||far)){const d=ENVIRONMENT_DISTANCE_M[rest.environment??"landscape"];rest.environmentDistance=near?Math.min(2,d):Math.min(BACKDROP_RANGE[1],d*4);}
 const detail=DETAIL_CUES.find(([,ws])=>ws.some(has))?.[0];
 if(detail)rest.focusDetail=detail;
 if(facing!==undefined&&mi>=0)rest.props=s.props!.map((p,i)=>i===mi?{...p,facing}:p);
 return {...rest,...(angle?{cameraAngle:angle,cameraElevation:undefined}:{}),...(shot?{shotSize:shot,shotScale:undefined}:{}),
  // The frame is centred by default: only the user's own words (or the canvas) move the subject off centre.
  ...(side?{framing:{x:side,y:0}}:{}),lights:s.lights.map((l,i)=>i===ki?key:l)};
}
