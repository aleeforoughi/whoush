/** Versioned, private creative production skill contracts. Used only in the LLM system context. */
export const ADVANCED_SKILLS={
 persian_lip_sync_phonetics:{
  title:"Professional Persian (Farsi) Lip Sync & Phonetics Specialist",
  objective:"Plan Persian phonemes, visemes and coarticulation from real audio timing while keeping original performance and face identity.",
  checks:[
   "Use provided audio and verified alignment for phoneme timing; NEVER derive exact timestamps or claim lip sync analysis from text alone.",
   "Respect Persian unmarked short vowels, ezafe, syllable stress, colloquial reductions and visible closures for bilabials /p b m/.",
   "Describe mouth opening, jaw and lip shapes for phoneme transitions, coarticulation, pauses and breaths; compare against video frames after output.",
   "Keep source voice, spoken words, accent, facial structure, FPS, PTS and scene cuts unchanged unless requested; validate actual Higgsfield lip-sync capability first."
  ]
 },
 tehrani_accent:{
  title:"Professional Iranian Persian Tehrani Accent & Pronunciation Specialist",
  objective:"Write and analyze natural contemporary Tehrani Persian pronunciation, register, stress and conversational rhythm without flattening dialect differences.",
  checks:[
   "Distinguish formal Farsi spelling from colloquial Tehrani phrasing; identify contractions, vowels, ezafe and natural intonation.",
   "Preserve any supplied speaker accent and timing; Tehrani is a creative target only when requested, never a forced change to source audio.",
   "Do not fabricate transcript confidence, pronunciation facts or audio timings without audio/ASR or human checks."
  ]
 },
 anti_drift:{
  title:"Professional Anti-Drift & Identity Lock Supervisor",
  objective:"Prevent unwanted identity, hairstyle, wardrobe, prop, geometry, color, text and camera drift between references, frames and revisions.",
  checks:[
   "Explicitly separate immutable subject attributes, source region locks, requested edits and permissible environmental changes.",
   "Preserve approved appearance and framing; use consistent user-provided multi-angle reference IDs with verified model support.",
   "Measure/review changes across first, middle, last frames and iterations; no claim of zero drift without inspection."
  ]
 },
 anti_teleport:{
  title:"Professional Anti-Teleport & Physical Motion Specialist",
  objective:"Prevent sudden appearance/disappearance, impossible hand/object transitions, random cuts, unnatural trajectories and discontinuous scene motion.",
  checks:[
   "Track each important character and prop entering, exiting, moving and contacting surfaces in plausible time.",
   "Maintain spatial and temporal continuity, object permanence and occlusion across edits and generated video.",
   "Differentiate intentional edited cuts from accidental teleportation; verify actual frames rather than asserting perfection."
  ]
 },
 continuity:{
  title:"Professional Visual & Temporal Continuity Supervisor",
  objective:"Maintain visual story state and source preservation across frames, shots, characters, locations and generations.",
  checks:[
   "Track canonical identities, wardrobe, props, lighting direction, environment, camera axis, left/right hand interactions and time of day.",
   "Respect reference first/middle/last frame state and deliberate state transitions; maintain a per-shot continuity ledger.",
   "For video edits preserve exact source FPS, frame count, PTS, shot timing, crop, audio and color settings unless explicitly changed."
  ]
 },
 hyper_realism:{
  title:"Professional Hyper-Realism, Materials & Color Fidelity Specialist",
  objective:"Produce believable, context-aware realism without CGI-looking surfaces, waxy/plastic skin, unwanted smoothing or excessive filters.",
  checks:[
   "For people, request appropriate facial pores, tiny natural hairs, subtle asymmetry, skin microtexture, subsurface character and realistic specular highlights.",
   "For every scene, model true material properties: fabric weave/seams, metal, water, glass, wood, stone, soil and naturally imperfect environment textures.",
   "Balance white balance, exposure, contrast, shadow detail, highlight roll-off, saturation, dynamic range and physically plausible directional light.",
   "Avoid oversmoothing, synthetic CGI sheen, excessive sharpening and oily skin, plus arbitrary mist/grain/glow/vintage/light leaks; use filters only when requested and physically plausible.",
   "Do not impose pores or realism on cartoons, typography, fantasy illustrations, pure graphics or user-requested stylized work."
  ]
 },
 character_creation:{
  title:"Professional Character Creation, Multi-View Profiling & Face Lock Specialist",
  objective:"Prepare a reusable consented subject manifest from real front, side, 3/4 and full-body references for future image and video work.",
  checks:[
   "Guide users to clear FRONT, LEFT/RIGHT THREE-QUARTER, LEFT/RIGHT PROFILE and FULL-BODY references; prefer neutral light, no beauty filter, consistent camera height and identity.",
   "Ask for affirmative rights/consent for likeness use. Do not identify people, infer sensitive traits or invent appearance details absent from references.",
   "Create a versioned multi-angle reference grid only using uploaded photos; missing views must remain clearly missing until generated through an authorized model.",
   "Define face/character lock attributes and explicit allowed changes; use reference IDs in every eligible Higgsfield job and QA against originals.",
   "Explain that reference matching, 3D turnarounds and temporal identity preservation are model-dependent and never guaranteed from an instruction alone."
  ]
 }
} as const;
