import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import {
  computeGrade,
  maxScore,
  questionMaxScore,
  questionMeta,
  questionScore,
} from "./metrics";

const ENTRIES = [
  {
    id: "abc",
    timestamp: "2026-05-29T10:00:00Z",
    data: {
      score: 42,
      schema_version: "0.3",
      reviewer: {
        name: "claude-opus-4-7",
        review_date: "2026-05-29T10:00:00Z",
      },
      dataset: {
        name: "Mediterranean Marine Invertebrate Records",
        url: "https://example-data-portal.org/datasets/med-marine-invert",
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

  it("shows the assessment list on the main page, not the raw payload", async () => {
    render(<App />);

    await screen.findByText("29 May 2026, 10:00 UTC");
    expect(screen.getByText("Assessment Uploads")).toBeInTheDocument();
    // Each list item shows the dataset URL, name, then timestamp.
    expect(
      screen.getByText("https://example-data-portal.org/datasets/med-marine-invert")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Mediterranean Marine Invertebrate Records")
    ).toBeInTheDocument();
    // The entry ID is shown in the list too.
    expect(screen.getByText("abc")).toBeInTheDocument();
    // The reviewer (here a model name) is shown in the list.
    expect(screen.getByText("claude-opus-4-7")).toBeInTheDocument();
    // The raw payload should not be rendered on the list page.
    expect(screen.queryByText(/"score": 42/)).not.toBeInTheDocument();
  });

  it("tags each list entry with its moderation status", async () => {
    render(<App />);

    await screen.findByText("29 May 2026, 10:00 UTC");
    // Every entry on the list shows its moderation status (unmoderated for now).
    expect(screen.getAllByText("Status:")).toHaveLength(ENTRIES.length);
    expect(screen.getAllByText("unmoderated")).toHaveLength(ENTRIES.length);
  });

  it("navigates to a separate page when an assessment is clicked", async () => {
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
    // Every entry is tagged with a moderation status (unmoderated for now),
    // shown at the bottom of the metadata box.
    expect(screen.getByText("Status:")).toBeInTheDocument();
    expect(screen.getByText("unmoderated")).toBeInTheDocument();
  });

  it("falls back to the raw payload when there are no answers", async () => {
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
        schema_version: "0.3",
        reviewer: {
          name: "claude-opus-4-7",
          review_date: "2026-05-29T10:00:00Z",
        },
        dataset: {
          name: "Some Dataset",
          url: "https://ex.org/d",
          comments: "The dataset is highly AI-ready.",
        },
        // The answers map is keyed by question id; theme/grade/question text and
        // score are not in the payload — they come from the metric definition.
        answers: {
          "ACM-1": {
            answer: "Yes",
            comments: "The full set of records is retrievable.",
          },
          "ACM-4": { answer: "Yes", comments: "A clear licence is stated." },
        },
      },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => [entry] })) as unknown as typeof fetch
    );

    // Expected values come from the metric module, so the test tracks the YAML.
    const VERSION = "0.3";
    const answers = Object.entries(entry.data.answers).map(([id, a]) => ({
      questionId: id,
      answer: a.answer,
    }));
    const expectedTotal = answers.reduce(
      (sum, a) => sum + (questionScore(VERSION, a.questionId, a.answer) ?? 0),
      0
    );
    const expectedMax = maxScore(VERSION)!;
    const expectedGrade = computeGrade(VERSION, answers)!;
    const meta1 = questionMeta(VERSION, "ACM-1")!;
    const meta4 = questionMeta(VERSION, "ACM-4")!;
    const score1 = `${questionScore(VERSION, "ACM-1", "Yes")}/${questionMaxScore(VERSION, "ACM-1")}`;
    const score4 = `${questionScore(VERSION, "ACM-4", "Yes")}/${questionMaxScore(VERSION, "ACM-4")}`;

    window.location.hash = "#/entry/xyz";
    render(<App />);

    // Summary box: score, max and grade are computed from the metric.
    await screen.findByText(String(expectedTotal));
    expect(screen.getByText(String(expectedMax))).toBeInTheDocument();
    expect(screen.getByText(expectedGrade.name)).toBeInTheDocument();
    expect(screen.getByText(expectedGrade.description)).toBeInTheDocument();
    // The summary text comes from dataset.comments.
    expect(screen.getByText(/The dataset is highly AI-ready/)).toBeInTheDocument();

    // Results rows.
    expect(screen.getByText("ACM-1")).toBeInTheDocument();
    expect(screen.getByText("ACM-4")).toBeInTheDocument();

    // Scope, theme and question text come from the metric.
    expect(screen.getAllByText(meta1.scope).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(meta1.theme).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(meta4.theme).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(meta1.question).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(meta4.question).length).toBeGreaterThanOrEqual(1);

    // Per-question score is derived from grade + answer and shown as
    // "<actual>/<full>".
    expect(screen.getByText(score1)).toBeInTheDocument();
    expect(screen.getByText(score4)).toBeInTheDocument();

    // The per-question comments are shown as the justification.
    expect(
      screen.getByText("The full set of records is retrievable.")
    ).toBeInTheDocument();
  });
});
