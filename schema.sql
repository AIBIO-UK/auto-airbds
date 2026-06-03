-- D1 schema for auto-airbds uploads.
-- Apply locally:  npx wrangler d1 execute auto-airbds --local --file=./schema.sql
-- Apply remotely: npx wrangler d1 execute auto-airbds --remote --file=./schema.sql

CREATE TABLE IF NOT EXISTS entries (
  id        TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  data      TEXT NOT NULL  -- JSON-encoded UploadEntry.data
);

CREATE INDEX IF NOT EXISTS idx_entries_timestamp ON entries (timestamp);

-- Per-IP upload rate limiting. One row per accepted upload, keyed by a salted
-- SHA-256 hash of the client IP (never the raw IP). Rows outside the rate-limit
-- window are pruned on each upload, so this table stays small and short-lived.
CREATE TABLE IF NOT EXISTS rate_limit (
  ip_hash    TEXT NOT NULL,
  created_at TEXT NOT NULL  -- ISO 8601
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_ip ON rate_limit (ip_hash, created_at);
