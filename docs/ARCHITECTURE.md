# Architecture

## Current implementation
- Frontend: React + TypeScript + Vite + Tailwind.
- API: Hono, mounted as a Vercel catch-all function and runnable locally with Node.
- Auth: Better Auth email/password sessions and organization plugin.
- Database: Neon-compatible PostgreSQL through the serverless driver and Drizzle ORM.
- Validation: Zod.
- Tenant boundary: API resolves the active organization from the authenticated session, verifies membership server-side, and scopes customer queries/writes to that organization.

## Request flow
Browser -> Hono API -> Better Auth session -> membership guard -> Zod validation -> tenant-scoped Drizzle query -> safe JSON response.

The active organization must never be accepted from request payloads as the source of authorization. Every new tenant-owned query, mutation, export, AI retrieval, file, job, and notification must use server-resolved tenant context.

## Status
The auth/database/API foundation and customer list/create routes are scaffolded. Build/CI, live migration, authentication flows, and cross-tenant integration tests have not yet been verified. Do not use with real customer data until the Phase 2 acceptance criteria pass.
