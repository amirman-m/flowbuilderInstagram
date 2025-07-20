# Database Design

This document describes the relational and ancillary data stores used by the platform.

## Primary Store — PostgreSQL

### Entity–Relationship Diagram (simplified)
```
+------------+     +--------------+     +-----------------+
|   users    |     |    flows     |     | flow_executions |
+------------+     +--------------+     +-----------------+
| id (PK)    |1   n| id (PK)      |1   n| id (PK)         |
| email      |-----| user_id (FK) |-----| flow_id (FK)    |
| name       |     | name         |     | status          |
| role       |     | flow_data    |     | trigger_data    |
| created_at |     | status       |     | execution_log   |
+------------+     | created_at   |     | started_at      |
                   +--------------+     | completed_at    |
                                         +-----------------+
```

### Tables
1. `users` — account information & role.
2. `flows` — JSONB column `flow_data` stores the full flow graph.
3. `node_types` — catalog of available node definitions.
4. `flow_executions` — run-time logs and status.
5. `api_tokens` — encrypted Instagram / FB tokens per user.

### Indexing Strategy
- `flows (user_id)` — quick workspace listing.
- GIN index on `flows.flow_data` for JSONB path queries.
- `flow_executions (flow_id, started_at DESC)` for recent runs.

### Migrations
- Managed with **Alembic** (`alembic revision --autogenerate`).

## Cache & Queue — Redis
- **Purpose**: Celery broker & result backend, short-lived session cache.
- TTL for session keys: 24 h.

## Vector Store — Pinecone / Weaviate
- Namespace per user.
- Up to 1536-dim embeddings (OpenAI / Instructor).

## Backup & Disaster Recovery
| Resource | Frequency | Retention |
|----------|-----------|-----------|
| PostgreSQL | WAL + nightly snapshot | 14 days |
| Redis | Not backed-up (ephemeral) | — |
| Pinecone | Managed snapshots | 7 days |

## Data Privacy
- PII encrypted at rest (AES-256, pgcrypto).
- GDPR deletion pipeline removes user data and retrains KB.
