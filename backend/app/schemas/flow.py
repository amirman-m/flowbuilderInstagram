from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime


class FlowBase(BaseModel):
    name: str
    description: Optional[str] = None


class FlowCreate(FlowBase):
    flow_data: Optional[Dict[str, Any]] = None


class FlowUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    flow_data: Optional[Dict[str, Any]] = None
    status: Optional[str] = None


class Flow(FlowBase):
    id: int
    user_id: int
    flow_data: Optional[Dict[str, Any]] = None
    status: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
