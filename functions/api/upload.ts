import type { UploadEntry, Env } from "../types";
import { parseAndValidate } from "../validation";

const API_KEY = "auto-airbds-dev-key";
const MAX_UPLOADS = 30;

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  if (context.request.headers.get("X-API-Key") !== API_KEY) {
    return new Response("Unauthorized", { status: 401 });
  }

  const countRow = await context.env.DB.prepare(
    "SELECT COUNT(*) AS count FROM entries"
  ).first<{ count: number }>();
  if ((countRow?.count ?? 0) >= MAX_UPLOADS) {
    return new Response("Upload limit reached", { status: 429 });
  }

  // Assessments are uploaded as YAML (or JSON — YAML is a superset). Read the
  // body as text and parse+validate it; reject anything that isn't a complete
  // assessment against a known metric version.
  let body: string;
  try {
    body = await context.request.text();
  } catch {
    return new Response("Could not read request body", { status: 400 });
  }

  const parsed = parseAndValidate(body);
  if (!parsed.ok) {
    return new Response(parsed.error, { status: parsed.status });
  }

  const entry: UploadEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    data: parsed.data,
  };

  await context.env.DB.prepare(
    "INSERT INTO entries (id, timestamp, data) VALUES (?, ?, ?)"
  )
    .bind(entry.id, entry.timestamp, JSON.stringify(entry.data))
    .run();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  return new Response(JSON.stringify(entry), { status: 201, headers });
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-API-Key",
    },
  });
};
