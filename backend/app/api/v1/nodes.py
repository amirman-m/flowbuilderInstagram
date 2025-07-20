from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any
from app.core.node_registry import node_registry
from app.models.nodes import NodeType, NodeCategory, NodeExecutionResult
from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter()

@router.get("/types")
async def get_node_types(
    category: NodeCategory = None,
    current_user: User = Depends(get_current_user)
):
    """
    Get all available node types, optionally filtered by category
    """
    try:
        if category:
            node_types = node_registry.get_node_types_by_category(category)
        else:
            node_types = node_registry.get_all_node_types()
        
        # Convert to dict with camelCase field names for frontend compatibility
        result = []
        for node_type in node_types:
            node_dict = {
                "id": node_type.id,
                "name": node_type.name,
                "description": node_type.description,
                "category": node_type.category,
                "version": node_type.version,
                "icon": node_type.icon,
                "color": node_type.color,
                "ports": {
                    "inputs": [
                        {
                            "id": port.id,
                            "name": port.name,
                            "label": port.label,
                            "description": port.description,
                            "dataType": port.data_type,
                            "required": port.required
                        } for port in node_type.ports.inputs
                    ],
                    "outputs": [
                        {
                            "id": port.id,
                            "name": port.name,
                            "label": port.label,
                            "description": port.description,
                            "dataType": port.data_type,
                            "required": port.required
                        } for port in node_type.ports.outputs
                    ]
                },
                "settingsSchema": node_type.settings_schema
            }
            result.append(node_dict)
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get node types: {str(e)}")

@router.get("/types/{node_type_id}", response_model=NodeType)
async def get_node_type(
    node_type_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Get a specific node type by ID
    """
    try:
        node_type = node_registry.get_node_type(node_type_id)
        return node_type
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get node type: {str(e)}")

@router.post("/execute/{node_type_id}", response_model=NodeExecutionResult)
async def execute_node(
    node_type_id: str,
    execution_context: Dict[str, Any],
    current_user: User = Depends(get_current_user)
):
    """
    Execute a node with the given context
    """
    try:
        # Validate that the node type exists
        node_registry.get_node_type(node_type_id)
        
        # Execute the node
        result = await node_registry.execute_node(node_type_id, execution_context)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to execute node: {str(e)}")

@router.get("/categories", response_model=List[str])
async def get_node_categories(
    current_user: User = Depends(get_current_user)
):
    """
    Get all available node categories
    """
    return [category.value for category in NodeCategory]
