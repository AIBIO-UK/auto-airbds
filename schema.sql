-- D1 schema for auto-airbds uploads.
-- Apply locally:  npx wrangler d1 execute auto-airbds --local --file=./schema.sql
-- Apply remotely: npx wrangler d1 execute auto-airbds --remote --file=./schema.sql

CREATE TABLE IF NOT EXISTS entries (
  id        TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  data      TEXT NOT NULL  -- JSON-encoded UploadEntry.data
);

CREATE INDEX IF NOT EXISTS idx_entries_timestamp ON entries (timestamp);
