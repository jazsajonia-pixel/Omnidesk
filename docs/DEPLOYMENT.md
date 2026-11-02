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



## Read-only production and Preview audit (2026-11-01)

This section supersedes the deployment-state observations above for the date of this audit. It records read-only evidence only; it is not authorization to change Production.

- **GitHub state:** `main` remains at `d801a22be0dbe4aef2291653d2cca08a3acea3a9`. PR #9 (`fix/api-origin-hsts`, head `8e6c86eff6ce1709f5b5f6c8f084bffb15ce5a2e`) and PR #10 (`fix/zod-4-6-7-security`, head `a494aa083749bdaab55757c4c52402ef2e2727a8`) are open and unmerged.
- **Production deployment:** Vercel marks `dpl_HuaSESRqgGF9BBHYDzkNx1TKFshQ` READY and target `production`, but its Git source is PR #9's unmerged `fix/api-origin-hsts` branch at `8e6c86e`, not `main`. Its aliases include `omnidesk-blond.vercel.app`. On 2026-11-01 at 00:40 UTC, the production homepage returned HTTP 200 but `GET /api/health` returned HTTP 500 `FUNCTION_INVOCATION_FAILED`.
- **Production configuration:** the connected Vercel environment inventory returned four variables, all scoped to Preview branch `fix/zod-4-6-7-security`; `hiddenProductionEnvCount` was 0. No Production-targeted entries were returned for the required `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, and `APP_ORIGIN`. Verify the Vercel dashboard before provisioning values; never copy or record secret values. Use a dedicated least-privilege Production database role and Production-only auth secret/origins, not Preview credentials.
- **Likely failure path (not proven):** PR #9's `api/index.ts` statically imports the Hono app, which imports auth/database modules during function initialization. PR #10 instead validates required configuration and returns a generic 503 before dynamically importing the app. The absent Production-targeted variables plus the PR #9 entrypoint are consistent with the observed invocation failure, but Vercel supplied no runtime stack trace, so the exact thrown exception is unconfirmed.
- **PR #10 Preview:** deployment `dpl_GSnEVN58z3KEVwD4iJU4diLY2ipy` is READY from head `a494aa0`. On 2026-11-01 at 00:40 UTC, `GET /api/health` returned HTTP 200 with `status: "ok"` and `database: true`; `GET /api/auth/get-session` returned HTTP 200 with `null` for an unauthenticated request. The API response included the expected security headers. This proves Preview function/database readiness, not successful sign-in or persistent authenticated sessions. A request to `/api/me` was blocked by Vercel deployment SSO, so authenticated route testing remains outstanding.
- **CI:** current GitHub Actions runs #9 `40984759699` and #10 `40979471854` both completed with failure before any job steps. The `verify` jobs expose no steps or downloadable logs. The cause is not confirmed as billing; account billing and runner settings are not readable through the connected integration. Vercel reports successful status checks for both heads and build events show TypeScript typecheck plus Vite production build, but lint, Vitest, migrations and dependency audit are not verified on the current heads.
- **Logs:** Vercel's grouped runtime-error query returned no clusters for the last 24 hours. A 30-minute function-error log query returned no records; a one-hour query was rejected because the Hobby plan does not retain that window. Neither result explains the Production 500.
- **Release gate:** keep Production unchanged. First verify/configure the four Production variables in Vercel and resolve the Actions runner restriction. Then obtain full CI on both heads, rehearse migrations on a disposable Neon branch, and complete authenticated sign-up/session, two-tenant isolation, responsive and accessibility QA. Only proceed with Production deployment and migrations after explicit owner approval.
- No source, environment variable, deployment, migration, merge, or Production database was changed during this audit.



## CI and Preview recheck (2026-11-01)

- **PR #9:** rerun [40984759699](https://github.com/jazsajonia-pixel/Omnidesk/actions/runs/40984759699) passed on head `8e6c86e`: PostgreSQL 16 migrations, typecheck, lint (0 errors; 2 existing React Fast Refresh warnings), **29 tests across 7 files**, and production build. Its audit summary is informational and reports **18 vulnerabilities (17 moderate, 1 high)**, including Zod below 4.6.6; do not treat this PR as dependency-clean.
- **PR #10:** clean run [41258488020](https://github.com/jazsajonia-pixel/Omnidesk/actions/runs/41258488020) passed on head `ee0d419`: `npm ci`, audit (**0 vulnerabilities**), PostgreSQL 16 migrations, typecheck, lint, **41 tests across 9 files**, and production build. The temporary lockfile-refresh helper and temporary CI steps were removed before this clean run.
- **PR #10 Preview:** deployment `dpl_4RYYk6PsT78fMKeGsBcoh1XnZYLn` reached READY. At 2026-11-01 00:52 UTC, homepage returned HTTP 200, `GET /api/health` returned HTTP 200 with `status: "ok"` and `database: true`, and `GET /api/auth/get-session` returned HTTP 200 with `null` for an unauthenticated request. The API response included `no-store`, HSTS, CSP, frame/content-type protections and permissions/referrer headers.
- **PR #9 Preview and Production:** the PR #9 Preview `GET /api/health` returned HTTP 500 `FUNCTION_INVOCATION_FAILED` at 2026-11-01 00:53 UTC; Production did the same. PR #9 is still the source of the active Production deployment, while PR #10's fail-closed configuration guard is only in Preview. The exact Production exception remains unconfirmed because no runtime stack trace was available.
- GitHub Actions runners are executing jobs again; the earlier before-step failures were not reproduced by the reruns. This does not establish the account billing/runner setting that caused those earlier failures.
- Hosted authenticated sign-in/session, cross-tenant browser flows, and manual responsive/accessibility QA remain outstanding. `/api/me` was blocked by Vercel deployment SSO; automated two-tenant isolation and role/concurrency coverage passed in CI.
- No Production environment, deployment, merge, migration, or database change was made. Keep Production unchanged until the required Production variables are verified and the release is explicitly approved.


## Consolidated Preview verification (2026-11-02)

This section records the latest PR #10 consolidated candidate and read-only Production state. It is not authorization to change Production.

- **GitHub state:** PR #10 remains open and unmerged at `9d1dc92816c52f2791a7c00b45ffe5488fedab97` on `fix/zod-4-6-7-security`. Its branch now includes the HSTS middleware and regression tests previously unique to PR #9, plus the already-matched missing/untrusted-Origin guard and route validation fixes. PR #9 remains open; do not merge it independently because its dependency audit reports 18 findings (17 moderate, 1 high).
- **CI:** GitHub Actions run [41368510108](https://github.com/jazsajonia-pixel/Omnidesk/actions/runs/41368510108) passed on the current PR #10 head: `npm ci`, `npm audit --audit-level=moderate` (0 vulnerabilities), PostgreSQL 16 migrations, typecheck, lint (0 errors; 2 existing React Fast Refresh warnings), **42 tests across 9 files**, and the production build.
- **Preview:** deployment [dpl_8dkEr4GdLuA1YDceWxvPMzA5sLpJ](https://vercel.com/chrono8/omnidesk/8dkEr4GdLuA1YDceWxvPMzA5sLpJ) reached READY from the current PR #10 head. On 2026-11-02 00:43 UTC, the homepage returned HTTP 200; `GET /api/health` returned HTTP 200 with `status: "ok"` and `database: true`; `GET /api/auth/get-session` returned HTTP 200 with `null` for an unauthenticated request. API responses included HSTS, `no-store`, and the expected content-type, frame, referrer, permissions and cross-origin resource headers. This verifies Preview readiness and database connectivity, not authenticated sign-in/session persistence.
- **Production:** the active Production deployment remains `dpl_HuaSESRqgGF9BBHYDzkNx1TKFshQ`, sourced from PR #9's unmerged branch at `8e6c86e`, not `main` or the consolidated candidate. At 2026-11-02 00:40 UTC, Production homepage returned HTTP 200 but `GET /api/health` returned HTTP 500 `FUNCTION_INVOCATION_FAILED`.
- **Production configuration:** the connected Vercel environment inventory returned four Preview-only variables for `fix/zod-4-6-7-security` and `hiddenProductionEnvCount: 0`; no Production-targeted `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, or `APP_ORIGIN` entries were listed. The Preview secret values were not decrypted. The missing Production-targeted variables and PR #9's eager app import are consistent with the observed 500, but the exact runtime exception remains unconfirmed.
- **Logs:** the 7-day runtime error aggregation returned one warning group about legacy PostgreSQL SSL mode aliases (six occurrences across five users, latest 2026-11-01 00:55:47 UTC); it did not expose a function stack trace for the Production 500. The Hobby-plan runtime log API rejected a 1-hour query because that window exceeds its retention limit.
- **Not verified:** hosted authenticated sign-in/session persistence and `/api/me` remain blocked by Vercel deployment SSO; manual responsive and accessibility QA remains outstanding; email verification and password reset are not implemented.
- **Release gate:** keep Production unchanged. The owner must verify/configure the four Production variables using Production-only credentials and a least-privilege runtime DB role, then explicitly approve merge/deployment/migrations. Complete authenticated browser tests, two-tenant checks through the intended access path, responsive QA and keyboard/screen-reader accessibility review before release.
- No Production environment variable, deployment, protection, migration, merge, or Production database was changed during this audit.
