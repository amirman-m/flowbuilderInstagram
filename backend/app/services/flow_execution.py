from typing import Dict, List, Any, Optional, Set
from datetime import datetime, timezone
from sqlalchemy.orm import Session
import logging
import asyncio

from ..models.flow import Flow
from ..models.nodes import NodeInstance, NodeConnection, NodeExecutionResult
from ..core.node_registry import node_registry

logger = logging.getLogger(__name__)

class FlowExecutionError(Exception):
    """Custom exception for flow execution errors"""
    pass

class FlowExecutor:
    """
    Service for executing complete flows starting from trigger nodes.
    Supports modular trigger execution and flow graph traversal.
    """
    
    def __init__(self, db: Session):
        self.db = db
        
    async def execute_flow(self, flow_id: int,
                           user_id: int, 
                           trigger_inputs: Dict[str, Any] = None
                        ) -> Dict[str, Any]:
        """
        Execute a complete flow starting from the trigger node.
        Uses API endpoints to fetch flow data and executes nodes modularly.
        
        Args:
            flow_id: ID of the flow to execute
            user_id: ID of the user executing the flow
            trigger_inputs: Inputs for the trigger node (e.g., user input for ChatInputNode)
            
        Returns:
            metadata at the end of the flow execution
        """
        logger.info(f"🚀 Starting modular flow execution for flow_id={flow_id}, user_id={user_id}")
        logger.info(f"📥 Trigger inputs: {trigger_inputs}")
        
        # Validate flow exists and belongs to user
        flow = self._get_flow(flow_id, user_id)
        
        # Step 1: Fetch nodes and connections using API endpoints
        nodes_data = await self._fetch_nodes_from_api(flow_id)
        connections_data = await self._fetch_connections_from_api(flow_id)
        
        logger.info(f"📊 Fetched {len(nodes_data)} nodes from API:")
        for node in nodes_data:
            logger.info(f"  - Node {node['id']}: type={node['typeId']}, label={node['label']}")
        
        logger.info(f"🔗 Fetched {len(connections_data)} connections from API:")
        for conn in connections_data:
            logger.info(f"  - Connection: {conn['sourceNodeId']}[{conn['sourcePortId']}] -> {conn['targetNodeId']}[{conn['targetPortId']}]")
        
        # Step 2: Find trigger nodes modularly (expandable for multiple trigger types)
        trigger_nodes = self._find_trigger_nodes_modular(nodes_data)
        
        # Step 3: Validate exactly one trigger node
        if len(trigger_nodes) == 0:
            raise FlowExecutionError("No trigger node found in flow. Each flow must have exactly one trigger node.")
        if len(trigger_nodes) > 1:
            trigger_ids = [node['id'] for node in trigger_nodes]
            raise FlowExecutionError(f"Multiple trigger nodes found: {trigger_ids}. Each flow must have exactly one trigger node.")
        
        trigger_node = trigger_nodes[0]
        logger.info(f"✅ Found trigger node: {trigger_node['id']} (type: {trigger_node['typeId']})")
        
        # Step 4: Execute the flow starting from trigger node
        execution_results = await self._execute_flow_modular(
            trigger_node,
            nodes_data,
            connections_data,
            trigger_inputs or {}
        )
        
        logger.info(f"✅ Modular flow execution completed for flow_id={flow_id}")
        
        return {
            "flow_id": flow_id,
            "flow_name": flow.name,
            "trigger_node_id": trigger_node['id'],
            "execution_results": execution_results,
            "executed_at": datetime.now(timezone.utc).isoformat(),
            "total_nodes_executed": len(execution_results)
        }
    
    def _get_flow(self, flow_id: int, user_id: int) -> Flow:
        """Get and validate flow ownership"""
        flow = self.db.query(Flow).filter(
            Flow.id == flow_id,
            Flow.user_id == user_id
        ).first()
        
        if not flow:
            raise FlowExecutionError(f"Flow {flow_id} not found or access denied")
            
        return flow
    
    async def _fetch_nodes_from_api(self, flow_id: int) -> List[Dict[str, Any]]:
        """Fetch nodes data using direct DB query (internal service call)"""
        try:
            # Use direct DB query to avoid authentication issues with internal HTTP calls
            nodes = self.db.query(NodeInstance).filter(
                NodeInstance.flow_id == flow_id
            ).all()
            
            nodes_data = []
            for node in nodes:
                node_data = {
                    "id": node.id,
                    "typeId": node.type_id,
                    "label": node.label,
                    "data": node.data or {},
                    "position": node.position or {},
                    "flow_id": node.flow_id,
                    "created_at": node.created_at.isoformat() if node.created_at else None,
                    "updated_at": node.updated_at.isoformat() if node.updated_at else None
                }
                nodes_data.append(node_data)
            
            logger.info(f"📡 Successfully fetched {len(nodes_data)} nodes from database")
            return nodes_data
        except Exception as e:
            logger.error(f"❌ Failed to fetch nodes from database: {str(e)}")
            raise FlowExecutionError(f"Failed to fetch nodes data: {str(e)}")
    
    async def _fetch_connections_from_api(self, flow_id: int) -> List[Dict[str, Any]]:
        """Fetch connections data using direct DB query (internal service call)"""
        try:
            # Use direct DB query to avoid authentication issues with internal HTTP calls
            connections = self.db.query(NodeConnection).filter(
                NodeConnection.flow_id == flow_id
            ).all()
            
            connections_data = []
            for conn in connections:
                connection_data = {
                    "id": conn.id,
                    "sourceNodeId": conn.source_node_id,
                    "targetNodeId": conn.target_node_id,
                    "sourcePortId": conn.source_port_id,
                    "targetPortId": conn.target_port_id,
                    "flow_id": conn.flow_id,
                    "created_at": conn.created_at.isoformat() if conn.created_at else None
                }
                connections_data.append(connection_data)
            
            logger.info(f"📡 Successfully fetched {len(connections_data)} connections from database")
            return connections_data
        except Exception as e:
            logger.error(f"❌ Failed to fetch connections from database: {str(e)}")
            raise FlowExecutionError(f"Failed to fetch connections data: {str(e)}")
    
    def _find_trigger_nodes_modular(self, nodes_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Find trigger nodes modularly - expandable for multiple trigger types.
        Currently supports: chat-input
        Future: Can be expanded to support more trigger types
        """
        # Define supported trigger node types (expandable)
        TRIGGER_NODE_TYPES = {
            "chat-input": "Chat Input Trigger",
            "voice-input": "Voice Input Trigger"
            # Future trigger types can be added here:
            # "webhook-trigger": "Webhook Trigger",
            # "schedule-trigger": "Schedule Trigger",
            # "file-upload-trigger": "File Upload Trigger"
        }
        
        trigger_nodes = []
        
        for node_data in nodes_data:
            node_type_id = node_data.get('typeId')
            if not node_type_id:
                continue

            try:
                node_type = node_registry.get_node_type(node_type_id)
                if node_type and hasattr(node_type, 'category') and node_type.category.value == 'trigger':
                    logger.info(f"🎯 Found trigger node: {node_data['id']} (type: {node_type_id})")
                    trigger_nodes.append(node_data)
            except Exception as e:
                logger.warning(f"Could not get node type for {node_type_id}: {e}")

        logger.info(f"🔍 Found {len(trigger_nodes)} trigger nodes")
        return trigger_nodes
    
    async def _execute_flow_modular(self, 
                                   trigger_node: Dict[str, Any],
                                   nodes_data: List[Dict[str, Any]], 
                                   connections_data: List[Dict[str, Any]],
                                   trigger_inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute the flow modularly starting from trigger node and following connections.
        
        Args:
            trigger_node: The trigger node data from API
            nodes_data: All nodes data from API
            connections_data: All connections data from API  
            trigger_inputs: User inputs for the trigger node
        
        Returns:
            Dictionary of execution results for each node
        """
        execution_results = {}
        executed_nodes = set()
        node_outputs = {}  # Store outputs from each executed node
        
        # Create a lookup dictionary for nodes by ID
        nodes_by_id = {node['id']: node for node in nodes_data}
        
        # Step 1: Execute trigger node with user input
        logger.info(f"🎯 Executing trigger node: {trigger_node['id']} (type: {trigger_node['typeId']})")
        
        # Replace input_text in trigger node with user input from trigger_inputs
        trigger_execution_context = trigger_inputs.copy()
        
        # Execute trigger node modularly based on its type
        trigger_result = await self._execute_node_modular(trigger_node, trigger_execution_context)
        
        execution_results[trigger_node['id']] = trigger_result
        executed_nodes.add(trigger_node['id'])
        node_outputs[trigger_node['id']] = trigger_result.outputs if trigger_result else {}
        
        logger.info(f"📤 Trigger node {trigger_node['id']} outputs: {node_outputs[trigger_node['id']]}")
        
        # Step 2: Follow connections and execute downstream nodes
        await self._execute_connected_nodes(
            trigger_node['id'],
            nodes_by_id,
            connections_data,
            execution_results,
            executed_nodes,
            node_outputs
        )
        
        return execution_results
    
    async def _execute_node_modular(self, node_data: Dict[str, Any], execution_context: Dict[str, Any]) -> Optional[NodeExecutionResult]:
        """
        Execute a single node modularly based on its type.
        Uses the stored settings from the node data.
        
        Args:
            node_data: Node data from API containing id, typeId, settings, etc.
            execution_context: Execution context with inputs and settings
            
        Returns:
            NodeExecutionResult or None if execution failed
        """
        node_id = node_data['id']
        node_type_id = node_data['typeId']
        
        try:
            # Get stored settings from the node data
            stored_settings = node_data.get('data', {}).get('settings', {})
            
            # Merge execution context with stored settings
            final_context = execution_context.copy()
            final_context.update(stored_settings)
            
            logger.info(f"🚀 Executing node {node_id} (type: {node_type_id}) with context: {final_context}")
            
            # Execute using the node registry
            result = await node_registry.execute_node(node_type_id, final_context)
            
            if result.status == "success":
                logger.info(f"✅ Node {node_id} executed successfully")
                logger.info(f"📤 Node {node_id} outputs: {result.outputs}")
            else:
                logger.warning(f"⚠️ Node {node_id} execution failed: {result.error}")
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Error executing node {node_id}: {str(e)}")
            return NodeExecutionResult(
                outputs={},
                status="error",
                error=str(e),
                started_at=datetime.now(timezone.utc),
                completed_at=datetime.now(timezone.utc)
            )
    
    async def _execute_connected_nodes(self,
                                     current_node_id: str,
                                     nodes_by_id: Dict[str, Dict[str, Any]],
                                     connections_data: List[Dict[str, Any]],
                                     execution_results: Dict[str, Any],
                                     executed_nodes: Set[str],
                                     node_outputs: Dict[str, Dict[str, Any]]):
        """
        Execute connected nodes following the connections from current node.
        
        Args:
            current_node_id: ID of the current node that was just executed
            nodes_by_id: Dictionary of all nodes keyed by ID
            connections_data: All connections data from API
            execution_results: Dictionary to store execution results
            executed_nodes: Set of already executed node IDs
            node_outputs: Dictionary storing outputs from executed nodes
        """
        # Find all connections where current node is the source
        outgoing_connections = [
            conn for conn in connections_data 
            if conn['sourceNodeId'] == current_node_id
        ]
        
        logger.info(f"🔍 Found {len(outgoing_connections)} outgoing connections from {current_node_id}")
        
        for connection in outgoing_connections:
            target_node_id = connection['targetNodeId']
            source_port_id = connection['sourcePortId']
            target_port_id = connection['targetPortId']
            
            logger.info(f"🔌 Processing connection: {current_node_id}[{source_port_id}] -> {target_node_id}[{target_port_id}]")
            
            # Skip if target node already executed
            if target_node_id in executed_nodes:
                logger.info(f"⏭️ Skipping {target_node_id} - already executed")
                continue
            
            # Get target node data
            if target_node_id not in nodes_by_id:
                logger.warning(f"⚠️ Target node {target_node_id} not found in nodes data")
                continue
            
            target_node = nodes_by_id[target_node_id]
            
            # Prepare inputs for target node based on source node outputs
            target_inputs = self._prepare_target_inputs(
                current_node_id, target_node_id, source_port_id, target_port_id, node_outputs
            )
            
            # Execute target node
            logger.info(f"⚡ Executing connected node: {target_node_id} (type: {target_node['typeId']})")
            result = await self._execute_node_modular(target_node, target_inputs)
            
            # Store results
            execution_results[target_node_id] = result
            executed_nodes.add(target_node_id)
            node_outputs[target_node_id] = result.outputs if result else {}
            
            # Recursively execute nodes connected to this target node
            await self._execute_connected_nodes(
                target_node_id,
                nodes_by_id,
                connections_data,
                execution_results,
                executed_nodes,
                node_outputs
            )
    
    def _prepare_target_inputs(self,
                             source_node_id: str,
                             target_node_id: str,
                             source_port_id: str,
                             target_port_id: str,
                             node_outputs: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
        """
        Prepare inputs for target node based on source node outputs and port mapping.
        
        Args:
            source_node_id: ID of the source node
            target_node_id: ID of the target node
            source_port_id: Output port ID from source node
            target_port_id: Input port ID for target node
            node_outputs: Dictionary of outputs from executed nodes
            
        Returns:
            Dictionary of prepared inputs for target node
        """
        logger.info(f"🔧 Preparing inputs for {target_node_id} from {source_node_id}")
        
        # Get outputs from source node
        if source_node_id not in node_outputs:
            logger.warning(f"⚠️ No outputs found for source node {source_node_id}")
            return {"inputs": {}}
        
        source_outputs = node_outputs[source_node_id]
        logger.info(f"📤 Source outputs from {source_node_id}: {source_outputs}")
        
        # Map the specific source port output to target port input
        if source_port_id in source_outputs:
            target_inputs = {
                "inputs": {
                    target_port_id: source_outputs[source_port_id]
                }
            }
            logger.info(f"✅ Mapped {source_node_id}[{source_port_id}] -> {target_node_id}[{target_port_id}]")
            logger.info(f"🎯 Final inputs for {target_node_id}: {target_inputs}")
            return target_inputs
        else:
            logger.warning(f"⚠️ Source port {source_port_id} not found in outputs of {source_node_id}")
            # Fallback: pass all available outputs
            return {"inputs": source_outputs}
    
    def _get_flow_nodes(self, flow_id: int) -> List[NodeInstance]:
        """Get all node instances for the flow"""
        nodes = self.db.query(NodeInstance).filter(
            NodeInstance.flow_id == flow_id
        ).all()
        
        if not nodes:
            raise FlowExecutionError(f"No nodes found in flow {flow_id}")
            
        return nodes
    
    def _get_flow_connections(self, flow_id: int) -> List[NodeConnection]:
        """Get all node connections for the flow"""
        return self.db.query(NodeConnection).filter(
            NodeConnection.flow_id == flow_id
        ).all()
    
    def _find_and_validate_trigger(self, nodes: List[NodeInstance]) -> NodeInstance:
        """
        Find and validate that there is exactly one trigger node.
        
        Args:
            nodes: List of all nodes in the flow
            
        Returns:
            The single trigger node
            
        Raises:
            FlowExecutionError: If no trigger or multiple triggers found
        """
        # Get all available node types to check categories
        trigger_nodes = []
        
        for node in nodes:
            # Get node type from registry to check if it's a trigger
            try:
                node_type = node_registry.get_node_type(node.type_id)
                if node_type and hasattr(node_type, 'category') and node_type.category.value == 'trigger':
                    trigger_nodes.append(node)
            except Exception as e:
                logger.warning(f"Could not get node type for {node.type_id}: {e}")
                continue
        
        if len(trigger_nodes) == 0:
            raise FlowExecutionError("No trigger node found in flow. Each flow must have exactly one trigger node.")
        
        if len(trigger_nodes) > 1:
            trigger_ids = [node.id for node in trigger_nodes]
            raise FlowExecutionError(f"Multiple trigger nodes found: {trigger_ids}. Each flow must have exactly one trigger node.")
        
        logger.info(f"✅ Found valid trigger node: {trigger_nodes[0].id} (type: {trigger_nodes[0].type_id})")
        return trigger_nodes[0]
    
    def _build_execution_graph(self, nodes: List[NodeInstance], connections: List[NodeConnection]) -> Dict[str, List[str]]:
        """
        Build a graph of node dependencies for execution ordering.
        
        Returns:
            Dictionary mapping node_id -> list of dependent node_ids
        """
        graph = {}
        
        # Initialize all nodes in graph
        for node in nodes:
            graph[node.id] = []
        
        # Add connections (source -> target relationships)
        for conn in connections:
            if conn.source_node_id in graph:
                graph[conn.source_node_id].append(conn.target_node_id)
        
        logger.info(f"📊 Built execution graph with {len(graph)} nodes and {len(connections)} connections")
        return graph
    
    async def _execute_flow_graph(self, trigger_node: NodeInstance, graph: Dict[str, List[str]], trigger_inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute the flow graph starting from the trigger node.
        
        Args:
            trigger_node: The trigger node to start execution from
            graph: Execution graph mapping node_id -> dependent_node_ids
            trigger_inputs: Inputs for the trigger node
            
        Returns:
            Dictionary of execution results for each node
        """
        execution_results = {}
        executed_nodes = set()
        node_outputs = {}  # Store outputs from each node for passing to dependents
        
        # Execute trigger node first
        logger.info(f"🎯 Executing trigger node: {trigger_node.id}")
        logger.info(f"📥 Trigger inputs: {trigger_inputs}")
        trigger_result = await self._execute_single_node(trigger_node, trigger_inputs)
        logger.info(f"📤 Trigger result: {trigger_result}")
        execution_results[trigger_node.id] = trigger_result
        executed_nodes.add(trigger_node.id)
        node_outputs[trigger_node.id] = trigger_result.outputs if trigger_result else {}
        logger.info(f"💾 Stored trigger outputs: {node_outputs[trigger_node.id]}")
        
        # Execute dependent nodes in order
        await self._execute_dependent_nodes(
            trigger_node.id, 
            graph, 
            execution_results, 
            executed_nodes, 
            node_outputs
        )
        
        return execution_results
    
    async def _execute_dependent_nodes(self, current_node_id: str, graph: Dict[str, List[str]], 
                                     execution_results: Dict[str, Any], executed_nodes: Set[str], 
                                     node_outputs: Dict[str, Dict[str, Any]]):
        """
        Recursively execute dependent nodes after the current node.
        """
        dependent_node_ids = graph.get(current_node_id, [])
        logger.info(f"🔍 Checking dependent nodes for {current_node_id}: {dependent_node_ids}")
        
        for dependent_id in dependent_node_ids:
            if dependent_id in executed_nodes:
                continue  # Skip already executed nodes
                
            # Get the node instance
            node_instance = self.db.query(NodeInstance).filter(
                NodeInstance.id == dependent_id
            ).first()
            
            if not node_instance:
                logger.warning(f"⚠️ Node instance {dependent_id} not found, skipping")
                continue
            
            # Prepare inputs from previous node outputs
            node_inputs = self._prepare_node_inputs(dependent_id, node_outputs)
            logger.info(f"📥 Prepared inputs for {dependent_id}: {node_inputs}")
            
            # Execute the node
            logger.info(f"⚡ Executing node: {dependent_id} (type: {node_instance.type_id})")
            result = await self._execute_single_node(node_instance, node_inputs)
            logger.info(f"📤 Execution result for {dependent_id}: {result}")
            
            execution_results[dependent_id] = result
            executed_nodes.add(dependent_id)
            node_outputs[dependent_id] = result.outputs if result else {}
            
            # Recursively execute nodes that depend on this one
            await self._execute_dependent_nodes(
                dependent_id, graph, execution_results, executed_nodes, node_outputs
            )
    
    def _prepare_node_inputs(self, node_id: str, node_outputs: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
        """
        Prepare inputs for a node based on outputs from connected nodes.
        Maps outputs from connected nodes to the expected input format.
        """
        logger.info(f"🔧 Preparing inputs for node {node_id}")
        logger.info(f"📦 Available node outputs: {node_outputs}")
        
        # Get connections that target this node
        connections = self.db.query(NodeConnection).filter(
            NodeConnection.target_node_id == node_id
        ).all()
        
        logger.info(f"🔗 Found {len(connections)} connections targeting node {node_id}")
        
        # Prepare inputs based on connections
        prepared_inputs = {}
        
        for connection in connections:
            source_node_id = connection.source_node_id
            source_port_id = connection.source_port_id
            target_port_id = connection.target_port_id
            
            logger.info(f"🔌 Processing connection: {source_node_id}[{source_port_id}] -> {node_id}[{target_port_id}]")
            
            # Get outputs from the source node
            if source_node_id in node_outputs:
                source_outputs = node_outputs[source_node_id]
                logger.info(f"📤 Source node {source_node_id} outputs: {source_outputs}")
                
                # Map the specific output port to the target input port
                if source_port_id in source_outputs:
                    prepared_inputs[target_port_id] = source_outputs[source_port_id]
                    logger.info(f"✅ Mapped {source_node_id}[{source_port_id}] -> {node_id}[{target_port_id}]: {source_outputs[source_port_id]}")
                else:
                    logger.warning(f"⚠️ Source port {source_port_id} not found in outputs of {source_node_id}")
            else:
                logger.warning(f"⚠️ No outputs found for source node {source_node_id}")
        
        # Fallback: if no specific port mapping worked, try to pass all available outputs
        # This helps with backward compatibility and debugging
        if not prepared_inputs and node_outputs:
            logger.info("🔄 No port-specific mapping found, using fallback approach")
            # Create a combined inputs structure for backward compatibility
            all_outputs = {}
            for source_node_id, outputs in node_outputs.items():
                all_outputs.update(outputs)
            
            # Try to create a reasonable input structure
            if all_outputs:
                prepared_inputs["inputs"] = all_outputs
                logger.info(f"🔄 Fallback inputs prepared: {prepared_inputs}")
        
        logger.info(f"🎯 Final prepared inputs for {node_id}: {prepared_inputs}")
        return prepared_inputs
    
    async def _execute_single_node(self, node_instance: NodeInstance, inputs: Dict[str, Any]) -> Optional[NodeExecutionResult]:
        """
        Execute a single node instance.
        
        Args:
            node_instance: The node instance to execute
            inputs: Input data for the node
            
        Returns:
            NodeExecutionResult or None if execution failed
        """
        try:
            # Prepare execution context in the format expected by node functions
            # Node functions expect a context dict with 'inputs' key containing the mapped inputs
            # Use the stored settings from the database for this node instance
            node_settings = node_instance.settings or {}
            
            # For trigger nodes, merge the trigger inputs with any stored settings
            if inputs and "user_input" in inputs:
                # This is a trigger node execution - use the user input directly
                execution_context = inputs  # Pass trigger inputs directly
                execution_context.update(node_settings)  # Add any stored settings
            else:
                # This is a downstream node - use the mapped inputs from connected nodes
                execution_context = {
                    "inputs": inputs,
                    "node_id": node_instance.id,
                    "settings": node_settings
                }
                # Add any stored settings to the context
                execution_context.update(node_settings)
            
            logger.info(f"🚀 Executing node {node_instance.id} with context: {execution_context}")
            
            # Execute using the node registry
            result = await node_registry.execute_node(node_instance.type_id, execution_context)
            
            if result.status == "success":
                logger.info(f"✅ Node {node_instance.id} executed successfully")
                logger.info(f"📤 Node {node_instance.id} outputs: {result.outputs}")
            else:
                logger.warning(f"⚠️ Node {node_instance.id} execution failed: {result.error}")
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Error executing node {node_instance.id}: {str(e)}")
            return NodeExecutionResult(
                outputs={},
                status="error",
                error=str(e),
                started_at=datetime.now(timezone.utc),
                completed_at=datetime.now(timezone.utc)
            )


# Factory function for creating FlowExecutor instances
def create_flow_executor(db: Session) -> FlowExecutor:
    """Create a new FlowExecutor instance with database session"""
    return FlowExecutor(db)
