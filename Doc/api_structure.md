# API Structure

This document outlines the REST and WebSocket API for the Social Media Automation Platform.

## Base URL
```
https://api.yourapp.com/v1
```

---
## Authentication
- **Scheme**: Bearer JWT
- **Header**: `Authorization: Bearer <token>`
- **Endpoints**:
  - `POST /auth/login`
  - `POST /auth/refresh`
  - `GET /auth/me`

---
## Endpoints
| Method | Path | Description | Auth | Example Response |
|--------|------|-------------|------|------------------|
| GET | /node-types | List available node definitions | Public | `[ {"name":"InstagramCommentTrigger", ...} ]` |
| POST | /nodes/{node_type}/execute | Test-run a single node | ✔ | `{ "status":"success", "output":{...} }` |
| POST | /flows | Create or update a flow | ✔ | `{ "flow_id":"uuid" }` |
| GET | /flows/{flow_id} | Get full flow config | ✔ | `{ ...flow_json... }` |
| POST | /flows/{flow_id}/execute | Execute flow once with test data | ✔ | `{ "execution_id":"uuid" }` |
| WS | /flows/{flow_id}/ws | Stream execution logs | ✔ | `{ "node_id":"...", "log":"..." }` |
| POST | /flows/{flow_id}/deploy | Activate flow (register webhooks) | ✔ | `{ "status":"deployed" }` |
| DELETE | /flows/{flow_id}/deploy | Deactivate flow | ✔ | `{ "status":"stopped" }` |
| POST | /webhooks/instagram/{flow_id} | Instagram callback (internal) | Secret | `200 OK` |

---
## WebSocket Messages
```jsonc
// Execution Log
{
  "type": "log",       // or "error", "done"
  "execution_id": "uuid",
  "timestamp": "2025-07-19T11:00:00Z",
  "node_id": "node_2",
  "message": "RAG answered in 450ms"
}
```

---
## Error Format
```json
{
  "error": {
    "code": "validation_error",
    "message": "Input 'comment_text' is required",
    "details": [ ... ]
  }
}
```

---
## Rate Limits
| Tier | Limit |
|------|-------|
| Free | 60 req/min |
| Pro  | 600 req/min |

---
## Versioning
- URI-based: `/v1` (current)
- Breaking changes create `/v2`, etc.

---
## OpenAPI / Swagger
- Available at `/docs` (Swagger UI) and `/openapi.json`.

---
## SDKs
- Auto-generated with `openapi-generator` for **TypeScript** and **Python**.
