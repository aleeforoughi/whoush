/**
 * Which image of the pack (public/visuals, docs/VISUAL_ASSETS.md) shows a prop, from the camera's height stop and the side the prop shows the camera. The
 * characters (the man, the woman, the cat) are a matrix of five heights (top, high, eye level, low, bottom) times five sides (front, 3/4, side, rear 3/4,
 * back), the other side being the mirror. Everything else (objects, vehicles, buildings, trees) is a cube stretched to its real size: the cube is a front
 * and a 3/4 view at each height. Pure: safe on the server and in tests.
 */
import {VISUALS} from "./visual-assets";
import {cubeDims,genderOf,isCube,petOf,wrap180,type SceneProp,type VerticalStop} from "./staging";

export type SpriteSide="front"|"3q"|"side"|"3q-back"|"back";
export type SpriteFamily="human"|"woman"|"animal"|"dog"|"horse"|"cube";
/** Each family's eye-level images; the other heights are `<family>-<height>-<side>`. */
const EYE:Record<SpriteFamily,Partial<Record<SpriteSide,string>>>={
 human:{front:"human-front","3q":"human-3q",side:"human-side","3q-back":"human-3q-back",back:"human-back"},
 woman:{front:"woman-front","3q":"woman-3q",side:"woman-side","3q-back":"woman-3q-back",back:"woman-back"},
 animal:{front:"animal-front","3q":"animal-3q",side:"animal-side","3q-back":"animal-3q-back",back:"animal-back"},
 dog:{front:"dog-front","3q":"dog-3q",side:"dog-side","3q-back":"dog-3q-back",back:"dog-back"},
 horse:{front:"horse-front","3q":"horse-3q",side:"horse-side","3q-back":"horse-3q-back",back:"horse-back"},
 cube:{front:"cube-front","3q":"cube-3q"}
};
/** Which family draws a prop: people and the pets (the cat is the `animal` family) have their own figures; anything else is a cube at its real size. */
export function familyOf(p:Pick<SceneProp,"kind"|"label">):SpriteFamily{
 if(p.kind==="person")return genderOf(p)==="female"?"woman":"human";
 const pet=petOf(p);
 return pet==="cat"?"animal":pet??"cube";
}
/**
 * Which way each side or three-quarter image faces as drawn (1: its front toward the right, -1: toward the left), checked by eye on each image (the
 * prompts asked for one way; the model did not always follow). A generated image faces the way its eye-level reference does unless listed here. Front and
 * back views and the cube are symmetric and never mirrored.
 */
export const NATIVE:Record<string,1|-1>={"person-side":-1,"animal-side":1,"person-3q":-1,"animal-3q":1,
 "human-side":-1,"human-3q":-1,"human-3q-back":-1,"animal-3q-back":1,"woman-side":-1,"woman-3q":-1,"woman-3q-back":-1,
 "dog-side":1,"dog-3q":1,"dog-3q-back":1,"horse-side":1,"horse-3q":1,"horse-3q-back":1};
/** The side the camera sees, from the prop's apparent facing (0: it faces the camera; positive: its front turned toward frame right). */
export function sideOf(apparent:number):{side:SpriteSide;dir:1|-1}{
 const f=wrap180(apparent),a=Math.abs(f);
 return {side:a<22.5?"front":a<67.5?"3q":a<=112.5?"side":a<=157.5?"3q-back":"back",dir:f<0?-1:1};
}
/** The heights tried for a stop, nearest first: a missing image falls back toward eye level (top to high, bottom to low), then eye level itself. */
const TOWARD:Record<VerticalStop,VerticalStop[]>={top:["high"],high:["high"],eye:[],low:["low"],bottom:["bottom","low"]};
/**
 * The image for a prop seen from `stop`, showing `apparent` (its facing as the camera sees it): the matrix image when the pack has it, else the nearest
 * height toward eye level. `mirror` flips a side or 3/4 image whose drawn direction is the other way. `side` is the side the camera sees (for sizing).
 */
export function spriteFor(p:Pick<SceneProp,"kind"|"label">,stop:VerticalStop,apparent:number):{id:string;mirror:boolean;side:SpriteSide;/** The height the image shows (a fallback may show another). */height:VerticalStop;
 /** Turned in its own plane, degrees clockwise: from overhead every side is the same plan view turned (its front toward the bottom when it faces the camera). */spin?:number}{
 const fam=familyOf(p),{side:seen,dir}=sideOf(apparent);
 // From overhead: the character's straight-down plan view, turned to the way it faces (the same picture for every side).
 const plan=fam==="human"?"human-top":fam==="woman"?(VISUALS["woman-top"]?"woman-top":"human-top"):fam==="animal"?"animal-top":fam==="dog"?"dog-top":fam==="horse"?"horse-top":undefined;
 if(stop==="top"&&plan&&VISUALS[plan])return {id:plan,mirror:false,side:seen,height:"top",spin:-wrap180(apparent)};
 // A cube looks the same from its four sides: its front stands for the sides and the back, its 3/4 for the rear 3/4. Its real size (how wide, how deep)
 // is applied when it is drawn (widthM), so a car seen side on is still long.
 const img:SpriteSide=fam==="cube"?(seen==="3q"||seen==="3q-back"?"3q":"front"):seen;
 const eye=EYE[fam][img]!,height=TOWARD[stop].find(h=>VISUALS[fam+"-"+h+"-"+img])??"eye",use=height==="eye"?eye:fam+"-"+height+"-"+img;
 const native=fam==="cube"?undefined:NATIVE[use]??NATIVE[eye];
 return {id:use,mirror:native!==undefined&&native!==dir,side:seen,height};
}
/** The characters' real sizes, metres: height, length (front to back) and width. */
const CHARACTER_SIZE:Record<Exclude<SpriteFamily,"cube">,{h:number;len:number;wid:number}>={
 human:{h:1.75,len:0.3,wid:0.5},woman:{h:1.65,len:0.28,wid:0.45},animal:{h:0.45,len:0.5,wid:0.2},
 dog:{h:0.6,len:0.9,wid:0.3},horse:{h:2.1,len:2.4,wid:0.6}
};
/** A prop's real size for its image: a character's, or a cube's own (Whoush's estimate or the everyday size of what it is, lib/staging.ts cubeDims). */
export function sizeOf(p:Pick<SceneProp,"kind"|"label">&{size?:SceneProp["size"]}):{h:number;len:number;wid:number}{
 if(isCube(p)){const d=cubeDims(p);return {h:d.h,len:d.d,wid:d.w};}
 return CHARACTER_SIZE[familyOf(p) as Exclude<SpriteFamily,"cube">];
}
const TURN:Record<SpriteSide,number>={front:0,"3q":45,side:90,"3q-back":135,back:180};
/**
 * How tall an image of the thing is, in metres, seen from `elevation` degrees with `side` toward the camera: its height foreshortened, plus its depth along
 * the view seen from above or below. A drawing's height in pixels is this many metres.
 */
export function spanM(s:{h:number;len:number;wid:number},elevation:number,side:SpriteSide):number{
 const e=Math.abs(elevation)*Math.PI/180,t=TURN[side]*Math.PI/180;
 return s.h*Math.cos(e)+(Math.abs(Math.cos(t))*s.len+Math.abs(Math.sin(t))*s.wid)*Math.sin(e);
}
/** How wide an image of the thing is, in metres, from `side`: its width face on, its length side on, both between. */
export function widthM(s:{len:number;wid:number},side:SpriteSide):number{
 const t=TURN[side]*Math.PI/180;
 return Math.abs(Math.cos(t))*s.wid+Math.abs(Math.sin(t))*s.len;
}
