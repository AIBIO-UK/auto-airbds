import { useState, type FormEvent } from "react";
import { navigate } from "../useHashRoute";

interface Props {
  /** Called after a successful import so the caller can refresh the list. */
  onImported: () => void;
}

interface Status {
  kind: "idle" | "busy" | "ok" | "error";
  msg: string;
  /** Blocking issues to fix in the sheet/form before re-importing (on error). */
  problems?: string[];
  /** Non-blocking notes about the imported assessment (on success). */
  notices?: string[];
  /** Stored assessment id, for a "view" link (on success). */
  entryId?: string;
}

interface ImportResponse {
  id?: unknown;
  notices?: unknown;
  error?: unknown;
  problems?: unknown;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? (value.filter((v) => typeof v === "string") as string[]) : [];
}

/**
 * A form that imports an AIRBDS assessment from a public Google Sheet. It POSTs
 * the sheet URL plus the review date (which the spreadsheet template lacks) to
 * /api/import-sheet, where the sheet is converted and validated. On success the
 * stored assessment id is shown; on failure the server's list of problems (e.g.
 * unanswered questions) is surfaced so the reviewer can fix the sheet and retry.
 */
export function SheetImportForm({ onImported }: Props) {
  const [url, setUrl] = useState("");
  const [reviewDate, setReviewDate] = useState("");
  const [initials, setInitials] = useState("");
  const [affiliation, setAffiliation] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle", msg: "" });
  const busy = status.kind === "busy";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!url.trim()) {
      setStatus({ kind: "error", msg: "Enter a Google Sheet URL." });
      return;
    }
    if (!reviewDate) {
      setStatus({ kind: "error", msg: "Enter a review date." });
      return;
    }
    setStatus({ kind: "busy", msg: "Importing…" });
    try {
      const res = await fetch("/api/import-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          review_date: reviewDate,
          initials: initials.trim() || undefined,
          affiliation: affiliation.trim() || undefined,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as ImportResponse;
      if (res.ok) {
        const id = typeof body.id === "string" ? body.id : undefined;
        setStatus({
          kind: "ok",
          msg: id ? `Imported. Assessment id: ${id}` : "Imported.",
          notices: stringList(body.notices),
          entryId: id,
        });
        onImported();
      } else {
        setStatus({
          kind: "error",
          msg:
            typeof body.error === "string"
              ? body.error
              : `Import failed (HTTP ${res.status}).`,
          problems: stringList(body.problems),
        });
      }
    } catch {
      setStatus({
        kind: "error",
        msg: "Import failed: could not reach the server.",
      });
    }
  }

  return (
    <div className="import-form">
      <button className="back-btn" onClick={() => navigate("/")}>
        &larr; Back to assessments
      </button>
      <p className="subtitle">
        Paste the link to a public AIRBDS assessment Google Sheet (shared{" "}
        <em>“anyone with the link”</em>). It is converted to the review format and
        checked for completeness before being imported.
      </p>
      <form onSubmit={handleSubmit}>
        <label className="field">
          <span>Google Sheet URL</span>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/…"
            disabled={busy}
            required
          />
        </label>
        <label className="field">
          <span>Review date</span>
          <input
            type="date"
            value={reviewDate}
            onChange={(e) => setReviewDate(e.target.value)}
            disabled={busy}
            required
          />
        </label>
        <label className="field">
          <span>
            Reviewer initials <em>(optional)</em>
          </span>
          <input
            type="text"
            value={initials}
            onChange={(e) => setInitials(e.target.value)}
            disabled={busy}
          />
        </label>
        <label className="field">
          <span>
            Reviewer affiliation <em>(optional)</em>
          </span>
          <input
            type="text"
            value={affiliation}
            onChange={(e) => setAffiliation(e.target.value)}
            disabled={busy}
          />
        </label>
        <div className="form-actions">
          <button
            type="submit"
            className={`upload-btn${busy ? " is-busy" : ""}`}
            disabled={busy}
          >
            {busy ? "Importing…" : "Import assessment"}
          </button>
        </div>
      </form>

      {status.msg && (
        <p className={`upload-status upload-status-${status.kind}`}>
          {status.msg}
        </p>
      )}

      {status.problems && status.problems.length > 0 && (
        <div className="import-problems">
          <p>Fix these in the sheet (or the form) and import again:</p>
          <ul>
            {status.problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      {status.notices && status.notices.length > 0 && (
        <div className="import-notices">
          <p>Notes:</p>
          <ul>
            {status.notices.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      )}

      {status.kind === "ok" && status.entryId && (
        <p className="import-view-link">
          <a href={`#/entry/${encodeURIComponent(status.entryId)}`}>
            View imported assessment →
          </a>
        </p>
      )}
    </div>
  );
}
