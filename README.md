# OmniDesk

One workspace. Clearer operations.

OmniDesk is a multi-tenant SaaS operations platform. This repository contains the workspace shell and an early authentication/database checkpoint; it is not production-ready.

## Implemented
- React, strict TypeScript, Vite, Tailwind, React Router, and Lucide workspace shell
- Sign-up/sign-in UI using Better Auth, with loading/error/success states
- Organization list, create, and active-workspace selection UI
- Hono API for Vercel Functions and local Node development
- PostgreSQL/Drizzle schema and migration for auth, organizations, memberships, invitations, and customers
- Server-side tenant resolution and organization-scoped customer list/create endpoints
- Zod validation, tenant-context unit tests, and PostgreSQL-backed tenant-isolation integration test in CI
- GitHub Actions CI runs migration, typecheck, lint, tests, and production build

## Verified in CI
The latest passing CI run applies the SQL migration to a temporary PostgreSQL service and tests two separate users/workspaces. It verifies that each workspace only sees its own customer records and that a client-supplied organization ID is rejected.

## Not yet verified / not implemented
- Live Neon deployment, production configuration, and browser/device review are not verified.
- Customer update/archive, projects/tasks persistence, audit logs, file storage, AI, automations, billing, and production deployment are not implemented.
- npm audit has reported advisories in the dependency tree; review the latest CI advisory summary before production use.

## Local development
Requires Node.js 20+ and npm 10+.

1. Copy .env.example to .env and set DATABASE_URL plus a random BETTER_AUTH_SECRET.
2. Run npm install.
3. Apply the SQL migration to a disposable PostgreSQL database with npm run db:migrate.
4. Start the API with npm run api:dev.
5. In another terminal, run npm run dev.
6. Run npm run typecheck, npm run lint, npm test, and npm run build.

For hosted Neon, use the pooled PostgreSQL connection endpoint. See docs/ for product, architecture, database, security, deployment, and phase details.
