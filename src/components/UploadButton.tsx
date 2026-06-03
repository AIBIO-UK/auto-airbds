import { useState } from "react";

interface Props {
  /** Called after a successful upload so the caller can refresh the list. */
  onUploaded: () => void;
}

interface Status {
  kind: "idle" | "busy" | "ok" | "error";
  msg: string;
}

// Mirrors the server's limit (functions/validation.ts MAX_UPLOAD_BYTES). The
// server is authoritative; this just gives immediate feedback and avoids a
// wasted upload.
const MAX_UPLOAD_BYTES = 256 * 1024;

/**
 * A file picker that uploads a YAML assessment to /api/upload. The endpoint is
 * public, so no API key is sent; the server's validation/rate-limit message is
 * surfaced on failure. On success the parent is asked to refresh.
 */
export function UploadButton({ onUploaded }: Props) {
  const [status, setStatus] = useState<Status>({ kind: "idle", msg: "" });
  const busy = status.kind === "busy";

  async function handleFile(file: File) {
    if (file.size > MAX_UPLOAD_BYTES) {
      setStatus({
        kind: "error",
        msg: `${file.name} is too large (max ${MAX_UPLOAD_BYTES / 1024} KB).`,
      });
      return;
    }
    setStatus({ kind: "busy", msg: `Uploading ${file.name}…` });
    try {
      const text = await file.text();
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/yaml" },
        body: text,
      });
      if (res.ok) {
        // The server returns the stored entry; surface its id so the uploader
        // can find/reference the assessment.
        let id = "";
        try {
          const body = (await res.json()) as { id?: unknown };
          if (typeof body.id === "string") id = body.id;
        } catch {
          // Non-JSON success body — just omit the id.
        }
        setStatus({
          kind: "ok",
          msg: id
            ? `Uploaded ${file.name}. Assessment id: ${id}`
            : `Uploaded ${file.name}.`,
        });
        onUploaded();
      } else {
        const detail = (await res.text()) || `HTTP ${res.status}`;
        setStatus({ kind: "error", msg: `Upload failed: ${detail}` });
      }
    } catch {
      setStatus({
        kind: "error",
        msg: "Upload failed: could not reach the server.",
      });
    }
  }

  return (
    <div className="upload-control">
      <label className={`upload-btn${busy ? " is-busy" : ""}`}>
        {busy ? "Uploading…" : "Upload assessment (YAML)"}
        <input
          type="file"
          accept=".yaml,.yml,application/yaml,text/yaml"
          disabled={busy}
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            // Reset so re-selecting the same file fires change again.
            e.target.value = "";
            if (file) void handleFile(file);
          }}
        />
      </label>
      {status.msg && (
        <p className={`upload-status upload-status-${status.kind}`}>
          {status.msg}
        </p>
      )}
    </div>
  );
}
