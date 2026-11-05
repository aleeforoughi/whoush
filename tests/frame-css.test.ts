import {test} from "node:test";
import assert from "node:assert/strict";
import type {Staging} from "../lib/creative-plan";
import {VERTICAL_STOPS,snapSide,snapVertical,verticalIndex} from "../lib/staging";
import {sideOf,spriteFor} from "../lib/sprites";
import {VISUALS} from "../lib/visual-assets";
import {blurPx,closeUp,cropOnSubject,cssView,fish,focusWorld,gridBands,groundAt,pickPivot,propSprites,standee,toScreen,unfish,zoomLimits,type V3} from "../lib/frame-css";

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
  // A full or wide worm's-eye shot puts the camera on the ground, backed away: it sees the figure flatter, from low.
  const ok=sp[0].stop===want||!VISUALS["human-"+want+"-front"]||(a==="worms_eye"&&shot!=="medium"&&sp[0].stop==="low");
  assert.ok(ok,a+" "+shot+" → "+sp[0].id);
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

test("fisheye: off by default at every focal length (an ordinary ultra-wide keeps lines straight); on, the picture bulges from the centre, the corners stay",()=>{
 assert.equal(cssView({...base,lensMm:12,autopilot:false},undefined,"16:9",800,450).fish,0);
 const v=cssView({...base,lensMm:12,autopilot:false,fisheye:true},undefined,"16:9",800,450);
 assert.ok(v.fish>0);
 const [x,y]=fish(v,...unfish(v,600,120));assert.ok(Math.hypot(x-600,y-120)<1e-6,"the two mappings invert each other");
 const c=unfish(v,800,450);assert.ok(Math.hypot(c[0]-800,c[1]-450)<1e-6,"a corner stays a corner");
 const m=unfish(v,500,225);assert.ok(m[0]<500,"near the centre, the picture comes from closer to the centre (it is magnified)");
 assert.ok(cssView({...base,lensMm:24,autopilot:false,fisheye:true},undefined,"16:9",800,450).fish<v.fish,"gentler on a longer lens");
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

test("sharp at any lens: each piece is drawn at about the px it covers on screen (no texture blown up), and pieces meet the picture's corners",()=>{
 // Where a piece's own corner (x, y) lands on screen, through its matrix3d.
 const map=(tf:string,x:number,y:number)=>{const m=tf.slice(9,-1).split(",").map(Number),W=m[3]*x+m[7]*y+m[15];return [(m[0]*x+m[4]*y+m[12])/W,(m[1]*x+m[5]*y+m[13])/W];};
 for(const lens of [12,35,85,200]){
  const s={...base,shotSize:"medium_close_up" as const,lensMm:lens,autopilot:false,fisheye:lens<15},v=cssView(s,undefined,"16:9",800,450),sp=propSprites(v,s.props!,s)[0];
  assert.ok(sp.tiles.length>=1&&(lens<15?sp.tiles.length>1:sp.tiles.length===1),lens+"mm: "+sp.tiles.length+" pieces");
  for(const t of sp.tiles){
   const o=map(t.transform,0,0),r=map(t.transform,t.w,0),d=map(t.transform,0,t.h);
   const sx=Math.hypot(r[0]-o[0],r[1]-o[1])/t.w,sy=Math.hypot(d[0]-o[0],d[1]-o[1])/t.h;
   assert.ok(sx<=1.05&&sy<=1.05,lens+"mm: never stretched up ("+sx.toFixed(2)+", "+sy.toFixed(2)+")");
  }
  // The whole picture's top-left corner lands where the plane's corner does.
  if(lens>=15){const t=sp.tiles[0],c=toScreen(v,sp.quad![0])!,o=map(t.transform,0,0);assert.ok(Math.hypot(o[0]-c[0],o[1]-c[1])<0.5);}
 }
});

test("zooming out from a worm's-eye view: the camera stays on the ground and backs away, so the subject keeps getting smaller",()=>{
 let prev=Infinity;
 for(const sc of [0.4,0.8,1.2,1.8,2.5,3.5,5]){
  const s={...base,cameraAngle:"worms_eye" as const,shotScale:sc},v=cssView(s,s,"3:4",600,800);
  assert.ok(v.pos[1]>=0.049,"never under the ground");
  const head=toScreen(v,[0,1.75,0])!,feet=toScreen(v,[0,0,0]),size=feet?feet[1]-head[1]:Infinity;
  assert.ok(size<=prev+1e-6,"zoom "+sc+": "+size.toFixed(0)+" after "+prev.toFixed(0));prev=size;
 }
});

test("dragging the focus point never shakes the picture: each move re-picks it from the scene as it is, and the camera never moves",()=>{
 const far={kind:"person" as const,label:"زن",x:0.5,z:1.5,y:0};
 let s:Staging={...base,props:[man,far],lensMm:35,autopilot:false};
 const v0=cssView(s,s,"16:9",1000,562.5),f0=toScreen(v0,[0,0,0])!;let worst=0;
 for(let i=0;i<=60;i++){s={...s,pivot:pickPivot(s,s,"16:9",0.3+0.4*i/60,0.3+0.2*Math.sin(i/5))};
  const f=toScreen(cssView(s,s,"16:9",1000,562.5),[0,0,0])!;worst=Math.max(worst,Math.hypot(f[0]-f0[0],f[1]-f0[1]));}
 assert.ok(worst<0.01,"the main subject's feet moved "+worst.toFixed(3)+" px");
});

test("the brief asks for a fisheye: the lens turns fisheye and the provider is told",async()=>{
 const {applyStagingCues,lensFor}=await import("../lib/staging");
 const s=applyStagingCues(base,"یه عکس با لنز فیش‌آی از بالا");
 assert.equal(s.fisheye,true);
 assert.match(lensFor(s).en,/fisheye/);
 assert.equal(applyStagingCues(base,"پرتره ساده").fisheye,undefined);
});

test("the focus stays locked on the dominant subject through moves, crops and angle changes; a placed point follows its prop; the camera never moves for it",async()=>{
 const {propWorld}=await import("../lib/scene3d");
 const tree={kind:"person" as const,label:"زن",x:0.6,z:1,y:0},s0:Staging={...base,props:[man,tree],lensMm:50,apertureF:1.8,autopilot:false};
 const face=(s:Staging)=>{const w=propWorld(s.props![0],s,s0).pos;return [w[0],w[1]+1.75*0.88,w[2]];};
 const off=(s:Staging)=>{const f=focusWorld(cssView(s,s0,"16:9",1000,562.5)),c=face(s);return Math.hypot(f[0]-c[0],f[1]-c[1],f[2]-c[2]);};
 const moved={...s0,props:[{...man,x:0.4,z:0.3},tree]};
 for(const s of [s0,moved,{...s0,framing:{x:0.4,y:-0.2}},{...s0,cameraAngle:"high" as const,cameraElevation:35}])assert.ok(off(s)<1e-9);
 assert.deepEqual(cssView(moved,s0,"16:9",1000,562.5).pos,cssView(s0,s0,"16:9",1000,562.5).pos,"moving the dominant subject does not move the camera");
 const tw=propWorld(tree,s0,s0).pos,tp=toScreen(cssView(s0,s0,"16:9",1000,562.5),[tw[0],1.1,tw[2]])!;
 const pivot=pickPivot(s0,s0,"16:9",tp[0]/1000,tp[1]/562.5);assert.equal(pivot.on,1);
 const s1={...s0,pivot},s2={...s1,props:[man,{...tree,x:0.2,z:0.5}]},v1=cssView(s1,s0,"16:9",1000,562.5),v2=cssView(s2,s0,"16:9",1000,562.5);
 assert.deepEqual(v1.pos,v2.pos,"moving the prop under the placed point does not move the camera");
 const t=propWorld(s2.props![1],s2,s0).pos,f=focusWorld(v2);
 assert.ok(Math.abs(f[0]-t[0]-pivot.rel![0])<1e-9&&Math.abs(f[2]-t[2]-pivot.rel![2])<1e-9,"the focus follows the woman");
 // A new angle: the placed point keeps the focus (its zoom anchor goes).
 const {a:_a,b:_b,k:_k,...focusOnly}=pivot;void _a;void _b;void _k;
 const v3=cssView({...s1,pivot:focusOnly,cameraAngle:"high",cameraElevation:35},s0,"16:9",1000,562.5);
 assert.ok(Math.hypot(...focusWorld(v3).map((n,i)=>n-focusWorld(v1)[i]))<1e-9);
});

test("the shot size frames the subject the same at every height: the camera comes closer from above instead of the subject shrinking",()=>{
 const height=(a:Staging["cameraAngle"],label:string)=>{const p={...man,label},s={...base,cameraAngle:a,shotSize:"full" as const,props:[p]},v=cssView(s,s,"3:4",600,800);
  const ys=propSprites(v,[p],s,s)[0].quad!.map(c=>toScreen(v,c)![1]);return Math.max(...ys)-Math.min(...ys);};
 for(const label of ["مرد","زن"]){const eye=height("eye_level",label);
  for(const a of ["worms_eye","low","high"] as const)assert.ok(Math.abs(height(a,label)/eye-1)<0.12,label+" "+a+": "+height(a,label).toFixed(0)+" vs "+eye.toFixed(0));
  // Overhead, the camera stays above the head: as full as it can be, never a speck.
  assert.ok(height("birds_eye",label)>eye*0.4,label+" overhead");}
});

test("limits: the zoom never takes the camera into the subject, and a prop drags as far past one edge as the other, never behind the lens",async()=>{
 const {zoomLimits,propReach3D,NEAREST_M}=await import("../lib/frame-css");
 const {scaleFromSlider,nearestShot}=await import("../lib/staging");
 for(const lens of [12,24,50,85])for(const a of ["eye_level","high","birds_eye","worms_eye"] as const){
  const s:Staging={...base,cameraAngle:a,lensMm:lens,autopilot:false},[lo]=zoomLimits(s,s,"16:9"),sc=scaleFromSlider(lo);
  const v=cssView({...s,shotScale:sc,shotSize:nearestShot(sc)},s,"16:9",1000,562.5);
  assert.ok(Math.hypot(...focusWorld(v).map((n,i)=>n-v.pos[i]))>=NEAREST_M-0.02,lens+"mm "+a);
  // And never blown up past its sharpest image (about a close-up of a person; an extreme close-up of a featureless figure is out).
  assert.ok(sc>=0.1,lens+"mm "+a+": "+sc);
  assert.ok(propSprites(v,s.props!,{...s,shotScale:sc},s).length===1,lens+"mm "+a+": the subject is still drawn");
 }
 const car={kind:"vehicle" as const,label:"ماشین",x:0.5,z:0.25,y:0},s:Staging={...base,shotSize:"full",props:[man,car]};
 const r=propReach3D(car,s,s,"16:9"),v=cssView(s,s,"16:9",1000,562.5);
 const sx=(x:number)=>toScreen(v,[(x-man.x)*3,0.75,-(car.z-man.z)*4])![0];
 assert.ok(Math.abs((0-sx(r.xMin))-(sx(r.xMax)-1000))<40,"as far past the left edge as past the right");
 assert.ok(r.zMin<car.z&&r.zMax>car.z);
});

test("beta: the frame draws only characters (people and the pets); props but no character: no frame",async()=>{
 const {isCharacter,showsFrame}=await import("../lib/staging");
 const k=(kind:"person"|"animal"|"object"|"vehicle"|"tree",label:string)=>({kind,label,x:0,z:0,y:0});
 assert.ok(isCharacter(k("person","زن"))&&isCharacter(k("animal","سگ"))&&isCharacter(k("animal","گربه")));
 assert.ok(!isCharacter(k("animal","پرنده"))&&!isCharacter(k("object","میز"))&&!isCharacter(k("vehicle","ماشین")));
 assert.equal(showsFrame([k("object","میز"),k("vehicle","ماشین")]),false,"props but no character: camera and lighting only");
 assert.equal(showsFrame([k("object","میز"),k("person","مرد")]),true);
 assert.equal(showsFrame([]),false,"a place alone: camera and lighting only");
 // A box is not something the focus can land on while it is hidden.
 const desk={kind:"object" as const,label:"میز",x:0,z:-0.25,y:0,main:true},s:Staging={...base,shotSize:"medium",props:[desk]};
 assert.notEqual(pickPivot(s,s,"16:9",0.5,0.6).on,0);
});

test("changing the angle never changes the zoom, the lens, the aperture or the focus",async()=>{
 const {lensFor,orbitCamera}=await import("../lib/staging");
 const woman={kind:"person" as const,label:"زن",x:0.5,z:0.6,y:0},s0:Staging={...base,shotSize:"medium",props:[man,woman]};
 const l0=lensFor(s0);
 for(const [a,e] of [["birds_eye",80],["high",35],["low",-25],["worms_eye",-55]] as const){
  const l=lensFor({...s0,cameraAngle:a,cameraElevation:e});
  assert.equal(l.focalLengthMm,l0.focalLengthMm,a+": focal length");assert.equal(l.apertureF,l0.apertureF,a+": aperture");
 }
 for(const d of [45,90,180,-135]){const o=orbitCamera(s0,d),l=lensFor(o);
  assert.equal(l.focalLengthMm,l0.focalLengthMm,"orbit "+d);assert.equal(l.apertureF,l0.apertureF,"orbit "+d+": aperture");
  assert.equal(o.shotScale,s0.shotScale);}
 // The focus stays on the dominant subject's face from every height.
 for(const a of ["eye_level","high","birds_eye","low"] as const){
  const s={...s0,cameraAngle:a},v=cssView(s,s,"16:9",1000,562.5),f=focusWorld(v);
  assert.ok(Math.abs(f[1]-1.75*0.88)<1e-9&&Math.abs(f[0])<1e-9,a);
 }
});

test("no jump between angles: up to a ۳/۴ shot a person's face stays where the camera aims and keeps its size at every height stop",()=>{
 for(const label of ["مرد","زن"])for(const shotScale of [0.12,0.2,0.5,0.75]){
  const seen=[-55,-25,0,35].map(el=>{const p={...man,label},s:Staging={...base,cameraElevation:el,shotScale,props:[p]},v=cssView(s,s,"3:4",300,400);
   const sp=propSprites(v,[p],s,s)[0],hd=VISUALS[sp.id].head!,q=sp.quad!,at=(u:number,w:number)=>toScreen(v,q[0].map((c,i)=>c+(q[1][i]-c)*u+(q[3][i]-c)*w) as V3)!;
   const f=at(hd.x,(hd.top+hd.neck)/2),t=at(hd.x,hd.top),n=at(hd.x,hd.neck);return {f,head:Math.hypot(t[0]-n[0],t[1]-n[1])};});
  for(const x of seen){assert.ok(Math.hypot(x.f[0]-150,x.f[1]-200)<2,label+" "+shotScale+": the face at the frame's centre ("+x.f.map(Math.round)+")");
   assert.ok(Math.abs(x.head/seen[2].head-1)<0.05,label+" "+shotScale+": head "+x.head.toFixed(0)+" vs "+seen[2].head.toFixed(0));}
 }
 // From overhead, the plan view is placed and turned about its head: the head stays at the centre and the picture keeps its size as the person turns.
 for(const shotScale of [0.2,1.1]){const seen=[0,45,90,135,180].map(facing=>{const p={...man,facing},s:Staging={...base,cameraElevation:80,shotScale,props:[p]},v=cssView(s,s,"3:4",300,400);
  const sp=propSprites(v,[p],s,s)[0],a=VISUALS[sp.id],q=sp.quad!,at=(u:number,w:number)=>toScreen(v,q[0].map((c,i)=>c+(q[1][i]-c)*u+(q[3][i]-c)*w) as V3)!;
  const h=at(a.pivot!.x,a.pivot!.y),l=at(0,0.5),r=at(1,0.5);return {h,w:Math.hypot(l[0]-r[0],l[1]-r[1])};});
  for(const x of seen){assert.ok(Math.hypot(x.h[0]-150,x.h[1]-200)<3,shotScale+": head at "+x.h.map(Math.round));assert.ok(Math.abs(x.w/seen[0].w-1)<0.01);}}
 // The main subject shows the height chosen even where the camera cannot reach it (a worm's-eye full shot rests on the ground).
 const low:Staging={...base,cameraElevation:-55,shotScale:1.1};assert.equal(propSprites(cssView(low,low,"3:4",300,400),[man],low,low)[0].stop,"bottom");
});

test("the overhead plan view turns with the way the person faces; pets face as drawn",()=>{
 const p={kind:"person" as const,label:"مرد",x:0,z:0};
 assert.equal(spriteFor(p,"top",0).spin||0,0);assert.equal(spriteFor(p,"top",90).spin,-90);
 const dog={kind:"animal" as const,label:"سگ",x:0,z:0},horse={...dog,label:"اسب"};
 // Their side pictures face right as drawn: a pet turned toward frame right is drawn as is, toward frame left mirrored.
 for(const pet of [dog,horse]){assert.equal(spriteFor(pet,"eye",90).mirror,false);assert.equal(spriteFor(pet,"eye",-90).mirror,true);assert.equal(spriteFor(pet,"top",0).id,(pet.label==="سگ"?"dog":"horse")+"-top");}
});

test("an extreme close-up past what the frame can draw: the frame holds its tightest and a guide marks the real crop on the face",()=>{
 const tight={...base,shotScale:0.04,focusDetail:"eyes" as const},[lo]=zoomLimits(tight,tight,"3:4");assert.ok(lo>0,"the frame has a tightest zoom");
 const r=closeUp(tight,tight,"3:4",300,400);assert.ok(r.guide&&r.guide.length===4);
 assert.equal(r.draw.focusDetail,"face","the drawn frame holds the whole face");
 const xs=r.guide!.map(p=>p[0]),ys=r.guide!.map(p=>p[1]);
 assert.ok(Math.min(...xs)>0&&Math.max(...xs)<300&&Math.min(...ys)>0&&Math.max(...ys)<400,"the guide lies within the frame");
 assert.ok(Math.max(...xs)-Math.min(...xs)<150,"it is smaller than the frame");
 // At the frame's own tightest, no guide.
 assert.equal(closeUp(r.draw,tight,"3:4",300,400).guide,undefined);
 // A product never gets one.
 const box={kind:"object" as const,label:"جعبه",x:0,z:-0.25,y:0,main:true};assert.equal(closeUp({...tight,props:[box]},tight,"3:4",300,400).guide,undefined);
});

test("the camera-distance diagram: what the frame covers on the subject; a lowered camera covers a lower part",()=>{
 const s={...base,shotSize:"medium" as const},c=cropOnSubject(s,s,"3:4")!;
 assert.ok(c.top>1.6&&c.bottom>0.6&&c.bottom<1.4&&c.left<0&&c.right>0,JSON.stringify(c));
 const low=cropOnSubject({...s,cameraLift:-0.6},s,"3:4")!;assert.ok(low.top<c.top-0.4&&low.bottom<c.bottom-0.4);
});
