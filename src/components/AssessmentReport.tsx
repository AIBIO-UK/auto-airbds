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

      <table className="results-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Theme</th>
            <th>Question</th>
            <th>Grade</th>
            <th>Answer</th>
            <th className="num">Score</th>
            <th>Justification</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r, i) => (
            <tr key={r.questionId ?? i}>
              <td className="mono">{r.questionId ?? "—"}</td>
              <td>{r.theme ?? "—"}</td>
              <td>{r.questionText ?? "—"}</td>
              <td>{r.grade ?? "—"}</td>
              <td
                className={
                  r.answer === "Yes"
                    ? "answer-yes"
                    : r.answer === "No"
                      ? "answer-no"
                      : undefined
                }
              >
                {r.answer ?? "—"}
              </td>
              <td className="num">{r.score ?? "—"}</td>
              <td className="justification">{r.justification ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
