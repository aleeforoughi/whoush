import {describeFocus} from "./frame-css";
import type {Staging} from "./creative-plan";
import {describeStagingEn,lensFor,sceneLeadEn} from "./staging";

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
export function compileImagePrompt(i:{content:string;staging:Staging;aspect:string}):CompiledImagePrompt{
 const stripped=stripSceneDirection(i.content);
 // Nothing left means the planner wrote only direction: keep its text rather than send a prompt with no subject.
 const content=stripped||i.content.trim();
 const lead=sceneLeadEn(i.staging)+" ";
 // The lights are stated once, in the lead; the scene at the end carries the rest (placement, layout, focus, lens).
 const tail=" Scene (must match): "+describeStagingEn(i.staging,{lights:false})+describeFocus(i.staging,undefined,i.aspect).en+" "+lensFor(i.staging).en+" Aspect ratio "+i.aspect+".";
 const room=Math.max(0,MAX_MEDIA_PROMPT-lead.length-tail.length);
 return {prompt:(lead+content.slice(0,room)+tail).slice(0,MAX_MEDIA_PROMPT),content:i.content,compilerVersion:SCENE_COMPILER_VERSION};
}
