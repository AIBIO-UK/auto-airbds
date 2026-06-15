import type { Env, UploadEntry } from "./types";
import { allowUpload, hashIp } from "./ratelimit";

// Hard cap on stored assessments. Shared by every ingest route (YAML upload and
// Google Sheet import) so the limit can't drift between them.
export const MAX_UPLOADS = 50;

/**
 * Pre-flight guards shared by the public ingest routes: a per-IP rate limit and
 * the stored-entry cap. Returns a Response to send back when a guard trips, or
 * null when the request may proceed.
 *
 * The endpoints are public (no API key), so the per-IP rate limit is the abuse
 * control. CF-Connecting-IP is absent under local `wrangler pages dev`, so all
 * local requests share one bucket.
 */
export async function checkIngestGuards(
  request: Request,
  env: Env
): Promise<Response | null> {
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const ipHash = await hashIp(ip);
  if (!(await allowUpload(env.DB, ipHash, Date.now()))) {
    return new Response("Rate limit exceeded, please try again later", {
      status: 429,
    });
  }

  const countRow = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM entries"
  ).first<{ count: number }>();
  if ((countRow?.count ?? 0) >= MAX_UPLOADS) {
    return new Response("Upload limit reached", { status: 429 });
  }

  return null;
}

/**
 * Store a validated assessment payload as a new entry and return it. Both the
 * YAML upload route and the Google Sheet import route store through here so they
 * share one insert path and row shape.
 */
export async function storeEntry(env: Env, data: unknown): Promise<UploadEntry> {
  const entry: UploadEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    data,
  };

  await env.DB.prepare(
    "INSERT INTO entries (id, timestamp, data) VALUES (?, ?, ?)"
  )
    .bind(entry.id, entry.timestamp, JSON.stringify(entry.data))
    .run();

  return entry;
}
