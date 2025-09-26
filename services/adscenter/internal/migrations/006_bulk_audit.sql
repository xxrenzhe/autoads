-- Bulk action audit trail tables

CREATE TABLE IF NOT EXISTS "BulkActionOperation" (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  plan JSONB,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "BulkActionAudit" (
  id BIGSERIAL PRIMARY KEY,
  op_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL, -- before|after|rollback|other
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_bulk_audit_op ON "BulkActionAudit"(op_id, created_at);

