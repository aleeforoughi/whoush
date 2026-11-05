import {test} from "node:test";
import assert from "node:assert/strict";
import type {Staging} from "../lib/creative-plan";
import {VERTICAL_STOPS,snapSide,snapVertical,verticalIndex} from "../lib/staging";
import {sideOf,spriteFor} from "../lib/sprites";
import {VISUALS} from "../lib/visual-assets";
import {blurPx,cssView,groundAt,propSprites,toScreen,type V3} from "../lib/frame-css";

const man={kind:"person" as const,label:"مرد",x:0,z:-0.25,y:0,main:true};
const base:Staging={subject:"person",cameraAngle:"eye_level",shotSize:"full",props:[man],lights:[]};

test("angle stops: five heights at the named angles, eight sides every 45°",()=>{
 assert.deepEqual(VERTICAL_STOPS.map(v=>v.id),["bottom","low","eye","high","top"]);
 assert.equal(VERTICAL_STOPS[verticalIndex(0)].id,"eye");
 assert.equal(snapVertical(20),35);
 assert.equal(snapVertical(-50),-55);
 assert.equal(snapVertical(89),80);
 assert.deepEqual([snapSide(30),snapSide(-100),snapSide(170),snapSide(-170),snapSide(10)],[45,-90,180,180,0]);
});

test("sprites: the matrix image for the height and side, mirrored for the other side, the nearest height when one is missing",()=>{
 assert.equal(spriteFor(man,"eye",0).id,"human-front");
 assert.deepEqual(sideOf(-90),{side:"side",dir:-1});
 const right=spriteFor(man,"high",45),left=spriteFor(man,"high",-45);
 assert.equal(right.id,left.id,"one image for both 3/4s");
 assert.notEqual(right.mirror,left.mirror,"the other side is the mirror");
 for(const stop of VERTICAL_STOPS.map(v=>v.id))for(const a of [0,45,90,135,180,-45,-90,-135]){
  const s=spriteFor(man,stop,a);
  assert.ok(VISUALS[s.id],stop+" "+a+": "+s.id+" exists");
  // A missing image falls back toward eye level, never further from the stop asked for.
  const order=["bottom","low","eye","high","top"],d=(x:string)=>Math.abs(order.indexOf(x)-order.indexOf("eye"));
  assert.ok(d(s.height)<=d(stop));
 }
 // Round things show the same image from every side.
 assert.equal(spriteFor({kind:"tree",label:"درخت"},"eye",90).id,spriteFor({kind:"tree",label:"درخت"},"eye",0).id);
});

test("CSS camera: the aim point lands on the frame's centre; a view point and the ground point under it round-trip",()=>{
 const v=cssView(base,undefined,"16:9",800,450);
 const c=toScreen(v,v.cam.target as V3)!;
 assert.ok(Math.abs(c[0]-400)<1e-6&&Math.abs(c[1]-225)<1e-6);
 const p:V3=[1.2,0,-3],sp=toScreen(v,p)!,g=groundAt(v,sp[0],sp[1])!;
 assert.ok(Math.hypot(g[0]-p[0],g[2]-p[2])<1e-6,"ground round-trip");
 // The crop moves the picture the same way as the 2D frame (subject toward the lower right).
 const moved=cssView({...base,framing:{x:0.5,y:0.4}},undefined,"16:9",800,450),m=toScreen(moved,moved.cam.target as V3)!;
 assert.ok(m[0]>400&&m[1]>225);
});

test("CSS camera: a wide lens close up stretches depth, a long lens far back flattens it",()=>{
 const tree={kind:"tree" as const,label:"درخت",x:0,z:1,y:0};
 const size=(lens:number)=>{const s={...base,lensMm:lens,autopilot:false,props:[man,tree]},v=cssView(s,undefined,"16:9",800,450);
  const h=(p:V3,top:V3)=>toScreen(v,p)![1]-toScreen(v,top)![1];
  return h([0,0,-4],[0,6,-4])/h([0,0,0],[0,1.75,0]);};
 // Measured: 0.8× the man through 15 mm, 2.2× through 85 mm.
 assert.ok(size(15)<1&&size(85)>2,"the tree 4 m behind looms through 85 mm and falls away through 15 mm");
});

test("CSS frame: the main subject shows the height stop chosen, at every distance",()=>{
 for(const a of ["birds_eye","high","eye_level","low","worms_eye"] as const)for(const shot of ["medium","full","wide"] as const){
  const s={...base,cameraAngle:a,shotSize:shot},v=cssView(s,undefined,"16:9",800,450),sp=propSprites(v,s.props!,s);
  const want=VERTICAL_STOPS.find(x=>x.angle===a)!.id;
  assert.equal(sp.length,1,a+" "+shot);
  // The image shows that height (or the nearest one toward eye level when the pack lacks it).
  assert.ok(sp[0].stop===want||!VISUALS["human-"+want+"-front"],a+" "+shot+" → "+sp[0].id);
 }
});

test("aperture: sharp at the focus, softer away from it, much softer wide open",()=>{
 const v=(N:number)=>cssView({...base,shotSize:"medium",lensMm:85,apertureF:N,autopilot:false},undefined,"16:9",800,450);
 const open=v(1.4),closed=v(8),f=open.cam.focusDistance;
 assert.ok(blurPx(open,f)<1e-6);
 assert.ok(blurPx(open,f+10)>blurPx(open,f+1));
 assert.ok(blurPx(open,f+10)>blurPx(closed,f+10)*4);
});
