// TextFieldNodeExecutor - passes through input data and optionally adds text from settings

import { NodeExecutor, NodeExecutionContext, NodeExecutionResult } from '../core/NodeExecutor';
import { NodeInstance, NodeType } from '../../../types/nodes';

export class TextFieldNodeExecutor extends NodeExecutor {
  private lastInputs?: Record<string, any>;

  constructor(
    nodeId: string,
    instance: NodeInstance,
    nodeType: NodeType,
    onNodeUpdate?: (nodeId: string, updates: Partial<NodeInstance>) => void
  ) {
    super(nodeId, instance, nodeType, onNodeUpdate);
  }

  // Convenience method to run with upstream data
  async executeWithInput(inputData: any, flowId: number): Promise<NodeExecutionResult> {
    const preparedInputs = this.prepareInputsFromData(inputData);
    this.lastInputs = preparedInputs;

    const context: NodeExecutionContext = {
      nodeId: this.nodeId,
      flowId,
      inputs: preparedInputs
    };

    return await this.execute(context);
  }

  // Normalize inputs to { input_data: {...} }
  private prepareInputsFromData(inputData: any): Record<string, any> {
    if (inputData?.input_data) {
      return { input_data: inputData.input_data };
    }

    if (inputData && typeof inputData === 'object') {
      return { input_data: inputData };
    }

    // Fallback: wrap primitives
    return { input_data: { value: inputData } };
  }

  protected async validateInputs(inputs: Record<string, any>): Promise<void> {
    await super.validateInputs(inputs);
    if (!inputs.input_data) {
      throw new Error("Text Field requires 'input_data' input");
    }
  }

  protected async updateNodeState(result: any): Promise<void> {
    if (!this.onNodeUpdate) return;

    const nowIso = new Date().toISOString();
    const existingData: any = this.instance?.data || {};

    this.onNodeUpdate(this.nodeId, {
      data: {
        ...existingData,
        inputs: {
          ...(existingData.inputs || {}),
          ...(this.lastInputs || {})
        },
        lastExecution: {
          status: result.status,
          outputs: result.outputs || {},
          startedAt: nowIso,
          completedAt: nowIso,
          executionTime: result.executionTime
        },
        outputs: result.outputs || {}
      },
      updatedAt: new Date()
    });
  }
}
