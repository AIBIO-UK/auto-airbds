export interface UploadEntry {
  id: string;
  timestamp: string;
  data: unknown;
}

export interface DatasetInfo {
  title: string | null;
  sourceUrl: string | null;
  /** When the assessment was performed (assessment.metadata.assessment_timestamp). */
  assessedAt: string | null;
  /** The model that performed the assessment (assessment.metadata.model). */
  model: string | null;
  /** The AIRBDS metric version used (assessment.metric.version). */
  metricVersion: string | null;
}

/**
 * Safely pull the dataset title, source URL, and assessment date out of an
 * assessment payload. `data` is untrusted/unknown, so every level is guarded.
 */
export function datasetInfo(data: unknown): DatasetInfo {
  const assessment =
    isRecord(data) && isRecord(data.assessment) ? data.assessment : null;
  const dataset =
    assessment && isRecord(assessment.dataset) ? assessment.dataset : null;
  const metadata =
    assessment && isRecord(assessment.metadata) ? assessment.metadata : null;
  const metric =
    assessment && isRecord(assessment.metric) ? assessment.metric : null;

  return {
    title: dataset && typeof dataset.title === "string" ? dataset.title : null,
    sourceUrl:
      dataset && typeof dataset.source_url === "string"
        ? dataset.source_url
        : null,
    assessedAt:
      metadata && typeof metadata.assessment_timestamp === "string"
        ? metadata.assessment_timestamp
        : null,
    model:
      metadata && typeof metadata.model === "string" ? metadata.model : null,
    metricVersion:
      metric && typeof metric.version === "string" ? metric.version : null,
  };
}

export interface ResultRow {
  questionId: string | null;
  theme: string | null;
  questionText: string | null;
  grade: string | null;
  answer: string | null;
  score: number | null;
  justification: string | null;
}

export interface ScoringSummary {
  weightedScore: number | null;
  maxPossible: number | null;
  grade: string | null;
  gradeRationale: string | null;
}

export interface AssessmentDetails {
  results: ResultRow[];
  summary: ScoringSummary;
  summaryJustification: string | null;
}

/**
 * Safely pull the per-question results and scoring summary out of an
 * assessment payload. `data` is untrusted/unknown, so every level is guarded;
 * a payload that does not match the expected shape yields empty results and
 * null summary fields.
 */
export function assessmentDetails(data: unknown): AssessmentDetails {
  const assessment =
    isRecord(data) && isRecord(data.assessment) ? data.assessment : null;

  const rawResults =
    assessment && Array.isArray(assessment.results) ? assessment.results : [];
  const results: ResultRow[] = rawResults.filter(isRecord).map((r) => ({
    questionId: str(r.question_id),
    theme: str(r.theme),
    questionText: str(r.question_text),
    grade: str(r.grade),
    answer: str(r.answer),
    score: num(r.score),
    justification: str(r.justification),
  }));

  const summaryObj =
    assessment && isRecord(assessment.scoring_summary)
      ? assessment.scoring_summary
      : null;

  return {
    results,
    summary: {
      weightedScore: summaryObj ? num(summaryObj.weighted_score) : null,
      maxPossible: summaryObj ? num(summaryObj.max_possible) : null,
      grade: summaryObj ? str(summaryObj.grade) : null,
      gradeRationale: summaryObj ? str(summaryObj.grade_rationale) : null,
    },
    summaryJustification: assessment ? str(assessment.summary_justification) : null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function str(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
