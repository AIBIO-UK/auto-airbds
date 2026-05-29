import airbds03 from "./airbds-0.3.yaml";

export interface QuestionMeta {
  /** Broad category, broader than theme (e.g. Infrastructure, Metadata). */
  scope: string;
  theme: string;
  grade: string;
  text: string;
}

export type QuestionMap = Record<string, QuestionMeta>;

interface MetricDefinition {
  questions: QuestionMap;
  /** Full points awarded for a "Yes" answer, keyed by grade. */
  gradePoints: Record<string, number>;
}

// Registry of known AIRBDS metric versions → definitions, keyed by the version
// string found in an assessment's `metric.version`. Add a new
// `airbds-<version>.yaml`, import it here, and register it to support a version.
const REGISTRY: Record<string, MetricDefinition> = {
  "0.3": parseMetric(airbds03, "airbds-0.3.yaml"),
};

/** Look up the fixed theme/grade for a question in a given metric version. */
export function questionMeta(
  version: string | null | undefined,
  questionId: string | null | undefined
): QuestionMeta | null {
  if (!version || !questionId) return null;
  return REGISTRY[version]?.questions[questionId] ?? null;
}

/**
 * Compute a question's score from its grade and answer, per the metric
 * version: a "Yes" earns the full points for the question's grade, a "No"
 * scores 0. Returns null when the version, question, answer, or grade points
 * are unknown, so callers can fall back.
 */
export function questionScore(
  version: string | null | undefined,
  questionId: string | null | undefined,
  answer: string | null | undefined
): number | null {
  if (!version || !questionId) return null;
  const def = REGISTRY[version];
  const meta = def?.questions[questionId];
  if (!def || !meta) return null;
  if (answer === "No") return 0;
  if (answer === "Yes") return def.gradePoints[meta.grade] ?? null;
  return null;
}

/**
 * The maximum achievable score for a metric version: the sum of every
 * question's full points, i.e. the total if every answer were "Yes". Returns
 * null when the version is unknown.
 */
export function maxScore(version: string | null | undefined): number | null {
  if (!version) return null;
  const def = REGISTRY[version];
  if (!def) return null;
  let total = 0;
  for (const q of Object.values(def.questions)) {
    total += def.gradePoints[q.grade] ?? 0;
  }
  return total;
}

/** Whether question definitions are available for the given metric version. */
export function hasMetricVersion(version: string | null | undefined): boolean {
  return !!version && version in REGISTRY;
}

/**
 * Validate and normalise a parsed metric YAML file into a definition. Throws
 * at load time if the file is malformed, so a bad definition fails loudly
 * rather than silently dropping questions or mis-scoring.
 */
function parseMetric(raw: unknown, source: string): MetricDefinition {
  if (!isRecord(raw) || !isRecord(raw.questions)) {
    throw new Error(`Invalid metric file ${source}: expected a "questions" map`);
  }
  if (!isRecord(raw.grade_points)) {
    throw new Error(
      `Invalid metric file ${source}: expected a "grade_points" map`
    );
  }

  const gradePoints: Record<string, number> = {};
  for (const [grade, points] of Object.entries(raw.grade_points)) {
    if (typeof points !== "number" || !Number.isFinite(points)) {
      throw new Error(
        `Invalid metric file ${source}: grade "${grade}" needs a numeric point value`
      );
    }
    gradePoints[grade] = points;
  }

  const questions: QuestionMap = {};
  for (const [id, value] of Object.entries(raw.questions)) {
    if (
      !isRecord(value) ||
      typeof value.scope !== "string" ||
      typeof value.theme !== "string" ||
      typeof value.grade !== "string" ||
      typeof value.text !== "string"
    ) {
      throw new Error(
        `Invalid metric file ${source}: question "${id}" needs string scope, theme, grade and text`
      );
    }
    if (!(value.grade in gradePoints)) {
      throw new Error(
        `Invalid metric file ${source}: question "${id}" has grade "${value.grade}" with no grade_points entry`
      );
    }
    questions[id] = {
      scope: value.scope,
      theme: value.theme,
      grade: value.grade,
      text: value.text,
    };
  }

  return { questions, gradePoints };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
