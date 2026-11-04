# Capability scouting

Whoush never invents provider models, paths, capabilities or prices (`CLAUDE.md`). Two scouts watch for what is new; both are **read-only** and **enable nothing**.

## The two scouts
| Scout | Where | Reads | Output |
|---|---|---|---|
| CI scout | `.github/workflows/capability-scout.yml`, weekly (Monday 06:00 UTC) and on demand; script `scripts/capability-scout.mjs` | The public Higgsfield docs index (`llms.txt`), `openapi.json` (paths and `info.version`), a text fingerprint of the Higgsfield terms of service, and, when the `ANTHROPIC_API_KEY` secret is set, the Anthropic model list (id, display name, creation date, token limits) | A markdown report (workflow summary and `--out`). When it differs from `data/capability-snapshot.json`, the issue **"Capability scout (CI): Higgsfield docs + LLM models"** is created or updated. No diff means no issue. |
| Local Claude task `whoush-capability-scout` | Weekly, on the maintainer's machine | The Higgsfield **agent** catalogue (`models_explore` of the MCP connector), read-only | Maintains the issue **"Capability scout: Higgsfield + LLM updates"**. Facts from it are recorded in `docs/HIGGSFIELD_EVIDENCE.md` (see "Higgsfield agent (MCP) catalogue"). |

The agent catalogue is not the API documentation: it shows what exists on Higgsfield's agent platform, not the `api.higgsfield.ai` path or input schema. The CI scout sees the public API side. Neither replaces reading the model's own documentation.

### Running the CI scout locally
`node scripts/capability-scout.mjs [--out report.md] [--write] [--snapshot path]`. It always exits 0 (a diff is not a failure). `--write` stores the current state in `data/capability-snapshot.json`, keeping the previous value of any source that failed this run. Without a seeded snapshot nothing is compared. A fetch that fails or times out (10 s) is reported as "unavailable", never as "everything was removed". The terms fingerprint uses the page's visible text only, because the page embeds timestamps that change on every request.

In CI the scout never edits code or the snapshot. A human reviews the issue, then updates `data/capability-snapshot.json` by PR.

## Adoption lifecycle
A discovered model moves through these stages in order. Skipping one is a launch blocker.

1. **Discovered**: it appears in a scout report or the agent catalogue. The catalogue may list it as a suggestion only (`capabilities.verified:false`, `pricePending:true`, `evidenceSource:"agent_catalogue"`), shown to customers as "coming soon" with raw model name and Persian reasons, never with a price or an approve action (`lib/router.ts` `bestModelFor`).
2. **API path and schema verified with evidence**: read from the model's own documentation and recorded in `docs/HIGGSFIELD_EVIDENCE.md`; only then may `verifiedApiPath` and `evidence` be set.
3. **Fixed integer Neuron SKU approved** (`docs/NEURON_PRICING.md`): then `pricePending` is removed and `neurons` set. Provider USD prices are never copied into code.
4. **Media inspection and moderation in place** (`docs/MODERATION_POLICY.md` step 4, `docs/LAUNCH_GATES.md` gate 8a). Until then every image, video or audio attachment fails closed.
5. **Provider authorization** (`docs/LAUNCH_GATES.md` gate 1).
6. **Enabled**: a human bumps `MEDIA_CATALOG_VERSION` in the same PR.

## Rules
- Nothing is enabled automatically. A scout report is a checklist for people, not a change.
- LLM tier changes (a new or removed model, changed limits) are **recommendations for the owner** (routing and the eval method are in `docs/LLM_ROUTING.md`): they affect cost and margin (`docs/NEURON_PRICING.md`) and are decided there. Customer-facing text never names an LLM vendor or family.
- Customer-facing text never names Higgsfield; only raw model names (Soul, Intone, Genjutsu, Seedance, Kling…).
