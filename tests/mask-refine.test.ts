import test from "node:test";
import assert from "node:assert/strict";
import {maskTop,refineMask} from "../lib/mask-refine";

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
