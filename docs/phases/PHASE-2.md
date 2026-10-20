# Phase 2 — Database, authentication, organizations

## Current checkpoint
Better Auth email/password server configuration and React sign-up/sign-in UI, organization creation/list/active-selection UI, PostgreSQL/Drizzle schema, initial SQL migration, Hono API, session endpoint, and tenant-scoped customer list/create routes are implemented.

## Verified in CI
- [x] Dependency install, typecheck, lint, tests, and build pass.
- [x] Migration applies to a temporary PostgreSQL 16 database.
- [x] Integration test creates two users and two workspaces, then verifies customer reads are tenant-scoped and forged organization IDs are rejected.

## Remaining acceptance criteria
- [ ] Apply migration to a disposable Neon database and verify the pooled connection.
- [ ] Manually test sign-up/sign-in/sign-out, session expiry, and organization onboarding in a browser.
- [ ] Add integration tests for role permissions and future customer update/archive operations.
- [ ] Add audit events, rate limits, CSRF/origin review, and safe logs.
- [ ] Review and remediate dependency audit findings before production.

Do not enable real tenant data before the above security checks pass.
