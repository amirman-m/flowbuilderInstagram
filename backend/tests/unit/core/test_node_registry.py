import pytest
from unittest.mock import patch
from app.core.node_registry import NodeRegistry
from app.models.nodes import NodeType, NodeCategory, NodePorts

# Fixture to mock built-in node initialization
@pytest.fixture
def registry():
    with patch.object(NodeRegistry, '_initialize_builtin_nodes', return_value=None):
        return NodeRegistry()

#Verifies nodes can be registered and retrieved correctly
def test_register_and_retrieve_node(registry):
    """Test registering and retrieving a node type"""
    node_type = NodeType(
        id="test_node",
        name="Test Node",
        category=NodeCategory.ACTION,
        description="A test node",
        version="1.0.0",
        ports=NodePorts(inputs=[], outputs=[]),
        settingsSchema={}
    )
    registry.register_node_type(node_type)
    retrieved = registry.get_node_type("test_node")
    assert retrieved == node_type

#Verifies that duplicate registration overwrites existing node type
def test_duplicate_node_registration_overwrites(registry):
    """Test that duplicate registration overwrites existing node type"""
    node_type1 = NodeType(
        id="test_node",
        name="Test Node 1",
        category=NodeCategory.ACTION,
        description="First node",
        version="1.0.0",
        ports=NodePorts(inputs=[], outputs=[]),
        settingsSchema={}
    )
    node_type2 = NodeType(
        id="test_node",
        name="Test Node 2",
        category=NodeCategory.ACTION,
        description="Second node",
        version="1.0.0",
        ports=NodePorts(inputs=[], outputs=[]),
        settingsSchema={}
    )
    registry.register_node_type(node_type1)
    registry.register_node_type(node_type2)
    retrieved = registry.get_node_type("test_node")
    assert retrieved.name == "Test Node 2"

#Verifies that registered node metadata has expected structure
def test_node_metadata_structure(registry):
    """Test that registered node metadata has expected structure"""
    node_type = NodeType(
        id="test_node",
        name="Test Node",
        category=NodeCategory.ACTION,
        description="A test node",
        version="1.0.0",
        ports=NodePorts(inputs=[], outputs=[]),
        settingsSchema={}
    )
    registry.register_node_type(node_type)
    retrieved = registry.get_node_type("test_node")
    assert retrieved.id == "test_node"
    assert retrieved.name == "Test Node"
    assert retrieved.category == NodeCategory.ACTION
    assert retrieved.description == "A test node"
