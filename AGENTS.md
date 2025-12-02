## Project Context
This project is a fork of [Evolution API](https://github.com/EvolutionAPI/evolution-api) maintained by Widget Works. It is used to power the WhatsApp integration for Prospek (a CRM product).
The goal is to maintain a stable, custom version of Evolution API that fixes specific issues (syncing, attribution) while remaining merge-friendly with the upstream.

## Workflow for AI Agents

### 1. Task Management
- **High-Level Tracking**: GitHub Issues/Projects (for human/agent alignment and roadmap).
- **Execution Tracking**: `task.md` in the root directory (for agent step-by-step progress).
- **Process**:
    1.  Check GitHub Issues for new assignments or priorities.
    2.  Update `task.md` to reflect current execution steps.
    3.  Mark tasks as in-progress `[/]` when starting.
    4.  Mark tasks as completed `[x]` when done.

## Operating Protocol & Guardrails

### 1. Operating Protocol
- **Session start**: Read `task.md` for active context. For detailed technical guidance on the codebase, architecture, and commands, refer to `DEVELOPMENT.md`. Clarify any questions with the user, do not make assumption. 
- **Task completion**: Verify outcomes, request user confirmation, then update documentation. 
- **Incident response**: Surface blockers, unexpected state, or sandbox limitations immediately. Never undo prior user changes without explicit approval.

### 2. Code Changes
- **Minimalism**: Do not refactor upstream code unless necessary for a fix.
- **Isolation**: Keep custom logic in separate files or clearly marked blocks.
- **Labeling**: MUST use `// [WIDGET-WORKS] <reason>` for any change to upstream files.
- **Review**: All logic changes require a verification plan (how to test).
- **Credential hygiene**: Never hardcode tokens, API keys, or secrets.
- **Data privacy**: Do not log or copy sensitive user content. Redact tokens, phone numbers, and personal data from any notes or documentation.

### 3. Documentation Discipline
- **Update-as-you-go**: If you change how something works, update the docs immediately.
- **Context Handoff**: Keep `task.md` and `AGENTS.md` updated so the next agent knows exactly where to pick up.
- **Logs**: When investigating, save relevant logs to `docs/troubleshooting/` with a timestamp.

### 4. MCP & Tools

## 5. Deployment
- Update CHANGELOG.md with the release notes, add ### Widget Works Modification under each evolution version.  
- **Target**: Azure Container Apps (ACA).
- **Registry**: Azure Container Registry (ACR) `prospek.azurecr.io`.
- **Workflow**:
    1.  **Build**: `./build.sh` (Updates `IMAGE_TAG` automatically? No, manual update required).
    2.  **Push**: Script pushes to ACR.
    3.  **Deploy**: Manually update revision in Azure Portal > Container Apps.
- **Instructions**: See `docs/DEPLOYMENT.md` for the authoritative guide.

## Current Focus
- Fixing "Pending Message" duplicate attribution.
- Fixing "Delivery ACK" media sync failures.
- Stabilizing instance connections (preventing 401 disconnects).
