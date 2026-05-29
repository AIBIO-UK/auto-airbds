import { assessmentDetails } from "../types";
import { questionMeta, questionScore } from "../metrics";

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

  const { weightedScore, maxPossible, grade, gradeRationale } = summary;

  return (
    <div className="assessment-report">
      <div className="summary-box">
        <div className="summary-head">
          {weightedScore !== null && maxPossible !== null && (
            <span className="summary-score">
              <span className="summary-score-value">{weightedScore}</span>
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
        {gradeRationale && (
          <p className="summary-field">
            <span className="field-label">Grade rationale:</span>{" "}
            {gradeRationale}
          </p>
        )}
        {summaryJustification && (
          <p className="summary-field">
            <span className="field-label">Summary:</span> {summaryJustification}
          </p>
        )}
      </div>

      <div className="results-list">
        {results.map((r, i) => {
          // Theme, grade, question text, and score are fixed per metric
          // version (the score is derived from the grade and the Yes/No
          // answer); fall back to the payload's own values only when the
          // version is unknown.
          const meta = questionMeta(metricVersion, r.questionId);
          const theme = meta?.theme ?? r.theme;
          const grade = meta?.grade ?? r.grade;
          const questionText = meta?.text ?? r.questionText;
          const score = questionScore(metricVersion, r.questionId, r.answer) ?? r.score;
          return (
            <div className="result-card" key={r.questionId ?? i}>
              <span className="field-label">ID:</span>
              <span className="mono">{r.questionId ?? "—"}</span>
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
              <span>{score ?? "—"}</span>
              <span className="field-label">Justification:</span>
              <span>{r.justification ?? "—"}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
