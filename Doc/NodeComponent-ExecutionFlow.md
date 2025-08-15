# Node Component Execution Flow

This document describes the execution flow of nodes in the Social Media Flow Builder application.

## Node Execution Sequence

```plantuml
@startuml NodeComponent_ExecutionFlow
!theme plain

actor User
participant FlowCanvas as "Flow Canvas"
participant NodeComponent as "Node Component"
participant BaseNode as "BaseNode"
participant NodeService as "nodeService"
participant Backend as "Backend API"
participant FlowEngine as "Flow Engine"
participant ExecutionHook as "useExecutionData"

== Node Initialization ==

FlowCanvas -> NodeComponent: Create node instance
activate NodeComponent
NodeComponent -> BaseNode: Render with configuration
activate BaseNode
BaseNode --> NodeComponent: Rendered node
deactivate BaseNode
NodeComponent --> FlowCanvas: Node added to canvas
deactivate NodeComponent

== Execution Preparation ==

User -> NodeComponent: Click Execute Button
activate NodeComponent
NodeComponent -> NodeComponent: handleExecute()
activate NodeComponent
NodeComponent -> NodeComponent: setExecuting(true)
NodeComponent -> BaseNode: Update UI (show spinner)
activate BaseNode
BaseNode --> NodeComponent: UI updated
deactivate BaseNode
deactivate NodeComponent

== Execution Process ==

NodeComponent -> NodeService: executeNode(flowId, nodeId, context)
activate NodeService
NodeService -> NodeService: Auto-save flow (if needed)
NodeService -> Backend: POST /api/flows/{flowId}/nodes/{nodeId}/execute
activate Backend
Backend -> FlowEngine: Execute node
activate FlowEngine
FlowEngine -> FlowEngine: Process inputs
FlowEngine -> FlowEngine: Execute node logic
FlowEngine -> FlowEngine: Generate outputs
FlowEngine --> Backend: Execution result
deactivate FlowEngine
Backend --> NodeService: Response with outputs
deactivate Backend
NodeService --> NodeComponent: Execution result
deactivate NodeService

== State Update ==

NodeComponent -> NodeComponent: Process result
activate NodeComponent
NodeComponent -> FlowCanvas: onNodeUpdate(nodeId, { data: { lastExecution } })
activate FlowCanvas
FlowCanvas -> FlowCanvas: Update node state
FlowCanvas --> NodeComponent: State updated
deactivate FlowCanvas
NodeComponent -> NodeComponent: setExecuting(false)
NodeComponent -> BaseNode: Update UI (hide spinner)
activate BaseNode
BaseNode --> NodeComponent: UI updated
deactivate BaseNode
deactivate NodeComponent

== Result Display ==

NodeComponent -> ExecutionHook: useExecutionData(nodeData)
activate ExecutionHook
ExecutionHook -> ExecutionHook: Process execution data
ExecutionHook -> ExecutionHook: Format display data
ExecutionHook --> NodeComponent: Formatted execution data
deactivate ExecutionHook
NodeComponent -> NodeComponent: Render execution results
NodeComponent --> User: Display execution results

@enduml
```

## Node Configuration Flow

```plantuml
@startuml NodeComponent_ConfigurationFlow
!theme plain

participant FlowCanvas as "Flow Canvas"
participant NodeComponentFactory as "NodeComponentFactory"
participant ConfigHook as "useNodeConfiguration"
participant NodeRegistry as "NODE_REGISTRY"
participant NodeIcons as "NODE_ICONS"
participant BackendConfig as "Backend Node Types"

== Configuration Loading ==

FlowCanvas -> NodeComponentFactory: render(nodeProps)
activate NodeComponentFactory
NodeComponentFactory -> ConfigHook: useNodeConfiguration(nodeTypeId)
activate ConfigHook

ConfigHook -> ConfigHook: Check cache
alt Cache hit
    ConfigHook --> NodeComponentFactory: Cached configuration
else Cache miss
    ConfigHook -> BackendConfig: Get node type data
    activate BackendConfig
    BackendConfig --> ConfigHook: Raw node type data
    deactivate BackendConfig
    
    ConfigHook -> NodeRegistry: Get registry entry
    activate NodeRegistry
    NodeRegistry --> ConfigHook: Registry metadata
    deactivate NodeRegistry
    
    ConfigHook -> NodeIcons: Get node icon
    activate NodeIcons
    NodeIcons --> ConfigHook: Icon component
    deactivate NodeIcons
    
    ConfigHook -> ConfigHook: buildNodeConfiguration()
    ConfigHook -> ConfigHook: Cache result
    ConfigHook --> NodeComponentFactory: Complete configuration
end
deactivate ConfigHook

NodeComponentFactory -> NodeComponentFactory: determineRenderingStrategy()
NodeComponentFactory -> NodeComponentFactory: Render appropriate component
NodeComponentFactory --> FlowCanvas: Rendered node
deactivate NodeComponentFactory

@enduml
```

## Node Settings Flow

```plantuml
@startuml NodeComponent_SettingsFlow
!theme plain

actor User
participant NodeComponent as "Node Component"
participant SettingsDialog as "Settings Dialog"
participant FlowCanvas as "Flow Canvas"

== Settings Dialog ==

User -> NodeComponent: Click Settings Button
activate NodeComponent
NodeComponent -> NodeComponent: handleSettingsClick()
NodeComponent -> SettingsDialog: Open dialog with current settings
activate SettingsDialog
SettingsDialog --> User: Display settings form
deactivate NodeComponent

User -> SettingsDialog: Modify settings
activate SettingsDialog
SettingsDialog -> SettingsDialog: Update local state
SettingsDialog --> User: Visual feedback
deactivate SettingsDialog

User -> SettingsDialog: Click Save
activate SettingsDialog
SettingsDialog -> SettingsDialog: handleSettingsSave()
SettingsDialog -> NodeComponent: onNodeUpdate(nodeId, { settings: localSettings })
activate NodeComponent
NodeComponent -> FlowCanvas: Update node settings
activate FlowCanvas
FlowCanvas -> FlowCanvas: Update node state
FlowCanvas --> NodeComponent: Settings updated
deactivate FlowCanvas
NodeComponent --> SettingsDialog: Confirmation
deactivate NodeComponent
SettingsDialog -> SettingsDialog: Close dialog
SettingsDialog --> User: Dialog closed
deactivate SettingsDialog

@enduml
```

## Node Data Flow

```plantuml
@startuml NodeComponent_DataFlow
!theme plain

participant FlowCanvas as "Flow Canvas"
participant NodeA as "Source Node"
participant Connection as "Edge Connection"
participant NodeB as "Target Node"
participant ExecutionEngine as "Execution Engine"

== Data Flow Between Nodes ==

NodeA -> NodeA: Execute
activate NodeA
NodeA -> ExecutionEngine: Process execution
activate ExecutionEngine
ExecutionEngine --> NodeA: Execution result with outputs
deactivate ExecutionEngine
NodeA -> FlowCanvas: Update node state with outputs
activate FlowCanvas
FlowCanvas -> FlowCanvas: Store output data
FlowCanvas --> NodeA: State updated
deactivate FlowCanvas
deactivate NodeA

User -> NodeB: Execute
activate NodeB
NodeB -> FlowCanvas: Request input data
activate FlowCanvas
FlowCanvas -> Connection: Get connected source nodes
activate Connection
Connection --> FlowCanvas: Source node IDs and ports
deactivate Connection
FlowCanvas -> NodeA: Get output data
activate NodeA
NodeA --> FlowCanvas: Output data
deactivate NodeA
FlowCanvas --> NodeB: Input data from connections
deactivate FlowCanvas
NodeB -> ExecutionEngine: Execute with input data
activate ExecutionEngine
ExecutionEngine --> NodeB: Execution result
deactivate ExecutionEngine
NodeB -> NodeB: Update UI with result
NodeB --> User: Display execution result
deactivate NodeB

@enduml
```

These sequence diagrams illustrate the key flows in the node component architecture:

1. **Node Execution Flow**: Shows how a node is executed from user interaction through the backend and back to the UI
2. **Node Configuration Flow**: Demonstrates how node configuration is loaded and processed
3. **Node Settings Flow**: Illustrates the process of updating node settings
4. **Node Data Flow**: Shows how data flows between connected nodes during execution

Together, these diagrams provide a comprehensive view of the node component system's runtime behavior.
