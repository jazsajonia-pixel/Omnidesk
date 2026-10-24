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
- Browser response headers: SPA routes receive CSP and HSTS from Vercel; API responses receive `X-Content-Type-Options`, `X-Frame-Options: DENY`, strict referrer policy, permissions policy and same-origin resource policy. API responses are `no-store` and emit HSTS when served over HTTPS.
- Demo workspaces use non-routable `.invalid` emails and are deleted after 24 hours.
- Secrets live only in server environment variables.

## Known limits
- No email verification or password reset yet (no email provider configured).
- Activity history is append-only by convention, not enforced at the database level.

## Concurrency on team changes
Role changes and member removal run in one transaction that locks the workspace row (`SELECT … FOR UPDATE` on `organization`), then re-reads both the actor's and the target's role before the last-owner check. Without this, two owners demoting each other or leaving at the same moment could both succeed and leave the workspace with no owner. Invitation acceptance claims the invitation with a single conditional `UPDATE … WHERE status = 'pending' AND expires_at > now() AND lower(email) = …` and inserts the membership with `ON CONFLICT DO NOTHING`, so opening the link twice can't join twice or return a server error. Covered by `operations.integration.test.ts`.
