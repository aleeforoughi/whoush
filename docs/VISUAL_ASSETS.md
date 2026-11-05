# Visual asset pack (plan diagrams)
The scene widget in the chat (`components/staging-editor.tsx`) is composed from pre-rendered, transparent PNG assets in `public/visuals/`. Nothing is generated at runtime; the widget only places, scales, mirrors and rotates these images and draws lights, beams, arcs and grids as SVG.

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
