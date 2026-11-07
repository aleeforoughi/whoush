# Whoush Iran-oriented Creative Safety Policy v1.0
**Product policy, not an authoritative statement of Iranian law or a guarantee against filtering.** Current status: conservative development-level text preflight; not production-ready comprehensive moderation.

## Goal and intended audience
Persian-speaking users, Iranian influencers, modern/traditional cultural creators, local businesses and everyday content makers. Allow genuine nonpolitical Iranian landscapes, culture, cities, weddings, apparel, beauty, portraits, sports, advertising and accessible creative expression.

## Owner content rules (2026-11-06)
The same rules apply to chat text (`lib/safety.ts`) and to every uploaded photo (`lib/reference-inspect.ts`, checked right after upload). Code: `lib/safe-alternatives.ts`, tests: `tests/content-rules.test.ts`, `tests/upload-review.test.ts`.

**Refused:**
- Iranian political figures of any era or side.
- Iranian protests, human rights, executions, government, politics, opposition statements, «freedom» slogans, and anything sensitive for the Iranian government.
- Symbols and imagery of pre-revolution royal Iran: the Lion and Sun, and the Pahlavi crown and family.
- Nudity, pornography and sexual content.
- Alcohol.
- Drugs.
- Violence and blood.
- Sexualized minors.
- Famous people without their permission (photos).

**Allowed:**
- The official flag of Iran.
- Iranian culture, history (ancient Persia, Persepolis, the Pahlavi script), palaces as architecture, cities and landmarks (Azadi Tower), food, and anything positive and peaceful about Iran.
- Everyday photos of women in casual summer clothes.
- Beauty and fashion content: makeup, skincare, hair, nails, model poses, gowns and outfits. Colour names such as «nude», «wine red» and «champagne» are colours.

**Owner decision: non-Iranian political figures.** Political figures of other countries are allowed, by owner decision. This replaces the zero-tolerance line below and in `CLAUDE.md` for them. Generic political words (election, protest, government) stay refused for any country. Whoush's own reaction GIFs never show any politician.

**Whoush is the user's advocate.** Every refusal is kind and comes with safe ideas, one tap each. Each idea leaves the restricted subject out entirely and points somewhere safe. An idea never says how to keep the subject and pass a check.
- **Chat text:** for alcohol, the user's own scene comes back with tea, coffee or sherbet.
- **Photos:** a refused photo says why and how to replace it.

Refusals are only refusals: nothing about the user is reported, and the audit keeps a prompt hash, never the text.

1. **Politics / public political figures (zero tolerance)**: no political advocacy/opposition, campaigns, election graphics, public political figure likeness, speeches, protest imagery, party slogans, or political propaganda of any position. Enforce neutrally across perspectives. A political name or direct political request is blocked regardless of persuasion direction.
2. **Sexualized visual content**: no nudity, sexual display, overtly sensual/erotic poses or clearly revealing outfits (including lingerie and bikinis), sexualization of minors, or sexualized deepfakes. Normal everyday clothing and nonsexual fashion, sportswear, weddings and portrait photography are permitted.
3. **Explicit severe harms**: no sexual exploitation of minors, graphic dismemberment, explicit religious hostility or direct advertising of illicit/high-risk regulated activities. Add and validate further harms under provider policy before production.

**Historical figures (owner decision, 2026-11-06).** Rulers and public figures who lived before 1900 (for example Cyrus the Great, Darius, Ferdowsi, Hafez) may be depicted respectfully and historically, in their own era: a coronation, an entry into a city, a portrait in period dress. This is not an exception to rule 1:
- Modern figures stay fully blocked: anyone active in politics from the 20th century on, including the Pahlavi dynasty.
- A historical figure used for a present-day political message stays blocked: slogans, protest or opposition imagery, campaign or party material, "a message to today's rulers".
- Accuracy matters for identity-bearing subjects: Whoush researches the era and uses open-licensed references (docs/RESEARCH_PIPELINE.md), so it does not invent a likeness or mix eras.

## Contextual review (not automatic guilty verdict)
- Ambiguous historical dynastic terms or common names that might refer to a political person; e.g. “پهلوی”, “روحانی”. A nonpolitical architecture/history context can still be disallowed if explicitly depicting a political leader, but ordinary innocuous meaning should not be auto-banned.
- Profanity or Persian sensitive slang: infer intent (quoted dialogue, linguistic discussion, mild casual idiom, explicit abuse); avoid substring matching, ZWNJ/Arabic yeh-kaf drift or broad stop words.
- Alcohol, tobacco, gambling, religion in art/poetry, medically appropriate/body/fitness contexts, local tradition, politics-adjacent place names; distinguish promotion of regulated activity from legitimate art or context. Flag as review only if uncertain.
- Real nonpolitical celebrities or private individuals: require clear permission/rights for likeness replication, impersonation or sensitive edits. Distinguish a name in historical discussion from an attempt to recreate someone without permission.

## Content moderation pipeline
1. **Input normalization:** Unicode NFKC, Arabic/Kaf/Yeh normalization, Persian half-space, letter elongation, punctuation and common multilingual spelling aliases. Retain raw input securely for processing; do not store unnecessary personally sensitive logs.
2. **Fast deterministic preflight:** `evaluateTextSafety` in `lib/safety.ts`. Decisions `allow`, `block`, `review`; blocks/reviews never reach paid generation. Fast pass does NOT certify the prompt as production-safe.
3. **Context-aware semantic moderation:** private, cost-conscious model specialized for Persian language and local slang, with stable structured taxonomy and confidence, calibrated on Iranian colloquial input. Use independent media-policy checker; user-provided content cannot override rules.
4. **Reference inspection (photos: implemented 2026-11-06, `lib/upload-review.ts`; videos: implemented 2026-11-08, `lib/video-review.ts`, right after upload: one frame every 5 seconds (at least 3, at most 24), all checked together in one call against the photo rules, the soundtrack through the generated-audio check, at most 2 minutes and 100 MB, fail closed; audio files: not yet, they fail closed):** inspect image/video/audio uploads and their metadata before analysis/generation. Detect political figures, sexualization, sensitive real-person manipulation, copyright/consent and misleading edits. If the inspection service is unavailable, fail closed for generation.
5. **Plan inspection:** re-evaluate expanded prompts, proposed storyboards, every scene and action manifest, media model configuration and output risk.
   Planner-written text is checked with `evaluatePlanTextSafety` (lib/safety.ts): a generic category word (political, propaganda, protest, سیاسی، تظاهرات، nudity terms…) is ignored when a negation sits within four words of it («هیچ نماد سیاسی نباشد», "no political banners"), because planners write such avoidance lines to obey this policy. Named political figures and explicit terms are never neutralized, user input keeps the strict check, and Enghelab/Revolution Square and Enghelab Street are treated as places. Found in the 2026-11-04 planner eval, where «میدان انقلاب» turns were blocked by the planners' own compliance lines.
6. **Provider handoff:** validate safety + eligibility again at immutable quote approval and immediately before provider submission. Higgsfield's own moderation rules are additive, not replaced.
7. **Output inspection:** validate generated media and OCR/ASR for text/speech, visual classes, famous-person risk, content safety. Do not release or charge users for clearly ineligible outputs without a defined refund rule; investigate provider cost if already incurred.
   **Generated soundtracks (implemented 2026-11-08, `lib/audio-check.ts`):** a video model is asked for sound only when this check can run (ffmpeg, the transcriber's gate, the review model and its key); otherwise the request stays silent. Before a finished video is shown, its soundtrack is extracted, transcribed verbatim in any language (`transcribeMedia`, lib/voice.ts), checked by `evaluateTextSafety` and then by a semantic review (the cheapest private model, the categories of this policy). Words that fail, or any step that cannot run, remove the soundtrack: the silent copy is shown with a calm, general reason («صدای این ویدیو حرف سیاسی داشت؛ بی‌صدا نگهش داشتیم.»). A soundtrack that must go but cannot be removed fails the job (nothing is shown or charged). Music or ambience with no words passes. Neither audio nor transcript is stored or logged. Not yet covered: non-speech audio classes (gunshots, moans) and sung words the transcriber misses; the picture is still not inspected after generation.
8. **Operations:** appeals/reviews for false positives, calibrated thresholds by class, multilingual adversarial tests, audit trail with strict retention, human decisions for borderline cases and rate limits.

## Examples (expected behavior)
| Prompt (meaning) | Decision | Why |
|---|---|---|
| Persian wedding portrait in Shiraz | Allow | Cultural lifestyle |
| Portrait in میدان انقلاب | Allow | Geographic place name alone is not politics |
| Design an election campaign poster | Block | Explicit political campaign |
| Political leader photorealistic likeness | Block | Political figure |
| Image of a bikini model or sensual pose | Block | Disallowed visual framing |
| Professional fashion catalog with modest evening dress | Allow | Ordinary fashion |
| Nude-color lipstick product shot | Allow | Color name, not nudity |
| Historic Pahlavi era building | Review | May be nonpolitical architectural context |
| Cyrus the Great entering Babylon, historical film still | Allow | Pre-1900 figure, historical depiction (owner decision 2026-11-06) |
| Cyrus the Great with a political slogan or protest banner | Block | A historical figure used for a present-day political message |
| Persian poem that mentions wine | Review | Context-dependent; not necessarily advertising |
| Tehran travel postcard with Iranian flag | Allow | National culture without propaganda |

## Important limits
`lib/safety.ts` currently uses only a small lexical prototype. It cannot reliably interpret slang, OCR, ASR, implied references, political euphemisms, visual material or creative intent. Do NOT enable production media generation on an `allow` result alone. Add semantic + media + output moderation and test against real Persian data.
Restrictions may reduce exposure to filtering pressure but **cannot guarantee** domain/hosting availability. Iran has broad legal and technical filtering powers; get local legal review of your exact service and payment/content obligations. Avoid collecting unnecessary user data in a surveillance-sensitive environment.
Sources for contextual risk, NOT legal advice: https://freedomhouse.org/country/iran/freedom-net/2026 ; https://www.gov.uk/government/publications/iran-country-policy-and-information-notes/country-policy-and-information-note-social-media-surveillance-and-sur-place-activities-iran-april-2025-accessible ; https://sherloc.unodc.org/cld/ar/legislation/irn/computer_crimes_act/section_1_-_chapter_6/articles_19-24/article_19-24.html .

## Release-blocking validation
500+ Persian prompts across dialect/slang/typo/euphemism, intentional safe overlap, 100+ reference images/videos and numerous generated outputs; human-reviewed labels, tracked recall/precision by risk class and overblock rate, moderation downtime tests, Persian text/OCR/ASR, privacy checks. Risk target: 0 known disallowed content reaching API, but no system can guarantee perfect detection.
