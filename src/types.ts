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
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
