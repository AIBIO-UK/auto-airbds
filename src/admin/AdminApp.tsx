import { useCallback, useEffect, useState } from "react";
import type { UploadEntry } from "../types";
import { UploadList } from "../components/UploadList";

/**
 * Admin page served at the real path /admin (a separate Vite entry, so its
 * code never ships in the public bundle). The page itself is gated by
 * Cloudflare Access; the DELETE it calls independently verifies the admin's
 * Access JWT, so reaching this UI is not what authorises deletion.
 */
export function AdminApp() {
  const [entries, setEntries] = useState<UploadEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/entries")
      .then((r) => r.json())
      .then((data: UploadEntry[]) => setEntries(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    // Same polling as the public list so deletions/uploads stay in sync.
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [load]);

  async function handleDelete(id: string) {
    setError(null);
    // The Access session cookie is same-origin, so it rides along automatically.
    const res = await fetch(`/api/entries/${id}`, { method: "DELETE" });
    if (res.ok) {
      setEntries((prev) => prev.filter((e) => e.id !== id));
      return;
    }
    setError(
      res.status === 401
        ? "Your admin session has expired — reload the page to sign in again."
        : `Delete failed (HTTP ${res.status}).`
    );
  }

  return (
    <div className="app">
      <header className="site-header">
        <span className="site-title">auto-AIRBDS · Admin</span>
        <a className="admin-link" href="/">
          ← Back to site
        </a>
      </header>
      <h1>Manage uploads</h1>
      <p className="subtitle">
        Deleting an assessment is permanent. Click an entry to view it, or use
        the trash button to remove it.
      </p>
      {error && <p className="upload-status upload-status-error">{error}</p>}
      <UploadList
        entries={entries}
        onSelect={(id) => {
          // View the assessment on the public (hash-routed) page.
          window.location.href = `/#/entry/${encodeURIComponent(id)}`;
        }}
        onDelete={handleDelete}
      />
    </div>
  );
}
