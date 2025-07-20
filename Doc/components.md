# Component Breakdown

This document lists all major logical components in the platform and their responsibilities.

| # | Component | Layer | Tech | Description |
|---|-----------|-------|------|-------------|
| 1 | **Flow Builder** | Front-end | React, React-Flow | Drag-and-drop UI for creating automation graphs. |
| 2 | **Node Library** | Front-end | JSON from `/node-types` | Palette of available nodes, automatically generated from backend. |
| 3 | **Node Inspector** | Front-end | MUI Drawer | Shows input/output schema & settings of selected node. |
| 4 | **Execution Console** | Front-end | WebSocket client | Streams real-time logs for node/flow runs. |
| 5 | **API Gateway** | Edge | NGINX / Traefik | SSL, routing, rate-limiting, JWT validation. |
| 6 | **Auth Service** | Back-end | FastAPI | Issues/refreshes JWT, manages OAuth providers (Google, GitHub). |
| 7 | **Node Engine** | Back-end | FastAPI module | Dynamically loads & executes node classes, validates schemas. |
| 8 | **Flow Executor** | Worker | Celery | Orchestrates full-flow execution using DAG order, persists logs. |
| 9 | **Webhook Handler** | Back-end | FastAPI route | Receives callbacks from Instagram and other trigger sources. |
|10 | **Vector Service** | Microservice | FastAPI + Pinecone SDK | Handles embedding & similarity queries for RAG nodes. |
|11 | **Scheduler** | Worker | Celery beat | Executes cron-based Trigger nodes. |
|12 | **Admin UI** | Front-end | React / MUI | Internal panel for node registry & monitoring. |
|13 | **Monitoring** | Infra | Prometheus + Grafana | Metrics, logs, alerting. |

## Component Interaction Diagram
```
Flow Builder ─┐            ┌──► Node Engine ───► External APIs
Node Library ─┤  REST/WS   │
Node Inspector┤────────────┤
Execution UI ─┘            │
                         Flow Executor (Celery) ──► Redis
                                            │
                                            ▼
                                         PostgreSQL
```
