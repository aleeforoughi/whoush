# Claude engineering handoff: Whoush
Repo: `aleeforoughi/whoush`
Initial branch: `feat/platform-foundation`
Date: 2026-11-04
Execution doctrine: shortest path to a **tested** compliant MVP, not the most complex agent architecture.

## 0. Prime directive
One development lead coordinates bounded subagents. Haiku is for mechanical research/triage/tests/docs; Sonnet is the main builder; Opus is for high-risk architecture, concurrency, security, economics and an independent final review. Do **not** send every small request to Opus or run multiple agents producing the same file. Each agent must state which files it owns and return evidence, test output and unresolved concerns. Break work into PRs with no overlapping file edits.

Never assume a model's availability merely because its marketing name exists. Internal runtime LLM tiers are configurable and never exposed to customers. Future GPT Sol/Astra integration is contingent on verified API access, region permission and accurate usage accounting.

## 1. Start here: give Sonnet (lead) this prompt

```text
You are lead engineer for aleeforoughi/whoush. Read CLAUDE.md and ALL docs/ files, inspect the branch and preserve the current scaffolding. Follow the Runway-inspired three-zone UX specification and the Whoush Neuron rules. First run npm install, npm run test, npm run typecheck and npm run build. Report actual results, fix failures with tests, and open an isolated PR. Do not connect live providers or payments. Do not expose LLM model/provider selection in any customer UI/API response. Image and video generation must use ONLY Higgsfield after permission and schema verification. Every generation SKU has a fixed whole-Neuron charge. FX changes only the whole Neurons awarded in fixed-toman packages. Keep the provider's Iran end-user restriction and anti-resale permissions as hard launch blockers. Create a phase-by-phase issue list from docs/IMPLEMENTATION_PLAN.md and identify parallel safe subtasks for Haiku. No unverified success claims.
```

## 2. Haiku starter: file and quality inventory (very low cost)
```text
Inspect the Whoush repo READ-ONLY. Enumerate application pages, route handlers, pricing and router functions, tests, docs and TODOs. Identify missing config files, obvious TypeScript import problems, stale terminology, untranslated Persian UX, accessibility issues and tests worth adding. Do not change finance/security logic. Return a concise actionable checklist with filenames and line numbers. Suggest only isolated tasks suitable for Haiku.
```
Haiku deliverable: file-by-file report. Use Sonnet for fixes after review.

## 3. Sonnet starter: authentication and database (normal coding)
```text
Implement P0 auth + Postgres persistence in Whoush as a small independent PR. Use db/001_initial.sql as a draft, correct defects via reviewed migrations, add users/sessions/project ownership and strict RBAC, protect asset/quote routes, add rate limiting and integration tests. Use provider-neutral auth appropriate for deployment and keep every secret server-side. Do not activate payments/generation. Demonstrate account A cannot read/write account B data. Run tests/typecheck/build; publish what passed.
```

## 4. Opus starter: credit ledger threat model (high reasoning)
```text
Review docs/NEURON_PRICING.md, lib/pricing.ts, db schema and proposed checkout/ledger flow. Derive exact integer-only arithmetic, atomic reserve/settle/release/refund transitions, concurrent spend race invariants, webhook replay/idempotency protections, stale FX quote handling, provider price change exposure, maximum 10% package bonus and target 20% gross margin including invisible LLM overhead. Produce the smallest robust transactional design, SQL constraints, failure matrix, and property-based test cases. Audit only; ask Sonnet to implement. Never use floats for stored Neurons or toman.
```

## 5. Sonnet starter: FX and wallet implementation
```text
Implement P0 FX+Neuron package quoting and durable wallet billing per the Opus-approved design. Fixed package prices: 2m,5m,10m,20m,50m,100m toman. Bonuses: 0%,2%,4%,6%,8%,10%. Use verified licensed USD SELL rates denominated in toman, multiple-source freshness/outlier logic, no silent fallback to demo for live purchases, immutable quote with expiration and integer base/gift/total. Payment fulfillment must rely on server-verified payment or authorized manual receipt review and be idempotent. Test replay, concurrent order credits and stale-rate failure. No live funds without payment/legal sign-off.
```

## 6. Sonnet starter: verified Higgsfield integration
```text
Implement the Higgsfield adapter behind the existing server-only feature gate and provider authorization. Read current official Higgsfield API quick start and each enabled model's exact linked llms.txt/Input JSON schema; never guess paths, parameters or prices. Base https://api.higgsfield.ai, header Authorization: Key <complete-key>. Submit returns request_id/status_url/cancel_url; implement status polling, terminal states, optional webhook signature if officially documented, cancellation via provider POST, durable retry/idempotency and output mirror to owned storage. Estimate USD cost before quoting if documented. For live use, verify written permissions including intended Iranian end users and generation-service business model; if absent, only implement mock and provider contract tests. Add one model/configuration at a time.
```

## 7. Sonnet starter: invisible creative agent and media model router
```text
Implement a private configurable LLM orchestration layer for Whoush. LLM(s) are only used to understand Persian/English intent, analyze reference metadata, improve media prompts, propose shot plans, select Higgsfield image/video models, and interpret follow-ups. Never reveal LLM provider/model IDs, API usage costs or allow public LLM selection. Internally route 'fast','balanced','deep' by task needs and validated budget; escalate only when needed. Do not build a multi-agent council per message. Honor explicit user-specified HIGGSFIELD MEDIA model when eligible; otherwise show one recommended and up to two alternatives. Implement typed action schema with immutable refs, hard/soft constraints, estimated fixed whole-Neuron charge, ask-first approval. Add tests for model leakage, prompt injection, source lock, long-thread memory and manual-media-model override. Do not allow the LLM to write directly to the wallet.
```

## 8. Haiku starter: isolated tests and localization (low cost)
```text
Add focused tests and minor Persian RTL accessibility improvements without changing business logic. Test package six tiers, integer awards, gift included in total, fixed generation SKU prices under FX change, unknown media model error, selected alternate updates quoted cost, zero leakage of LLM names, and realistic Persian/bidi display. Do not refactor architecture. Return actual test command outputs and changed files.
```

## 9. Opus starter: independent release-blocking review
```text
Review Whoush security, cost model and API authorization independently. Focus on: Iran regional restrictions and Higgsfield anti-resale, no unauthorized live provider access, no hidden provider keys in client bundles, no unsupported API paths or imaginary estimated pricing, checkout quote tampering, concurrent double-charge/refund, stale FX rates and IRR/toman confusion, model choice override bypassing hard constraints, image/video reference consent and asset access control. Demand proof of production gating. Return severity P0/P1/P2 with precise reproducible test cases. Do not approve launch while any P0 is unresolved.
```

## 9a. Specialized professional Skills & Moderation implementation prompts (P0)

### Haiku: low-cost skill library audit (read-only + tests)
```text
Read lib/skills.ts, lib/safety.ts, docs/CREATIVE_SKILLS.md and docs/MODERATION_POLICY.md. Inventory each of the 15 expertise skills and activation triggers. Identify missing trigger coverage for Persian colloquial/Farsi orthographic variants, word-boundary issues, ambiguous place names and common benign beauty/fashion/sports requests. Add unit tests only to tests/skills-safety.test.ts, not new runtime policy code. Never assume word-list preflight is sufficient for production. Return reproducible failing and passing test evidence.
```

### Sonnet: integrate professional skills into live private agent
```text
Implement a structured professional creative skills execution layer using the existing SKILLS registry and preparePrivateCreativeRequest entry point. Ensure every genuine creative LLM request receives the mandatory skills prompt; image requests always receive photographic camera/lens/f-stop/shutter/ISO/WB/focus/framing/lighting instructions, video always receives cinematography/videography, edit requests receive source-preserving photo/video editing. Dynamically add Persian culture/geography/social trends/graphic design/copy/audio specialisms. Keep internal LLM identity and skill prompt out of user API responses. Output typed task plan, explicit hard/soft constraints, media-compatible settings and deterministic QA checklist. Never claim image outputs exist before Higgsfield returns verified media. Attach evidence with tests in Persian and English. User-specified settings override proposed defaults, never silently rewrite source metadata. Production requires provider authorization.
```

### Opus: review content risk / false positives / privacy before launch
```text
Independently threat-model Whoush Iran-oriented content moderation under docs/MODERATION_POLICY.md. Product policy: hard political content/person blocks across affiliations; restrictions on nude/sexualized imagery and revealing clothing; ambiguous regional language and normal fashion/culture must not be indiscriminately rejected. Review lexical matching for Unicode, Farsi slang, local idioms, euphemism, implicit political figures, celebrity likenesses, reference media/OCR/ASR, photo/video outputs and prompt injection. Design a provider-agnostic semantic classifier contract and multimodal moderation pipeline with fail-closed behavior, privacy retention, review appeal and measured overblocking. No claim of zero filtering risk. Output P0/P1/P2 findings with metrics and concrete adversarial Persian fixtures. Only enable live providers if human signs off compliance, provider eligibility and legal requirements.
```

### Sonnet: build moderation pipeline after Opus review
```text
Implement the reviewed content safety pipeline in stages: Persian normalization + lexical prefilter (existing) -> semantic text risk classifier -> reference image/video/audio review -> typed planned-operation safety review -> recheck immediately before authorized Higgsfield submission -> output image/video OCR/visual review and refund/release workflow. Hard politics and sexualized imagery block, uncertain content goes to review not live generation. Avoid false positives on colloquial benign Persian, named locations, geography, culture, makeup colors and modest fashion. Tests must include malicious paraphrases, misspellings, English/Persian mixing, model-generated prompt expansion and media references. Explicitly fail closed if any configured checker is unavailable; do not rely on regex alone.
```

## 10. Cost optimization rules for Claude Code
- Cheap mechanical work => Haiku. Clear feature implementation, UI and integration => Sonnet. Nonlinear security/financial architecture, systemic debugging or final review => Opus.
- Give every worker a bounded task, explicit output artifact, owned files, and acceptance tests. No broad "make it perfect" prompt.
- Avoid feeding full 40k-token history into every subagent. Use CLAUDE.md + a small task brief + exact files.
- Cache stable read-only context (docs, contracts) where provider/tool supports it, avoid massive screenshots, use targeted diffs.
- Escalation ladder: Haiku audit finds issue → Sonnet targeted fix → Opus only after 2 failed focused attempts or high-risk design decision.
- Parallelize independent docs/tests/UI work only; serialize auth, ledger, DB migrations, API provider code and release merges.
- Keep PRs small and verify tests; never rerun the whole test suite after every line edit, but run the full suite at a merge gate.
- Prefer mock adapters for inexpensive end-to-end development; use authorized API sandbox/test keys rather than generation spend.
- Track engineering spend per task phase with a cap chosen by owner. Do not promise specific cost savings without measuring it.
- Require Opus independent review before any production money/provider changes.

## 11. Handoff checklist
1. CI actually passes.
2. Requirements traceable to files/tests, no invented provider paths.
3. Media SKU Neuron numbers are integer and fixed per version.
4. FX affects new package Neuron grant only. Bonuses included in total.
5. Customer UI shows package toman, total neurons, +gift; never Neuron USD valuation.
6. Customer chat shows media models if relevant, NEVER invisible reasoning LLMs.
7. Quote approval binds model/config/inputs/cost; changed parameters require new approval.
8. Live provider/auth/payments disabled until terms and security gates signed off.
9. New PR includes changed paths, actual test logs, screenshots and known gaps.
