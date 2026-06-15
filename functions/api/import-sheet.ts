import type { Env } from "../types";
import { fetchSheet, SCHEMA_VERSION } from "@airbds/converter-tools";
import { metricForVersion } from "../metrics";
import { assembleImport } from "../import";
import { checkIngestGuards, storeEntry } from "../ingest";

// Import an AIRBDS assessment from a public Google Sheet. The browser can't fetch
// the sheet directly (Google's CSV export sends no CORS headers), so the fetch +
// conversion run here, server-side, then ingest through the same validation and
// storage path as the YAML upload route (functions/api/upload.ts).
//
// Request body (JSON): { url, review_date, initials?, affiliation? }.
//   url         — the sheet URL or id; must be shared "anyone with the link".
//   review_date — required; the spreadsheet template has no review-date field.
//   initials / affiliation — optional; stored when provided.
//
// Responses: 201 { ...entry, notices } on success; 422 { error, problems } when
// the sheet converted but is incomplete; 400 { error } when the sheet can't be
// fetched/parsed or the body is invalid; 429 when a guard trips.

const JSON_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Shared rate-limit + stored-entry-cap guards (see functions/ingest.ts).
  const guard = await checkIngestGuards(context.request, context.env);
  if (guard) return guard;

  let payload: unknown;
  try {
    payload = await context.request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  const body = (payload ?? {}) as Record<string, unknown>;

  const url = typeof body.url === "string" ? body.url.trim() : "";
  const reviewDate =
    typeof body.review_date === "string" ? body.review_date.trim() : "";
  if (!url) return json({ error: "A Google Sheet URL is required." }, 400);
  if (!reviewDate) return json({ error: "A review date is required." }, 400);

  const metric = metricForVersion(SCHEMA_VERSION);
  if (!metric) {
    return json(
      { error: `Metric version ${SCHEMA_VERSION} is not configured on the server.` },
      500
    );
  }

  // Fetch the two CSV tabs. Bad id, an un-shared sheet, or a non-template sheet
  // surface here as the converter's own (human-readable) error message.
  let sheet: { reviewCsv: string; questionsCsv: string };
  try {
    sheet = await fetchSheet(url);
  } catch (e) {
    return json(
      { error: e instanceof Error ? e.message : "Could not read the Google Sheet." },
      400
    );
  }

  // Convert + merge form fields + collect every problem.
  let outcome;
  try {
    outcome = assembleImport(
      sheet.reviewCsv,
      sheet.questionsCsv,
      {
        reviewDate,
        initials: typeof body.initials === "string" ? body.initials : undefined,
        affiliation:
          typeof body.affiliation === "string" ? body.affiliation : undefined,
      },
      metric
    );
  } catch (e) {
    return json(
      { error: e instanceof Error ? e.message : "Could not parse the sheet." },
      400
    );
  }

  if (!outcome.ok) {
    return json(
      {
        error: "The assessment is incomplete and was not imported.",
        problems: outcome.problems,
      },
      422
    );
  }

  const entry = await storeEntry(context.env, outcome.data);
  return json({ ...entry, notices: outcome.notices }, 201);
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
