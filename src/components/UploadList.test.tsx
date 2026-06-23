import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { UploadList } from "./UploadList";
import type { UploadEntry } from "../types";

function entryWith(data: unknown, id = "abc-123"): UploadEntry {
  return { id, timestamp: "2026-06-23T00:00:00Z", data };
}

describe("UploadList", () => {
  it("shows the AIRBDS metric version for each entry", () => {
    const entry = entryWith({
      schema_version: "0.4",
      reviewer: { name: "claude-opus-4-8", review_date: "2026-06-23" },
      dataset: { name: "A dataset", url: "https://example.org/d" },
      answers: {},
    });
    render(<UploadList entries={[entry]} onSelect={() => {}} />);
    expect(screen.getByText("AIRBDS version:")).toBeTruthy();
    expect(screen.getByText("0.4")).toBeTruthy();
  });

  it('falls back to "(unknown)" when the assessment has no version', () => {
    const entry = entryWith({
      reviewer: { name: "a reviewer", review_date: "2026-06-23" },
      dataset: { name: "A dataset", url: "https://example.org/d" },
      answers: {},
    });
    render(<UploadList entries={[entry]} onSelect={() => {}} />);
    // reviewer and date are present, so the only "(unknown)" is the version.
    expect(screen.getByText("AIRBDS version:")).toBeTruthy();
    expect(screen.getByText("(unknown)")).toBeTruthy();
  });
});
