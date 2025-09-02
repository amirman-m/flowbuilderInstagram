import asyncio
import json
from typing import Dict, Any, Optional
from datetime import datetime, timezone, timedelta
from ....models.nodes import NodeType, NodeCategory, NodeDataType, NodePort, NodePorts, NodeExecutionResult
import uuid
import logging

logger = logging.getLogger(__name__)

def get_scheduled_message_node_type() -> NodeType:
    return NodeType(
        id="scheduled_message",
        name="Scheduled Message",
        description="Bot sends periodic messages (e.g., daily tips) to users who subscribe. Facilitates habit-building or notification services.",
        category=NodeCategory.TRIGGER,
        version="1.0.0",
        icon="schedule",
        color="#FF9800",
        ports=NodePorts(
            inputs=[],  # Trigger nodes have no inputs
            outputs=[
                NodePort(
                    id="message_data",
                    name="message_data",
                    label="Message Data",
                    description="Contains session ID, scheduled flag, and trigger metadata",
                    data_type=[NodeDataType.STRING],
                    required=True
                )
            ]
        ),
        settings_schema={
            "type": "object",
            "properties": {
                "time_unit": {
                    "type": "string",
                    "title": "Time Unit",
                    "description": "Select the time unit for scheduling",
                    "enum": ["seconds", "minutes", "hours"],
                    "default": "minutes"
                },
                "time_value": {
                    "type": "integer",
                    "title": "Time Value",
                    "description": "Time interval value (depends on selected unit)",
                    "minimum": 1,
                    "maximum": 60,
                    "default": 10
                },
                "message_content": {
                    "type": "string",
                    "title": "Message Content",
                    "description": "Optional message content to send periodically",
                    "default": "",
                    "maxLength": 1000
                }
            },
            "required": ["time_unit", "time_value"],
            # Conditional constraints to keep settings UI in sync with dialog/backend
            "allOf": [
                {
                    "if": {"properties": {"time_unit": {"const": "seconds"}}},
                    "then": {"properties": {"time_value": {"enum": [30, 60]}}}
                },
                {
                    "if": {"properties": {"time_unit": {"const": "minutes"}}},
                    "then": {"properties": {"time_value": {"minimum": 1, "maximum": 60}}}
                },
                {
                    "if": {"properties": {"time_unit": {"const": "hours"}}},
                    "then": {"properties": {"time_value": {"minimum": 1, "maximum": 24}}}
                }
            ]
        }
    )

def validate_time_settings(time_unit: str, time_value: int) -> tuple[bool, str]:
    """Validate time unit and value combinations"""
    if time_unit == "seconds":
        if time_value not in [30, 60]:
            return False, "Seconds can only be 30 or 60"
    elif time_unit == "minutes":
        if time_value < 1 or time_value > 60:
            return False, "Minutes must be between 1 and 60"
    elif time_unit == "hours":
        if time_value < 1 or time_value > 24:
            return False, "Hours must be between 1 and 24"
    else:
        return False, "Invalid time unit"
    
    return True, ""

def calculate_next_execution(time_unit: str, time_value: int) -> datetime:
    """Calculate the next execution time based on settings"""
    now = datetime.now(timezone.utc)
    
    if time_unit == "seconds":
        return now + timedelta(seconds=time_value)
    elif time_unit == "minutes":
        return now + timedelta(minutes=time_value)
    elif time_unit == "hours":
        return now + timedelta(hours=time_value)
    
    return now

async def execute_scheduled_message_trigger(context: Dict[str, Any]) -> NodeExecutionResult:
    """
    Execute Scheduled Message trigger node
    
    Execution Contexts:
    1) Node test execution: Return immediately with test data
    2) Flow test execution: Return immediately with test data  
    3) Scheduled execution: Called by scheduler service with actual timing
    4) 24/7 activation: Continuous scheduling (controlled by flow.status)
    """
    start_time = datetime.now(timezone.utc)
    
    # Get context and settings
    settings = context.get("settings", {})
    flow_id = context.get("flow_id", 1)
    node_id = context.get("node_id", "scheduled_message")
    user_id = context.get("user_id", 1)
    
    # Get scheduling settings
    time_unit = settings.get("time_unit", "minutes")
    time_value = settings.get("time_value", 10)
    message_content = settings.get("message_content", "")
    
    # Validate settings
    is_valid, error_msg = validate_time_settings(time_unit, time_value)
    if not is_valid:
        return NodeExecutionResult(
            outputs={},
            status="error",
            error=f"Invalid time configuration: {error_msg}",
            started_at=start_time,
            completed_at=datetime.now(timezone.utc)
        )
    
    # Determine execution context
    is_scheduled_execution = bool(context.get("is_scheduled_execution"))
    is_flow_execution = bool(context.get("is_flow_execution"))
    is_node_test = not is_scheduled_execution and not is_flow_execution
    
    # Set execution mode
    if is_scheduled_execution:
        execution_mode = "scheduled_execution"
    elif is_flow_execution:
        execution_mode = "flow_test"
    else:
        execution_mode = "node_test"
    
    logger.info(f"Scheduled Message node execution - flow {flow_id}, node {node_id}, mode: {execution_mode}")
    
    # Create session ID
    session_id = str(uuid.uuid4())
    
    # For test executions (node or flow), return immediately
    if execution_mode in ["node_test", "flow_test"]:
        message_data = {
            "session_id": session_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "scheduled": True,
            "input_type": "scheduled",
            "execution_mode": execution_mode,
            "is_test_mode": True,
            "schedule_config": {
                "time_unit": time_unit,
                "time_value": time_value,
                "interval_description": f"Every {time_value} {time_unit}"
            },
            "metadata": {
                "flow_id": flow_id,
                "node_id": node_id,
                "user_id": user_id,
                "message_content": message_content
            }
        }
        
        # Only add input_text if message_content is provided
        if message_content and message_content.strip():
            message_data["input_text"] = message_content      
        test_type = "individual node" if execution_mode == "node_test" else "flow"
        return NodeExecutionResult(
            outputs={"message_data": message_data},
            status="success",
            logs=[f"Scheduled Message trigger ready for {test_type} testing - configured for {time_value} {time_unit} intervals"],
            started_at=start_time,
            completed_at=datetime.now(timezone.utc)
        )
    
    # For actual scheduled execution
    if execution_mode == "scheduled_execution":
        message_data = {
            "session_id": session_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "scheduled": True,
            "input_type": "scheduled",
            "execution_mode": execution_mode,
            "is_test_mode": False,
            "schedule_config": {
                "time_unit": time_unit,
                "time_value": time_value,
                "next_execution": calculate_next_execution(time_unit, time_value).isoformat()
            },
            "metadata": {
                "flow_id": flow_id,
                "node_id": node_id,
                "user_id": user_id,
                "message_content": message_content,
                "execution_time": start_time.isoformat()
            }
        }
        
        # Only add input_text if message_content is provided
        if message_content and message_content.strip():
            message_data["input_text"] = message_content
        
        return NodeExecutionResult(
            outputs={"message_data": message_data},
            status="success",
            logs=[f"Scheduled message triggered: '{message_content}' (every {time_value} {time_unit})"],
            started_at=start_time,
            completed_at=datetime.now(timezone.utc)
        )
    
    # Fallback
    return NodeExecutionResult(
        outputs={},
        status="error",
        error="Unknown execution context",
        started_at=start_time,
        completed_at=datetime.now(timezone.utc)
    )
