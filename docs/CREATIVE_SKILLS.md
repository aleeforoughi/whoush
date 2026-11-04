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

**What is sent** with the request: per file an id, kind, mime, size, sha256, optional pixel size or duration, a role (`reference` or `context`), audio speech details (has speech, language, accent) and, for Markdown and JSON only, a text excerpt of up to 8000 characters. **What is not sent:** file bytes and file names (the schema rejects a `name`). Files stay in browser memory for the session; nothing is stored or uploaded.

**How the server uses them.** Excerpts are run through the safety preflight like the prompt (a blocked excerpt restricts the turn before any planner runs). They reach the private planner only inside `<attachment>` blocks within `<user_brief>`, with forged tags stripped, and the skill instructions mark them as untrusted data. Audio attachments feed the same flags as the legacy `audio` field, so Persian speech on a lip-sync video activates the Tehrani accent skill exactly as before. The private audit keeps only `{kind, bytes, sha256}`.

**Fail closed.** No image, video or audio inspector exists yet (`docs/MODERATION_POLICY.md` steps 4 and 6). Any such attachment makes the turn return the plan with `no_compatible_model` (HTTP 422), no proposal and no price, and the audit reason `media_review_unavailable`. Reference-role images already count toward the router's `referenceImages` requirement for when that check is lifted.

**PDF.** PDFs are accepted and counted, but their text is not extracted (no parser dependency yet); the plan states that the PDF has no effect.
