# Higgsfield models: the full API catalogue and the MCP catalogue

**Retrieved 2026-11-05 by the lead.** This is evidence for `docs/HIGGSFIELD_EVIDENCE.md`, not an integration. A model is usable by Whoush only when it is added to `lib/catalog.ts` with a verified path, an input schema read from its page, an approved integer Neuron SKU, and the launch gates (`docs/LAUNCH_GATES.md`).

## Sources and how they were checked

- **Public API catalogue** (`https://docs.higgsfield.ai/docs/models.md`): 84 entries in total, 17 image and 67 video.
  - Family lists: `models/image-generation.md` has 14 families and `models/video-generation.md` has 22.
  - All 36 family pages and all **84** per-workflow pages were downloaded raw (`curl`, HTTP 200). The count matches the catalogue exactly.
- **What was verified byte-exact against the raw page text:** every workflow's API path, which pages state a price, whether any page has a mask, depth, pose or control input, which image workflows take a seed, and the image-edit input fields.
- **Field lists** (enums, ranges, defaults) were extracted by three readers using a summarizing fetch. Re-read the raw page before coding against any of them.
- **Higgsfield MCP catalogue** (`models_explore list`, the account's agent connector): 136 models, made up of 50 image, 58 video, 10 audio and 18 3D.
  - These are the connector's model ids, **not API paths**. The MCP is an agent tool for the signed-in account, not a documented service for Whoush's server.
- **The open playground** (`https://open.higgsfield.ai/`, which `console.higgsfield.ai` redirects to) shows 28 entries.
  - Some are not in the docs: Kling 4.0, Kling 4.0 Flash, Genjutsu Light, AI Influencer, and the Product shots, Graphic ads and Marketplace design workflows.
  - A playground entry without a docs page is **not verified** for the API.

### Common to every API workflow (raw pages)
- **Request:** `POST https://api.higgsfield.ai<path>`, JSON body.
- **Headers:** `Authorization: Key <id>:<secret>`, `Content-Type: application/json`, `Idempotency-Key`.
- **Submit response:** `status:"queued"`, `request_id`, `status_url`, `cancel_url`.
- **Result:** `images[].url` for images, `video.url` for video.
- **Media:** passed as public URLs. No upload id field appears on these pages.

## What this means for Whoush

1. **Seedream, Nano Banana, Flux Kontext and 3D Jutsu Angles are not in the public API.** These are the models that followed the canvas best in the 2026-11-05 tests (`docs/HIGGSFIELD_EVIDENCE.md#model-fit-2026-11-05`). They exist only in the MCP catalogue, so Whoush cannot integrate them without Higgsfield exposing them in the API, or a written agreement.
2. **Image editing exists in the API.** These workflows take a source photo by URL:
   - Qwen Image 3 Edit (`/alibaba/qwen-image-3/edit`, 1–3 `image_urls`, with a seed)
   - Grok Image 2.0 (`/xai/grok-imagine-image-2.0`, up to 10 `image_urls`)
   - Marketing Studio Image 2.0, Flare and Sunburst (`image_urls`, up to 16)
   - Ideogram 4.0 (`image_url` plus `image_weight` 1–100, which sets how closely the output keeps the input)

   All of them are unverified for Whoush until they are tested and priced. They also need hosted user media, an open launch gate.
3. **No API workflow accepts a mask, depth map, pose map or any spatial control input** (checked on the raw pages). A canvas composition guide could only be sent as an ordinary reference image, to a workflow that accepts references. That is the specialist's "semantic visual reference" level, and its effect must be tested.
4. **Camera controls as parameters exist only on video workflows:**
   - LTX 2.5: `camera_movement`
   - Cinema Studio 4.0: `camera_model`, `camera_lens`, `camera_aperture`, `camera_movement` and `light` presets

   The MCP's Cinematic Studio Image (camera body, lens, focal length and aperture ids) has **no API page**.
5. **Seeds:** among image workflows, only Soul, Soul 2, Soul Cinema, Qwen Image 3 (both workflows) and Z-Image Turbo document a `seed`.
6. **Prices are almost never published.** Only Ads Studio ("approximately $0.084 per image", usage-based) and Genjutsu Restyle (approximate per source-second figures) state one. Every other SKU needs a price from the provider before it can get a Neuron price.
7. **Prompt rewriting:** some workflows enhance prompts by default, and the default matters for a compiled prompt.
   - Rewrite on by default: Qwen Image 3 (`prompt_extend` and `enable_thinking` both true), Hailuo 2.3 (`prompt_optimizer` true).
   - Rewrite off by default: Soul, Soul 2 and Soul Cinema (`enhance_prompt` false, though short prompts may still be enhanced; Soul Cinema also enables it whenever `custom_reference_id` is given), Z-Image Turbo (`prompt_extend` false).
   - Whoush must set these explicitly and record that the effective prompt may differ.

## Public API: all 84 workflows

**Path** is verified byte-exact against the raw page. **Inputs** and **Options** were extracted (see above). Docs URL: `https://docs.higgsfield.ai/docs/models/<family>/<workflow>.md`.

### Image (14 families, 17 workflows)

| Family | Workflow | Path | Inputs | Options |
|---|---|---|---|---|
| Soul | generate | `/higgsfield-ai/soul/standard` | `image_reference_url` (guides prompt enhancement only), `custom_reference_id` | 7 ratios; 720p/1080p; seed 1–1000000; batch 1/4; `style_id`; `enhance_prompt` |
| Soul 2 | generate | `/higgsfield-ai/soul/v2/standard` | `custom_reference_id` | 7 ratios; 720p/1080p; seed; batch 1/4; `style_id` (no effect) |
| Soul Cinema | generate | `/higgsfield-ai/soul/cinema` | `custom_reference_id` | 7 ratios; 720p/1080p; seed; batch 1/4; fixed style |
| Soul ID | create character | `/v1/custom-references` | 1–100 training `image_url`s | trains a character for Soul (`model_version` v1/v2/cinema) |
| Marketing Studio Image | 2.0 Alpha (generate and edit) | `/marketing-studio/image` | `image_urls` 0–16 (1–2 with `enhance_prompt`) | auto plus 8 ratios; 1k/2k/4k; `quality`; `preset_id`; `moderation` |
| Marketing Studio Image | 2.5 Flare | `/marketing-studio/image/flare` | as above | as above; `quality` up to `max` |
| Marketing Studio Image | 2.5 Sunburst | `/marketing-studio/image/sunburst` | as above | as above |
| Ads Studio | generate ads | `/higgsfield/ads-studio/v1.0` | `image_urls` up to 10 | 14 ratios; fixed 2k; batch 1–8; ≈ $0.084 per image (stated) |
| Grok Image 2.0 | generate and edit | `/xai/grok-imagine-image-2.0` | `image_urls` 0–10 (edit) | auto plus 9 ratios; 1k/2k; `quality` low/medium |
| Recraft V4.1 | text to image | `/recraft/v4.1/text-to-image` | none | 14 ratios; 1k; `colors`; `background_color`; jpg/png/webp |
| Recraft V4.1 Pro | text to image | `/recraft/v4.1/pro/text-to-image` | none | as above; 2k |
| Recraft V4.1 Utility | text to image | `/recraft/v4.1/utility/text-to-image` | none | as V4.1 |
| Recraft V4.1 Utility Pro | text to image | `/recraft/v4.1/utility/pro/text-to-image` | none | as Pro |
| Qwen Image 3 | text to image | `/alibaba/qwen-image-3/text-to-image` | none | 10 ratios; 1k/2k; seed; `negative_prompt`; `prompt_extend` (default on) |
| Qwen Image 3 | edit | `/alibaba/qwen-image-3/edit` | `image_urls` 1–3 (required) | 10 ratios; 1k/2k; seed; `negative_prompt`; `prompt_extend` (default on) |
| Ideogram 4.0 | generate | `/ideogram/v4.0` | `image_url` (remix or edit) plus `image_weight` 1–100 | 23 ratios; `rendering_speed` |
| Z-Image Turbo | generate | `/z-image/turbo` | none | 10 ratios; 1k/2k; seed; `prompt_extend` (default off) |

### Video (22 families, 67 workflows)

| Family | Workflow | Path | Inputs | Options |
|---|---|---|---|---|
| Genjutsu | motion transfer | `/higgsfield/genjutsu/motion-transfer/v1.0` | `video_url`, `image_urls` 1–8 | 480p/720p/1080p; length follows the source (4–30 s) |
| Genjutsu | object swap | `/higgsfield/genjutsu/object-swap/v1.0` | `video_url`, `image_urls` 1–8 | as above |
| Genjutsu | restyle | `/higgsfield/genjutsu/restyle/v1.0` | `video_url`, `image_urls` 0–5, `preset_id` | as above; approx. $0.318, $0.681 and $1.632 per source second at 480p, 720p and 1080p (stated) |
| Seedance 2.0 | text to video | `/bytedance/seedance-2.0/text-to-video` | none | 4–15 s; 480p–4k; 6 ratios; `generate_audio` |
| Seedance 2.0 | image to video | `/bytedance/seedance-2.0/image-to-video` | `image_url`, `end_image_url` | 4–15 s; 480p–4k; audio |
| Seedance 2.0 | reference to video | `/bytedance/seedance-2.0/reference-to-video` | images 1–9, videos 1–3, audio 1–3 | 4–15 s; 480p–4k; 6 ratios |
| Seedance 2.5 | text to video | `/bytedance/seedance-2.5/text-to-video` | none | 4–30 s; 480p–1080p; 6 ratios; audio |
| Seedance 2.5 | image to video | `/bytedance/seedance-2.5/image-to-video` | `image_url`, `end_image_url` | 4–30 s; audio |
| Seedance 2.5 | reference to video | `/bytedance/seedance-2.5/reference-to-video` | images 1–30, videos 1–10, audio 1–10 (50 total) | 4–30 s |
| Seedance 2.5 | video edit | `/bytedance/seedance-2.5/video-edit` | `video_url` plus references | length follows the source |
| Seedance 2.5 | video extend | `/bytedance/seedance-2.5/video-extend` | `video_url` plus references | 4–30 s |
| Kling 2.5 Turbo | pro text to video | `/kling-video/v2.5-turbo/pro/text-to-video` | none | 5/10 s; `cfg_scale`; `negative_prompt` |
| Kling 2.5 Turbo | pro image to video | `/kling-video/v2.5-turbo/pro/image-to-video` | `image_url` | 5/10 s |
| Kling 2.5 Turbo | standard image to video | `/kling-video/v2.5-turbo/standard/image-to-video` | `image_url` | 5/10 s |
| Kling 2.6 | pro text to video | `/kling-video/v2.6/pro/text-to-video` | none | 5/10 s; 3 ratios; `sound` |
| Kling 2.6 | pro image to video | `/kling-video/v2.6/pro/image-to-video` | `image_url` | 5/10 s; `sound` |
| Kling 2.6 Motion Control | pro | `/kling-video/motion-control/pro` | `image_url` (character), `video_url` (motion) | `character_orientation`; `keep_original_sound` |
| Kling 2.6 Motion Control | std | `/kling-video/motion-control/std` | as above | as above |
| Kling 3.0 | 4K text to video | `/kling-video/v3.0/4k/text-to-video` | `elements` | 3–15 s; 3 ratios; `sound`; multi-shot (up to 6) |
| Kling 3.0 | pro text to video | `/kling-video/v3.0/pro/text-to-video` | `elements` | as above |
| Kling 3.0 | std text to video | `/kling-video/v3.0/std/text-to-video` | `elements` | as above |
| Kling 3.0 | turbo text to video | `/kling-video/v3.0-turbo/text-to-video` | none | 3–15 s; 720p/1080p; 3 ratios |
| Kling 3.0 | 4K image to video | `/kling-video/v3.0/4k/image-to-video` | `image_url`, `last_image_url` | 3–15 s; `sound`; multi-shot |
| Kling 3.0 | pro image to video | `/kling-video/v3.0/pro/image-to-video` | as above | as above |
| Kling 3.0 | std image to video | `/kling-video/v3.0/std/image-to-video` | as above | as above |
| Kling 3.0 | turbo image to video | `/kling-video/v3.0-turbo/image-to-video` | `image_url` | 3–15 s; 720p/1080p |
| Kling 3.0 Motion Control | pro | `/kling-video/v3/motion-control/pro` | `image_url`, `video_url` | as Kling 2.6 Motion Control |
| Kling 3.0 Motion Control | std | `/kling-video/v3/motion-control/std` | as above | as above |
| Kling O3 | first and last frame | `/kling-video/o3/first-last-frame` | `first_frame_url`, `last_frame_url` | 3–15 s; mode std/pro/4k; `sound`; multi-shot |
| Kling O3 | image reference | `/kling-video/o3/image-reference` | `image_urls`, `elements`, first and last frames | 3–15 s; std/pro/4k; `shot_type` |
| Kling O3 | video edit | `/kling-video/o3/video-edit` | `video_urls` (1), `image_urls` 0–4 | std/pro/4k; length follows the source |
| Kling O3 | video reference | `/kling-video/o3/video-reference` | `video_urls` (1), `image_urls` 0–4 | 3–10 s; std/pro |
| Kling Omni | first and last frame | `/kling-video/omni/first-last-frame` | first and last frame | 5/10 s; std/pro |
| Kling Omni | image reference | `/kling-video/omni/image-reference` | `image_urls`, `elements` | 3–10 s |
| Kling Omni | video edit | `/kling-video/omni/video-edit` | `video_urls` (1), `image_urls` 0–4 | length follows the source |
| Kling Omni | video reference | `/kling-video/omni/video-reference` | `video_urls` (1), `image_urls` 0–4 | 3–10 s |
| Happy Horse 1.0 | text to video | `/alibaba/happy-horse/text-to-video` | none | 3–15 s; 720p/1080p; 5 ratios; seed |
| Happy Horse 1.0 | image to video | `/alibaba/happy-horse/image-to-video` | `image_url` (first frame) | 2–15 s; seed |
| Happy Horse 1.0 | reference to video | `/alibaba/happy-horse/reference-to-video` | `image_urls` 1–9 | 2–15 s; seed |
| Happy Horse 1.1 | text to video | `/alibaba/happy-horse/v1.1/text-to-video` | none | 3–15 s; 720p/1080p; 5 ratios; seed |
| Happy Horse 1.1 | image to video | `/alibaba/happy-horse/v1.1/image-to-video` | `image_url` (first frame) | 2–15 s; seed |
| Happy Horse 1.1 | reference to video | `/alibaba/happy-horse/v1.1/reference-to-video` | `image_urls` 1–9 | 2–15 s; seed |
| Wan 3.0 | text to video | `/alibaba/wan-3.0/text-to-video` | none | 2–30 s; 480p–1080p; 5 ratios plus adaptive; audio; `enable_thinking`; seed |
| Wan 3.0 | image to video | `/alibaba/wan-3.0/image-to-video` | `image_url`, `end_image_url` | as above |
| Wan 3.0 | reference to video | `/alibaba/wan-3.0/reference-to-video` | images ≤10, videos ≤5, audio ≤5, `file_url`, `link_url` | as above |
| Wan 3.0 Prime | text to video | `/alibaba/wan-3.0-prime/text-to-video` | none | as Wan 3.0 |
| Wan 3.0 Prime | image to video | `/alibaba/wan-3.0-prime/image-to-video` | first and last frame | as Wan 3.0 |
| Wan 3.0 Prime | reference to video | `/alibaba/wan-3.0-prime/reference-to-video` | as Wan 3.0 | as Wan 3.0 |
| Cinema Studio 4.0 | generate | `/higgsfield/cinema-studio/4.0` | images ≤30, videos ≤10, audio ≤10 (50 total) | 4–30 s; 480p/720p; 6 ratios; presets for `camera_model`, `camera_lens`, `camera_aperture`, `camera_movement`, `light`, `genre`, `era`, `pacing`, `color_palette` |
| LTX 2.5 | text to video fast | `/lightricks/ltx-2.5/text-to-video/fast` | none | 6/8/10 s; 720p–4k; 16:9 or 9:16; fps 24/25/48/50; `camera_movement` |
| LTX 2.5 | text to video pro | `/lightricks/ltx-2.5/text-to-video/pro` | none | 720p/1080p; fps 24/25/50; `camera_movement` |
| LTX 2.5 | image to video fast | `/lightricks/ltx-2.5/image-to-video/fast` | `image_url`, `end_image_url` | as fast text to video |
| LTX 2.5 | image to video pro | `/lightricks/ltx-2.5/image-to-video/pro` | `image_url`, `end_image_url` | as pro text to video |
| MiniMax H3 | text to video | `/minimax/h3/text-to-video` | none | 5–15 s; 2K; 8 ratios; `aigc_watermark` |
| MiniMax H3 | image to video | `/minimax/h3/image-to-video` | `image_url`, `end_image_url` | as above |
| MiniMax H3 | reference to video | `/minimax/h3/reference-to-video` | images 1–9, videos 1–3, audio 0–3 | as above |
| Hailuo 2.3 | standard text to video | `/minimax/hailuo-2.3/standard/text-to-video` | none | 6/10 s; fixed 768P; `prompt_optimizer` (default on) |
| Hailuo 2.3 | standard image to video | `/minimax/hailuo-2.3/standard/image-to-video` | `image_url` | as above |
| PixVerse V6 | text to video | `/pixverse/v6/text-to-video` | none | 1–15 s; 360p–1080p; 5 ratios; audio; seed; `negative_prompt` |
| PixVerse V6 | image to video | `/pixverse/v6/image-to-video` | `image_url`, `end_image_url` | as above, without ratios |
| Wan 2.6 | text to video | `/wan/v2.6/text-to-video` | `audio_url` | 5/10/15 s; 720p/1080p; multi-shot; `prompt_extend` |
| Wan 2.6 | image to video | `/wan/v2.6/image-to-video` | `image_url`, `audio_url` | 5/10/15 s; 480p–1080p |
| Wan 2.6 | reference to video | `/wan/v2.6/reference-to-video` | `video_urls` 1–3 | 5/10 s; 5 ratios |
| Wan 2.7 | text to video | `/wan/v2.7/text-to-video` | `audio_url` | 2–15 s; 720p/1080p; 5 ratios (schema titled "Wan 2.6": verify) |
| Wan 2.7 | image to video | `/wan/v2.7/image-to-video` | `image_url`, `end_image_url`, `audio_url` | 2–15 s (same caveat) |
| Wan 2.7 | reference to video | `/wan/v2.7/reference-to-video` | images and videos, 5 combined | 2–10 s; 16:9 or 9:16 |
| Grok Imagine Video 1.5 | reference to video | `/xai/grok-imagine-video/v1.5/reference-to-video` | `image_url` (first frame) or `image_urls` ≤7, `audio_url` | 1–15 s; 480p–1080p (720p maximum with references); 8 ratios |

**Count check:**
- Image: 1+1+1+1+3+1+1+4+2+1+1 = 17.
- Video: the family pages list 3+3+5+3+2+2+8+2+4+4+3+3+3+3+1+4+3+2+2+3+3+1 = 67.
- Total: 84, matching the catalogue.

## Higgsfield MCP catalogue: all 136 models (connector ids, not API paths)

**Which tested models have an API page:**
- Seedream (`seedream_v4_5`, `seedream_v5_lite`, `seedream_5_0_flash`, `seedream_v5_pro`): **no**.
- Nano Banana (`nano_banana`, `nano_banana_pro`, `nano_banana_2`, `nano_banana_2_1`, `nano_banana_2_lite`, `nano_banana_2_shots`): **no**.
- FLUX (`flux_2`, `flux_3_image`, `flux_kontext` and others): **no**.
- `3d_jutsu_angles`, GPT Image, Veo, Gemini Omni, Cinematic Studio Image: **no**.
- **Present in both** (versions can differ, and MCP ids are not API paths):
  - Higgsfield: Soul 2 and Soul Cinema, Genjutsu, Marketing Studio, Cinema Studio 4.0
  - ByteDance: Seedance 2.0 and 2.5
  - Kling: 2.6, 3.0, O3
  - Alibaba and MiniMax: Wan 2.6, 2.7, 3.0 and 3.0 Prime; Happy Horse; MiniMax H3; Hailuo
  - Others: Grok, Recraft V4.1, Z-Image
- **Ideogram differs by version:** 4.0 in the API, 4.5 and Vector in the MCP.
- **In neither:** Soul Standard has an API page, but no plain `soul_standard` id appears in the MCP list. LTX 2.5, PixVerse V6 and the Qwen image models are API only.

**Parameters that matter for the canvas** (MCP only):
- `nano_banana_2` and `nano_banana_2_1`: a `mask` role plus `is_inpaint` (an edit limited to the mask); `nano_banana_2_1` also takes a `seed`.
- `seedream_v5_pro` and `3d_jutsu_angles`: `image_references`, `is_inpaint`, `remove_bg`. The connector describes `3d_jutsu_angles` as powered by Seedream 5.0 Pro.
- `cinematic_studio_image`: required `camera_model_id`, `camera_lens_id` and `camera_focal_length_id`, plus an optional `camera_aperture_id`.

| MCP id | Name | Output | Media roles | Parameters | Aspect ratios |
|---|---|---|---|---|---|
| `soul_2` | Higgsfield Soul 2.0 | image | image | quality, style_id, soul_id | 1:1 16:9 9:16 4:3 3:4 3:2 2:3 |
| `soul_cinematic` | Soul Cinema | image | image | quality, soul_id | 1:1 4:3 3:4 16:9 9:16 3:2 2:3 21:9 |
| `gpt_image_2` | GPT Image 2 | image | image | resolution, quality | 1:1 4:3 3:4 16:9 21:9 9:16 3:2 2:3 |
| `cinematic_studio_2_5` | Cinema Studio Image 2.5 | image | image | resolution | 1:1 3:2 2:3 4:3 3:4 4:5 5:4 16:9 9:16 21:9 |
| `marketing_studio_image` | Marketing Studio Image | image | image | resolution | auto 1:1 3:2 2:3 4:3 3:4 4:5 5:4 9:16 16:9 21:9 |
| `ms_image` | DTC Ads | image | image | style_id, brand_kit_id, resolution, quality, batch_size, product_ids, folder_id | 1:1 3:2 2:3 16:9 9:16 4:3 3:4 21:9 27:16 16:27 9:8 8:9 4:9 9:4 auto |
| `image_auto` | Auto | image | image |  | 1:1 4:3 3:4 16:9 9:16 |
| `autosprite` | AutoSprite Animation | image | image | kind, name, video_tier, frame_count, frame_size, remove_bg, with_sound, is_humanoid |  |
| `soul_cast` | Soul Cast | image |  | budget | 16:9 |
| `soul_location` | Soul Location | image |  |  | 1:1 4:3 3:4 16:9 9:16 3:2 2:3 21:9 9:21 |
| `cinematic_studio_3_0` | Cinema Studio Video 3.0 | video | end_image, image, start_image | resolution, genre, generate_audio | auto 21:9 16:9 4:3 1:1 3:4 9:16 |
| `cinematic_studio_video` | Cinema Studio Video | video | end_image, image, start_image | slow_motion, sound | 1:1 4:3 3:4 16:9 9:16 |
| `cinematic_studio_video_v2` | Cinema Studio Video | video | end_image, image, start_image | genre, mode, sound, speedramp, multi_shots, multi_shot_mode, cfg_scale, preset_id | 1:1 4:3 3:4 16:9 9:16 |
| `marketing_studio_video` | Marketing Studio | video | end_image, image, start_image | resolution, generate_audio, mode, folder_id, width, height, avatar_ids, product_ids, assets, hook_id, setting_id, ad_reference_id | auto 21:9 16:9 4:3 1:1 3:4 9:16 |
| `higgsfield_preset` | Higgsfield Preset | video | image | folder_id, preset_id | 16:9 9:16 1:1 |
| `sam_3_3d` | SAM 3 3D Objects | 3d | image | detection_threshold, export_textured_glb, seed |  |
| `image_to_3d` | Image to 3D | 3d | image | should_texture, enable_rigging, enable_animation, should_remesh, texture_prompt, texture_image_url, target_polycount, topology, symmetry_mode, enable_pbr, pose_mode, rigging_height_meters, animation_action_id, enable_safety_checker, seed |  |
| `multi_image_to_3d` | Multi-Image to 3D | 3d | image | should_texture, enable_rigging, enable_animation, should_remesh, texture_prompt, texture_image_url, target_polycount, topology, symmetry_mode, enable_pbr, pose_mode, rigging_height_meters, animation_action_id, enable_safety_checker, seed |  |
| `3d_rigging` | 3D Rigging | 3d |  | model_url, height_meters, enable_animation, animation_action_id, enable_safety_checker |  |
| `soul_v2` | Higgsfield Soul 2.0 | image | image | quality, style_id, soul_id | 1:1 16:9 9:16 4:3 3:4 3:2 2:3 |
| `meshy_image_to_3d` | Image to 3D | 3d | image | should_texture, enable_rigging, enable_animation, should_remesh, texture_prompt, texture_image_url, target_polycount, topology, symmetry_mode, enable_pbr, pose_mode, rigging_height_meters, animation_action_id, enable_safety_checker, seed |  |
| `meshy_multi_image_to_3d` | Multi-Image to 3D | 3d | image | should_texture, enable_rigging, enable_animation, should_remesh, texture_prompt, texture_image_url, target_polycount, topology, symmetry_mode, enable_pbr, pose_mode, rigging_height_meters, animation_action_id, enable_safety_checker, seed |  |
| `meshy_rigging` | 3D Rigging | 3d |  | model_url, height_meters, enable_animation, animation_action_id, enable_safety_checker |  |
| `z_image` | Z Image | image |  |  | 1:1 4:3 3:4 16:9 9:16 |
| `nano_banana` | Nano Banana | image | image_references |  | 1:1 3:2 2:3 4:3 3:4 4:5 5:4 9:16 16:9 21:9 |
| `nano_banana_pro` | Nano Banana Pro | image | image_references | resolution | 1:1 3:2 2:3 4:3 3:4 4:5 5:4 9:16 16:9 21:9 |
| `nano_banana_2_shots` | Nano Banana Pro | image | image_references |  | auto 1:1 3:2 2:3 4:3 3:4 4:5 5:4 9:16 16:9 21:9 |
| `nano_banana_2` | Nano Banana 2 | image | image_references, mask | resolution, is_inpaint | auto 1:1 3:2 2:3 4:3 3:4 4:5 5:4 9:16 16:9 21:9 |
| `nano_banana_2_1` | Nano Banana 2.1 | image | image_references, mask, video_references | resolution, is_inpaint, thinking_level, enable_web_search, enable_image_search, seed | auto 1:1 3:2 2:3 4:3 3:4 4:5 5:4 9:16 16:9 21:9 4:1 1:4 8:1 1:8 |
| `nano_banana_2_lite` | Nano Banana 2 Lite | image | image_references, mask | resolution, thinking, is_inpaint | auto 1:1 3:2 2:3 4:3 3:4 4:5 5:4 9:16 16:9 21:9 |
| `seedream_v4_5` | Seedream 4.5 | image | image_references | quality | 1:1 4:3 16:9 3:2 21:9 3:4 9:16 2:3 |
| `flux_2` | FLUX.2 | image | image_references | resolution, variant | 1:1 4:3 3:4 16:9 9:16 |
| `flux_2_pro_outpaint` | FLUX.2 Pro Outpaint | image | image_references | expand_top, expand_bottom, expand_left, expand_right, folder_id |  |
| `flux_3_image` | FLUX 3 Image | image | image_references | resolution, batch_size, folder_id | auto 21:9 2:1 16:9 3:2 7:5 4:3 5:4 1:1 4:5 3:4 5:7 2:3 9:16 1:2 |
| `flux_3_video` | FLUX 3 Video | video | end_image, image_references, start_image, video_references | duration, resolution, generate_audio | auto 21:9 2:1 16:9 4:3 1:1 3:4 9:16 |
| `flux_3_video_edit` | FLUX 3 Video Edit | video | video_references | folder_id |  |
| `flux_kontext` | Flux Kontext | image | image_references |  | 1:1 4:3 3:4 16:9 9:16 |
| `kling_omni_image` | Kling O1 Image | image | image_references | resolution | 1:1 auto 16:9 9:16 4:3 3:4 3:2 2:3 21:9 |
| `openai_hazel` | OpenAI Hazel | image | image_references | quality | 1:1 3:2 2:3 auto |
| `gpt_image_2_5` | GPT Image 2.5 | image | image_references | variant, quality, resolution, background | auto 1:1 3:2 2:3 4:3 3:4 16:9 9:16 21:9 27:16 16:27 9:8 8:9 4:5 5:4 |
| `gpt_image_2_6` | GPT Image 2.6 | image | image_references | quality, resolution, background, batch_size, output_format, size, frame_count, frame_duration_ms | auto 1:1 3:2 2:3 4:3 3:4 16:9 9:16 21:9 27:16 16:27 9:8 8:9 4:5 5:4 |
| `gpt_image_2_6_flare` | GPT Image 2.6 Flare | image | image_references | quality, resolution, background, batch_size, output_format, size, frame_count, frame_duration_ms | auto 1:1 3:2 2:3 4:3 3:4 16:9 9:16 21:9 27:16 16:27 9:8 8:9 4:5 5:4 |
| `soul_cinema_studio` | soul_cinema_studio | image | image_references | quality, style_id, custom_reference_id, enhance_prompt | 1:1 16:9 9:16 4:3 3:4 3:2 2:3 21:9 |
| `seedream_v5_lite` | Seedream 5.0 Lite | image | image_references | quality | 1:1 4:3 3:4 16:9 9:16 21:9 |
| `seedream_5_0_flash` | Seedream 5.0 Flash | image | image_references | resolution, width, height | auto 1:1 4:3 3:4 16:9 9:16 3:2 2:3 21:9 |
| `seedream_v5_pro` | Seedream 5.0 Pro | image | image_references | resolution, width, height, remove_bg, is_inpaint | 1:1 4:3 3:4 16:9 9:16 3:2 2:3 21:9 |
| `3d_jutsu_angles` | 3D Jutsu Angles | image | image_references | resolution, width, height, remove_bg, is_inpaint | 1:1 4:3 3:4 16:9 9:16 3:2 2:3 21:9 |
| `grok_image` | Grok Image | image | image_references | resolution, mode | 1:1 auto 1:2 2:1 3:2 2:3 4:3 3:4 16:9 9:16 |
| `grok_image_2_0` | Grok Image 2.0 | image | image_references | resolution, quality | 1:1 auto 1:2 2:1 3:2 2:3 4:3 3:4 16:9 9:16 |
| `ideogram_4_5` | Ideogram 4.5 | image | image_references, mask | resolution, quality, magic_prompt, seed, batch_size | auto 1:1 1:2 2:1 2:3 3:2 4:5 5:4 9:16 16:9 5:8 8:5 3:4 4:3 9:22 22:9 9:23 23:9 3:8 8:3 5:12 12:5 1:3 3:1 |
| `ideogram_vector` | Ideogram Vector | image | image_references | operation, quality, seed, mode, batch_size | auto 1:1 1:4 1:3 1:2 9:16 10:16 2:3 3:4 4:5 5:4 4:3 3:2 16:10 16:9 2:1 3:1 4:1 |
| `grok_video_v15` | Grok Video 1.5 | video | audio_references, image_references, start_image | resolution, duration |  |
| `grok_video_v15_lite` | Grok Imagine Video 1.5 Lite | video | start_image | resolution, duration | auto 16:9 9:16 4:3 3:4 1:1 3:2 2:3 |
| `recraft_v4_1` | Recraft V4.1 | image |  | resolution, model_type, colors, background_color | 1:1 3:4 4:3 4:5 5:4 3:2 2:3 16:9 9:16 |
| `recraft_v4_styles` | Recraft V4 Styles | image |  | style_id, resolution, style_match | 1:1 2:1 1:2 3:2 2:3 4:3 3:4 5:4 4:5 6:10 14:10 10:14 16:9 9:16 |
| `seed_audio` | Seed Audio 1.0 | audio | audio_references, image_references | format, sample_rate, speech_rate, loudness_rate, pitch_rate, voice_type, voice_id |  |
| `qwen_audio_tts` | Qwen Audio 3.0 TTS Flash | audio |  | voice_type, voice_id, instruction, language, format, sample_rate, volume, speech_rate, pitch_rate, seed, batch_size |  |
| `elevenlabs_v4` | Eleven v4 | audio |  | dialogue, stability, similarity_boost, batch_size |  |
| `elevenlabs_v4_turbo` | Eleven v4 Turbo | audio |  | dialogue, stability, similarity_boost, batch_size |  |
| `elevenlabs_music_v2` | ElevenLabs Music v2 | audio |  | duration, force_instrumental, lyrics, batch_size |  |
| `elevenlabs_music_v2_5` | ElevenLabs Music v2.5 | audio |  | duration, force_instrumental, lyrics, batch_size |  |
| `sonilo_music` | Sonilo Music | audio |  | duration |  |
| `mirelo_text_to_audio` | Mirelo Text to Audio | audio |  | duration |  |
| `inworld_text_to_speech` | Inworld Text to Speech | audio |  | voice |  |
| `text2speech_v2` | Text to Speech V2 | audio |  | variant, voice_type, voice_id |  |
| `image_background_remover` | Image Background Remover | image | image_references |  |  |
| `video_background_remover` | Video Background Remover | video | video_references |  |  |
| `voice_change` | voice_change | video | input_video | voice_id, voice_type, folder_id |  |
| `dubbing` | dubbing | video | input_video | target_language, folder_id |  |
| `sync_so` | Sync Lipsync 3 | video | input_audio, input_video | sync_mode, folder_id |  |
| `outpaint` | Outpaint | image | image_references | folder_id | auto 1:1 3:2 2:3 4:3 3:4 4:5 5:4 9:16 16:9 21:9 |
| `minimax_hailuo` | Minimax Hailuo | video | end_image, start_image | variant, duration, resolution |  |
| `minimax_h3` | MiniMax H3 | video | audio_references, end_image, image_references, start_image, video_references | duration, resolution, batch_size, folder_id | auto 21:9 16:9 4:3 1:1 3:4 9:16 |
| `minimax_h3_max` | MiniMax H3 Max | video | audio_references, end_image, image_references, start_image, video_references | duration, resolution, batch_size, folder_id | auto 21:9 16:9 4:3 1:1 3:4 9:16 |
| `wan2_6` | Wan 2.6 Video | video | audio_references, image_references, video_references | quality, duration | 16:9 9:16 1:1 |
| `seedance1_5` | Seedance 1.5 Pro | video | end_image, start_image | duration, resolution, generate_audio | auto 16:9 9:16 4:3 3:4 1:1 21:9 |
| `seedance_2_0` | Seedance 2.0 | video | audio_references, end_image, image_references, start_image, video_references | duration, resolution, mode, bitrate_mode, genre, generate_audio | auto 16:9 9:16 4:3 3:4 1:1 21:9 |
| `seedance_2_5` | Seedance 2.5 | video | audio_references, end_image, image_references, start_image, video_references | mode, duration, resolution, generate_audio, bitrate_mode, extension_mode | auto 21:9 16:9 4:3 1:1 3:4 9:16 |
| `ad_multiplier` | Ad Multiplier | video | audio_references, end_image, image_references, start_image, video_references | mode, duration, resolution, generate_audio, bitrate_mode, extension_mode | auto 21:9 16:9 4:3 1:1 3:4 9:16 |
| `ad_multiplier_v2` | Ad Multiplier Recreate | video | image_references, video_references | resolution, mode, section |  |
| `cinematic_studio_video_4_0` | Cinema Studio 4.0 | video | audio_references, end_image, image_references, start_image, video_references | mode, duration, resolution, generate_audio, bitrate_mode, extension_mode, era_id, camera_model_id, camera_lens_id, camera_aperture_id, pacing_id, genre_id, light, light_id, light_custom, color_palette | auto 21:9 16:9 4:3 1:1 3:4 9:16 |
| `draw_to_video` | Draw To Video | video | image_references, ref_image, video | duration, resolution, generate_audio, enhancer | auto 21:9 16:9 4:3 1:1 3:4 9:16 |
| `reframe` | Reframe | video | image_references, start_image, video_references | resolution, duration | 21:9 16:9 4:3 1:1 3:4 9:16 |
| `topaz_image` | Topaz | image | image_references | output_width, output_height, face_enhancement, face_enhancement_creativity, face_enhancement_strength, variant, sharpen, denoise, folder_id |  |
| `topaz_image_generative` | Topaz | image | image_references | output_width, output_height, variant, autoprompt, creativity, texture, sharpen, denoise, face_enhancement, face_enhancement_creativity, face_enhancement_strength |  |
| `topaz_hyperion_2_5` | Topaz Hyperion 2.5 | video | video_references | output_format |  |
| `topaz_video` | Topaz | video | video_references | resolution, enhancement, frame_interpolation | auto 21:9 16:9 4:3 1:1 3:4 9:16 |
| `bytedance_video_upscale` | Bytedance Video Upscale | video | video_references | fps, resolution, preset, model_version |  |
| `image_decompose` | Image Decompose | image | image_references | mode, folder_id |  |
| `image_command` | Image Command | image | image_references | command, command_version, folder_id |  |
| `bytedance_image_upscale` | Bytedance Image Upscale | image | image_references | resolution, remove_bg |  |
| `video_upscale` | Video Upscale | video | input_video | duration, folder_id |  |
| `video_deflicker` | Video Deflicker | video | input_video | duration, folder_id |  |
| `kling2_6` | Kling 2.6 Video | video | start_image | duration, sound | 16:9 9:16 1:1 |
| `kling3_0` | Kling v3.0 | video | end_image, start_image | duration, mode, sound | 16:9 9:16 1:1 |
| `kling3_0_turbo` | Kling 3.0 Turbo | video | start_image | resolution, duration | 16:9 9:16 1:1 |
| `kling4_0` | Kling 4.0 | video | end_image, image_references, start_image, video_references | mode, resolution, duration, kling_element_ids | 21:9 16:9 9:16 1:1 auto |
| `kling_4_0_flash` | Kling 4.0 Flash | video | image_references, start_image, video_references | mode, resolution, duration, kling_element_ids | 21:9 16:9 9:16 1:1 auto |
| `kling_o3_image_reference` | Kling 3.0 Omni | video | image_references | duration, mode, sound, multi_shots, multi_prompt | 16:9 9:16 1:1 |
| `kling_o3_flf` | Kling 3.0 Omni (Frames) | video | end_image, start_image | duration, mode, sound, multi_shots, multi_prompt | 16:9 9:16 1:1 |
| `kling_video_edit` | Kling 3.0 Omni Edit | video | image_references, video_references | mode | |
| `happy_horse_video` | Happy Horse Video | video | start_image | resolution, duration | 16:9 9:16 1:1 4:3 3:4 |
| `hf_mult_motion_control` | Genjutsu | video | image_references, video_references | resolution | |
| `hf_mult_replace_object` | Genjutsu | video | image_references, video_references | resolution | |
| `hf_mult_motion_control_flash` | Genjutsu Lite | video | image_references, video_references | resolution | |
| `hf_mult_replace_object_flash` | Genjutsu Lite | video | image_references, video_references | resolution | |
| `intone` | Higgsfield Intone | video | audio_references, character_images, image_references, location_image | resolution, bitrate_mode | 21:9 16:9 9:16 1:1 4:3 3:4 |
| `kling3_0_motion_control` | Kling 3.0 Motion Control | video | image_references, video_references | mode, background_source | |
| `grok_video` | Grok Video | video | start_image | duration | 16:9 9:16 1:1 |
| `gemini_omni_flash_1_1` | Gemini Omni Flash 1.1 | video | end_image, image_references, start_image, video_references | mode, duration, resolution | 16:9 9:16 |
| `wan2_7` | Wan 2.7 | video | audio_references, end_image, start_image | duration, resolution | 16:9 9:16 1:1 4:3 3:4 |
| `wan3_0` | Wan 3.0 | video | audio_references, end_image, image_references, start_image, video_references | duration, resolution, generate_audio, enable_thinking | auto 16:9 9:16 1:1 4:3 3:4 |
| `wan3_0_prime` | Wan 3.0 Prime | video | audio_references, end_image, image_references, start_image, video_references | duration, resolution, generate_audio, enable_thinking | auto 16:9 9:16 1:1 4:3 3:4 |
| `veo3_1` | Google Veo 3.1 | video | start_image | duration, quality, variant | 16:9 9:16 |
| `veo3_1_lite` | Google Veo 3.1 Lite | video | end_image, start_image | duration, generate_audio | 16:9 9:16 auto |
| `depth_anything_video` | Depth Anything Video | video | video_references | variant, colormap, resolution, max_frames, side_by_side | |
| `sam_3_video` | Remove Background | video | video_references | apply_mask, frames_count | |
| `fps_boost` | FPS Boost | video | video_references | variant, fps | |
| `sam_3_3d_body` | 3D Body | 3d | image_references | export_meshes, include_3d_keypoints, include_mhr_params | |
| `tripo_3d` | Text to 3D | 3d | | negative_prompt, texture, pbr, texture_quality, geometry_quality, auto_size, face_limit | |
| `tripo_h3_1_image_to_3d` | Tripo H3.1 Image to 3D | 3d | image_references | face_limit, texture, pbr, texture_seed, texture_quality, geometry_quality, quad, texture_alignment, auto_size, orientation | |
| `tripo_h3_1_multiview_to_3d` | Tripo H3.1 Multiview to 3D | 3d | image_references | (as Tripo H3.1 Image to 3D) | |
| `tripo_p2_image_to_3d` | Tripo P2 Image to 3D | 3d | image_references | face_limit, texture, pbr, seed, texture_seed, texture_quality, texture_version, delight, auto_size, export_uv, export_orientation, quad | |
| `hunyuan3d_v3_image_to_3d` | Hunyuan3D v3 Image to 3D | 3d | image_references | enable_pbr, face_count, generate_type, polygon_type | |
| `meshy_v6_text_to_3d` | Meshy 6 Text to 3D | 3d | | mode, seed, model_type, topology, target_polycount, should_remesh, symmetry_mode, enable_pbr, pose_mode, enable_prompt_expansion, texture_prompt, texture_image_url, enable_rigging, rigging_height_meters, enable_animation, animation_action_id, enable_safety_checker | |
| `hunyuan3d_v3_1_text_to_3d` | Hunyuan 3D v3.1 Text to 3D | 3d | | mode, enable_pbr, generate_type, face_count | |
| `meshy_v5_remesh` | Meshy 5 Remesh | 3d | | model_url, topology, target_polycount, resize_height, origin_at | |
| `meshy_v5_retexture` | Meshy 5 Retexture | 3d | | model_url, text_style_prompt, image_style_url, enable_original_uv, enable_pbr, enable_safety_checker | |
| `meshy_v7_image_to_3d` | Meshy 7 Image to 3D | 3d | image_references | model_type, topology, target_polycount, symmetry_mode, should_remesh, should_texture, enable_pbr, pose_mode, texture_prompt, texture_image_url, enable_rigging, rigging_height_meters, enable_animation, animation_action_id, enable_safety_checker, ultra_mode, folder_id | |
| `cinematic_studio_image` | Cinematic Studio Image | image | image_references | resolution, camera_model_id, camera_lens_id, camera_focal_length_id, camera_aperture_id | 1:1 4:3 3:4 16:9 9:16 3:2 2:3 21:9 |
| `cinematic_studio_video_3_5` | Cinematic Studio Video 3.5 | video | audio_references, end_image, image_references, start_image, video_references | resolution, duration, genre, generate_audio, enhance_prompt, prompt_language, multi_shots, multi_shot_mode, multi_prompt, camera_style, light_scheme, color_grading, style_prompt | auto 21:9 16:9 4:3 1:1 3:4 9:16 |
| `marketing_studio_2_image` | Marketing Studio Product Shot | image | character_photo, input_images, model_image, product_image | type, style_id, preset_id, notes, want_person, brand_kit_id, folder_id | 1:1 3:2 2:3 4:3 3:4 9:16 16:9 |
| `marketing_studio_v2_video` | Marketing Studio Video | video | avatars, character_photo, input_images, location_photo, product_photo | type, style_id, preset_id, brand_url, duration, resolution, generate_audio, product_description, user_context, delivery_specs, mode_id, product_ids, medias, product_url, product_id, ad_reference_id, avatar_id, include_reference_video, web_product_id, device, batch_size, folder_id | auto 21:9 16:9 4:3 1:1 3:4 9:16 |
| `marketing_studio_v2_reference2video` | Marketing Studio Reference Video | video | character_image, input_video, product_image | folder_id | |
| `cinematic_studio_soul_cast` | Cinematic Studio Soul Cast | image | | budget | 1:1 16:9 9:16 4:3 3:4 3:2 2:3 5:4 4:5 21:9 9:21 |
| `cinematic_studio_soul_location` | Cinematic Studio Soul Location | image | | | 1:1 16:9 9:16 4:3 3:4 3:2 2:3 21:9 9:21 |
