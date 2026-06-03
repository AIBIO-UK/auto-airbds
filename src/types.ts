export interface UploadEntry {
  id: string;
  timestamp: string;
  data: unknown;
}

export interface DatasetInfo {
  /** Dataset name (dataset.name). */
  name: string | null;
  /** Dataset URL (dataset.url). */
  url: string | null;
  /** When the assessment was performed (reviewer.review_date). */
  reviewDate: string | null;
  /**
   * Who performed the assessment (reviewer.name). A model name for an
   * AI-performed assessment, or a person's name for a human review.
   */
  reviewer: string | null;
  /** The AIRBDS metric version used (schema_version). */
  metricVersion: string | null;
}

/**
 * Safely pull the dataset name, URL, reviewer, and review date out of an
 * assessment payload. `data` is untrusted/unknown, so every level is guarded.
 */
export function datasetInfo(data: unknown): DatasetInfo {
  const root = isRecord(data) ? data : null;
  const dataset = root && isRecord(root.dataset) ? root.dataset : null;
  const reviewer = root && isRecord(root.reviewer) ? root.reviewer : null;

  return {
    name: dataset && typeof dataset.name === "string" ? dataset.name : null,
    url: dataset && typeof dataset.url === "string" ? dataset.url : null,
    reviewDate:
      reviewer && typeof reviewer.review_date === "string"
        ? reviewer.review_date
        : null,
    reviewer:
      reviewer && typeof reviewer.name === "string" ? reviewer.name : null,
    metricVersion:
      root && typeof root.schema_version === "string"
        ? root.schema_version
        : null,
  };
}

export interface ResultRow {
  questionId: string | null;
  answer: string | null;
  /** The reviewer's free-text note for the question (answers.<id>.comments). */
  comments: string | null;
}

export interface AssessmentDetails {
  results: ResultRow[];
  /** Free-text summary for the whole assessment (dataset.comments). */
  summary: string | null;
}

/**
 * Safely pull the per-question results and overall summary out of an assessment
 * payload. `data` is untrusted/unknown, so every level is guarded; a payload
 * that does not match the expected shape yields empty results and a null
 * summary. The `answers` map is keyed by question id, so each key is the id.
 */
export function assessmentDetails(data: unknown): AssessmentDetails {
  const root = isRecord(data) ? data : null;
  const answers = root && isRecord(root.answers) ? root.answers : null;
  const dataset = root && isRecord(root.dataset) ? root.dataset : null;

  const results: ResultRow[] = answers
    ? Object.entries(answers).map(([id, value]) => ({
        questionId: id,
        answer: isRecord(value) ? str(value.answer) : null,
        comments: isRecord(value) ? str(value.comments) : null,
      }))
    : [];

  return {
    results,
    summary: dataset ? str(dataset.comments) : null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function str(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}
