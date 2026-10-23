# Architecture

- Frontend: React 18 + TypeScript + Vite 7, React Router 7, hand-written CSS design system (CSS variables, light/dark), Lucide icons. Pages are lazy-loaded.
- API: Hono app in `src/server/app.ts`, exposed on Vercel through `api/index.ts` and locally through `server.ts`.
- Auth: Better Auth email/password + organization plugin; database-backed rate limits.
- Data: PostgreSQL via node-postgres pool and Drizzle ORM (Neon pooled endpoint in production).
- Validation: Zod (strict objects).

## Request flow
Browser → origin check (mutations) → Better Auth session → `resolveTenant(action)` (membership + role permission) → Zod validation → tenant-scoped Drizzle query → activity record → JSON.

## API surface
- `/api/workspace` (GET/PATCH), `/dashboard`, `/activity`, `/sample-data`
- `/api/customers` (+ `/options`, `/:id`, `/:id/notes`, `/:id/archive`, `/:id/restore`)
- `/api/projects` (+ `/options`, `/:id`, `/:id/archive`, `/:id/restore`)
- `/api/tasks` (+ `/:id`, `/:id/move` with `{ status, beforeId?, afterId?, position? }`)
- `/api/documents` (+ `/:id`)
- `/api/team` (+ `/options`, `/invitations`, `/members/:id`), `/api/invitations/:id` (+ `/accept`)
- `/api/search`, `/api/reports`, `/api/export/{customers,projects,tasks}.csv`
- `/api/demo`, `/api/health`, `/api/auth/*`
