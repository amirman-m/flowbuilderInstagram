from sqlalchemy.orm import Session
import logging
from ..schemas.flow_save import FlowSaveRequest
from ..models.flow import Flow
from ..models.nodes import NodeInstance, NodeConnection


from ..schemas.flow import FlowUpdate


def save_flow_graph(db: Session, flow: Flow, payload: FlowSaveRequest):
    """
    Saves the complete flow graph (nodes and edges) to the database.
    This includes deleting the existing graph and bulk inserting the new one.
    """
    # Optional name update
    if payload.flow_name:
        flow.name = payload.flow_name

    # Determine new version
    current_version = (flow.flow_data or {}).get("version", 0)
    new_version = current_version + 1

    try:
        # Start transaction
        # Delete existing graph
        db.query(NodeConnection).filter(NodeConnection.flow_id == flow.id).delete()
        db.query(NodeInstance).filter(NodeInstance.flow_id == flow.id).delete()
        db.flush()

        # Bulk insert nodes
        node_objs = []
        for n in payload.nodes:
            node_objs.append(NodeInstance(
                id=n.id,
                flow_id=flow.id,
                type_id=n.type_id,
                label=n.label,
                position=n.position,
                settings=n.settings,
                data=n.data or {},
                disabled=n.disabled or False,
            ))
        db.bulk_save_objects(node_objs)

        # Bulk insert connections
        edge_objs = []
        for e in payload.edges:
            edge_objs.append(NodeConnection(
                id=e.id,
                flow_id=flow.id,
                source_node_id=e.source_node_id,
                target_node_id=e.target_node_id,
                source_port_id=e.source_port_id,
                target_port_id=e.target_port_id,
            ))
        db.bulk_save_objects(edge_objs)

        # Update flow_data with version
        flow.flow_data = {**(flow.flow_data or {}), "version": new_version}
        db.commit()
    except Exception as exc:
        logging.exception("Failed to save flow")
        db.rollback()
        raise exc

    return new_version


def update_flow(db: Session, flow: Flow, flow_update: FlowUpdate):
    """
    Updates a flow with the given data.
    """
    update_data = flow_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(flow, key, value)

    db.commit()
    db.refresh(flow)
    return flow