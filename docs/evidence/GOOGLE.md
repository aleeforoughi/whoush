# Google Gemini API (Nano Banana images, Omni video): API evidence

**Read 2026-11-05 by a lead-assigned reader, read-only.** Nothing was signed in to, no key was used and no generation was called. Raw pages are kept in the lead's scratchpad.

`ai.google.dev` now redirects to `aistudio.google.com/docs/…`, and appending `.md` returns raw Markdown.

## Blocking findings (owner and counsel)

1. **Region.** Iran is **not** in the available-regions list (`https://aistudio.google.com/docs/available-regions.md`). The Additional Terms (effective 2026-03-23) say: "You may only access the Services (or make API Clients available to users) within an available region."
2. **Age.** "You must be 18 years of age or older… [and] will not use the Services as part of a website, application, or other service… directed towards or… likely to be accessed by individuals under the age of 18." Whoush must enforce adult users for this provider.
3. **No idempotency.** There is no idempotency key or client request id anywhere. A resend after an unclear outcome can bill twice, so Whoush never resends to Google automatically.
4. **Veo is shut down in this API.** `veo-3.1-*-preview` ended 2026-10-22, and Veo 3.0 and 2.0 ended 2026-06-30. GA Veo 3.1 (`veo-3.1-generate-001` and the fast and lite variants) is offered only on the Gemini Enterprise Agent Platform: a separate Cloud account and terms, region `us-central1`, and provisioned or fixed quota only. **Not integrated.** The video model in this API is `gemini-omni-1.2-flash`.
5. **Data.** Google keeps prompts and outputs for 55 days for abuse monitoring, with possible human review. Paid-tier content is not used to improve products.

## Transport

| | |
|---|---|
| Endpoint | `POST https://generativelanguage.googleapis.com/v1beta/interactions`, with the model in the body. The legacy `models/{model}:generateContent` is still supported, but Whoush uses the documented default. |
| Auth | Header `x-goog-api-key: <key>`. Never `?key=` in the URL: it ends up in logs. |
| Version header | Image examples send `Api-Revision: 2026-05-20`. Whether it is required is not stated; Whoush sends it for images. |
| Result | Synchronous. Images come back as base64 in `steps[]` (the step with `type:"model_output"`), in `content[]` blocks of `{"type":"image","mime_type":…,"data":<base64>}`. |
| Status | `in_progress`, `requires_action`, `completed`, `failed`, `cancelled`, `incomplete`, `requires_continuation` |
| Errors | `{"error":{"code":"<snake_case>","message"}}`. 400 `invalid_request`; 401; 402 `payment_required` (don't retry); 403; 404 `model_not_found`; 429 rate or quota (back off); 500 and 503 (retry); 504. Blocked: `safety`, `image_safety`, `image_prohibited_content`, `prohibited_content`, `no_image` and others. |
| Watermark | Every image carries a SynthID watermark. |

## Image models (paid tier, USD per image, Standard)

| Name | `model` id | Sizes | Ratios | Price |
|---|---|---|---|---|
| Nano Banana 2.1 | `gemini-nano-banana-2.1` | `1K` (default), `2K`, `4K` | 14 | $0.0336 at 1K, $0.0504 at 2K, $0.113 at 4K |
| Nano Banana 2 | `gemini-3.1-flash-image` | `512`, `1K`, `2K`, `4K` | 14 | $0.067 at 1K, $0.101 at 2K, $0.151 at 4K |
| Nano Banana Pro | `gemini-3-pro-image` | `1K`, `2K`, `4K` | 10 (1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9) | $0.134 at 1K or 2K, $0.24 at 4K |
| Nano Banana 2 Lite | `gemini-3.1-flash-lite-image` | `1K` | 10 listed | $0.0336 |

**Ratios.**
- The 14 ratios for Nano Banana 2 and 2.1 are 1:1, 1:4, 1:8, 2:3, 3:2, 3:4, 4:1, 4:3, 4:5, 5:4, 8:1, 9:16, 16:9 and 21:9.
- Without `aspect_ratio`, the output follows the input image, otherwise 1:1.
- `image_size` needs an uppercase K.

**Billing.** Billing is token-based: input and thinking tokens are billed on top. For Nano Banana 2.1 at 4K, the docs give two different token counts (2520 and 3780). Bill from the measured `usage`, not the table.

**Image request:**
```json
{"model":"gemini-nano-banana-2.1","input":"…","response_format":{"type":"image","aspect_ratio":"16:9","image_size":"2K"}}
```

**Editing and references.** Put typed blocks in `input`:
```json
[{"type":"text","text":"…"},{"type":"image","mime_type":"image/png","data":"<base64>"}]
```
- Accepted types are png, jpeg, webp, heic, heif, gif, bmp and tiff.
- Use the Files API above 100 MB total.
- Up to 14 references (4 characters and 10 objects) on Nano Banana 2 and 2.1.

**Other settings.**
- `generation_config.seed` is accepted. Its effect on image models is not stated.
- `generation_config.thinking_level`: minimal, medium or high on 2.1. Thinking is always on for Pro.
- `safety_settings` are available, but "less restrictive" settings may need Google's review.

## Omni video (`gemini-omni-1.2-flash`, GA 2026-11-05)

**Request:** the same endpoint, with `"response_format":{"type":"video","aspect_ratio":"16:9|9:16","resolution":"360p|720p|1080p|4k","duration":"3s".."15s","delivery":"inline|uri"}`.

**Behavior:**
- Native audio is always on.
- First frame, first and last frame (3–10 s), up to 6 reference images, edits and extensions are supported.
- There is no negative prompt and no stated seed.
- Over 4 MB (above 720p) use `delivery:"uri"`, then poll and download through the Files API (files expire after 48 hours).

**Price:** $12 per M video output tokens, about $0.07 per second at 720p and $0.104 at 1080p, plus input tokens.

**Rate limits:**
- Tier 1 allows 8 requests per minute and 40 per day.
- Limits apply per project, with a spend cap of $10 per rolling 10 minutes on Tier 1.

**Not integrated yet:** it is synchronous with long renders and its name carries an assistant brand. See `docs/PROVIDERS.md`.

## Live check, 2026-11-06 (owner's key, dev-live)

- **The key is valid.** A free `GET /v1beta/models` returned 200. `gemini-3-pro-image`, `gemini-3.1-flash-image` and `gemini-nano-banana-2.1` are all listed.
- **No image could be made.** Two in-app submits of `nano-banana-2-1`, then one direct call, all returned HTTP 429 `too_many_requests`: "limit: 0 requests per day on Free Tier".
- **The fix is the owner's:** turn on billing for the key's Google project (a paid tier). Nothing was billed.
- **The adapter now logs Google's error reason** to the server log. It never logs the prompt or the key.
