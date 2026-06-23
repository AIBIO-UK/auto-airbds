// Server-side metric descriptor for upload validation.
//
// The Pages Functions bundle has no YAML loader (unlike the Vite frontend, which
// imports the full metric files from src/metrics/), so we cannot import the
// metric YAML here. The upload validator only needs to know, per metric version,
// the set of question ids that must be answered (and which of those are
// Ethics-scope) — that minimal data lives here.
//
// This MUST stay in sync with the metric definitions in src/metrics/. A unit
// test (functions/metrics.test.ts) asserts these ids — both the full question
// list and the Ethics subset — match the YAML, so the two cannot silently drift.

import type { Metric } from "@airbds/converter-tools";

export const METRIC_QUESTION_IDS: Record<string, readonly string[]> = {
  "0.3": [
    "ACM-1",
    "ACM-2",
    "ACM-3",
    "ACM-4",
    "ACM-5",
    "ACM-6",
    "ACM-7",
    "ACM-8",
    "ACM-9",
    "ACM-10",
    "ACM-11",
    "ACM-12",
    "ACM-13",
    "ACM-14",
    "ACM-15",
    "ACM-16",
    "ACM-17",
    "ACM-18",
    "ACM-19",
    "ACM-20",
    "ACM-21",
    "ACM-22",
    "ACM-23",
    "ACM-24",
    "ACM-25",
    "ACM-26",
    "ACM-27",
    "ACM-28",
  ],
  "0.4": [
    "ABC-01",
    "ABC-02",
    "ABC-03",
    "ABC-04",
    "ABC-05",
    "ABC-06",
    "ABC-07",
    "ABC-08",
    "ABC-09",
    "ABC-10",
    "ABC-11",
    "ABC-12",
    "ABC-13",
    "ABC-14",
    "ABC-15",
    "ABC-16",
    "ABC-17",
    "ABC-18",
    "ABC-19",
    "ABC-20",
    "ABC-21",
    "ABC-22",
    "ABC-23",
    "ABC-24",
    "ABC-25",
    "ABC-26",
    "ABC-27",
  ],
};

// The Ethics-scope question ids per metric version (scope: Ethics in the YAML).
// The converter marks these answers with `not_applicable`, so a Google Sheet
// import needs to know which ids are Ethics — see metricForVersion below.
export const METRIC_ETHICS_IDS: Record<string, readonly string[]> = {
  "0.3": ["ACM-24", "ACM-25", "ACM-26", "ACM-27", "ACM-28"],
  "0.4": ["ABC-24", "ABC-25", "ABC-26", "ABC-27"],
};

/**
 * The question ids that must be answered for a given metric version, or null if
 * the version is unknown (and so cannot be scored or validated for completeness).
 */
export function questionIdsForVersion(
  version: string | null | undefined
): readonly string[] | null {
  if (!version) return null;
  return METRIC_QUESTION_IDS[version] ?? null;
}

/**
 * Build the converter's `Metric` (ordered question ids + the Ethics-scope set)
 * for a metric version, or null if the version is unknown. This lets the Google
 * Sheet import route drive `@airbds/converter-tools` without parsing the metric
 * YAML in the Functions bundle (which has no YAML loader).
 */
export function metricForVersion(
  version: string | null | undefined
): Metric | null {
  const questionIds = questionIdsForVersion(version);
  if (!version || !questionIds) return null;
  return {
    questionIds: [...questionIds],
    ethicsIds: new Set(METRIC_ETHICS_IDS[version] ?? []),
  };
}
