# Deployment

- **Hosting:** Vercel project `omnidesk`. The Vite build is served statically; `api/index.ts` is a single Node function that runs the Hono app. `vercel.json` rewrites `/api/*` to that function, falls back to `index.html` for client routes, and sets CSP/HSTS/caching headers.
- **Database:** Neon project "OmniDesk", main branch, pooled connection string.
- **Environment (Production):** `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `APP_ORIGIN`. See ENVIRONMENT.md.
- **Migrations:** run from a trusted machine before deploying schema changes: `DATABASE_URL=<pooled url> npx drizzle-kit migrate`. Migrations are additive; there are no destructive steps in 0000–0002.
- **Release flow:** pull request → CI (migrate on Postgres 16, typecheck, lint, tests, build) and Vercel preview → merge to `main` → Vercel production deploy.
- **Automated read-only smoke check after deploy:** run `OMNIDESK_BASE_URL=https://omnidesk-blond.vercel.app npm run smoke:production` (PowerShell: `$env:OMNIDESK_BASE_URL="https://omnidesk-blond.vercel.app"; npm run smoke:production`). It exits non-zero unless `/api/health` returns HTTP 2xx and explicitly reports `status: "ok"`, `service: "omnidesk-api"`, and `database: true`. Use the intended public/private access path for protected deployments; never add credentials to the URL.
- **Manual authenticated smoke checks:** confirm the demo opens a seeded workspace; sign-up → create workspace works; then verify two separate users cannot read or mutate each other’s tenant data. The smoke command checks readiness only; it does not replace browser, auth, tenant-isolation, or accessibility QA.
- Imports inside `src/server` use explicit `.js` extensions so the function bundles as native ESM on Vercel.


## Production release gate

Before calling a release production-ready, verify each item explicitly:

- [ ] Confirm the Production environment has `DATABASE_URL` (Neon pooled URL), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, and `APP_ORIGIN`. Verify variable names and targets without copying secret values into logs, PRs, or documentation.
- [ ] Confirm whether the app is intended to be public or private. Check Vercel SSO/deployment protection and domain assignments; test the intended access path from an unauthenticated browser.
- [ ] Rehearse pending migrations against a disposable Neon branch and verify rollback/recovery expectations. Never use production credentials in CI.
- [ ] After an explicitly approved production deployment, verify `GET /api/health` returns `{"status":"ok","database":true}` and test demo workspace creation, sign-up, workspace creation, and tenant isolation.
- [ ] Check API origin validation, authentication/session behavior, security headers, error responses, responsive layouts, and keyboard/screen-reader accessibility.
- [ ] Obtain explicit approval before applying migrations to the production database or changing production deployment protection.


## Read-only production audit (2026-10-25)

- `GET https://omnidesk-blond.vercel.app/api/health` returned HTTP 500 with `FUNCTION_INVOCATION_FAILED` during this check.
- The connected Vercel project's environment-variable listing returned no entries and `hiddenProductionEnvCount: 0`. Verify the Production variables directly in Vercel before concluding whether they are absent; never copy secret values into logs or documentation.
- The current Production deployment still targets `main` at `d801a22`. PR #9 (origin/HTTPS hardening) and PR #10 (dependency/config hardening) remain open and are not live.
- No production deployment, environment, protection, or database changes were made during this audit.
