# Phase 2 status — auth, database, tenant boundary

## Implemented in this checkpoint
- Better Auth server configuration with email/password and organization plugin.
- Neon-compatible serverless PostgreSQL connection and Drizzle schema.
- Initial SQL migration for auth, organizations, memberships, invitations, and customers.
- Hono API entry point for Vercel Functions and a local Node API server.
- Health and current-session endpoints.
- Tenant guard derives the active organization from the authenticated server-side session and confirms membership in PostgreSQL.
- Customer list/create endpoints scope every customer query/write to that resolved organization.
- Zod request validation and basic unit tests for the tenant-context guard.
- GitHub Actions workflow to run typecheck, lint, tests, and production build.

## Not yet verified
npm installation, typecheck, lint, tests, and build have not yet run in this session. No live database migration, signup/sign-in flow, organization onboarding, or two-organization integration test has been executed.

## Before real data
1. Set DATABASE_URL, BETTER_AUTH_SECRET (a random secret), and BETTER_AUTH_URL on the server only.
2. Apply the SQL migration to a disposable Neon branch first.
3. Verify Better Auth's generated schema expectations against the installed version.
4. Test signup, login, session expiry, organization creation/selection, and customer access with two separate organizations.
5. Add integration tests that prove a user from organization A cannot list/write organization B's records.
6. Never expose the database URL or auth secret through VITE_ variables.
