# Testing

Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`. CI runs all of them after applying migrations to PostgreSQL 16.

## Automated (Vitest)
- `permissions.test.ts` — role matrix, `canManageRole`, unknown-role fallback.
- `lib/csv.test.ts` — quoting and formula-injection escaping.
- `tenant.test.ts`, `security-headers.test.ts` — guards and headers.
- `app.integration.test.ts` — two-tenant customer isolation, search, pagination, archive/restore, dashboard counts.
- `operations.integration.test.ts` — untrusted-origin rejection; projects, tasks, board move ordering, project progress, reports, documents, CSV export, activity isolation; invitation accept, viewer write denial, role change, last-owner protection; demo workspace creation.

Integration suites need `DATABASE_URL` and `BETTER_AUTH_SECRET` and are skipped otherwise.

## Manual browser QA (v1.0)
Playwright/Chromium against the local dev server at 1440×900 and 375×812, light and dark themes: demo start, overview, customers (panel, notes, create), projects and detail, task create and drag between columns (persists after reload), list view, command palette, document edit/preview/save, reports, team, settings theme switch, mobile drawer and bottom-sheet dialogs. No console errors.
