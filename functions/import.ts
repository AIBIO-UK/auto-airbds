import {
  buildReview,
  extractAnswers,
  extractReviewInfo,
  parseCsv,
  type Metric,
  type Review,
} from "@airbds/converter-tools";
import { validateAssessment } from "./validation";

// Fields the reviewer supplies in the import form. The AIRBDS spreadsheet
// template carries no reviewer date/initials/affiliation, so they come from the
// form rather than the sheet. review_date is required for a scorable assessment;
// initials/affiliation are optional but stored when given.
export interface ImportForm {
  reviewDate: string;
  initials?: string;
  affiliation?: string;
}

export type ImportOutcome =
  | { ok: true; data: Review; notices: string[] }
  | { ok: false; problems: string[] };

/**
 * Turn the two fetched CSV tabs plus the form fields into a complete, scorable
 * review, or a list of everything the reviewer must fix. Uses the converter's
 * lower-level exports (not its all-in-one `convert`) so we can report *every*
 * problem with the exact offending question id / sheet value, rather than only
 * the first one. The final gate is the same `validateAssessment` the YAML upload
 * path uses, so both ingest routes enforce identical completeness rules.
 *
 * May throw if the sheet is structurally unparseable (e.g. the questions tab has
 * no "Q ID" header); the caller turns that into a 400.
 */
export function assembleImport(
  reviewCsv: string,
  questionsCsv: string,
  form: ImportForm,
  metric: Metric
): ImportOutcome {
  const info = extractReviewInfo(parseCsv(reviewCsv));
  const sheetAnswers = extractAnswers(parseCsv(questionsCsv));
  const { review } = buildReview(info, sheetAnswers, metric);

  // Merge the form-supplied fields the sheet can't provide.
  review.reviewer.review_date = form.reviewDate.trim();
  if (form.initials?.trim()) review.reviewer.initials = form.initials.trim();
  if (form.affiliation?.trim()) {
    review.reviewer.affiliation = form.affiliation.trim();
  }

  const problems: string[] = [];
  const notices: string[] = [];

  // Fields that must come from the sheet.
  if (!review.reviewer.name) {
    problems.push("Reviewer name is missing from the sheet.");
  }
  if (!review.dataset.name) {
    problems.push("Dataset name is missing from the sheet.");
  }
  if (!review.dataset.url) {
    problems.push("Dataset link/URL is missing from the sheet.");
  }

  // Every question must be answered "Yes" or "No". Report the raw sheet value so
  // the reviewer knows exactly which cells to fix.
  for (const id of metric.questionIds) {
    const raw = (sheetAnswers.get(id)?.answer ?? "").trim();
    if (raw !== "Yes" && raw !== "No") {
      problems.push(
        raw
          ? `${id}: answer "${raw}" is not "Yes" or "No".`
          : `${id}: not answered.`
      );
    }
  }

  // review_date is form-supplied and required.
  if (!review.reviewer.review_date) {
    problems.push("Review date is required.");
  }

  // Non-blocking notices: optional fields and ignored extra answers.
  if (!review.reviewer.initials) {
    notices.push("Reviewer initials are blank (optional — not in the sheet).");
  }
  if (!review.reviewer.affiliation) {
    notices.push(
      "Reviewer affiliation is blank (optional — not in the sheet)."
    );
  }
  for (const id of sheetAnswers.keys()) {
    if (!metric.questionIds.includes(id)) {
      notices.push(`Sheet answer ${id} is not in the metric — ignored.`);
    }
  }

  if (problems.length > 0) return { ok: false, problems };

  // Authoritative gate, identical to the YAML upload path. If it fails while we
  // found no problems, surface it rather than storing a bad record.
  const error = validateAssessment(review);
  if (error) return { ok: false, problems: [error] };

  return { ok: true, data: review, notices };
}
