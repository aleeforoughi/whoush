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