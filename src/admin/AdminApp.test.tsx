import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminApp } from "./AdminApp";

const ENTRIES = [
  {
    id: "abc",
    timestamp: "2026-05-29T10:00:00Z",
    data: {
      schema_version: "0.3",
      reviewer: { name: "claude-opus-4-7", review_date: "2026-05-29T10:00:00Z" },
      dataset: { name: "Test Dataset", url: "https://ex.org/d" },
    },
  },
];

describe("AdminApp", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("lists entries and deletes one when the trash button is clicked", async () => {
    // Stateful store so the polling GET stays consistent with the DELETE.
    let store = ENTRIES.map((e) => ({ ...e }));
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === "DELETE") {
          const id = decodeURIComponent(String(url).split("/").pop()!);
          store = store.filter((e) => e.id !== id);
          return { ok: true, status: 204 } as Response;
        }
        return { ok: true, json: async () => store } as unknown as Response;
      })
    );

    render(<AdminApp />);
    await screen.findByText("Test Dataset");

    await userEvent.click(screen.getByRole("button", { name: /delete/i }));

    await waitFor(() =>
      expect(screen.queryByText("Test Dataset")).not.toBeInTheDocument()
    );
  });

  it("shows a session-expired message when a delete returns 401", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === "DELETE") {
          return { ok: false, status: 401 } as Response;
        }
        return { ok: true, json: async () => ENTRIES } as unknown as Response;
      })
    );

    render(<AdminApp />);
    await screen.findByText("Test Dataset");

    await userEvent.click(screen.getByRole("button", { name: /delete/i }));

    await screen.findByText(/session has expired/i);
    // The entry is still listed because the delete was rejected.
    expect(screen.getByText("Test Dataset")).toBeInTheDocument();
  });
});
