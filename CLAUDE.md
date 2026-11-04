# Whoush / Claude entrypoint

Work in repo `aleeforoughi/whoush`. Start by reading `docs/CLAUDE_HANDOFF.md`, `docs/IMPLEMENTATION_PLAN.md`, `docs/ARCHITECTURE.md`, `docs/NEURON_PRICING.md`, `docs/LAUNCH_GATES.md`. Read code before changing it. Preserve everything already working and avoid unnecessary rewrites.

## Contract
- Product: Persian-first, Runway-inspired chat + visual workspace. Higgsfield ONLY for image/video generation. Private auto-routed LLM(s) ONLY for chat, creative planning, prompt improvement and orchestration.
- No LLM vendor names or manual LLM selector in customer UI or consumer API responses. Internally track reasoning usage, model IDs and costs.
- User MAY explicitly request a Higgsfield media model in chat. If eligible, honor it. Otherwise recommend 1-3 compatible media models, clearly distinguishing recommendation and available alternates.
- Image/video SKU prices are **fixed INTEGER Neuron amounts** independent of FX; package prices are fixed toman; package Neuron awards vary with validated free-market USD sell rate. Bonus tiers: 0,2,4,6,8,10% for 2m/5m/10m/20m/50m/100m toman. Gifts INCLUDED in total, all Neuron values integers.
- No frontend access to provider keys, provider USD costs, Neuron USD valuation, internal LLM routing.
- Do not enable Higgsfield/LLM services for ineligible end-users. Obtain written API/business-model and regional permissions before production. Never use proxy/VPN routing to evade restrictions.
- No charges without backend-validated immutable quote and valid budget authorization. No double charges, no invented generation success.
- Do not make up Higgsfield paths, model IDs, capabilities, pricing or webhooks. Consult current documented per-model schema, record evidence and version.
- Do not permit payment until authentication, durable quotes, approved FX, and immutable ledger are verified.
- No ungrounded claims of passing tests. Run and report actual commands/results.

## Claude compute allocation
Haiku: small audits, documentation, straightforward type/test/UI copy, fixture extraction.
Sonnet: normal feature implementation, frontend/backend integration, migrations and tests.
Opus: early security/economics/API architecture decisions, race-condition review, final independent release review.
Use ONE lead agent assigning limited, non-overlapping subtasks. Escalate only after measured failure. Avoid multiple expensive agents generating the same work.

## Mandatory professional skill and safety layer
- Read `docs/CREATIVE_SKILLS.md` and `docs/MODERATION_POLICY.md`. `lib/skills.ts` defines 15 versioned reusable skills; `lib/safety.ts` provides a fast non-production Persian-aware safety preflight.
- EVERY real private LLM creative request must use `preparePrivateCreativeRequest` from `lib/llm.ts` to compile base skills plus dynamically activated specialties. Do not bypass the skill compiler with a raw LLM request.
- Foundation on every creative request: prompt engineering, creative/art direction, Persian language, professional QA.
- Image tasks always activate professional photography with proposed camera body/look, lens, aperture, shutter, ISO, WB, framing, lighting and focus. Video tasks always activate cinematography + videography. Edits add specialized source-preservation skills. Contextual social/culture/geography/poetry/copy/type/audio specialists are added as relevant.
- Whoush customer-facing LLM choices remain invisible; these professional skills are internal instructions, not user selectable.
- Zero-tolerance **political generation** including all political figures of any ideology. No nude/erotic/overtly sensual visual requests or revealing garments; allow benign cultural/fashion/sports contexts without keyword-only overblocking.
- Sensitive Persian words and regulated subjects require context-aware semantic review and human escalation where warranted. `lib/safety.ts` is only a lexical prefilter; production requires verified semantic + multimodal + output moderation, even after a lexical allow.
- Moderation failure or uninspected media must prevent provider submission. Never claim compliance or filtering immunity. Do not log raw sensitive user prompts unnecessarily.

## First actions
1. Examine repo and run `npm install`, `npm run test`, `npm run typecheck`, `npm run build`.
2. Fix scaffold failures before new features.
3. Implement plan phases in order with separate PRs, small tests, and human-reviewed checkpoints.
4. Keep production features gated until `docs/LAUNCH_GATES.md` is satisfied.
