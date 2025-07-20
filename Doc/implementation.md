# Implementation Guide

This guide walks engineers through setting up the repository, running the stack locally, and adding new functionality.

---
## 1. Repository Layout
```
root/
 ├─ frontend/            # React app (Vite)       
 │   ├─ src/
 │   └─ ...
 ├─ backend/
 │   ├─ app/
 │   │   ├─ api/         # FastAPI routers
 │   │   ├─ core/        # Auth, config, deps
 │   │   ├─ nodes/       # Node classes (BaseNode, etc.)
 │   │   ├─ exec/        # Flow executor logic
 │   │   └─ workers/     # Celery tasks
 │   └─ tests/
 ├─ infra/
 │   ├─ docker-compose.yml
 │   ├─ k8s/             # Helm chart
 │   └─ migrations/      # Alembic
 └─ docs/                # This folder
```

---
## 2. Local Development
```bash
# Pre-req: Docker Desktop
make up          # launches Postgres, Redis, Pinecone-local, MinIO
make backend-dev # uvicorn --reload at http://localhost:8000
make front-dev   # Vite dev server at http://localhost:5173
```

Environment variables are loaded from `.env.dev` by **Pydantic Settings**.

---
## 3. Running Tests
```bash
pytest -q        # unit tests
make e2e         # Playwright tests for frontend
```

---
## 4. Adding a New Node
1. **Backend** – create `backend/app/nodes/my_node.py`:
```python
class MyNode(BaseNode):
    input_schema = {...}
    output_schema = {...}
    settings_schema = {...}

    def execute(self, input_data, settings):
        # do work
        return {...}
```
2. Register in `node_registry.py`:
```python
register_node(MyNode)
```
3. **Frontend** – no code needed. Palette auto-downloads `/node-types`.
4. Write unit test under `tests/nodes/`.

---
## 5. Deployment Pipeline
1. **GitHub Actions**: on push to `main`
   - `docker build` both `frontend` & `backend` images
   - push to GHCR (or ECR)
2. **Helm Upgrade** to Kubernetes dev/stage/prod:
```bash
helm upgrade sm-automation ./infra/k8s -f values-prod.yaml
```

---
## 6. Release Process
- Semantic versioning (`v1.2.0`).
- CHANGELOG generated with `conventional-changelog`.

---
## 7. Coding Standards
- **Python**: black, isort, ruff, mypy (strict)
- **TypeScript**: eslint, prettier, strictNullChecks
- **Commits**: Conventional Commits (`feat:`, `fix:` ...).

---
## 8. Monitoring & Observability
- Metrics auto-exported via `PrometheusFastApiInstrumentator`.
- Logs: `structlog` JSON → Loki.
- Traces: OpenTelemetry (Jaeger exporter).

---
## 9. CI/CD Secrets
- Stored in GitHub OIDC → cloud KMS.
- Never commit `.env` files with secrets.
