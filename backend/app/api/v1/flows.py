from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from ...core.database import get_db
from ...models.flow import Flow
from ...models.user import User
from ...schemas.flow import FlowCreate, FlowUpdate, Flow as FlowSchema
from ..deps import get_current_active_user
from ...core.node_registry import node_registry
from pydantic import BaseModel

router = APIRouter()


# Request/Response models for node execution
class NodeExecutionRequest(BaseModel):
    inputs: Dict[str, Any] = {}


class NodeExecutionResponse(BaseModel):
    status: str
    outputs: Dict[str, Any]
    error: str | None = None
    startedAt: str | None = None
    completedAt: str | None = None


@router.get("/", response_model=List[FlowSchema])
def get_flows(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all flows for the current user."""
    flows = db.query(Flow).filter(Flow.user_id == current_user.id).all()
    return flows


@router.post("/", response_model=FlowSchema)
def create_flow(
    flow: FlowCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new flow."""
    db_flow = Flow(
        user_id=current_user.id,
        name=flow.name,
        description=flow.description,
        flow_data=flow.flow_data or {}
    )
    db.add(db_flow)
    db.commit()
    db.refresh(db_flow)
    return db_flow


@router.get("/{flow_id}", response_model=FlowSchema)
def get_flow(
    flow_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get a specific flow."""
    flow = db.query(Flow).filter(
        Flow.id == flow_id,
        Flow.user_id == current_user.id
    ).first()
    
    if not flow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flow not found"
        )
    
    return flow


@router.put("/{flow_id}", response_model=FlowSchema)
def update_flow(
    flow_id: int,
    flow_update: FlowUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update a flow."""
    flow = db.query(Flow).filter(
        Flow.id == flow_id,
        Flow.user_id == current_user.id
    ).first()
    
    if not flow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flow not found"
        )
    
    # Update fields
    if flow_update.name is not None:
        flow.name = flow_update.name
    if flow_update.description is not None:
        flow.description = flow_update.description
    if flow_update.flow_data is not None:
        flow.flow_data = flow_update.flow_data
    if flow_update.status is not None:
        flow.status = flow_update.status
    
    db.commit()
    db.refresh(flow)
    return flow


@router.delete("/{flow_id}")
def delete_flow(
    flow_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a flow."""
    flow = db.query(Flow).filter(
        Flow.id == flow_id,
        Flow.user_id == current_user.id
    ).first()
    
    if not flow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flow not found"
        )
    
    db.delete(flow)
    db.commit()
    return {"message": "Flow deleted successfully"}


@router.post("/{flow_id}/nodes/{node_id}/execute", response_model=NodeExecutionResponse)
async def execute_node(
    flow_id: int,
    node_id: str,
    request: NodeExecutionRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Execute a specific node within a flow."""
    # Verify the flow exists and belongs to the user
    flow = db.query(Flow).filter(
        Flow.id == flow_id,
        Flow.user_id == current_user.id
    ).first()
    
    if not flow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flow not found"
        )
    
    try:
        # For now, we'll determine the node type from the node_id
        # In a full implementation, you'd store node instances in the database
        # and look up the actual node type from there
        
        # For the Chat Input node, we'll assume it's a chat-input type
        # This is a simplified implementation - in production you'd have
        # a proper node instance management system
        node_type_id = "chat-input"  # This should come from the database
        
        # Execute the node using the node registry
        result = await node_registry.execute_node(node_type_id, request.inputs)
        
        return NodeExecutionResponse(
            status=result.status,
            outputs=result.outputs,
            error=result.error,
            startedAt=result.started_at.isoformat() if result.started_at else None,
            completedAt=result.completed_at.isoformat() if result.completed_at else None
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to execute node: {str(e)}"
        )
