/**
 * Which image of the pack (public/visuals, docs/VISUAL_ASSETS.md) shows a prop, from the camera's height stop and the side the prop shows the camera: the
 * pack holds every family as a matrix, five heights (top, high, eye level, low, bottom) times five sides (front, 3/4, side, rear 3/4, back), the other
 * side being the mirror. Pure: safe on the server and in tests.
 */
import {VISUALS} from "./visual-assets";
import {genderOf,wrap180,type SceneProp,type VerticalStop} from "./staging";

export type SpriteSide="front"|"3q"|"side"|"3q-back"|"back";
export type SpriteFamily="human"|"woman"|"vehicle"|"animal"|"object"|"tree"|"building";
/** Each family's eye-level images (the original pack); the other heights are `<family>-<height>-<side>`. */
const EYE:Record<SpriteFamily,Partial<Record<SpriteSide,string>>>={
 human:{front:"human-front","3q":"human-3q",side:"human-side","3q-back":"human-3q-back",back:"human-back"},
 woman:{front:"woman-front","3q":"woman-3q",side:"woman-side","3q-back":"woman-3q-back",back:"woman-back"},
 vehicle:{front:"vehicle-front","3q":"vehicle-3q",side:"vehicle-side","3q-back":"vehicle-3q-rear",back:"vehicle-rear"},
 animal:{front:"animal-front","3q":"animal-3q",side:"animal-side","3q-back":"animal-3q-back",back:"animal-back"},
 object:{side:"object-side"},tree:{side:"env-tree"},building:{side:"env-building"}
};
/** The families that look the same from every side: one image per height (`<family>-<height>-round`). */
const ROUND=new Set<SpriteFamily>(["object","tree","building"]);
export function familyOf(p:Pick<SceneProp,"kind"|"label">):SpriteFamily{
 switch(p.kind){
  case "person":return genderOf(p)==="female"?"woman":"human";
  case "vehicle":return "vehicle";case "animal":return "animal";case "object":return "object";case "tree":return "tree";case "building":return "building";
 }
}
/**
 * Which way each side or three-quarter image faces as drawn (1: its front toward the right, -1: toward the left), checked by eye on each generated image
 * (the prompts asked for one way; the model did not always follow). Front, back and round images are symmetric and never mirrored.
 */
export const NATIVE:Record<string,1|-1>={"person-side":-1,"vehicle-side":-1,"animal-side":1,"person-3q":-1,"animal-3q":1,"vehicle-3q":-1,"vehicle-3q-rear":1,
 "human-side":-1,"human-3q":-1,"human-3q-back":-1,"animal-3q-back":1,"woman-side":-1,"woman-3q":-1,"woman-3q-back":-1};
/** The side the camera sees, from the prop's apparent facing (0: it faces the camera; positive: its front turned toward frame right). */
export function sideOf(apparent:number):{side:SpriteSide;dir:1|-1}{
 const f=wrap180(apparent),a=Math.abs(f);
 return {side:a<22.5?"front":a<67.5?"3q":a<=112.5?"side":a<=157.5?"3q-back":"back",dir:f<0?-1:1};
}
/**
 * The image for a prop seen from `stop`, showing `apparent` (its facing as the camera sees it): the matrix image when the pack has it, else the same side
 * at eye level. `mirror` flips a side or 3/4 image whose drawn direction is the other way.
 */
export function spriteFor(p:Pick<SceneProp,"kind"|"label">,stop:VerticalStop,apparent:number):{id:string;mirror:boolean;side:SpriteSide;/** The height the image shows (a fallback may show another). */height:VerticalStop}{
 const fam=familyOf(p),{side,dir}=sideOf(apparent);
 if(ROUND.has(fam)){const eye=EYE[fam].side!,id=fam+"-"+stop+"-round",has=stop!=="eye"&&Boolean(VISUALS[id]);return {id:has?id:eye,mirror:false,side:"side",height:has?stop:"eye"};}
 const eye=EYE[fam][side]!;
 // The same side at the height asked for, else at the next height toward eye level (a missing top falls back to high, then eye level).
 const toward:Record<VerticalStop,VerticalStop[]>={top:["top","high"],high:["high"],eye:[],low:["low"],bottom:["bottom","low"]};
 const height=toward[stop].find(h=>VISUALS[fam+"-"+h+"-"+side])??"eye",use=height==="eye"?eye:fam+"-"+height+"-"+side;
 // A generated image faces the way its eye-level reference does (the prompt asks for it), unless NATIVE says otherwise.
 const native=NATIVE[use]??NATIVE[eye];
 return {id:use,mirror:native!==undefined&&native!==dir,side,height};
}
/** Real sizes, metres: height, length (front to back) and width, for sizing an image by how much of the thing it shows from that angle. */
export const SPRITE_SIZE:Record<SpriteFamily,{h:number;len:number;wid:number}>={
 human:{h:1.75,len:0.3,wid:0.5},woman:{h:1.65,len:0.28,wid:0.45},vehicle:{h:1.5,len:4,wid:1.8},animal:{h:0.45,len:0.5,wid:0.2},
 object:{h:0.35,len:0.12,wid:0.12},tree:{h:6,len:3,wid:3},building:{h:14,len:10,wid:10}
};
/**
 * How tall an image of the thing is, in metres, seen from `elevation` degrees with `side` toward the camera: its height foreshortened, plus its depth along
 * the view seen from above or below. A drawing's height in pixels is this many metres.
 */
export function spanM(fam:SpriteFamily,elevation:number,side:SpriteSide):number{
 const s=SPRITE_SIZE[fam],e=Math.abs(elevation)*Math.PI/180,turn={front:0,"3q":45,side:90,"3q-back":135,back:180}[side]*Math.PI/180;
 const depth=Math.abs(Math.cos(turn))*s.len+Math.abs(Math.sin(turn))*s.wid;
 return s.h*Math.cos(e)+depth*Math.sin(e);
}
