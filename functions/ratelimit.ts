import type { D1Database } from "@cloudflare/workers-types";

// Per-IP upload rate limiting backed by the D1 `rate_limit` table. The upload
// endpoint is public (no API key), so this is the main abuse control.
//
// We never store a raw IP: each client IP is hashed (salted SHA-256) before use,
// so the database holds only opaque hashes, and rows are pruned to the active
// window — keeping the privacy footprint and table size small.
//
// Limit: at most MAX_PER_WINDOW accepted uploads per IP per WINDOW_MS. Both are
// exported so tests track them; tune them here.
export const WINDOW_MS = 60 * 60 * 1000; // 1 hour
export const MAX_PER_WINDOW = 20;

// A fixed salt so stored hashes aren't a bare SHA-256 of the IP. It only needs
// to be non-public to slow correlation; move it to a secret for stronger
// guarantees.
const IP_SALT = "auto-airbds-rate-limit-v1";

/** Salted SHA-256 of an IP, hex-encoded. */
export async function hashIp(ip: string): Promise<string> {
  const bytes = new TextEncoder().encode(IP_SALT + ip);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Record an upload for `ipHash` and report whether it is within the per-IP rate
 * limit. Prunes rows outside the window first (keeping the table small), counts
 * this IP's uploads in the window, and — if under the limit — records this one.
 * Returns true when the upload is allowed, false when the limit is reached.
 */
export async function allowUpload(
  db: D1Database,
  ipHash: string,
  nowMs: number
): Promise<boolean> {
  const windowStart = new Date(nowMs - WINDOW_MS).toISOString();

  // Drop expired rows so the table only ever holds the current window.
  await db
    .prepare("DELETE FROM rate_limit WHERE created_at <= ?")
    .bind(windowStart)
    .run();

  const row = await db
    .prepare(
      "SELECT COUNT(*) AS count FROM rate_limit WHERE ip_hash = ? AND created_at > ?"
    )
    .bind(ipHash, windowStart)
    .first<{ count: number }>();
  if ((row?.count ?? 0) >= MAX_PER_WINDOW) return false;

  await db
    .prepare("INSERT INTO rate_limit (ip_hash, created_at) VALUES (?, ?)")
    .bind(ipHash, new Date(nowMs).toISOString())
    .run();
  return true;
}
