# Deployment plan

- Target: Vercel for the Vite frontend and Hono API function, Neon PostgreSQL for data, using its pooled connection endpoint with the node-postgres driver.
- Install dependencies with npm install and build with npm run build. CI also runs typecheck, lint, tests, and build.
- Configure DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL, and APP_ORIGIN as server/environment variables in Vercel. Never add secrets to VITE-prefixed variables or commit production credentials.
- Apply and verify migrations against a disposable Neon branch before production.
- The current checkpoint is not production-ready: CI has not yet been observed passing, authentication flows and migrations are not verified, and cross-tenant integration tests remain required.
- Do not deploy with real customer data until Phase 2 security acceptance criteria pass.
