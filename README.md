# AI Civilization Engine

[![events-contracts](https://github.com/parkershamblin/ai-civilization-engine/actions/workflows/events-contracts.yml/badge.svg)](https://github.com/parkershamblin/ai-civilization-engine/actions/workflows/events-contracts.yml)
[![event-service](https://github.com/parkershamblin/ai-civilization-engine/actions/workflows/event-service.yml/badge.svg)](https://github.com/parkershamblin/ai-civilization-engine/actions/workflows/event-service.yml)
[![minecraft-service](https://github.com/parkershamblin/ai-civilization-engine/actions/workflows/minecraft-service.yml/badge.svg)](https://github.com/parkershamblin/ai-civilization-engine/actions/workflows/minecraft-service.yml)
[![agent-service](https://github.com/parkershamblin/ai-civilization-engine/actions/workflows/agent-service.yml/badge.svg)](https://github.com/parkershamblin/ai-civilization-engine/actions/workflows/agent-service.yml)
[![government-service](https://github.com/parkershamblin/ai-civilization-engine/actions/workflows/government-service.yml/badge.svg)](https://github.com/parkershamblin/ai-civilization-engine/actions/workflows/government-service.yml)
[![dashboard](https://github.com/parkershamblin/ai-civilization-engine/actions/workflows/dashboard.yml/badge.svg)](https://github.com/parkershamblin/ai-civilization-engine/actions/workflows/dashboard.yml)

Autonomous LLM-driven villagers live inside Minecraft. **Current arc: Red vs
Blue** ([ADR-10](docs/architecture/10-red-vs-blue.md)) — two teams of three
race, fully unattended, to the first crafted iron pickaxe: local llama
deliberates every 10–20 seconds, the body executes survival reflexes and tool
chains, and every milestone is judged from an append-only event ledger (the
win is a ledger event with a causation chain, not a screenshot). The earlier
civilization arc — personalities, memories, relationships, elections — is
intact and mothballed behind a compose profile. Every action is an immutable
event; the event stream is the integration seam between services, the source
of truth for analytics, and the raw material for the video series.
Live scoreboard: `http://localhost:3000/race`.

**The race has been won — on Easy and on Normal.** First honest 3v3
completion 2026-07-18: red's Elara crafted the iron pickaxe in **6 minutes
0.4 seconds** (Easy). Same day, the ADR's flagship difficulty fell: red's
Wren won at **Normal in 14m41s** (attempt `019f7352-03ae…`, blue led the
first two rungs). Six llama3.1:8b-driven villagers, zero human intervention
after the starting gun, every rung a ledger event, honest-race assertion
clean both times (zero token-budget trips, zero fake-provider decisions).
Replay the first win's receipt:

```sh
curl "localhost:8081/events?aggregate-type=Attempt&aggregate-id=019f7337-977e-738e-8d5a-bf8e1db77439"
```

One command runs a fresh race end-to-end, preflight checklist included:
`node scripts/race-rb2.mjs --label my-race` (add `--difficulty normal`,
`--mobs` for hostiles). Film rig: `film/pov-grid.html` + `POV_VIEWER=1`.

**The architecture package lives in [docs/architecture/](docs/architecture/00-system-overview.md)** —
system overview, DDD domain model, database DDL, Kafka/event design, API design,
repo/DevOps layout, and the milestone roadmap.

## Quickstart

Prerequisites:

- **Docker Desktop** (WSL2 backend) — the whole backbone runs in Compose
- **A local Minecraft 1.21.6 server** on `:25565` with `online-mode=false`
  (this repo assumes the host-run server in `../Minecraft 1.21.6 Server`;
  a containerized PaperMC profile exists as an alternative)
- **Node 22+**, **go-task** (`winget install Task.Task`)
- Optional: **Ollama** with `llama3.1:8b` + `nomic-embed-text` pulled
  (the LLM chain degrades openai → ollama → fake; blank API key is fine)

```sh
cp .env.example .env        # fill OPENAI_API_KEY or leave blank for Ollama
task up                     # infra: Postgres+pgvector, Redis, Redpanda, Prometheus, Grafana
task smoke                  # canary: one bot connects to the MC server and chats
```

Consoles once `task up` is green: Redpanda console `:8085`, Grafana `:3001`
(admin/admin), Prometheus `:9090`.

## Live demo (`/demo`)

A single recruiter-facing screen that reads in ten seconds — the world as the
visual anchor, the race, and, leading everything, the **event-sourcing audit
trail**: an always-climbing "events in ledger" counter and a plain-English
activity feed make the claim concrete — every milestone is a stored event with a
causation chain, nothing on screen is a screenshot. Each panel is self-fetching
and degrades to a labelled "reconnecting" state; nothing user-facing can take
down the fleet.

```sh
task demo                          # full stack + dashboard at http://localhost:3000/demo
node scripts/race-rb2.mjs --mobs   # (separately) run a live 3v3 race to watch it fill in
```

`task demo` rebuilds the demo's two services (the ledger-count and retrieval
endpoints), seeds the filmed flagship take into the ledger so the result card is
reconstructed from real events, then runs the dashboard. When no race is
running, the race panel shows that flagship result (Normal + hostiles, blue in
11:00.6, honest-race CLEAN). For a clean 1080p recording without the dev
overlay, `npm run build && npm run start --workspace @civ/dashboard` instead.

**Panels:** a live world view (a 2D map plotting racer positions straight from
`VillagerMoved` ledger events — the audit trail as a picture), the race
scoreboard, event-pipeline throughput + the ledger counter, per-agent pgvector
memory retrievals, and the plain-English feed with each row expandable to its
raw ledger event. Small badges name the stack behind each panel (Redpanda,
PostgreSQL, pgvector, Prometheus).

**World view — the 3D note.** The default is the 2D ledger reconstruction (safe,
always works). An optional 3D prismarine-viewer runs as a *separate*,
crash-contained spectator process (`task demo:pov`); it stays off by default and
will not render until upstream ships MC 1.21.6 support (prismarine-viewer
[#473](https://github.com/PrismarineJS/prismarine-viewer/issues/473) /
[#475](https://github.com/PrismarineJS/prismarine-viewer/pull/475) are open,
unreleased). If it ever crashes, the slot fails over to the 2D map automatically.

<!-- TODO: add a 1920x1080 screenshot of /demo mid-race at docs/img/demo.png and embed it here -->

## Layout

```
apps/dashboard/        Next.js dashboard + live SSE feed
services/              the microservices (see docs/architecture/00-system-overview.md):
                         agent-service        Python/FastAPI — villager tick loop (LangGraph)
                         memory-service       Python/FastAPI — pgvector memory stream
                         minecraft-service    Node/TS — the single world executor (mineflayer)
                         event-service        Java/Spring — append-only event ledger + SSE
                         government-service   Java/Spring — elections & governments
packages/events/       JSON Schema event contracts — single source of truth
infrastructure/        docker compose, prometheus/grafana config
experiments/           archived PoCs — the empirically-proven mineflayer version pin
docs/architecture/     the full design package (00–09)
scripts/               repo-level utilities (smoke canary, fleet spawn/despawn)
```

## Status

**Milestone 1 (walking skeleton) — complete.** Event contracts + codegen,
event-service ledger with read API and SSE, minecraft-service bot host and
command executor, pgvector memory, the LLM provider chain, the LangGraph tick
loop, and the Next.js dashboard — a full perceive→deliberate→act→reflect loop
with observability ([demo](docs/demo-sprint-1.md), [M1 demo](docs/demo-m1.md)).

**Milestone 2 (governance) — complete and merged.** government-service owns the
clock-driven election state machine and idempotent ballot box; villagers
nominate, campaign, and vote through the ledger. Mayor Bram is seated and the
fleet is ticking ([M2 plan](docs/architecture/08-m2-plan.md),
[M2 demo](docs/demo-m2.md)).

**Survival cluster — in flight (not yet deployed).** Peaceful→easy survival:
eat/craft/hunt/cook, fight-or-flee, death awareness, staged training-wheel
removal. SV-1 (contract commit) and SV-2 (sustained gather sessions) are
merged; SV-3/SV-4 (the craft verb + crafting brain) are next. The filming
gate holds: Episode 2 must be filmed before the first Survival deploy
([survival plan](docs/architecture/09-survival-plan.md)).

See [docs/HANDOFF.md](docs/HANDOFF.md) for live session-to-session state.
