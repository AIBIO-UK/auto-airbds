import { describe, expect, it } from "vitest";
import { moderationStatus } from "./moderation";

describe("moderationStatus", () => {
  it("reports every entry as unmoderated until moderation exists", () => {
    expect(moderationStatus()).toBe("unmoderated");
  });
});
