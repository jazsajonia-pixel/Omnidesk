# Security requirements and status

## Implemented in this checkpoint
- Better Auth owns password hashing and session handling; no custom password/JWT implementation.
- Organization membership is checked on the server using the authenticated user ID and active organization stored in the session.
- Customer list queries filter by the resolved organization ID; customer creation ignores client-supplied organization IDs and uses the server-resolved tenant.
- Zod rejects unexpected customer fields and validates payload sizes/formats.
- A PostgreSQL-backed CI integration test verifies two workspaces cannot read each other's customer records and rejects client-supplied organization IDs.
- Secrets are server-side environment variables only.

## Still required before production
- Apply migration to a disposable Neon database and test the hosted pooled connection.
- Manually test sign-up/sign-in/session expiry and organization onboarding.
- Add role permission tests, audit events, CSRF/origin review, rate limits, security headers, structured safe logs, invitation abuse controls, and dependency advisory remediation.
- Implement customer update/archive and other module endpoints with tenant scope.
- Do not use with real customer data until integration checks pass.
