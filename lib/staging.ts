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
 return "صحنهٔ تنظیم‌شده: زاویهٔ دوربین «"+CAMERA_ANGLE_FA[s.cameraAngle]+"»"+(s.cameraElevation!==undefined?" ("+Math.round(s.cameraElevation)+" درجه)":"")+"، کادر «"+SHOT_SIZE_FA[s.shotSize]+"»"+(s.shotScale!==undefined?" (زوم "+zoomFactor(s)+"×)":"")+(s.subject?"، سوژه: "+SUBJECT_FA[s.subject]:"")+"، جای سوژه: "+placementFa(s.framing)+(s.props?.length?"؛ "+describeLayoutFa(s.props):"")+"؛ "+lights.join("؛ ");
}
/** The arranged scene in English, appended to the provider-facing media prompt. */
export function describeStagingEn(s:Staging):string{
 const lights=s.lights.map(l=>l.role+" light: "+l.quality+" "+l.source.replace("_"," ")+" from "+DIR_EN[l.direction]+(l.angle!==undefined?" ("+Math.round(l.angle)+"° in top view)":"")+", "+l.height+" height, "+l.colorTemperatureK+"K"+(l.colorHex?" "+l.colorHex+" gel":""));
 return "Staging: "+ANGLE_EN[s.cameraAngle]+" camera"+(s.cameraElevation!==undefined?" ("+Math.round(s.cameraElevation)+"° from eye level)":"")+", "+SHOT_EN[s.shotSize]+(s.shotScale!==undefined?" ("+zoomFactor(s)+"x of a full shot)":"")+", "+placementEn(s.framing)+"; "+lights.join("; ")+"."+(s.props?.length?" "+describeLayoutEn(s.props):"");
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
 const eb=elevationOf(before),ea=elevationOf(after);
 if(before.cameraAngle!==after.cameraAngle||Math.abs(eb-ea)>=2)out.push("زاویهٔ دوربین: "+arrow(CAMERA_ANGLE_FA[before.cameraAngle]+" ("+Math.round(eb)+"°)",CAMERA_ANGLE_FA[after.cameraAngle]+" ("+Math.round(ea)+"°)"));
 if(before.shotSize!==after.shotSize||Math.abs(Math.log(scaleOf(before)/scaleOf(after)))>0.03)out.push("کادر: "+arrow(SHOT_SIZE_FA[before.shotSize]+" (زوم "+zoomFactor(before)+"×)",SHOT_SIZE_FA[after.shotSize]+" (زوم "+zoomFactor(after)+"×)"));
 if(placementFa(before.framing)!==placementFa(after.framing))out.push("جای سوژه: "+arrow(placementFa(before.framing),placementFa(after.framing)));
 // Props: matched by position in the list (the editor never reorders them); moved, added and removed ones are named.
 const pb=before.props??[],pa=after.props??[];
 for(let i=0;i<Math.max(pb.length,pa.length);i++){
  const a=pb[i],b=pa[i];
  if(!a&&b){out.push("اضافه: "+b.label+" ("+propPlaceFa(b)+")");continue;}
  if(a&&!b){out.push("حذف: "+a.label);continue;}
  if(propPlaceFa(a)!==propPlaceFa(b))out.push(b.label+": "+arrow(propPlaceFa(a),propPlaceFa(b)));
 }
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
export const PROP_ASSETS:Record<SceneProp["kind"],{front:string;top:string}>={person:{front:"person-front",top:"person-top"},object:{front:"object-side",top:"object-top"},animal:{front:"animal-side",top:"animal-top"},vehicle:{front:"vehicle-side",top:"vehicle-top"},tree:{front:"env-tree",top:"tree-top"},building:{front:"env-building",top:"building-top"}};
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
const sideFa=(x:number)=>x<-0.33?"سمت چپ":x>0.33?"سمت راست":"وسط";
const depthFa=(z:number)=>z<-0.33?"جلو":z>0.33?"عقب":"وسط عمق";
const sideEn=(x:number)=>x<-0.33?"left":x>0.33?"right":"centre";
const depthEn=(z:number)=>z<-0.33?"foreground":z>0.33?"background":"midground";
/** Where a prop stands, in Persian: «سمت راست، عقب، بالاتر از زمین». */
export const propPlaceFa=(p:SceneProp)=>sideFa(p.x)+"، "+depthFa(p.z)+(p.y>0.15?"، بالاتر از زمین":"");
/** The scene layout in Persian («چیدمان: زن (اصلی) وسط، جلو؛ ماشین سمت راست، عقب»), empty without props. */
export function describeLayoutFa(props?:readonly SceneProp[]):string{
 return props?.length?"چیدمان: "+props.map(p=>p.label+(p.main?" (اصلی)":"")+" "+propPlaceFa(p)).join("؛ "):"";
}
/** The scene layout in English for the provider prompt, without the Persian labels (kinds only). */
export function describeLayoutEn(props?:readonly SceneProp[]):string{
 return props?.length?"Layout: "+props.map(p=>p.kind+(p.main?" (main subject)":"")+" "+sideEn(p.x)+" "+depthEn(p.z)+(p.y>0.15?", raised":"")).join("; ")+".":"";
}
/**
 * Tidies a planner's props (never the user's own arrangement): props crowded onto one spot get the default layout (main subject centre front, the others
 * alternating behind it), and when every prop is lifted, `y` was misread as height and is reset to the ground. Order: main subject first.
 */
export function tidyProps(props?:readonly SceneProp[]):SceneProp[]|undefined{
 if(!props?.length)return props?[...props]:undefined;
 const sorted=[...props].sort((a,b)=>Number(Boolean(b.main))-Number(Boolean(a.main)));
 const crowded=sorted.some((a,i)=>sorted.some((b,j)=>j>i&&Math.hypot(a.x-b.x,a.z-b.z)<0.25));
 const lifted=sorted.length>1&&sorted.every(p=>p.y>0.15);
 return sorted.map((p,i)=>({...p,...(crowded?{x:SLOTS[i][0],z:SLOTS[i][1]}:{}),...(lifted?{y:0}:{})}));
}
/**
 * The camera view's simple perspective for a frame W×H and a person height `unitH` (frame units): where a prop's base stands (x, groundY), where it is drawn
 * (y, lifted by p.y) and how tall (h). The ground runs from the horizon (far, z = 1) to the bottom (near, z = -1); further back is smaller and closer to the
 * centre line. `groundFromView` is the exact inverse on the ground plane, used when a prop is dragged.
 */
export function propInView(p:Pick<SceneProp,"kind"|"x"|"z"|"y">,W:number,H:number,unitH:number){
 const horizon=H*0.5,near=H*0.96,t=(p.z+1)/2,s=1-t*0.55,spread=W*0.42*(1-t*0.4);
 const groundY=near-t*(near-horizon);
 return {x:W/2+p.x*spread,groundY,y:groundY-p.y*unitH*0.5*s,h:PROP_HEIGHT[p.kind]*unitH*s*0.5};
}
export function groundFromView(vx:number,vy:number,W:number,H:number):{x:number;z:number}{
 const horizon=H*0.5,near=H*0.96,t=Math.max(0,Math.min(1,(near-vy)/(near-horizon))),spread=W*0.42*(1-t*0.4);
 const c=(v:number)=>Math.max(-1,Math.min(1,Math.round(v*100)/100));
 return {x:c((vx-W/2)/spread),z:c(t*2-1)};
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
export const lightAngleOf=(l:StagingLight)=>l.angle??(l.direction==="top"?undefined:LIGHT_ANGLE[l.direction]);
/** Zoom relative to a full shot, for people: «۱٫۸×» closer, «۰٫۵×» wider. */
export const zoomFactor=(s:Staging)=>Math.round(SHOT_BODY_FRACTION.full/scaleOf(s)*10)/10;
