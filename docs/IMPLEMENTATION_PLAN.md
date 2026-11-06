# Whoush implementation plan | 2026-11-04
Status: **foundation scaffold only, NOT production launch**.

## Goal
Persian-first conversational image/video platform built around Runway's three regions (left navigation, center media/cut canvas, right agent). **Superseded 2026-11-05 (owner decision):** media generation uses approved direct provider APIs (Google, ByteDance, Kling) plus Higgsfield; see `docs/PROVIDERS.md`. Originally: Higgsfield is the *only* media-generation provider. LLMs are invisible implementation tools for private chat, intent detection, reference analysis, prompt improvements, creative planning, media-model routing and job orchestration. Consumers cannot choose LLMs. Consumers can name or switch the actual media model, if supported and available.

## Priority board (execute sequentially, except safe parallel subtasks)
| Priority | Phase | Owner tier | Definition of done |
|---|---|---|---|
| P0 | 00. Stabilize foundation | Sonnet + Haiku test | install, test, typecheck, build, mobile RTL audit, no secrets; fix issues |
| P0 | 01. Terms/provider-region gate | Opus lead + human business approval | Higgsfield written authorization for service/resale and Iranian end users OR compliant alternate market/provider; LLM provider region eligibility; recorded launch decision |
| P0 | 02. Auth and durable data | Sonnet | secure sessions, database migrations, ownership checks for messages/media, test multi-tenant isolation |
| P0 | 03. FX + integer pricing + immutable wallet | Opus rules, Sonnet code, Haiku tests | verified FX sources and admin review; integer package quotes; payment webhook idempotency; ledger reservation/settlement/refund under concurrency; never charge on invalid quote |
| P0 | 04. Model registry and Higgsfield adapter | Sonnet, Opus contract review | verified current model paths/schemas and price configs, server-side key, estimate before approval, submit/poll/webhook/cancel, retries without duplicate jobs, long-term storage |
| P0 | 05. Private auto-LLM agent | Sonnet, Opus review | no provider/model names exposed; internal fast/balanced/deep routing, typed tool output, hard vs soft constraints, reference IDs, limited budget, cost tracking, prompt injection defense |
| P0 | 05a. Mandatory creative skills + Iran moderation | Haiku tests, Sonnet runtime, Opus policy sign-off | 15 versioned skill modules; mandatory photographic/cinematographic instructions; Persian linguistic/cultural specialties; political and sensual policy; semantic/multimodal/output moderation plus tests; fail-closed provider execution |
| P0 | 06. End-to-end chat → output | Sonnet | Persian prompt, model choice/recommendations, quote, approve, genuine provider task, media saved and inspectable, fail-safe refund and history |
| P1 | 07. Creative quality & memory | Sonnet | project brief, refs, source locks, no drift targets, artifact lineage, image/video comparisons, acceptance feedback |
| P1 | 08. Mobile polish | Haiku + Sonnet | responsive layouts, keyboard navigation, accessibility, no layout overflow, clear intent/approval |
| P1 | 09. Jobs/ops/analytics | Sonnet | durable worker queue, monitoring, failure-alerting, rate limits, per-provider costs, margin dashboards and reconciliation |
| P2 | 10. Workflow builder and timeline | Sonnet, Opus only for complex design | multi-shot task plans, cuts, non-destructive assembly/export |
| P2 | 11. Referrals and growth | Haiku + Sonnet | audited bonus grants, anti-abuse, localized onboarding |

## Contract-driven core paths
- `POST /api/agent` : parse Persian/English intent to immutable action schema. Demo implemented.
- `GET /api/public/catalog`: customer-eligible media models and fixed Neuron price. Demo implemented.
- `POST /api/generation/quote`: model/configuration + input asset references => snapshot/version/expiry/cost. Demo only.
- `POST /api/generation/execute`: approval + quote + idempotency => reservation and actual job. Demo never calls providers.
- `GET /api/pricing/packages`: rounded toman package amounts, integer base/gift/total, quote expiry. Demo only.
- Future: auth endpoints, payments (server verified), /jobs/:id, /assets, /admin/fx, /admin/model-skus.

## Critical technical specs
- Use Postgres migrations and repeatable transactions; all numeric Neuron amounts BIGINT / integer, toman BIGINT, USD provider costs stored micro-USD or smaller fixed precision. BigInt-safe JSON boundary.
- FX feed: multiple eligible sources with provenance and correct rial-to-toman conversion; reject stale/unreliable rates, never quietly fall back to a demo rate for a real order.
- Package: fixed cash tiers, variable whole Neurons using verified FX and bonus tier. Immutable signed/persisted quote at purchase. Original wallet balances never reprice.
- Generation: immutable per-version integer Neuron SKU independent of FX. Admin price reviews if model USD costs or margin floor changes.
- Runtime LLM cost internal only, absorbed in media SKU economics; bounded free chat to stop abuse. Keep internal routing instrumentation private.
- Always require user authentication, reference ownership, accepted content policy, provider/regional eligibility, signed inputs, exact cost, and spend authorization.
- Client NEVER decides an approved charge; server creates quote, reserves balance, runs job, settles only after verified completed provider output. Refund only as specified.
- Never rely on Higgsfield output URL for long-term storage; persist completed media promptly. Higgsfield documentation indicates outputs may be deleted after 7 days.
- No live endpoint assumptions until model-specific API docs and provider account access have both been validated.

## QA gates
Unit: integer/nonnegative math, package monotonicity by spend, bonus yield, fixed SKU under FX changes, wrong model/unsupported region, no LLM model leakage.
Integration: provider contract mocked and recorded, malformed schema, webhooks/replay, network timeout, cancellation after submit, request duplication, partial failure, wallet insufficient.
Security: account A cannot access B data, provider key never browser-bound, no open proxy, data retention, signed file URLs, upload type verification and rate limits.
UX: mobile Persian RTL, bidirectional English model labels, reference IDs stable, quote edit invalidates approval, alternative model selection updates cost, no fake progress percentages.
Load: sustained generation queue, backpressure, retry exhaustion, FX source outage, provider outage, DB transaction contention.
Release: clean staging test evidence, cost/margin review, written Higgsfield/LLM authorization, permitted payment method, rollback plan.

## KPIs to measure
Successful accepted output per task, median turns to acceptance, total provider USD per accepted output, minimum realized margin per SKU/tier, duplicate-charge count (zero), unexpected user spend count (zero), 95th-percentile latency, failures recovered, consistent reference preservation.

## Out of scope until P2
Audio/music generation, public LLM selector, custom GPT chat subscriptions, external self-serve model APIs, standalone developer tools, live auto-spend without caps.
