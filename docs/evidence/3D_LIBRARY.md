# 3D library: sources and licences

Plan: docs/PLAN_B_3D.md. Downloaded 2026-11-08 at the owner's request. Only the free versions were downloaded; no paid tier.

The archives stay outside the repository. The repo only ever gets converted GLBs: one consistent style, real scale and compression, through the phase 1 build script.

| Pack | Source | File | Licence (from the licence file inside the archive) |
|---|---|---|---|
| Universal Animation Library (Standard, free) | https://quaternius.itch.io/universal-animation-library ("Name your own price", $0) | `Universal Animation Library[Standard].zip`, 15.9 MB: `UAL1_Standard.glb` / `_RM.glb` (7.6 MB, root motion on `_RM`) and the same as FBX (23.7 MB) | "CC0 1.0 Universal (CC0 1.0) Public Domain Dedication" |
| Ultimate Nature (150 models) | https://quaternius.itch.io/150-lowpoly-nature-models ("Name your own price", $0); also https://quaternius.com/packs/ultimatenature.html | `Ultimate Nature Pack by Quaternius.zip`, 22.9 MB: 150 models each as Blend, FBX and OBJ | "CC0 1.0 Universal (CC0 1.0) Public Domain Dedication" |
| Ultimate Home Interior (123 models) | https://quaternius.com/packs/ultimatehomeinterior.html, download from a public Google Drive folder | **Not downloaded:** Google Drive answered "Quota exceeded" to anonymous downloads (2026-11-08); the pack is not on itch.io | The pack page says CC0 |

- **Licence conflict:** Quaternius's general licence page (https://quaternius.com/license.html, "Quaternius Asset License v1.0") conflicts with the CC0 on the pack pages. The licence files inside both downloaded archives say CC0 1.0, so those two packs are CC0.
- **Not used:** the paid tiers (Universal Animation Library Pro $9.99 and Source $14.99, Patreon "Source" kits).

## models.codelove.in: considered 2026-11-08, not used as a source

Owner asked to check https://models.codelove.in/. It's a free re-host: 6,792 GLB models in 91 collections, a public `catalog.json` and three.js snippets. There's no Blender add-on or API beyond the JSON.

- **Licence labels can't be relied on:**
  - The «God of War» collection is labelled CC0/MIT. It holds 14 models of Sony's game assets (Kratos in several versions, Blades of Chaos, Leviathan Axe, Mjölnir), with no author or source in its credits.
  - The site's own terms give no warranty. They say a licence "does not give you trademark or other rights in what the model shows".
- **No provenance:** `catalog.json` has no author or source field per model. The licence page names a source only for the hairstyles (Sketchfab artists).
- **Where the useful part comes from:** most collections carry Kenney's pack names (Car Kit, Furniture Kit, Food Kit, Nature Kit, City Kit, Space Kit…). The space objects look like NASA public-domain models.
- **Decision:** don't take files from this site. Take the same models from the originals, where the licence is stated by the author:
  - Kenney (https://kenney.nl/support): "all game assets on the asset pages are public domain licensed (CC0)… free to use them, even in commercial projects… Attribution is not required". Don't use the Kenney logo.
  - NASA 3D Resources (public domain). Don't use NASA insignia to imply endorsement.
- **Gap this could fill:** Kenney's Furniture Kit (CC0, about 140 models) covers interiors, which Quaternius Home Interior couldn't (Google Drive quota).
