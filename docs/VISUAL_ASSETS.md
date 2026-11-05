# Visual asset pack (plan diagrams)
«بوم» (Canvas), the scene widget in the chat (`components/staging-editor.tsx`), is composed from pre-rendered, transparent PNG assets in `public/visuals/`. Nothing is generated at runtime; the widget only places, scales, mirrors and rotates these images and draws lights, beams, arcs and grids as SVG.

- **Generated once** with OpenAI's image model (`gpt-image-1.5`; `gpt-image-2` does not support transparent backgrounds) by `scripts/generate-visual-assets.ts`, then trimmed and resized to at most 640px with sharp. `lib/visual-assets.ts` is written by `scripts/visual-manifest.ts` from the files (id, URL, pixel size).
- **Consistency:** `person-side` is the style anchor. Every other asset is generated through the image edits endpoint from the anchor, plus an earlier asset of the same family (for example `camera-top` from `camera-side`), so material, colour, sheen, lighting and simplification match.
- **Style:** soft matte clay with a satin sheen, light grey-white, soft light from the upper left, no ground, no shadow, no text, no logos.
- **Contents:**
  - **Subjects:** object (side and top); every angle for the props that look different from each side, so the frame and the camera views show exactly how each faces the camera:
    - **Man** (`human-*`, short grey hair so the back of the head reads differently from the face side) and **woman** (`woman-*`, a slimmer figure with a grey bob): front, front three-quarter, side, rear three-quarter, back and top.
    - **Car:** front, front three-quarter, side, rear three-quarter, back and top. **Cat:** front, three-quarter, side, rear three-quarter, back and top.
    - The older plain mannequin (`person-*`) is kept as a fallback.
  - **Which way an image faces** is checked by eye after generating (the prompts ask for one way; the model does not always follow) and recorded in `NATIVE` in `components/staging-editor.tsx`; front and back views are symmetric and never mirrored.
  - **Tints:** props of the same kind (several people) each get a soft tint so they read apart; the camera is tinted blue in the camera views.
  - **Environment:** mountains, tree, building, and a top-view cluster.
  - **Camera:** side and top views.
  - **Light sources:** softbox, LED panel, practical lamp, window, neon, flash, sun, moon, sky, fire.
- **To replace one asset:** run `node --import tsx scripts/generate-visual-assets.ts <id>` with `OPENAI_API_KEY` set, then `node --import tsx scripts/visual-manifest.ts`. Raw outputs go to `public/visuals/raw/` (git-ignored).
- Using an image model for internal UI illustration is separate from customer media generation, which stays on Higgsfield only (CLAUDE.md).

## The angle matrix (Plan A)
- **Characters only:** the man, the woman and the pets (cat, dog, horse) have images.
  - Each is a matrix of five heights (top, high, eye level, low, bottom, the camera's stops in `VERTICAL_STOPS`) times five sides (front, 3/4, side, rear 3/4, back). The other side is the mirror.
  - Eye level is the original pack (the cat is the `animal-*` family). The other heights are `<family>-<height>-<side>` (`human-high-3q`).
  - **The top row is the plan view:** from overhead every side shows the family's straight-down picture (`human-top`, `woman-top`, `animal-top`, `dog-top`, `horse-top`), turned in its plane to the way the character faces (`spin` in `spriteFor`). Every plan view is drawn with the head toward the bottom edge.
- **Everything else is a cube:** objects, vehicles, buildings, trees and any other animal.
  - It's drawn as vector geometry, not an image: a real box of the thing's size, width × height × depth in metres.
  - In the frame it's CSS planes (`boxFaces` in `lib/frame-css.ts`) with clay shading; in the small diagrams it's an SVG box or footprint.
  - **Size:** the planner gives the size (`size` on the prop). Otherwise it comes from the everyday size of what the label names (`cubeDims` in `lib/staging.ts`: a desk 1.2 × 0.75 × 0.7, a phone, a car, a tower...), else a 30 cm box.
  - **Stacking:** a smaller object on a larger one's spot rests on its top (a phone on a desk). Moved off, it's back on the ground.
  - **Colours:** several cubes each get their own tint.
- **Generated** by `scripts/generate-visual-assets.ts` from the same side's eye-level image (plus the style anchor), so design, facing and style match the pack. The dog and the horse start from the cat's style.
  - A generated image faces the way its eye-level reference does unless `NATIVE` in `lib/sprites.ts` says otherwise; check new ones by eye.
  - **Done:** the man's and the woman's full matrices (the man's side column regenerated as true profiles), except the woman's bottom-back. The dog's and the horse's eye-level sides and plan views. The cat's high side. Dog and horse side pictures face right (`NATIVE`).
  - **Still to generate (OpenAI credits ran out):** the woman's bottom-back, and the cat's, dog's and horse's high, low and bottom rows. Run `scripts/generate-visual-assets.ts` for the missing ids, then `scripts/visual-hd.ts` and `scripts/visual-manifest.ts`.
  - **The head in each person picture** is measured by `scripts/visual-head.ts` (its top, its neck, its middle across) and recorded in the manifest (`head`).
  - **Missing images** fall back to the same side at the next height toward eye level (`spriteFor`).
- **Removed:** the bottle, car, building and tree images (they're cubes now).

## Beta: characters only
«بوم»'s frame draws only the characters: people and the pets with their own images (cat, dog, horse). Other props (objects, vehicles, buildings, trees, other animals) stay in the scene, the plan and the provider prompt, but the frame doesn't draw them and the focus can't be placed on them (`isCharacter`). A scene without a character (only a place, or only other props) shows no frame, only the camera and the lighting (`showsFrame`).

**The cube in the diagrams:** in the camera, distance, orbit and lighting tiles, anything that isn't a character (a product, a car, a tree, or a place with no props) is one smooth, minimal cube at a small fixed size, whatever it stands for. From the side it's `cube-3q` (a three-quarter view, corner first). From above it's `cube-top` (only its top face), turned 45° into a diamond to match. Both come from the pack's generator; `components/clay-box.tsx` draws a vector clay box until they exist.

## The frame renderer
- **CSS 3D (Plan A, default):** `components/frame-css.tsx` with `lib/frame-css.ts`. It uses one pinhole camera, the same one the prompt uses (`camera3D`).
  - The CSS perspective distance is the focal length in pixels, so a wide lens close up stretches depth and a long lens flattens it.
  - The ground grid and the room and studio walls are drawn in perspective.
  - Each character is its pack image for the height stop and side the camera sees it from, measured where the camera aims. Everything else is a box of its real size. Both are blurred by their distance from the focus (thin-lens circle of confusion).
  - **No jump between angles:** each picture faces the camera squarely, tilted to the camera's real height, and is sized to how tall the character really looks from there. Up to a ۳/۴ shot a person's picture is placed by its face: the measured face sits where the camera aims and the head keeps its real size, whichever height's picture is drawn (from below the legs are drawn long and the head small). A full-length shot places it by its body so the feet stay on the ground; between, it blends with the zoom (`closeShare`). The camera's distance in a close shot doesn't depend on the angle either.
  - **The place:** open places show a wide mountain range edge to edge along the horizon, with its base on it; the mountains show the lens and the aperture best. The background's distance is Whoush's estimate from the brief (`environmentDistance`), else cues in its words (against a wall, in the distance), else the place's usual distance. It isn't user-adjustable.
  - **Fisheye:** an ordinary lens keeps straight lines straight at every focal length, as the photo will. A fisheye is opt-in: the «لنز چشم‌ماهی» toggle under the lens, or a brief that asks for one ("fisheye", «فیش‌آی», «چشم ماهی»). The picture then bulges from the centre, more on a wider lens, and the provider prompt says so.
  - **Sharp at any lens:** every 3D element (image planes, box faces, walls, mountains) is sized to about its size on screen (`crispPlane`), because the browser rasterizes a 3D-transformed element at its own pixel size and then stretches it. Extreme close-ups are limited only by the images' own 640 px.
  - **Limits (every control stays in control):**
    - **Zoom:** the tightest zoom keeps the camera at least 30 cm from the focus (12 cm for a small product), outside the dominant subject and over a figure's head from above. It also never blows a character up past 3× its sharpest image (`zoomLimits`). A new lens or angle that breaks this pulls the zoom back.
    - **Extreme close-up of a character:** the zoom goes on past that, down to the eyes or the mouth (the «لب‌ها» focus detail). The frame stops at the whole head (its height × `HEAD_ROOM`). Tighter, it stays there and a green border on the face shows the real crop, growing and shrinking with the zoom (`closeUp`). No extra images are needed.
    - **Props:** drag as far past either edge as the other (a third of the frame), never behind the lens, and stop before the background (`propReach3D`). Their sliders use the same range.
    - **Focus dot:** stays inside the frame.
  - **HD characters:** `scripts/visual-hd.ts` exports each character image as a WebP of up to 1536 px from its raw generation, trimmed exactly like the 640 px PNG. The frame uses it when a character is drawn larger than its PNG. Re-run it, then `scripts/visual-manifest.ts`, after generating.
- **WebGL (Plan B, parked):** the three.js models are kept in `components/scene-3d.tsx` and on the `archive/plan-b-3d` branch. Switch with `FRAME_RENDERER` in `components/staging-editor.tsx`.
- **Angle controls:** the height and orbit sliders, the camera drags and each prop's turn snap to the stops. The joystick in the frame's bottom-left steps them: up and down change the height, left and right orbit 45°. Its centre shows the angle and resets to eye level, from the front.

## «بوم» (Canvas): the scene widget
- **Camera distance tile:** the subject on the left and the camera on its stand to the right. Drag the camera sideways for its distance (the frame's zoom), or up and down for its height on the stand, a pedestal move that keeps the angle (`cameraLift`, also the «بالا و پایین بردن دوربین (پایه)» slider, never under the ground: `liftLimits`). The stand's arrows move only the height. For a character, a blue dotted rectangle on it shows what the frame covers (`cropOnSubject`): the lens, the angle, the crop and the camera's height all move it, exactly as the frame draws it.
- **Scenes:** Whoush builds the scene from the brief before anything is generated. It sets the subject and the main props (person, object, animal, vehicle, tree, building) with Persian labels and a ground layout, plus camera, framing and lights. A planner's crowded or all-lifted layout is tidied; the user's own arrangement never is.
- **Smooth controls:** every adjustment is continuous: camera elevation in degrees, zoom on a smooth log scale, any light angle, free crop and prop positions. The named values («زاویهٔ بالا», «نمای متوسط», «جلو، چپ») are the nearest description; the exact values (`cameraElevation`, `shotScale`, light `angle`) are applied and described to Whoush and the provider.
- **Zoom:** a uniform scale of one fixed world around the main subject's focus, so props and the environment keep their relative positions at every zoom.
- **Views:**
  - **کادر و چیدمان (framing and layout):** the camera's view in simple perspective. Drag a prop sideways for left/right, up for further back, down for nearer; drag the background to slide the crop (snaps to thirds). A prop's lift above the ground is in the inspector below. What is in the scene (subject, props, environment) is decided by Whoush from the conversation: the canvas has no add, remove or subject controls; ask in the chat to change what is in the scene.
  - **دوربین (camera):** the main subject from the side; drag the camera along its arc (five angles, dutch toggle).
  - **نور (lighting):** only the lights and the target from above; drag lights around (eight directions); the inspector sets role, source, softness, height, kelvin and gel.
- **Shared scene:** all views share one draft, so moving a prop updates every view at once. The environment is the fixed backdrop.
- **Collapsed by default:** «بوم» is advanced settings. The collapsed card lists three live, read-only snapshots vertically (frame, camera, lighting), each the same drawing as the open view with the same caption beside it (both come from `viewCaptions`), plus «تغییر کرده» when adjusted; opening it shows the canvas with its controls. Guide lines and borders are drawn at a constant 1px screen width (`non-scaling-stroke`), so a snapshot looks exactly like the open view at any size.
- **Two ways to adjust, always in sync:** drag directly on the canvas, or use the sliders under each view. Framing has zoom, crop left/right and up/down, and the selected prop's left/right, front/back and lift. Camera has elevation and dutch. Lighting has the selected light's angle, plus role, source, softness, height, kelvin and gel.
- **No apply step:** on the live generation, «بساز» builds exactly the arranged scene. The quote request carries the scene; the server applies it to that turn's private plan (a new private turn, `deriveTurnWithStaging`) and quotes that, so the browser never sends a prompt. The canvas aspect ratio goes as the model's real aspect-ratio setting where the model supports it. On an older generation (expired quote), an adjusted canvas offers «این صحنه رو بساز», a revision turn with the scene applied exactly.
- **Fidelity:** what the brief says explicitly (angle such as «از بالا», shot size such as «کلوزآپ», side, lighting words such as «ضدنور» or «نور پنجره») wins over the planner's staging (`applyStagingCues`). Every provider prompt ends with the scene as the deciding direction («Scene (must match)»). Image models follow such directions closely but not pixel-exactly; an automatic check of the output against the canvas needs image inspection after generation, which is not built yet.
- **Layout:** the three views are stacked in one scroll (framing and layout, then camera, then lighting), each with its controls underneath, at every width. Every element stays inside its view (checked at 375px: no element outside its view, no horizontal scroll).
- **Input:** guides and borders are thin (0.4 to 0.7 units); touch targets are at least 44px; everything works with the keyboard.

## Live progress in the chat
POST /api/agent streams real stages (`Accept: application/x-ndjson`): reading, planning, checking, pricing, then the result. The chat shows «هووش داره کار می‌کنه» with the current stage from the moment a message is sent, in Persian or Finglish. The reply is checked in full on the server (safety, leaks, script) before it is shown, then types itself out (instantly under reduced motion). Raw model tokens are never streamed to the user.

## 3D models for the frame
«بوم»'s 3D frame draws each prop and the mountains from `public/visuals/3d/<id>.glb` (`MODELS_3D` in `lib/scene3d.ts`), built to match this pack: silhouettes measured on the PNGs, modelled in Spline, fused, rigged (the man and the woman carry a humanoid skeleton for posing) and exported with Blender. The pipeline, the tools and each model's measured match are in `scripts/models-3d/README.md`. In open places the ground runs out to a hazed horizon with the mountain range at the place's distance.
