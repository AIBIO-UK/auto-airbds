import type { UploadEntry } from "../types";

interface Props {
  entries: UploadEntry[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export function UploadList({ entries, selectedId, onSelect, onDelete }: Props) {
  if (entries.length === 0) {
    return <p className="empty">No entries yet.</p>;
  }

  return (
    <ul className="upload-list">
      {entries.map((entry, i) => (
        <li key={entry.id}>
          <button
            className={entry.id === selectedId ? "active" : undefined}
            onClick={() => onSelect(entry.id)}
          >
            <span className="index">#{i + 1}</span>
            <span className="timestamp">{entry.timestamp}</span>
          </button>
          <button className="delete-btn" onClick={() => onDelete(entry.id)}>
            &times;
          </button>
        </li>
      ))}
    </ul>
  );
}
