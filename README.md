# OmniDesk

One workspace. Clearer operations.

OmniDesk is a multi-tenant SaaS operations platform. This repository contains the workspace shell and an early authentication/database checkpoint; it is not production-ready.

## Implemented
- React, strict TypeScript, Vite, Tailwind, React Router, and Lucide workspace shell
- Sign-up/sign-in UI using Better Auth, with loading/error/success states
- Organization list, create, and active-workspace selection UI
- Hono API for Vercel Functions and local Node development
- Neon-compatible PostgreSQL connection and Drizzle schema/migration for auth, organizations, memberships, invitations, and customers
- Server-side tenant resolution and organization-scoped customer list/create endpoints
- Zod validation, unit tests for tenant-context guards, and GitHub Actions CI

## Not yet verified / not implemented
- Authentication, onboarding, and database flows have not been tested against a live database in this session.
- CI for the latest auth/onboarding UI commit has not yet been observed passing.
- No two-tenant integration test has run; do not use real customer data yet.
- Customer update/archive, projects/tasks persistence, audit logs, file storage, AI, automations, billing, and production deployment are not implemented.

## Local development
Requires Node.js 20+ and npm 10+.

1. Copy .env.example to .env and set DATABASE_URL plus a random BETTER_AUTH_SECRET.
2. Run npm install.
3. Apply the initial SQL migration to a disposable PostgreSQL database after reviewing docs/PHASE-2-STATUS.md.
4. Start the API with npm run api:dev.
5. In another terminal, run npm run dev.
6. Run npm run typecheck, npm run lint, npm test, and npm run build.

See docs/ for product, architecture, database, security, deployment, and phase details.
