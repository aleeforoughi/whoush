# 3D models for «بوم» (public/visuals/3d)

The frame's 3D props (`lib/scene3d.ts` `MODELS_3D`) are built to match the 2D asset pack in `public/visuals`. They're measured from the PNGs, modelled in Spline, then fused, rigged and exported with Blender. The conventions every model follows are in the comment above `MODEL_3D_IDS`.

## Pipeline

1. **Measure the asset.**
   - `node scripts/models-3d/profile.mjs public/visuals/<id>.png [rows]` prints the silhouette per height. Shares are of the bbox height, centred on the bbox, and side views keep the asset's own facing (`NATIVE` in `components/staging-editor.tsx`).
   - `hair.mjs` prints where the grey hair is.
2. **Model in Spline**, with the Spline MCP (`run_code`).
   - Each part is a loft (`customMesh`) through cross-sections taken from those tables: a superellipse per height whose width comes from the front view and whose depth comes from the side view. Small parts are Spline primitives.
   - Every mesh is named `<model>:<part>:<material>`. Part names map to skeleton bones in `models.json`.
   - Materials are `clay`, `hair`, `glass`, `dark`, `tail`. `cut` marks a cutter (the building's window and door recesses).
   - The people are built in centimetres, the mountains in metres (`unit` in `models.json`).
3. **Export from Spline.**
   - Run `node scripts/models-3d/receiver.mjs .models-3d-work`.
   - Set `spline-exporter.html` as the file's HTML content and press play. Each model's world geometry is posted to `.models-3d-work/<model>.json` (git-ignored).
   - Spline renders Shape Blends on the GPU, so their surface can't be read back. The models use lofts instead.
4. **Mode A, continuous surfaces (the man).** No fuse step. The man is one torso loft from the crotch to the top of the neck (the pelvis, waist, chest, shoulders and neck in a single surface, with a straight soft hem). Each arm and leg is one loft along its own centreline, so the elbow and knee are concealed in a continuous surface. The hands are mitten lofts, and the feet are lofted heel to toe with a flat sole. The hair is a closed cap: an outer surface on the measured silhouette, an inner surface inside the head, and a rounded lip along a hairline drawn as one smooth swoop. The lofts are built at final resolution in Spline. Blender keeps them undecimated and joins the triangles back into quad rings (`quads` in `models.json`). The limbs meet the torso inside it (concealed articulation, Mode B), so the same surfaces take the skeleton: each part follows its bones, split at the joints by height.
5. **Fuse (the other models, for now):** `node scripts/models-3d/fuse.mjs <model> <voxel> <blend sigma> <shell thickness>`, in the model's units.
   - The closed parts of each material are unioned on a voxel grid and blended with a Gaussian, so the joins melt like pressed clay.
   - Open shells (hair, the car's window band, snow caps) are thickened inward, and cutters are subtracted.
   - The surface is extracted with surface nets and Taubin-smoothed. Each vertex keeps the part it grew from.
   - `models.json` `fuse` lists parts that fuse into their own surface (an arm meets the torso only at the shoulder, so lifting it doesn't drag the side).
   - The mountains skip this step and use the Spline surfaces directly.
6. **Build in Blender:**
   ```bash
   Blender -b --factory-startup --python scripts/models-3d/blender_build.py -- <model> .models-3d-work/<model>-fused.json public/visuals/3d/<model>.glb scripts/models-3d/blend/<model>.blend
   ```
   - Re-centres the model (y up, metres, front toward +z, standing on y = 0) and decimates it to the triangle budget in `models.json`.
   - Sets the matte materials.
   - For the people, adds an armature (hips, spine, chest, neck, head, left/right upper arm, lower arm, hand, upper leg, lower leg, foot). Weights follow each part's bone and blend across the joints. Bone heat was tried and leaked the arms into the torso.
   - Writes the GLB and a `.blend` source.
7. **Check.**
   - Renders and a sheet:
     ```bash
     Blender -b --factory-startup --python scripts/models-3d/render_views.py -- public/visuals/3d/<model>.glb scripts/models-3d/reports/<model> 0:front,40:3q,90:side,135:3q-back,180:back closeups
     node scripts/models-3d/sheet.mjs scripts/models-3d/reports/<model> <asset prefix>
     ```
   - `render_views.py` renders the five reference views at 1024 px, wireframe close-ups (neck, shoulder, hips, hairline, feet) and `topology.json` (per mesh: vertices, triangles, non-manifold edges, connected parts, skinning; the skeleton's bones).
   - `sheet.mjs` lays each asset view above the model's render at the same height (`sheet.jpg`).
   - The spikes at the loft poles in the wire close-ups come from Blender's wireframe modifier at those many-edged vertices, not from the mesh.
   - `node scripts/models-3d/compare.mjs <model>[-fused] <png>:<azimuth>[:<elevation>] … [--search] [--rows]` renders the model's silhouette orthographically from each asset's angle and prints IoU and the 90th-percentile contour distance (both ways) at 640 px.
   - Then look at the models in «بوم» (landscape scene, full-screen frame).
   - Bump the model's `version` in `MODELS_3D` when a GLB is replaced.

## Measured match (orthographic silhouettes, 640 px height)

The man: 21,046 polygons (mostly quads, about 40,000 triangles), 11 closed meshes with no non-manifold edges, 17 bones, GLB 1.1 MB (`reports/man/topology.json`, `reports/man/sheet.jpg`). The other models still come from the fused pipeline.


| Model | View | IoU | Contour p90 |
|---|---|---|---|
| man (Mode A) | front / 3/4 / side / rear 3/4 / back | 94.2 / 91.8 / 95.0 / 91.8 / 87.2% | 6.0 / 10.0 / 3.6 / 8.1 / 11.0 px |
| woman | front / 3/4 / side / rear 3/4 / back | 91.9 / 88.6 / 94.4 / 86.1 / 84.4% | 8.0 / 13.9 / 3.0 / 18.0 / 13.6 px |
| cat | front / 3/4 / side / back | 87.0 / 86.9 / 93.0 / 91.9% | 20 / 30 / 19 / 18 px |
| car | front / 3/4 / side / rear | 88.8 / 88.8 / 93.2 / 87.1% | 70 / 51 / 33 / 71 px |
| bottle | side | 98.6% | 2.8 px |
| tree | front | 96.7% | 7.2 px |
| building | 3/4 | 94.7% | 15 px |
| mountains | front | 97.9% | 7.1 px |

Known gaps:

- **Back views:** the pack's back views disagree with its own front views. The back figures are narrower, with shorter arms, so the people's back scores trade off against the front.
- **Car:** its windscreen is translucent in the PNGs, which leaves holes in their masks and inflates the car's contour error.
- **Detail:** the cat's tail and chest, and the hair's front wave, are simplified.
