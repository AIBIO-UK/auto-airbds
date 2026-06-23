import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AssessmentReport } from "./AssessmentReport";

// v0.3 questions carry a "theme"; v0.4 questions do not. The report should show
// a Theme row only for versions that define one, and must score/lookup each
// version's questions from the matching metric definition.

describe("AssessmentReport v0.4", () => {
  const v04 = {
    schema_version: "0.4",
    answers: {
      "ABC-01": { answer: "Yes", comments: "accessible in full" },
      "ABC-04": { answer: "Yes", comments: "clearly licensed" },
    },
  };

  it("omits the Theme row for v0.4 (no theme in the metric)", () => {
    render(<AssessmentReport data={v04} metricVersion="0.4" />);
    expect(screen.queryByText("Theme:")).toBeNull();
    // Scope rows are still rendered (one per answered question).
    expect(screen.getAllByText("Scope:")).toHaveLength(2);
  });

  it("looks up v0.4 scope and per-question score from the v0.4 metric", () => {
    render(<AssessmentReport data={v04} metricVersion="0.4" />);
    // Both questions are Infrastructure-scope in v0.4.
    expect(screen.getAllByText("Infrastructure").length).toBeGreaterThanOrEqual(1);
    // ABC-04 is Critical: a "Yes" scores the full 80 points.
    expect(screen.getByText("80/80")).toBeTruthy();
    // ABC-01 is Important: a "Yes" scores 5.
    expect(screen.getByText("5/5")).toBeTruthy();
  });
});

describe("AssessmentReport v0.3", () => {
  it("still shows the Theme row for v0.3 (theme defined in the metric)", () => {
    const v03 = {
      schema_version: "0.3",
      answers: { "ACM-1": { answer: "Yes", comments: "accessible in full" } },
    };
    render(<AssessmentReport data={v03} metricVersion="0.3" />);
    expect(screen.getByText("Theme:")).toBeTruthy();
  });
});
