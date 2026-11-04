# OmniDesk

One workspace. Clearer operations.

OmniDesk is a multi-tenant operations workspace for small teams: customers, projects, tasks, documents, reports and team roles in one place. Version 1.0.

**Hosted demo:** https://omnidesk-blond.vercel.app — the Production domain is configured, but the latest Production deployment is BLOCKED by Vercel's Git-author verification. Do not use the hosted app with real data until deployment and API readiness are verified.

> **Deployment status (2026-11-04):** PR #10's security release is merged. Current `main` is `9df6528`; GitHub Actions run [41397574653](https://github.com/jazsajonia-pixel/Omnidesk/actions/runs/41397574653) passed dependency audit, PostgreSQL 16 migrations, typecheck, lint, tests, and production build. Vercel's latest Production deployment (`dpl_HaGAEogXbh1hzenrUK9fsMs5oEdk`) is BLOCKED because its commit author `mistral-vibe` does not have access to the Vercel project. The current Vercel environment inventory lists the four required server variables only for the Preview branch `fix/zod-4-6-7-security`; it reports zero hidden Production variables. The latest blocked deployment has no fresh API-health result; the last verified Production `/api/health` response was HTTP 500 on 2026-11-02. Keep Production out of use with real data until the author gate, Production-only configuration, authenticated flows, tenant isolation, and release approval are resolved.

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
