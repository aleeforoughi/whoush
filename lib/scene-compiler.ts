import {describeFocus} from "./frame-css";
import type {Staging} from "./creative-plan";
import {describeStagingEn,facingOf,lensFor,lightAngleOf,sceneLeadEn,wrap180} from "./staging";
import {sceneVisibility} from "./scene-visibility";

/**
 * The image prompt is compiled once from one scene, never concatenated (docs/CANVAS_TO_IMAGE.md, P0 compiler).
 * The canvas is the only source of camera, framing, lens and light. The planner's text supplies what the picture is about (subject, setting, action,
 * style and the rules Whoush adds), with its own camera and lighting wording taken out, so the two can never contradict each other.
 * The order follows the format that followed the canvas best in the 2026-11-05 tests (docs/HIGGSFIELD_EVIDENCE.md#model-fit-2026-11-05): the camera and
 * framing in plain sentences first, then the content, then the full scene and lens.
 */
export const SCENE_COMPILER_VERSION="2026-11-05.1";
export const MAX_MEDIA_PROMPT=3000;

/** Camera, framing and lens wording, the canvas's job. Kept narrow, so the subject's own words (a man holding a camera, a cup of coffee) stay. */
const CAMERA_RE=new RegExp([
 "\\b(extreme |tight |medium |full |wide )?close[- ]?ups?\\b","\\b(medium|wide|long|establishing|cowboy|two|full[- ]?(length|body)|medium[- ]full|medium[- ]close)[- ]shots?\\b",
 "\\bhead[- ]and[- ]shoulders\\b","\\b(waist|knees|chest)[- ]up\\b","\\beye[- ]level\\b","\\b(low|high)[- ]angle\\b","\\bbird'?s[- ]eye\\b","\\bworm'?s[- ]eye\\b",
 "\\btop[- ]down\\b","\\boverhead (shot|view|angle)\\b","\\bdutch (angle|tilt)\\b","\\bthree[- ]quarter (back )?view\\b","\\bside profile\\b","\\bprofile view\\b",
 "\\bin profile\\b","\\bover[- ]the[- ]shoulder\\b","\\bpoint[- ]of[- ]view\\b","\\bpov\\b","\\b\\d{2,3}\\s?mm\\b","\\bf\\/\\d","\\baperture\\b","\\biso\\s?\\d",
 "\\b1\\/\\d+\\s?s\\b","\\bshutter\\b","\\bfocal length\\b","\\bdepth of field\\b","\\bbokeh\\b","\\b(shallow|deep) focus\\b","\\bwide[- ]angle\\b","\\btelephoto\\b",
 "\\bfish[- ]?eye\\b","\\bcamera (angle|height|placed|positioned|is|looks|looking|low|high|at (eye|chest|floor|ground|waist|knee))\\b","\\bframing\\b","\\bframed\\b",
 "\\bcropped at\\b","\\brule of thirds\\b","\\bcent(e?r)ed in (the )?frame\\b"
].join("|"),"i");
/** Lighting wording, the canvas's job too. */
const LIGHT_RE=new RegExp([
 "\\b(key|fill|rim|back|hair|side|top|kicker|accent)[- ]?lights?\\b","\\blight(s|ing)? (from|coming|falls|falling|hits|hitting|wraps|wrapping)\\b",
 "\\blit (from|by)\\b","\\bbacklit\\b","\\bbacklight(ing)?\\b","\\blighting\\b","\\bsoftbox\\b","\\bchiaroscuro\\b","\\brembrandt\\b",
 "\\b(soft|hard|warm|cool|cold|natural|studio|dramatic|cinematic|diffused|directional) (window |day)?light\\b","\\b\\d{4,5}\\s?k\\b","\\bkelvin\\b",
 "\\bcolou?r(ed)? gel\\b","\\bgel(led)? light\\b",
 "\\b(soft|hard|gentle|subtle|warm|cool|strong|main|weak) (key|fill|rim)\\b","\\b(key|fill|rim) (at|from|about|separation)\\b"
].join("|"),"i");
/** A rule (keep, preserve, never…) is Whoush's or the user's constraint, not a camera direction: it is never cut, even when it names the camera or the light. */
const RULE_RE=/\b(keep|keeps|preserve|preserved|do not|don't|never|must not|avoid|only)\b/i;

const isDirection=(clause:string)=>CAMERA_RE.test(clause)||LIGHT_RE.test(clause);

/**
 * Takes the camera, framing, lens and lighting wording out of the planner's text, clause by clause (a clause is a comma-separated part of a sentence),
 * and leaves everything else in place. Sentences that state a rule are left whole.
 */
export function stripSceneDirection(text:string):string{
 const out:string[]=[];
 for(const line of text.split(/\n+/)){
  const sentences=line.split(/(?<=[.!?;])\s+/).filter(s=>s.trim());
  const kept=sentences.flatMap(s=>{
   if(RULE_RE.test(s)||!isDirection(s))return [s];
   const end=/[.!?;]$/.test(s.trim())?s.trim().slice(-1):"";
   const body=end?s.trim().slice(0,-1):s.trim();
   const clauses=body.split(/,\s+/).filter(c=>!isDirection(c));
   if(!clauses.length)return [];
   // A sentence that began with a label («Direction: 50mm») keeps no orphan label.
   const joined=clauses.join(", ").replace(/^[A-Z][a-z]+:\s*$/,"").trim();
   return joined?[joined+end]:[];
  });
  if(kept.length)out.push(kept.join(" "));
 }
 return out.join("\n").replace(/[ \t]{2,}/g," ").trim();
}

export type CompiledImagePrompt={prompt:string;content:string;compilerVersion:string};

/**
 * One image prompt from one scene: the canvas's camera and framing in plain words, then the content (the planner's text without its own camera and light
 * words), then the full scene with its lights, focus and lens, and the aspect ratio. `content` is kept by the caller, so a later canvas change compiles a new
 * prompt from it instead of stacking a second scene on the first.
 */
export function compileImagePrompt(i:{content:string;staging:Staging;aspect:string;operation?:SceneOperation}):CompiledImagePrompt{
 const lock=i.operation?editLockEn(i.operation):undefined;
 // A camera or light edit changes framing or light on purpose: the generic «preserve framing and lighting» rule would contradict it.
 const own=lock?i.content.split(GENERIC_EDIT_RULE_EN+".").join("").split(GENERIC_EDIT_RULE_EN).join(""):i.content;
 const stripped=stripSceneDirection(own);
 // Nothing left means the planner wrote only direction: keep its text rather than send a prompt with no subject.
 const content=stripped||own.trim();
 // Only what the crop shows is described: a prop outside the frame is not in the picture, so it is left out of the layout and the people count.
 const props=i.staging.props??[],vis=props.length?sceneVisibility(i.staging,i.aspect):undefined,mainAt=Math.max(0,props.findIndex(p=>p.main));
 const shown:Staging=vis?{...i.staging,props:props.filter((_,j)=>j===mainAt||vis.inFrame[j])}:i.staging;
 const lead=(lock?lock+" ":"")+sceneLeadEn(shown)+" ";
 // The lights are stated once, in the lead; the scene at the end carries the rest (placement, layout, focus, lens).
 const tail=" Scene (must match): "+describeStagingEn(shown,{lights:false})+describeFocus(i.staging,undefined,i.aspect).en+" "+lensFor(i.staging).en+" Aspect ratio "+i.aspect+".";
 const room=Math.max(0,MAX_MEDIA_PROMPT-lead.length-tail.length);
 return {prompt:(lead+content.slice(0,room)+tail).slice(0,MAX_MEDIA_PROMPT),content:i.content,compilerVersion:SCENE_COMPILER_VERSION};
}

// ---- operations and edit locks (docs/CANVAS_TO_IMAGE.md section 3) ----
/**
 * What a request does to the picture. `create` makes a new image. With a source photo: `camera_edit` moves only the camera, `relight_edit` changes only the
 * light, and `content_edit` keeps both and changes what the user's words ask (an object, a garment), as before.
 */
export type SceneOperation="create"|"camera_edit"|"relight_edit"|"content_edit";
export type SceneChange={camera:boolean;light:boolean;layout:boolean};
/** The edit rule Whoush adds to every edit of a source photo. A camera or light edit changes framing or lighting on purpose, so it is replaced there. */
export const GENERIC_EDIT_RULE_EN="Preserve all unedited source regions: identity, framing, lighting, color and pixels";
const r3=(v:unknown):unknown=>typeof v==="number"?Math.round(v*1000)/1000:Array.isArray(v)?v.map(r3):v&&typeof v==="object"?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a<b?-1:1).map(([k,x])=>[k,r3(x)])):v;
const same=(a:unknown,b:unknown)=>JSON.stringify(r3(a))===JSON.stringify(r3(b));
/**
 * The scene in room terms. The canvas keeps the lights and props relative to the camera (an orbit turns them with it), so a camera move alone would look
 * like moved lights and props: here they are turned back by the camera's orbit, so only real changes show.
 */
function roomOf(s:Staging){
 const az=s.cameraAzimuth??0,a=-az*Math.PI/180,c=Math.cos(a),n=Math.sin(a),props=s.props??[],m=props.find(p=>p.main)??props[0],px=m?.x??0,pz=m?.z??0;
 return {
  lights:s.lights.map(l=>{const g=lightAngleOf(l);const {angle:_a,direction,...rest}=l;void _a;return {...rest,at:g===undefined?direction:Math.round(((g-az)%360+360)%360)%360};}),
  props:props.map(p=>{const dx=p.x-px,dz=p.z-pz;const {x:_x,z:_z,facing:_f,cut:_c,...rest}=p;void _x;void _z;void _f;void _c;
   return {...rest,x:Math.round((px+dx*c+dz*n)*20)/20,z:Math.round((pz-dx*n+dz*c)*20)/20,facing:Math.round(wrap180(facingOf(p)+az)/3)*3};}),
  layout:{subject:s.subject??"person",environment:s.environment,environmentDistance:s.environmentDistance}
 };
}
/** Which parts of the scene changed between two arrangements: the camera (angle, orbit, height, zoom, framing, lens, focus), the light, the layout. */
export function sceneChangeGroups(before:Staging,after:Staging):SceneChange{
 const rb=roomOf(before),ra=roomOf(after);
 const cam=(s:Staging)=>{const {lights:_l,props:_p,subject:_s,environment:_e,environmentDistance:_d,cameraAzimuth,...rest}=s;void _l;void _p;void _s;void _e;void _d;return {...rest,cameraAzimuth:Math.round(cameraAzimuth??0)};};
 return {camera:!same(cam(before),cam(after)),light:!same(rb.lights,ra.lights),layout:!same(rb.props,ra.props)||!same(rb.layout,ra.layout)};
}
/** The operation for a request: a new image without a source photo; with one, the single kind of change it makes. Camera and light together are refused. */
export function resolveOperation(i:{sourceImage:boolean;change:SceneChange}):{operation:SceneOperation}|{conflict:"edit_scope_mixed"}{
 if(!i.sourceImage)return {operation:"create"};
 const {camera,light,layout}=i.change;
 if(camera&&(light||layout))return {conflict:"edit_scope_mixed"};
 if(light&&layout)return {conflict:"edit_scope_mixed"};
 return {operation:camera?"camera_edit":light?"relight_edit":"content_edit"};
}
/** Persian: why a photo edit that changes the camera and the light together is not quoted, and what to do instead. */
export const FA_EDIT_SCOPE_MIXED="برای ویرایش عکس، هر بار فقط یکی رو عوض کن: یا دوربین، یا نور. اول یکی رو بساز، بعد اون یکی رو روی نتیجه‌ش اعمال کن.";
/** The edit's lock in plain words, first in the prompt: what may change, and everything that must stay. */
const EDIT_LOCK_EN:Partial<Record<SceneOperation,string>>={
 camera_edit:"Edit the source photo: move only the camera, to the viewpoint described below. Keep the same person (face, hair, beard, body, and every garment and its details), the same pose and head orientation in the room, the same place, objects and layout, and the same lights in the room. Do not turn the person to imitate the camera move. Surfaces the new view reveals must match the source.",
 relight_edit:"Edit the source photo: change only the lighting, as described below. Do not move the camera or change the crop, the pose, the face, the hair, the clothing design, the objects or the layout. Update shadows, highlights and reflections to match the new lights; do not lay a uniform colour tint over the whole image."
};
export const editLockEn=(op:SceneOperation)=>EDIT_LOCK_EN[op];
