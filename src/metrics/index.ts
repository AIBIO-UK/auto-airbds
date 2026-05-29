import airbds03 from "./airbds-0.3.yaml";

export interface QuestionMeta {
  /** Broad category, broader than theme (e.g. Infrastructure, Metadata). */
  scope: string;
  theme: string;
  grade: string;
  text: string;
}

export type QuestionMap = Record<string, QuestionMeta>;

interface GradeThreshold {
  name: string;
  description: string;
  /** Minimum proportion of "Yes" answers required per grade category. */
  minProportionYes: Record<string, number>;
  /** Minimum total score required. */
  minScore: number;
}

interface MetricDefinition {
  questions: QuestionMap;
  /** Full points awarded for a "Yes" answer, keyed by grade. */
  gradePoints: Record<string, number>;
  /** Grading thresholds, ordered highest grade first. */
  grading: GradeThreshold[];
}

export interface GradeResult {
  name: string;
  description: string;
}

/** A single question's answer, as needed to compute a grade. */
export interface AnswerInput {
  questionId: string | null;
  answer: string | null;
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

/**
 * The full points a question can earn (its grade's points), i.e. the score
 * for a "Yes" answer. Returns null when the version or question is unknown.
 */
export function questionMaxScore(
  version: string | null | undefined,
  questionId: string | null | undefined
): number | null {
  if (!version || !questionId) return null;
  const def = REGISTRY[version];
  const meta = def?.questions[questionId];
  if (!def || !meta) return null;
  return def.gradePoints[meta.grade] ?? null;
}

/**
 * Determine the grade for a set of answers using the metric version's grading
 * thresholds: the dataset earns the highest grade for which the proportion of
 * "Yes" answers in every grade category is at least the required minimum (>=)
 * and the total score is at least the required minimum. Proportions use the
 * metric's full question counts as denominators, so a missing answer counts
 * against the proportion. Returns null when the version or grading is unknown.
 */
export function computeGrade(
  version: string | null | undefined,
  answers: AnswerInput[]
): GradeResult | null {
  if (!version) return null;
  const def = REGISTRY[version];
  if (!def || def.grading.length === 0) return null;

  const answerById = new Map<string, string | null>();
  for (const a of answers) {
    if (a.questionId) answerById.set(a.questionId, a.answer);
  }

  // Count questions and "Yes" answers per grade category, and total the score.
  const totalByGrade: Record<string, number> = {};
  const yesByGrade: Record<string, number> = {};
  let score = 0;
  for (const [id, q] of Object.entries(def.questions)) {
    totalByGrade[q.grade] = (totalByGrade[q.grade] ?? 0) + 1;
    if (answerById.get(id) === "Yes") {
      yesByGrade[q.grade] = (yesByGrade[q.grade] ?? 0) + 1;
      score += def.gradePoints[q.grade] ?? 0;
    }
  }
  const proportion = (grade: string): number => {
    const total = totalByGrade[grade] ?? 0;
    // A category with no questions imposes no constraint.
    return total === 0 ? 1 : (yesByGrade[grade] ?? 0) / total;
  };

  for (const grade of def.grading) {
    const proportionsMet = Object.entries(grade.minProportionYes).every(
      ([category, min]) => proportion(category) >= min
    );
    if (proportionsMet && score >= grade.minScore) {
      return { name: grade.name, description: grade.description };
    }
  }
  return null;
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

  const grading: GradeThreshold[] = [];
  const gradingRaw = Array.isArray(raw.grading) ? raw.grading : [];
  for (const entry of gradingRaw) {
    if (!isRecord(entry) || typeof entry.name !== "string") {
      throw new Error(
        `Invalid metric file ${source}: each grading entry needs a string "name"`
      );
    }
    if (typeof entry.min_score !== "number" || !Number.isFinite(entry.min_score)) {
      throw new Error(
        `Invalid metric file ${source}: grade "${entry.name}" needs a numeric "min_score"`
      );
    }
    if (!isRecord(entry.min_proportion_yes)) {
      throw new Error(
        `Invalid metric file ${source}: grade "${entry.name}" needs a "min_proportion_yes" map`
      );
    }
    const minProportionYes: Record<string, number> = {};
    for (const [category, value] of Object.entries(entry.min_proportion_yes)) {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error(
          `Invalid metric file ${source}: grade "${entry.name}" proportion for "${category}" must be numeric`
        );
      }
      minProportionYes[category] = value;
    }
    grading.push({
      name: entry.name,
      description: typeof entry.description === "string" ? entry.description : "",
      minProportionYes,
      minScore: entry.min_score,
    });
  }

  return { questions, gradePoints, grading };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
