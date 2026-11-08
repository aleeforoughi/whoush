# On-device segmentation: the magic wand and exact masks

**Status:** added 2026-11-08 at the owner's request. Owner decisions:
- "tap a mustache and it selects it, tap more to add; maximum detail";
- automatic marks must be accurate, not an oval that spills over;
- run it on the phone; downloads approved.

## What runs

| Item | Value |
|---|---|
| Library | `@huggingface/transformers` 4.3.2 (Apache-2.0), npm, exact version |
| Model | `Xenova/slimsam-77-uniform` (Apache-2.0) at revision `5850ab45f587c112167512ffef949107115e26a0` |
| Model files | `onnx/vision_encoder_quantized.onnx`, 8,882,165 B, sha256 `cce23c7b…2f971` |
| | `onnx/prompt_encoder_mask_decoder_quantized.onnx`, 4,903,810 B, sha256 `cb90b279…fdce2` |
| | `config.json`, `preprocessor_config.json` (hashes in `scripts/fetch-sam.mjs`) |
| Runtime | `onnxruntime-web` 1.31.0-dev.20260914-8d85527a0, from the installed package (`asyncify` and `jsep` WebAssembly variants) |
| Where | A module Web Worker (`lib/segment.worker.ts`). The photo never leaves the device. Nothing is fetched from Hugging Face or a CDN at runtime. |
| Serving | `public/models/`, filled by `npm run models` (pinned and checksummed). Git-ignored, so **every deploy must run it**. |

Sources:
- https://registry.npmjs.org/@huggingface/transformers/latest
- https://huggingface.co/Xenova/slimsam-77-uniform (model card, Apache-2.0; the file list is from `/api/models/Xenova/slimsam-77-uniform`)
- https://huggingface.co/docs/transformers.js/api/env (`allowRemoteModels`, `allowLocalModels`, `localModelPath`)

## Verified on 2026-11-08 (not inferred)

**Node script** against the same model files, on a generated 1264×848 cup photo:
- **Coordinates:** points and boxes are in the photo's own pixels. A tap on the cup at (686,453) returned the cup: bounding box 460–888 × 298–614, 8.7% of the frame.
- **Speed:** encoding the photo took 1.3 s; each mask after that took 66–82 ms.
- **Reuse:** `model.get_image_embeddings` once, then `image_processor.reshape_input_points` / `add_input_labels` with the cached sizes for each tap. The photo is not processed again.
- **Library behaviour:**
  - In 4.3.2, `SamModel.forward` reads `input_points` even for a box-only prompt, which throws.
  - **Corrected 2026-11-08:** this decoder file has four inputs and no box input; the browser logged "Too many inputs were provided (5 > 4). The following inputs will be ignored: input_boxes". Boxes were silently ignored, and only the box's centre point was used. A box is now sent as its two corners with SAM's box labels (2 top-left, 3 bottom-right). Node check on the 1264×848 portrait: the mouth box gave the mouth (0.4% of the frame, 579–702 × 433–485), not the skin around it. An answer with more than 25% outside the box (grown by 10%) is rejected and the soft oval is used.
  - A padding point (label −10) with a box gives a wrong whole-table mask, so it is not used.
- **Three masks per prompt:** a tap takes the smallest mask within 0.04 of the best IoU score (finest detail). A box takes the best score.

**Browser** (`whoush-inspect`, mobile size):
- **Ready time:** about 6 s from turning the wand on, including the first model load.
- **Tap:** one tap on the cup selected the whole cup, handle included, with no spill.
- **Whoush's marked area:** the oval became the exact cup outline.

## Fallbacks

- **The wand can't run on the device:** the wand says so and the brush still works.
- **Exact masks fail:** Whoush's areas keep the soft oval.

## Not verified yet

- On a real iPhone: speed, memory, and whether WebGPU or WASM is used.
- Fine detail such as a mustache or hair with the quantized model. Nothing documents its accuracy at that level; test on device.

## Face parts (added 2026-11-08)

The owner asked for this: "tap the skin selects the whole skin, tap the nose selects only the nose": eyes, nose, mouth, eyebrows, lips, hair, ears and neck. A tap on a face picks the named part. Anything else (a cup, a shirt, a necklace) goes to the general wand above. Code: `lib/face-parts.ts`.

| Item | Value |
|---|---|
| Library | `@mediapipe/tasks-vision` 1.2.2 (Apache-2.0, npm, exact version) |
| Face Landmarker | `face_landmarker.task`, float16 version 1: 3,758,596 B, sha256 `64184e22…0bc9ff`, 478 points per face |
| Segmenter | `selfie_multiclass_256x256.tflite`, float32 version 1: 16,371,837 B, sha256 `c6748b12…07e0e0` |
| Segmenter classes | 0 background, 1 hair, 2 body skin, 3 face skin, 4 clothes, 5 others |
| Serving | `public/models/mediapipe/` via `npm run models`, including the tasks-vision WebAssembly from the installed package |

**Licence and intended use** (read from Google's model cards, `storage.googleapis.com/mediapipe-assets/`):
- **Licence:** both cards say "LICENSED UNDER Apache License, Version 2.0" ("Model Card Multiclass Segmentation.pdf", 2023-05-10; "Model Card MediaPipe Face Mesh V2.pdf", 2022-09-15).
- **Out of scope:** life-critical decisions, surveillance and identification. Selecting part of a photo for an edit is none of these.

**Rejected:** `jonathandinu/face-parsing` (SegFormer, CelebAMask-HQ). Its card says "License: non-commercial research and educational purposes". It is also 89 MB quantized.

**How a tap is read**, in this order:
1. **From the landmark outlines:** inside the mouth, the lips (outer outline minus inner), either eye, either eyebrow, the nose (convex hull of the nose points).
2. **From the classes:** hair (all hair) and body skin (the connected skin under the tap: the neck).
3. **Face skin:** the face outline from the landmarks, minus hair, eyes, eyebrows and lips. Face skin outside the outline is an ear.
4. **Mask cleanup:** the class map is sampled bilinearly from the model's confidences, not its 256-pixel steps. Masks get dot-sized gaps filled only, so an eye's hole in the skin stays open.

**Verified in the browser** on a generated 1264×848 portrait. Each tap selected only that part: the nose; the face skin, with an exact jaw and without eyes, brows, lips or the fringe; the lips; one eye; all the hair; the neck down to the collar.

**Not verified:** ears (hair covered them on the test photo), several faces, profiles, and speed on an iPhone.

## Edits that change shape or colour (added 2026-11-08)

The owner asked for four edits to be tested live (dev, no charge): fuller lips, a new hairstyle and colour, eye colour and skin colour. Each test found a fault, which was fixed and run again.

| Edit | First result | Cause | Fix | Final result |
|---|---|---|---|---|
| Fuller lips | 387 pixels changed; the lips looked the same | The area was the exact lips, and the lock keeps everything outside it | The vision step marks `grow`; the area gets a rounded margin of about 40% of the lips' height, clear of the nose | Clearly fuller, natural lips with no seam |
| Long wavy chocolate hair | A second pair of eyebrows, the hair cut off by the box, a line across the neck | The model redrew the forehead; the room ended above the shoulders | The inner face (eyebrows to mouth, plus a margin) is kept; the hair's room runs from the box down to the bottom of the photo; strands along the hair's edge are included | Long hair resting on the shoulders, the face exactly the original |
| Emerald eyes | The hair was marked | A box around both eyes was not matched to a face part, and SAM ignored the box and used its centre | New `irises` part (an iris circle from the four iris landmarks, clipped to the eyelids); the vision step names the part; SAM gets box corners | Only the irises changed |
| Bronze skin | Only the face was marked | No part covered all skin | New `all skin` part: face, forehead above the face outline, ears, neck and body skin, without eyes, brows and lips | An even tan from forehead to chest, no line at the jaw |

Also found and fixed in testing:
- A new edit request typed while an earlier edit card waited was taken as that card's answer, so it got no edit card of its own.
- A wide edge fade for large areas left a grey ghost where old white hair met new brown hair. It was reverted; the fade stays narrow.
- The owner saw a rim of the old picture around a face and a cup. The lock faded in about 8 px inside the selection, so its edge kept the old colour. Now the whole selection is the model's, and a ring of about 0.5% of the longer side just outside it blends into the source. Re-locking the bronze-skin result removed the pale ring around the lips.
- The generation card forced the planned ratio (a 3:4 close-up) on a locked edit that comes back at the photo's 3:2, which stretched it. The planned ratio now only reserves space until the picture loads.

**Not verified:** colour-only hair changes (the edge strands), people with several faces, and all of this on an iPhone.

## SAM 3.1: considered, not used

The owner has Hugging Face access for SAM 3.1 from qolage. qolage's own evaluation is in `~/Documents/qolage/docs/SAM31.md`.

- **Not on the phone:** the weights are 3.5 GB of PyTorch. qolage measured about 7 GB of memory on CPU, and SAM 3.1 was no better than SAM 2.1 overall on its clip.
- **The browser build is too large:** the only build found, `onnx-community/sam3-tracker-ONNX`, has a 296–935 MB encoder.
- **Licence:** the SAM License (last updated 2025-11-19), not Apache-2.0. Section 1(b)(v) requires that "You are not the target of Trade Controls". For a Persian-first service this needs legal review and written sign-off before any use (CLAUDE.md).
- **What it would take:** a server-side GPU deployment plus that legal sign-off.
