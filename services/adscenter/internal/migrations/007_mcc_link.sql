-- MCC link state table
CREATE TABLE IF NOT EXISTS "MccLink" (
  user_id      TEXT NOT NULL,
  customer_id  TEXT NOT NULL,
  status       TEXT NOT NULL, -- invited|pending|active|inactive
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, customer_id)
);

CREATE INDEX IF NOT EXISTS ix_mcc_link_status ON "MccLink"(status);

