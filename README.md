# Social Media Automation Platform

A visual flow builder for creating automation workflows for social media customer service, starting with Instagram comment and DM auto-replies using AI.

## Project Structure

```
socialmediaFlow/
├── backend/                 # FastAPI Python Application
│   ├── app/
│   │   ├── api/            # API route handlers
│   │   ├── core/           # Core application logic
│   │   ├── models/         # SQLAlchemy models
│   │   ├── schemas/        # Pydantic schemas
│   │   └── main.py         # FastAPI application
│   └── requirements.txt
├── frontend/               # React + TypeScript Application
│   ├── src/
│   │   ├── components/     # React components
│   │   │   ├── nodes/      # Node components and renderers
│   │   │   ├── edges/      # Edge components for connections
│   │   │   └── inspector/  # Node inspector and property panels
│   │   ├── pages/          # Page components
│   │   ├── services/       # API client services
│   │   ├── store/          # State management
│   │   └── types/          # TypeScript definitions
│   └── package.json
├── Doc/                    # Documentation
└── Makefile               # Development commands
```

## Quick Start

### Prerequisites
- Python 3.8+
- Node.js 16+
- npm or yarn

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd socialmediaFlow
```

2. **Install dependencies**
```bash
make install
```

3. **Set up environment variables**
```bash
cp .env.example .env
# Edit .env with your configuration
```

### Development

**Start both backend and frontend:**
```bash
make dev
```

**Or start them separately:**

**Backend only:**
```bash
make dev-backend
# Runs on http://localhost:8000
```

**Frontend only:**
```bash
make dev-frontend
# Runs on http://localhost:5173
```

### API Documentation

Once the backend is running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Features (Current Implementation)

✅ **Basic Authentication System**
- Simple cookie-based authentication (no JWT)
- User registration and login
- Session management

✅ **Flow Management**
- Create, read, update, delete flows
- Basic flow data storage
- User-specific flow isolation

✅ **Frontend Interface**
- React + TypeScript + Material-UI
- Authentication pages
- Dashboard with flow listing
- Responsive design

## Architecture & State Management

### Frontend Architecture

#### Component Structure
- **App.tsx**: Main application component with routing
- **FlowBuilder.tsx**: Core flow builder page with React Flow integration
- **CustomNodes.tsx**: Node type definitions and rendering components
- **NodeInspector.tsx**: Property panel and node configuration UI

#### State Management
- **Local Component State**: React's useState for component-specific state
- **React Flow State**: useNodesState and useEdgesState hooks for flow canvas
- **API Services**: Axios-based services for backend communication

### Flow Builder Core Components

#### FlowBuilder.tsx
- **Main Canvas**: React Flow integration with drag-and-drop support
- **Node Library**: Sidebar with available node types categorized by function
- **Flow Controls**: Save, load, and execute flow operations

#### Node System
- **Node Types**: Trigger, Processor, and Action categories
- **Node Instances**: Runtime instances with settings and data
- **Node Ports**: Input and output connection points with data typing

#### Node Inspector
- **Property Panel**: Dynamic form generation from JSON Schema
- **Data Viewer**: Input/output data visualization
- **Execution History**: Node execution status and history

## Node Type System

### Node Categories

1. **Trigger Nodes**: Start flow execution (e.g., Instagram comment received)
   - Example: `instagram-comment` - Triggered when a new Instagram comment is received

2. **Processor Nodes**: Process data (e.g., AI text generation)
   - Example: `ai-response` - Generates AI responses based on input text

3. **Action Nodes**: Perform actions (e.g., post reply)
   - Example: `instagram-reply` - Posts a reply to an Instagram comment

### Node Structure

Each node type consists of:

- **Metadata**: ID, name, description, version, icon, color
- **Ports**: Input and output connection points with data types
- **Settings Schema**: JSON Schema defining configuration options
- **Execution Logic**: Backend implementation for node functionality

## How to Implement New Nodes

### 1. Define Node Type Interface

Add a new node type definition in the frontend:

```typescript
// In a service or directly in FlowBuilder.tsx for testing
const myCustomNode: NodeType = {
  id: 'my-custom-node',
  name: 'My Custom Node',
  description: 'Description of what this node does',
  category: NodeCategory.PROCESSOR, // or TRIGGER or ACTION
  version: '1.0.0',
  icon: 'code', // Material-UI icon name
  color: '#3F51B5', // Custom color
  ports: {
    inputs: [
      {
        id: 'input1',
        name: 'input1',
        label: 'Input 1',
        description: 'First input description',
        dataType: NodeDataType.STRING,
        required: true
      }
    ],
    outputs: [
      {
        id: 'output1',
        name: 'output1',
        label: 'Output 1',
        description: 'First output description',
        dataType: NodeDataType.STRING,
        required: true
      }
    ]
  },
  settingsSchema: {
    type: 'object',
    properties: {
      // Define settings properties with JSON Schema
      mySetting: {
        type: 'string',
        title: 'My Setting',
        description: 'Description of this setting'
      }
    },
    required: ['mySetting']
  }
};
```

### 2. Register Node Type in Backend

Implement the node type in the backend API:

```python
# Example backend node type registration
from app.models.nodes import NodeType, NodeCategory, NodePort, NodeDataType

my_custom_node = NodeType(
    id="my-custom-node",
    name="My Custom Node",
    description="Description of what this node does",
    category=NodeCategory.PROCESSOR,
    version="1.0.0",
    icon="code",
    color="#3F51B5",
    ports={
        "inputs": [
            NodePort(
                id="input1",
                name="input1",
                label="Input 1",
                description="First input description",
                data_type=NodeDataType.STRING,
                required=True
            )
        ],
        "outputs": [
            NodePort(
                id="output1",
                name="output1",
                label="Output 1",
                description="First output description",
                data_type=NodeDataType.STRING,
                required=True
            )
        ]
    },
    settings_schema={
        "type": "object",
        "properties": {
            "mySetting": {
                "type": "string",
                "title": "My Setting",
                "description": "Description of this setting"
            }
        },
        "required": ["mySetting"]
    }
)

# Register in node registry
node_registry.register(my_custom_node)
```

### 3. Implement Node Execution Logic

Create the execution handler in the backend:

```python
# Example node execution handler
from app.core.node_execution import NodeExecutionContext, NodeExecutionResult

@node_execution_handler("my-custom-node")
async def execute_my_custom_node(context: NodeExecutionContext) -> NodeExecutionResult:
    # Get input data
    input_data = context.get_input("input1")
    
    # Get node settings
    settings = context.node_instance.settings
    my_setting = settings.get("mySetting")
    
    # Process data
    result = f"{input_data} processed with {my_setting}"
    
    # Return execution result
    return NodeExecutionResult(
        outputs={"output1": result},
        status="success"
    )
```

### 4. Test Your Node

Test your node in the flow builder:

1. Ensure backend API is running with your node registered
2. Refresh the flow builder UI to load the new node type
3. Drag your node from the sidebar onto the canvas
4. Configure settings in the node inspector
5. Connect it to other nodes
6. Test execution

## Next Steps

✅ **Phase 1: Basic Structure**
- Implement basic app structure
- Set up authentication
- Create flow builder UI foundation

🔄 **Phase 2: Node System**
- Implement backend node registry system
- Add basic trigger nodes for Instagram
- Build node execution engine
- Connect frontend to backend node API

🔄 **Phase 3: Flow Execution**
- Implement flow validation
- Create flow execution engine
- Add real-time execution monitoring
- Implement error handling and recovery

🔄 **Phase 4: Advanced Features**
- Instagram API integration
- LLM and RAG nodes for AI responses
- Flow templates and sharing
- Production deployment and scaling

## Technology Stack

### Backend
- **FastAPI**: Modern, high-performance web framework for building APIs
- **SQLAlchemy**: SQL toolkit and ORM for database interactions
- **SQLite**: Lightweight database for development (PostgreSQL for production)
- **Pydantic**: Data validation and settings management

### Frontend
- **React**: UI library for building component-based interfaces
- **TypeScript**: Typed JavaScript for better developer experience
- **Material-UI**: Component library implementing Material Design
- **@xyflow/react**: React Flow library for node-based interfaces (previously react-flow-renderer)
- **Axios**: HTTP client for API requests
- **Zustand**: Lightweight state management
- **AJV**: JSON Schema validation for node settings

### Development & DevOps
- **Vite**: Modern frontend build tool
- **ESLint & Prettier**: Code quality and formatting
- **Docker & Docker Compose**: Containerization and local development
- **Jest & React Testing Library**: Testing framework

## Contributing

1. Follow the existing code structure
2. Add tests for new features
3. Update documentation as needed
4. Use conventional commit messages

## License

[Add your license here]
