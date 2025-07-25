import React from 'react';
import { Box, Typography, Paper, Chip, Alert } from '@mui/material';
import { ConnectionValidator, ConnectionAttempt } from '../../services/connectionValidator';
import { NodeType, NodeCategory, NodeDataType, NodePort, NodePortsSchema } from '../../types/nodes';

// Mock node types for testing
const mockNodeTypes: NodeType[] = [
  {
    id: 'voice_input',
    name: 'Voice Input',
    description: 'Voice input trigger',
    category: NodeCategory.TRIGGER,
    version: '1.0.0',
    ports: {
      inputs: [],
      outputs: [
        {
          id: 'message_data',
          name: 'message_data',
          label: 'Message Data',
          description: 'Voice input data',
          dataType: NodeDataType.OBJECT,
          required: true
        }
      ]
    } as NodePortsSchema,
    settingsSchema: { type: 'object', properties: {}, required: [] }
  },
  {
    id: 'transcription',
    name: 'Audio Transcription',
    description: 'Transcribes audio to text',
    category: NodeCategory.PROCESSOR,
    version: '1.0.0',
    ports: {
      inputs: [
        {
          id: 'message_data',
          name: 'message_data',
          label: 'Message Data',
          description: 'Voice input data',
          dataType: NodeDataType.OBJECT,
          required: true
        }
      ],
      outputs: [
        {
          id: 'ai_response',
          name: 'ai_response',
          label: 'Transcription',
          description: 'Transcribed text',
          dataType: NodeDataType.STRING,
          required: true
        }
      ]
    } as NodePortsSchema,
    settingsSchema: { type: 'object', properties: {}, required: [] }
  },
  {
    id: 'simple-openai-chat',
    name: 'OpenAI Chat',
    description: 'OpenAI chat model',
    category: NodeCategory.PROCESSOR,
    version: '1.0.0',
    ports: {
      inputs: [
        {
          id: 'message_data',
          name: 'message_data',
          label: 'Message Data',
          description: 'Text input',
          dataType: NodeDataType.STRING,
          required: true
        }
      ],
      outputs: [
        {
          id: 'ai_response',
          name: 'ai_response',
          label: 'AI Response',
          description: 'AI response',
          dataType: NodeDataType.STRING,
          required: true
        }
      ]
    } as NodePortsSchema,
    settingsSchema: { type: 'object', properties: {}, required: [] }
  }
];

// Test cases for connection validation
const testCases: Array<{
  name: string;
  sourceNodeId: string;
  sourcePortId: string;
  targetNodeId: string;
  targetPortId: string;
  expectedValid: boolean;
  expectedMessage?: string;
}> = [
  {
    name: 'Voice Input → Transcription (Valid)',
    sourceNodeId: 'voice_input',
    sourcePortId: 'message_data',
    targetNodeId: 'transcription',
    targetPortId: 'message_data',
    expectedValid: true
  },
  {
    name: 'Voice Input → OpenAI Chat (Invalid)',
    sourceNodeId: 'voice_input',
    sourcePortId: 'message_data',
    targetNodeId: 'simple-openai-chat',
    targetPortId: 'message_data',
    expectedValid: false,
    expectedMessage: 'Voice input cannot be directly connected to text chat models'
  },
  {
    name: 'Transcription → OpenAI Chat (Valid)',
    sourceNodeId: 'transcription',
    sourcePortId: 'ai_response',
    targetNodeId: 'simple-openai-chat',
    targetPortId: 'message_data',
    expectedValid: true
  }
];

const ConnectionValidationTest: React.FC = () => {
  const runTests = () => {
    return testCases.map(testCase => {
      const sourceNode = mockNodeTypes.find(n => n.id === testCase.sourceNodeId);
      const targetNode = mockNodeTypes.find(n => n.id === testCase.targetNodeId);
      
      if (!sourceNode || !targetNode) {
        return {
          ...testCase,
          result: 'ERROR: Node not found',
          passed: false,
          actualValid: false
        };
      }
      
      const attempt: ConnectionAttempt = {
        sourceNodeType: sourceNode,
        sourcePortId: testCase.sourcePortId,
        targetNodeType: targetNode,
        targetPortId: testCase.targetPortId
      };
      
      const validationResult = ConnectionValidator.validateConnectionWithFeedback(attempt);
      const passed = validationResult.validation.isValid === testCase.expectedValid;
      
      return {
        ...testCase,
        result: validationResult.validation.errorMessage || 'Valid connection',
        passed,
        actualValid: validationResult.validation.isValid
      };
    });
  };
  
  const testResults = runTests();
  const allPassed = testResults.every(result => result.passed);
  
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Connection Validation Test Results
      </Typography>
      
      <Alert severity={allPassed ? 'success' : 'error'} sx={{ mb: 3 }}>
        {allPassed ? 'All tests passed! 🎉' : 'Some tests failed ❌'}
      </Alert>
      
      {testResults.map((result, index) => (
        <Paper key={index} sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              {result.name}
            </Typography>
            <Chip 
              label={result.passed ? 'PASS' : 'FAIL'} 
              color={result.passed ? 'success' : 'error'}
              size="small"
            />
          </Box>
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Expected: {result.expectedValid ? 'Valid' : 'Invalid'}
            {result.expectedMessage && ` - "${result.expectedMessage}"`}
          </Typography>
          
          <Typography variant="body2">
            <strong>Actual:</strong> {result.actualValid ? 'Valid' : 'Invalid'}
          </Typography>
          
          {result.result && (
            <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
              <strong>Message:</strong> {result.result}
            </Typography>
          )}
        </Paper>
      ))}
      
      <Box sx={{ mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          Test Summary
        </Typography>
        <Typography variant="body1">
          Passed: {testResults.filter(r => r.passed).length} / {testResults.length}
        </Typography>
      </Box>
    </Box>
  );
};

export default ConnectionValidationTest;
