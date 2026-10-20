# Environment configuration

Copy .env.example to .env for local work. Never commit real values.

## Frontend
- VITE_API_BASE_URL: reserved for a future explicit API client; same-origin /api is the default.

## Server only
- DATABASE_URL: PostgreSQL connection string. For hosted Neon, use the pooled endpoint so the small application pool does not exhaust database connections.
- BETTER_AUTH_SECRET: long, random secret; required outside local scaffolding.
- BETTER_AUTH_URL: canonical app URL in production; can be omitted locally if Better Auth infers the request URL.
- APP_ORIGIN: trusted browser origin, default http://localhost:5173.
- API_PORT: local API server port, default 4000.

Never prefix server secrets with VITE_. .env.example contains placeholders only.
