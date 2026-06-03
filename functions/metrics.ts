// Server-side metric descriptor for upload validation.
//
// The Pages Functions bundle has no YAML loader (unlike the Vite frontend, which
// imports the full metric files from src/metrics/), so we cannot import the
// metric YAML here. The upload validator only needs to know, per metric version,
// the set of question ids that must be answered — that minimal data lives here.
//
// This MUST stay in sync with the metric definitions in src/metrics/. A unit
// test (functions/metrics.test.ts) asserts these ids match the YAML, so the two
// cannot silently drift.

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
