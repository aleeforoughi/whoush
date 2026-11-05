import test from "node:test";
import assert from "node:assert/strict";
import {compileImagePrompt,stripSceneDirection,SCENE_COMPILER_VERSION} from "../lib/scene-compiler";
import {StagingSchema} from "../lib/creative-plan";

const scene=StagingSchema.parse({subject:"person",cameraAngle:"low",shotSize:"close_up",lights:[{role:"key",direction:"front_left",height:"eye",quality:"soft",source:"window",colorTemperatureK:5600}],props:[]});

test("scene compiler: the planner's camera, lens and light words are taken out; the subject, the setting and every rule stay",()=>{
 const planner="A man in his late 30s with a short beard sits at a wooden table in a cozy café, tight close-up, warm key light from the right, 35mm lens. He holds a camera at his chest. Keep his face exactly; do not change the camera angle. Natural skin texture.";
 const out=stripSceneDirection(planner);
 assert.equal(out,"A man in his late 30s with a short beard sits at a wooden table in a cozy café. He holds a camera at his chest. Keep his face exactly; do not change the camera angle. Natural skin texture.");
});
test("scene compiler: the deterministic planner's direction line goes as a whole, label included",()=>{
 const out=stripSceneDirection("portrait of a woman in a garden\nDirection: 85mm, f/2.0, 1/200s, ISO 100, 5600K, subject centred in the frame, soft key about 45 degrees to the camera side, gentle fill, subtle rim separation. Balanced exposure with natural highlight roll-off.");
 assert.equal(out,"portrait of a woman in a garden\nBalanced exposure with natural highlight roll-off.");
});
test("scene compiler: one prompt, camera first, one scene at the end with lens and aspect; a text that is only direction is kept rather than dropped",()=>{
 const c=compileImagePrompt({content:"A cozy café with a brick wall, eye-level shot, lit from the left.",staging:scene,aspect:"3:4"});
 assert.match(c.prompt,/^Camera and light, exactly as arranged: Low-angle shot looking up at the subject\. The subject faces the camera\. Tight close-up/);
 assert.ok(c.prompt.includes(" A cozy café with a brick wall. Scene (must match): Staging: low angle camera"),c.prompt);
 assert.ok(!/eye-level shot|lit from the left/.test(c.prompt),"the planner's contradicting camera and light are gone");
 assert.match(c.prompt,/Lens: \d+mm.*Aspect ratio 3:4\.$/);
 assert.equal(c.prompt.split("Scene (must match)").length,2);
 assert.equal(c.compilerVersion,SCENE_COMPILER_VERSION);
 assert.ok(compileImagePrompt({content:"close-up, 85mm.",staging:scene,aspect:"1:1"}).prompt.includes("close-up, 85mm."),"never a prompt with no content");
});
test("scene compiler: a long content is cut so the scene at the end always fits within 3000 characters",()=>{
 const c=compileImagePrompt({content:"a quiet lake at dawn. ".repeat(300),staging:scene,aspect:"16:9"});
 assert.ok(c.prompt.length<=3000);assert.match(c.prompt,/Aspect ratio 16:9\.$/);
});
test("scene compiler: each light is stated once, at the start, with its side of the frame; the scene at the end carries no second copy",()=>{
 const blue={role:"key" as const,direction:"right" as const,height:"eye" as const,quality:"soft" as const,source:"softbox" as const,colorTemperatureK:5600,colorHex:"#2979ff",tint:0.9};
 const c=compileImagePrompt({content:"A man at a café table.",staging:{...scene,lights:[blue]},aspect:"3:4"}).prompt;
 assert.match(c,/Key light: a deep, strongly saturated blue coloured light \(#2979ff\), from frame right, level with the subject, at face height\./);
 assert.equal(c.match(/key light/gi)?.length,1,c);
 assert.match(c,/Exactly one person in the picture\./);
});

// ---- operations and edit locks ----
import {resolveOperation,sceneChangeGroups,GENERIC_EDIT_RULE_EN} from "../lib/scene-compiler";
import {orbitCamera} from "../lib/staging";
import {orchestrateCreativeTurn,deriveTurnWithStaging,getPrivateMediaPrompt,keepEditTurnForTests,SceneEditConflict} from "../lib/orchestrator";
const room={...scene,props:[{kind:"person" as const,label:"مرد",x:0,z:2,y:0,main:true},{kind:"object" as const,label:"میز",x:0.3,z:1.6,y:0}],
 lights:[{role:"key" as const,direction:"front_left" as const,height:"high" as const,quality:"soft" as const,source:"window" as const,colorTemperatureK:5600},{role:"fill" as const,direction:"right" as const,height:"eye" as const,quality:"soft" as const,source:"softbox" as const,colorTemperatureK:5600}]};

test("scene changes are read in room terms: an orbit moves only the camera, even though the canvas turns its lights and props with it",()=>{
 const orbit=orbitCamera(room,90);
 assert.notDeepEqual(orbit.lights,room.lights,"the canvas did turn the lights");
 assert.deepEqual(sceneChangeGroups(room,orbit),{camera:true,light:false,layout:false});
 assert.deepEqual(sceneChangeGroups(room,{...room,cameraElevation:-30,shotSize:"close_up"}),{camera:true,light:false,layout:false});
 assert.deepEqual(sceneChangeGroups(room,{...room,lights:[{...room.lights[0],colorHex:"#2979ff",tint:0.9},room.lights[1]]}),{camera:false,light:true,layout:false});
 assert.deepEqual(sceneChangeGroups(room,{...room,props:[room.props[0],{...room.props[1],x:-0.5}]}),{camera:false,light:false,layout:true});
 assert.deepEqual(sceneChangeGroups(room,room),{camera:false,light:false,layout:false});
});
test("operations: a new image is always create; a photo edit is one kind of change, and camera with light is refused",()=>{
 const change=(camera:boolean,light:boolean,layout=false)=>({camera,light,layout});
 assert.deepEqual(resolveOperation({sourceImage:false,change:change(true,true,true)}),{operation:"create"});
 assert.deepEqual(resolveOperation({sourceImage:true,change:change(true,false)}),{operation:"camera_edit"});
 assert.deepEqual(resolveOperation({sourceImage:true,change:change(false,true)}),{operation:"relight_edit"});
 assert.deepEqual(resolveOperation({sourceImage:true,change:change(false,false)}),{operation:"content_edit"});
 assert.deepEqual(resolveOperation({sourceImage:true,change:change(false,false,true)}),{operation:"content_edit"});
 for(const c of [change(true,true),change(true,false,true),change(false,true,true)])assert.deepEqual(resolveOperation({sourceImage:true,change:c}),{conflict:"edit_scope_mixed"});
});
test("edit locks open the prompt and replace the generic «preserve framing and lighting» rule they would contradict",()=>{
 const content="A man at a café table. "+GENERIC_EDIT_RULE_EN+". Keep his face exactly.";
 const cam=compileImagePrompt({content,staging:room,aspect:"3:4",operation:"camera_edit"}).prompt;
 assert.match(cam,/^Edit the source photo: move only the camera, to the viewpoint described below\..*Do not turn the person to imitate the camera move\..* Camera and light, exactly as arranged:/);
 assert.ok(!cam.includes(GENERIC_EDIT_RULE_EN)&&cam.includes("Keep his face exactly."),cam);
 const light=compileImagePrompt({content,staging:room,aspect:"3:4",operation:"relight_edit"}).prompt;
 assert.match(light,/^Edit the source photo: change only the lighting.*do not lay a uniform colour tint over the whole image\./);
 const plain=compileImagePrompt({content,staging:room,aspect:"3:4",operation:"content_edit"}).prompt;
 assert.ok(plain.startsWith("Camera and light, exactly as arranged:")&&plain.includes(GENERIC_EDIT_RULE_EN),"a content edit keeps the generic rule and has no lock");
});
test("a photo edit whose canvas changes the camera and the light together is refused at «بساز», before any price; one kind of change gets its lock",async()=>{
 const id=crypto.randomUUID();
 keepEditTurnForTests(id,"x",{content:"A man at a café table. "+GENERIC_EDIT_RULE_EN+".",aspect:"3:4",staging:room});
 const both={...orbitCamera(room,90),lights:room.lights.map((l,i)=>i?l:{...l,colorHex:"#2979ff",tint:0.9})};
 assert.throws(()=>deriveTurnWithStaging(id,both),(e:unknown)=>e instanceof SceneEditConflict&&/یا دوربین، یا نور/.test(e.messageFa));
 const cam=getPrivateMediaPrompt(deriveTurnWithStaging(id,orbitCamera(room,90))!)!;
 assert.match(cam,/^Edit the source photo: move only the camera/);assert.ok(!cam.includes(GENERIC_EDIT_RULE_EN));
 const light=deriveTurnWithStaging(id,{...room,lights:both.lights})!;
 assert.match(getPrivateMediaPrompt(light)!,/^Edit the source photo: change only the lighting/);
 // A second change is checked against the photo's scene, not the first change: light after an already-relit turn is still a relight.
 assert.match(getPrivateMediaPrompt(deriveTurnWithStaging(light,{...room,lights:[room.lights[0],{...room.lights[1],intensity:0.2}]})!)!,/^Edit the source photo: change only the lighting/);
 // A new image may change both: no source photo, no lock.
 const first=await orchestrateCreativeTurn({text:"portrait of a man in a café"});assert.equal(first.status,"planned");
 const planned=(first as {plan:{staging:typeof room}}).plan.staging;
 const created=deriveTurnWithStaging((first as {turnId:string}).turnId,{...orbitCamera(planned,90),lights:planned.lights.map((l,i)=>i?l:{...l,colorHex:"#2979ff",tint:0.9})},"3:4")!;
 assert.ok(getPrivateMediaPrompt(created)!.startsWith("Camera and light, exactly as arranged:"));
});
