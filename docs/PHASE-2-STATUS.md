# Phase 2 status — auth, database, tenant boundary

## Implemented
- Better Auth server configuration with email/password and organization plugin.
- React sign-up/sign-in UI with loading, success, and error states.
- Workspace onboarding: list existing organizations, create a workspace, and select an active organization.
- Active workspace name and signed-in member are shown in the workspace shell.
- PostgreSQL/Drizzle schema and initial SQL migration.
- Hono API entry point for Vercel Functions and local Node development.
- Health and current-session endpoints.
- Tenant guard derives the active organization from the authenticated server-side session and confirms membership in PostgreSQL.
- Customer list/create endpoints scope every customer query/write to that resolved organization.
- Zod request validation, tenant-context unit tests, and a PostgreSQL-backed two-tenant integration test in CI.

## Verified
Latest CI passed on 2026-10-20: dependency installation, SQL migration against a temporary PostgreSQL 16 service, server/frontend typecheck, ESLint, tests (including two-user/two-workspace tenant isolation), and production build. The test confirms one workspace cannot read the other workspace's customer and rejects a forged organizationId in a customer-create payload.

## Still required before production
- Apply migration to a disposable Neon branch and verify the hosted pooled connection.
- Manually verify sign-up/sign-in/sign-out/session expiry and workspace onboarding in a browser.
- Add customer update/archive, audit events, role policy tests, rate limits, CSRF/origin review, security headers, safe logs, invitation abuse controls, and dependency advisory remediation.
- Never expose the database URL or auth secret through VITE_ variables. Do not use real customer data until production security checks pass.
