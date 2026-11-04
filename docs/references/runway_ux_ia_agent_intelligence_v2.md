# Runway Creative: UX, Information Architecture, and UI Component Audit

**Prepared:** November 1, 2026  
**Evidence:** Four user-supplied screenshots of the Runway Creative agent session, plus official Runway Help Center navigation, Agent, Workflows, and Final Cut documentation.  
**Scope:** Desktop shell, information architecture, orchestration UX, in-session interaction, component taxonomy, visual system, accessible implementation implications.  
**Evidence levels:** `OBSERVED` = directly visible in supplied screenshots, `DOCUMENTED` = confirmed in linked official docs, `INFERRED` = plausible structural/behavioral inference, `RECOMMENDED` = proposed improvement. No access to live authenticated DOM or code; token measurements are screenshots samples, not official Runway CSS.

## Executive synthesis

Runway uses an **agent-first creative operating system**. The design separates **global navigation** (left rail), **media and editing workspace** (center), and **instruction + decision controls** (right-side panel). The agent translates the user's creative request into an inspectable generation operation, complete with relevant inputs, model, aspect ratio, quality, and estimated credit price. The human can approve execution. This bridges the low-friction conversational UX with higher-trust, cost-bearing generative work.

The most transferable patterns are: persistent three-zone workspace; agent vs tool paths for different control needs; structured generation-intent cards inside conversation; explicit pre-spend approval; model-routing transparency; artifact-led browsing; separate global projects, sessions, and assets; and reusability through workflows and kits.

## 1. Information architecture

```text
Product domains (OBSERVED)
├── Creative [selected]
├── Ads
└── Dev

Creative workspace (OBSERVED)
├── New Chat / New Session
├── Home
├── Agent [selected]
│   ├── Chat history / recent sessions
│   ├── Conversation
│   │   ├── References / analyzed media
│   │   ├── User messages
│   │   ├── Agent explanations
│   │   ├── Tool execution proposals
│   │   └── Composer: attachments, model, optimization/autonomy settings
│   └── Workspace view
│       ├── Generations
│       │   ├── Preview
│       │   ├── Generations grid / media navigation
│       │   └── Loading and completed outputs
│       └── Cuts / Final Cut
│           ├── Timeline and tracks [DOCUMENTED]
│           └── Arrange, split, trim, export [DOCUMENTED]
├── Tool (manual model + input control)
├── App Studio [New label]
├── Workflows (reusable pipelines)
├── Plugins
├── Projects
├── Assets
├── Brand Kits
└── More

Left rail utilities (OBSERVED)
├── Chat | Session selector
├── Selected recent chat
├── View all chats
├── Referral-credit promotion
└── Account/profile/workspace plan
```

**Taxonomy:** The menu mixes task modes (Agent, Tool), builders (App Studio, Workflows), repositories (Projects, Assets, Brand Kits), and platform extenders (Plugins). Their user purposes differ and should be explicitly documented to prevent category confusion.

**Conceptual content model (INFERRED, not official database schema):** Workspace contains Projects, Sessions, Assets, Workflows, Brand Kits, and account context. Sessions contain messages and generation jobs; completed jobs produce media assets; Cuts reference media assets on a timeline; workflows consume and produce media; brand kits supply reusable context.

## 2. Core flow, state machine, and system feedback

1. **Open context**: user chooses Creative / Agent / a recent chat. App holds three visible work regions.
2. **Supply references**: user attaches three image references. Agent shows an `Analyzed 3 images` acknowledgement (OBSERVED).
3. **Describe intent**: natural-language brief requests three frontal silhouettes with backlighting and fine dust (OBSERVED).
4. **Agent interpretation**: assistant restates creative constraints in readable prose and prepares action details (OBSERVED).
5. **Review proposal**: `Generate Image` card specifies input thumbnails, aspect ratio `16:9`, quality `High`, model `GPT Image 2`, price `20 credits` (OBSERVED).
6. **Authorize**: primary `Approve` CTA authorizes paid execution; official documentation also supports automatic-generation mode (OBSERVED and DOCUMENTED).
7. **Track execution**: central canvas shows `Generating image: 7%` with a side thumbnail/job state (OBSERVED in a separate screenshot).
8. **Inspect result**: all outputs can be browsed in Generations grid; media can be iterated on or taken into editing (DOCUMENTED).
9. **Assemble video**: Final Cut supports clip rearrangement, splitting, trimming and export, manually or via Agent (DOCUMENTED).

**Suggested state definitions for a comparable product**: `draft`, `analyzing_inputs`, `planning`, `needs_clarification`, `awaiting_approval`, `queued`, `running`, `completed`, `failed`, `canceled`, `reviewed`, `derived`. Recommended explicit transitions: every paid run must have a cost estimate before `running` unless the user previously permitted an automatic-spend policy.

**Critically distinct controls:** the *reasoning model* (e.g. Sonnet 5.5) differs from the *generation model* (e.g. GPT Image 2); *optimization preference* (quality, speed, cost) differs from *generation autonomy* (ask vs automatic). These are three independent configuration axes and should not be merged into a single model selector.

## 3. Component taxonomy

| Component | Layer | Description | Essential states |
|---|---|---|---|
| Product-domain segmented switch | Shell | Creative / Ads / Dev | active, hover, focus |
| Navigation group/link | Shell | Icon + label for Home, Agent, Tool, etc. | default, active, hover, disabled |
| Sidebar collapse button | Shell | Condense or expand navigation | expanded, collapsed |
| New Chat action | Shell | Clear new-session entry point | default, hover |
| Navigation divider | Shell | Low-contrast section separation | static |
| Recent conversation row | Shell | Truncated name + icon/preview | active, hover, context-menu |
| Chat / Session view toggle | Shell | Segmented selector | selected, not-selected |
| Referral banner | Shell | Supplemental invite growth card | default, dismissible if supported |
| Profile / workspace menu | Shell | Identity, plan, account access | closed, open |
| Media workspace tabs | Workspace | Generations / Cuts | active, inactive |
| Workspace utility icons | Workspace | Filter, layout, open/expand | default, toggled |
| Generation display | Workspace | Large output preview / processing surface | empty, pending, in-progress, ready, error |
| Job thumbnail rail | Workspace | Quick-select generation/job | pending, selected, ready, failed |
| Processing indicator | Workspace | Percent/status label | queued, progressing, complete, error |
| Reference attachment grid | Agent | Image thumbnails inside user prompt context | selected, analyzed, missing |
| Analysis status | Agent | `Analyzed 3 images` | loading, success, error |
| User message bubble | Agent | Natural-language instruction | normal, selected |
| Agent response text | Agent | Explains plan, next steps, errors | streaming, complete |
| Tool action card | Agent | Typed operation + settings + cost | draft, awaiting approval, running, done, failed |
| Operation metadata | Agent | Model, ratio, quality, credits | valid, invalid, edited |
| Approve button | Agent | High-salience cost-bearing action | enabled, loading, disabled, confirmed |
| Composer | Agent | Multi-line input fixed to bottom | empty, focused, typing, busy |
| Attach menu | Agent | Image/video/reference picker | closed, open, uploading |
| Reasoning-model selector | Agent | Sonnet/Opus/etc. selection | closed, open, chosen |
| Optimization/autonomy selector | Agent | Ask/auto; quality/speed/cost/custom | current, changed |
| Stop button | Agent | Interrupt active response/task | available, unavailable |
| Timeline canvas | Cut | Video/audio layers and clips | empty, editing, exporting |
| Asset card | Library | Persistent output artifact | processing, ready, favorite, error |

### Strong component pattern: a declarative transaction card

The `Generate Image` card is not just presentation. It is a **human-readable, typed representation of an action** that could usefully map to a backend operation:

```json
{
  "action": "generate_image",
  "inputs": [{"kind":"reference_image","asset_id":"..."}],
  "prompt": "Three full-frontal silhouettes, backlit, fine airborne dust ...",
  "model": "gpt-image-2",
  "settings": {"aspect_ratio":"16:9", "quality":"high"},
  "estimated_credits": 20,
  "approval_state": "awaiting_approval",
  "idempotency_key": "<server-generated-job-key>"
}
```

The UI and execution engine should share a canonical action schema, with server validation and idempotency; otherwise agent text can disagree with billing or actual execution parameters.

## 4. Visual design language

These are **approximate samples from user screenshots, not official tokens**:

| Token concept | Sample | Usage |
|---|---|---|
| `surface.app` | `#000000` | outer workspace and chat background |
| `surface.sidebar` | `#141416` | primary left navigation |
| `surface.canvas` | `#1A1C1F` | dominant preview/editor canvas |
| `surface.selected` | `#292A31` | selected sidebar row / small chip |
| `surface.input` | `#292A31` to `#2A2A31` | conversation composer and interactive surface |
| `action.primary` | `#2800EF` | approval CTA / prominent action |
| `text.primary` | near-white | primary content |
| `text.secondary` | muted slate gray | metadata and supporting descriptions |

**Geometry and rhythm (estimated):** ~248 px expanded left rail in its standalone screenshot; right chat panel screenshot width ~366 px; central preview screenshot width ~1254 px. These are **capture dimensions**, not proof of fixed layout constraints. Layout follows a compact 4/8 px rhythm, ~36 px navigation rows, pill-shaped segmented selectors, ~10–12 px row and CTA corners, ~18–22 px operation-card corners, small geometric iconography, subdued dividers, and text-first organization. The user-visible sample displays a dense dark creative SaaS UI: high emphasis on artboard and action, lower emphasis on chrome.

**Typography:** likely modern sans-serif with approximately 13–14 px navigation and body text, 11–12 px metadata, and 15–16 px emphasis. The exact font and CSS values cannot be established from flattened screenshots.

**Hierarchy:** bright body text > subdued metadata > charcoal surfaces. Saturated purple is reserved for a consequential primary action; the rest of the interface stays largely monochromatic.

## 5. UX strengths

- **Clear division of cognitive labor**: user intent and agent decisions on right, visual inspection in center, broad navigation left.
- **Structured approvals for credit-bearing work**: exposes cost and parameters before execution when ask-first is selected.
- **Agent / Tool duality**: caters to newcomers who describe outcomes and specialists who need direct controls.
- **Persistent creative context**: references, natural-language iteration, and results remain associated with the session.
- **Progressive disclosure**: advanced routing and controls sit behind compact selectors rather than always-expanded forms.
- **Scalable creation model**: workflows, branded references, and projects lift isolated generations into reusable production systems.
- **Strong artifact orientation**: media can be examined in a large dedicated viewport instead of buried as chat attachments.

## 6. UX concerns and recommended changes

| Priority | Finding | Evidence / confidence | Recommended response |
|---|---|---|---|
| P0 | Distinction between planning model and generation model may be unclear | Different names in composer vs job card; OBSERVED | Label selectors `Agent reasoning` and `Generation model`; show a brief tooltip on first exposure. |
| P0 | Credit cost could be hard to contextualize | `20 credits` shown, not fiat-equivalent; OBSERVED | Provide expected balance after run and optional currency-equivalent or price-per-credit context. |
| P1 | Generated task progress lacks operational explanation | `7%` without stage/ETA in screenshot; OBSERVED | Show queued / preparing / rendering / postprocessing stage, and truthful dynamic ETA only if reliable. |
| P1 | `Chat` vs `Session` naming can be ambiguous | Adjacent selector in sidebar; OBSERVED | Add description/hover help; clarify what scope and history each includes. |
| P1 | Rich prompts and cards squeeze into narrow right panel | Long multiline text within ~366 px crop; OBSERVED | Allow chat-panel resizing and expandable plan/card inspector. |
| P1 | Selected generation visibility could improve | Small right-side job thumbnail in screenshot; OBSERVED | Add explicit generation labels, keyboard navigation, and visible previous/next states. |
| P1 | Important settings are compact but hidden | Bottom composer uses terse `Ask · Quality`; OBSERVED | Use discoverable popovers with explanatory help and active-cost impact. |
| P2 | Dark muted text and small targets may be inaccessible | VISUAL RISK ONLY | Test actual WCAG contrast and keyboard targets in live app; do not assert violations based on screenshots. |
| P2 | All-or-nothing approval for batches may slow complex projects | Ask/auto policies DOCUMENTED | Offer batch approval with hard credit ceiling and per-job cancellation. |
| P2 | `High` quality does not specify actual output dimensions | Quality label in card; OBSERVED | Show final resolution, model-native limits, and upscale behavior. |

**Screenshot-only limitations:** cannot confirm keyboard semantics, responsive breakpoints, accessible names, scroll traps, hover menus, live job cancellation, actual focus order, pricing conversion, full color contrast, agent tool-call reliability, or billing/refund edge cases.

## 7. Implementation approach for a comparable product

### Functional architecture

- **Shell module**: product-domain switcher, navigation, selected item, account and credit state.
- **Session module**: conversation history, user requests, references, asset provenance.
- **Agent orchestration module**: reasoning model, quality/cost/speed objective, autonomy policy, structured proposal and decision log.
- **Execution module**: model registry, parameter validation, idempotent jobs, cost estimation, credit holds, status streaming, error and refund handling.
- **Media module**: asset library, previews, generations grid, versions and comparisons, provenance.
- **Editor module**: timeline, non-destructive cuts, render, export and agent-mediated editing.
- **Reusable knowledge module**: projects, brand kits, templates, skills and workflows.

### Responsive strategy (RECOMMENDED, not Runway-observed)

- **Wide desktop**: persistent sidebar + canvas + resizable agent.
- **Standard laptop**: collapsible icon rail + canvas + 360–420 px agent drawer.
- **Tablet**: one primary surface, overlay chat drawer and persistent media state.
- **Phone**: primary Chat / Canvas segmented navigation with bottom composer; task approvals displayed as compact cards.

### Data integrity requirements

1. Every action card must display backend-validated model, parameters, and maximum estimated cost.
2. Approval must be linked to a snapshot of parameters (a changed model or cost invalidates approval).
3. Show job-level transitions and handle retries without duplicate credit charges.
4. Preserve input image IDs, model version, prompt, seed when available, outputs, and parent-child derivation lineage.
5. Make failed and partially completed workflow jobs recoverable rather than requiring total restart.
6. Make the billing and autonomy model auditable per job.

## 8. Design recommendation

Borrow the architectural ideas, not just the dark UI. A strong alternative could improve on Runway by combining **a resizable right-side agent, an editable action manifest, multi-variant comparison, a visual job queue, clear model-vs-agent labeling, and a user-enforced budget cap**. Its most valuable unit of UX is not a prompt field; it is an **inspectable, reversible, budget-aware creative action**.

## References

- Runway, [Creating with Runway Agent](https://help.runwayml.com/hc/en-us/articles/51601639579667-Creating-with-Runway-Agent)
- Runway, [Navigating Runway](https://help.runwayml.com/hc/en-us/articles/24298206897043-Navigating-Runway)
- Runway, [Building and running Workflows with Agent](https://help.runwayml.com/hc/en-us/articles/53645211363475-Building-and-running-Workflows-with-Agent)
- Runway, [Trimming and Assembling Clips in Studio](https://help.runwayml.com/hc/en-us/articles/52685547867667-Trimming-and-Assembling-Clips-in-Studio)
- Runway, [Using Brand Kits with Agent](https://help.runwayml.com/hc/en-us/articles/53908585609235-Using-Brand-Kits-with-Agent)


---

# Extension: Runway Agent Chat Intelligence, Model Routing, and Execution UX

**Research date:** 2026-11-01. **Evidence:** Runway's engineering interview (2026-07-17), Runway Agent help, Runway Agent Skills, Runway Agent Workflows, Runway references and document help, Runway Dev Model Router guide (updated 2026-10-19), and July 2026 agent benchmarks. **Separation:** `[D]` documented public feature, `[O]` visible in supplied screenshot, `[I]` reasoned inference, `[P]` proposed design. Neither internal source code nor Runway's private system prompts, weights, embeddings or runtime traces have been disclosed.

## A. Executive findings

1. `[D]` Runway Agent combines a **conversational reasoning model**, **encoded professional creative expertise**, **knowledge of generative-model specialties**, and a **skills/workflow layer**. Engineering explicitly describes knowing which models render motion, photorealism, or faster but less precisely, and combining those capabilities into practical creative workflows. This is more than an LLM with a generate-image API button.
2. `[D]` The user may choose a conversational model independently from a media-generation model: Sonnet 5.5 (fast); Opus 5.5 (24 credits per chat message); GPT-6 Astra (40 credits per chat message), according to current documentation. Media-generation credits are separate. The UI selects media models for each step, subject to capability and optimization preferences.
3. `[D]` Chat input can include natural language, multiple references, documents, campaign metrics, prior assets, and skills; the agent can ask questions, brainstorm, produce action proposals, generate, edit and assemble a final Cut.
4. `[D]` Runway Dev's separate Model Router filters incompatible models, then optimizes eligible choices for quality, cost or latency. In quality mode, it uses prompt-aware internal benchmarks informed by professional creatives. The publicly documented Dev Router is **not proven to be the exact backend implementation** of the consumer Agent; avoid presenting them as identical.
5. `[D]` Ask-before-generation and automatic generation are user-selectable. Approval shows model, prompt and estimated cost. Desktop defaults to Quality optimization; mobile to Speed. Custom instructions are soft preferences, not non-negotiable guarantees.
6. `[D]` Agent's media-first UI centers generation artifacts, not chat transcripts. Generated assets are browsable independently of long conversations, can be dragged back into chat, and multi-shot work can be assembled and edited on a timeline.
7. `[D]` Runway itself warns about output variance, model mistakes, performance degradation in very long chats, and credit cost of imperfect generations. Reference files are session-local unless explicitly saved. Brand Kits as session-level context are an Enterprise feature.
8. `[P]` The best transferable architecture is an intent compiler, multimodal reference resolver, professional creative planning layer, hard-constraint capability router, user approval & budget guard, asynchronous media pipeline, multimodal QA, and versioned artifact graph.

## B. Evidence-based functional architecture

```text
User message + @references + documents + project context + /skills
  -> input normalization + file/reference resolution
  -> [reasoning model] understand goal and missing constraints
  -> [creative expertise/skills] storyboard or edit strategy
  -> [model knowledge] choose compatible media generator(s)
  -> [spend policy] either propose action with cost OR automatically execute
  -> generation/edit/voice/music/workflow tools
  -> persistent generation assets + timeline Cut
  -> user inspection and correction -> next agent turn
```

This is a **functional reconstruction**, not a disclosed sequence diagram. Public materials confirm all major **capabilities**, not the underlying services, message format, tool schemas, confidence algorithms, chain-of-thought, or database layout.

### Roles and boundaries

| Layer | What it decides | Evidence | Implementation consequence |
|---|---|---|---|
| Chat reasoning model | How to interpret intent, converse, and plan | [D] | Keep conversation-model selection independent from media models |
| Vision/document interpretation | Relevant content of images, audio, video, PDFs, CSVs, etc. | [D] | Track each referenced asset explicitly, don't rely on positional guesses |
| Creative skills | Which sequence of production actions achieves the brief | [D] | Use versioned, testable domain workflow instructions |
| Media model selection | Which generative model can execute each action | [D] | Require capability registry and policy gates |
| Approval + cost | Whether to execute and charge | [D] | Require explicit spend authorization or scoped automatic-spend grant |
| Jobs | Run operations and report status/cost/errors | [D] | Idempotent tasks, durable state transitions, retries |
| Output/artifact graph | Store, inspect, reuse, edit outputs | [D] | Maintain lineage and an asset-centric center workspace |
| Multimodal QA | Determine whether result is actually acceptable | [P] | Independent validators and human feedback, not blind trust in LLM self-rating |

## C. Intent understanding: observed example and proposed compiler

Example from user's screenshots: 3 uploaded people references + request for *three frontal standing backlit silhouettes, straight shoulders, fine dust in air, no visible faces or bodies*. The interface shows a reference analysis acknowledgement, a text summary, and a structured Generate Image action of 16:9, High, GPT Image 2, 20 credits. `[O]`

Recommended typed interpretation `[P]`:

```json
{
  "intent": "generate_image",
  "subject_count": 3,
  "reference_roles": ["person_1", "person_2", "person_3"],
  "constraints": {
    "hard": ["exactly_three_subjects", "frontal", "face_not_visible", "body_only_silhouette"],
    "soft": ["backlighting", "airborne_dust_visible", "straight_shoulders"]
  },
  "output": {"aspect_ratio": "16:9", "quality": "high"},
  "requires_approval": true,
  "source": "reconstructed from screenshot, not Runway's internal JSON"
}
```

Recommended understanding stages `[P]`:
1. Detect the requested **operation** (analysis, brainstorming, generation, edit, multi-shot, workflow, export).
2. Parse **object roles**: subject, identity, environment, motion, style, output, references, negatives.
3. Resolve `@Image 1` and asset handles to stable IDs; explicitly retain ordering and permissions.
4. Extract **immutable constraints** from creative preferences; never dilute hard preservation rules into soft scoring weights.
5. Pull relevant session state, user-approved defaults, project/brand context, and recent outputs, with source priority and conflict tracking.
6. Ask clarifying questions only if ambiguity affects feasibility, cost, or a high-impact creative decision. Example proposed criterion: `P(wrong)*loss > friction(asking)`; this is **not a published Runway formula**.
7. Emit an inspectable, typed action plan with candidate models, estimates and approval requirements.

Avoid assuming Runway uses OCR, CLIP, vector embeddings, RAG, a particular VLM, or a specific prompting template; no public source confirmed those implementation details.

## D. Runway Dev Model Router: verified mechanics vs proposed scoring

`[D]` As documented in Runway's 2026-10-19 updated model selection guide:
- Configure an eligible model list and either automatically accept new releases or use a strict allowlist.
- Optionally set max credits **per generation and modality**, including image/video/audio.
- Choose exactly one optimization goal: quality, cost or latency.
- At runtime first eliminate models incompatible with the request and policy; then choose the top available candidate for the optimization goal.
- Quality routing analyzes prompt semantics against internal expert-created benchmark information; the individual benchmark measurements and formula weights are unpublished.
- Optional fallback on model capacity; dry-run routing returns a selected model and estimated cost without spending credits; a completed job has a routing record explaining selected model.
- Model-agnostic inputs such as duration, resolution, aspect ratio; `configId` selects a router. Routes include `/v1/generate/video`, `/v1/generate/image`, `/v1/generate/audio`.

**Do not conflate:** Consumer Runway Agent publicly advertises automatic model selection with skill/model knowledge, but there is no published guarantee that it directly calls Runway Dev's Model Router. The latter is a practical API option for building a similar system, and is useful independent engineering evidence about Runway's philosophy.

### Scoring for a comparable platform `[P]`

First hard-filter: `M_eligible = {m : supports(required modality, refs, duration, ratio, resolution, edit primitives) AND authorized AND estimated_credits <= cap}`.

Then score *normalized* candidates:

`S(m, task) = wq*Quality(m,task) + wa*Adherence(m,task) + wr*Reliability(m) - wc*Cost(m,task) - wt*Latency(m,task)`

- Set weights from user intent (quality-first, budget-first, speed-first), calibrated on real held-out tasks.
- Never treat requested identity preservation, reference count, or spatial fidelity as optional weighted bonuses if the user says these are hard constraints.
- Consider failure probability and expected retry cost, not only the sticker price of a single generation.
- Version every model capability card and evaluation score; expire benchmarks as models update.
- Show **why this model** and **why alternatives were excluded** in an optional explanation panel.

## E. Chat UX and ease of use

### Low-friction progression `[D]`

1. Begin with a short prompt; Agent can request more detail as needed.
2. Add uploaded media by drag/drop or references named via `@`; image/video/audio uploads receive automatically generated labels.
3. Apply a skill with `/` (Ad Campaign, Commercial, Mood Board, Motion Graphic, Resize Image, Social Thumbnail, UGC Video, Workflow) to get a guided, repeatable playbook. Users can turn successful sessions into custom skills with named inputs and output rules.
4. Agent proposes a plan; users can refine with conversation rather than rebuilding a long technical prompt.
5. Approve explicit media actions or choose automatic generation; choose quality/speed/cost/custom preferences.
6. Observe outputs in the **Generations** tab, react visually, and reuse an output as a reference.
7. For multi-shot videos, clips and audio are joined in the timeline and can be manually split, trimmed, re-ordered, or modified through chat.
8. Workflows can be built, modified, found, and executed from the same conversation. The agent reads exposed workflow inputs and requests missing ones.

### Why it feels intelligent `[I]`

It collapses four burdens: composing a production brief, remembering provider-specific model capabilities, connecting tools to create a sequence, and managing iterations. A chat is a low-friction *control surface* for a structured creative state machine, while the visual canvas keeps the evolving deliverable visible.

### Known friction `[D]` + mitigations `[P]`

- Output variability and reference drift: not guaranteed even with the right plan. **Mitigation:** show a constraint checklist and per-criterion QA against references.
- Very long conversations may degrade. **Mitigation:** persistent typed project brief plus pinned facts and references, context compaction, conflict checks, task-scoped subthreads.
- Generations consume credits even if results disappoint; failed jobs receive credits back. **Mitigation:** dry-run estimation, low-resolution previews, hard budgets, retries guarded by projected expected value.
- Custom model preferences are guidance, not strict locks, where a request cannot be satisfied. **Mitigation:** explicit user-controlled hard vs preferred constraints.
- Desktop uses Quality by default, mobile Speed; user may not realize results/cost differ by device. **Mitigation:** display optimization mode in action card, never hide priority switch.
- PDF inputs work for content but embedded imagery must be uploaded separately to use as generation references. **Mitigation:** warn when brief contains inaccessible visual material.
- Very complex work can require edits and multiple renders, not a one-prompt miracle. **Mitigation:** progressive planning, storyboard preview and final assembly, transparent success limits.

## F. Evidence level and benchmarks

Runway's July 2026 engineering interview cites a Physion ARC 1.0 multi-scene benchmark where Agent 2.0 led a set of six agents. This is an early **task-quality** comparison, not an independent measurement of UX effort, user satisfaction, or probability of completing every project without intervention. Later benchmarks/expanded competitor cohorts yield different leaders, so don't interpret that historical result as a permanent market ranking. Independent commentary also reports chapter-to-chapter identity consistency problems and some manual intervention in tested systems. `[D for reported studies; limitations acknowledged]`

Never claim the following are known: exact consumer Agent system prompts; fine-tuning vs prompting; specific embeddings, agent planning algorithm, closed-source tool format; weighted scoring constants; automatic vision-QA gates; autonomous retry logic; persistence/learning from every user interaction; or whether consumer Agent shares the Runway Dev Router implementation.

## G. Recommended v2 architecture for a builder

**Keep minimum viable complexity:** a single high-capability multimodal reasoning agent plus 7 deterministic services is enough to start; avoid an expensive multi-agent council for every chat message.

1. `IntentCompiler`: canonical task JSON, intent slots, hard/soft constraints, uncertainties.
2. `ReferenceRegistry`: reference IDs, provenance, access scopes, immutable roles, thumbnail/proxy, extracted descriptions.
3. `SessionMemory`: typed brief, approved decisions, brand/identity locks, latest accepted artifacts, scoped summary.
4. `CreativePlanner`: template-backed recipes for image edit, scene generation, storyboarding, campaign, multimodal timeline.
5. `CapabilityRouter`: model capabilities + estimated price/latency/quality/reliability; eligibility then ranking; manual override with constraints.
6. `ApprovalLedger`: quote ID, exact proposed action/settings/refs, expiry, budget and idempotency key, ask/auto policy.
7. `JobOrchestrator`: asynchronous queue, progress, provider API adapter, retries on technical failures, versioned outputs.
8. `QualityEvaluator`: objective checks (dimensions, FPS, duration, count, text, identity, temporal geometry) with human acceptance loop.

**Data flow:** `turn -> parsed intent -> resolved assets -> draft plan -> eligibility/ranking -> action quote -> approval -> durable job -> artifact -> evaluations -> suggested next change`.

**Minimal job state machine:** `draft | needs_input | planned | quoted | awaiting_approval | queued | running | succeeded | failed | canceled | reviewed | accepted`. Every transition records the originating message, inputs, cost estimate, actual cost, model version, settings, and output IDs.

### Example action contract `[P]`

```json
{
  "action_id": "act_xxx",
  "operation": "image.generate",
  "input_refs": ["ref_person_1", "ref_person_2", "ref_person_3"],
  "intent_id": "intent_xxx",
  "hard_constraints": ["exactly_3_people", "no_visible_faces"],
  "parameters": {"aspect_ratio": "16:9", "quality": "high"},
  "routing": {"selected_model": "model_id", "alternatives": [], "explanation": "eligible and highest expected adherence under budget"},
  "billing": {"estimated_credits": 20, "budget_authorization": "required"},
  "state": "awaiting_approval",
  "status": "proposed contract, not Runway's private schema"
}
```

## H. Evaluation harness for real product quality `[P]`

Measure user outcomes instead of merely claiming clever reasoning:
- **Task success:** percent of briefs receiving a user-accepted deliverable within the stated budget.
- **Turns to acceptance:** median and p90 conversational turns until acceptance; subtract turns spent on creative exploration when measuring friction.
- **Credits per accepted output:** all costs including failed/abandoned generations, not only the last job.
- **Model regret:** tested quality/cost gap between chosen model and best eligible alternative on the same task class.
- **Constraint adherence:** accuracy of positive, negative, hard, identity, frame/FPS, and camera-motion requirements.
- **Unexpected spend rate:** percent of jobs executed without valid user authorization (target zero).
- **Context retention:** percent of follow-ups retaining approved references, constraints, and identity locks after 25/50/100 turns.
- **Visible trust:** percent of routing decisions with a reproducible explanation and exact final cost.
- **Human-in-the-loop yield:** number of useful variants selected versus total generations.
- **Workflow correctness:** percentage of multi-step plans that actually compile, execute, assemble, and export without missing assets.

Acceptance tests should include: no-reference one-shot; three-reference silhouette; video edit with source motion-lock; 30-second multi-shot ad; high-priced ambiguous job; unsupported model request; user changes instructions mid-job; long conversation with changing references; model outages; rejected generation; duplicate approval clicks; and batch workflow cost overruns.

## I. Product strategy: what to reproduce vs improve

**Borrow:** media-centered canvas, session chat, natural-language intent, explicit proposal cards, two-model separation, `@`-references, `/`-skills, costs and approval, custom preferences, workflows, timeline, reusable assets.

**Improve:** hard vs soft constraints, explainable router choices, user-visible preview-vs-final plan, objective reference/FPS/identity checks, protected budget ceilings across a workflow (not just single jobs), preserved project brief independent of long chat, comparison overlays, version provenance, deterministic cost ledger, and failure-aware adaptive retry.

Pragmatic launch order: **Phase 1** intent compiler + 5-10 model cards + quote approval + one media output; **Phase 2** asset graph + visual quality checks + cheap preview/expensive final; **Phase 3** multi-shot workflows + reusable skills + timeline; **Phase 4** feedback-driven benchmarks + model preference optimization. This order minimizes complexity and credit burn before measurable quality is established.

## J. Sources, checked November 1, 2026

1. Runway, *Inside Our Approach to Building Runway Agent*, 2026-07-17. https://runway.com/news/engineering/inside-building-runway-agent
2. Runway Help Center, *Creating with Runway Agent*. https://help.runwayml.com/hc/en-us/articles/51601639579667-Creating-with-Runway-Agent
3. Runway Dev, *Choosing the right model for your use case*, updated 2026-10-19. https://dev.runwayml.com/learn/choosing-the-right-model
4. Runway Dev, *Runway Model Router*. https://dev.runwayml.com/model-routers
5. Runway Help Center, *Setting custom generation preferences in Runway Agent*. https://help.runwayml.com/hc/en-us/articles/54338359132819-Setting-custom-generation-preferences-in-Runway-Agent
6. Runway Help Center, *Using Agent Skills*. https://help.runwayml.com/hc/en-us/articles/53907039424915-Using-Agent-Skills
7. Runway Help Center, *Building and running Workflows with Agent*. https://help.runwayml.com/hc/en-us/articles/53645211363475-Building-and-running-Workflows-with-Agent
8. Runway Help Center, *Using reference media to guide your generations*. https://help.runwayml.com/hc/en-us/articles/52963720640275-Using-reference-media-to-guide-your-generations
9. Runway Help Center, *Using Brand Kits with Agent* (Enterprise availability). https://help.runwayml.com/hc/en-us/articles/53908585609235-Using-Brand-Kits-with-Agent
10. Runway Help Center, *Uploading Documents and Fonts to Runway Agent*. https://help.runwayml.com/hc/en-us/articles/54355254443923-Uploading-Documents-and-Fonts-to-Runway-Agent
11. Runway Help Center, *Why doesn't my generation match my prompt?*. https://help.runwayml.com/hc/en-us/articles/56617505841939-Why-doesn-t-my-generation-match-my-prompt
12. Runway News, *Introducing Runway Agent*, 2026-05-13. https://runway.com/news/introducing-runway-agent
13. Runway News, *Introducing Agent 2.0*, 2026-06-25. https://runway.com/news/introducing-agent-2
14. Runway News, *Introducing Runway Dev MCP*, 2026-09-02. https://runway.com/news/company-news/runway-dev-mcp
15. LHC, *On one minute of generated film, a benchmark puts Runway in the lead* (secondary evaluation discussion). https://www.lhc.media/en/media/ai-watch/on-one-minute-of-generated-film-a-benchmark-puts-runway-in-the-lead