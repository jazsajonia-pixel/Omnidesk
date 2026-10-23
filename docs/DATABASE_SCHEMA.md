# Database schema

Drizzle schema: `src/server/db/schema.ts`. Migrations:
- `0000_omnidesk_foundation.sql` — auth, organizations, members, invitations, customers.
- `0001_customers_archive.sql` — customer soft archive.
- `0002_operations_suite.sql` — customer phone/status; `rate_limit`, `customer_notes`, `projects`, `tasks`, `documents`, `activity`.

Every tenant-owned table has `organization_id` (cascade on organization delete) and indexes that start with it. Tasks keep an integer `position` per status column; moves re-sequence the column in one transaction. Applied to CI Postgres 16 and to Neon.
