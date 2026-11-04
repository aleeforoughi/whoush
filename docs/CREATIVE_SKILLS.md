# Whoush Professional Creative Skills v1.1.0

**Status (P2):** all 22 skills (15 base in `lib/skills.ts` + 7 in `lib/advanced-skills.ts`) now drive a private, typed orchestration layer used by `/api/agent`: `lib/orchestrator.ts` (safety -> `preparePrivateCreativeRequest` -> planner -> invariants -> plan inspection -> proposal), `lib/creative-plan.ts` (zod contracts, public projection), `lib/private-audit.ts` (hash-only audit) and `lib/llm-anthropic.ts` (live adapter). Live planning is off by default and fail-closed (`llmPolicy` in `lib/llm.ts`: needs `LLM_PROVIDER_AUTHORIZED=true`, `ALLOW_LIVE_LLM=true`, a configured `claude-*` model id and key); otherwise a deterministic, no-network planner is used. Camera/shot fields are proposed creative direction, not EXIF or verified provider controls. The registry version is `SKILL_REGISTRY_VERSION` in `lib/skills.ts`.
Owner requirements: permanent knowledge modules for auto-routed *private* LLMs; all creative output belongs to Higgsfield media models, never to the reasoning LLM. Users do not choose or see reasoning model names.
Skills source of truth: `lib/skills.ts`. Safety: `lib/safety.ts`, `docs/MODERATION_POLICY.md`.
This is a reusable skill instruction library, not retrained model weights or a searchable retrieval database. The latter must be implemented separately for reference-heavy knowledge and trends.

## Mandatory foundation on every creative turn
- `prompt_engineer`: structure intent, preserve hard/soft constraints, optimize prompts for capabilities.
- `creative_director`: coherent art direction, creative consistency, audience fit.
- `persian_language`: accurate Persian reading/writing, dialect and register, RTL and bilingual text. Listening/speaking only when actual supported audio inputs and outputs exist.
- `qa`: pre-plan and post-generation checks; no claiming actual quality without inspecting rendered assets.

## Conditional routing (all selected automatically)
| Trigger | Skill IDs | Concrete contribution |
|---|---|---|
| Any new image | `photographer` | Camera/lens distance, f-stop, shutter, ISO, WB, DOF, framing, light ratios and direction, shadows, realistic textures |
| Any video | `cinematographer`, `videographer` | Camera path, shot size, lens, motion, shutter angle/FPS target, lighting continuity, physical realism and duration |
| Image edit or local replacement | `photo_editor` | Masks, localized retouch, shadow consistency, preserve original face/body/framing/color except edits requested |
| Video edit, trim, masks | `video_editor` | Preserve FPS, PTS, cut timing, original motion/audio, edges, transparency, blur and grade |
| Audio reference or sound brief | `audiographer` | Sound direction, audio sync, ambiance, capture technique. No unapproved audio generation |
| Logo, poster, banner, typography | `visual_designer` | Grids, typographic hierarchy, Persian font suitability, color harmony, text QA |
| Tagline, caption, copy | `creative_copywriter` | Advertising hook, authentic local slang, proofread Farsi, brand tone |
| Instagram, TikTok, X, Reels, trends | `social_media` | Platform formats, hooks, captions, safe areas; current trend claims require dated verified data |
| Iranian customs, everyday life, heritage | `iranian_culture` | Specific, respectful culture, modern/traditional trends and imagery |
| Named Iran places, poetry, dialects, nonpolitical celebrities | `iranian_geography` | Landmark details, real city context, local phrases, attribution, culturally plausible looks |

## Always-on photography rule
If user asks for a NEW still image, the internal planning prompt must provide a proposed:
- camera/look and lens focal length; camera distance and perspective;
- f-stop/aperture, shutter speed, ISO, white balance, focal plane, depth of field;
- framing, subject placement, aspect ratio and horizon;
- key, fill, back/rim and practical light directions, qualities, reflections/shadows;
- mood/color pipeline, subject realism and final output QA.
These are **creative directions**, not actual captured EXIF, and not guaranteed controllable knobs for Higgsfield. The agent maps controllable parameters only after checking the selected provider model's actual documented schema.

For INPUT image edit, preserving the source **overrides** invented photographic settings. Do not rewrite original lighting, camera geometry, face, hair, pose or motion without explicit consent.

## Always-on video rule
Any video task gets cinematography and videography. Establish shot scale, lens character, movement trajectory, motivated blocking, exposure, WB, target FPS/shutter, blur, duration, cuts, source references and color continuity. If editing video, use additional video-editor skill and protect source PTS/FPS, audio, camera, framing and foreground edges as requested.

## Source of truth / trend retrieval
Do not treat static training as live Instagram/TikTok/X trends. The social skill may request a licensed retrieval connector/search with timestamps; if none available, present evergreen platform conventions without saying they are current. Validate geography, idioms, translations, poem sources and celebrity/nonpolitical identity references. Respect artist rights and consent.

## Quality gates
- Before LLM: safety decision, account/media eligibility, model budget, reference ownership. Reject blocked and hold for review on ambiguous.
- Before generation: typed action and explicit supported media model, exact input IDs, source locks, whole-Neuron SKU, user quote approval.
- After generation: objective metadata checks, relevant visual QA, text verification, user acceptance.
- Retain skill registry version and selected IDs **privately** per job for QA and reproducibility. Do not expose LLM vendor/provider or internal token pricing.

## Efficient LLM use
Haiku-tier private reasoning for brief triage / simple tool classification, Sonnet-tier for everyday creative planning, Opus-tier for complex identity/temporal plans and multi-shot creative direction, with private configurable routing based on budget and capability. These are suggestions for *reasoning tier* not hard-coded public provider product names. Do not use expensive multi-agent debate per prompt. Escalate only based on uncertainty or validation failure; deterministic systems own payment, moderation hard rules and authorization.

## Test fixtures
Use `tests/skills-safety.test.ts` and expand with 100+ representative Persian prompts, including spelling variants, slang, ambiguous words, code-switching, fashion, local traditions, photography, masking, celebrity names and culturally specific references. Unit tests check instruction activation; separately evaluate live LLM planning outputs against camera/cultural/technical rubrics before launch.

## Plan language
Customer-visible plan fields (summary, constraints, camera/shot descriptions, continuity, identity lock lists, speech notes, QA checklist) are natural Persian in both the deterministic planner and the live planner instructions. `mediaPrompt` and `negative` are provider-facing, private and English.

## Attachments
Users can attach files to a chat message (`lib/attachments.ts`, `lib/attachment-files.ts`, `components/attachment-tray.tsx`). Limits: 10 files and 200 MB per message; image 20 MB (JPEG, PNG, WebP), video 100 MB (MP4, MOV, WebM), audio 25 MB (MP3, WAV, M4A, OGG, WebM), PDF 20 MB, JSON 1 MB, Markdown 1 MB.

**Verification.** The browser decides what a file is from its leading bytes (magic numbers), never from its name or declared type. A declared type or extension that disagrees with the bytes, SVG, HTML, executables and empty files are rejected with a Persian reason. JSON and Markdown must be valid UTF-8, and JSON must parse. The server re-validates the metadata with a strict schema (`AttachmentSchema` in `lib/creative-plan.ts`), but it never sees the bytes, so the byte check is a user-experience and consistency gate, not a security boundary.

**Tags and mentions.** Every attachment gets a stable tag for the conversation. Internally (wire, schema, audit, the live planner's `<attachment tag="image1" …>` blocks) it stays English: `image1…` (images), `video1…`, `audio1…`, `file1…` (PDF, JSON, Markdown); the wire pattern is `/^(image|video|audio|file)[1-9]\d?$/` (1 to 99 per prefix). Users always see and type the Persian form with a `#` prefix and Persian digits (`displayTag`):

| Kind | Internal tag | Shown and inserted |
|---|---|---|
| image | `image1` | `#تصویر۱` |
| video | `video1` | `#ویدیو۱` |
| audio | `audio1` | `#صدا۱` |
| pdf, json, md | `file1` | `#فایل۱` |

Numbers only count up (`allocateTag`), are never reused after a removal, and "new chat" starts again. The schema requires the prefix to match the kind and the tags of a request to be unique.

Parsing (`parseMentions`, `splitMentions`, `rewriteMentions`) is case and script tolerant: the prefix is `#` or `@`; the word is تصویر, ویدیو (or ویدئو), صدا, فایل or the legacy English `image|video|audio|file`; the number is 1 to 99 in Persian, Arabic-Indic or ASCII digits. Arabic ي/ى and ك are read as ی and ک, and ZWNJ or tatweel inside the token is ignored. A mention must start the text or follow whitespace or punctuation, and must not be followed by a letter or digit, so `#تصویر۱،`, `#صدا1` and `@image1` match, while `#نوروز`, `email@image1.com`, `#تصویر۱۲۳` and `#تصویر۰` do not. Every accepted spelling names the same internal tag.

In the composer, chips show the tag as `#تصویر۱` (click it to insert it at the caret). Typing `#` (or `@`) at the start of the text or after whitespace opens a combobox of every attachment still in the conversation (this message's tray plus earlier sent ones); it filters by the Persian or English word with either digit set (`#تص`, `#صدا`, `#im`), and choosing an option writes the canonical `#تصویر۱ `. An ordinary hashtag such as `#نوروز` is not the start of any tag word, so the list closes (`mentionTrigger`). In a sent message each mention is a Badge showing the Persian tag, and a tag that names an attachment opens its preview (image, video) or details. Per-chip errors, aria-labels, the plan «مراجع» list (formatted on the client from the public `references[].tag`) and the missing-mention question all use the Persian form. The request carries this message's new attachments plus any earlier sent attachment mentioned in the text in any accepted spelling (the same wire metadata and excerpt as when it was first sent, never bytes), within the 10 file and 200 MB limits. A mentioned tag with no attachment never blocks: the plan gets a Persian `clarifyingQuestionFa` such as «پیوست #تصویر۳ در این گفت‌وگو پیدا نشد؛ …». In the English `mediaPrompt` each mention, however it was typed, becomes a description such as `[reference image 1 · character]` or `[motion reference video 1]`; the public Persian text keeps what the user typed, and the role lines in the plan name the attachment as `#تصویر۱`.

**Roles.** Image, video and audio have NO default role: send is blocked, with a per-chip Persian error, until each has one. Files have no role. The wire uses the English id; the UI uses the Persian label.

| Kind | Role id | Persian label | Effect |
|---|---|---|---|
| image | `character` | کاراکتر | `character_creation` (+ `anti_drift`, always on); hard constraint to keep face identity, hair, skin tone and body proportions; +1 reference image |
| image | `environment` | محیط | continuity locks for place, architecture, light direction and time of day; culture and geography skills only when the text triggers them; +1 reference image |
| image | `object` | اشیا | hard constraint for shape, material, color, proportions and logo placement; +1 reference image |
| image | `graphic` | گرافیک | `visual_designer`; hard constraint to use the graphic, logo or text without distortion, recolor or retyping; +1 reference image |
| image | `edit_reference` | مرجع ادیت | task becomes `edit` (`photo_editor`); only the requested region changes, pixels, identity, framing and light are preserved; +1 reference image |
| video | `motion_reference` | الگوی حرکت | output is a video; hard constraint to follow path, speed, timing and blocking but not the reference's appearance; requirement `motionReference` |
| video | `edit_reference` | مرجع ادیت | output is a video, task `edit` (`video_editor`); preserve FPS, frame count, cuts, audio, framing and grade except the requested change; requirement `videoReference` |
| audio | `lip_sync` | الگوی حرکت لب | output is a video; implies speech; the language and accent controls exist only for this role (language defaults to «نامشخص», so the Tehrani skill never activates silently, only for Persian speech with no accent set, as before); `persian_lip_sync_phonetics`; requirement `lipSync` |
| audio | `music` | موسیقی | `audiographer`; soft preference that beat, tempo and structure guide cut rhythm and motion timing; no music is generated or altered; no lip sync |
| audio | `voice_clone` | کلون صدا | the chip needs the consent box «صاحب این صدا هستم یا اجازهٔ کتبی صاحب صدا را دارم» and the schema rejects it without `consent: true`; never supported (see below) |

If the text sounds like an image request but there is a video attachment, or an audio with `lip_sync`, the media kind is video (a comment in `orchestrateCreativeTurn` says why). Role constraints are enforced by the plan invariants: a planner that drops one gets it added back (audit correction `role_directives`). The public plan has `references: [{tag, kind, role, labelFa}]` (never ids, hashes or names), shown in plan details under «مراجع».

**What is sent** with the request: per file an id, tag, kind, mime, size, sha256, optional pixel size or duration, the role (media only), `consent: true` for `voice_clone`, the speech details (language, accent) for `lip_sync` only and, for Markdown and JSON only, a text excerpt of up to 8000 characters. **What is not sent:** file bytes and file names (the schema rejects a `name`). Files stay in browser memory for the session; nothing is stored or uploaded.

**How the server uses them.** Excerpts are run through the safety preflight like the prompt (a blocked excerpt restricts the turn before any planner runs). They reach the private planner only inside `<attachment>` blocks within `<user_brief>`, with forged tags stripped: media and PDFs as `<attachment tag="image1" kind="image" role="character"/>` (no content), Markdown and JSON with their excerpt. The skill instructions mark all of it as untrusted data, say that tags name the user's files and that roles are hard constraints. The private audit keeps only `{tag, role, kind, bytes, sha256}`.

**Order of outcomes.** (1) Safety on the text and excerpts. (2) Plan and plan inspection. (3) Any `voice_clone` attachment returns status `unsupported` with «کلون صدا در هووش پشتیبانی نمی‌شود؛ هووش فقط تصویر و ویدیو می‌سازد و تولید یا شبیه‌سازی صدا ممکن نیست.» (HTTP 422), audit reason `voice_clone_unsupported`, no price. (4) Else any image, video or audio attachment fails closed: the plan is returned with `no_compatible_model` (HTTP 422), no proposal and no price, audit reason `media_review_unavailable`, because no image, video or audio inspector exists yet (`docs/MODERATION_POLICY.md` steps 4 and 6). (5) Else the proposal; files-only turns stay `planned` with a price.

**Capability flags (unverified).** `motionReference` and `videoReference` are new model capabilities and requirements (`lib/catalog.ts`, `lib/router.ts`). No model has evidence for either, so every model records `false` and can never satisfy them; they are for when the media-review stop is lifted. Reference-image requirements already count every attached image.

**PDF.** PDFs are accepted and counted, but their text is not extracted (no parser dependency yet); the plan states that the PDF has no effect.
