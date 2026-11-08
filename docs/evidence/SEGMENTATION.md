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
  - In 4.3.2, `SamModel.forward` reads `input_points` even for a box-only prompt, which throws. A box is therefore always sent with its centre as a positive point; that gives the same cup mask (460–889 × 299–614).
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

## SAM 3.1: considered, not used

The owner has Hugging Face access for SAM 3.1 from qolage. qolage's own evaluation is in `~/Documents/qolage/docs/SAM31.md`.

- **Not on the phone:** the weights are 3.5 GB of PyTorch. qolage measured about 7 GB of memory on CPU, and SAM 3.1 was no better than SAM 2.1 overall on its clip.
- **The browser build is too large:** the only build found, `onnx-community/sam3-tracker-ONNX`, has a 296–935 MB encoder.
- **Licence:** the SAM License (last updated 2025-11-19), not Apache-2.0. Section 1(b)(v) requires that "You are not the target of Trade Controls". For a Persian-first service this needs legal review and written sign-off before any use (CLAUDE.md).
- **What it would take:** a server-side GPU deployment plus that legal sign-off.
