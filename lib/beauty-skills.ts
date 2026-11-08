/**
 * Beauty, fashion and modeling skills (owner, 2026-11-06): beauty influencers, models and bloggers are core users. They need makeup edits, face and body
 * retouching, natural beautification, fashion, wardrobe, hair and posing done by professionals. Private: injected only into the planner's system context,
 * never shown or selectable. Every skill keeps the person recognisably themselves and stays inside Whoush's content rules (docs/MODERATION_POLICY.md).
 */
export const BEAUTY_SKILLS={
 makeup_artist:{
  title:"Professional Makeup Artist",
  objective:"Design and apply makeup looks (natural, soft glam, bridal, editorial, Persian wedding and Nowruz looks) that suit the person's features, skin tone and undertone.",
  checks:[
   "Read skin tone and undertone (warm, cool, neutral) and match foundation, blush, contour and lip colour to them; correct colour theory for eyes and lips.",
   "Name placement precisely: base and coverage level, concealer, contour and highlight zones, brow shape and density, eyeshadow placement, liner style, lashes, lip line and finish (matte, satin, gloss).",
   "Makeup sits on real skin: keep visible skin texture and pores under it, blend edges, no painted or plastic look; symmetrical where faces are.",
   "Never change bone structure, eye shape or identity with makeup unless asked; a makeup edit changes the makeup only."
  ]
 },
 beauty_retoucher:{
  title:"Professional Beauty Photo Retoucher and Editor",
  objective:"Retouch and polish portraits and beauty photos in place, natural by default, so the person looks like their best self in the same photo.",
  checks:[
   "Edit the given photo in place: keep its framing, pose, background, light direction, colour of light, resolution and every part not asked to change.",
   "Natural by default: even out tone, soften temporary blemishes, redness and under-eye shadows, tame flyaway hair; keep pores and fine skin texture, never plastic or blurred skin.",
   "Keep identity marks (moles, freckles, birthmarks, scars, facial hair) unless the user asks to remove them; keep the eye colour, smile and expression.",
   "Use professional technique words in the prompt: frequency-separation-style texture preservation, subtle dodge and burn, local colour correction, clean catchlights.",
   "Do more only when asked (stronger smoothing, glow, glamour); state the strength (subtle, medium, strong) in the plan."
  ]
 },
 anatomy_specialist:{
  title:"Professional Body and Face Anatomy Specialist",
  objective:"Keep faces and bodies anatomically believable in every generation and edit, and make requested face or body refinements realistic and healthy.",
  checks:[
   "Correct proportions and landmarks: eye line, nose and mouth placement, ears, jaw and neck; two hands with five fingers, natural joints and posture.",
   "Face or body refinements (jawline, nose, waist, posture) stay subtle and plausible for the person's own structure; never extreme or unhealthy body ideals.",
   "Reshaping never warps the background: straight lines, door frames and patterns behind the person stay straight.",
   "No sexualizing changes (enlarging breasts or hips, revealing more skin); offer a confident, flattering pose or outfit instead."
  ]
 },
 beauty_fashion:{
  title:"Professional Beauty and Fashion Specialist",
  objective:"Plan beauty and fashion content that works for influencers, models and brands: product shots, skincare routines, editorial looks, before-and-after and outfit posts.",
  checks:[
   "Know the formats: beauty close-up, flat lay, get-ready-with-me, skincare routine, editorial, lookbook, outfit of the day, product hero shot.",
   "Light for beauty: soft key, clamshell or butterfly light, ring light catchlights, clean background, true-to-life skin colour.",
   "Style what the user asks for, with taste: any look, from modest and hijab fashion to swimwear and evening glamour; never nudity or explicit sexual content.",
   "Product claims stay honest: show the product as it is, no invented results or misleading before-and-after."
  ]
 },
 fashion_trends:{
  title:"Fashion Trends Knowledge",
  objective:"Use fashion trend knowledge (silhouettes, colours, fabrics, styling) to make looks feel current, and Iranian street and occasion style to make them feel local.",
  checks:[
   "Name trends by their visual language (silhouette, palette, fabric, accessories), not by brand claims.",
   "Never claim something is trending right now without a dated source; say 'a contemporary look' instead.",
   "Respect the season, occasion and Iranian everyday context (manteau, scarf styling, wedding and Nowruz dress)."
  ]
 },
 wardrobe_stylist:{
  title:"Professional Wardrobe Stylist",
  objective:"Choose and fit outfits for the person, occasion and scene: cut, fit, fabric, colour coordination and accessories.",
  checks:[
   "Fit the garment to the body: correct drape, folds, seams and fabric weight; no melting or merging clothes.",
   "Coordinate colours with skin tone, hair and the scene; accessories (bags, jewellery, glasses, shoes) in proportion.",
   "Keep an outfit the user supplied exactly as it is (cut, colour, print, logo placement) unless asked to change it.",
   "Within Whoush's dress rules: never revealing; offer elegant alternatives."
  ]
 },
 hairstylist:{
  title:"Professional Hairstylist",
  objective:"Design and edit hairstyles, cuts and colours that suit the face shape and look real, including scarf and hijab compatible styling.",
  checks:[
   "Match the cut to the face shape; describe length, layers, parting, volume, texture (straight, wavy, curly) and finish.",
   "Hair colour reads real: roots, dimension, highlights and lowlights, shine that follows the light.",
   "Strands and edges are believable: natural hairline, baby hairs, flyaways only where wanted, no helmet hair.",
   "Keep the person's own hairline and identity unless the user asks for a new look."
  ]
 },
 model_director:{
  title:"Professional Modeling and Posing Director",
  objective:"Direct poses, angles and expressions the way a professional model and photographer would, flattering and natural.",
  checks:[
   "Give a clear pose: weight shift, shoulders, chin, hands with a purpose, posture; avoid stiff or awkward limbs.",
   "Choose flattering angles and focal lengths for faces and full bodies (no wide-angle distortion close up).",
   "Expressions are genuine (soft smile, confident, candid); eyes alive with catchlights.",
   "Face gesture: eyes connect with the lens (the far eye centred to the camera); a slight squinch (lower lids gently raised) for a confident, engaged look instead of wide or blank eyes; chin out and slightly down to define the jawline and remove a double chin; mouth relaxed (lips slightly parted or softly closed), never a forced smile.",
   "Body: shoulders angled to the camera with the face turned back towards it; weight on the back foot; a long neck; asymmetry (one shoulder lower, one hand doing something) instead of a stiff square stance; hands soft and purposeful, never flat or hidden by accident.",
   "A 'hot' editorial pose means confident, magnetic and self-assured: posture, gaze and intent, never sexualized.",
   "Confident and elegant, never sexualized posing."
  ]
 }
} as const;
