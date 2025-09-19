DB Operations Best Practices (MySQL)

- Ownership & Responsibilities
  - Prisma owns DDL (migrations) and default data (seed). Application (Go) writes runtime business data only.
  - Production startup: skip Go seed (GO_SEED_ON_START=false) and enforce strict read-only (GO_SEED_STRICT_READONLY=true).

- Privileges (Least privilege)
  - CI/Deploy account: DDL + DML to run `prisma migrate deploy` + `prisma db seed`.
  - App runtime account: DML only (SELECT/INSERT/UPDATE/DELETE). Avoid CREATE/ALTER/DROP. If needed, separate read-only for SSR.

- Migrations & Seed
  - All schema changes via Prisma migrations; no ad-hoc SQL in code.
  - Default data via Prisma seed (idempotent upsert). Any change to defaults → update seed + add unique constraints.
  - Use `prisma validate` + CI `db-check.js` to fail fast on PR.

- Partitioning & Large Tables
  - ads_metrics_daily: partitioned by month (MySQL 8+) with forward partitions. Extend via follow-up migrations yearly.
  - Heavy ALTER (partitioning/index) during low traffic windows; prefer online DDL (ALGORITHM=INPLACE, LOCK=NONE) where possible.

- Observability
  - CI Summary: show latest migration, seed summary, key table counts.
  - Monitor slow queries; add covering indexes as needed.

- Backups & Recovery
  - Regular backups and PITR drills. Validate restore + migrate + seed replay in a staging environment.

