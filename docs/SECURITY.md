# Security requirements and status

## Implemented in this checkpoint
- Better Auth owns password hashing and session handling; no custom password/JWT implementation.
- Organization membership is checked on the server using the authenticated user ID and active organization stored in the session.
- Customer list, search, detail, create, update, archive, and restore operations are scoped to the resolved organization ID.
- Customer creation rejects unexpected fields and ignores no tenant field: client-supplied organizationId is rejected by strict Zod validation.
- Dashboard customer counts are tenant-scoped and exclude archived records.
- PostgreSQL-backed CI integration tests verify two workspaces cannot read each other's customer records and test archive/restore behavior.
- API and auth responses receive conservative security headers: nosniff, frame denial, strict-origin referrer policy, restricted browser capabilities, same-origin resource policy, and no-store caching.
- Secrets are server-side environment variables only.

## Still required before production
- Apply migrations to a disposable Neon database and verify the hosted pooled connection.
- Manually test sign-up/sign-in/session expiry and organization onboarding in a browser.
- Add role permission tests, audit events, CSRF/origin review, rate limits, structured safe logs, invitation abuse controls, and dependency advisory remediation.
- Do not use with real customer data until hosted database and production security checks pass.
