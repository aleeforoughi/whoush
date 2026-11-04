# Private LLM routing

The planner LLMs are internal: customers never see a model, vendor, tier, score or selector (`CLAUDE.md`, `docs/ARCHITECTURE.md`). Everything below is privileged audit data. Higgsfield stays the only image and video generator.

## Where it lives
| Piece | File |
|---|---|
| Skill compiler (every creative request) | `lib/llm.ts#preparePrivateCreativeRequest` |
| Provider by id prefix, live gate | `lib/llm.ts` (`resolvePrivateRouting`, `llmGate`, `llmPolicy`) |
| Task profile, config, ladder planning, cooldown, Astra counter | `lib/llm-routing.ts` (pure) |
| Routing data | `config/llm-routing.json` (zod-validated at load) |
| Attempts, escalation, audit | `lib/orchestrator.ts` |
| Adapters | `lib/llm-anthropic.ts` (Messages API), `lib/llm-openai.ts` (Responses API, Structured Outputs) |
| Shared brief builder | `lib/planner-brief.ts` |

## Provider and fail-closed rules
- The provider comes from the model-id prefix only: `claude-*` is Anthropic, `gpt-*` is OpenAI, **anything else has no route** and is never called.
- Live calls need the existing gate: `LLM_PROVIDER_AUTHORIZED=true` and `ALLOW_LIVE_LLM=true`, **or** the owner-only dev live test (`devLiveTest`, `next dev` only). A rung also needs its provider key (`ANTHROPIC_API_KEY` for `claude-*`, `OPENAI_API_KEY` for `gpt-*`). Without a route the deterministic planner answers and the audit says why (`provider not authorized`, `live llm disabled`, `api key not configured`, `provider cooldown`, `no route available`).
- LLM output is untrusted: it is schema-validated, corrected by `enforce`, leak-filtered and safety-inspected exactly as before. The leak filter forbids vendor and model-family words (`claude`, `anthropic`, `openai`, `gpt`, `sonnet`, `opus`, `haiku`, plus the standalone Latin tokens `sol`, `astra`, `luna`, `terra`) unless the user typed them.

## Task profile (`profileTask`)
Deterministic, no LLM call. The score (0..100, capped) is the sum of these signals; `signals` in the audit lists what fired.

| Signal | Weight |
|---|---|
| Prompt length 81-180 / 181-400 / 401-1000 / over 1000 characters | +8 / +16 / +26 / +36 |
| Video output | +12 |
| Edit (`task:"edit"` or an `edit_reference` attachment) | +14 |
| Character (`characterRef` or a character-role image); 4+ angles | +14; +4 |
| Attachments, +4 each (max 16); distinct media roles, +3 each (max 9) | up to +16; up to +9 |
| Lip sync / speech | +16 |
| Style chosen in the + menu | +3 |
| Multi-shot or identity wording (the same terms as `reasoningTier`: storyboard, multi-shot, چند سکانس, حفظ چهره ...) | +28 |
| Text excerpts total over 0 / 2000 / 8000 characters | +4 / +10 / +18 |
| `creative_copywriter` skill active; `iranian_geography` skill active | +6; +6 |

Class precedence: `multi_shot`, `lip_sync`, `character`, `edit`, `document_heavy` (excerpts over 2000 characters or 3+ pdf/md/json files), `video`, then `quick_image` (score 24 or less) or `standard_image`.

## Bands and ladders (`config/llm-routing.json`)
| Band | Score up to | Ladder (first rung tried first) |
|---|---|---|
| quick | 24 | `claude-haiku-5-5`, `gpt-6-luna` |
| standard | 59 | `claude-sonnet-5-5`, `gpt-6.1-sol` |
| complex | 84 | `claude-opus-5-5`, `gpt-6.1-sol` |
| exceptional | 100 | `claude-opus-5-5`, `gpt-6-astra` |

- `classOverrides` maps a task class to its own ladder (replacing the band ladder). Empty today; fill it from eval evidence (below).
- **Legacy override:** `LLM_FAST_MODEL`, `LLM_BALANCED_MODEL`, `LLM_DEEP_MODEL`, when set to a `claude-` or `gpt-` id, replace the **first rung** of quick, standard and complex respectively (the other rungs stay; a duplicate collapses). The exceptional band is never overridden. An id with an unknown prefix is ignored. A class override wins over the legacy variables.
- Validation (`parseRoutingConfig`): every model id has a known provider prefix and a price; bands are quick, standard, complex, exceptional with strictly ascending `maxScore`, the last equal to 100; ladders have unique rungs; escalation numbers are in range. An invalid file throws at load; nothing is guessed.

## Skipping rungs (`planRoute`)
A rung is dropped when: its provider has no key; its provider is in cooldown; it is Astra and `LLM_ASTRA_ENABLED` is not exactly `true` or today's UTC call count reached `astra.maxCallsPerDay`; or its estimated cost exceeds `maxEstimatedCostUsdPerTurn` (input about 4 characters per token of system plus brief, output about 2500 tokens, prices from the config). The cheapest remaining rung is always kept so a route exists. Skips are recorded with a reason in the audit.

## Escalation
- Attempt rung 1. A failure listed in `escalation.escalateOn` (default `invalid_output`, `planner_unavailable`, `leak_filtered`), or a successful plan with `corrections.length >= escalateOnCorrectionsAtLeast` (default 4), moves to the next rung, at most `maxAttemptsPerTurn` attempts (default 2). If an escalated attempt fails, the earlier usable plan is kept. When nothing usable remains the deterministic planner answers, as before.
- **Refusal is a safety signal.** `refused` is deliberately not in the default `escalateOn`: a refusal on any attempt ends the turn as `restricted`; no other model is asked to get around it. Only an explicit owner config that lists `refused` changes this, and that is a policy decision, not a tuning knob.
- **Cooldown:** a `planner_unavailable` outcome (rate limit, connection error, 5xx, auth) puts that provider in cooldown for `providerCooldownSeconds` (default 60) in process memory; state is lost on restart. Unavailable never marks a refusal.
- **Astra** (`gpt-6-astra`) is for rare, most complicated tasks only: reachable only in the exceptional band (or an owner class override), only with `LLM_ASTRA_ENABLED=true`, and counted per UTC day in memory.
- **Audit** (private, `routing` on `PrivateAuditRecord`): `taskClass`, `score`, `signals`, `band`, `ladder`, `skipped`, `attempts[{modelId, provider, outcome, latencyMs, usage, estCostUsd}]`, `chosenModelId`. `route` holds the provider and model that produced the plan. None of it reaches a customer response.

## Verified models and prices
Read on 2026-11-04. All OpenAI models use the Responses API with 1.05M context and 128K max output.

| Model | Input / output USD per 1M tokens | Source |
|---|---|---|
| `gpt-6-astra` | 10 / 50 | https://developers.openai.com/api/docs/models |
| `gpt-6.1-sol` | 2 / 10 | same |
| `gpt-6.1-terra` | 1 / 5 | same (not routed today) |
| `gpt-6-luna` | 0.1 / 0.5 | same |
| `claude-opus-5-5` | 4 / 20 | Anthropic pricing |
| `claude-sonnet-5-5` | 2 / 10 | Anthropic pricing |
| `claude-haiku-5-5` | 0.1 / 0.5 | Anthropic pricing |

Structured Outputs (https://developers.openai.com/api/docs/guides/structured-outputs): the OpenAI adapter sends `CreativePlanWireSchema` (every field required, optionals as nullable, strict objects, no string-length keywords) through `zodTextFormat`, maps the result back with `fromWirePlan` and re-validates with `CreativePlanSchema`. A `refusal` content item is `PlannerRefusedError`; an incomplete or unparsable response is `PlannerInvalidOutputError`; SDK API or connection errors are `PlannerUnavailableError` (no vendor in the message). Prices in config and in the eval are estimates for internal comparison and must be re-checked against the pages above before they drive decisions (`docs/CAPABILITY_SCOUT.md`).

## Evaluation
`scripts/planner-eval.ts` runs Persian prompts through the full pipeline (invariants, leak filter, safety) for each model. It makes real API calls, so the owner or lead runs it; it never runs in CI and never sends anything except the model calls. Keys come from `.env.local` (never printed); prompts are never logged, only ids.

```
node --conditions=react-server --import tsx scripts/planner-eval.ts --models claude-sonnet-5-5,gpt-6.1-sol [--limit N] [--out DIR]
node --conditions=react-server --import tsx scripts/planner-eval.ts --route [--models ...]      # also runs the real router, one ladder per prompt
node --conditions=react-server --import tsx scripts/planner-eval.ts --models a,b --limit 0       # dry run: validates prompts, no API call
```
Outputs go to `evals/planner/results/<timestamp>/` (git-ignored): `results.json` and `report.html`.

How to read the report:
- **Summary per model:** runs, ok (a live plan with no fallback), failures, mean/p50/p95 latency and quality means over successful runs only, total and mean **estimated** cost, Persian share of the public plan text, camera/shot completeness, keyword hit rate, forbidden-keyword violations, invariant corrections (fewer is better: the model followed the contract), leak-filtered count.
- **Per task class** (`profileTask` of each prompt): each model's metrics per class, plus a suggested `classOverrides` JSON (best two models per class by ok-rate, then corrections, Persian share, keyword hits, then cost). It is a suggestion from a small sample, printed and shown only.
- **Per prompt:** the models' public plans side by side with blank 1-5 owner rating boxes. Judge Persian naturalness, cultural fit and camera sense by eye; the metrics cannot.
- Most of the 30 prompts are short, so most profile as `quick_image`; add longer, edit, character and multi-shot prompts before trusting the other classes.

## Decisions
Routing changes (bands, ladders, class overrides, escalation, Astra, cost ceiling) are the **owner's decision**, based on eval evidence on both cost and quality. Nothing is applied automatically, no script writes `config/llm-routing.json`, and a scout report or eval suggestion is a checklist, not a change. Customers never choose a model.
