from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from ...core.database import get_db
from ...models.flow import Flow
from ...models.user import User
from ...schemas.flow import FlowCreate, FlowUpdate, Flow as FlowSchema
from ..deps import get_current_active_user
from ...core.node_registry import node_registry
from pydantic import BaseModel
import logging
from ...schemas.flow_save import FlowSaveRequest, NodeSchema, EdgeSchema
from ...models.nodes import NodeInstance, NodeConnection , NodeCategory
from ...services.flow_execution import create_flow_executor, FlowExecutionError
from ...services import flow_service
from ...services.telegram_bot_service import TelegramBotService, TelegramWebhookManager
from ...services.scheduler_service import schedule_flow, unschedule_flow
from ...core.database import SessionLocal

logger = logging.getLogger(__name__)

router = APIRouter()


# Request/Response models for node execution
class NodeExecutionRequest(BaseModel):
    inputs: Dict[str, Any] = {}
    settings: Dict[str, Any] = {}


class NodeExecutionResponse(BaseModel):
    status: str
    outputs: Dict[str, Any]
    error: str | None = None
    startedAt: str | None = None
    completedAt: str | None = None


class FlowExecutionRequest(BaseModel):
    trigger_inputs: Dict[str, Any] = {}


class FlowExecutionResponse(BaseModel):
    flow_id: int
    flow_name: str
    trigger_node_id: str
    execution_results: Dict[str, Any]
    executed_at: str
    total_nodes_executed: int


@router.get("/", response_model=List[FlowSchema])
def get_flows(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all flows for the current user."""
    flows = db.query(Flow).filter(Flow.user_id == current_user.id).all()
    return flows


@router.post("/", response_model=FlowSchema)
def create_flow(
    flow: FlowCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new flow."""
    db_flow = Flow(
        user_id=current_user.id,
        name=flow.name,
        description=flow.description,
        flow_data=flow.flow_data or {}
    )
    db.add(db_flow)
    db.commit()
    db.refresh(db_flow)
    return db_flow


@router.get("/{flow_id}", response_model=FlowSchema)
def get_flow(
    flow_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get a specific flow."""
    flow = db.query(Flow).filter(
        Flow.id == flow_id,
        Flow.user_id == current_user.id
    ).first()
    
    if not flow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flow not found"
        )
    
    return flow


@router.put("/{flow_id}", response_model=FlowSchema)
def update_flow(
    flow_id: int,
    flow_update: FlowUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update a flow."""
    flow = db.query(Flow).filter(
        Flow.id == flow_id,
        Flow.user_id == current_user.id
    ).first()
    
    if not flow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flow not found"
        )
    
    return flow_service.update_flow(db, flow, flow_update)


@router.delete("/{flow_id}")
def delete_flow(
    flow_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a flow."""
    flow = db.query(Flow).filter(
        Flow.id == flow_id,
        Flow.user_id == current_user.id
    ).first()
    
    if not flow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flow not found"
        )
    
    db.delete(flow)
    db.commit()
    return {"message": "Flow deleted successfully"}


@router.post("/{flow_id}/save", status_code=status.HTTP_201_CREATED)
def save_flow(
    flow_id: int,
    payload: FlowSaveRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Persist complete flow graph (nodes + edges) for the given user."""
    flow = db.query(Flow).filter(Flow.id == flow_id, Flow.user_id == current_user.id).first()
    if not flow:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flow not found")

    
    try:
        new_version = flow_service.save_flow_graph(db, flow, payload)
        return {"version": new_version, "saved_at": flow.updated_at.isoformat() if flow.updated_at else None}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to save flow: {exc}")
@router.get("/{flow_id}/nodes", response_model=List[NodeSchema])
def get_flow_nodes(
    flow_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Return all node instances for the specified flow."""
    flow = db.query(Flow).filter(Flow.id == flow_id, Flow.user_id == current_user.id).first()
    if not flow:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flow not found")

    nodes = db.query(NodeInstance).filter(NodeInstance.flow_id == flow_id).all()
    return [NodeSchema.model_validate(n, from_attributes=True) for n in nodes]


@router.get("/{flow_id}/connections", response_model=List[EdgeSchema])
def get_flow_connections(
    flow_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Return all node connections (edges) for the specified flow."""
    flow = db.query(Flow).filter(Flow.id == flow_id, Flow.user_id == current_user.id).first()
    if not flow:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flow not found")

    edges = db.query(NodeConnection).filter(NodeConnection.flow_id == flow_id).all()
    return [EdgeSchema.model_validate(e, from_attributes=True) for e in edges]



@router.post("/{flow_id}/nodes/{node_id}/execute", response_model=NodeExecutionResponse)
async def execute_node(
    flow_id: int,
    node_id: str,
    request: NodeExecutionRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Execute a specific node within a flow."""
    # Verify the flow exists and belongs to the user
    flow = db.query(Flow).filter(
        Flow.id == flow_id,
        Flow.user_id == current_user.id
    ).first()
    
    if not flow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flow not found"
        )
    
    node_instance = db.query(NodeInstance).filter(
        NodeInstance.flow_id == flow_id,
        NodeInstance.id == node_id
    ).first()

    if not node_instance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Node not found in this flow"
        )

    try:
        node_type_id = node_instance.type_id
        
        # Build execution context with node settings and request inputs
        context = {
            "node_id": node_id,
            "flow_id": flow_id,
            "settings": node_instance.settings or {},
        }
        
        # Use settings from request if provided, otherwise use settings from database
        if hasattr(request, 'settings') and request.settings:
            context["settings"] = request.settings
        
        # Add request inputs correctly under 'inputs' key (primary),
        # and also expose them at top-level for backward compatibility.
        if hasattr(request, 'inputs') and request.inputs:
            context["inputs"] = request.inputs  # primary expected by processors
            try:
                # backward compatibility: some legacy processors may read from top-level
                context.update(request.inputs)
            except Exception:
                pass
            
        # Debug: Log what we're sending to the node
        logger.info(f"🔍 DEBUG: Request inputs: {getattr(request, 'inputs', 'No inputs attr')}")
        logger.info(f"🔍 DEBUG: Request settings: {getattr(request, 'settings', 'No settings attr')}")
        logger.info(f"🔍 DEBUG: Request dict: {request.dict()}")
        logger.info(f"🔍 DEBUG: Final context: {context}")
        
        # Execute the node using the node registry with full context
        result = await node_registry.execute_node(node_type_id, context)
        
        return NodeExecutionResponse(
            status=result.status,
            outputs=result.outputs,
            error=result.error,
            startedAt=result.started_at.isoformat() if result.started_at else None,
            completedAt=result.completed_at.isoformat() if result.completed_at else None
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to execute node: {str(e)}"
        )


@router.post("/{flow_id}/activate")
async def activate_flow(
    flow_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Activate a flow: validate single Telegram trigger, ensure webhook, persist status."""
    # Step 0: Validate flow ownership
    flow = db.query(Flow).filter(Flow.id == flow_id, Flow.user_id == current_user.id).first()
    if not flow:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flow not found")

    # Step 1-2: Fetch nodes and identify trigger nodes
    nodes = db.query(NodeInstance).filter(NodeInstance.flow_id == flow_id).all()
    trigger_nodes: list[NodeInstance] = []
    for n in nodes:
        try:
            node_type = node_registry.get_node_type(n.type_id)
            if node_type and hasattr(node_type, 'category') and node_type.category.value == 'trigger':
                trigger_nodes.append(n)
        except Exception:
            # Ignore unknown node types when checking triggers
            continue

    # Step 3: Validate exactly one trigger node
    if len(trigger_nodes) == 0:
        raise HTTPException(status_code=400, detail="No trigger node found. Exactly one trigger is required to activate a flow.")
    if len(trigger_nodes) > 1:
        ids = [t.id for t in trigger_nodes]
        raise HTTPException(status_code=400, detail=f"Multiple trigger nodes found: {ids}. Only one trigger is allowed for activation.")

    trigger = trigger_nodes[0]

    # Step 4: Validate trigger type (support telegram_input or scheduled_message)
    if trigger.type_id not in ("telegram_input", "scheduled_message"):
        raise HTTPException(
            status_code=400,
            detail=(
                "Only telegram_input and scheduled_message triggers are supported for activation. "
                f"Found '{trigger.type_id}'. Nodes like chat_input and voice_input are interactive and cannot be background-activated."
            ),
        )

    cfg = None
    # Step 5: Branch by trigger type
    if trigger.type_id == "telegram_input":
        # Check for flow-level telegram config first, then node-level
        from ...models.telegram_bot import TelegramBotConfig
        flow_bot_config = db.query(TelegramBotConfig).filter(
            TelegramBotConfig.user_id == current_user.id,
            TelegramBotConfig.default_flow_id == flow_id,
            TelegramBotConfig.is_active == True
        ).first()

        if flow_bot_config:
            # Use flow-level config
            access_token = flow_bot_config.access_token
            config_name = flow_bot_config.config_name
            logger.info(f"Using flow-level telegram config for activation: {config_name}")
        else:
            # Fallback to node-level config
            trigger_data = trigger.data or {}
            settings_data = trigger_data.get("settings", {})
            access_token = settings_data.get("access_token")
            config_name = settings_data.get("config_name")

        if not access_token and not config_name:
            raise HTTPException(status_code=400, detail="Bot access token not configured on Telegram trigger node.")

        # Use TelegramBotService to validate token, persist config, and ensure webhook
        svc = TelegramBotService()
        try:
            ok, msg, cfg = await svc.validate_and_setup_bot(
                db=db,
                user_id=current_user.id,
                access_token=access_token,
                flow_id=flow_id,
                node_id=trigger.id,
                config_name=config_name,
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Telegram setup failed: {str(e)}")

        if not ok:
            raise HTTPException(status_code=400, detail=msg)
    else:
        # scheduled_message: register periodic execution job
        trigger_settings = (trigger.data or {}).get("settings", {})
        time_unit = trigger_settings.get("time_unit", "minutes")
        time_value = int(trigger_settings.get("time_value", 10))

        # Create job that executes the flow end-to-end with scheduled flag
        def run_coro_factory(flow_id_param: int, user_id_param: int):
            async def _runner():
                db_local = SessionLocal()
                try:
                    executor = create_flow_executor(db_local)
                    await executor.execute_flow(
                        flow_id=flow_id_param,
                        user_id=user_id_param,
                        trigger_inputs={
                            "is_scheduled_execution": True
                        }
                    )
                except Exception:
                    logger.exception(f"Scheduled execution failed for flow {flow_id_param}")
                finally:
                    db_local.close()
            return _runner

        schedule_flow(
            flow_id=flow_id,
            user_id=current_user.id,
            time_unit=time_unit,
            time_value=time_value,
            run_coro_factory=run_coro_factory,
        )

    # Step 7: Confirm activation (continuous 24/7 mode)
    flow.status = "active"
    db.commit()
    db.refresh(flow)

    return {
        "ok": True,
        "message": (
            "Flow activated. Telegram webhook configured for 24/7 processing."
            if trigger.type_id == "telegram_input" else
            "Flow activated. Scheduled execution enabled."
        ),
        "flow_id": flow.id,
        "status": flow.status,
        "webhook_url": (cfg or {}).get("webhook_url") if isinstance(cfg, dict) else None,
    }


@router.post("/{flow_id}/deactivate")
async def deactivate_flow(
    flow_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Deactivate a flow: disable webhook processing but keep webhook configured."""
    # Validate ownership
    flow = db.query(Flow).filter(Flow.id == flow_id, Flow.user_id == current_user.id).first()
    if not flow:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flow not found")

    # Find telegram trigger (if any) and disable bot config
    telegram_trigger = db.query(NodeInstance).filter(
        NodeInstance.flow_id == flow_id,
        NodeInstance.type_id == "telegram_input"
    ).first()

    # Disable bot config instead of deleting webhook
    if telegram_trigger:
        settings_data = (telegram_trigger.data or {}).get("settings", {})
        access_token = settings_data.get("access_token")
        config_name = settings_data.get("config_name")
        
        # Find and disable the bot config to stop processing
        if access_token or config_name:
            from ...models.telegram_bot import TelegramBotConfig
            
            query = db.query(TelegramBotConfig).filter(
                TelegramBotConfig.user_id == current_user.id,
                TelegramBotConfig.is_active == True
            )
            
            if access_token:
                query = query.filter(TelegramBotConfig.access_token == access_token)
            elif config_name:
                query = query.filter(TelegramBotConfig.config_name == config_name)
            
            bot_config = query.first()
            if bot_config:
                # Don't delete webhook, just mark as inactive for processing
                # Webhook stays configured but won't process messages
                logger.info(f"Disabling bot config for flow {flow_id} deactivation (keeping webhook)")
            else:
                logger.warning(f"No bot config found for flow {flow_id} during deactivation")

    # Persist status - this is the main control for webhook processing
    flow.status = "draft"
    db.commit()
    db.refresh(flow)

    # Unschedule any scheduled job for this flow
    try:
        unschedule_flow(flow_id)
    except Exception:
        logger.warning(f"Unschedule failed (flow {flow_id})")

    return {
        "ok": True,
        "message": "Flow deactivated. Webhook processing disabled but webhook remains configured.",
        "flow_id": flow.id,
        "status": flow.status,
    }

@router.post("/{flow_id}/execute", response_model=FlowExecutionResponse)
async def execute_flow(
    flow_id: int,
    request: FlowExecutionRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Execute a complete flow starting from the trigger node."""
    try:
        # Create flow executor instance
        executor = create_flow_executor(db)
        
        # Execute the flow
        result = await executor.execute_flow(
            flow_id=flow_id,
            user_id=current_user.id,
            trigger_inputs=request.trigger_inputs
        )
        
        return FlowExecutionResponse(**result)
        
    except FlowExecutionError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logging.exception(f"Failed to execute flow {flow_id}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to execute flow: {str(e)}"
        )
