# Higgsfield API evidence log
Retrieval date: **2026-11-04**, two retrievals the same day (all pages fetched on this date via WebFetch, which returns a model-summarized markdown rendering, not raw HTML/JSON). Only facts written here may be used as verified. Anything marked **not verified** must not be relied on. Re-verify before any live use; docs change.

Catalog evidence version: `MEDIA_CATALOG_VERSION` in `lib/catalog.ts`.

## Pages read
| URL | Result |
|---|---|
| https://open.higgsfield.ai/quick-start | read |
| https://open.higgsfield.ai/explore | read |
| https://higgsfield.ai/creator-hub/help-center/integrations/what-is-the-higgsfield-api | read |
| https://docs.higgsfield.ai/docs/llms.txt (docs index, linked from quick-start) | read |
| https://docs.higgsfield.ai/docs/concepts/requests.md | read |
| https://docs.higgsfield.ai/docs/api-reference/requests/get-request-status.md | read |
| https://docs.higgsfield.ai/docs/api-reference/requests/cancel-a-queued-request.md | read |
| https://docs.higgsfield.ai/docs/authentication.md | read |
| https://docs.higgsfield.ai/docs/concepts/billing-and-retention.md | read |
| https://docs.higgsfield.ai/docs/concepts/errors.md | read |
| https://docs.higgsfield.ai/docs/concepts/polling.md | read |
| https://docs.higgsfield.ai/docs/openapi.json | read (index calls it "supplementary ... not the authoritative model catalog") |
| https://open.higgsfield.ai/models/bytedance/seedance-2.5/text-to-video/playground | read: no endpoint path, no input schema |
| https://open.higgsfield.ai/models/bytedance/seedance-2.0/text-to-video/playground | read: no endpoint path, no input schema |
| https://open.higgsfield.ai/models/kling-video/v4.0/text-to-video/playground | read: no endpoint path, no input schema |
| https://open.higgsfield.ai/models/higgsfield-ai/soul/standard/playground | read: no endpoint path, no input schema |
| https://open.higgsfield.ai/models/higgsfield-ai/soul/v2/standard/playground | read: no endpoint path, no input schema |
| https://open.higgsfield.ai/ , https://open.higgsfield.ai/models/bytedance/seedance-2.0/text-to-video | read: no API/schema links |
| https://open.higgsfield.ai/models/bytedance/seedance-2.0/text-to-video/api, https://open.higgsfield.ai/docs, https://open.higgsfield.ai/llms.txt | HTTP 404 |
| https://console.higgsfield.ai | 301 to https://open.higgsfield.ai/ |
| Webhooks (`docs.higgsfield.ai/docs/how-to/webhooks.md`), idempotency page, file-uploads, rate-limits, estimate endpoint, per-model `llms.txt` | **not read / not found: not verified** |


### Second retrieval, 2026-11-04 (per-model API reference)
The docs now have per-model reference pages under `docs.higgsfield.ai/docs/models/` (linked from https://docs.higgsfield.ai/docs/api-reference/overview.md; the catalogue page says 84 entries, 17 image and 67 video). Fetched with WebFetch on 2026-11-04:

| URL | Result |
|---|---|
| https://docs.higgsfield.ai/docs/api-reference/overview.md | read: links model reference pages |
| https://docs.higgsfield.ai/docs/models/image-generation.md | read: 14 image model pages; Soul Standard and Soul 2 listed; **no Nano Banana Pro** |
| https://docs.higgsfield.ai/docs/models/video-generation.md | read: 22 video model families; Seedance 2.5 and Genjutsu listed; **no Kling 4.0** (newest Kling is 3.0) and **no Intone** or other lip-sync model |
| https://docs.higgsfield.ai/docs/models/soul-standard/generate.md | read: path and schema |
| https://docs.higgsfield.ai/docs/models/seedance-2-5/text-to-video.md | read: path and schema |
| https://docs.higgsfield.ai/docs/models/seedance-2-5/reference-to-video.md | read: path and schema (not used) |
| https://docs.higgsfield.ai/docs/models/genjutsu.md | read: three workflows |
| https://docs.higgsfield.ai/docs/models/genjutsu/object-swap.md | read: path and schema |
| https://docs.higgsfield.ai/docs/models/genjutsu/motion-transfer.md | read: path and schema |
| https://docs.higgsfield.ai/docs/models/intone.md | HTTP 404 |
| https://docs.higgsfield.ai/docs/concepts/rate-limits.md | read (below) |
| https://docs.higgsfield.ai/docs/enterprise/usage-and-billing.md | read: no price list; `GET /models/usage` is usage analytics, "not a billing record" |
| https://open.higgsfield.ai/models/higgsfield-ai/soul/standard/playground | read: prices |
| https://open.higgsfield.ai/models/bytedance/seedance-2.5/text-to-video/playground | read: prices |
| https://open.higgsfield.ai/models/higgsfield/genjutsu/object-swap/v1.0/playground, https://open.higgsfield.ai/models/higgsfield/genjutsu/motion-transfer/v1.0/playground | read: prices |
| https://open.higgsfield.ai/models/higgsfield-ai/soul/standard/llms.txt | HTTP 404 |

Rate limits (rate-limits.md): concurrency is per account and model and shown in the console; requests above it are accepted and queued; when the queue is full a generation gets `429` with `Retry-After` and code `account_queue_full` ("nothing is created or charged"); resubmit after `Retry-After` with the same `Idempotency-Key`; `503 admission_control_unavailable` means retry with backoff; successful responses carry no remaining-capacity headers. Whoush does not yet retry Higgsfield 429s (a submission error releases the reservation).

### Third retrieval, 2026-11-05 (the full catalogue)
Every one of the 84 API workflow pages (17 image, 67 video, across 36 families) was downloaded raw and its path recorded, alongside the full MCP catalogue (136 models). See **`docs/HIGGSFIELD_MODELS.md`**.

## Transport (verified)
- Base URL: `https://api.higgsfield.ai` (quick-start; authentication.md example).
- Auth header: `Authorization: Key <credential>` + `Content-Type: application/json`. **Sources differ on the credential shape:** quick-start says `Key <api-key>` ; authentication.md, get-request-status.md and openapi.json say `Key {api_key_id}:{api_key_secret}`. authentication.md also says legacy headers `hf-api-key` / `hf-secret` exist and new integrations should use `Authorization`. `lib/higgsfield.ts` sends `Key ` + `HIGGSFIELD_API_KEY`, so that env var must hold the exact credential string Higgsfield issues; which shape is right is **not verified**.
- Submit: `POST https://api.higgsfield.ai/<model-path>` with a JSON body (quick-start). Response fields: `request_id`, `status_url`, `cancel_url` (quick-start); requests.md initial response sample also has `status:"queued"` and `expires_after` (seconds, 604800 in sample). requests.md: use the returned `status_url`/`cancel_url` rather than building them.
- Idempotency: errors.md says to send an `Idempotency-Key` header with every generation submission and to repeat the same request with the same key after an ambiguous timeout/5xx; same key with different parameters returns 422. Key lifetime: **not verified**. `openapi.json` does not define the header.
- Status: `GET /requests/{request_id}/status` (request_id is a uuid). 200 body `RequestStatus`: `status` (enum `queued|in_progress|nsfw|failed|completed|canceled`), `request_id`, optional `status_url`, `cancel_url`, `error` (string|null), `images[]`, `video`, `audio`, `audios[]` (each `{url}`), `expires_at` (date-time|null, present once finished). 401 bad credentials, 404 not found or other account's request. Errors body: `{detail:string}`.
- Status meanings (requests.md): `queued` non-terminal, may still be canceled; `in_progress` non-terminal, can no longer be canceled; `completed` terminal, output URLs in response; `failed` terminal, response may include `error`; `nsfw` terminal, input or output rejected by content moderation; `canceled` terminal, canceled before processing started.
  - NOTE: pre-existing `lib/higgsfield.ts` used `processing`; documented value is `in_progress`. Updated.
- Polling (polling.md): start at 2 s, grow gradually to at most 10 s (example x1.5), app-level timeout appropriate to model, 30 s per-HTTP-request timeout in example; stop on `completed|failed|nsfw|canceled`.
- Cancel: `POST /requests/{request_id}/cancel`. 202 with empty body when canceled; 400 when processing already started; 401; 404. quick-start: "Cancel must reach the API; stopping polling alone does not cancel a generation." A successfully canceled queued request is refunded (billing-and-retention.md).
- Billing (billing-and-retention.md; help-center page): USD prepaid balance, separate from website credits; only successful generations are charged; `failed` and `nsfw` not charged; reserved amounts refunded automatically; insufficient balance gives 403 (errors.md). **Estimate endpoint: help-center page says one exists; its path/schema was not found in the docs index: not verified.**
- Errors (errors.md): 400 invalid params, 401 creds, 403 insufficient balance, 404 not found, 409 still running (delete), 422 validation/idempotency key reuse with different params, 423 model temporarily blocked, 429 queue full / limit (`Retry-After`), 500 retry with backoff, 503 model disabled/not ready.
- Retention: request files kept seven days after finish, then deleted; `expires_at` in status; `Hf-Expires-After` header (>= 1 hour) shortens retention; `DELETE /requests/{request_id}` deletes finished request data (409 if queued/in_progress). Help-center: "at least 7 days". Whoush must mirror outputs to owned storage (**not implemented**; outputs are flagged `needsMirroring`).
- Webhooks: help-center says webhooks can notify on completion; setup, payload, signature scheme **not verified**. Whoush uses polling only.
- Rate limits: help-center: creating an API key unlocks 20 concurrent requests; others **not verified**.
- Terms: see `docs/LAUNCH_GATES.md` (provider authorization is unresolved).

## Per-model facts
Facts below come from the per-model API reference pages (second retrieval). Where they differ from `openapi.json` or the playground, the per-model page wins: it is the model's own documentation.

### Soul Standard — VERIFIED <a id="soul-standard"></a>
- Path: `POST /higgsfield-ai/soul/standard` (soul-standard/generate.md; same as openapi.json).
- Input (`SoulParamsSchema`): `prompt` (string, required); `aspect_ratio` (`9:16,16:9,4:3,3:4,1:1,2:3,3:2`, default `4:3`); `resolution` (`720p,1080p`, default `720p`); `batch_size` (`1` or `4`, default 1); `enhance_prompt` (bool, default false); `style_id` (uuid), `style_strength` (0-1); `seed` (1-1,000,000); `custom_reference_id` (uuid, a trained Soul ID), `custom_reference_strength` (0-1); `image_reference_url` (uri). `additionalProperties` not stated.
- **Corrections to the first retrieval:** the resolution enum is `720p/1080p` (matching the playground), not openapi.json's `2K/4K`, so the earlier conflict is settled; the count field is `batch_size`, not `num_images`; `5:4`, `4:5` and `21:9` are not accepted.
- Whoush sends `{prompt, resolution: "720p", batch_size: 1, aspect_ratio?}` (`lib/media-provider.ts`). `image_reference_url` exists but is not used: user media is not hosted yet, so `referenceImages.supported` stays false.
- Output: `images[].url`.
- **Live check, 2026-11-04 (owner dev path, not charged):** `{prompt, resolution:"720p", batch_size:1, aspect_ratio:"16:9"}` was accepted and completed with one PNG of 1696x960 (16:9 within the 2% output-QA tolerance; "720p" is a tier, not a pixel height).
- Seedance 2.5 and Genjutsu were **not** live-tested: one 5 s 1080p Seedance clip is about $5.70 at list price.

### Seedance 2.5 — VERIFIED (text-to-video) <a id="seedance-2-5"></a>
- Path: `POST /bytedance/seedance-2.5/text-to-video`.
- Input: `prompt` (string, required, non-blank); `duration` (integer 4-30, default 5); `resolution` (`480p,720p,1080p`, default `720p`); `aspect_ratio` (`16:9,4:3,1:1,3:4,9:16,21:9`, default `16:9`); `bitrate_mode` (`standard,high`, default `high`); `output_format` (`mp4,mov`, default `mp4`); `generate_audio` (bool, default **true**). `additionalProperties: false`. No media inputs.
- Whoush SKUs `seedance-2-5-5s` and `seedance-2-5-10s` send `{prompt, duration, resolution: "1080p", generate_audio, aspect_ratio?}`; `seedance-2-5-480p-*` and `seedance-2-5-720p-*` (2026-11-08) send `"480p"` and `"720p"`. **2026-11-08 (owner):** `generate_audio` is `true` only when the soundtrack check can run (`lib/audio-check.ts`, docs/MODERATION_POLICY.md step 7), else `false`.
- **Audio price, re-read 2026-11-08** (playground page): billable video tokens = `ceil(height × width × (input video duration + generated duration) × 24 / 1024)`: no audio term, and the listed rates are for the default configuration, where `generate_audio` is `true`. The docs page states no audio cost. The approved SKUs (from those rates) therefore already cover sound; a separate audio charge is not stated anywhere.
- Other workflows exist (image-to-video, reference-to-video, video-edit, video-extend). reference-to-video takes up to 30 image, 10 video and 10 audio URLs (50 total), public URLs only, `asset://` rejected. Not used: user media is not hosted.

### Genjutsu — VERIFIED (object swap, motion transfer); not submittable yet <a id="genjutsu"></a>
- Object swap: `POST /higgsfield/genjutsu/object-swap/v1.0` (catalog `genjutsu-replace`). Motion transfer: `POST /higgsfield/genjutsu/motion-transfer/v1.0` (catalog `genjutsu-motion`). The legacy misspelt ids `higgsfiled/genjutsu/...` still work but are hidden; Whoush uses the corrected ids. A third workflow, restyle, is not used.
- Input (both): `video_url` (uri, required), `image_urls` (1-8 uris, required, ordered), `prompt` (max 10,000 chars, default empty), `resolution` (`480p,720p,1080p`, default `720p`). `additionalProperties: false`.
- Limits: source video at least 4 s; longer than 30 s is trimmed to 30 s; output length follows the prepared source; every frame at least 409,600 pixels. File types not listed.
- **Not submittable:** both inputs must be public URLs the provider can fetch, and Whoush keeps user media in the browser. `lib/policy.ts` adds `needs_hosted_media` and `lib/media-provider.ts` has no payload for it. Also price pending (below).

### Kling 4.0 — NOT VERIFIED
- 2026-11-05: listed on the open playground (Kling 4.0 and Kling 4.0 Flash) and in the MCP catalogue (`kling4_0`, `kling_4_0_flash`). Still **no API docs page**; the newest documented Kling is 3.0 (`docs/HIGGSFIELD_MODELS.md`).
- No API reference page: the video catalogue's newest Kling is 3.0 (plus 3.0 Motion Control, O3 and Omni). An earlier playground page for `kling-video/v4.0` showed no endpoint. Unverified, never live.

### Nano Banana Pro — NOT VERIFIED
- Not in the image catalogue (14 model pages). Unverified, never live.
- **Re-checked 2026-11-05: still absent.** It is also absent from the open playground. It exists only in the MCP catalogue, as `nano_banana_pro`, `nano_banana_2` and `nano_banana_2_1`. See `docs/HIGGSFIELD_MODELS.md`.

### Intone — NOT VERIFIED
- No API reference page (`docs/models/intone.md` is 404; no lip-sync or talking-head model in the video catalogue). Facts come only from the agent catalogue below. Stays locked.

### Other paths present in openapi.json (not in the Whoush catalog)
`/kling-video/v2.5-turbo/{pro,standard}/image-to-video`, `/kling-video/v2.5-turbo/pro/text-to-video`, `/minimax/hailuo-2.3/standard/{image,text}-to-video`. Not used.

## Provider prices <a id="provider-prices"></a>
The API docs publish no price list (usage-and-billing.md: invoice pricing "agreed with Higgsfield"). The playground pages show list prices "before any applicable customer discount". Provider USD prices stay out of code and every consumer response; they are recorded here for the owner's SKU decision only.

| Endpoint | Unit | 480p | 720p | 1080p | Notes |
|---|---|---|---|---|---|
| Soul Standard | per image | | $0.0938 | $0.1875 | |
| Seedance 2.5 text-to-video | per output second | ~$0.2056 | ~$0.4622 | ~$1.1372 | "roughly", token-based (1,000 video tokens $0.0214 at 480p/720p, $0.0234 at 1080p), 16:9 estimate. The page's own table range is $0.144-$0.7961/s, about 0.7x of these; audio and bitrate effects not stated |
| Genjutsu object swap / motion transfer | per input-video second, rounded up | $0.318 | $0.681 | $1.632 | the related-models table shows $0.159-$0.816/s, exactly half: **conflict**, the higher figure is used below |

### Neuron SKUs: approved by the owner, 2026-11-04 (applied in `lib/catalog.ts`, catalog version `2026-11-04.5`)
Method, from `docs/NEURON_PRICING.md`: provider plus planner cost per Neuron must stay at or below `c = V(1-0.20)/(1+b) = $0.128` for the development example `V = $0.176`, `b = 10%`. SKU = ceil((provider price + $0.05 planner allowance) / $0.128), integer, using the higher price where sources conflict. `V` is a development example, not a production margin certification.

| SKU | Before (illustrative) | Approved | Margin of the old price at the higher cost |
|---|---|---|---|
| `soul-image` (720p) | 4 | 2 | about 78% |
| `seedance-2-5-5s` (1080p) | 42 | 45 | about 15%: **below the 20% target** |
| `seedance-2-5-10s` (1080p) | 80 | 90 | about 11%: **below the 20% target** |
| Genjutsu 720p (`genjutsu-replace`, `genjutsu-motion`), source up to 5 / 10 / 15 / 30 s | price pending | 27 / 54 / 81 / 160 | |
| `seedance-2-5-480p-5s` / `-10s` (480p), added 2026-11-08 at the owner's request, same formula | | 9 / 17 | (1.028 + 0.05) / 0.128 = 8.4; (2.056 + 0.05) / 0.128 = 16.5 |
| `seedance-2-5-720p-5s` / `-10s` (720p), added 2026-11-08 at the owner's request, same formula | | 19 / 37 | (2.311 + 0.05) / 0.128 = 18.4; (4.622 + 0.05) / 0.128 = 36.5 |
| Genjutsu 480p, up to 5 / 10 / 15 / 30 s | | 13 / 26 / 38 / 75 (approved; no 480p SKU in the catalog yet) | |
| Genjutsu 1080p, up to 5 / 10 / 15 / 30 s | | 65 / 128 / 192 / 383 (approved; no 1080p SKU in the catalog yet) | |

Genjutsu is billed per input second (rounded up), so each source-length band is one integer SKU (`sourceSecondsSkus`). A quote needs `sourceVideoSeconds` measured server-side from the hosted source video; the public quote route does not accept it from the client, so Genjutsu cannot be quoted until hosted, inspected media exists. Re-derive every SKU when a provider price changes, as a new catalog version (`docs/NEURON_PRICING.md`).

## Higgsfield agent (MCP) catalogue, 2026-11-04
Source: the `models_explore` tool of the Higgsfield MCP connector (Higgsfield's agent platform), retrieved by the lead on **2026-11-04**. This is **NOT** the public API documentation.

**What this does and does not verify.** The public API index (https://docs.higgsfield.ai/docs/llms.txt, fetched 2026-11-04) lists **no per-model pages** and says to find models at https://console.higgsfield.ai and in each model's own documentation. At that time the `api.higgsfield.ai` paths and input schemas for the three models below were **not verified**. **Update (second retrieval): both Genjutsu workflows now have API reference pages and are verified above; Intone still has none.**, and the MCP ids (`intone`, `hf_mult_replace_object`, `hf_mult_motion_control`) are **not API paths**. No max counts were given for image or video references (only Intone's text says "one or two characters" and "one to six voice recordings"). **No prices were given.** In `lib/catalog.ts` Intone remains `capabilities.verified:false` with no `verifiedApiPath`, `pricePending: true` and `evidenceSource: "agent_catalogue"`; it can be suggested as "coming soon" but never proposed, quoted or submitted. Genjutsu is now `evidenceSource: "api_docs"` and verified, still price pending.

| MCP id | name | description | output | params | media roles | aspect ratios | tags |
|---|---|---|---|---|---|---|---|
| `intone` | Higgsfield Intone | Talking-head video: one or two characters speak one to six voice recordings, alone to the camera or to each other, in the room of a location image or one the prompt names; as long as the voices (2 to 30 seconds in total, pauses between files not counted) | video | resolution 480p/720p/1080p (default 1080p); bitrate_mode high/standard (default high) | character_images, location_image, image_references, audio_references | 21:9, 16:9, 9:16, 1:1, 4:3, 3:4 | talking-head, lip-sync, dialogue, image-to-video, audio-reference |
| `hf_mult_replace_object` | Genjutsu | Replace objects in a source video using reference images | video | resolution 480p/720p/1080p (default 720p) | image_references, video_references | none listed | video-edit, object-replacement, reference |
| `hf_mult_motion_control` | Genjutsu | Transfer motion from a reference video to subjects in reference images | video | resolution 480p/720p/1080p (default 720p) | image_references, video_references | none listed | motion-control, image-to-video, video-reference |

### Intone <a id="mcp-intone"></a>
- Catalog id `intone` (display name "Intone"). Operation `lip_sync`. Recorded from the row above: `characterImagesMax: 2` ("one or two characters"), `audioClipsMax: 6`, `audioSecondsRange: [2, 30]`, `locationImage: true`, resolutions 480p/720p/1080p, the six aspect ratios listed, `referenceImages {supported:true, max:2}` (derived from "one or two characters").
- `bitrate_mode` is recorded here but not modelled. API path, input field names, billing unit and price: **not verified**.

### Genjutsu, replace object <a id="mcp-genjutsu-replace"></a>
- Catalog id `genjutsu-replace` (display name "Genjutsu"), MCP id `hf_mult_replace_object`. Operation `replace`; `videoReference: true`; `referenceImages {supported:true, max:null}` (supported, count not listed). No aspect ratios listed, so `aspectRatios: []`. Resolutions 480p/720p/1080p. As recorded from the agent catalogue; superseded by the API reference (see [Genjutsu](#genjutsu)): max 8 references, verified path, still price pending.

### Genjutsu, motion control <a id="mcp-genjutsu-motion"></a>
- Catalog id `genjutsu-motion` (display name "Genjutsu"), MCP id `hf_mult_motion_control`. Operation `motion_transfer`; `motionReference: true`; `referenceImages {supported:true, max:null}`. No aspect ratios listed. Resolutions 480p/720p/1080p. As recorded from the agent catalogue; superseded by the API reference (see [Genjutsu](#genjutsu)): max 8 references, verified path, still price pending.

### Before any of these can be enabled
API path and input schema read from the model's own documentation; a fixed integer Neuron SKU approved; media inspection and moderation in place (`docs/MODERATION_POLICY.md` step 4); provider authorization (`docs/LAUNCH_GATES.md` gate 1). See `docs/CAPABILITY_SCOUT.md`.

## Model fit test, 2026-11-05 (agent connector, not the API) <a id="model-fit-2026-11-05"></a>
Source: 9 jobs run through the Higgsfield MCP connector by the lead, 1k resolution, one take each, hybrid prompt (plain must-match sentences followed by a JSON spec). This shows how well each model follows camera and light settings from the canvas. It does **not** verify any API path or price for Whoush. Credits are the connector's quotes before submission: Seedream 5.0 Pro 1.25, Nano Banana Pro 2, 3D Jutsu Angles 1.25, Flux Kontext 1.5; 13.75 in total.

**Model id mismatch:** the three jobs submitted as `nano_banana_pro` came back labelled `nano_banana_2`. Until that is explained, treat their results as coming from `nano_banana_2`.

Scores are 0 to 2 per setting (2 means it followed the setting), judged by eye by the lead from one take. They are a first signal, not a benchmark.

| Job | Model | Angle | View | Framing | Light | Identity kept | Realism |
|---|---|---|---|---|---|---|---|
| New image S1: low angle, side profile, tight close-up, window light from front-left | Seedream 5.0 Pro | 2 | 2 | 1 (chest-up, not tight) | 2 | n/a | 1 |
| New image S1 | Nano Banana (reported as `_2`) | 1 (near eye level) | 2 | 2 | 2 | n/a | 2 |
| New image S3: worm's-eye, facing camera, waist-up, red key light from front-left | Seedream 5.0 Pro | 1 (table height, not floor) | 2 | 2 | 2 | n/a | 1 |
| New image S3 | Nano Banana (reported as `_2`) | 1 (lower, wide-lens feel; still not floor) | 2 | 2 | 1 (red on one side only) | n/a | 2 |
| Edit E1: change camera to low angle, profile, close-up | 3D Jutsu Angles | 2 | 1 (three-quarter, not a full profile) | 2 | kept | 1 | 1 |
| Edit E1 | Seedream 5.0 Pro, `is_inpaint` | 0 (eye level) | 2 | 2 | kept | 2 | 1 |
| Edit E2: change light only, blue key from the right | Seedream 5.0 Pro, `is_inpaint` | kept | kept | kept | 1 (blue, but not clearly from the right) | 2 | 1 |
| Edit E2 | Flux Kontext | kept | kept | kept | 0 (whole image tinted blue, no direction) | 1 | 0 |
| Edit E2 | Nano Banana (reported as `_2`) | kept | kept | kept | 1 (blue mood, direction unclear) | 2 | 2 |

Takeaways for routing (one model, one take first; at most two models):
- **New images:** Nano Banana gave the best realism and close-up framing, and Seedream followed the angle better. No model reached a true worm's-eye view, so the canvas should not offer a steeper angle than the models can deliver, or must warn before charging.
- **Camera edits:** 3D Jutsu Angles is the only one that moved the camera; Seedream inpaint kept identity best but did not change the angle.
- **Light edits:** Seedream inpaint and Nano Banana both kept identity; neither placed the light reliably. Flux Kontext applied a colour filter and is unfit for light edits.
- In the earlier soul-image run, the reference image acted as a style reference, so edits failed.
