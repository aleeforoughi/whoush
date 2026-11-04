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
`lib/llm.ts` resolves confidential private model tiers but does not perform live calls yet.

## Deployment boundaries
Domestic web frontend/cache can operate with a supported backend where allowed; international model calls are only available to end users permitted under provider policies. Independent hosting does NOT legalize prohibited end-user access. Never route through intermediaries to bypass a ban.
Use self-hosted fonts and static assets where possible. Keep application secrets in managed environment, not Git.
