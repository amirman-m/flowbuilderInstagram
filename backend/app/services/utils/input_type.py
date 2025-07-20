from app.models.nodes import NodeDataType
def determine_input_type(input_data) -> NodeDataType:
    """
    Determine the type of input based on content analysis
    """
    
    if isinstance(input_data, str):
        return NodeDataType.STRING
    elif isinstance(input_data, bool):
        return NodeDataType.BOOLEAN
    elif isinstance(input_data, (int, float)):
        return NodeDataType.NUMBER
    elif isinstance(input_data, dict):
        return NodeDataType.OBJECT
    elif isinstance(input_data, (list, tuple, set)):
        return NodeDataType.ARRAY
    else:
        return NodeDataType.ANY  # Fallback for other types (None, custom objects, etc.)