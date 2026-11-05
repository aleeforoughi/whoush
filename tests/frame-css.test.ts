import {test} from "node:test";
import assert from "node:assert/strict";
import type {Staging} from "../lib/creative-plan";
import {VERTICAL_STOPS,snapSide,snapVertical,verticalIndex} from "../lib/staging";
import {sideOf,spriteFor} from "../lib/sprites";
import {VISUALS} from "../lib/visual-assets";
import {blurPx,cssView,fish,focusWorld,gridBands,groundAt,pickPivot,propSprites,standee,toScreen,unfish,type V3} from "../lib/frame-css";

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

test("cubes: everything but people and the pets is a cube at its real size; several are told apart by colour",async()=>{
 const {isCube,cubeDims,petOf,propTints}=await import("../lib/staging");
 const k=(kind:"object"|"vehicle"|"building"|"tree"|"animal"|"person",label:string)=>({kind,label,x:0,z:0,y:0});
 for(const p of [k("object","میز"),k("vehicle","ماشین"),k("building","برج"),k("tree","درخت"),k("animal","پرنده")])assert.ok(isCube(p),p.label);
 for(const p of [k("animal","گربه"),k("animal","سگ"),k("animal","اسب"),k("person","مرد")])assert.ok(!isCube(p),p.label);
 assert.equal(petOf(k("animal","horse")),"horse");
 assert.deepEqual(cubeDims(k("object","میز چوبی")),{w:1.2,h:0.75,d:0.7});
 assert.deepEqual(cubeDims({...k("object","چیز عجیب"),size:{w:0.5,h:0.2,d:0.1}}),{w:0.5,h:0.2,d:0.1},"Whoush's own estimate wins");
 assert.deepEqual(cubeDims(k("object","چیز عجیب")),{w:0.3,h:0.3,d:0.3},"an unknown object is a 30 cm box");
 const t=propTints([k("object","میز"),k("vehicle","ماشین"),k("person","مرد")]);
 assert.ok(t[0]&&t[1]&&t[0]!==t[1]&&!t[2],"two cubes of different kinds get their own colours; a lone person stays plain");
});

test("stacking: a smaller object on a larger one's spot rests on its top; moved off, it is back on the ground",async()=>{
 const {supportOf,stackLift,tidyProps}=await import("../lib/staging");
 const desk={kind:"object" as const,label:"میز",x:0.5,z:0,y:0},phone={kind:"object" as const,label:"گوشی",x:0.55,z:0.02,y:0};
 assert.equal(supportOf(phone,[desk,phone]),desk);
 assert.equal(stackLift(phone,[desk,phone]),0.75);
 assert.equal(supportOf(desk,[desk,phone]),undefined,"the desk stays on the ground");
 assert.equal(stackLift({...phone,x:1.5},[desk,{...phone,x:1.5}]),0);
 // Sharing a spot on purpose is not crowding: the planner's stack is kept.
 const tidy=tidyProps([{...man,x:-0.5},desk,phone])!;
 assert.deepEqual(tidy.slice(1).map(p=>[p.x,p.z]),[[0.5,0],[0.55,0.02]]);
});

test("a cube is drawn as a box: up to three faces, the top seen from above",()=>{
 const desk={kind:"object" as const,label:"میز",x:0.5,z:0,y:0};
 for(const [a,top] of [["eye_level",true],["birds_eye",true],["worms_eye",false]] as const){
  const s={...base,cameraAngle:a,props:[man,desk]},v=cssView(s,undefined,"16:9",800,450),sp=propSprites(v,s.props!,s).find(x=>x.i===1)!;
  assert.ok(sp.faces&&sp.faces.length>=1&&sp.faces.length<=3,a);
  assert.equal(sp.faces!.some(f=>f.key==="top"),top,a+": top face");
 }
});

test("the background's distance: Whoush's estimate, words in the brief, or the place's usual distance",async()=>{
 const {backdropM,applyStagingCues}=await import("../lib/staging");
 assert.equal(backdropM({...base,environment:"room"}),5);
 assert.equal(backdropM({...base,environment:"room",environmentDistance:1.5}),1.5);
 assert.ok(backdropM(applyStagingCues({...base,environment:"studio"},"پرتره جلوی دیوار"))<=2);
 assert.ok(backdropM(applyStagingCues(base,"کوه ها در دوردست"))>200*3);
 // A far background blurs more through a wide-open lens.
 const v=(d:number)=>cssView({...base,shotSize:"medium",lensMm:85,apertureF:1.8,autopilot:false,environmentDistance:d},undefined,"16:9",800,450);
 assert.ok(blurPx(v(500),v(500).cam.focusDistance+500)>blurPx(v(2),v(2).cam.focusDistance+2));
});

test("focus point: placing it never moves the picture; it sits where it was placed, focuses there, and a zoom dollies toward it",()=>{
 const far={kind:"person" as const,label:"مرد",x:0.6,z:1,y:0};
 const s:Staging={...base,props:[man,far],lensMm:50,apertureF:1.8,autopilot:false};
 const v0=cssView(s,s,"16:9",1000,562.5),feet0=toScreen(v0,[0,0,0])!,target=toScreen(v0,[0.6*3,1.2,-5])!;
 const pivot=pickPivot(s,s,"16:9",target[0]/1000,target[1]/562.5);
 assert.equal(pivot.on,1,"it sits on the man behind");
 const s1={...s,pivot},v1=cssView(s1,s,"16:9",1000,562.5),feet1=toScreen(v1,[0,0,0])!,dot=toScreen(v1,focusWorld(v1))!;
 assert.ok(Math.hypot(feet1[0]-feet0[0],feet1[1]-feet0[1])<1,"the picture stays still");
 assert.ok(Math.hypot(dot[0]-target[0],dot[1]-target[1])<2,"the dot is where it was placed");
 const sp=propSprites(v1,s1.props!,s1,s);
 assert.ok(blurPx(v1,sp[1].depth)<0.01&&blurPx(v1,sp[0].depth)>2,"the man behind is sharp, the main subject in front is soft");
 const v2=cssView({...s1,shotSize:"medium"},s,"16:9",1000,562.5),dot2=toScreen(v2,focusWorld(v2))!;
 assert.ok(Math.hypot(dot2[0]-dot[0],dot2[1]-dot[1])<1,"zooming keeps the focus point where it is");
});

test("lens: a level camera keeps verticals vertical; a tilted one makes them lean; a wide lens stretches toward the edges",()=>{
 const shape=(lens:number,angle:Staging["cameraAngle"],dx:number)=>{
  const v=cssView({...base,cameraAngle:angle,lensMm:lens,autopilot:false},undefined,"16:9",1000,562.5);
  const t=v.cam.target as V3,depth=Math.hypot(t[0]-v.pos[0],t[1]-v.pos[1],t[2]-v.pos[2]);
  // The same 1 m × 1 m picture beside the aim point, `dx` of the frame's half width to the side.
  const half=depth*Math.tan(v.cam.fov*Math.PI/360)*16/9,st=standee(v,[t[0]+dx*half,t[1],t[2]],100,100,0.01,0.01,false,0.5,angle==="eye_level"?0:35)!;
  const p=st.quad.map(q=>toScreen(v,q)!),w=Math.hypot(p[1][0]-p[0][0],p[1][1]-p[0][1]),h=Math.hypot(p[3][0]-p[0][0],p[3][1]-p[0][1]);
  return {stretch:w/h,lean:Math.atan2(p[3][0]-p[0][0],p[3][1]-p[0][1])*180/Math.PI};};
 assert.ok(Math.abs(shape(15,"eye_level",0.8).lean)<0.01,"level: upright at the edge");
 assert.ok(Math.abs(shape(15,"high",0.8).lean)>5,"tilted down: verticals lean toward the centre");
 assert.ok(shape(15,"eye_level",0.8).stretch>shape(15,"eye_level",0).stretch*1.3,"15 mm stretches things at the edge");
 assert.ok(shape(85,"eye_level",0.8).stretch<shape(85,"eye_level",0).stretch*1.05,"85 mm barely does");
});

test("fisheye under 15 mm: the picture bulges from the centre, the corners stay; none above 15 mm",()=>{
 const v=cssView({...base,lensMm:12,autopilot:false},undefined,"16:9",800,450);
 assert.ok(v.fish>0);
 const [x,y]=fish(v,...unfish(v,600,120));assert.ok(Math.hypot(x-600,y-120)<1e-6,"the two mappings invert each other");
 const c=unfish(v,800,450);assert.ok(Math.hypot(c[0]-800,c[1]-450)<1e-6,"a corner stays a corner");
 const m=unfish(v,500,225);assert.ok(m[0]<500,"near the centre, the picture comes from closer to the centre (it is magnified)");
 assert.equal(cssView({...base,lensMm:24,autopilot:false},undefined,"16:9",800,450).fish,0);
});

test("aperture: the ground blurs band by band with distance, and the horizon as much as infinity",()=>{
 const v=cssView({...base,shotSize:"medium",lensMm:85,apertureF:1.4,autopilot:false},undefined,"16:9",800,450),bands=gridBands(v);
 // Sharpest around the focus (3 m here), blurrier both nearer the lens and farther away, the far bands approaching the horizon's blur.
 const blurs=bands.map(b=>b.blur),sharpest=Math.min(...blurs),at=blurs.indexOf(sharpest);
 assert.ok(at>0&&at<blurs.length-1,"the sharpest band is in between: "+blurs.map(b=>b.toFixed(1)));
 assert.ok(blurs.slice(at).every((b,i,a)=>i===0||b>=a[i-1]),"behind the focus, blur grows with distance");
 assert.ok(Math.abs(blurs[blurs.length-1]-blurPx(v,1e5))<blurPx(v,1e5)*0.1,"the farthest band is nearly as soft as the horizon");
 const deep=cssView({...base,shotSize:"medium",lensMm:24,apertureF:16,autopilot:false},undefined,"16:9",800,450);
 assert.ok(blurPx(deep,1e5)<blurPx(v,1e5)/10,"stopped down on a wide lens, the background stays sharp");
});
