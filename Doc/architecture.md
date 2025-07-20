# System Architecture

This document provides a high-level view of the Social Media Automation Platform.

## Logical View

```
┌───────────────┐     WebSockets      ┌────────────────┐
│   Frontend    │  ───────────────▶  │  FastAPI App    │
│  (React + TS) │◀───────────────────│  (Python 3.12)  │
└───────┬───────┘                    │ • REST & WS     │
        │ HTTP/REST                 │ • Node Engine   │
        ▼                            │ • Auth Service  │
┌────────────────┐                   │ • Flow Exec     │
│   API Gateway   │◀──── Celery/RMQ ─▶│ • Task Queue    │
│ (NGINX / Traefik│                   └────────┬───────┘
└────────┬───────┘                            │SQLAlchemy
         │                                    ▼
         │                   ┌───────────────────────────┐
         │                   │      PostgreSQL DB        │
         │                   └───────────────────────────┘
         │                                    ▲
         │                                    │Vector
         ▼                                    │Queries
┌────────────────┐   HTTP/REST    ┌───────────────────────────┐
│  Instagram API │◀──────────────▶│  Vector DB (Pinecone)     │
└────────────────┘                └───────────────────────────┘
```

### Data Flow (Example: Comment Auto-Reply)
1. **Trigger** – Instagram calls our webhook when a comment is posted.
2. **Gateway** forwards the POST to `POST /webhooks/instagram/{flowId}`.
3. **FastAPI** enqueues a Celery task with trigger data.
4. **Node Engine** executes nodes in topological order, calling LLM/RAG as needed.
5. **Action Node** sends the reply via Instagram Graph API.
6. Execution log is stored in `flow_executions` table and streamed to the frontend via WebSockets.

## Deployment Topology

| Layer              | Tech                      | Notes                                |
|--------------------|---------------------------|--------------------------------------|
| Browser            | React, React-Flow         | Visual builder, auth, dashboards     |
| Edge / Gateway     | NGINX or Traefik          | SSL termination, rate-limiting       |
| Application        | FastAPI                   | Serves API, WebSockets               |
| Background Workers | Celery + Redis / RabbitMQ | Long-running node executions         |
| Databases          | PostgreSQL, Redis, Pinecone| State, queue, vector search          |
| Object Storage     | AWS S3 / MinIO            | KB files, exports                    |
| CI/CD              | GitHub Actions + Docker   | Build, test, deploy                  |

## Scalability Considerations
* **Stateless API** → horizontal scaling behind load-balancer.
* **Workers autoscale** based on queue length.
* **Database** uses read replicas and connection pooling.
* **Vector DB** is managed service with auto-scaling shards.

## Security Highlights
* OAuth2 with PKCE for user login.
* Instagram Graph API tokens stored encrypted (KMS).
* HTTPS everywhere, CSP & HSTS headers.
* RBAC roles: `admin`, `editor`, `viewer` per workspace.

## Extensibility Mechanism
* New node == new Python class inheriting `BaseNode` + entry in `node_types` table.
* Frontend reads `/node-types` to render palette automatically.
* Zero-downtime deploys via Kubernetes rolling updates.
