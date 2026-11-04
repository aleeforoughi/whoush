import test from "node:test";
import assert from "node:assert/strict";
import {SWIPE_THRESHOLD,hasNext,hasPrev,keyToStep,nextIndex,swipeStep,viewerCounter} from "../lib/viewer";

test("nextIndex clamps at both ends: no wrap",()=>{
 assert.equal(nextIndex(0,5,"prev",true),0);
 assert.equal(nextIndex(4,5,"next",true),4);
 assert.equal(nextIndex(2,5,"next",true),3);
 assert.equal(nextIndex(2,5,"prev",false),1);
 assert.equal(nextIndex(2,5,"first",true),0);
 assert.equal(nextIndex(2,5,"last",false),4);
});

test("nextIndex handles empty, single and out-of-range lists",()=>{
 assert.equal(nextIndex(0,0,"next",true),0);
 assert.equal(nextIndex(0,1,"next",true),0);
 assert.equal(nextIndex(0,1,"prev",true),0);
 assert.equal(nextIndex(99,5,"prev",true),3);
 assert.equal(nextIndex(-3,5,"next",true),1);
});

test("nextIndex maps screen sides to items: in RTL the left is next, in LTR the right is next",()=>{
 assert.equal(nextIndex(2,5,"left",true),3);
 assert.equal(nextIndex(2,5,"right",true),1);
 assert.equal(nextIndex(2,5,"left",false),1);
 assert.equal(nextIndex(2,5,"right",false),3);
});

test("hasPrev and hasNext say which button is disabled",()=>{
 assert.deepEqual([hasPrev(0),hasNext(0,3)],[false,true]);
 assert.deepEqual([hasPrev(1),hasNext(1,3)],[true,true]);
 assert.deepEqual([hasPrev(2),hasNext(2,3)],[true,false]);
 assert.deepEqual([hasPrev(0),hasNext(0,1)],[false,false]);
});

test("keyToStep: arrows follow the page direction, Home and End go to the ends, other keys do nothing",()=>{
 assert.equal(keyToStep("ArrowLeft",true),"next");
 assert.equal(keyToStep("ArrowRight",true),"prev");
 assert.equal(keyToStep("ArrowLeft",false),"prev");
 assert.equal(keyToStep("ArrowRight",false),"next");
 for(const rtl of [true,false]){
  assert.equal(keyToStep("Home",rtl),"first");
  assert.equal(keyToStep("End",rtl),"last");
  for(const k of ["Escape","ArrowUp","ArrowDown","Enter"," ","a"])assert.equal(keyToStep(k,rtl),null,k);
 }
});

test("swipeStep: a drag to the right is next in RTL and previous in LTR; short or vertical drags do nothing",()=>{
 assert.equal(swipeStep(80,true),"next");
 assert.equal(swipeStep(-80,true),"prev");
 assert.equal(swipeStep(80,false),"prev");
 assert.equal(swipeStep(-80,false),"next");
 assert.equal(swipeStep(SWIPE_THRESHOLD-1,true),null);
 assert.equal(swipeStep(-(SWIPE_THRESHOLD-1),true),null);
 assert.equal(swipeStep(SWIPE_THRESHOLD,true),"next");
 assert.equal(swipeStep(30,true,20),"next");
 assert.equal(swipeStep(60,true,50,90),null);
 assert.equal(swipeStep(0,true),null);
});

test("viewerCounter writes «۳ از ۱۲» in Persian digits",()=>{
 assert.equal(viewerCounter(2,12),"۳ از ۱۲");
 assert.equal(viewerCounter(0,1),"۱ از ۱");
 assert.match(viewerCounter(9,1200),/^۱۰ از ۱[٬,]?۲۰۰$/);
 assert.ok(!/[0-9]/.test(viewerCounter(4,7)));
});
