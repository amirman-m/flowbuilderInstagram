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
    execution_id: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Telegram webhook endpoint that receives updates and triggers flow execution
    """
    try:
        # Handle GET requests (Telegram validation)
        if request.method == "GET":
            return {"ok": True, "message": "Webhook endpoint is ready"}
        
        # Get the webhook payload for POST requests
        webhook_data = await request.json()
        logger.info(f"Received Telegram webhook for flow {flow_id} (execution_id: {execution_id}): {json.dumps(webhook_data, indent=2)}")
        
        # If execution_id is provided, this is for synchronous execution
        if execution_id:
            # Import here to avoid circular imports
            from ...services.nodes.triggers.telegram_input import _message_queues, process_webhook_message
            
            # Check if there's a queue waiting for this execution
            logger.info(f"Webhook checking for execution_id {execution_id}. Available queues: {list(_message_queues.keys())}")
            if execution_id in _message_queues:
                try:
                    # Process the webhook data first to extract message information
                    # We need to get the access token from the flow's Telegram node
                    flow = db.query(Flow).filter(Flow.id == flow_id).first()
                    if not flow:
                        logger.error(f"Flow {flow_id} not found for execution {execution_id}")
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
                    
                    # Process the webhook message to extract data
                    result = await process_webhook_message(webhook_data, access_token)
                    
                    if result.status == "success":
                        # Put the processed message data into the queue
                        message_data = result.outputs.get("message_data", {})
                        _message_queues[execution_id].put(message_data, timeout=1)
                        logger.info(f"Processed message data queued for synchronous execution {execution_id}: {message_data}")
                        return {"ok": True, "message": "Message processed and queued"}
                    else:
                        logger.error(f"Failed to process webhook message for execution {execution_id}: {result.error}")
                        return {"ok": False, "error": f"Message processing failed: {result.error}"}
                        
                except Exception as e:
                    logger.error(f"Failed to process and queue webhook data for execution {execution_id}: {str(e)}")
                    return {"ok": False, "error": "Failed to process message"}
            else:
                logger.warning(f"No queue found for execution_id {execution_id}")
                return {"ok": False, "error": "No waiting execution found"}
        
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
        
        # Prepare execution context with webhook data
        execution_context = {
            "webhook_data": webhook_data,
            "settings": telegram_trigger.data.get("settings", {}),
            "trigger_node_id": telegram_trigger.id
        }
        
        # Execute the flow with the Telegram trigger
        flow_executor = create_flow_executor(db)
        
        try:
            execution_result = await flow_executor.execute_flow(
                flow_id=flow_id,
                user_id=flow.user_id,  # Use flow owner's user_id
                trigger_inputs=execution_context
            )
            
            logger.info(f"Flow {flow_id} executed successfully via Telegram webhook")
            
            # Store execution results in the Telegram trigger node for frontend polling
            if execution_result and "execution_results" in execution_result:
                execution_results = execution_result["execution_results"]
                trigger_result = execution_results.get(telegram_trigger.id)
                
                if trigger_result:
                    # Update the node instance with execution results
                    current_data = telegram_trigger.data or {}
                    
                    # Extract data from NodeExecutionResult object
                    if hasattr(trigger_result, 'outputs'):
                        outputs = trigger_result.outputs
                        status = trigger_result.status if hasattr(trigger_result, 'status') else "success"
                        started_at = trigger_result.started_at if hasattr(trigger_result, 'started_at') else None
                        completed_at = trigger_result.completed_at if hasattr(trigger_result, 'completed_at') else None
                    else:
                        # Fallback for dict-like structure
                        outputs = trigger_result.get("outputs", {})
                        status = trigger_result.get("status", "success")
                        started_at = trigger_result.get("started_at")
                        completed_at = trigger_result.get("completed_at")
                    
                    current_data["lastExecution"] = {
                        "timestamp": completed_at or started_at or datetime.now(timezone.utc).isoformat(),
                        "status": status,
                        "outputs": outputs,
                        "executionTime": 0  # Calculate if needed
                    }
                    
                    telegram_trigger.data = current_data
                    db.commit()
                    
                    logger.info(f"Stored execution results for Telegram node {telegram_trigger.id}: {outputs}")
                else:
                    logger.warning(f"No execution result found for Telegram trigger node {telegram_trigger.id}")
            else:
                logger.warning(f"No execution_results found in webhook execution result: {execution_result}")
            
            # Return success response to Telegram
            return {
                "ok": True,
                "message": "Webhook processed successfully",
                "execution_id": execution_result.get("execution_id")
            }
            
        except Exception as e:
            logger.error(f"Flow execution failed for Telegram webhook: {str(e)}")
            # Still return 200 to Telegram to avoid retries
            return {
                "ok": False,
                "error": f"Flow execution failed: {str(e)}"
            }
            
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

@router.post("/setup-webhook-for-execution/{flow_id}")
async def setup_webhook_for_execution(
    flow_id: int,
    request_data: dict,
    db: Session = Depends(get_db)
):
    """
    Step 1: Set up Telegram webhook for execution with unique execution_id
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
        
        # Get the access token from request or node settings
        access_token = request_data.get("access_token")
        if not access_token:
            settings = telegram_trigger.data.get("settings", {})
            access_token = settings.get("access_token")
        
        if not access_token:
            raise HTTPException(
                status_code=400,
                detail="Bot access token not provided"
            )
        
        # Import here to avoid circular imports
        from ...services.nodes.triggers.telegram_input import setup_telegram_webhook_for_execution
        
        # Set up webhook and get execution_id
        result = await setup_telegram_webhook_for_execution(access_token, flow_id)
        
        if result["success"]:
            return {
                "ok": True,
                "execution_id": result["execution_id"],
                "webhook_url": result["webhook_url"],
                "message": "Webhook set up successfully. You can now send a Telegram message."
            }
        else:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to set up webhook: {result.get('error', 'Unknown error')}"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Webhook setup error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Webhook setup failed: {str(e)}")

@router.get("/wait-for-message/{execution_id}")
async def wait_for_message(
    execution_id: str,
    timeout: int = 30,
    db: Session = Depends(get_db)
):
    """
    Step 2: Wait for Telegram message and return extracted data
    """
    try:
        # Import here to avoid circular imports
        from ...services.nodes.triggers.telegram_input import wait_for_telegram_message
        
        # Wait for message with specified timeout
        result = await wait_for_telegram_message(execution_id, timeout)
        
        if result["success"]:
            return {
                "ok": True,
                "message_data": result["message_data"],
                "logs": result.get("logs", []),
                "execution_time": result.get("execution_time", 0)
            }
        else:
            if result.get("timeout"):
                raise HTTPException(
                    status_code=408,
                    detail=f"Timeout waiting for message ({timeout}s). You can retry or send another message."
                )
            else:
                raise HTTPException(
                    status_code=500,
                    detail=f"Error waiting for message: {result.get('error', 'Unknown error')}"
                )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Wait for message error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to wait for message: {str(e)}")
