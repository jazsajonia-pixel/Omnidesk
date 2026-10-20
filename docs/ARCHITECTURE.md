# Architecture
Target: React + TypeScript + Vite frontend; Node.js + TypeScript REST API; Neon-compatible PostgreSQL with Drizzle and versioned migrations; maintained authentication with secure sessions; optional server-side Gemini; private S3-compatible storage adapter.

Resolve active organization from authenticated server-side session and membership. Every tenant-owned query/mutation must scope by organization and check role permissions. Never trust hidden navigation or client-supplied IDs. Intended flow: browser -> typed API -> auth middleware -> membership/permission guard -> validated service -> tenant-scoped database -> audit event -> safe response.

Current state: frontend shell only. API, database, auth/session handling, and storage adapters are not implemented.