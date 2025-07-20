import pytest
from app.services.utils.input_type import determine_input_type
from app.models.nodes import NodeDataType

class TestInputType:
    """Test suite for input_type.py utility functions"""
    
    def test_determine_input_type_string(self):
        """Test that string inputs are correctly identified"""
        assert determine_input_type("hello") == NodeDataType.STRING
        assert determine_input_type("") == NodeDataType.STRING
        assert determine_input_type("123") == NodeDataType.STRING  # String representation of a number
    
    def test_determine_input_type_number(self):
        """Test that numeric inputs are correctly identified"""
        assert determine_input_type(123) == NodeDataType.NUMBER
        assert determine_input_type(0) == NodeDataType.NUMBER
        assert determine_input_type(-42) == NodeDataType.NUMBER
        assert determine_input_type(3.14) == NodeDataType.NUMBER
        assert determine_input_type(0.0) == NodeDataType.NUMBER
    
    def test_determine_input_type_boolean(self):
        """Test that boolean inputs are correctly identified"""
        assert determine_input_type(True) == NodeDataType.BOOLEAN
        assert determine_input_type(False) == NodeDataType.BOOLEAN
    
    def test_determine_input_type_object(self):
        """Test that dictionary/object inputs are correctly identified"""
        assert determine_input_type({}) == NodeDataType.OBJECT
        assert determine_input_type({"key": "value"}) == NodeDataType.OBJECT
        assert determine_input_type(dict(name="test")) == NodeDataType.OBJECT
    
    def test_determine_input_type_array(self):
        """Test that array-like inputs are correctly identified"""
        assert determine_input_type([]) == NodeDataType.ARRAY
        assert determine_input_type([1, 2, 3]) == NodeDataType.ARRAY
        assert determine_input_type(()) == NodeDataType.ARRAY  # Empty tuple
        assert determine_input_type((1, 2)) == NodeDataType.ARRAY  # Tuple
        assert determine_input_type(set()) == NodeDataType.ARRAY  # Empty set
        assert determine_input_type({1, 2, 3}) == NodeDataType.ARRAY  # Set
    
    def test_determine_input_type_any(self):
        """Test that other types are identified as ANY"""
        assert determine_input_type(None) == NodeDataType.ANY
        
        # Custom class
        class CustomClass:
            pass
        
        custom_obj = CustomClass()
        assert determine_input_type(custom_obj) == NodeDataType.ANY
