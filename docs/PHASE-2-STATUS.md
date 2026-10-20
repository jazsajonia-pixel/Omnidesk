# Phase 2 status — auth, database, tenant boundary

## Implemented in this checkpoint
- Better Auth server configuration with email/password and organization plugin.
- React sign-up/sign-in UI with loading, success, and error states.
- Workspace onboarding: list existing organizations, create a workspace, and select an active organization.
- Active workspace name and signed-in member are shown in the workspace shell.
- Neon-compatible PostgreSQL connection and Drizzle schema/migration.
- Hono API entry point for Vercel Functions and a local Node API server.
- Health and current-session endpoints.
- Tenant guard derives the active organization from the authenticated server-side session and confirms membership in PostgreSQL.
- Customer list/create endpoints scope every customer query/write to that resolved organization.
- Zod request validation, tenant-context unit tests, and GitHub Actions CI.

## Not yet verified
The CI run for this UI checkpoint has not yet completed. No live database migration, signup/sign-in flow, organization onboarding, or two-organization integration test has been executed. The initial backend checkpoint CI passed after fixing dependency and TypeScript issues, but this new UI change requires its own CI result.

## Before real data
1. Set DATABASE_URL, BETTER_AUTH_SECRET (a random secret), and BETTER_AUTH_URL on the server only.
2. Apply the SQL migration to a disposable Neon branch first.
3. Verify Better Auth's generated schema expectations against the installed version.
4. Test signup, login, session expiry, organization creation/selection, and customer access with two separate organizations.
5. Add integration tests that prove a user from organization A cannot list/write organization B's records.
6. Never expose the database URL or auth secret through VITE_ variables.
