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


## Missing configuration behavior

- The API health endpoint is a readiness check: if any of the four required server variables above is missing, or the database cannot answer `SELECT 1`, it returns HTTP 503 with `status: "not_ready"` rather than reporting the service as healthy.
- In a Vercel production runtime, the API handler checks configuration before importing authentication/database modules. If configuration is incomplete, API routes return a generic 503 response; they do not fall back to memory-backed authentication.
- The response intentionally does not reveal which variable is missing. Fix the Production environment in Vercel and redeploy only through the approved release process.
