import { parse as parseYaml } from "yaml";
import { questionIdsForVersion } from "./metrics";

// Assessments are uploaded as YAML (a superset of JSON, so JSON bodies parse
// too) in the shape of the AIRBDS review template: a top-level `schema_version`,
// `reviewer`, `dataset`, and an `answers` map keyed by question id. See
// scripts/example-assessment-1.yaml for a filled example.
//
// Uploads are untrusted, so parsing is hardened against the usual YAML abuse:
//   - oversized bodies: capped before parsing (MAX_BODY_CHARS) -> 413.
//   - "billion laughs" / alias bombs: maxAliasCount makes the parser throw long
//     before the aliases expand; the throw is caught below -> 400.
//   - deeply nested input (stack exhaustion): the parser throws, caught -> 400,
//     and a Workers isolate contains it to the one request anyway.
//   - prototype pollution: the `yaml` parser sets a `__proto__` key as an inert
//     own property, never on Object.prototype, so it cannot pollute globals.
//   - code execution / deserialization gadgets: the JS `yaml` parser only ever
//     produces plain data and never instantiates objects or runs code, so there
//     is no PyYAML-style RCE; unknown/custom tags resolve to plain values.
// logLevel "silent" keeps a crafted upload (e.g. unknown tags) from flooding the
// Worker logs with parser warnings.

// Cap the body before parsing so an oversized upload can't tie up the worker.
const MAX_BODY_CHARS = 256 * 1024;
// Bound YAML anchor/alias expansion to defuse "billion laughs" style payloads.
const MAX_ALIAS_COUNT = 100;

export type ParseResult =
  | { ok: true; data: unknown }
  | { ok: false; status: number; error: string };

/**
 * Parse an uploaded assessment body (YAML or JSON) and validate that it is a
 * complete assessment against a known metric version. Returns the parsed data
 * on success, or an HTTP status + human-readable reason on failure so the
 * caller can reject the upload.
 */
export function parseAndValidate(text: string): ParseResult {
  if (text.length > MAX_BODY_CHARS) {
    return { ok: false, status: 413, error: "Upload too large" };
  }

  let data: unknown;
  try {
    data = parseYaml(text, {
      maxAliasCount: MAX_ALIAS_COUNT,
      logLevel: "silent",
    });
  } catch {
    return { ok: false, status: 400, error: "Invalid YAML/JSON body" };
  }

  const error = validateAssessment(data);
  if (error) return { ok: false, status: 400, error };

  return { ok: true, data };
}

/**
 * Validate a parsed assessment. Returns null when it is complete and scorable,
 * or a human-readable reason for the first problem found. An assessment is
 * complete when it names a known metric version, identifies who reviewed what
 * (reviewer name + date, dataset name + url), and gives a "Yes"/"No" answer for
 * every question in that metric version. Extra/unknown answer keys are ignored.
 */
export function validateAssessment(data: unknown): string | null {
  if (!isRecord(data)) return "Assessment must be a mapping";

  const version =
    typeof data.schema_version === "string" ? data.schema_version : null;
  if (!version) return 'Missing or invalid "schema_version"';
  const ids = questionIdsForVersion(version);
  if (!ids) return `Unknown metric version "${version}"`;

  const reviewer = isRecord(data.reviewer) ? data.reviewer : null;
  if (!nonEmptyString(reviewer?.name)) return 'Missing "reviewer.name"';
  if (!nonEmptyString(reviewer?.review_date))
    return 'Missing "reviewer.review_date"';

  const dataset = isRecord(data.dataset) ? data.dataset : null;
  if (!nonEmptyString(dataset?.name)) return 'Missing "dataset.name"';
  if (!nonEmptyString(dataset?.url)) return 'Missing "dataset.url"';

  const answers = isRecord(data.answers) ? data.answers : null;
  if (!answers) return 'Missing "answers"';
  for (const id of ids) {
    const entry = answers[id];
    if (!isRecord(entry)) return `Missing answer for ${id}`;
    if (entry.answer !== "Yes" && entry.answer !== "No") {
      return `Answer for ${id} must be "Yes" or "No"`;
    }
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function nonEmptyString(value: unknown): boolean {
  return typeof value === "string" && value.trim() !== "";
}
