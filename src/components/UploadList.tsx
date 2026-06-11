import { datasetInfo, type UploadEntry } from "../types";
import { formatTimestamp } from "../format";
import { moderationStatus } from "../moderation";

interface Props {
  entries: UploadEntry[];
  onSelect: (id: string) => void;
  /**
   * When provided, each entry shows a delete button. Omitted on the public
   * list (which is read-only); supplied on the admin page.
   */
  onDelete?: (id: string) => void;
}

export function UploadList({ entries, onSelect, onDelete }: Props) {
  if (entries.length === 0) {
    return <p className="empty">No entries yet.</p>;
  }

  return (
    <ul className="upload-list">
      {entries.map((entry) => {
        const { name, url, reviewDate, reviewer } = datasetInfo(entry.data);
        const status = moderationStatus();
        return (
          <li key={entry.id}>
            <button onClick={() => onSelect(entry.id)}>
              <span className="field-label">Title:</span>
              <span className="title">{name ?? "(untitled dataset)"}</span>
              <span className="field-label">Dataset URL:</span>
              <span className="url">{url ?? "(no source URL)"}</span>
              <span className="field-label">Performed by:</span>
              <span className="performer">{reviewer ?? "(unknown)"}</span>
              <span className="field-label">Assessment performed:</span>
              <span className="timestamp">
                {reviewDate ? formatTimestamp(reviewDate) : "(unknown)"}
              </span>
              <span className="field-label">ID:</span>
              <span className="entry-id">{entry.id}</span>
              <span className="field-label">Status:</span>
              <span className={`status status-${status}`}>{status}</span>
            </button>
            {onDelete && (
              <button
                className="delete-btn"
                onClick={() => onDelete(entry.id)}
                aria-label="Delete"
                title="Delete"
              >
                {/* Trash icon; uses currentColor so it inherits the button's
                    grey/red-on-hover colour. */}
                <svg
                  className="delete-icon"
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
                </svg>
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
