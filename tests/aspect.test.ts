import test from "node:test";
import assert from "node:assert/strict";
import {aspectValue,nearestAspectRatio} from "../lib/aspect";
import {MEDIA_CATALOG} from "../lib/catalog";

const SEEDREAM=MEDIA_CATALOG.find(m=>m.id==="seedream-5-pro-2k")!.capabilities.aspectRatios;

test("aspect: parses only positive integer ratios",()=>{
 assert.equal(aspectValue("16:9"),16/9);
 assert.equal(aspectValue("0:1"),undefined);
 assert.equal(aspectValue("wide"),undefined);
});

test("aspect: an offered ratio is kept as is",()=>{
 assert.equal(nearestAspectRatio("3:2",SEEDREAM),"3:2");
});

test("aspect: a ratio the model lacks snaps to the nearest one it offers, keeping the orientation",()=>{
 // Seedream has no 4:5 or 5:4: the nearest are 3:4 and 4:3, never the square default.
 assert.equal(nearestAspectRatio("4:5",SEEDREAM),"3:4");
 assert.equal(nearestAspectRatio("5:4",SEEDREAM),"4:3");
 assert.equal(nearestAspectRatio("1:4",SEEDREAM),"9:16");
 assert.equal(nearestAspectRatio("8:1",SEEDREAM),"21:9");
});

test("aspect: nothing wanted, a malformed ratio, or no offered ratios gives no setting",()=>{
 assert.equal(nearestAspectRatio(undefined,SEEDREAM),undefined);
 assert.equal(nearestAspectRatio("wide",SEEDREAM),undefined);
 assert.equal(nearestAspectRatio("4:5",[]),undefined);
});

test("aspect: every snapped ratio is one the model really offers",()=>{
 for(const m of MEDIA_CATALOG)for(const want of ["1:1","4:5","5:4","2:3","3:2","9:16","16:9","21:9","1:8","8:1"]){
  const got=nearestAspectRatio(want,m.capabilities.aspectRatios);
  if(m.capabilities.aspectRatios.length===0)assert.equal(got,undefined);else assert.ok(m.capabilities.aspectRatios.includes(got!),m.id+" "+want);
 }
});

// The generation card shows «اتوماتیک» and only the popular ratios; the rest behind «+» (owner, 2026-11-08).
test("popular ratios: the most used ones the model offers, tallest to widest; a pick is never hidden",async()=>{
 const {popularAspectRatios,byShape}=await import("../lib/aspect");
 const offered=["21:9","16:9","4:3","1:1","3:4","9:16","2:3","3:2"];
 assert.deepEqual(popularAspectRatios(offered,[],3),["9:16","1:1","16:9"]);
 assert.deepEqual(popularAspectRatios(offered,["21:9"],2),["9:16","21:9"]);
 assert.deepEqual(popularAspectRatios(offered,["3:2",undefined],3),["9:16","3:2","16:9"]);
 assert.deepEqual(popularAspectRatios(["4:3"],[],3),["4:3"]);
 assert.deepEqual(byShape(["16:9","9:16","1:1"]),["9:16","1:1","16:9"]);
});
