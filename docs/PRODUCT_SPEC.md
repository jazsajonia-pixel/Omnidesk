# Product specification
OmniDesk is a multi-tenant workspace for small businesses to manage customers, projects, tasks, documents, reporting, teams, optional AI, and controlled workflow automation.

## MVP outcomes
Authentication and organization membership are enforced server-side; roles govern protected operations; customer/project/task changes persist in PostgreSQL; dashboard metrics use tenant-scoped queries; significant changes are audited; optional integrations fail gracefully; documentation reflects verified behavior.

## Roles
Owner: full organization control. Admin: operations/member management excluding owner-only actions by default. Manager: permitted operational resources. Member: assigned/shared records. Viewer: read-only. Platform administrator is a separate platform role.

## Current boundary
Only a frontend foundation exists. Module routes are placeholders; auth, persistence, tenant enforcement, and integrations are not implemented.