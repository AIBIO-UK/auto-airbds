import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SheetImportForm } from "./SheetImportForm";

function fillForm() {
  fireEvent.change(screen.getByLabelText(/Google Sheet URL/i), {
    target: { value: "https://docs.google.com/spreadsheets/d/abc123" },
  });
  fireEvent.change(screen.getByLabelText(/Review date/i), {
    target: { value: "2026-06-15" },
  });
}

function submit() {
  return userEvent.click(
    screen.getByRole("button", { name: /^Import assessment$/i })
  );
}

describe("SheetImportForm", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("POSTs the url + review date, reports success with notices, and refreshes", async () => {
    const onImported = vi.fn();
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 201,
      json: async () => ({
        id: "entry-9",
        timestamp: "t",
        data: {},
        notices: ["Reviewer initials are blank (optional — not in the sheet)."],
      }),
    }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    render(<SheetImportForm onImported={onImported} />);
    fillForm();
    await submit();

    await screen.findByText(/Imported\. Assessment id: entry-9/);
    screen.getByText(/Reviewer initials are blank/);
    expect(onImported).toHaveBeenCalledTimes(1);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/import-sheet",
      expect.objectContaining({ method: "POST" })
    );
    const init = (fetchMock.mock.calls[0] as unknown[])[1] as RequestInit;
    const sent = JSON.parse(init.body as string);
    expect(sent.url).toBe("https://docs.google.com/spreadsheets/d/abc123");
    expect(sent.review_date).toBe("2026-06-15");
  });

  it("lists the server's problems on an incomplete import and does not refresh", async () => {
    const onImported = vi.fn();
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 422,
      json: async () => ({
        error: "The assessment is incomplete and was not imported.",
        problems: ["ACM-12: not answered.", "Dataset link/URL is missing from the sheet."],
      }),
    }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    render(<SheetImportForm onImported={onImported} />);
    fillForm();
    await submit();

    await screen.findByText(/incomplete and was not imported/);
    screen.getByText("ACM-12: not answered.");
    screen.getByText("Dataset link/URL is missing from the sheet.");
    expect(onImported).not.toHaveBeenCalled();
  });

  it("reports a network failure without refreshing", async () => {
    const onImported = vi.fn();
    const fetchMock = vi.fn(async () => {
      throw new Error("network down");
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    render(<SheetImportForm onImported={onImported} />);
    fillForm();
    await submit();

    await screen.findByText(/could not reach the server/i);
    expect(onImported).not.toHaveBeenCalled();
  });
});
