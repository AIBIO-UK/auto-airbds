import airbds03 from "./airbds-0.3.yaml";

export interface QuestionMeta {
  theme: string;
  grade: string;
}

export type QuestionMap = Record<string, QuestionMeta>;

// Registry of known AIRBDS metric versions → question definitions, keyed by
// the version string found in an assessment's `metric.version`. Add a new
// `airbds-<version>.yaml`, import it here, and register it to support a version.
const REGISTRY: Record<string, QuestionMap> = {
  "0.3": parseMetric(airbds03, "airbds-0.3.yaml"),
};

/** Look up the fixed theme/grade for a question in a given metric version. */
export function questionMeta(
  version: string | null | undefined,
  questionId: string | null | undefined
): QuestionMeta | null {
  if (!version || !questionId) return null;
  return REGISTRY[version]?.[questionId] ?? null;
}

/** Whether question definitions are available for the given metric version. */
export function hasMetricVersion(version: string | null | undefined): boolean {
  return !!version && version in REGISTRY;
}

/**
 * Validate and normalise a parsed metric YAML file into a question map.
 * Throws at load time if the file is malformed, so a bad definition fails
 * loudly rather than silently dropping questions.
 */
function parseMetric(raw: unknown, source: string): QuestionMap {
  if (!isRecord(raw) || !isRecord(raw.questions)) {
    throw new Error(`Invalid metric file ${source}: expected a "questions" map`);
  }
  const map: QuestionMap = {};
  for (const [id, value] of Object.entries(raw.questions)) {
    if (
      !isRecord(value) ||
      typeof value.theme !== "string" ||
      typeof value.grade !== "string"
    ) {
      throw new Error(
        `Invalid metric file ${source}: question "${id}" needs string theme and grade`
      );
    }
    map[id] = { theme: value.theme, grade: value.grade };
  }
  return map;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
