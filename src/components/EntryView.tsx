import { assessmentDetails, datasetInfo, type UploadEntry } from "../types";
import { formatTimestamp } from "../format";
import { moderationStatus } from "../moderation";
import { AssessmentReport } from "./AssessmentReport";

interface Props {
  entry: UploadEntry;
  onBack: () => void;
}

export function EntryView({ entry, onBack }: Props) {
  const { name, url, reviewDate, reviewer, metricVersion } = datasetInfo(
    entry.data
  );
  const hasReport = assessmentDetails(entry.data).results.length > 0;
  const status = moderationStatus();

  return (
    <div className="entry-view">
      <button className="back-btn" onClick={onBack}>
        &larr; Back to assessments
      </button>
      <div className="entry-fields">
        <span className="field-label">Title:</span>
        <span className="title">{name ?? "(untitled dataset)"}</span>
        <span className="field-label">Dataset URL:</span>
        <span className="url">{url ?? "(no source URL)"}</span>
        <span className="field-label">Performed by:</span>
        <span className="performer">{reviewer ?? "(unknown)"}</span>
        <span className="field-label">AIRBDS version:</span>
        <span>{metricVersion ?? "(unknown)"}</span>
        <span className="field-label">Assessment performed:</span>
        <span className="timestamp">
          {reviewDate ? formatTimestamp(reviewDate) : "(unknown)"}
        </span>
        <span className="field-label">ID:</span>
        <span className="entry-id">{entry.id}</span>
        <span className="field-label">Status:</span>
        <span className={`status status-${status}`}>{status}</span>
      </div>
      {hasReport ? (
        <AssessmentReport data={entry.data} metricVersion={metricVersion} />
      ) : (
        <pre>{JSON.stringify(entry.data, null, 2)}</pre>
      )}
    </div>
  );
}
