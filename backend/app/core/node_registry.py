from typing import Dict, List, Callable, Any
from app.models.nodes import NodeType, NodeCategory, NodeDataType, NodePort, NodePorts, NodeExecutionResult
from datetime import datetime, timezone
import uuid
import logging

logger = logging.getLogger(__name__)

# Execution handlers (defined before NodeRegistry class)
async def execute_chat_input_trigger(context: Dict[str, Any]) -> NodeExecutionResult:
    """
    Execute chat input trigger node
    This node waits for user input and creates a session for the conversation
    """
    
    # Get the input text from the execution context
    user_input = context.get("user_input", "")
    
    if not user_input:
        return NodeExecutionResult(
            outputs={},
            status="error",
            error="No user input provided for chat input trigger"
        )
    
    # Generate unique session ID
    session_id = str(uuid.uuid4())
    
    # Determine input type based on content analysis
    input_type = determine_input_type(user_input)
    
    # Create the output data structure
    message_data = {
        "session_id": session_id,
        "input_text": user_input,
        "input_type": input_type,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "metadata": {
            "character_count": len(user_input),
            "word_count": len(user_input.split()),
            "language": detect_language(user_input)
        }
    }
    
    return NodeExecutionResult(
        outputs={"message_data": message_data},
        status="success",
        execution_time_ms=10,  # Very fast execution
        logs=[f"Chat input processed: \"{user_input[:50]}{'...' if len(user_input) > 50 else ''}\""]
    )

def determine_input_type(text: str) -> str:
    """
    Determine the type of input based on content analysis
    """
    text_lower = text.lower().strip()
    
    # Check for question indicators
    if text.endswith('?') or any(word in text_lower for word in ['what', 'how', 'why', 'when', 'where', 'who']):
        return "question"
    
    # Check for greeting
    if any(word in text_lower for word in ['hello', 'hi', 'hey', 'good morning', 'good afternoon']):
        return "greeting"
    
    # Check for request/command
    if any(word in text_lower for word in ['please', 'can you', 'could you', 'help me']):
        return "request"
    
    # Check for complaint/issue
    if any(word in text_lower for word in ['problem', 'issue', 'error', 'not working', 'broken']):
        return "complaint"
    
    # Default to statement
    return "statement"

def detect_language(text: str) -> str:
    """
    Simple language detection (you can integrate a proper language detection library)
    """
    # This is a simplified version - you might want to use langdetect library
    return "en"  # Default to English for now

class NodeRegistry:
    """Registry for managing node types and their execution handlers"""
    
    def __init__(self):
        self._node_types: Dict[str, NodeType] = {}
        self._execution_handlers: Dict[str, Callable] = {}
        self._initialize_builtin_nodes()
    
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
        """Initialize built-in node types"""
        # Chat Input Trigger Node
        chat_input_node = NodeType(
            id="chat-input",
            name="Chat Input",
            description="Manual text input trigger for testing and user interaction",
            category=NodeCategory.TRIGGER,
            version="1.0.0",
            icon="message",
            color="#4CAF50",
            ports=NodePorts(
                inputs=[],  # Trigger nodes have no inputs
                outputs=[
                    NodePort(
                        id="message_data",
                        name="message_data",
                        label="Message Data",
                        description="Contains session ID, input text, and input type",
                        data_type=NodeDataType.OBJECT,
                        required=True
                    )
                ]
            ),
            settings_schema={
                "type": "object",
                "properties": {},  # No settings
                "required": []
            }
        )
        
        self.register_node_type(chat_input_node)
        self.register_execution_handler("chat-input", execute_chat_input_trigger)

# Global node registry instance
node_registry = NodeRegistry()
