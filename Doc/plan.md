## Notes
- The user wants to create an application for building automation flows for social media customer service (e.g., auto-answering Instagram DMs/comments using LLMs).
- Users should be able to visually create and connect nodes (triggers, AI processing, output, etc.), each with customizable input, output, and settings.
- Node processing is handled in the backend (Python), and users can execute nodes individually or as a whole flow.
- Flows must be savable, stored in a database in a format that can be executed/deployed for real use cases (e.g., auto-answering comments on a specific post).
- The system should be extensible for adding new node types easily, with defined input/output/processing/settings.
- Documentation and architecture diagrams are needed.
- User requested creation of detailed markdown documentation files (architecture, API structure, database, components, tech stack, services, implementation, project description) in a Doc folder.

## Task List
- [x] Define the overall system architecture (frontend, backend, database, integrations).
- [x] Select the tech stack for frontend (visual builder), backend (Python), and database.
- [ ] Design the node system (input/output/settings schema, extensibility).
- [ ] Plan flow execution engine (step-by-step and full flow execution).
- [ ] Define flow storage format and database schema.
- [ ] Plan for integration with social media APIs (e.g., Instagram).
- [ ] Outline documentation requirements (architecture, node creation, flow usage).
- [x] Create Doc folder and generate the following markdown files:
  - [x] architecture.md
  - [x] api_structure.md
  - [x] database.md
  - [x] components.md
  - [x] tech_stack.md
  - [x] services.md
  - [x] implementation.md
  - [x] project_description.md
- [x] Populate each documentation file with relevant content.

## Current Goal
Design node system and flow execution engine.