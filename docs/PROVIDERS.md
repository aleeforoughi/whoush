# Media providers

**Owner decision, 2026-11-05:** image and video generation use approved **direct** provider APIs (Google, ByteDance through BytePlus, Kling) plus Higgsfield. No resellers, middle platforms or proxies. Recorded in `CLAUDE.md`.

API facts for each provider are in `docs/evidence/` and must be read from the provider's own documentation before any model is added.

| Provider | Credentials (in `.env.local` only) | Adapter | Evidence |
|---|---|---|---|
| Higgsfield | `HIGGSFIELD_API_KEY` | `lib/media-provider.ts` (`HiggsfieldMediaProvider`) | `docs/HIGGSFIELD_EVIDENCE.md`, `docs/HIGGSFIELD_MODELS.md` |
| Google (Gemini API) | `GEMINI_API_KEY` | `lib/providers/google.ts` | `docs/evidence/GOOGLE.md` |
| ByteDance (BytePlus ModelArk) | `BYTEPLUS_API_KEY` | `lib/providers/byteplus.ts` | `docs/evidence/BYTEPLUS.md` |
| Kling | `KLING_API_KEY` | `lib/providers/kling.ts` | `docs/evidence/KLING.md` |

## How it works

- **Routing.** Each catalog model names its `provider`, plus its private `providerModel` and the `providerParams` its SKU fixes. `RoutingMediaProvider` sends a job to that provider's adapter and tags the request id (`google:…`, `byteplus:…`, `kling:…`), so status checks return to the same API.
- **Synchronous providers** (Google, and BytePlus images) run in the background (`lib/providers/sync-runner.ts`); the job polls them like any other. This is development only: production needs the durable queue.
- **Outputs are copied into Whoush's own store** (`lib/media-store.ts`, served at `/api/generation/media/<id>`). Google returns raw bytes, and BytePlus links expire after 24 hours. Live generation also requires `OWNED_MEDIA_STORAGE_VERIFIED` (gate 8).
- **Resending after an unclear send** is safe only where a provider honors an idempotency key:

  | Provider | Resend after an unclear outcome |
  |---|---|
  | Higgsfield | `Idempotency-Key` header |
  | Kling | Looks up `external_task_id` before creating |
  | Google, BytePlus | Never resent (no idempotency); the job waits for the owner |

## Models added 2026-11-05 (catalog version `2026-11-05.1`)

All are generation only (no reference images yet), with audio off and the price formula of 2026-11-04: `ceil((provider list USD + $0.05 planner allowance) / $0.128)`.

| Model id | Provider model | Provider list price | Neurons |
|---|---|---|---|
| `nano-banana-pro-2k` | Google `gemini-3-pro-image`, 2K | $0.134 | 2 |
| `nano-banana-2` | Google `gemini-3.1-flash-image`, 1K | $0.067 | 1 |
| `nano-banana-2-1` | Google `gemini-nano-banana-2.1`, 1K | $0.0336 | 1 |
| `seedream-5-pro-2k` | BytePlus `dola-seedream-5-0-pro-260628`, about 2048×2048 | $0.09 | 2 |
| `seedream-5-lite` | BytePlus `seedream-5-0-260128`, about 2048×2048 | $0.035 | 1 |
| `seedance-2-0-720p-5s` | BytePlus `dreamina-seedance-2-0-260128` | ≈ $0.76 | 7 |
| `seedance-2-0-720p-10s` | the same model, 10 s | ≈ $1.51 | 13 |
| `seedance-2-0-mini-720p-5s` | BytePlus `dreamina-seedance-2-0-mini-260615` | ≈ $0.38 | 4 |
| `kling-3-0-720p-5s` | Kling `/text-to-video/kling-3.0`, 720p, no audio | $0.42 | 4 |
| `kling-3-0-720p-10s` | the same, 10 s | $0.84 | 7 |

**Approved by the owner on 2026-11-06** as listed. The margin is thin: for example, about 11% on Seedance.

## Open owner decisions

1. **BytePlus watermark.** Seedream adds a visible "AI-generated" mark by default, and it is kept. Turning it off is the owner's choice under BytePlus's labeling rules.
2. **Written permissions before any customer use:**
   - BytePlus: reselling video (Service-Specific Terms §4.2) and the SaaS resale clause (§6.2)
   - Kling: "own use only" (§10.3)
   - Google: available regions only, and 18+ users only
   - Iran is not in the Google or BytePlus region lists. Kling's main terms page could not be read.
3. **Not integrated yet:**
   - Google Omni video: synchronous long renders, and its name carries an assistant brand
   - Veo: only on Google's separate Cloud platform now
   - Kling 4.0: not yet open
   - Kling images: legacy API
   - Reference and edit inputs for every provider: they need the stored user uploads
