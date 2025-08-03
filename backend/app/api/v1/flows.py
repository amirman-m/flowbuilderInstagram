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
import logging
from ...schemas.flow_save import FlowSaveRequest, NodeSchema, EdgeSchema
from ...models.nodes import NodeInstance, NodeConnection , NodeCategory
from ...services.flow_execution import create_flow_executor, FlowExecutionError
from ...services import flow_service

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


class FlowExecutionRequest(BaseModel):
    trigger_inputs: Dict[str, Any] = {}


class FlowExecutionResponse(BaseModel):
    flow_id: int
    flow_name: str
    trigger_node_id: str
    execution_results: Dict[str, Any]
    executed_at: str
    total_nodes_executed: int


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
    
    return flow_service.update_flow(db, flow, flow_update)


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


@router.post("/{flow_id}/save", status_code=status.HTTP_201_CREATED)
def save_flow(
    flow_id: int,
    payload: FlowSaveRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Persist complete flow graph (nodes + edges) for the given user."""
    flow = db.query(Flow).filter(Flow.id == flow_id, Flow.user_id == current_user.id).first()
    if not flow:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flow not found")

    
    try:
        new_version = flow_service.save_flow_graph(db, flow, payload)
        return {"version": new_version, "saved_at": flow.updated_at.isoformat() if flow.updated_at else None}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to save flow: {exc}")
@router.get("/{flow_id}/nodes", response_model=List[NodeSchema])
def get_flow_nodes(
    flow_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Return all node instances for the specified flow."""
    flow = db.query(Flow).filter(Flow.id == flow_id, Flow.user_id == current_user.id).first()
    if not flow:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flow not found")

    nodes = db.query(NodeInstance).filter(NodeInstance.flow_id == flow_id).all()
    return [NodeSchema.model_validate(n, from_attributes=True) for n in nodes]


@router.get("/{flow_id}/connections", response_model=List[EdgeSchema])
def get_flow_connections(
    flow_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Return all node connections (edges) for the specified flow."""
    flow = db.query(Flow).filter(Flow.id == flow_id, Flow.user_id == current_user.id).first()
    if not flow:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flow not found")

    edges = db.query(NodeConnection).filter(NodeConnection.flow_id == flow_id).all()
    return [EdgeSchema.model_validate(e, from_attributes=True) for e in edges]



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
    
    node_instance = db.query(NodeInstance).filter(
        NodeInstance.flow_id == flow_id,
        NodeInstance.id == node_id
    ).first()

    if not node_instance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Node not found in this flow"
        )

    try:
        node_type_id = node_instance.type_id
        
        # Build execution context with node settings and request inputs
        context = {
            "node_id": node_id,
            "flow_id": flow_id,
            "settings": node_instance.settings or {},
            **request.inputs  # Include access_token and other inputs from frontend
        }
        
        # Execute the node using the node registry with full context
        result = await node_registry.execute_node(node_type_id, context)
        
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


@router.post("/{flow_id}/execute", response_model=FlowExecutionResponse)
async def execute_flow(
    flow_id: int,
    request: FlowExecutionRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Execute a complete flow starting from the trigger node."""
    try:
        # Create flow executor instance
        executor = create_flow_executor(db)
        
        # Execute the flow
        result = await executor.execute_flow(
            flow_id=flow_id,
            user_id=current_user.id,
            trigger_inputs=request.trigger_inputs
        )
        
        return FlowExecutionResponse(**result)
        
    except FlowExecutionError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logging.exception(f"Failed to execute flow {flow_id}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to execute flow: {str(e)}"
        )
