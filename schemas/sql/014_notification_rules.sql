-- Notification rules for admin-configurable alerts

CREATE TABLE IF NOT EXISTS notification_rules (
  id           BIGSERIAL PRIMARY KEY,
  scope        TEXT NOT NULL DEFAULT 'system', -- system | user
  user_id      TEXT,                           -- when scope=user
  service      TEXT NOT NULL,                  -- e.g., adscenter|siterank|offer
  metric       TEXT NOT NULL,                  -- e.g., p95_latency_ms|error_rate|dlq_size
  comparator   TEXT NOT NULL DEFAULT 'gt',     -- gt|lt|ge|le|eq|ne
  threshold    DOUBLE PRECISION NOT NULL,      -- threshold value
  window_sec   INT NOT NULL DEFAULT 300,       -- evaluation window seconds
  enabled      BOOLEAN NOT NULL DEFAULT TRUE,
  params       JSONB NOT NULL DEFAULT '{}'::jsonb, -- extra dimensions (path, route, tag)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_notif_rules_service_metric ON notification_rules(service, metric) WHERE enabled;
CREATE INDEX IF NOT EXISTS ix_notif_rules_scope_user ON notification_rules(scope, user_id);

