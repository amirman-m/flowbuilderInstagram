import pytest
from fastapi import FastAPI, HTTPException, status
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from app.api.v1.nodes import router as nodes_router
from app.core.node_registry import node_registry
from app.models.nodes import NodeType, NodeCategory, NodeExecutionResult, NodePorts
from app.models.user import User
from app.api.deps import get_current_user

# Create a FastAPI app and include the router
app = FastAPI()
app.include_router(nodes_router)

# Create a test client for the app
client = TestClient(app)

# Mock data
mock_user = User(id="test_user", email="test@example.com", is_active=True)

# Fixture to mock get_current_user
@pytest.fixture
def mock_current_user():
    return mock_user

# Fixture to override the get_current_user dependency
@pytest.fixture(autouse=True)
def override_dependency(mock_current_user):
    # Override the dependency for the app
    app.dependency_overrides[get_current_user] = lambda: mock_current_user
    yield
    # Clean up
    app.dependency_overrides = {}

# Test: Authentication
def test_unauthenticated_access():
    # Remove auth override for this test
    app.dependency_overrides = {}
    response = client.get("/types")
    assert response.status_code == status.HTTP_401_UNAUTHORIZED

# Test: Get node types
@patch.object(node_registry, 'get_all_node_types')
def test_get_node_types(mock_get_all):
    # Create minimal ports
    ports = NodePorts(inputs=[], outputs=[])
    
    # Mock node types
    mock_node_type = NodeType(
        id="test_node",
        name="Test Node",
        category=NodeCategory.ACTION,
        description="Test description",
        version="1.0.0",
        ports=ports,
        settings_schema={}
    )
    mock_get_all.return_value = [mock_node_type]
    
    response = client.get("/types")
    assert response.status_code == status.HTTP_200_OK
    assert len(response.json()) == 1
    assert response.json()[0]["id"] == "test_node"
    assert response.json()[0]["name"] == "Test Node"
    

# Test: Get node types by category
@patch.object(node_registry, 'get_node_types_by_category')
def test_get_node_types_by_category(mock_get_by_category):
    # Create minimal ports
    ports = NodePorts(inputs=[], outputs=[])
    
    mock_node_type = NodeType(
        id="test_node",
        name="Test Node",
        category=NodeCategory.ACTION,
        description="Test description",
        version="1.0.0",
        ports=ports,
        settings_schema={}
    )
    mock_get_by_category.return_value = [mock_node_type]
    
    response = client.get("/types?category=action")
    assert response.status_code == status.HTTP_200_OK
    assert len(response.json()) == 1

# Test: Get node type by ID
@patch.object(node_registry, 'get_node_type')
def test_get_node_type_success(mock_get_node):
    # Create minimal ports
    ports = NodePorts(inputs=[], outputs=[])
    
    mock_node_type = NodeType(
        id="test_node",
        name="Test Node",
        category=NodeCategory.ACTION,
        description="Test description",
        version="1.0.0",
        ports=ports,
        settings_schema={}
    )
    mock_get_node.return_value = mock_node_type
    
    response = client.get("/types/test_node")
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["id"] == "test_node"

@patch.object(node_registry, 'get_node_type')
def test_get_node_type_not_found(mock_get_node):
    mock_get_node.side_effect = ValueError("Node type not found")
    response = client.get("/types/invalid_node")
    assert response.status_code == status.HTTP_404_NOT_FOUND

# Test: Execute node
@patch.object(node_registry, 'execute_node')
@patch.object(node_registry, 'get_node_type')
def test_execute_node_success(mock_get_node, mock_execute):
    mock_get_node.return_value = None  # We don't care about the return value, just that it exists
    mock_execute.return_value = NodeExecutionResult(
        outputs={"result": "success"},
        status="success"
    )
    
    response = client.post(
        "/execute/test_node",
        json={"key": "value"}
    )
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["status"] == "success"

def test_execute_node_invalid_payload():
    # Send invalid payload (not a dict)
    response = client.post(
        "/execute/test_node",
        json="invalid"
    )
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

@patch.object(node_registry, 'get_node_type')
def test_execute_node_not_found(mock_get_node):
    mock_get_node.side_effect = ValueError("Node type not found")
    response = client.post(
        "/execute/invalid_node",
        json={"key": "value"}
    )
    assert response.status_code == status.HTTP_404_NOT_FOUND

# Test: Get node categories
def test_get_node_categories():
    response = client.get("/categories")
    assert response.status_code == status.HTTP_200_OK
    assert "action" in response.json()