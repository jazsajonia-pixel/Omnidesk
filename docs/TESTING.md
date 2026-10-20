# Testing strategy and status
Required coverage: auth/session lifecycle; centralized role matrix; cross-tenant read/write denial with two organizations; CRM CRUD; project/task state and assignments; dashboard query correctness; usage limits; automation idempotency/loop safeguards; AI unavailable/error/quota paths; file authorization and CSV escaping.

Scripts: npm run typecheck, npm run lint, npm run build. They have not been run in this environment. No test script or test suite exists yet. Do not report checks as passing until executed.