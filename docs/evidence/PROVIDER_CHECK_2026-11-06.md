# Live provider check, 2026-11-06

Requested by the owner. One minimal generation per model through the app's own adapters (`RoutingMediaProvider`, `dev_live` mode), prompt `a ceramic cup of tea on a wooden table, soft daylight`, shortest catalog duration for video, no aspect ratio set. Each model was run at most once. Outputs were written to a temp media dir (`WHOUSH_MEDIA_DIR`), not the repo's `.media`. No key or `.env.local` content is recorded here.

Command (two invocations, run in parallel):

```
node --conditions=react-server --import tsx scripts/provider-check.ts nano-banana-pro-2k nano-banana-2-1 nano-banana-2 seedream-5-pro-2k seedream-5-lite soul-image
node --conditions=react-server --import tsx scripts/provider-check.ts seedance-2-0-mini-720p-5s seedance-2-5-5s kling-4-0-5s kling-3-0-720p-5s
```

| Model | Provider | Result | Seconds |
|---|---|---|---|
| nano-banana-pro-2k | google | ok, 1 image | 24.0 |
| nano-banana-2-1 | google | ok, 1 image | 15.0 |
| nano-banana-2 | google | ok, 1 image | 12.0 |
| seedream-5-pro-2k | byteplus | ok, 1 image | 51.0 |
| seedream-5-lite | byteplus | error: `404 ModelNotOpen` | 3.0 |
| soul-image | higgsfield | ok, 1 image | 18.2 |
| seedance-2-0-mini-720p-5s | byteplus | error: `404 ModelNotOpen` | 0.8 |
| seedance-2-0-720p-5s | byteplus | not run (same path/provider as the mini variant, which answered ModelNotOpen) | - |
| seedance-2-0-720p-10s | byteplus | not run, same path as 5 s variant | - |
| seedance-2-5-5s | higgsfield | ok, 1 video | 85.5 |
| seedance-2-5-10s | higgsfield | not run, same path as 5 s variant | - |
| kling-4-0-5s | higgsfield | not submitted: app gate blocker `model_unverified` | 0 |
| kling-3-0-720p-5s | kling | skipped: no key | 0 |
| kling-3-0-720p-10s | kling | skipped: no key (same path as 5 s) | 0 |

## Exact errors

- `seedance-2-0-mini-720p-5s` (BytePlus): `BytePlusHttpError 404 ModelNotOpen` ("BytePlus request failed: 404 ModelNotOpen"). Returned on submit, so the model is not activated for this account.
- `seedream-5-lite` (BytePlus): `BytePlus request failed: 404 ModelNotOpen`; the adapter then reports the run as failed.
- `kling-4-0-5s` (Higgsfield): never sent. The app's own gate (`devGenerationGate`) returned `model_unverified`: the catalog entry has no `verifiedApiPath` and unverified capabilities, so no documented path exists to call.
- Kling direct: `KLING_API_KEY` not set.

## Spend

Higgsfield credits used: unknown (the responses carry no balance/cost field the adapter reads); one soul-image and one 5 s seedance-2-5 run. Google and BytePlus cost: unknown (billed per account).
