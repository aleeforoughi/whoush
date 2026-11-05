# Visual asset pack (plan diagrams)
«بوم» (Canvas), the scene widget in the chat (`components/staging-editor.tsx`), is composed from pre-rendered, transparent PNG assets in `public/visuals/`. Nothing is generated at runtime; the widget only places, scales, mirrors and rotates these images and draws lights, beams, arcs and grids as SVG.

- **Generated once** with OpenAI's image model (`gpt-image-1.5`; `gpt-image-2` does not support transparent backgrounds) by `scripts/generate-visual-assets.ts`, then trimmed and resized to at most 640px with sharp. `lib/visual-assets.ts` is written by `scripts/visual-manifest.ts` from the files (id, URL, pixel size).
- **Consistency:** `person-side` is the style anchor. Every other asset is generated through the image edits endpoint from the anchor, plus an earlier asset of the same family (for example `camera-top` from `camera-side`), so material, colour, sheen, lighting and simplification match.
- **Style:** soft matte clay with a satin sheen, light grey-white, soft light from the upper left, no ground, no shadow, no text, no logos.
- **Contents:**
  - **Subjects:** person (side, front, top), object, animal, vehicle (each side and top).
  - **Environment:** mountains, tree, building, and a top-view cluster.
  - **Camera:** side and top views.
  - **Light sources:** softbox, LED panel, practical lamp, window, neon, flash, sun, moon, sky, fire.
- **To replace one asset:** run `node --import tsx scripts/generate-visual-assets.ts <id>` with `OPENAI_API_KEY` set, then `node --import tsx scripts/visual-manifest.ts`. Raw outputs go to `public/visuals/raw/` (git-ignored).
- Using an image model for internal UI illustration is separate from customer media generation, which stays on Higgsfield only (CLAUDE.md).

## «بوم» (Canvas): the scene widget
- **Scenes:** Whoush builds the scene from the brief before anything is generated. It sets the subject and the main props (person, object, animal, vehicle, tree, building) with Persian labels and a ground layout, plus camera, framing and lights. A planner's crowded or all-lifted layout is tidied; the user's own arrangement never is.
- **Smooth controls:** every adjustment is continuous: camera elevation in degrees, zoom on a smooth log scale, any light angle, free crop and prop positions. The named values («زاویهٔ بالا», «نمای متوسط», «جلو، چپ») are the nearest description; the exact values (`cameraElevation`, `shotScale`, light `angle`) are applied and described to Whoush and the provider.
- **Zoom:** a uniform scale of one fixed world around the main subject's focus, so props and the environment keep their relative positions at every zoom.
- **Views:**
  - **کادر و چیدمان (framing and layout):** the camera's view in simple perspective. Drag a prop sideways for left/right, up for further back, down for nearer; drag the background to slide the crop (snaps to thirds). A prop's lift above the ground is in the inspector below. What is in the scene (subject, props, environment) is decided by Whoush from the conversation: the canvas has no add, remove or subject controls; ask in the chat to change what is in the scene.
  - **دوربین (camera):** the main subject from the side; drag the camera along its arc (five angles, dutch toggle).
  - **نور (lighting):** only the lights and the target from above; drag lights around (eight directions); the inspector sets role, source, softness, height, kelvin and gel.
- **Shared scene:** all views share one draft, so moving a prop updates every view at once. The environment is the fixed backdrop.
- **Collapsed by default:** «بوم» is advanced settings. The collapsed card shows three live, read-only snapshots (frame, camera, lighting) and «تغییر کرده» when adjusted; opening it shows the canvas with its controls.
- **Two ways to adjust, always in sync:** drag directly on the canvas, or use the sliders under each view. Framing has zoom, crop left/right and up/down, and the selected prop's left/right, front/back and lift. Camera has elevation and dutch. Lighting has the selected light's angle, plus role, source, softness, height, kelvin and gel.
- **No apply step:** on the live generation, «بساز» builds exactly the arranged scene. The quote request carries the scene; the server applies it to that turn's private plan (a new private turn, `deriveTurnWithStaging`) and quotes that, so the browser never sends a prompt. The canvas aspect ratio goes as the model's real aspect-ratio setting where the model supports it. On an older generation (expired quote), an adjusted canvas offers «این صحنه رو بساز», a revision turn with the scene applied exactly.
- **Fidelity:** what the brief says explicitly (angle such as «از بالا», shot size such as «کلوزآپ», side, lighting words such as «ضدنور» or «نور پنجره») wins over the planner's staging (`applyStagingCues`). Every provider prompt ends with the scene as the deciding direction («Scene (must match)»). Image models follow such directions closely but not pixel-exactly; an automatic check of the output against the canvas needs image inspection after generation, which is not built yet.
- **Layout:** the three views are stacked in one scroll (framing and layout, then camera, then lighting), each with its controls underneath, at every width. Every element stays inside its view (checked at 375px: no element outside its view, no horizontal scroll).
- **Input:** guides and borders are thin (0.4 to 0.7 units); touch targets are at least 44px; everything works with the keyboard.

## Live progress in the chat
POST /api/agent streams real stages (`Accept: application/x-ndjson`): reading, planning, checking, pricing, then the result. The chat shows «هووش داره کار می‌کنه» with the current stage from the moment a message is sent, in Persian or Finglish. The reply is checked in full on the server (safety, leaks, script) before it is shown, then types itself out (instantly under reduced motion). Raw model tokens are never streamed to the user.
