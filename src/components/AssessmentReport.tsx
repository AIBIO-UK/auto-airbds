import { assessmentDetails } from "../types";

interface Props {
  data: unknown;
}

/**
 * Renders an assessment payload as a scoring-summary box above a table of
 * per-question results. Returns null when the payload has no recognisable
 * results, so callers can fall back to a raw view.
 */
export function AssessmentReport({ data }: Props) {
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
        {results.map((r, i) => (
          <div className="result-card" key={r.questionId ?? i}>
            <span className="field-label">ID:</span>
            <span className="mono">{r.questionId ?? "—"}</span>
            <span className="field-label">Theme:</span>
            <span>{r.theme ?? "—"}</span>
            <span className="field-label">Grade:</span>
            <span>{r.grade ?? "—"}</span>
            <span className="field-label">Question:</span>
            <span>{r.questionText ?? "—"}</span>
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
            <span>{r.score ?? "—"}</span>
            <span className="field-label">Justification:</span>
            <span>{r.justification ?? "—"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
