import { describe, expect, it } from "vitest";
import { assessmentDetails, datasetInfo } from "./types";

const SAMPLE = {
  schema_version: "0.3",
  reviewer: { name: "claude-opus-4-7", review_date: "2026-05-26" },
  dataset: {
    name: "Some Dataset",
    url: "https://example.org/d",
    comments: "summary text",
  },
  answers: {
    "ACM-1": { answer: "Yes", comments: "c1" },
    "ACM-2": { answer: "No", comments: "c2" },
  },
};

const EMPTY = {
  name: null,
  url: null,
  reviewDate: null,
  reviewer: null,
  metricVersion: null,
};

describe("datasetInfo", () => {
  it("reads name/url/reviewer/reviewDate/version from the template shape", () => {
    expect(datasetInfo(SAMPLE)).toEqual({
      name: "Some Dataset",
      url: "https://example.org/d",
      reviewDate: "2026-05-26",
      reviewer: "claude-opus-4-7",
      metricVersion: "0.3",
    });
  });

  it("returns all nulls for unrecognised payloads", () => {
    expect(datasetInfo(null)).toEqual(EMPTY);
    expect(datasetInfo({})).toEqual(EMPTY);
    expect(datasetInfo("nope")).toEqual(EMPTY);
  });
});

describe("assessmentDetails", () => {
  it("maps the answers map to results keyed by question id, plus the summary", () => {
    const { results, summary } = assessmentDetails(SAMPLE);
    expect(summary).toBe("summary text");
    expect(results).toEqual([
      { questionId: "ACM-1", answer: "Yes", comments: "c1" },
      { questionId: "ACM-2", answer: "No", comments: "c2" },
    ]);
  });

  it("yields empty results and null summary for payloads without answers", () => {
    expect(assessmentDetails({}).results).toEqual([]);
    expect(assessmentDetails(null).summary).toBeNull();
  });
});
