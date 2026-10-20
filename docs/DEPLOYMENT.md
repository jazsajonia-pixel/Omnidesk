# Deployment plan
Frontend: connect to Vercel or another static host, run npm ci and npm run build, configure SPA fallback for React Router, and set VITE_API_BASE_URL only after a backend exists.

Backend (not implemented): deploy API to a Node-compatible runtime, provision a dedicated Neon database, configure secrets in backend environment, apply migrations, configure HTTPS/origins/cookies/rate limits/logging/backups, then verify tenant isolation before inviting users. No live deployment is claimed.