# Whoush · هووش

Persian-first conversational creative workspace for **image and video generation through Higgsfield**. The assistant privately routes LLM reasoning; users only see the creative plan, recommended media models and fixed integer Neuron prices.

> Foundation / development preview. No production generation, payments, FX feed or real user auth is enabled. External API use and Iranian end-user access require documented provider approval before production.

## Start

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000/studio or /neurons. `npm run test` checks invariant logic, `npm run typecheck` checks TypeScript.

Read [implementation plan](docs/IMPLEMENTATION_PLAN.md), [Claude handoff](docs/CLAUDE_HANDOFF.md), [architecture](docs/ARCHITECTURE.md), and [launch gates](docs/LAUNCH_GATES.md).
