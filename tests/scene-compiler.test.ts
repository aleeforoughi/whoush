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
