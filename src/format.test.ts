import { describe, expect, it } from "vitest";
import { formatTimestamp } from "./format";

describe("formatTimestamp", () => {
  it("renders an ISO timestamp in a human-readable UTC form", () => {
    expect(formatTimestamp("2026-05-29T10:00:00Z")).toBe("29 May 2026, 10:00 UTC");
  });

  it("pads single-digit hours and minutes", () => {
    expect(formatTimestamp("2026-01-05T09:07:00Z")).toBe("5 Jan 2026, 09:07 UTC");
  });

  it("returns the raw string when the input is not a valid date", () => {
    expect(formatTimestamp("not-a-date")).toBe("not-a-date");
  });
});
