import test from "node:test";
import assert from "node:assert/strict";
import {growMask,maskTop,refineMask,spillsOut,withRoom} from "../lib/mask-refine";

const W=60,H=60;
/** A filled square with a 2×2 gap in it and a speck far away; or a ring (a large enclosed opening). */
function square(gap:boolean,speck:boolean){const m=new Uint8Array(W*H);for(let y=10;y<50;y++)for(let x=10;x<50;x++)m[y*W+x]=1;
 if(gap)for(let y=29;y<31;y++)for(let x=29;x<31;x++)m[y*W+x]=0;if(speck)m[2*W+57]=1;return m;}
const count=(m:Uint8Array)=>m.reduce((a,v)=>a+v,0);

test("mask cleanup fills small gaps, drops specks, keeps the object's size",()=>{
 const out=refineMask(square(true,true),W,H);
 assert.equal(out[30*W+30],1,"the gap inside is filled");
 assert.equal(out[2*W+57],0,"the far speck is dropped");
 assert.ok(Math.abs(count(out)-1600)<=40,"smoothing neither grows nor shrinks it: "+count(out));
});

test("mask cleanup keeps a large opening open (the inside of a cup handle)",()=>{
 const m=square(false,false);for(let y=20;y<40;y++)for(let x=20;x<40;x++)m[y*W+x]=0;
 const out=refineMask(m,W,H);
 assert.equal(out[30*W+30],0,"a 20×20 opening in a 40×40 object is not filled");
});

test("mask cleanup: an empty mask stays empty; the badge goes on the top edge",()=>{
 assert.equal(count(refineMask(new Uint8Array(W*H),W,H)),0);
 const top=maskTop(square(false,false),W,H)!;
 assert.ok(Math.abs(top.x-29.5/W)<1e-9&&Math.abs(top.y-10/H)<1e-9);
});

test("growing a mask: about r pixels out from a straight edge, rounded at the corners, nothing far away",()=>{
 const m=new Uint8Array(W*H);for(let y=20;y<40;y++)for(let x=20;x<40;x++)m[y*W+x]=1;
 const g=growMask(m,W,H,5);
 assert.ok(m.every((v,i)=>!v||g[i]),"the mask itself stays");
 assert.equal(g[30*W+16],1,"4 px out from an edge");assert.equal(g[30*W+12],0,"8 px out is not");
 assert.equal(g[15*W+15],0,"the corner is rounded off");
 assert.deepEqual(growMask(m,W,H,0),m,"r 0 changes nothing");
});

test("room to grow (owner, 2026-11-08: fuller lips): the element plus space around it, inside its box, never over other features",()=>{
 // "Lips": a 30×12 bar at y 26..37; "nose": a block just above it at y 14..21.
 const lips=new Uint8Array(W*H);for(let y=26;y<38;y++)for(let x=15;x<45;x++)lips[y*W+x]=1;
 const nose=new Uint8Array(W*H);for(let y=14;y<22;y++)for(let x=25;x<35;x++)nose[y*W+x]=1;
 const out=withRoom(lips,W,H,[8/W,8/H,52/W,52/H],[nose]);
 assert.ok(lips.every((v,i)=>!v||out[i]),"the lips themselves stay selected");
 assert.equal(out[23*W+30],1,"room above the lips");assert.equal(out[40*W+30],1,"room below");
 assert.equal(out[20*W+30],0,"never over the nose");
 assert.equal(out[48*W+30],0,"no further than about 40% of the lips' height");
 assert.ok(count(out)>count(lips)*1.4,"clearly more room than the outline: "+count(out)+" vs "+count(lips));
 const boxed=withRoom(lips,W,H,[14/W,25/H,46/W,39/H],[]);
 assert.equal(boxed[23*W+30],0,"never beyond Whoush's box");
});

test("an object found for a box that mostly lies outside it is not that object (2026-11-08: a box around the eyes gave the hair)",()=>{
 const m={w:W,h:H,plane:square(false,false)};
 assert.equal(spillsOut(m,[10,10,50,50],0),0,"all inside");
 assert.ok(spillsOut(m,[25,25,35,35],0.1)>0.85,"a small box inside a big answer: almost all of it spills");
 assert.ok(spillsOut(m,[8,8,48,48],0.1)<0.01,"a small margin forgives the edge");
});
