# OmniDesk

One workspace. Clearer operations.

OmniDesk is a multi-tenant operations workspace for small teams: customers, projects, tasks, documents, reports and team roles in one place. Version 1.0.

**Live:** https://omnidesk-blond.vercel.app — the homepage is reachable, but the API is currently unhealthy; do not use the hosted app with real data.

> **Deployment status (2026-11-02):** The Production homepage returns HTTP 200, but `/api/health` returns HTTP 500 (`FUNCTION_INVOCATION_FAILED`). The active Production deployment is sourced from unmerged PR #9 at `8e6c86e`, not `main`. The connected Vercel environment inventory lists no Production-targeted entries for the required server variables. PR #10 is the consolidated security release candidate; its Preview API health returns HTTP 200 with `database: true`, but Preview success does not establish Production readiness. Do not use Production with real data until Production configuration, authenticated flows, and tenant isolation are verified and the release is approved.

## Features
- **Accounts and workspaces** — email/password auth (Better Auth), multiple workspaces per user, workspace switcher, invitations by link.
- **Roles** — owner, admin, manager, member, viewer. Enforced on the server for every endpoint; the UI hides actions you can't take.
- **Customers** — search, status (lead/active/inactive), archive/restore, a detail panel with notes and linked projects.
- **Projects** — card grid with progress, deadlines and customer link; a detail page with grouped tasks.
- **Tasks** — Kanban board with drag-and-drop ordering, list view, filters (assignee, project, priority, overdue/this week), deep links.
- **Documents** — Markdown editor with live preview, linked to projects; safe rendering (no raw HTML, http/https/mailto links only).
- **Reports** — weekly throughput chart, status/priority/workload/customer breakdowns, project progress, full activity history.
- **Everywhere** — command palette (⌘K or /), activity notifications, CSV export (formula-injection safe), light/dark/system theme, responsive down to 320px.

## Stack
React 18, TypeScript, Vite 7, React Router 7, Hono (one Vercel function), Better Auth with the organization plugin, Drizzle ORM, PostgreSQL (Neon in production), Zod, Vitest.

## Local development
Requires Node.js 20+ and PostgreSQL.

1. Copy `.env.example` to `.env`; set `DATABASE_URL` and a random `BETTER_AUTH_SECRET` (`openssl rand -base64 32`).
2. `npm install`
3. `npm run db:migrate`
4. `npm run api:dev` (API on :4000) and, in another terminal, `npm run dev` (app on :5173, proxies `/api`).
5. Checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

See `docs/` for architecture, database, security, testing, deployment and environment notes.
