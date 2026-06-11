import type { D1Database } from "@cloudflare/workers-types";

export interface UploadEntry {
  id: string;
  timestamp: string;
  data: unknown;
}

export interface Env {
  DB: D1Database;

  // Cloudflare Access configuration for admin authentication (see auth.ts).
  // Non-secret identifiers, set in wrangler.toml [vars]:
  //   ACCESS_TEAM_DOMAIN — the team hostname, e.g. "myteam.cloudflareaccess.com"
  //   ACCESS_AUD         — the Access application's Audience (AUD) tag
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;

  // Local-development escape hatch. When set (only ever in a gitignored
  // .dev.vars, never in production), auth.ts treats every request as this admin
  // so the admin UI can be exercised under `wrangler pages dev`, where the
  // Cloudflare Access edge — and therefore the Access JWT — is absent.
  ACCESS_DEV_BYPASS?: string;
}

// Row shape as stored in D1 (data is JSON-encoded).
export interface EntryRow {
  id: string;
  timestamp: string;
  data: string;
}
