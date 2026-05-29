import { describe, expect, it } from "vitest";
import { questionMeta, hasMetricVersion } from "./index";

describe("metric question lookup (AIRBDS 0.3)", () => {
  it("returns the fixed theme and grade for known questions", () => {
    expect(questionMeta("0.3", "ACM-1")).toEqual({
      theme: "Access",
      grade: "Important",
    });
    expect(questionMeta("0.3", "ACM-4")).toEqual({
      theme: "License",
      grade: "Critical",
    });
    expect(questionMeta("0.3", "ACM-28")).toEqual({
      theme: "Metadata",
      grade: "Optional",
    });
  });

  it("returns null for unknown versions, questions, or missing args", () => {
    expect(questionMeta("0.99", "ACM-1")).toBeNull();
    expect(questionMeta("0.3", "ACM-999")).toBeNull();
    expect(questionMeta(null, "ACM-1")).toBeNull();
    expect(questionMeta("0.3", null)).toBeNull();
  });

  it("reports which metric versions are available", () => {
    expect(hasMetricVersion("0.3")).toBe(true);
    expect(hasMetricVersion("0.99")).toBe(false);
    expect(hasMetricVersion(null)).toBe(false);
  });
});
