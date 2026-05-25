import { useEffect, useState } from "react";
import type { UploadEntry } from "./types";
import { UploadList } from "./components/UploadList";
import { EntryView } from "./components/EntryView";

function App() {
  const [entries, setEntries] = useState<UploadEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/entries")
      .then((r) => r.json())
      .then((data) => {
        setEntries(data);
        if (!selectedId && data.length > 0) {
          setSelectedId(data[0].id);
        }
      })
      .catch(() => {});
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
