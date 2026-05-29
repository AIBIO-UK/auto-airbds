import { useEffect, useState } from "react";
import type { UploadEntry } from "./types";
import { UploadList } from "./components/UploadList";
import { EntryView } from "./components/EntryView";
import { navigate, useHashRoute } from "./useHashRoute";

function App() {
  const [entries, setEntries] = useState<UploadEntry[]>([]);
  const path = useHashRoute();

  useEffect(() => {
    let cancelled = false;

    function load() {
      fetch("/api/entries")
        .then((r) => r.json())
        .then((data: UploadEntry[]) => {
          if (cancelled) return;
          setEntries(data);
        })
        .catch(() => {});
    }

    load();
    // D1 is strongly consistent, so polling surfaces new uploads promptly.
    const interval = setInterval(load, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  async function handleDelete(id: string) {
    const res = await fetch(`/api/entries/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  const entryMatch = path.match(/^\/entry\/(.+)$/);
  const selected = entryMatch
    ? entries.find((e) => e.id === decodeURIComponent(entryMatch[1])) ?? null
    : null;

  return (
    <div className="app">
      <header>auto-AIRBDS</header>
      <div className="banner" role="alert">
        <strong>Experimental and under development.</strong> Do not rely on any
        of the assessments shown, they may be entirely wrong. Uploaded assessments may be deleted at any
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
      ) : (
        <>
          <h1>JSON Uploads</h1>
          <p className="subtitle">
            POST JSON to <code>/api/upload</code> to add entries.
          </p>
          <UploadList
            entries={entries}
            onSelect={(id) => navigate(`/entry/${encodeURIComponent(id)}`)}
            onDelete={handleDelete}
          />
        </>
      )}
    </div>
  );
}

export default App;
