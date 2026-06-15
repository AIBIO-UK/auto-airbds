import type { Env } from "../types";
import { parseAndValidate, MAX_UPLOAD_BYTES } from "../validation";
import { checkIngestGuards, storeEntry } from "../ingest";

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Reject oversized uploads up front (before buffering the body or touching
  // D1), when the client declares the size. The body length is also checked
  // after reading, in case Content-Length is missing or wrong.
  const declaredSize = Number(context.request.headers.get("Content-Length"));
  if (Number.isFinite(declaredSize) && declaredSize > MAX_UPLOAD_BYTES) {
    return new Response(`Upload too large (max ${MAX_UPLOAD_BYTES / 1024} KB)`, {
      status: 413,
    });
  }

  // Shared rate-limit + stored-entry-cap guards (see functions/ingest.ts).
  const guard = await checkIngestGuards(context.request, context.env);
  if (guard) return guard;

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

  const entry = await storeEntry(context.env, parsed.data);

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
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
};
