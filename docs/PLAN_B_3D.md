# Plan B: 3D scenes from a reusable library (owner, 2026-11-08)

## What the owner asked for
- **No new 3D:** Whoush never builds 3D. It picks models from a wide library of free, reusable 3D models and arranges them. The library replaces all current props (8 GLBs today, `MODELS_3D` in `lib/scene3d.ts`).
- **Lo-fi Blender render:** a lo-fi picture of the scene with all its props, so users see what they will get before paying. It must be very cheap, fast and lo-fi.
- **Lighting:** the light follows the prompt (time of day, direction, colour temperature and mood).
- **In the browser:**
  - fast to load, small, high frame rate;
  - smooth, eased camera movement while moving the frame;
  - camera angles continuous, not stepped. The 5 fixed heights exist only because the current frame draws 2D sprites.

## Measured: Blender lo-fi render cost
Measured 2026-11-08 on an Apple M4. The scratchpad script imports 6 of our GLBs, adds a ground, a sun and a 35 mm camera, then renders one still. Timings include Blender's startup.

| Engine | Size | Time (median of 3) |
|---|---|---|
| Workbench | 640×360 | 0.82 s |
| Workbench | 1280×720 | 0.85 s |
| Eevee, 4 samples | 640×360 | 1.01 s |

- **Startup:** about 0.48 s; importing 6 GLBs takes about 0.2 s.
- **Warm process:** a long-lived Blender would pay startup once. That gives an estimated 0.35 s per render, but this was not measured as a loop.
- **Cost:** assuming a 4 vCPU cloud machine at about $0.175 per hour (an assumption, not a quote), a render costs about $0.00004. That is a tiny fraction of one Neuron, so previews can be free.
- **Engine choice:** Workbench needs no GPU and is the safe choice on a Linux server. Eevee needs a GPU or a software OpenGL fallback, which was not tested.

## Library: licences and coverage
Surveyed 2026-11-08 from official pages only, and nothing downloaded. The sites state no pack sizes; the sizes below are estimates.

| Library | Licence (as stated) | Fits | Notes |
|---|---|---|---|
| Kenney (kenney.nl) | CC0, commercial use, credit optional | people (Mini Characters), cars (Car Kit), city (City Kit), nature (Mini Forest), shop props (Mini Shop) | flat colours, very low poly; the logo may not be used |
| KayKit (kaylousberg.com) | CC0 on Furniture Bits; other packs not checked | furniture, restaurant and tableware | glTF offered; chunkier style |
| Quaternius (quaternius.com) | **conflict:** pack pages say CC0; the licence page (v1.0) forbids redistributing the assets themselves | rigged people, cars, animals, furniture, food, 150 nature models | widest set; FBX/OBJ/Blend, so it needs a Blender export to GLB |
| Poly Haven | CC0, redistribution allowed | photoreal scanned objects | too heavy and too realistic for a lo-fi look |
| Poly Pizza | licence not stated on the site; mixes CC0 and CC-BY (needs credit) | 10,700+ models | avoid unless every model's licence is checked |

- **Iranian items:** no library has a Persian or Middle-Eastern pack. Persian rugs, samovars and similar items would need simple custom models later.
- **Size:** typical props are 5–100 KB and a rigged character 150–500 KB. The whole recommended set is estimated at 25–35 MB on the server; a scene loads only its own props.

## Architecture
1. **Library catalog** (`lib/asset-library.ts`). Each model has:
   - an id and kind;
   - Persian and Finglish labels and search tags;
   - a real-world height in metres;
   - its source and licence;
   - a GLB path and a thumbnail.

   A batch script, `scripts/library-build.py`, run in Blender, prepares every model:
   - imports it;
   - sets real scale, a ground-level origin and a forward axis;
   - applies one flat material style, so every pack looks consistent;
   - exports a meshopt-compressed GLB plus a thumbnail.

   Licences are recorded in `docs/evidence/3D_LIBRARY.md`.
2. **Pick and arrange.** The planner already lists the scene's props (`lib/staging.ts`). Each prop maps to the closest library model by kind and tags, never a generated mesh. The arrangement (positions, turns, scale) stays the planner's and «بوم»'s, as today.
3. **Browser frame (three.js).** The parked renderer (`components/scene-3d.tsx`, react-three-fiber; `FRAME_RENDERER`) comes back:
   - **Loading:** each prop loads lazily and is cached; GLBs use meshopt.
   - **Rendering:** the device pixel ratio is capped (≤ 2), shadows are simple, and frames render only on demand while nothing moves.
   - **Camera:** elevation, orbit and distance are continuous and eased by a damped spring toward the target, with no snapping to stops.
   - **Budget:** the first frame within about 1 s on a phone, about 60 fps while moving, and a typical scene under 1 MB of models.
4. **Light from the prompt.** The plan's lighting maps to a sun direction and height, a colour temperature, an intensity and an ambient level, through one function shared by three.js and Blender, so the preview and the render agree.
5. **Lo-fi render (server).** A warm Blender process receives the same scene description and returns a still in about 1 s. Each step fails closed: no render means no preview, and the job is never blocked.

## Phases (separate PRs)
1. **Library:** licences recorded, the build script, and the first packs converted; the catalog replaces the 8 current props.
2. **3D frame:** continuous, eased camera; on-demand rendering; performance measured on a phone.
3. **Light mapping:** the same rules in three.js and Blender.
4. **Lo-fi render endpoint:** a warm Blender process, the preview card, and a cost meter.

## Open decisions
- Which packs to download (needs the owner's approval: source, licence, size).
- Quaternius's licence conflict: use its CC0 pack pages, ask the author, or skip it.
- Whether lo-fi previews are free (their cost is far below one Neuron, and Neuron prices are whole numbers).
