# Product specification

OmniDesk is a multi-tenant workspace for small service businesses to run customers, projects, tasks, documents and reporting with their team.

## v1.0 scope
Authentication and workspace membership are enforced on the server; roles govern every protected operation; customers, notes, projects, tasks, documents and activity persist in PostgreSQL; dashboard and reports use tenant-scoped queries; significant changes are recorded in the activity log; a self-serve demo workspace shows the product without sign-up.

## Roles
- Owner — everything, including managing owners and admins.
- Admin — team, settings and all records; can't manage owners/admins.
- Manager — customers, projects, tasks, documents and exports.
- Member — tasks, notes and documents.
- Viewer — read-only.
