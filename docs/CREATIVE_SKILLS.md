# Whoush Professional Creative Skills v1.0.0
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
