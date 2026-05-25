import type { UploadEntry } from "../types";

interface Props {
  entry: UploadEntry;
}

export function EntryView({ entry }: Props) {
  return (
    <div className="entry-view">
      <div className="entry-meta">
        <strong>ID:</strong> {entry.id}
        <br />
        <strong>Timestamp:</strong> {entry.timestamp}
      </div>
      <pre>{JSON.stringify(entry.data, null, 2)}</pre>
    </div>
  );
}
