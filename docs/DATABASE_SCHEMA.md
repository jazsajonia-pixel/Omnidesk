# Database schema status

Drizzle schema is defined in src/server/db/schema.ts. SQL migrations:
- drizzle/0000_omnidesk_foundation.sql — auth, organizations, memberships, invitations, customers.
- drizzle/0001_customers_archive.sql — customer soft-archive column and index.

## Current tables
- user, session, account, verification — Better Auth identity/session persistence.
- organization, member, invitation — organization and membership model.
- customers — tenant-owned records with organization_id, name, email, company, created/updated timestamps, and nullable archived_at.

Customer indexes support tenant-scoped date ordering, name lookup, and active/archive filtering. List/search/count/detail/update/archive/restore queries are constrained by the authenticated active organization. Dashboard summary counts active customers for that tenant.

## Planned next
Projects, project members, tasks, comments/status history, customer contacts/notes/interactions, documents and versions, automation rules/runs, audit logs, notifications, preferences, plans/subscriptions, usage records, and AI usage metadata.

## Verification status
CI applies both migrations to a clean PostgreSQL 16 database and runs two-tenant integration tests. A disposable Neon database and hosted pooled connection have not yet been verified.
