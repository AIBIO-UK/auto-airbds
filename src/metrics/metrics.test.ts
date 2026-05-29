import { describe, expect, it } from "vitest";
import { questionMeta, questionScore, maxScore, hasMetricVersion } from "./index";

describe("metric question lookup (AIRBDS 0.3)", () => {
  it("returns the fixed theme, grade and text for known questions", () => {
    expect(questionMeta("0.3", "ACM-1")).toEqual({
      scope: "Infrastructure",
      theme: "Access",
      grade: "Important",
      text: "Can the dataset be accessed in its entirety?",
    });
    expect(questionMeta("0.3", "ACM-4")).toEqual({
      scope: "Infrastructure",
      theme: "Licence",
      grade: "Critical",
      text: "Is the dataset released with a clear licence or terms of use?",
    });
    expect(questionMeta("0.3", "ACM-28")?.theme).toBe("Metadata");
    expect(questionMeta("0.3", "ACM-28")?.grade).toBe("Optional");
  });

  it("returns null for unknown versions, questions, or missing args", () => {
    expect(questionMeta("0.99", "ACM-1")).toBeNull();
    expect(questionMeta("0.3", "ACM-999")).toBeNull();
    expect(questionMeta(null, "ACM-1")).toBeNull();
    expect(questionMeta("0.3", null)).toBeNull();
  });

  it("scores Yes answers at the grade's full points and No at 0", () => {
    // ACM-23 is Optional (2 points), ACM-1 Important (5), ACM-4 Critical (80).
    expect(questionScore("0.3", "ACM-23", "Yes")).toBe(2);
    expect(questionScore("0.3", "ACM-1", "Yes")).toBe(5);
    expect(questionScore("0.3", "ACM-4", "Yes")).toBe(80);
    expect(questionScore("0.3", "ACM-4", "No")).toBe(0);
    expect(questionScore("0.3", "ACM-1", "No")).toBe(0);
  });

  it("returns null score for unknown versions/questions or non-Yes/No answers", () => {
    expect(questionScore("0.99", "ACM-1", "Yes")).toBeNull();
    expect(questionScore("0.3", "ACM-999", "Yes")).toBeNull();
    expect(questionScore("0.3", "ACM-1", "Maybe")).toBeNull();
    expect(questionScore("0.3", "ACM-1", null)).toBeNull();
  });

  it("computes the max score as the total of all questions answered Yes", () => {
    // AIRBDS 0.3: 8 Critical (80), 12 Important (5), 8 Optional (2)
    // = 640 + 60 + 16 = 716.
    expect(maxScore("0.3")).toBe(716);
    expect(maxScore("0.99")).toBeNull();
    expect(maxScore(null)).toBeNull();
  });

  it("reports which metric versions are available", () => {
    expect(hasMetricVersion("0.3")).toBe(true);
    expect(hasMetricVersion("0.99")).toBe(false);
    expect(hasMetricVersion(null)).toBe(false);
  });
});
