from typing import Dict, Any
from app.models.nodes import NodeType, NodeCategory, NodeDataType, NodePort, NodePorts, NodeExecutionResult
import logging

logger = logging.getLogger(__name__)


def get_telegram_left_chat_member_checker_node_type() -> NodeType:
    return NodeType(
        id="telegram_left_chat_member_checker",
        name="Telegram Group User Leave Check",
        description="Checks Telegram webhook data for user leave events and routes to true/false outputs",
        category=NodeCategory.PROCESSOR,
        version="1.0.0",
        icon="exit_to_app",
        color="#FF4444",  # Red color for leave events
        ports=NodePorts(
            inputs=[
                NodePort(
                    id="message_data",
                    name="message_data",
                    label="Message Data",
                    description="Telegram webhook data from TelegramInputNode containing message and event information",
                    data_type=[NodeDataType.OBJECT, NodeDataType.STRING],
                    required=True,
                )
            ],
            outputs=[
                NodePort(
                    id="true",
                    name="true",
                    label="Leave",
                    description="Emits original payload when a user leave event is detected",
                    data_type=NodeDataType.OBJECT,
                    required=False,
                ),
                NodePort(
                    id="false",
                    name="false",
                    label="Not Leave",
                    description="Emits original payload when no user leave event is detected",
                    data_type=NodeDataType.OBJECT,
                    required=False,
                ),
            ],
        ),
        settings_schema={
            "type": "object",
            "properties": {},
            "required": [],
        },
    )


async def execute_telegram_left_chat_member_checker(context: Dict[str, Any]) -> NodeExecutionResult:
    """
    Check Telegram webhook data for user leave events.
    Routes the original payload to 'true' output if user leave detected, 'false' otherwise.
    """
    # Get inputs
    inputs = context.get("inputs", {}) or {}
    
    # Extract message_data
    message_data = inputs.get("message_data")
    if message_data is None and isinstance(inputs, dict):
        # Try to find the first dict-like payload as fallback
        for _, v in inputs.items():
            if isinstance(v, dict):
                message_data = v
                break

    if not isinstance(message_data, dict):
        return NodeExecutionResult(
            outputs={},
            status="error",
            error="Telegram Left Chat Member Checker requires 'message_data' object input from TelegramInputNode",
        )

    # Check for user leave events in the message data
    is_user_leave = False
    leave_details = []
    
    try:
        # Check if this is a Telegram webhook with left_chat_member
        # The webhook data might be nested in different ways depending on how it was processed
        
        # Method 1: Check if message_data contains webhook structure directly
        if 'left_chat_member' in message_data:
            left_member = message_data.get('left_chat_member')
            if left_member and isinstance(left_member, dict):
                is_user_leave = True
                user_id = left_member.get('id')
                username = left_member.get('username', 'No username')
                first_name = left_member.get('first_name', 'User')
                leave_details.append({
                    'user_id': user_id,
                    'username': username,
                    'first_name': first_name,
                    'event_type': 'leave'
                })
        
        # Method 2: Check metadata for webhook information
        metadata = message_data.get('metadata', {})
        if isinstance(metadata, dict) and 'webhook_data' in metadata:
            webhook_data = metadata['webhook_data']
            if isinstance(webhook_data, dict):
                message = webhook_data.get('message', {})
                if isinstance(message, dict) and 'left_chat_member' in message:
                    left_member = message.get('left_chat_member')
                    if left_member and isinstance(left_member, dict):
                        is_user_leave = True
                        user_id = left_member.get('id')
                        username = left_member.get('username', 'No username')
                        first_name = left_member.get('first_name', 'User')
                        leave_details.append({
                            'user_id': user_id,
                            'username': username,
                            'first_name': first_name,
                            'event_type': 'leave'
                        })
        
        # Method 3: Check if the original webhook context is available
        # This would be passed from the TelegramInputNode execution context
        webhook_context = context.get('webhook_data', {})
        if isinstance(webhook_context, dict):
            message = webhook_context.get('message', {})
            if isinstance(message, dict) and 'left_chat_member' in message:
                left_member = message.get('left_chat_member')
                if left_member and isinstance(left_member, dict):
                    is_user_leave = True
                    user_id = left_member.get('id')
                    username = left_member.get('username', 'No username')
                    first_name = left_member.get('first_name', 'User')
                    leave_details.append({
                        'user_id': user_id,
                        'username': username,
                        'first_name': first_name,
                        'event_type': 'leave'
                    })

        # Prepare output with enhanced metadata
        enhanced_message_data = message_data.copy()
        
        # Add group event information to metadata
        if 'metadata' not in enhanced_message_data:
            enhanced_message_data['metadata'] = {}
        
        enhanced_message_data['metadata']['group_event_check'] = {
            'is_user_leave': is_user_leave,
            'leave_details': leave_details,
            'checked_at': context.get('timestamp', 'unknown')
        }

        # Route to appropriate output
        outputs: Dict[str, Any] = {}
        routed_to = None
        
        if is_user_leave:
            outputs["true"] = enhanced_message_data
            routed_to = "true (user leave detected)"
            log_message = f"User leave event detected: {len(leave_details)} member(s) left"
            if leave_details:
                usernames = [detail.get('username', detail.get('first_name', 'Unknown')) for detail in leave_details]
                log_message += f" - {', '.join(usernames)}"
        else:
            outputs["false"] = enhanced_message_data
            routed_to = "false (no user leave)"
            log_message = "No user leave event detected in message data"

        logger.info(f"Telegram Left Chat Member Checker routed to: {routed_to}")

        return NodeExecutionResult(
            outputs=outputs,
            status="success",
            logs=[log_message],
        )

    except Exception as e:
        logger.error(f"Error in Telegram Left Chat Member Checker: {str(e)}")
        return NodeExecutionResult(
            outputs={},
            status="error",
            error=f"Failed to check left chat member events: {str(e)}",
        )
