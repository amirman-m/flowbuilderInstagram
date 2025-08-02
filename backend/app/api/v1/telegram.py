from fastapi import APIRouter, Request, HTTPException, Depends
from sqlalchemy.orm import Session
from ...core.database import get_db
from ...models.flow import Flow
from ...models.nodes import NodeInstance
from ...services.flow_execution import create_flow_executor
from typing import Dict, Any
from datetime import datetime, timezone
import logging
import json

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/webhook/{flow_id}")
async def telegram_webhook(
    flow_id: int,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Telegram webhook endpoint that receives updates and triggers flow execution
    """
    try:
        # Get the webhook payload
        webhook_data = await request.json()
        logger.info(f"Received Telegram webhook for flow {flow_id}: {json.dumps(webhook_data, indent=2)}")
        
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
