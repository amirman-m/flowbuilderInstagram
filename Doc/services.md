# Services

This document enumerates internal micro-services and external integrations required by the platform.

## Internal Services
| Name | Runtime | Responsibilities |
|------|---------|------------------|
| **api-gateway** | NGINX / Traefik | TLS termination, routing, auth headers, rate-limiting |
| **auth-service** | FastAPI | OAuth2 login, JWT issuance & refresh, RBAC management |
| **core-api** | FastAPI | CRUD for flows, nodes, executions; serves OpenAPI & WS |
| **worker** | Celery | Runs node executions & scheduled jobs, pushes logs to Redis Streams |
| **vector-service** | FastAPI | Manages embeddings, Pinecone namespaces, similarity search |
| **scheduler** | Celery beat | Triggers cron nodes & cleanup jobs |
| **admin-ui** | React | Internal dashboard for support & node registry |
| **monitoring-stack** | Prometheus, Grafana, Loki | Metrics, dashboards, centralised logs |

## External Integrations
| Provider | Purpose | Auth Method |
|----------|---------|-------------|
| **Instagram Graph API** | Receive webhooks, post comments/DMs | App token + user page token |
| **OpenAI / Anthropic** | LLM completions & embeddings | API key per tenant |
| **AWS S3** | File & KB storage | IAM access key / role |
| **Pinecone / Weaviate** | Vector similarity search | API key |
| **SendGrid (optional)** | Email alerts | API key |

## Service Interactions
```
instagram ▶ webhook ▶ api-gateway ▶ core-api ┐
                                            ▼
                                  Redis (queue) ──▶ worker ──▶ instagram
```

## Deployment Groups
- **Edge**: api-gateway (1+ pods)
- **Web**: core-api (2+ pods, HPA)
- **Workers**: worker (auto-scaled on queue depth)
- **Aux**: vector-service, monitoring-stack

Scaling rules and resource limits defined in the Helm chart per service.
