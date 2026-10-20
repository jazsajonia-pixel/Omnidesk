# OmniDesk

One workspace. Clearer operations.

OmniDesk is a multi-tenant SaaS operations platform. This repository contains an early but CI-verified authentication, workspace, and customer-management foundation; it is not production-ready.

## Implemented
- React + TypeScript + Vite 7 + Tailwind 4 workspace UI
- Better Auth sign-up/sign-in, organization creation/list/active selection
- Hono API for Vercel Functions and local Node development
- PostgreSQL/Drizzle schema and migrations
- Server-side organization membership checks and tenant-scoped customer endpoints
- Customer list/search/pagination, create/edit, soft archive/restore, active/archived filters, loading/error/empty/success states
- Dashboard active-customer count from a tenant-scoped database query
- PostgreSQL-backed CI integration test for two-tenant isolation

## Verified in CI
GitHub Actions applies migrations to PostgreSQL 16, then runs typecheck, ESLint, tests, and a production build. Integration coverage verifies separate users/workspaces cannot read each other's customer records and rejects client-supplied organization IDs. It also tests customer update/archive/restore, search, pagination, and tenant-scoped dashboard counts.

## Not yet verified / not implemented
- Live Neon configuration and browser/device testing have not been performed.
- Project/task persistence, customer contacts/notes, audit activity feed, global search, file storage, AI, automations, billing, and production deployment remain future work.
- npm audit currently reports 4 moderate advisories in development tooling; there are 0 high and 0 critical advisories in the latest checked dependency tree.

## Local development
Requires Node.js 20+ and npm 10+.

1. Copy .env.example to .env and set DATABASE_URL plus a random BETTER_AUTH_SECRET.
2. Run npm install.
3. Apply migrations to a disposable PostgreSQL database with npm run db:migrate.
4. Start the API with npm run api:dev.
5. In another terminal, run npm run dev.
6. Run npm run typecheck, npm run lint, npm test, and npm run build.

For hosted Neon, use the pooled PostgreSQL connection endpoint. See docs/ for architecture, database, security, deployment, and phase details.
