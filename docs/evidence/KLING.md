# Kling official API (international): API evidence

**Read 2026-11-05 by a lead-assigned reader, read-only.** Nothing was signed in to, no key was used and no generation was called.

The doc site (`https://app.klingai.com/global/dev/document-api/…`) is a single-page app. Its content was decoded from the doc bundles on `https://s16-kling.klingai.com/kos/s101/nlav112918/api-doc/assets/`, and the raw and decoded files are in the lead's scratchpad.

## Blocking findings (owner and counsel)

1. **Own use only.** API Paid Service terms §10.3: each API service and its rights are "limited to your own use through your registered User Account", with no granting, renting, transferring or selling without written consent. **Reselling to Whoush customers needs Kling's written permission.**
2. **Territory.** §3.3 licenses use "within the geographical scope of business", which is not defined. §5.4 puts compliance with the end user's country on the customer.
   - No sanctions or restricted-country clause appears in the readable pages.
   - The main Kling AI Terms of Service (`https://kling.ai/docs/user-policy`) could **not** be read, and the paid terms incorporate it by reference.
3. **Entity and data.** Kling AI Pte. Ltd., data stored in Singapore. Prompts and responses are logged for 30 days; data is not used for training (§5.1, §5.5). Governing law is not stated in the pages read.
4. **Kling 4.0 is not yet open** ("Kling 4.0 API access is not yet available"). Not integrated.
5. **Unit-pack prices are login-gated.** The public pricing data gives units and USD list equivalents. Pack sizes, minimum purchase and per-pack concurrency are not public.

## Transport (current design)

| | |
|---|---|
| Base URL | `https://api-singapore.klingai.com`, documented "for users whose servers are located outside of China". |
| Auth | `Authorization: Bearer <API Key>` ("API Key (for all models)"). The legacy access-key and secret-key JWT is not used by Whoush. |
| Create | `POST /text-to-video/kling-3.0` (also `/image-to-video/kling-3.0`, `/omni-video/kling-3.0-omni`, `/motion-control/kling-3.0`) |
| Body | `{prompt, settings:{resolution, aspect_ratio, duration, audio, multi_shot}, options:{external_task_id, callback_url, watermark_info:{enabled}}}` |
| Create response | `{"code":0,"message","request_id","data":{"id","status","create_time","update_time","external_id"}}` |
| Query | `GET /tasks?task_ids=a,b` or `GET /tasks?external_task_ids=a,b`. `data` is a list of tasks with `status`, `message`, `outputs[{type:"video",url,watermark_url,duration}]` and `billing[]`. |
| Statuses | `submitted`, `processing`, `succeeded`, `failed` (the legacy design uses `succeed`) |
| Cancel | No cancel endpoint documented. |
| Idempotency | `external_task_id` "must be unique within the scope of the account" and is queryable. Duplicate behavior is not stated. **Whoush looks the key up before every create, so a resend finds the existing task.** |
| Results | Kept for 30 days. Whoush mirrors them at completion. |
| Concurrency | Running tasks per account, per model and per pack type. "The system does not impose any QPS limits". Over the limit returns HTTP 429, code 1303. |
| Errors | `code` 0 is success. 1000–1004 auth; 1100–1103 account or balance; 1200–1203 parameters; 1300 and 1301 policy or safety; 1302 and 1303 rate or concurrency; 5000–5002 server. |
| Callbacks | Optional and signed (`webhook-signature: v1,` HMAC-SHA256 with a `whsec_` secret). Not used yet. |

## Kling 3.0 text to video (`POST /text-to-video/kling-3.0`)

**Settings:**
- `prompt`: up to 3072 characters, 2500 recommended
- `settings.resolution`: `720p`, `1080p` or `4k`
- `settings.aspect_ratio`: `16:9`, `9:16` or `1:1`
- `settings.duration`: 3–15 seconds
- `settings.audio`: `native` or `off` (default `off`)
- `settings.multi_shot`: default `true`, so Whoush sends `false` for one continuous shot
- `options.watermark_info.enabled`: default `false`

**Unsupported in this design:** `negative_prompt`, `cfg_scale` and `camera_control`. Camera control exists only in the legacy `/v1/videos/text2video`.

## Prices (USD list equivalents, per output second)

| Kling 3.0 | 720p | 1080p | 4k |
|---|---|---|---|
| No native audio | $0.084 | $0.112 | $0.42 |
| Native audio | $0.126 | $0.168 | $0.42 |
| Motion control | $0.126 | $0.168 | — |

Images: Kling Image 3.0 and 3.0 Omni cost $0.028 per image at 1K or 2K ($0.056 at 4K). Image endpoints exist only in the legacy design and are not integrated yet.
