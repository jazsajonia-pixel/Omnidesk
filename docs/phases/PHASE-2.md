# Phase 2 — Database, authentication, organizations

## Current checkpoint
Initial server-side auth/database/tenant foundation is added on feat/omnidesk-phase-2-auth-tenancy: Better Auth email/password + organization plugin, Neon-compatible Drizzle schema, initial SQL migration, Hono API, session endpoint, and tenant-scoped customer list/create routes. See docs/PHASE-2-STATUS.md.

## Remaining acceptance criteria
- [ ] CI typecheck, lint, tests, and build pass.
- [ ] Migration is applied to a disposable PostgreSQL/Neon database and schema compatibility is verified.
- [ ] Signup/sign-in/sign-out and session expiration are manually verified.
- [ ] Organization create/select flows are connected to the UI.
- [ ] Integration test proves organization A cannot read/write organization B's customers.
- [ ] Server role policy and audit events are implemented.
- [ ] Secrets and deployment variables are configured outside the repository.

Do not enable real tenant data before the above security checks pass.
