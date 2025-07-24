markdown:Doc/Node Registration Guide.md
# Node Category Registration Guide

To assign categories/subcategories to nodes:

1. **Where to register**  
   Edit: [frontend/src/config/nodeRegistry.ts](cci:7://file:///c:/Amir/AiAgent/socialmediaFlow/frontend/src/config/nodeRegistry.ts:0:0-0:0)

2. **How to register**  
   Add entries in this format:
   ```typescript
   "your-node-id": {
     category: NodeCategory.<CATEGORY>,
     subcategory: "Your Subcategory"
   }
Required values
your-node-id: The node's backend ID (same as in API responses)
<CATEGORY>: One of TRIGGER, PROCESSOR, or ACTION
Your Subcategory: Display name for grouping (e.g., "Chat Models")
Example registration
typescript
"instagram-post": {
  category: NodeCategory.ACTION,
  subcategory: "Social Media"
}
What happens
Node appears in the specified subcategory
Subcategory appears under its main category
Affects both Node Library and FlowBuilder sidebar
⚠️ Always restart the frontend after modifying the registry