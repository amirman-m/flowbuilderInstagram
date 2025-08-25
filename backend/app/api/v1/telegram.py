from fastapi import APIRouter, Request, HTTPException, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from ...core.database import get_db
from ...models.flow import Flow
from ...models.nodes import NodeInstance
from ...models.telegram_bot import TelegramBotConfig
from ...services.flow_execution import create_flow_executor
from ...services.telegram_bot_service import TelegramBotService
from ...services.nodes.triggers.telegram_input import process_webhook_message, setup_telegram_webhook, create_telegram_sse_stream
from typing import Dict, Any, Optional
from datetime import datetime, timezone
import logging
import json

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/webhook/{user_id}/{flow_id}/{node_id}")
@router.get("/webhook/{user_id}/{flow_id}/{node_id}")
async def telegram_webhook_dynamic(
    user_id: int,
    flow_id: int,
    node_id: str,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    New dynamic webhook endpoint that supports user_id/flow_id/node_id structure
    """
    try:
        if request.method == "GET":
            return {"ok": True, "message": "Dynamic webhook endpoint is ready"}
        
        webhook_data = await request.json()
        logger.info(f"Received Telegram webhook for user {user_id}, flow {flow_id}, node {node_id}")
        
        # Use new TelegramBotService for processing
        from ...services.telegram_bot_service import TelegramBotService
        
        # Find the specific node instance
        telegram_trigger = db.query(NodeInstance).filter(
            NodeInstance.flow_id == flow_id,
            NodeInstance.id == node_id,
            NodeInstance.type_id == "telegram_input"
        ).first()
        
        if not telegram_trigger:
            logger.error(f"Telegram trigger node {node_id} not found in flow {flow_id}")
            return {"ok": False, "error": "Telegram trigger node not found"}
        
        access_token = telegram_trigger.data.get("settings", {}).get("access_token")
        if not access_token:
            logger.error(f"No access token found for node {node_id}")
            return {"ok": False, "error": "No access token configured"}
        
        # Process webhook message
        result = await process_webhook_message(webhook_data, access_token, flow_id)
        
        if result.status == "success":
            message_data = result.outputs.get("message_data", {})
            
            # Update node with execution data
            current_data = telegram_trigger.data or {}
            current_data["lastExecution"] = {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "status": "success",
                "outputs": {"message_data": message_data},
                "logs": result.logs or []
            }
            telegram_trigger.data = current_data
            db.commit()
            
            # Execute flow
            try:
                flow_executor = create_flow_executor(db)
                execution_result = await flow_executor.execute_flow(
                    flow_id=flow_id,
                    trigger_inputs={"webhook_data": webhook_data, "trigger_data": message_data},
                    user_id=user_id
                )
                
                return {"ok": True, "message": "Message processed successfully"}
                
            except Exception as e:
                logger.error(f"Flow execution error: {e}")
                return {"ok": False, "error": f"Flow execution failed: {str(e)}"}
        else:
            return {"ok": False, "error": result.error}
            
    except Exception as e:
        logger.error(f"Webhook processing error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Legacy webhook endpoint for backward compatibility
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
        
        return await create_telegram_sse_stream(context)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"SSE endpoint error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to start SSE stream: {str(e)}")

@router.post("/webhook/u/{user_id}/b/{bot_id}/{secret}")
@router.get("/webhook/u/{user_id}/b/{bot_id}/{secret}")
async def telegram_webhook_stable(
    user_id: int,
    bot_id: str,
    secret: str,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Stable per-bot webhook endpoint secured by a secret. Independent of flow/node.
    Resolves default flow/node mapping from TelegramBotConfig.
    """
    try:
        logger.info(f"Webhook called: user_id={user_id}, bot_id={bot_id}, method={request.method}")
        
        if request.method == "GET":
            return {"ok": True, "message": "Stable webhook endpoint is ready"}

        # Find active bot config for user and bot_id and validate secret
        bot_config: TelegramBotConfig | None = db.query(TelegramBotConfig).filter(
            TelegramBotConfig.user_id == user_id,
            TelegramBotConfig.bot_id == str(bot_id),
            TelegramBotConfig.is_active == True
        ).first()

        if not bot_config:
            logger.error(f"No active bot config found for user {user_id} and bot_id {bot_id}")
            # Debug: List all bot configs for this user
            all_configs = db.query(TelegramBotConfig).filter(TelegramBotConfig.user_id == user_id).all()
            logger.error(f"Available bot configs for user {user_id}: {[(c.bot_id, c.is_active, c.config_name) for c in all_configs]}")
            return {"ok": False, "error": "Bot configuration not found"}

        if not bot_config.webhook_secret or bot_config.webhook_secret != secret:
            logger.warning(f"Webhook secret mismatch: expected={bot_config.webhook_secret}, got={secret}")
            raise HTTPException(status_code=403, detail="Invalid webhook secret")

        webhook_data = await request.json()
        logger.info(f"Webhook data received: {webhook_data}")

        # Resolve target flow/node
        target_flow_id = bot_config.default_flow_id
        target_node_id = bot_config.default_node_id
        logger.info(f"Bot config defaults: flow_id={target_flow_id}, node_id={target_node_id}")

        if not target_flow_id or not target_node_id:
            logger.warning("No default flow/node configured, searching for fallback")
            # Fallback: find first flow with a telegram_input node for this user
            flow = db.query(Flow).filter(Flow.user_id == user_id).first()
            if not flow:
                logger.error(f"No flow available for user {user_id}")
                raise HTTPException(status_code=400, detail="No flow available for user")

            telegram_trigger = db.query(NodeInstance).filter(
                NodeInstance.flow_id == flow.id,
                NodeInstance.type_id == "telegram_input"
            ).first()

            if not telegram_trigger:
                logger.error(f"No Telegram trigger node found in flow {flow.id} for user {user_id}")
                # Debug: List all nodes in the flow
                all_nodes = db.query(NodeInstance).filter(NodeInstance.flow_id == flow.id).all()
                logger.error(f"Available nodes in flow {flow.id}: {[(n.id, n.type_id) for n in all_nodes]}")
                raise HTTPException(status_code=400, detail="No Telegram trigger node found to handle webhook")

            target_flow_id = flow.id
            target_node_id = telegram_trigger.id
            logger.info(f"Using fallback: flow_id={target_flow_id}, node_id={target_node_id}")

        # Load node instance for access token
        telegram_trigger = db.query(NodeInstance).filter(
            NodeInstance.flow_id == target_flow_id,
            NodeInstance.id == target_node_id,
            NodeInstance.type_id == "telegram_input"
        ).first()

        if not telegram_trigger:
            logger.error(f"Target Telegram trigger node not found: flow_id={target_flow_id}, node_id={target_node_id}")
            raise HTTPException(status_code=400, detail="Target Telegram trigger node not found")

        access_token = (telegram_trigger.data or {}).get("settings", {}).get("access_token")
        if not access_token:
            logger.error(f"Bot access token not configured on target node {target_node_id}")
            raise HTTPException(status_code=400, detail="Bot access token not configured on target node")

        logger.info(f"Processing webhook message for flow {target_flow_id}")
        # Process webhook message
        result = await process_webhook_message(webhook_data, access_token, target_flow_id)

        if result.status != "success":
            logger.error(f"Failed to process webhook message: {result.error}")
            return {"ok": False, "error": result.error}

        message_data = result.outputs.get("message_data", {})
        logger.info(f"Webhook message processed successfully: {message_data.get('input_text', 'N/A')}")

        # Update node lastExecution for UI and commit
        try:
            current_data = telegram_trigger.data or {}
            current_data["lastExecution"] = {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "status": "success",
                "outputs": {"message_data": message_data},
                "logs": result.logs or []
            }
            telegram_trigger.data = current_data
            db.commit()
        except Exception as e:
            logger.error(f"Failed to persist node lastExecution: {e}")

        # Execute flow
        try:
            flow_executor = create_flow_executor(db)
            await flow_executor.execute_flow(
                flow_id=target_flow_id,
                trigger_inputs={"webhook_data": webhook_data, "trigger_data": message_data},
                user_id=user_id
            )
            logger.info(f"Flow {target_flow_id} executed successfully")
            return {"ok": True, "message": "Message processed successfully"}
        except Exception as e:
            logger.error(f"Flow execution error: {e}")
            return {"ok": False, "error": f"Flow execution failed: {str(e)}"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Stable webhook processing error: {e}")
        raise HTTPException(status_code=500, detail=str(e))