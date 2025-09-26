-- Generic audit events for Adscenter
CREATE TABLE IF NOT EXISTS "AuditEvent" (
  id         BIGSERIAL PRIMARY KEY,
  user_id    TEXT NOT NULL,
  kind       TEXT NOT NULL,
  data       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_audit_event_user_kind_time ON "AuditEvent"(user_id, kind, created_at DESC);

