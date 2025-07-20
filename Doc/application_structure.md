# Web Application Structure & Process Architecture

Based on the analysis of all documentation, this document outlines the complete structure and process architecture for the Social Media Automation Platform without implementation details.

## 1. Overall Application Structure

```
socialmediaFlow/
├── frontend/                    # React + TypeScript Application
│   ├── public/
│   ├── src/
│   │   ├── components/          # Reusable UI components
│   │   │   ├── common/          # Generic components (Button, Modal, etc.)
│   │   │   ├── flow/            # Flow builder specific components
│   │   │   ├── nodes/           # Node rendering components
│   │   │   └── layout/          # Layout components (Header, Sidebar)
│   │   ├── pages/               # Route-based page components
│   │   │   ├── Dashboard/       # Main dashboard
│   │   │   ├── FlowBuilder/     # Visual flow editor
│   │   │   ├── FlowList/        # Flow management
│   │   │   ├── NodeLibrary/     # Available nodes catalog
│   │   │   ├── Executions/      # Execution history & logs
│   │   │   └── Settings/        # User settings & integrations
│   │   ├── hooks/               # Custom React hooks
│   │   ├── services/            # API client services
│   │   ├── store/               # State management (Zustand)
│   │   ├── types/               # TypeScript type definitions
│   │   ├── utils/               # Helper functions
│   │   └── constants/           # App constants
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
│
├── backend/                     # FastAPI Python Application
│   ├── app/
│   │   ├── api/                 # API route handlers
│   │   │   ├── v1/              # API version 1
│   │   │   │   ├── auth.py      # Authentication endpoints
│   │   │   │   ├── flows.py     # Flow CRUD operations
│   │   │   │   ├── nodes.py     # Node operations & testing
│   │   │   │   ├── executions.py # Execution management
│   │   │   │   └── webhooks.py  # External webhook handlers
│   │   │   └── deps.py          # Dependency injection
│   │   ├── core/                # Core application logic
│   │   │   ├── config.py        # Configuration management
│   │   │   ├── security.py      # Auth & security utilities
│   │   │   ├── database.py      # Database connection
│   │   │   └── exceptions.py    # Custom exceptions
│   │   ├── models/              # SQLAlchemy models
│   │   │   ├── user.py          # User model
│   │   │   ├── flow.py          # Flow model
│   │   │   ├── execution.py     # Execution model
│   │   │   └── node_type.py     # Node type registry
│   │   ├── schemas/             # Pydantic schemas
│   │   │   ├── flow.py          # Flow validation schemas
│   │   │   ├── node.py          # Node schemas
│   │   │   └── execution.py     # Execution schemas
│   │   ├── nodes/               # Node implementation system
│   │   │   ├── base.py          # BaseNode abstract class
│   │   │   ├── registry.py      # Node registration system
│   │   │   ├── triggers/        # Trigger node implementations
│   │   │   │   ├── instagram_comment.py
│   │   │   │   ├── instagram_dm.py
│   │   │   │   └── webhook.py
│   │   │   ├── processors/      # Processing node implementations
│   │   │   │   ├── llm_response.py
│   │   │   │   ├── rag_query.py
│   │   │   │   └── text_transform.py
│   │   │   └── actions/         # Action node implementations
│   │   │       ├── instagram_reply.py
│   │   │       ├── send_dm.py
│   │   │       └── webhook_call.py
│   │   ├── services/            # Business logic services
│   │   │   ├── flow_service.py  # Flow management logic
│   │   │   ├── execution_service.py # Execution orchestration
│   │   │   ├── node_service.py  # Node operations
│   │   │   ├── auth_service.py  # Authentication logic
│   │   │   └── integration_service.py # External API integrations
│   │   ├── workers/             # Celery background tasks
│   │   │   ├── flow_executor.py # Flow execution worker
│   │   │   ├── node_executor.py # Individual node execution
│   │   │   └── scheduler.py     # Scheduled tasks
│   │   └── utils/               # Utility functions
│   ├── tests/                   # Test suite
│   │   ├── unit/                # Unit tests
│   │   ├── integration/         # Integration tests
│   │   └── e2e/                 # End-to-end tests
│   ├── alembic/                 # Database migrations
│   ├── requirements.txt
│   └── pyproject.toml
│
├── infra/                       # Infrastructure & deployment
│   ├── docker/
│   │   ├── Dockerfile.frontend
│   │   ├── Dockerfile.backend
│   │   └── docker-compose.yml
│   ├── k8s/                     # Kubernetes manifests
│   │   ├── charts/              # Helm charts
│   │   └── manifests/           # Raw K8s YAML
│   ├── terraform/               # Infrastructure as code
│   └── scripts/                 # Deployment scripts
│
├── shared/                      # Shared resources
│   ├── types/                   # Shared TypeScript types
│   └── schemas/                 # JSON schemas
│
├── docs/                        # Documentation (current folder)
├── .github/                     # GitHub Actions workflows
├── .env.example                 # Environment variables template
├── Makefile                     # Development commands
└── README.md                    # Project overview
```

## 2. Process Architecture Flow

### 2.1 User Journey Flow
```
User Login → Dashboard → Flow Builder → Node Configuration → Flow Testing → Flow Deployment → Monitoring
```

### 2.2 System Process Flow
```
Frontend (React) ↔ API Gateway ↔ FastAPI Backend ↔ Database
                                        ↓
                                 Celery Workers ↔ External APIs
                                        ↓
                                 WebSocket Updates → Frontend
```

### 2.3 Node Execution Process
```
Trigger Event → Webhook/Scheduler → Queue Task → Worker Picks Up → 
Execute Nodes in Order → Store Results → Send WebSocket Update → 
Action Execution → Log Results
```

## 3. Component Architecture

### 3.1 Frontend Component Hierarchy
```
App
├── AuthProvider
├── Router
│   ├── PublicRoutes
│   │   ├── Login
│   │   └── Register
│   └── PrivateRoutes
│       ├── Dashboard
│       ├── FlowBuilder
│       │   ├── Canvas (React Flow)
│       │   ├── NodePalette
│       │   ├── NodeInspector
│       │   └── ExecutionPanel
│       ├── FlowList
│       ├── ExecutionHistory
│       └── Settings
└── GlobalComponents
    ├── Notifications
    ├── LoadingOverlay
    └── ErrorBoundary
```

### 3.2 Backend Service Architecture
```
FastAPI App
├── Authentication Middleware
├── CORS Middleware
├── API Routers
│   ├── Auth Router
│   ├── Flow Router
│   ├── Node Router
│   ├── Execution Router
│   └── Webhook Router
├── Business Services
│   ├── FlowService
│   ├── NodeService
│   ├── ExecutionService
│   └── IntegrationService
└── Background Workers
    ├── FlowExecutor
    ├── NodeExecutor
    └── Scheduler
```

## 4. Data Flow Architecture

### 4.1 Flow Creation Process
```
1. User drags nodes from palette → Canvas
2. User connects nodes → Validation
3. User configures node settings → Schema validation
4. User saves flow → Database storage
5. User deploys flow → Webhook registration
```

### 4.2 Flow Execution Process
```
1. External trigger (Instagram webhook) → API Gateway
2. Webhook handler → Celery task queue
3. Worker processes → Node execution engine
4. Node execution → External API calls
5. Results storage → Database
6. WebSocket notification → Frontend update
```

### 4.3 Node System Architecture
```
BaseNode (Abstract)
├── Input Schema Definition
├── Output Schema Definition
├── Settings Schema Definition
├── Execute Method (Abstract)
└── Validation Methods

Concrete Nodes
├── TriggerNodes
│   ├── InstagramCommentTrigger
│   ├── InstagramDMTrigger
│   └── WebhookTrigger
├── ProcessorNodes
│   ├── LLMResponseNode
│   ├── RAGQueryNode
│   └── TextTransformNode
└── ActionNodes
    ├── InstagramReplyNode
    ├── SendDMNode
    └── WebhookCallNode
```

## 5. Database Schema Architecture

### 5.1 Core Tables
```
users
├── id (PK)
├── email
├── name
├── role
└── created_at

flows
├── id (PK)
├── user_id (FK)
├── name
├── description
├── flow_data (JSONB)
├── status
├── created_at
└── updated_at

flow_executions
├── id (PK)
├── flow_id (FK)
├── trigger_data (JSONB)
├── execution_log (JSONB)
├── status
├── started_at
└── completed_at

node_types
├── id (PK)
├── name
├── category
├── input_schema (JSONB)
├── output_schema (JSONB)
├── settings_schema (JSONB)
└── implementation_class
```

## 6. API Architecture

### 6.1 REST Endpoints Structure
```
/api/v1/
├── /auth/
│   ├── POST /login
│   ├── POST /refresh
│   └── GET /me
├── /flows/
│   ├── GET / (list flows)
│   ├── POST / (create flow)
│   ├── GET /{id} (get flow)
│   ├── PUT /{id} (update flow)
│   ├── DELETE /{id} (delete flow)
│   ├── POST /{id}/execute (test execute)
│   ├── POST /{id}/deploy (activate)
│   └── DELETE /{id}/deploy (deactivate)
├── /nodes/
│   ├── GET /types (available node types)
│   └── POST /{type}/execute (test node)
├── /executions/
│   ├── GET / (execution history)
│   └── GET /{id} (execution details)
└── /webhooks/
    └── POST /instagram/{flow_id}
```

### 6.2 WebSocket Channels
```
/ws/executions/{execution_id} - Real-time execution logs
/ws/flows/{flow_id} - Flow-specific updates
/ws/user/{user_id} - User-specific notifications
```

## 7. Security Architecture

### 7.1 Authentication Flow
```
User → OAuth2 Provider → JWT Token → API Requests → Token Validation → Access Granted
```

### 7.2 Authorization Layers
```
1. Route-level: JWT validation
2. Resource-level: User ownership check
3. Action-level: Role-based permissions
```

## 8. Integration Architecture

### 8.1 External Service Integration
```
Instagram Graph API ↔ Webhook Handler ↔ Flow Executor
OpenAI API ↔ LLM Node ↔ Response Generation
Pinecone API ↔ RAG Node ↔ Knowledge Retrieval
```

## 9. Deployment Architecture

### 9.1 Development Environment
```
Docker Compose
├── Frontend (Vite dev server)
├── Backend (FastAPI with reload)
├── PostgreSQL
├── Redis
└── Celery Worker
```

### 9.2 Production Environment
```
Kubernetes Cluster
├── Frontend (Static files + NGINX)
├── Backend (FastAPI pods with HPA)
├── Workers (Celery pods with auto-scaling)
├── PostgreSQL (Managed service)
├── Redis (Managed service)
└── Load Balancer
```

## 10. Implementation Phases

### Phase 1: Core Infrastructure
1. Setup project structure
2. Basic authentication system
3. Database models and migrations
4. Basic API endpoints
5. Simple frontend shell

### Phase 2: Node System
1. BaseNode implementation
2. Node registry system
3. Basic trigger nodes
4. Node execution engine
5. Node testing interface

### Phase 3: Flow Builder
1. React Flow integration
2. Visual flow editor
3. Node palette
4. Flow saving/loading
5. Basic flow execution

### Phase 4: Advanced Features
1. Real-time execution monitoring
2. Flow deployment system
3. Instagram integration
4. LLM and RAG nodes
5. Production deployment

This structure provides a comprehensive foundation for building the social media automation platform with clear separation of concerns, scalability, and maintainability in mind.
