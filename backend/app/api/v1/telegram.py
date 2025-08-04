from fastapi import APIRouter, Request, HTTPException, Depends, Query
from fastapi.responses import StreamingResponse
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
    Now also notifies SSE connections immediately
    """
    try:
        if request.method == "GET":
            return {"ok": True, "message": "Webhook endpoint is ready"}
        
        webhook_data = await request.json()
        logger.info(f"Received Telegram webhook for flow {flow_id}: {json.dumps(webhook_data, indent=2)}")
        
        flow = db.query(Flow).filter(Flow.id == flow_id).first()
        if not flow:
            logger.error(f"Flow {flow_id} not found")
            return {"ok": False, "error": "Flow not found"}
        
        telegram_trigger = db.query(NodeInstance).filter(
            NodeInstance.flow_id == flow_id,
            NodeInstance.type_id == "telegram_input"
        ).first()
        
        if not telegram_trigger:
            logger.error(f"No Telegram trigger found in flow {flow_id}")
            return {"ok": False, "error": "No Telegram trigger found"}
        
        access_token = telegram_trigger.data.get("settings", {}).get("access_token")
        if not access_token:
            logger.error(f"No access token found for Telegram trigger in flow {flow_id}")
            return {"ok": False, "error": "No access token configured"}
        
        # Process the webhook message and notify SSE connections
        from ...services.nodes.triggers.telegram_input import process_webhook_message
        result = await process_webhook_message(webhook_data, access_token, flow_id)
        
        if result.status == "success":
            message_data = result.outputs.get("message_data", {})
            input_text = message_data.get('input_text') or message_data.get('chat_input', 'N/A')
            chat_id = message_data.get('chat_id', 'N/A')
            
            # Update the Telegram trigger node with actual message data
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
                
                logger.info(f"Stored message data and notified SSE connections: chat_id={chat_id}, text='{input_text}'")
                
            except Exception as e:
                logger.error(f"Failed to store message data in node: {str(e)}")
            
            # Execute the flow with the processed message data
            try:
                flow_executor = create_flow_executor(db)
                
                execution_context = {
                    "webhook_data": webhook_data,
                    "trigger_data": message_data
                }
                
                execution_result = await flow_executor.execute_flow(
                    flow_id=flow_id,
                    trigger_inputs=execution_context,
                    user_id=flow.user_id
                )
                
                logger.info(f"Flow {flow_id} executed successfully via Telegram webhook")
                return {
                    "ok": True, 
                    "message": f"Message processed and SSE notified: '{input_text}' from chat {chat_id}",
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
async def setup_telegram_webhook_endpoint(
    flow_id: int,
    db: Session = Depends(get_db)
):
    """Set up Telegram webhook for a specific flow"""
    try:
        flow = db.query(Flow).filter(Flow.id == flow_id).first()
        if not flow:
            raise HTTPException(status_code=404, detail="Flow not found")
        
        telegram_trigger = db.query(NodeInstance).filter(
            NodeInstance.flow_id == flow_id,
            NodeInstance.type_id == "telegram_input"
        ).first()
        
        if not telegram_trigger:
            raise HTTPException(
                status_code=400, 
                detail="No Telegram trigger node found in this flow"
            )
        
        settings = telegram_trigger.data.get("settings", {})
        access_token = settings.get("access_token")
        
        if not access_token:
            raise HTTPException(
                status_code=400,
                detail="Bot access token not configured in Telegram trigger node"
            )
        
        from ...services.nodes.triggers.telegram_input import setup_telegram_webhook
        
        webhook_url = f"https://asangram.tech/api/v1/telegram/webhook/{flow_id}"
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

# NEW: SSE endpoint for real-time Telegram message updates
@router.get("/listen/{flow_id}")
async def listen_for_telegram_messages(
    flow_id: int,
    db: Session = Depends(get_db)
):
    """
    Server-Sent Events endpoint for listening to Telegram messages in real-time
    This replaces the synchronous waiting approach
    """
    try:
        # Validate flow exists
        flow = db.query(Flow).filter(Flow.id == flow_id).first()
        if not flow:
            raise HTTPException(status_code=404, detail="Flow not found")
        
        # Find Telegram trigger node
        telegram_trigger = db.query(NodeInstance).filter(
            NodeInstance.flow_id == flow_id,
            NodeInstance.type_id == "telegram_input"
        ).first()
        
        if not telegram_trigger:
            raise HTTPException(
                status_code=400,
                detail="No Telegram trigger node found in this flow"
            )
        
        # Get access token
        settings = telegram_trigger.data.get("settings", {})
        access_token = settings.get("access_token")
        
        if not access_token:
            raise HTTPException(
                status_code=400,
                detail="Bot access token not configured"
            )
        
        # Create context and call the SSE function
        context = {
            "settings": settings,
            "access_token": access_token,
            "flow_id": flow_id,
            "node_id": telegram_trigger.id
        }
        
        from ...services.nodes.triggers.telegram_input import create_telegram_sse_stream
        return await create_telegram_sse_stream(context)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"SSE endpoint error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to start SSE stream: {str(e)}")