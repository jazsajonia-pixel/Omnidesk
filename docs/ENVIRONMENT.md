# Environment configuration

Copy `.env.example` to `.env` for local work. Never commit real values.

## Server only
- `DATABASE_URL` — PostgreSQL connection string. On Neon use the **pooled** endpoint.
- `BETTER_AUTH_SECRET` — long random secret (`openssl rand -base64 32`). Required in production.
- `BETTER_AUTH_URL` — canonical app URL, e.g. `https://omnidesk-blond.vercel.app`.
- `APP_ORIGIN` — trusted browser origin(s), comma-separated. Defaults to `http://localhost:5173`. On Vercel, `VERCEL_URL`, `VERCEL_BRANCH_URL` and `VERCEL_PROJECT_PRODUCTION_URL` are trusted automatically so preview deployments work.
- `API_PORT` — local API port, default 4000.
- `DEMO_ENABLED` — set to `false` to turn off `POST /api/demo`. Default on.
- `DISABLE_RATE_LIMIT` — `true` disables auth rate limiting. Local QA only; never set in production.

## Frontend
- `VITE_API_BASE_URL` — reserved; the app calls same-origin `/api`.

Never prefix server secrets with `VITE_`.
