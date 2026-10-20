# OmniDesk

One workspace. Clearer operations.

OmniDesk is a multi-tenant SaaS operations platform. This repository contains a React/TypeScript workspace shell plus the first backend/auth/tenant-isolation checkpoint; it is not production-ready.

## Implemented foundation
- React, strict TypeScript, Vite, Tailwind, React Router, and Lucide
- Hono API entry point for Vercel Functions and local Node API server
- Better Auth email/password sessions and organization plugin configuration
- Neon-compatible PostgreSQL connection and Drizzle schema/migration for users, sessions, organizations, memberships, invitations, and customers
- Server-side tenant resolution and organization-scoped customer list/create endpoints
- Zod request validation and GitHub Actions CI workflow

## Not yet verified / not implemented
- CI commands have not yet been observed passing in this session.
- Live database migration and Better Auth signup/signin/organization workflows are not verified.
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
