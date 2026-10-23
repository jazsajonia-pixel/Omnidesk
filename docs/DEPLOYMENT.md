# Deployment

- **Hosting:** Vercel project `omnidesk`. The Vite build is served statically; `api/index.ts` is a single Node function that runs the Hono app. `vercel.json` rewrites `/api/*` to that function, falls back to `index.html` for client routes, and sets CSP/HSTS/caching headers.
- **Database:** Neon project "OmniDesk", main branch, pooled connection string.
- **Environment (Production):** `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `APP_ORIGIN`. See ENVIRONMENT.md.
- **Migrations:** run from a trusted machine before deploying schema changes: `DATABASE_URL=<pooled url> npx drizzle-kit migrate`. Migrations are additive; there are no destructive steps in 0000–0002.
- **Release flow:** pull request → CI (migrate on Postgres 16, typecheck, lint, tests, build) and Vercel preview → merge to `main` → Vercel production deploy.
- **Smoke test after deploy:** `GET /api/health` returns `{"status":"ok","database":true}`; the demo button opens a seeded workspace; sign-up → create workspace works.
- Imports inside `src/server` use explicit `.js` extensions so the function bundles as native ESM on Vercel.
