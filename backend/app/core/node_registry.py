from typing import Dict, List, Callable, Any
from app.models.nodes import NodeType, NodeCategory, NodeDataType, NodePort, NodePorts, NodeExecutionResult
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)
class NodeRegistry:
    """Registry for managing node types and their execution handlers"""
    
    def __init__(self):
        self._node_types: Dict[str, NodeType] = {}
        self._execution_handlers: Dict[str, Callable] = {}
        self._initialize_builtin_nodes()
        
    def register_node(self, node_type: NodeType, execution_handler: Callable):
        self._node_types[node_type.id] = node_type
        self._execution_handlers[node_type.id] = execution_handler
    
    def register_node_type(self, node_type: NodeType):
        """Register a new node type"""
        self._node_types[node_type.id] = node_type
        logger.info(f"Registered node type: {node_type.id}")
    
    def register_execution_handler(self, node_type_id: str, handler: Callable):
        """Register an execution handler for a node type"""
        self._execution_handlers[node_type_id] = handler
        logger.info(f"Registered execution handler for: {node_type_id}")
    
    def get_node_type(self, node_type_id: str) -> NodeType:
        """Get a node type by ID"""
        if node_type_id not in self._node_types:
            raise ValueError(f"Node type not found: {node_type_id}")
        return self._node_types[node_type_id]
    
    def get_all_node_types(self) -> List[NodeType]:
        """Get all registered node types"""
        return list(self._node_types.values())
    
    def get_node_types_by_category(self, category: NodeCategory) -> List[NodeType]:
        """Get node types filtered by category"""
        return [nt for nt in self._node_types.values() if nt.category == category]
    
    async def execute_node(self, node_type_id: str, context: Dict[str, Any]) -> NodeExecutionResult:
        """Execute a node with the given context"""
        if node_type_id not in self._execution_handlers:
            raise ValueError(f"No execution handler found for node type: {node_type_id}")
        
        handler = self._execution_handlers[node_type_id]
        
        try:
            start_time = datetime.now(timezone.utc)
            result = await handler(context)
            end_time = datetime.now(timezone.utc)
            
            # Ensure result has timing information
            if not result.started_at:
                result.started_at = start_time
            if not result.completed_at:
                result.completed_at = end_time
            if not result.execution_time_ms:
                result.execution_time_ms = int((end_time - start_time).total_seconds() * 1000)
            
            return result
        except Exception as e:
            logger.error(f"Error executing node {node_type_id}: {str(e)}")
            return NodeExecutionResult(
                outputs={},
                status="error",
                error=str(e),
                started_at=datetime.now(timezone.utc),
                completed_at=datetime.now(timezone.utc)
            )
    
    def _initialize_builtin_nodes(self):
        """Initialize built-in node types using the modular structure"""
        # Import and register trigger nodes
        from app.services.nodes.triggers import register_trigger_nodes
        register_trigger_nodes(self)

        from app.services.nodes.processors import register_processor_nodes
        register_processor_nodes(self)      

# Global node registry instance
node_registry = NodeRegistry()
