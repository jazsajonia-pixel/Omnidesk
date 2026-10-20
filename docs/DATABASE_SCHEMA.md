# Database schema status

An initial SQL migration is present at drizzle/0000_omnidesk_foundation.sql. Drizzle schema is defined in src/server/db/schema.ts.

## Current tables
- user, session, account, verification — Better Auth identity/session persistence.
- organization, member, invitation — Better Auth organization and membership model.
- customers — tenant-owned customer records with organization_id foreign key.

Tenant-owned customer indexes include organization ID with creation timestamp and name. Every customer list/create endpoint must derive organization ID from the authenticated server-side session and confirmed membership.

## Planned next
Projects, project members, tasks, comments/status history, customer contacts/notes/interactions, documents and versions, automation rules/runs, audit logs, notifications, preferences, plans/subscriptions, usage records, and AI usage metadata.

## Verification status
The migration has not been applied to a live or disposable PostgreSQL/Neon database. Verify Better Auth schema/plugin compatibility against the installed version and add a two-organization integration test before handling real tenant data.
