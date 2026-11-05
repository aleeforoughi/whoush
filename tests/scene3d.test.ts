import {test} from "node:test";
import assert from "node:assert/strict";
import type {Staging} from "../lib/creative-plan";
import {camera3D,depthOfField,propSize,propWorld,wideFrameRect} from "../lib/scene3d";

const person={kind:"person" as const,label:"آدم",x:0,z:-0.25,y:0,main:true};
const base:Staging={subject:"person",cameraAngle:"eye_level",shotSize:"medium",props:[person],
 lights:[{role:"key",direction:"front_left",height:"high",quality:"soft",source:"softbox",colorTemperatureK:5600}]};
const dist=(c:{position:number[];target:number[]})=>Math.hypot(...c.position.map((v,i)=>v-c.target[i]));

test("3D camera: the field of view follows the focal length on a full-frame sensor",()=>{
 const wide=camera3D({...base,lensMm:15,autopilot:false},undefined,"16:9"),tele=camera3D({...base,lensMm:85,autopilot:false},undefined,"16:9");
 // 24 mm sensor height: 15 mm → ~77°, 85 mm → ~16°.
 assert.ok(Math.abs(wide.fov-77.3)<1,"15mm fov "+wide.fov);
 assert.ok(Math.abs(tele.fov-16.1)<0.5,"85mm fov "+tele.fov);
 // The same shot size: the wide lens stands much closer (that is what stretches near things), the long lens far back.
 assert.ok(dist(wide)<dist(tele)/4,"15mm close, 85mm far");
 // Very wide lenses bow into a fisheye; normal lenses do not.
 assert.equal(wide.fisheye,0,"15mm is wide, not yet fisheye");
 assert.equal(tele.fisheye,0);
 assert.ok(camera3D({...base,lensMm:8,autopilot:false},undefined,"16:9").fisheye>0.9);
});

test("3D camera: a bird's-eye view looks down from above, a worm's-eye from below; Dutch rolls",()=>{
 const bird=camera3D({...base,cameraAngle:"birds_eye",cameraElevation:85},undefined,"16:9");
 assert.ok(bird.position[1]-bird.target[1]>dist(bird)*0.95,"camera almost straight above");
 const low=camera3D({...base,cameraAngle:"low",cameraElevation:-30},undefined,"16:9");
 assert.ok(low.position[1]<low.target[1],"camera below the aim point");
 assert.equal(camera3D(base,undefined,"16:9").roll,0);
 assert.ok(Math.abs(camera3D({...base,cameraAngle:"dutch",cameraRoll:20},undefined,"16:9").roll-20*Math.PI/180)<1e-9);
});

test("3D camera: a portrait frame puts the long sensor side vertical; the crop is a film shift that follows the 2D direction",()=>{
 const land=camera3D(base,undefined,"16:9"),port=camera3D(base,undefined,"9:16");
 assert.ok(port.fov>land.fov,"9:16 sees more vertically");
 const c=camera3D({...base,framing:{x:0.5,y:0.4}},undefined,"16:9");
 // Moving the crop right and down (subject lower right) shifts the frame window left and up.
 assert.ok(c.shift[0]<0&&c.shift[1]<0);
});

test("depth of field: wide open on a long lens is shallow, stopped down on a wide lens is deep",()=>{
 const shallow=depthOfField({focalMm:85,aperture:1.4,focusDistance:2}),deep=depthOfField({focalMm:24,aperture:11,focusDistance:3});
 assert.ok(shallow.far-shallow.near<0.1,"85mm f/1.4 at 2 m: a few cm");
 assert.ok(shallow.near<2&&shallow.far>2);
 assert.equal(deep.far,Infinity,"24mm f/11 at 3 m: past the hyperfocal distance");
});

test("3D props: real sizes and places; the main subject at the origin, depth away from the camera",()=>{
 assert.equal(propSize({kind:"person",label:"زن"}).h,1.65);
 assert.equal(propSize({kind:"person",label:"مرد"}).h,1.75);
 const car={kind:"vehicle" as const,label:"ماشین",x:0.5,z:0.5,y:0};
 const s:Staging={...base,props:[person,car]};
 assert.deepEqual(propWorld(person,s).pos,[0,0,-0]);
 const w=propWorld(car,s).pos;
 assert.ok(w[0]>0&&w[2]<0,"right of and behind the subject");
});

test("full-screen view: the frame keeps its aspect with room around it, and the crop moves it",()=>{
 const r=wideFrameRect({shift:[0,0]},16/9,1600,900);
 assert.ok(r.w<1&&r.h<1);
 assert.ok(Math.abs((r.w*1600)/(r.h*900)-16/9)<1e-9);
 assert.deepEqual([r.x,r.y],[0.5,0.5]);
 const m=wideFrameRect({shift:[-0.25,0.1]},16/9,1600,900);
 assert.ok(m.x<0.5&&m.y>0.5);
});
