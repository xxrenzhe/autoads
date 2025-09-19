-- Partition ads_metrics_daily by month on MySQL 8+
-- Note: This ALTER rebuilds the table; schedule during low traffic windows on large datasets.
-- Partitions cover 2024-01 to 2027-12 plus MIN/MAX guards. Adjust future windows via follow-up migrations if needed.

-- NOTE: Partitioning by RANGE COLUMNS(date) requires that every UNIQUE key (incl. PRIMARY KEY)
-- contains the partitioning column(s). Current schema uses a single-column PRIMARY KEY (id),
-- and Prisma does not support autoincrement with composite primary keys. Therefore, applying
-- partitioning would fail with error 1503 in MySQL. This migration is intentionally a no-op to
-- keep history, and partitioning should be implemented in the future alongside a safe PK change
-- (e.g., (id, date)) when supported by tooling and scheduling allows.

-- No-op: keeping as placeholder for future partition strategy.
