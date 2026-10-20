# Security requirements and status

## Implemented in this checkpoint
- Better Auth owns password hashing and session handling; no custom password/JWT implementation.
- Organization membership is checked on the server using the authenticated user ID and active organization stored in the session.
- Customer list queries filter by the resolved organization ID; customer creation ignores client-supplied organization IDs and uses the server-resolved tenant.
- Zod rejects unexpected customer fields and validates payload sizes/formats.
- Secrets are server-side environment variables only.

## Still required before production
- Run and inspect CI; verify the installed Better Auth schema/plugin contract.
- Apply migration in a disposable database and test sign-up/sign-in/session expiry.
- Add integration tests for two-tenant data isolation and role-based destructive actions.
- Add CSRF/origin review, rate limits, security headers, structured safe logs, audit events, invitation abuse controls, and dependency auditing.
- Implement customer update/archive and other module endpoints with tenant scope.
- Do not use with real customer data until integration checks pass.
