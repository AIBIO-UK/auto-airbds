import { useEffect, useState } from "react";
import type { UploadEntry } from "./types";
import { UploadList } from "./components/UploadList";
import { EntryView } from "./components/EntryView";

function App() {
  const [entries, setEntries] = useState<UploadEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    function load() {
      fetch("/api/entries")
        .then((r) => r.json())
        .then((data: UploadEntry[]) => {
          if (cancelled) return;
          setEntries(data);
          setSelectedId((current) =>
            current ?? (data.length > 0 ? data[0].id : null)
          );
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
    if (selectedId === id) setSelectedId(null);
  }

  const selected = entries.find((e) => e.id === selectedId) ?? null;

  return (
    <div className="app">
      <header>auto-AIRBDS</header>
      <div className="banner" role="alert">
        <strong>Experimental and under development.</strong> Do not rely on any
        of the assessments shown, they may be entirely wrong. Uploaded assessments may be deleted at any
        time.
      </div>
      <h1>JSON Uploads</h1>
      <p className="subtitle">
        POST JSON to <code>/api/upload</code> to add entries.
      </p>
      <div className="main">
        <nav>
          <UploadList
            entries={entries}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onDelete={handleDelete}
          />
        </nav>
        <section>
          {selected ? (
            <EntryView entry={selected} />
          ) : (
            <p className="empty">Select an entry to view.</p>
          )}
        </section>
      </div>
    </div>
  );
}

export default App;
