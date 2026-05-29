import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

const ENTRIES = [
  {
    id: "abc",
    timestamp: "2026-05-29T10:00:00Z",
    data: {
      score: 42,
      assessment: {
        metric: { name: "AIRBDS Metric", version: "0.3" },
        dataset: {
          title: "Mediterranean Marine Invertebrate Records",
          source_url: "https://example-data-portal.org/datasets/med-marine-invert",
        },
        metadata: {
          model: "claude-opus-4-7",
          assessment_timestamp: "2026-05-29T10:00:00Z",
        },
      },
    },
  },
];

describe("App routing", () => {
  beforeEach(() => {
    window.location.hash = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ENTRIES,
      })) as unknown as typeof fetch
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    window.location.hash = "";
  });

  it("shows the assessment list on the main page, not the JSON", async () => {
    render(<App />);

    await screen.findByText("29 May 2026, 10:00 UTC");
    expect(screen.getByText("JSON Uploads")).toBeInTheDocument();
    // Each list item shows the dataset source URL, title, then timestamp.
    expect(
      screen.getByText("https://example-data-portal.org/datasets/med-marine-invert")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Mediterranean Marine Invertebrate Records")
    ).toBeInTheDocument();
    // The entry ID is shown in the list too.
    expect(screen.getByText("abc")).toBeInTheDocument();
    // The performer (model) is shown in the list.
    expect(screen.getByText("claude-opus-4-7")).toBeInTheDocument();
    // The raw JSON should not be rendered on the list page.
    expect(screen.queryByText(/"score": 42/)).not.toBeInTheDocument();
  });

  it("navigates to a separate JSON page when an assessment is clicked", async () => {
    render(<App />);

    const item = await screen.findByText("29 May 2026, 10:00 UTC");
    await userEvent.click(item);

    await waitFor(() => {
      expect(screen.getByText(/"score": 42/)).toBeInTheDocument();
    });
    expect(window.location.hash).toBe("#/entry/abc");
    expect(screen.getByText(/Back to assessments/)).toBeInTheDocument();
    // The same dataset fields are shown on the individual page.
    expect(
      screen.getByText("Mediterranean Marine Invertebrate Records")
    ).toBeInTheDocument();
    expect(
      screen.getByText("https://example-data-portal.org/datasets/med-marine-invert")
    ).toBeInTheDocument();
    expect(screen.getByText("29 May 2026, 10:00 UTC")).toBeInTheDocument();
    expect(screen.getByText("abc")).toBeInTheDocument();
    expect(screen.getByText("claude-opus-4-7")).toBeInTheDocument();
    // The AIRBDS metric version is shown on the detail page.
    expect(screen.getByText(/AIRBDS version/i)).toBeInTheDocument();
    expect(screen.getByText("0.3")).toBeInTheDocument();
  });

  it("falls back to raw JSON when the payload has no results", async () => {
    window.location.hash = "#/entry/abc";
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/"score": 42/)).toBeInTheDocument();
    });
  });

  it("renders a scoring summary and results table for an assessment", async () => {
    const entry = {
      id: "xyz",
      timestamp: "2026-05-29T10:00:00Z",
      data: {
        assessment: {
          metric: { version: "0.3" },
          dataset: { title: "Some Dataset", source_url: "https://ex.org/d" },
          metadata: { model: "claude-opus-4-7" },
          // Theme, grade, question text and score below are deliberately
          // wrong: they should be ignored in favour of the metric definitions.
          results: [
            {
              question_id: "ACM-1",
              theme: "BOGUS-THEME-1",
              question_text: "BOGUS-QUESTION-1",
              grade: "BOGUS-GRADE-1",
              answer: "Yes",
              score: 999,
              justification: "The full set of records is retrievable.",
            },
            {
              question_id: "ACM-4",
              theme: "BOGUS-THEME-4",
              question_text: "BOGUS-QUESTION-4",
              grade: "BOGUS-GRADE-4",
              answer: "Yes",
              score: 888,
              justification: "A clear licence is stated.",
            },
          ],
          // Totals here are deliberately wrong: they should be ignored and
          // recomputed from the metric definitions.
          scoring_summary: {
            weighted_score: 5678,
            max_possible: 1234,
            grade: "Silver",
            grade_rationale: "All Critical questions pass.",
          },
          summary_justification: "The dataset is highly AI-ready.",
        },
      },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => [entry] })) as unknown as typeof fetch
    );
    window.location.hash = "#/entry/xyz";
    render(<App />);

    // Summary box: score is computed from the metric, not the payload.
    // Actual = ACM-1 (Important, Yes = 5) + ACM-4 (Critical, Yes = 80) = 85;
    // max = total of all AIRBDS 0.3 questions if all "Yes" = 716.
    await screen.findByText("85");
    expect(screen.getByText("716")).toBeInTheDocument();
    expect(screen.queryByText("5678")).not.toBeInTheDocument(); // payload total ignored
    expect(screen.queryByText("1234")).not.toBeInTheDocument(); // payload max ignored
    expect(screen.getByText("Silver")).toBeInTheDocument();
    expect(screen.getByText(/All Critical questions pass/)).toBeInTheDocument();
    expect(screen.getByText(/The dataset is highly AI-ready/)).toBeInTheDocument();

    // Results rows.
    expect(screen.getByText("ACM-1")).toBeInTheDocument();
    expect(screen.getByText("ACM-4")).toBeInTheDocument();

    // Theme, grade and question text come from the AIRBDS 0.3 definitions,
    // not the payload.
    expect(screen.getByText("Access")).toBeInTheDocument(); // ACM-1 theme
    expect(screen.getByText("Licence")).toBeInTheDocument(); // ACM-4 theme
    // Scope comes from the metric too (ACM-1 and ACM-4 are both Infrastructure).
    expect(screen.getAllByText("Infrastructure")).toHaveLength(2);
    expect(screen.getByText("Critical")).toBeInTheDocument(); // ACM-4 grade
    expect(
      screen.getByText("Can the dataset be accessed in its entirety?")
    ).toBeInTheDocument(); // ACM-1 text
    expect(
      screen.getByText("Is the dataset released with a clear licence or terms of use?")
    ).toBeInTheDocument(); // ACM-4 text
    expect(screen.queryByText("BOGUS-THEME-1")).not.toBeInTheDocument();
    expect(screen.queryByText("BOGUS-GRADE-4")).not.toBeInTheDocument();
    expect(screen.queryByText("BOGUS-QUESTION-1")).not.toBeInTheDocument();

    // Per-question score is derived from grade + answer and shown as
    // "<actual>/<full>": ACM-1 (Important, Yes) = 5/5, ACM-4 (Critical,
    // Yes) = 80/80. Bogus payload scores are ignored.
    expect(screen.getByText("5/5")).toBeInTheDocument();
    expect(screen.getByText("80/80")).toBeInTheDocument();
    expect(screen.queryByText("999")).not.toBeInTheDocument();
    expect(screen.queryByText("888")).not.toBeInTheDocument();

    // The raw JSON dump is no longer shown for a recognised assessment.
    expect(screen.queryByText(/"weighted_score"/)).not.toBeInTheDocument();
  });
});
