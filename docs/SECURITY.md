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
