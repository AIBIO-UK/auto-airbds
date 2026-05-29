import { datasetInfo, type UploadEntry } from "../types";
import { formatTimestamp } from "../format";

interface Props {
  entries: UploadEntry[];
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export function UploadList({ entries, onSelect, onDelete }: Props) {
  if (entries.length === 0) {
    return <p className="empty">No entries yet.</p>;
  }

  return (
    <ul className="upload-list">
      {entries.map((entry) => {
        const { title, sourceUrl, assessedAt, model } = datasetInfo(entry.data);
        return (
          <li key={entry.id}>
            <button onClick={() => onSelect(entry.id)}>
              <span className="field-label">Title:</span>
              <span className="title">{title ?? "(untitled dataset)"}</span>
              <span className="field-label">Dataset URL:</span>
              <span className="url">{sourceUrl ?? "(no source URL)"}</span>
              <span className="field-label">Performed by:</span>
              <span className="performer">{model ?? "(unknown)"}</span>
              <span className="field-label">Assessment performed:</span>
              <span className="timestamp">
                {assessedAt ? formatTimestamp(assessedAt) : "(unknown)"}
              </span>
              <span className="field-label">ID:</span>
              <span className="entry-id">{entry.id}</span>
            </button>
            <button className="delete-btn" onClick={() => onDelete(entry.id)}>
              &times;
            </button>
          </li>
        );
      })}
    </ul>
  );
}
