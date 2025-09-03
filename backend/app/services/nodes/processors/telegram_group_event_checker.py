from typing import Dict, Any
from app.models.nodes import NodeType, NodeCategory, NodeDataType, NodePort, NodePorts, NodeExecutionResult
import logging

logger = logging.getLogger(__name__)


def get_telegram_group_event_checker_node_type() -> NodeType:
    return NodeType(
        id="telegram_group_event_checker",
        name="Telegram Group User Join Check",
        description="Checks Telegram webhook data for user join events and routes to true/false outputs",
        category=NodeCategory.PROCESSOR,
        version="1.0.0",
        icon="group",
        color="#FF6B35",  # Electric orange color
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
                    label="Join",
                    description="Emits original payload when a user join event is detected",
                    data_type=NodeDataType.OBJECT,
                    required=False,
                ),
                NodePort(
                    id="false",
                    name="false",
                    label="Not Join",
                    description="Emits original payload when no user join event is detected",
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


async def execute_telegram_group_event_checker(context: Dict[str, Any]) -> NodeExecutionResult:
    """
    Check Telegram webhook data for user join events.
    Routes the original payload to 'true' output if user join detected, 'false' otherwise.
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
            error="Telegram Group Event Checker requires 'message_data' object input from TelegramInputNode",
        )

    # Check for user join events in the message data
    is_user_join = False
    join_details = []
    
    try:
        # Check if this is a Telegram webhook with new_chat_members
        # The webhook data might be nested in different ways depending on how it was processed
        
        # Method 1: Check if message_data contains webhook structure directly
        if 'new_chat_members' in message_data:
            new_members = message_data.get('new_chat_members', [])
            if new_members and isinstance(new_members, list):
                is_user_join = True
                for user in new_members:
                    if isinstance(user, dict):
                        user_id = user.get('id')
                        username = user.get('username', 'No username')
                        first_name = user.get('first_name', 'New User')
                        join_details.append({
                            'user_id': user_id,
                            'username': username,
                            'first_name': first_name,
                            'event_type': 'join'
                        })
        
        # Method 2: Check metadata for webhook information
        metadata = message_data.get('metadata', {})
        if isinstance(metadata, dict) and 'webhook_data' in metadata:
            webhook_data = metadata['webhook_data']
            if isinstance(webhook_data, dict):
                message = webhook_data.get('message', {})
                if isinstance(message, dict) and 'new_chat_members' in message:
                    new_members = message.get('new_chat_members', [])
                    if new_members and isinstance(new_members, list):
                        is_user_join = True
                        for user in new_members:
                            if isinstance(user, dict):
                                user_id = user.get('id')
                                username = user.get('username', 'No username')
                                first_name = user.get('first_name', 'New User')
                                join_details.append({
                                    'user_id': user_id,
                                    'username': username,
                                    'first_name': first_name,
                                    'event_type': 'join'
                                })
        
        # Method 3: Check if the original webhook context is available
        # This would be passed from the TelegramInputNode execution context
        webhook_context = context.get('webhook_data', {})
        if isinstance(webhook_context, dict):
            message = webhook_context.get('message', {})
            if isinstance(message, dict) and 'new_chat_members' in message:
                new_members = message.get('new_chat_members', [])
                if new_members and isinstance(new_members, list):
                    is_user_join = True
                    for user in new_members:
                        if isinstance(user, dict):
                            user_id = user.get('id')
                            username = user.get('username', 'No username')
                            first_name = user.get('first_name', 'New User')
                            join_details.append({
                                'user_id': user_id,
                                'username': username,
                                'first_name': first_name,
                                'event_type': 'join'
                            })

        # Prepare output with enhanced metadata
        enhanced_message_data = message_data.copy()
        
        # Add group event information to metadata
        if 'metadata' not in enhanced_message_data:
            enhanced_message_data['metadata'] = {}
        
        enhanced_message_data['metadata']['group_event_check'] = {
            'is_user_join': is_user_join,
            'join_details': join_details,
            'checked_at': context.get('timestamp', 'unknown')
        }

        # Route to appropriate output
        outputs: Dict[str, Any] = {}
        routed_to = None
        
        if is_user_join:
            outputs["true"] = enhanced_message_data
            routed_to = "true (user join detected)"
            log_message = f"User join event detected: {len(join_details)} new member(s)"
            if join_details:
                usernames = [detail.get('username', detail.get('first_name', 'Unknown')) for detail in join_details]
                log_message += f" - {', '.join(usernames)}"
        else:
            outputs["false"] = enhanced_message_data
            routed_to = "false (no user join)"
            log_message = "No user join event detected in message data"

        logger.info(f"Telegram Group Event Checker routed to: {routed_to}")

        return NodeExecutionResult(
            outputs=outputs,
            status="success",
            logs=[log_message],
        )

    except Exception as e:
        logger.error(f"Error in Telegram Group Event Checker: {str(e)}")
        return NodeExecutionResult(
            outputs={},
            status="error",
            error=f"Failed to check group events: {str(e)}",
        )
