import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UploadButton } from "./UploadButton";

function fileInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector('input[type="file"]');
  if (!input) throw new Error("file input not found");
  return input as HTMLInputElement;
}

describe("UploadButton", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("POSTs the file contents, reports success, and refreshes", async () => {
    const onUploaded = vi.fn();
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 201,
      json: async () => ({ id: "entry-123", timestamp: "t", data: {} }),
    }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const { container } = render(<UploadButton onUploaded={onUploaded} />);
    const file = new File(['schema_version: "0.3"\n'], "review.yaml", {
      type: "application/yaml",
    });
    await userEvent.upload(fileInput(container), file);

    // The success message includes the returned assessment id.
    await screen.findByText(/Uploaded review\.yaml\. Assessment id: entry-123/);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/upload",
      expect.objectContaining({ method: "POST" })
    );
    const init = (fetchMock.mock.calls[0] as unknown[])[1] as RequestInit;
    expect(init.body).toContain('schema_version: "0.3"');
    expect(onUploaded).toHaveBeenCalledTimes(1);
  });

  it("shows the server's error message and does not refresh on failure", async () => {
    const onUploaded = vi.fn();
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 400,
      text: async () => 'Missing "reviewer.name"',
    }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const { container } = render(<UploadButton onUploaded={onUploaded} />);
    const file = new File(["{}"], "bad.yaml", { type: "application/yaml" });
    await userEvent.upload(fileInput(container), file);

    await screen.findByText(/Upload failed: Missing "reviewer\.name"/);
    expect(onUploaded).not.toHaveBeenCalled();
  });
});
