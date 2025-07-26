from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, JSON, ForeignKey
# Use shared Base from core.database to ensure tables are created once
from ..core.database import Base
from sqlalchemy.orm import relationship
from datetime import datetime
from enum import Enum
from typing import Dict, List, Any, Optional
from pydantic import BaseModel, Field, validator
from typing import Union



class NodeCategory(str, Enum):
    TRIGGER = "trigger"
    PROCESSOR = "processor"
    ACTION = "action"

class NodeDataType(str, Enum):
    STRING = "string"
    NUMBER = "number"
    BOOLEAN = "boolean"
    OBJECT = "object"
    ARRAY = "array"
    ANY = "any"

class NodeExecutionStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    ERROR = "error"

# Pydantic models for node type definitions
class NodePort(BaseModel):
    id: str
    name: str
    label: str
    description: str
    data_type: Union[NodeDataType, List[NodeDataType]] = Field(alias="dataType")
    required: bool = True
    @validator('data_type', pre=True)
    def ensure_list(cls, v):
        if not isinstance(v, list):
            return [v]
        return v
    
    class Config:
        allow_population_by_field_name = True
        populate_by_name = True

class NodePorts(BaseModel):
    inputs: List[NodePort]
    outputs: List[NodePort]

class NodeType(BaseModel):
    id: str
    name: str
    description: str
    category: NodeCategory
    version: str
    icon: Optional[str] = None
    color: Optional[str] = None
    ports: NodePorts
    settings_schema: Dict[str, Any] = Field(alias="settingsSchema")
    
    class Config:
        allow_population_by_field_name = True
        populate_by_name = True

class NodeExecutionResult(BaseModel):
    outputs: Dict[str, Any]
    status: NodeExecutionStatus
    error: Optional[str] = None
    execution_time_ms: Optional[int] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    logs: List[str] = []

# SQLAlchemy models for database storage

class NodeInstance(Base):
    __tablename__ = "node_instances"
    
    id = Column(String, primary_key=True, index=True)
    flow_id = Column(Integer, ForeignKey("flows.id"))
    type_id = Column(String, index=True)  # References NodeType.id
    label = Column(String)
    position = Column(JSON)  # {x: number, y: number}
    settings = Column(JSON)  # Node-specific settings
    data = Column(JSON)  # Runtime data including inputs, outputs, execution results
    disabled = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    flow = relationship("Flow", back_populates="nodes")

class NodeConnection(Base):
    __tablename__ = "node_connections"
    
    id = Column(String, primary_key=True, index=True)
    flow_id = Column(Integer, ForeignKey("flows.id"))
    source_node_id = Column(String, ForeignKey("node_instances.id"))
    target_node_id = Column(String, ForeignKey("node_instances.id"))
    source_port_id = Column(String)
    target_port_id = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    flow = relationship("Flow", back_populates="connections")
