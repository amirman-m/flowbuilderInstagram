from fastapi import APIRouter, Request, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from ...core.database import get_db
from ...models.flow import Flow
from ...models.nodes import NodeInstance
from ...services.flow_execution import create_flow_executor
from typing import Dict, Any, Optional
from datetime import datetime, timezone
import logging
import json

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/webhook/{flow_id}")
@router.get("/webhook/{flow_id}")
async def telegram_webhook(
    flow_id: int,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Telegram webhook endpoint that receives updates and triggers flow execution
    SIMPLIFIED: Direct processing without execution_id complexity
    """
    try:
        # Handle GET requests (Telegram validation)
        if request.method == "GET":
            return {"ok": True, "message": "Webhook endpoint is ready"}
        
        # Get the webhook payload for POST requests
        webhook_data = await request.json()
        logger.info(f"Received Telegram webhook for flow {flow_id}: {json.dumps(webhook_data, indent=2)}")
        
        # Get the flow and find the Telegram trigger node
        flow = db.query(Flow).filter(Flow.id == flow_id).first()
        if not flow:
            logger.error(f"Flow {flow_id} not found")
            return {"ok": False, "error": "Flow not found"}
        
        # Find the Telegram trigger node
        telegram_trigger = db.query(NodeInstance).filter(
            NodeInstance.flow_id == flow_id,
            NodeInstance.type_id == "telegram_input"
        ).first()
        
        if not telegram_trigger:
            logger.error(f"No Telegram trigger found in flow {flow_id}")
            return {"ok": False, "error": "No Telegram trigger found"}
        
        # Get access token
        access_token = telegram_trigger.data.get("settings", {}).get("access_token")
        if not access_token:
            logger.error(f"No access token found for Telegram trigger in flow {flow_id}")
            return {"ok": False, "error": "No access token configured"}
        
        # Process the webhook message
        from ...services.nodes.triggers.telegram_input import process_webhook_message
        result = await process_webhook_message(webhook_data, access_token)
        
        if result.status == "success":
            # Extract actual message data for user display
            message_data = result.outputs.get("message_data", {})
            input_text = message_data.get('input_text') or message_data.get('chat_input', 'N/A')
            chat_id = message_data.get('chat_id', 'N/A')
            input_type = message_data.get('input_type', 'unknown')
            
            # Update the Telegram trigger node with actual message data for frontend display
            try:
                current_data = telegram_trigger.data or {}
                current_data["lastExecution"] = {
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "status": "success",
                    "outputs": {
                        "message_data": message_data
                    },
                    "logs": [f"Telegram message received from chat {chat_id}: '{input_text}'"],
                    "executionTime": 0
                }
                
                telegram_trigger.data = current_data
                db.commit()
                
                logger.info(f"Stored actual message data for frontend display: chat_id={chat_id}, text='{input_text}'")
                
            except Exception as e:
                logger.error(f"Failed to store message data in node: {str(e)}")
            
            # Execute the flow with the processed message data
            try:
                flow_executor = create_flow_executor(db)
                
                # Create execution context with webhook data
                execution_context = {
                    "webhook_data": webhook_data,
                    "trigger_data": message_data
                }
                
                # Execute the flow
                execution_result = await flow_executor.execute_flow(
                    flow_id=flow_id,
                    trigger_inputs=execution_context,
                    user_id=flow.user_id
                )
                
                logger.info(f"Flow {flow_id} executed successfully via Telegram webhook")
                return {
                    "ok": True, 
                    "message": f"Message processed: '{input_text}' from chat {chat_id}",
                    "message_data": message_data
                }
                
            except Exception as e:
                logger.error(f"Error executing flow {flow_id}: {str(e)}")
                return {"ok": False, "error": f"Flow execution failed: {str(e)}"}
        else:
            logger.error(f"Failed to process webhook message: {result.error}")
            return {"ok": False, "error": f"Message processing failed: {result.error}"}
            
    except json.JSONDecodeError:
        logger.error("Invalid JSON in Telegram webhook payload")
        raise HTTPException(status_code=400, detail="Invalid JSON payload")
        
    except Exception as e:
        logger.error(f"Telegram webhook processing error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Webhook processing failed: {str(e)}")

@router.post("/setup-webhook/{flow_id}")
async def setup_telegram_webhook(
    flow_id: int,
    db: Session = Depends(get_db)
):
    """
    Set up Telegram webhook for a specific flow
    """
    try:
        # Verify the flow exists
        flow = db.query(Flow).filter(Flow.id == flow_id).first()
        if not flow:
            raise HTTPException(status_code=404, detail="Flow not found")
        
        # Find the Telegram trigger node in this flow
        telegram_trigger = db.query(NodeInstance).filter(
            NodeInstance.flow_id == flow_id,
            NodeInstance.type_id == "telegram_input"
        ).first()
        
        if not telegram_trigger:
            raise HTTPException(
                status_code=400, 
                detail="No Telegram trigger node found in this flow"
            )
        
        # Get the access token from node settings
        settings = telegram_trigger.data.get("settings", {})
        access_token = settings.get("access_token")
        
        if not access_token:
            raise HTTPException(
                status_code=400,
                detail="Bot access token not configured in Telegram trigger node"
            )
        
        # Import here to avoid circular imports
        from ...services.nodes.triggers.telegram_input import setup_telegram_webhook
        
        # Construct webhook URL (this should match your domain)
        # In production, this should be your actual domain
        webhook_url = f"https://asangram.tech/api/v1/telegram/webhook/{flow_id}"
        
        # Set up the webhook
        success = await setup_telegram_webhook(access_token, webhook_url)
        
        if success:
            return {
                "ok": True,
                "message": "Telegram webhook set up successfully",
                "webhook_url": webhook_url
            }
        else:
            raise HTTPException(
                status_code=500,
                detail="Failed to set up Telegram webhook"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Webhook setup error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Webhook setup failed: {str(e)}")

# These endpoints are no longer needed - using direct approach
# The webhook endpoint above handles everything in one process
