import type { D1Database } from "@cloudflare/workers-types";

export interface UploadEntry {
  id: string;
  timestamp: string;
  data: unknown;
}

export interface Env {
  DB: D1Database;
}

// Row shape as stored in D1 (data is JSON-encoded).
export interface EntryRow {
  id: string;
  timestamp: string;
  data: string;
}
