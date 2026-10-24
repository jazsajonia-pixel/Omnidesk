# Testing

Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`. CI runs all of them after applying migrations to PostgreSQL 16.

## Automated (Vitest)
- `permissions.test.ts` — role matrix, `canManageRole`, unknown-role fallback.
- `lib/board.test.ts` — drop/keyboard move planning (neighbour anchors, column edges, no-op moves, gapped positions).
- `lib/csv.test.ts` — quoting and formula-injection escaping.
- `tenant.test.ts`, `security-headers.test.ts` — tenant guards and response headers, including HTTPS-only HSTS.
- `app.integration.test.ts` — two-tenant customer isolation, search, pagination, archive/restore, dashboard counts.
- `operations.integration.test.ts` — untrusted and missing-origin rejection; projects, tasks, board move ordering (numeric and `beforeId`/`afterId` anchors with gapped positions, cross-workspace anchors ignored), project progress, reports, documents, CSV export, activity isolation; invitation accept, viewer write denial, role change, last-owner protection; concurrent demotions/departures never leave a workspace without an owner (4 rounds each); an invitation opened three times at once joins exactly once; demo workspace creation.

Integration suites need `DATABASE_URL` and `BETTER_AUTH_SECRET` and are skipped otherwise. The demo endpoint keeps its hourly per-IP limit in tests, so many local runs against the same database can make the demo test return 429; clear it with `DELETE FROM rate_limit;` (CI starts from a fresh database).

## Manual browser QA (keyboard board moves, 2026-10-23)
Playwright/Chromium against local API + Vite with PostgreSQL 16, demo workspace: Alt+Right moved a focused card to the next column, Alt+Down reordered it, focus stayed on the card, the live region announced the new column and position, the order persisted after reload, and no console errors appeared. Hint text checked at 1366×860 light and 375×800 dark.

## Manual browser QA (v1.0)
Playwright/Chromium against the local dev server at 1440×900 and 375×812, light and dark themes: demo start, overview, customers (panel, notes, create), projects and detail, task create and drag between columns (persists after reload), list view, command palette, document edit/preview/save, reports, team, settings theme switch, mobile drawer and bottom-sheet dialogs. No console errors.
