# OmniDesk

One workspace. Clearer operations.

OmniDesk is a multi-tenant SaaS operations platform. This repository is at the foundation stage: React/TypeScript workspace shell only, not a production-ready SaaS backend.

## Implemented foundation
- React, strict TypeScript, Vite, Tailwind, React Router, and Lucide setup
- Responsive overview and navigable module placeholders
- Honest empty states; no hardcoded business metrics
- Environment placeholders and secret-safe ignore rules

## Not implemented
Authentication, organization membership, tenant isolation, PostgreSQL schema/migrations, persisted CRM/projects/tasks, audit logs, file storage, AI, automations, billing, and automated tests.

## Local development
Requires Node.js 20+ and npm 10+. Run npm install, then npm run dev. Run npm run typecheck and npm run build before deployment. These commands have not been run in this session.

## Security
Do not use with real customer data. No backend authorization or tenant isolation exists yet. See docs/ for the architecture and security requirements.
