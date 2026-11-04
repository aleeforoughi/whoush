# Whoush Iran-oriented Creative Safety Policy v1.0
**Product policy, not an authoritative statement of Iranian law or a guarantee against filtering.** Current status: conservative development-level text preflight; not production-ready comprehensive moderation.

## Goal and intended audience
Persian-speaking users, Iranian influencers, modern/traditional cultural creators, local businesses and everyday content makers. Allow genuine nonpolitical Iranian landscapes, culture, cities, weddings, apparel, beauty, portraits, sports, advertising and accessible creative expression.

## Absolute bans for generation
1. **Politics / public political figures (zero tolerance)**: no political advocacy/opposition, campaigns, election graphics, public political figure likeness, speeches, protest imagery, party slogans, or political propaganda of any position. Enforce neutrally across perspectives. A political name or direct political request is blocked regardless of persuasion direction.
2. **Sexualized visual content**: no nudity, sexual display, overtly sensual/erotic poses or clearly revealing outfits (including lingerie and bikinis), sexualization of minors, or sexualized deepfakes. Normal everyday clothing and nonsexual fashion, sportswear, weddings and portrait photography are permitted.
3. **Explicit severe harms**: no sexual exploitation of minors, graphic dismemberment, explicit religious hostility or direct advertising of illicit/high-risk regulated activities. Add and validate further harms under provider policy before production.

## Contextual review (not automatic guilty verdict)
- Ambiguous historical dynastic terms or common names that might refer to a political person; e.g. “پهلوی”, “روحانی”. A nonpolitical architecture/history context can still be disallowed if explicitly depicting a political leader, but ordinary innocuous meaning should not be auto-banned.
- Profanity or Persian sensitive slang: infer intent (quoted dialogue, linguistic discussion, mild casual idiom, explicit abuse); avoid substring matching, ZWNJ/Arabic yeh-kaf drift or broad stop words.
- Alcohol, tobacco, gambling, religion in art/poetry, medically appropriate/body/fitness contexts, local tradition, politics-adjacent place names; distinguish promotion of regulated activity from legitimate art or context. Flag as review only if uncertain.
- Real nonpolitical celebrities or private individuals: require clear permission/rights for likeness replication, impersonation or sensitive edits. Distinguish a name in historical discussion from an attempt to recreate someone without permission.

## Content moderation pipeline
1. **Input normalization:** Unicode NFKC, Arabic/Kaf/Yeh normalization, Persian half-space, letter elongation, punctuation and common multilingual spelling aliases. Retain raw input securely for processing; do not store unnecessary personally sensitive logs.
2. **Fast deterministic preflight:** `evaluateTextSafety` in `lib/safety.ts`. Decisions `allow`, `block`, `review`; blocks/reviews never reach paid generation. Fast pass does NOT certify the prompt as production-safe.
3. **Context-aware semantic moderation:** private, cost-conscious model specialized for Persian language and local slang, with stable structured taxonomy and confidence, calibrated on Iranian colloquial input. Use independent media-policy checker; user-provided content cannot override rules.
4. **Reference inspection:** inspect image/video/audio uploads and their metadata before analysis/generation. Detect political figures, sexualization, sensitive real-person manipulation, copyright/consent and misleading edits. If the inspection service is unavailable, fail closed for generation.
5. **Plan inspection:** re-evaluate expanded prompts, proposed storyboards, every scene and action manifest, media model configuration and output risk.
   Planner-written text is checked with `evaluatePlanTextSafety` (lib/safety.ts): a generic category word (political, propaganda, protest, سیاسی، تظاهرات، nudity terms…) is ignored when a negation sits within four words of it («هیچ نماد سیاسی نباشد», "no political banners"), because planners write such avoidance lines to obey this policy. Named political figures and explicit terms are never neutralized, user input keeps the strict check, and Enghelab/Revolution Square and Enghelab Street are treated as places. Found in the 2026-11-04 planner eval, where «میدان انقلاب» turns were blocked by the planners' own compliance lines.
6. **Provider handoff:** validate safety + eligibility again at immutable quote approval and immediately before provider submission. Higgsfield's own moderation rules are additive, not replaced.
7. **Output inspection:** validate generated media and OCR/ASR for text/speech, visual classes, famous-person risk, content safety. Do not release or charge users for clearly ineligible outputs without a defined refund rule; investigate provider cost if already incurred.
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
| Persian poem that mentions wine | Review | Context-dependent; not necessarily advertising |
| Tehran travel postcard with Iranian flag | Allow | National culture without propaganda |

## Important limits
`lib/safety.ts` currently uses only a small lexical prototype. It cannot reliably interpret slang, OCR, ASR, implied references, political euphemisms, visual material or creative intent. Do NOT enable production media generation on an `allow` result alone. Add semantic + media + output moderation and test against real Persian data.
Restrictions may reduce exposure to filtering pressure but **cannot guarantee** domain/hosting availability. Iran has broad legal and technical filtering powers; get local legal review of your exact service and payment/content obligations. Avoid collecting unnecessary user data in a surveillance-sensitive environment.
Sources for contextual risk, NOT legal advice: https://freedomhouse.org/country/iran/freedom-net/2026 ; https://www.gov.uk/government/publications/iran-country-policy-and-information-notes/country-policy-and-information-note-social-media-surveillance-and-sur-place-activities-iran-april-2025-accessible ; https://sherloc.unodc.org/cld/ar/legislation/irn/computer_crimes_act/section_1_-_chapter_6/articles_19-24/article_19-24.html .

## Release-blocking validation
500+ Persian prompts across dialect/slang/typo/euphemism, intentional safe overlap, 100+ reference images/videos and numerous generated outputs; human-reviewed labels, tracked recall/precision by risk class and overblock rate, moderation downtime tests, Persian text/OCR/ASR, privacy checks. Risk target: 0 known disallowed content reaching API, but no system can guarantee perfect detection.
