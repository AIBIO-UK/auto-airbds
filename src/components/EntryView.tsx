import { datasetInfo, type UploadEntry } from "../types";
import { formatTimestamp } from "../format";

interface Props {
  entry: UploadEntry;
  onBack: () => void;
}

export function EntryView({ entry, onBack }: Props) {
  const { title, sourceUrl, assessedAt, model } = datasetInfo(entry.data);

  return (
    <div className="entry-view">
      <button className="back-btn" onClick={onBack}>
        &larr; Back to assessments
      </button>
      <div className="entry-fields">
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
      </div>
      <pre>{JSON.stringify(entry.data, null, 2)}</pre>
    </div>
  );
}
