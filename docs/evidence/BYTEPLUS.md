# BytePlus ModelArk (ByteDance, international): API evidence

**Read 2026-11-05 by a lead-assigned reader, read-only.** Nothing was signed in to, no key was used and no generation was called. Raw pages are kept in the lead's scratchpad.

- **Docs:** `https://ai.byteplus.com/ark/region:ap-southeast-1/docs/<slug>` returns raw Markdown when `.md` is appended, and `https://ai.byteplus.com/ark/llms.txt` indexes every page.
- **Prices:** `https://docs.byteplus.com/en/docs/modelark/model-pricing` (updated 2026-10-23).

Slugs cited below are relative to `S = https://ai.byteplus.com/ark/region:ap-southeast-1/docs/`.

## Blocking findings (owner and counsel)

1. **Video resale (Service-Specific Terms §4.2, BytePlus Video Generation Model Service).**
   - A "Platform Customer" that makes the video APIs available to external creators "may not: resell or re-integrate the APIs into UGC platforms, including AI content creation tools… or resell the APIs without our written authorization".
   - It must also have identity verification for end users, incident response, tiered violation handling with records, and rights checks on user uploads, including real-person imagery.
   - Remedies are liquidated damages of 10% of video orders or committed spend (§4.1.2), and 20% of the minimum commitment for unauthorized resale (§4.2.4(b)).
   - **Whoush is this case: Seedance needs BytePlus's written authorization before any customer use.**
2. **Reselling in general (Customer Agreement §6.2(1)).** No acting as a "SaaS… MaaS provider, service provider, reseller, or distributor of the Services" without advance written consent.
3. **Territory.** The licence runs "within the available territories applicable to you". **Iran is not in the availability list** (`S availability`, updated 21 April 2026). The service is "not available in the United States". The sanctions clause is Customer Agreement §17.3.
4. **Entity and law.** BytePlus Pte. Ltd. (or a designated affiliate), Singapore law, SIAC arbitration seated in Singapore.
5. **Real faces.** Seedance 2.x rejects input images or videos with real faces (`InputImageSensitiveContentDetected.PrivacyInformation`, HTTP 400). Only preset characters, the account's own outputs from the last 30 days, or authorized real-person assets are allowed, passed as `asset://<ID>` (`S seedance-portrait-asset-guide`).
6. **No idempotency.** No idempotency key or client request id exists on image generation or on video create, get or delete. A resend after an unclear timeout can make a second paid job, so Whoush never resends to BytePlus automatically.
7. **Retirement.** Seedance 1.5 Pro retires on 2026-11-11. Do not build against it.
8. **Account activation.** Seedance 2.x needs an account balance of at least USD 30, an AI Savings Plan, or a resource pack.

## Transport

| | |
|---|---|
| Base URL | `https://ark.ap-southeast.bytepluses.com/api/v3` (region ap-southeast-1, where every listed model is available). EU (`ark.eu-west.bytepluses.com`) lists only `seedream-5-0-lite`. |
| Auth | `Authorization: Bearer <API key>` (`S base-url-and-authentication`). The image and video APIs support only API keys. |
| Image | `POST /images/generations`. Synchronous; the result is in the response. |
| Video | `POST /contents/generations/tasks` returns `{"id":"cgt-…"}`. Poll with `GET /contents/generations/tasks/{id}`. `DELETE /contents/generations/tasks/{id}` cancels while `queued`, cannot cancel while `running`, and deletes the record once finished. |
| Video statuses | `queued`, `running`, `cancelled`, `succeeded`, `failed`, `expired` |
| Output links | Image `data[].url` and video `content.video_url` are valid for **24 hours**; a 2.5 video URL can be downloaded at most 100 times. Whoush mirrors outputs into its own storage. |
| Rate limits | Images: 500 per minute. Video: individual accounts 180 requests per minute and 3 concurrent; enterprise 600 and 10. Status checks are limited to 20 per second. |
| Retry | Exponential backoff with jitter on 429 `ServerOverloaded`. No `Retry-After` header is stated. |

## Models and prices (USD)

| Model | `model` id | Type | Price |
|---|---|---|---|
| Seedream 5.0 Pro | `dola-seedream-5-0-pro-260628` | image (generate and edit, up to 10 references) | $0.045 per image up to 2.61M px (1K or 1.5K); $0.09 above. Second and later input images $0.003 each |
| Seedream 5.0 Flash | `dola-seedream-5-0-flash-260915` | image | $0.018 |
| Seedream 5.0 Lite | `seedream-5-0-260128` (the price page also lists `seedream-5-0-lite-260128`) | image (up to 14 references) | $0.035 |
| Seedream 4.5 | `seedream-4-5-251128` | image | $0.04 |
| Seedream 4.0 | `seedream-4-0-250828` | image | $0.03 |
| Seedance 2.5 | `dreamina-seedance-2-5-260628` | video, 4–30 s, 480p/720p/1080p | $10.70 per M tokens (480p and 720p), $11.70 (1080p). 5 s 16:9 example: $0.514 at 480p, $1.156 at 720p, $2.843 at 1080p |
| Seedance 2.0 | `dreamina-seedance-2-0-260128` | video, 4–15 s, up to 4K | $7.00, $7.70 (1080p), $4.00 (4K) per M tokens. 5 s: $0.35 at 480p, $0.76 at 720p, $1.87 at 1080p |
| Seedance 2.0 Fast | `dreamina-seedance-2-0-fast-260128` | video, 480p/720p | $5.60 per M tokens. 5 s: $0.28 at 480p, $0.60 at 720p |
| Seedance 2.0 Mini | `dreamina-seedance-2-0-mini-260615` | video, 480p/720p | $3.50 per M tokens. 5 s: $0.18 at 480p, $0.38 at 720p |

**Video token rules:**
- Tokens = (input video seconds + output video seconds) × width × height × 24 fps ÷ 1024.
- Billing uses the returned `usage.completion_tokens`, and minimum token amounts apply when a video is an input.
- Only successful outputs are billed; moderation failures are not.
- The 2.x models carry no audio surcharge.

## Image request (`S image-generation-api`)

**Fields:**
- `model`, `prompt`
- `image`: a URL or `data:image/<fmt>;base64,…`, string or array, up to 30 MB each
- `size`: a keyword or `WxH`
  - 5.0 Pro and Flash: `1K`, `1.5K`, `2K`, or `WxH` within [921,600, 4,624,220] pixels; default `2K`
  - 5.0 Lite and 4.5: `2K` and up
- `response_format`: `url` or `b64_json`
- `watermark`: **default true**, a visible "AI-generated" mark in the lower right
- `output_format`: `png` or `jpeg` (5.0 models)
- `optimize_prompt_options.mode`: `standard` or `fast`
- `sequential_image_generation` (5.0 Lite, 4.5 and 4.0 only)

**Missing fields:** no `seed` or `guidance_scale`, and no `n` beyond sequential generation. **Persian is not among the listed prompt languages**, so Whoush sends its English compiled prompt.

**Editing:** the same endpoint with `image` plus an instruction. There is no separate edit endpoint.

**Response:** `{"model","created","data":[{"url","size"}],"usage":{"generated_images","output_tokens"}}`. A request-level failure returns `error:{code,message}`.

## Video request (`S create-video-generation-task-api`)

**`content[]` items:**
- text
- `image_url`, with `role` `first_frame`, `last_frame` or `reference_image`; 1 first frame, 2 for first and last, or 1–30 (2.5) or 1–9 (2.0) references
- `video_url`, with `role` `reference_video`
- `audio_url`, with `role` `reference_audio`

**Other fields:**
- `resolution`, `ratio` (`16:9`, `4:3`, `1:1`, `3:4`, `9:16`, `21:9`, `adaptive`)
- `duration` (seconds, or −1 to let the model choose)
- `generate_audio` (**default true**), `watermark` (default false), `output_format` (2.5)
- `return_last_frame`, `callback_url` (callbacks are **unsigned**), `execution_expires_after`, `priority`
- `safety_identifier`: a per-user value of up to 64 characters
- `omni_reference_task_type` (2.5): `auto`, `reference`, `edit` or `extend`

**Not available on 2.x:** `seed`, `camera_fixed`, `frames` and flex pricing.

**Rule:** first frame, first and last frame, and omni reference cannot be mixed in one request.

## Live check, 2026-11-06 (owner's key, dev-live)

- **The key is accepted.** An empty `POST /images/generations` returned 400 `MissingParameter`, so it got past authentication and nothing was generated.
- **Seedream is not switched on.** One in-app submit of `seedream-5-lite` (`seedream-5-0-260128`) returned 404 `ModelNotOpen`.
- **The fix is the owner's:** activate each model in the ModelArk console:
  - Seedream 5.0 Lite and 5.0 Pro
  - Seedance 2.0 and 2.0 Mini, which also need a balance of at least USD 30 or a resource pack
- Nothing was billed.

## Live check, 2026-11-06, second run: first successful image

- **Seedream 5.0 Pro** (`dola-seedream-5-0-pro-260628`) is now activated.
  - A no-prompt request returns 400 `MissingParameter` instead of `ModelNotOpen`.
- **Seedream 5.0 Lite** (`seedream-5-0-260128`) still returns 404 `ModelNotOpen`.
- **One in-app dev-live run of `seedream-5-pro-2k` completed end to end:**
  - Persian request, then planner, then quote (2 Neurons, `dev_live`), then `POST /images/generations`.
  - Then the output link was copied into Whoush's store (`/api/generation/media/<id>`) and the job completed. 0 Neurons charged.
  - About 2.5 minutes from submit to completion.
  - Output: a 2048×2048 PNG with BytePlus's visible "AI generated" mark in the lower right (`watermark:true`).
- **Finding:** the brief's aspect ratio was not one Seedream offers, so the quote returned 422 `invalid_configuration`.
  - The studio then quoted again with no ratio (`components/studio.tsx`), and the image came out square (the SKU's default).
  - It should fall back to the nearest ratio the model supports.
