# Runway-inspired UX reference distilled from owner-provided research
Owner provided 4 research assets (dated 2026-11-01): `runway_ui_blueprint(2).json`, `runway_ux_ia_component_audit(1).md`, `runway_ui_agent_architecture_v2(2).json`, `runway_ux_ia_agent_intelligence_v2(1).md`.
These were inferred from screenshots and Runway public documentation, **not official source code or verified token definitions**. We use the information architecture, not proprietary branding/layout assets.

## Core shell
Left rail: domain switch (if applicable later), new chat, navigation, recent sessions, user/account status.
Center workspace: Generations/Cuts tabs, large media canvas, side generation thumbnails, running/failed/completed states, eventual timeline editor.
Right agent: attachments/reference grid, user and agent messages, inspectable generation proposal, model alternatives, credit cost, approval, composer, optimization preference and ask/auto policy.
Approximate screenshot samples: background #000000, sidebar #141416, canvas #1A1C1F, selected #292A31, accent sampled #2800EF; these are not official tokens. Whoush uses its own purple identity and visual system.

## Information architecture
Initial: Home, Agent, Tool/manual mode eventually, Projects, Assets, Workflows, Brand Kits, Cuts. Runway references also list Ads, Dev, App Studio, Plugins, More; they are intentionally NOT MVP for Whoush because Whoush only produces image/video.
Entity set: Account, Workspace, Project, Session, Message, Reference, GenerationProposal, GenerationJob, MediaAsset, Cut, Workflow, BrandKit.

## Agent phases
IntentCompiler → ReferenceRegistry → SessionMemory → CreativePlanner → CapabilityRouter → ApprovalLedger → JobOrchestrator → QualityEvaluator.
One private LLM lead backed by deterministic services, not a panel of unnecessary agents. Distinguish agent reasoning model (PRIVATE) from image/video generation model (CUSTOMER VISIBLE). Quality/cost/speed optimization is separate from ask/auto spend authorization.
Core states: draft, needs_input, planned, quoted, awaiting_approval, queued, running, succeeded, failed, canceled, reviewed, accepted. Map to the DB worker state vocabulary with explicit transitions.

## Exact customer operation pattern
User prompt and attached media IDs → agent writes a plain-language plan and a typed action proposal with references, model/configuration, fixed integer Neuron price, and approve button → canvas displays queued, running, output and progress phases → user inspects and asks for edit or a variation. Approved quote parameters are immutable; editing model/ratio/etc. invalidates quote.

## Improvements over reference
Resizable right panel, first-class source locks, model recommendation transparency, before/after compare, deterministic credit holds and refunds, no misleading percentage ETA, persistent version lineage, mobile RTL/Bidi. Use design tokens and accessibility verification, not approximate screenshot pixels as gospel.

## Evidence source URLs
- https://help.runwayml.com/hc/en-us/articles/51601639579667-Creating-with-Runway-Agent
- https://help.runwayml.com/hc/en-us/articles/24298206897043-Navigating-Runway
- https://help.runwayml.com/hc/en-us/articles/53645211363475-Building-and-running-Workflows-with-Agent
- https://runway.com/news/engineering/inside-building-runway-agent
