import { useCallback, useEffect, useState } from "react";
import type { UploadEntry } from "./types";
import { UploadList } from "./components/UploadList";
import { UploadButton } from "./components/UploadButton";
import { SheetImportForm } from "./components/SheetImportForm";
import { EntryView } from "./components/EntryView";
import { navigate, useHashRoute } from "./useHashRoute";

function App() {
  const [entries, setEntries] = useState<UploadEntry[]>([]);
  const path = useHashRoute();

  const load = useCallback(() => {
    fetch("/api/entries")
      .then((r) => r.json())
      .then((data: UploadEntry[]) => setEntries(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    // D1 is strongly consistent, so polling surfaces new uploads promptly.
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [load]);

  const entryMatch = path.match(/^\/entry\/(.+)$/);
  const importing = path === "/import-sheet";
  const selected = entryMatch
    ? entries.find((e) => e.id === decodeURIComponent(entryMatch[1])) ?? null
    : null;

  return (
    <div className="app">
      <header className="site-header">
        <span className="site-title">auto-AIRBDS</span>
        {/* Real-path link (not a hash route) so it hits /admin, which is
            protected by Cloudflare Access. Deletion lives there now; the
            public list below is read-only. */}
        <a className="admin-link" href="/admin">
          Admin Area
        </a>
      </header>
      <div className="banner" role="alert">
        <strong>Experimental and under development.</strong> Do not rely on any
        of the assessments shown, they are for test purposes only. Uploaded assessments may be deleted at any
        time.
      </div>
      {entryMatch ? (
        <>
          <h1>Assessment</h1>
          {selected ? (
            <EntryView entry={selected} onBack={() => navigate("/")} />
          ) : (
            <p className="empty">Assessment not found.</p>
          )}
        </>
      ) : importing ? (
        <>
          <h1>Import assessment from Google Sheet</h1>
          <SheetImportForm onImported={load} />
        </>
      ) : (
        <>
          <h1>Assessment Uploads</h1>
          <p className="subtitle">
            Upload a YAML assessment or import one from a Google Sheet with the
            buttons below, or POST YAML to <code>/api/upload</code>. Click on any
            assessment to see the results.
          </p>
          <div className="upload-actions">
            <UploadButton onUploaded={load} />
            {/* Hash route so it works without SPA-fallback server config. */}
            <a className="upload-btn upload-btn-link" href="#/import-sheet">
              Upload assessment v0.3 (Google sheet)
            </a>
          </div>
          <UploadList
            entries={entries}
            onSelect={(id) => navigate(`/entry/${encodeURIComponent(id)}`)}
          />
        </>
      )}
    </div>
  );
}

export default App;
