/** Navigation helpers for the full-screen media viewer. Pure; safe in the browser and on the server. */
import {fa} from "./format";

/** Logical moves between items: previous and next follow the reading order, never the screen side. */
export type ViewerStep="prev"|"next"|"first"|"last";
/** A move named by the screen side it points to; `rtl` decides which logical move that is. */
export type ViewerDirection=ViewerStep|"left"|"right";
/** A horizontal swipe counts from this distance (in CSS pixels) on. */
export const SWIPE_THRESHOLD=50;
/** The overlays fade after this long without pointer movement. */
export const HIDE_AFTER_MS=3000;

const clamp=(i:number,n:number)=>n<=0?0:Math.min(Math.max(Math.trunc(i),0),n-1);
export const hasPrev=(i:number)=>i>0;
export const hasNext=(i:number,n:number)=>i<n-1;

/**
 * The index after a move, clamped: there is no wrap, so at the first item "prev" stays and at the last item "next" stays (the buttons are disabled there).
 * In a right-to-left page the next item is on the left: "left" means next and "right" means previous; in left-to-right it is the other way round.
 */
export function nextIndex(i:number,n:number,dir:ViewerDirection,rtl:boolean):number{
 if(n<=0)return 0;
 const at=clamp(i,n);
 const step:ViewerStep=dir==="left"?(rtl?"next":"prev"):dir==="right"?(rtl?"prev":"next"):dir;
 switch(step){
  case "first":return 0;
  case "last":return n-1;
  case "prev":return Math.max(at-1,0);
  default:return Math.min(at+1,n-1);
 }
}

/** The move a key asks for, or null for any other key. ArrowLeft is "next" in RTL; Home and End jump to the ends. */
export function keyToStep(key:string,rtl:boolean):ViewerStep|null{
 switch(key){
  case "ArrowLeft":return rtl?"next":"prev";
  case "ArrowRight":return rtl?"prev":"next";
  case "Home":return "first";
  case "End":return "last";
  default:return null;
 }
}

/**
 * The move a horizontal swipe asks for. `dx` is where the finger ended minus where it started. Dragging the content to the left reveals what is on the right,
 * which is the next item in left-to-right and the previous one in right-to-left. A swipe shorter than `threshold`, or one that is more vertical than horizontal (`dy`), moves nothing.
 */
export function swipeStep(dx:number,rtl:boolean,threshold:number=SWIPE_THRESHOLD,dy:number=0):"prev"|"next"|null{
 if(Math.abs(dx)<threshold||Math.abs(dx)<=Math.abs(dy))return null;
 const towardStart=dx>0;
 return rtl?(towardStart?"next":"prev"):(towardStart?"prev":"next");
}

/** «۳ از ۱۲» in Persian digits, for the 0-based `index` of `count` items. */
export const viewerCounter=(index:number,count:number)=>fa(index+1)+" از "+fa(count);
