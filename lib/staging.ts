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
