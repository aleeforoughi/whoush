# Higgsfield API evidence log
Retrieval date: **2026-11-04** (all pages below fetched on this date via WebFetch, which returns a model-summarized markdown rendering, not raw HTML/JSON). Only facts written here may be used as verified. Anything marked **not verified** must not be relied on. Re-verify before any live use; docs change.

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
Model-specific API pages (endpoint + Input JSON Schema) are not reachable through the pages above: every `open.higgsfield.ai/models/**/playground` page fetched stated no endpoint and no input schema, and docs index says per-model docs are reached via the console (which redirects to open.higgsfield.ai) and "not linked". The only submit paths and schemas actually read are in `openapi.json`:

### Soul Standard — VERIFIED (path + inputs)
- Path: `POST /higgsfield-ai/soul/standard` (openapi.json).
- Input: `prompt` (string, required); `num_images` (integer 1-4, default 1); `resolution` (enum `2K`,`4K`, default `2K`); `aspect_ratio` (enum `1:1,4:3,3:4,3:2,2:3,5:4,4:5,16:9,9:16,21:9`, default `4:3`).
- Reference/input image fields: **none in the schema** => Whoush records `referenceImages.supported:false`.
- Output: `images[].url` (status doc).
- **Unresolved conflict:** the Soul Standard playground page (higgsfield-ai/soul/standard) lists resolutions 720p/1080p at $0.0938/$0.1875 per image, while openapi.json lists `2K`/`4K`. The adapter therefore sends only `prompt`, `aspect_ratio`, `num_images:1` and never `resolution`; the billed resolution/price is **not verified** and must be settled with Higgsfield before live use (the estimate endpoint is not documented).
- Catalog mapping: `soul-image` ("Higgsfield Soul") is mapped to this path. That the Whoush SKU name equals "Soul Standard" is an assumption by name; the playground lists "Soul Standard" and "Soul 2" separately and the SKU is the former.

### Other paths present in openapi.json (not in the Whoush catalog)
`/kling-video/v2.5-turbo/{pro,standard}/image-to-video` (prompt, image_url, duration 5|10, cfg_scale, negative_prompt), `/kling-video/v2.5-turbo/pro/text-to-video`, `/minimax/hailuo-2.3/standard/{image,text}-to-video`. Not used.

### Seedance 2.5 — NOT VERIFIED
- Explore: listed, "from 0.144 / s". Playground page: durations 4-30 s, resolutions 480p/720p/1080p; separate text-to-video, reference-to-video, image-to-video, video-edit, video-extend variants. Endpoint path and input schema: **not verified** (the quick-start's `/bytedance/seedance-2.0/text-to-video` curl is a different model and the page itself says to verify the endpoint). Aspect ratios (only "16:9" appears in a pricing note), audio, lip sync: **not verified**.

### Kling 4.0 — NOT VERIFIED
- Explore: listed. Playground: durations 3-30 s, 720p-1080p; text/image/reference/video-edit variants. Endpoint, schema, aspect ratios, audio, lip sync: **not verified**.

### Nano Banana Pro — NOT VERIFIED
- Not listed on https://open.higgsfield.ai/explore as read on 2026-11-04 (25 models + 3 workflows shown); the help-center page says "50+" models. No page read. Everything about it: **not verified**.

### Seedance 2.0 (quick-start example only)
quick-start shows `POST /bytedance/seedance-2.0/text-to-video` with `prompt`, `resolution`, `generate_audio`, `duration`, `aspect_ratio` as an example the page itself says to verify. Not in the Whoush catalog; not treated as verified.

## Provider prices
Provider USD prices appear on explore/playground pages and are intentionally NOT copied into code or any consumer response (cited above only where needed to record a conflict). Neuron SKU prices in `lib/catalog.ts` are illustrative seeds, not derived from or certified against these.
