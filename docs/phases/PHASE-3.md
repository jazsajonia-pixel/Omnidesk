# Phase 3 — Dashboard and CRM

## Implemented
- Tenant-scoped customer list/detail/create/update endpoints.
- Soft archive/restore lifecycle; no destructive hard delete.
- Search by name/email/company and bounded page/page-size pagination.
- Active and archived customer filters.
- Customer-management UI with add/edit forms, archive confirmation, restore action, loading/error/empty/success states, and responsive layouts.
- Dashboard active-customer count from a tenant-scoped PostgreSQL query; project/task metrics remain blank until those modules exist.
- PostgreSQL-backed integration test verifies search, pagination, customer lifecycle, dashboard counts, and cross-tenant isolation.

## Remaining
- [ ] Verify customer and dashboard screens in a browser on phone and desktop.
- [ ] Verify against a disposable Neon pooled connection.
- [ ] Add customer contacts, notes, and relationship history.
- [ ] Build persisted projects/tasks before calculating those dashboard metrics.
- [ ] Add audit events and role-permission tests.
