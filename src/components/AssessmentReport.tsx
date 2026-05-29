import { assessmentDetails } from "../types";
import {
  computeGrade,
  maxScore,
  questionMaxScore,
  questionMeta,
  questionScore,
} from "../metrics";

interface Props {
  data: unknown;
  /** Metric version, used to look up each question's fixed theme and grade. */
  metricVersion: string | null;
}

/**
 * Renders an assessment payload as a scoring-summary box above a table of
 * per-question results. Returns null when the payload has no recognisable
 * results, so callers can fall back to a raw view.
 *
 * Each question's theme and grade are taken from the metric definition for
 * `metricVersion` (they are fixed per version), not from the uploaded payload.
 */
export function AssessmentReport({ data, metricVersion }: Props) {
  const { results, summary, summaryJustification } = assessmentDetails(data);

  if (results.length === 0) return null;

  // Grade is computed from the metric's thresholds, not trusted from the
  // payload; fall back to the payload's grade only when the version is unknown.
  const computed = computeGrade(
    metricVersion,
    results.map((r) => ({ questionId: r.questionId, answer: r.answer }))
  );
  const grade = computed?.name ?? summary.grade;
  const gradeRationale = computed?.description ?? summary.gradeRationale;

  // Scores are computed from the metric definition, not the uploaded payload:
  // the maximum is the total if every answer were "Yes", and the actual score
  // is the sum of points for the "Yes" answers. Fall back to the payload's own
  // totals only when the metric version is unknown.
  const maxFromMetric = maxScore(metricVersion);
  const totalScore =
    maxFromMetric !== null
      ? results.reduce(
          (sum, r) =>
            sum + (questionScore(metricVersion, r.questionId, r.answer) ?? 0),
          0
        )
      : summary.weightedScore;
  const maxPossible = maxFromMetric ?? summary.maxPossible;

  return (
    <div className="assessment-report">
      <div className="summary-box">
        <div className="summary-head">
          {totalScore !== null && maxPossible !== null && (
            <span className="summary-score">
              <span className="summary-score-value">{totalScore}</span>
              <span className="summary-score-sep"> / </span>
              <span className="summary-score-max">{maxPossible}</span>
            </span>
          )}
          {grade && (
            <span className={`summary-grade grade-${grade.toLowerCase()}`}>
              {grade}
            </span>
          )}
        </div>
        {(gradeRationale || summaryJustification) && (
          <div className="summary-fields">
            {gradeRationale && (
              <>
                <span className="field-label">Grade rationale:</span>
                <span>{gradeRationale}</span>
              </>
            )}
            {summaryJustification && (
              <>
                <span className="field-label">Summary:</span>
                <span>{summaryJustification}</span>
              </>
            )}
          </div>
        )}
      </div>

      <div className="results-list">
        {results.map((r, i) => {
          // Theme, grade, question text, and score are fixed per metric
          // version (the score is derived from the grade and the Yes/No
          // answer); fall back to the payload's own values only when the
          // version is unknown.
          const meta = questionMeta(metricVersion, r.questionId);
          const scope = meta?.scope ?? null;
          const theme = meta?.theme ?? r.theme;
          const grade = meta?.grade ?? r.grade;
          const questionText = meta?.text ?? r.questionText;
          // Show "<actual>/<full>" when the metric defines the question;
          // otherwise fall back to the payload's own score.
          const fullScore = questionMaxScore(metricVersion, r.questionId);
          const actualScore = questionScore(metricVersion, r.questionId, r.answer);
          const scoreDisplay =
            fullScore !== null
              ? `${actualScore ?? "—"}/${fullScore}`
              : (r.score ?? "—");
          return (
            <div className="result-card" key={r.questionId ?? i}>
              <span className="field-label">ID:</span>
              <span className="mono">{r.questionId ?? "—"}</span>
              <span className="field-label">Scope:</span>
              <span>{scope ?? "—"}</span>
              <span className="field-label">Theme:</span>
              <span>{theme ?? "—"}</span>
              <span className="field-label">Grade:</span>
              <span>{grade ?? "—"}</span>
              <span className="field-label">Question:</span>
              <span>{questionText ?? "—"}</span>
              <span className="field-label">Answer:</span>
              <span
                className={
                  r.answer === "Yes"
                    ? "answer-yes"
                    : r.answer === "No"
                      ? "answer-no"
                      : undefined
                }
              >
                {r.answer ?? "—"}
              </span>
              <span className="field-label">Score:</span>
              <span>{scoreDisplay}</span>
              <span className="field-label">Justification:</span>
              <span>{r.justification ?? "—"}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
