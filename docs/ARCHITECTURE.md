# Architecture

## Current implementation
- Frontend: React + TypeScript + Vite 7 + Tailwind 4.
- API: Hono, mounted as a Vercel catch-all function and runnable locally with Node.
- Auth: Better Auth email/password sessions and organization plugin.
- Database: PostgreSQL through a small node-postgres pool and Drizzle ORM; use Neon’s pooled connection endpoint when hosted.
- Validation: Zod.
- Tenant boundary: API resolves the active organization from the authenticated session, verifies membership server-side, and scopes customer operations to that organization.

## Request flow
Browser -> Hono API -> Better Auth session -> active organization membership guard -> Zod validation -> tenant-scoped Drizzle query -> JSON response.

The active organization must never be accepted from request payloads as the source of authorization. Every tenant-owned query, mutation, export, AI retrieval, file, job, and notification must use server-resolved tenant context.

## Customer API
- GET /api/customers: search, active/archived filter, bounded pagination.
- GET /api/customers/:id: tenant-scoped active customer detail.
- POST /api/customers: create a customer.
- PATCH /api/customers/:id: update name/email/company.
- POST /api/customers/:id/archive and /restore: soft archive lifecycle.
- GET /api/dashboard/summary: tenant-scoped active customer count.

## Status
CI verifies migration, typecheck, lint, unit and PostgreSQL integration tests, and build. Live Neon connection, production auth settings, and browser/device behavior remain unverified.
