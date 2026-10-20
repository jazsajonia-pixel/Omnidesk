# Phase 2 — Database, authentication, organizations

## Current checkpoint
The repository now includes Better Auth email/password server configuration and React sign-up/sign-in UI, organization creation/list/active-selection UI, Neon-compatible Drizzle schema, initial SQL migration, Hono API, session endpoint, and tenant-scoped customer list/create routes. See docs/PHASE-2-STATUS.md.

## Remaining acceptance criteria
- [ ] CI typecheck, lint, tests, and build pass for the latest UI commit.
- [ ] Migration is applied to a disposable PostgreSQL/Neon database and schema compatibility is verified.
- [ ] Signup/sign-in/sign-out and session expiration are manually verified.
- [ ] Organization create/select flows work end-to-end against the database.
- [ ] Integration test proves organization A cannot read/write organization B's customers.
- [ ] Server role policy and audit events are implemented.
- [ ] Secrets and deployment variables are configured outside the repository.

Do not enable real tenant data before the above security checks pass.
