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
  });

  it("renders the JSON page directly from a deep link hash", async () => {
    window.location.hash = "#/entry/abc";
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/"score": 42/)).toBeInTheDocument();
    });
  });
});
