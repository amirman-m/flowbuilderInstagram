from __future__ import annotations

from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional


class PortSchema(BaseModel):
    """Port definition attached to a node (optional for save payload)."""

    id: str
    node_id: str = Field(..., alias="nodeId")
    name: str
    direction: str  # "input" | "output"
    data: Optional[Dict[str, Any]] = None


class NodeSchema(BaseModel):
    """Serialized node instance coming from the front-end."""

    id: str
    type_id: str = Field(..., alias="typeId")
    label: Optional[str] = None
    position: Dict[str, float]
    settings: Optional[Dict[str, Any]] = Field(default_factory=dict)
    data: Optional[Dict[str, Any]] = None
    disabled: Optional[bool] = False

    class Config:
        allow_population_by_field_name = True
        populate_by_name = True
        orm_mode = True
        from_attributes = True


class EdgeSchema(BaseModel):
    """Serialized edge / connection between two node ports."""

    id: str
    source_node_id: str = Field(..., alias="sourceNodeId")
    target_node_id: str = Field(..., alias="targetNodeId")
    source_port_id: str = Field(..., alias="sourcePortId")
    target_port_id: str = Field(..., alias="targetPortId")
    data: Optional[Dict[str, Any]] = None

    class Config:
        allow_population_by_field_name = True
        populate_by_name = True
        orm_mode = True
        from_attributes = True


class FlowSaveRequest(BaseModel):
    """Request body expected by POST /flows/{id}/save"""

    flow_name: Optional[str] = None
    nodes: List[NodeSchema]
    edges: List[EdgeSchema] = Field(..., alias="connections")
    ports: Optional[List[PortSchema]] = None  # currently unused but accepted
