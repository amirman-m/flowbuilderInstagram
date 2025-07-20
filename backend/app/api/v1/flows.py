from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from ...core.database import get_db
from ...models.flow import Flow
from ...models.user import User
from ...schemas.flow import FlowCreate, FlowUpdate, Flow as FlowSchema
from ..deps import get_current_active_user

router = APIRouter()


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
