# Security

## In place
- Better Auth handles password hashing and sessions (httpOnly, secure cookies in production). No custom crypto.
- Every tenant query is scoped to the organization resolved from the session and verified membership; `organizationId` is never taken from the request body (strict Zod schemas reject unknown fields).
- Central role matrix (`src/server/permissions.ts`): viewer < member < manager < admin < owner. Admins can't manage owners/admins; the last owner can't be demoted or leave.
- Cross-references are validated inside the tenant: project → customer, task → project/assignee, document → project.
- Mutating `/api` requests must come from a trusted origin (CSRF defence in addition to SameSite cookies).
- Auth rate limiting stored in PostgreSQL (works across serverless instances); stricter limits on sign-in/sign-up. Demo creation is limited per IP and globally.
- Invitations are bound to the invited email address, expire after 7 days, and can be cancelled.
- CSV exports escape quotes/newlines and neutralise formula prefixes (`= + - @`, tab, CR).
- Markdown is rendered as React elements (no `dangerouslySetInnerHTML`); links allow only http(s) and mailto.
- Headers: CSP (`script-src 'self'`), HSTS, `X-Content-Type-Options`, `X-Frame-Options: DENY`/`frame-ancestors 'none'`, strict referrer policy, permissions policy; API responses are `no-store`.
- Demo workspaces use non-routable `.invalid` emails and are deleted after 24 hours.
- Secrets live only in server environment variables.

## Known limits
- No email verification or password reset yet (no email provider configured).
- Activity history is append-only by convention, not enforced at the database level.

## Concurrency on team changes
Role changes and member removal run in one transaction that locks the workspace row (`SELECT … FOR UPDATE` on `organization`), then re-reads both the actor's and the target's role before the last-owner check. Without this, two owners demoting each other or leaving at the same moment could both succeed and leave the workspace with no owner. Invitation acceptance claims the invitation with a single conditional `UPDATE … WHERE status = 'pending' AND expires_at > now() AND lower(email) = …` and inserts the membership with `ON CONFLICT DO NOTHING`, so opening the link twice can't join twice or return a server error. Covered by `operations.integration.test.ts`.


## Dependency audit checkpoint (2026-10-25)

- Upgraded the direct `zod` dependency from 3.25.76 to 4.6.7 to address [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), a high-severity uncontrolled resource-consumption issue affecting versions before 4.6.6. Zod 4.6.7 is the current patched release verified for this change.
- The 2026-10-24 CI audit reported four moderate advisories in the `drizzle-kit` → deprecated `@esbuild-kit/esm-loader` → `@esbuild-kit/core-utils` → nested `esbuild@0.18.20` dependency chain. A scoped npm override now resolves that nested `esbuild` dependency to the already-used `0.25.12` release, patched for GHSA-67mh-4wv8-2f99; the lockfile removes the obsolete nested 0.18.20 platform packages. Do not use `npm audit fix --force`, which suggested downgrading `drizzle-kit` to 0.18.1.
- GitHub Actions run [40147884596](https://github.com/jazsajonia-pixel/Omnidesk/actions/runs/40147884596) verified the override: the audit summary reported 0 vulnerabilities (0 low, moderate, high, or critical), and `npm audit --audit-level=moderate` passed. The same run passed PostgreSQL 16 migrations, typecheck, lint, 25 tests across 7 files, and the production build. CI now fails on moderate or higher advisories.
