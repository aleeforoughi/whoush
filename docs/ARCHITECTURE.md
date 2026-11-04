# Architecture | Whoush
## Product principle
The dollar controls how many Neurons users buy. The *versioned media model catalog* controls how many whole Neurons they spend.

## Runway-inspired interface, original implementation
Three-zone workspace:
1. Left: brand, new chat, navigation, recent work, balance/account.
2. Center: Generations / Cuts, asset viewport, version thumbnails, progress states.
3. Right: Persian creative agent, reference grid, messages, one-or-many media-model suggestion action cards, cost and approval, composer.
On mobile transition to tabbed focus views with persisted conversation state. Visual tokens are approximate reference samples, not Runway proprietary values.

## Professional skills and Iran-specific safety
`lib/skills.ts` defines 15 immutable/versioned professional instruction modules. `lib/llm.ts#preparePrivateCreativeRequest` is the intended single gateway for real private creative LLM calls. Always active: prompt engineering, art direction, Persian language, QA. Photography is mandatory for image, cinematography/videography mandatory for video, specialized editing/culture/social/graphic/copy/audio/geography when relevant.
`lib/safety.ts` is an initial lexical prefilter; it blocks explicit politics, politicians, nudity and obvious sexualized posing, and routes ambiguous Iranian terms to review. It is **not** production-grade and cannot inspect media. The live pipeline must add context-aware Persian semantic moderation, media analysis, final prompt screening, pre-submission rechecks and output moderation with human review and appeals.
Read `docs/CREATIVE_SKILLS.md` and `docs/MODERATION_POLICY.md`. Zero political content is a Whoush product choice, not a prediction that the platform cannot be filtered.

## Data flow
User prompt and attached asset IDs
→ validate user/session/reference ownership and region/provider eligibility
→ private (invisible) LLM model router based on complexity and cost budget
→ typed intent compiler (hard constraints / soft preferences / requested media model)
→ reference registry and session memory
→ media capability filtering and recommendation
→ fixed Neuron SKU price and immutable quote
→ ask-before-generating (or explicitly budget-scoped auto policy)
→ wallet reservation in serializable DB transaction
→ durable queue and Higgsfield submit (server-only)
→ status polling/webhook verification + output persistence
→ completed/failed/cancelled ledger settlement
→ asset lineage and feedback, follow-up chat iteration.

## Public vs private model routing
Private: LLM vendor, model ID, usage and cost, prompt/context routing rationale in privileged audit logs.
Public: creative guidance, output recommendation rationale, supported media model name/options, whole-Neuron price, execution status and results. No provider/model selection for reasoning agent.
Default private router: fast for short simple prompts, balanced for multi-reference/normal tasks, deep for complex scene plans or strict identity/motion locks. Use escalation only on clearly failed plan validation or complex task.
Do not use a single cheap LLM for consent, billing, policy or security. Deterministic code handles approvals/billing; LLM output is untrusted.

## Media model selection
Hard gates: API availability; provider and end-user policy; supported task, resolution, ratio, duration, reference types, input consent; budget; exact supplied media model if compatible.
Only then rank eligible candidates by quality/cost/speed preference and task characteristics. Show best recommendation and alternatives with human-readable explanation. If user specified model, honor if eligible; otherwise explain why unavailable and present options.
The media *model* and reasoning LLM are separate systems.

## Neuron accounting
Generation SKU = integer constant for exact model+configuration+catalog version. No FX-based user-side SKU repricing. Package=round-toman cash amount with FX-dependent integer Neuron total and bonus gift; existing purchased balance never changes.
LLM calls are an internal cost of fulfillment, not user-facing itemized messages.
All purchases/quotes/jobs/charges are versioned and audit logged, and use idempotency keys.
Do not expose dollar value of Neuron or provider wholesale costs to end users.

## Provider interfaces
`lib/higgsfield.ts` is server-only and intentionally disconnected from public consumer API. Use `https://api.higgsfield.ai`, authorization `Key <complete credential>`, submit media model-specific path, poll `/requests/{id}/status`, cancel by server POST when supported. Discover exact model path and schema from verified model docs. Ensure cancellation not confused with stopping polling.
Private planner routing (task profile, bands, escalation, two provider adapters) is described in `docs/LLM_ROUTING.md`. Live calls stay behind `llmGate` plus per-provider keys.

## Deployment boundaries
Domestic web frontend/cache can operate with a supported backend where allowed; international model calls are only available to end users permitted under provider policies. Independent hosting does NOT legalize prohibited end-user access. Never route through intermediaries to bypass a ban.
Use self-hosted fonts and static assets where possible. Keep application secrets in managed environment, not Git.

## Projects and assets
Phase P6. There are no accounts and no server storage yet (plan phase 02), so projects and assets live **only in the browser that made them**, in IndexedDB. The UI says so («پروژه‌ها و فایل‌ها فقط در همین مرورگر ذخیره می‌شوند»); nothing implies sync or cloud backup. The demo produces no media, so Assets lists uploaded files only; generated outputs will appear once real generation is enabled and mirrored to owned storage (docs/LAUNCH_GATES.md, gate 8). File names stay local and are never sent to the server.

**Data model** (`lib/projects.ts`, pure and unit-tested). `Project`: id (uuid), title (1..80), `titleSource` (`auto`|`user`), timestamps, `version: 1`, up to 500 `StoredMessage`s, `tagCounters` (the attachment tag allocator state), the build mode, the style and an optional `characterRef`. A message keeps what is needed to show a past turn read-only: a proposal snapshot (model name, fixed Neurons, public plan), the no-model message and plan, the restricted notice, the final job state. `StoredAsset`: the attachment's metadata, its `projectId`, the local file name and the file's `Blob` (absent when the browser had no room). `validateProject` rejects anything the app could not have written; invalid stored records are skipped, never rendered.

**Storage** (`lib/project-store.ts`). Database `whoush-local-projects` v1: store `projects` (key `id`) and store `assets` (key `id`, index `projectId`). Deleting a project deletes its assets in the same transaction. A `QuotaExceededError` on a file stores its details without the bytes and tells the person («فضای ذخیره‌سازی مرورگر پر است…»). Without IndexedDB the studio keeps working in memory with a notice. Saves, renames and deletes notify the rail and the Assets page (a window event plus a `BroadcastChannel` for other tabs).

**Lifecycle.**
- *Lazy creation.* «گفت‌وگوی جدید» starts an unsaved draft. The project is created by the first turn that gets an answer (proposal, no compatible model, or a restriction notice), titled by `autoTitle` (mentions removed, at most 40 characters). So there are never empty projects. A failed request creates nothing. The URL becomes `/studio?project=<id>` (`?character=` keeps working beside it).
- *Saving.* After each turn and on setting changes the project is saved (debounced 400 ms; also when the page is hidden or the studio unmounts), and files sent in a message are stored with their bytes. A rename made in the rail wins over the open conversation's in-memory title. A project deleted elsewhere is never resurrected by a late save.
- *Switching.* The URL is the source of truth. Opening a project saves the current one first, then restores the transcript (past proposals are read-only: «این پیشنهاد مربوط به قبل است؛ برای تولید دوباره بفرست», since quotes expire), the tag counters (numbering continues and is never reused), mode and style (a project's own values override the remembered ones while it is open), the character (re-validated with `characterUsability`) and the files (object URLs rebuilt from the stored blobs, revoked on switch). An unknown id gives a notice and a fresh draft. With no `?project=` the studio always opens a fresh draft rather than the latest project; the rail is the way back (like Runway).
- *Deletion.* The rail's «حذف» (after a confirmation) removes the project and its files from this browser. Deleting the open project returns to a fresh draft.

**Assets page and viewer** (`components/assets-gallery.tsx`, `components/media-viewer.tsx`, `lib/viewer.ts`). Cards are media-first (a 4:5 media area with the tag, download/share buttons and duration laid over it; 1 column below 480px, 2 from 480px, 3 from `lg`, 4 from `2xl`). Opening a card, or any image or video thumbnail in the studio, opens the full-screen `MediaViewer` (a Base UI dialog styled with tokens, not a modal card) over the filtered list on /assets and over the conversation's attachments in the studio; it replaced the old preview dialogs. The object URLs belong to the page that renders it (the assets page revokes its URLs with each reload; the studio revokes its own); the viewer only makes and revokes a URL itself when it is given a blob without one. Stepping, key and swipe rules are pure functions in `lib/viewer.ts` with unit tests. Details and the full-screen radius exception: docs/DESIGN_SYSTEM.md.

**Sharing and download** (`lib/share.ts`, `components/share-actions.tsx`). Device-side only. Whoush has no social-network API integration, no OAuth, no network upload and never posts on the user's behalf. «دانلود» saves the stored file under a local name (`whoush-<project>-تصویر-۱.png`). «اشتراک‌گذاری» uses the Web Share API with the file (the OS share sheet, where Instagram appears when it is installed); where the browser cannot share files (most desktop browsers) a dialog offers the download, the manual steps and an «باز کردن اینستاگرام» link to `https://www.instagram.com/`. The story, post and reel buttons only share or download the file and show the steps; they carry a fit hint from the file's aspect ratio (9:16, 4:5, 1:1, 1.91:1, within 3%) and, for video, Reels' 90 second length. The optional caption is copied to the clipboard and never auto-filled. Generated outputs show the buttons disabled until outputs are mirrored to owned storage; the provider's URL is never fetched or shown for sharing.
*Evidence for not deep-linking from the web.* Meta's «Sharing to Stories» documentation (https://developers.facebook.com/docs/instagram-platform/sharing-to-stories, read 2026-11-04) describes the official Stories share only for native apps: on iOS the `instagram-stories://share?source_application=<FB App ID>` scheme with the media on the pasteboard, on Android the `com.instagram.share.ADD_TO_STORY` intent with a content URI, both needing a Facebook App ID. It documents no mobile-web path and no scheme for feed posts or Reels, so the web app uses no `instagram-stories://` or other unofficial `instagram://` links. A future native Whoush iOS/Android app could use the official Stories share with a Facebook App ID.

**Migration to server storage (after authentication).** The records already have stable ids, versions and per-file SHA-256, so a signed-in client can upload each project and its assets once, keyed by the same ids, and then treat the server as the source of truth with IndexedDB as an offline cache. The upload needs explicit consent, the server-side checks of the other phases (moderation of stored media, quotas) and a retention and deletion policy; none of that exists yet.
