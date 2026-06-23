import { describe, expect, it } from "vitest";
import { assembleImport, type ImportForm } from "./import";
import { metricForVersion, METRIC_QUESTION_IDS } from "./metrics";

const metric = metricForVersion("0.3")!;
const ALL_IDS = METRIC_QUESTION_IDS["0.3"];

// Build the review-info tab as label,value rows (the shape extractReviewInfo
// expects). Overrides let a test omit a field to exercise a missing-field path.
function reviewInfoCsv(
  overrides: Partial<{ name: string; datasetName: string; datasetUrl: string }> = {}
): string {
  const name = overrides.name ?? "Ada Lovelace";
  const datasetName = overrides.datasetName ?? "Test Dataset";
  const datasetUrl = overrides.datasetUrl ?? "https://example.org/ds";
  return [
    `Reviewer name,${name}`,
    `Dataset name,${datasetName}`,
    `Dataset link,${datasetUrl}`,
    "Resource name,FairHub",
    "Accession number,DOI:10.1234/x",
  ].join("\n");
}

// Build the questions tab from an id -> answer map (header row begins "Q ID").
function questionsCsv(answers: Record<string, string>): string {
  const header = "Q ID,Question,Answer,Comments";
  const rows = Object.entries(answers).map(
    ([id, a]) => `${id},Some question text,${a},`
  );
  return [header, ...rows].join("\n");
}

// All 28 questions answered "Yes" — a complete, scorable sheet.
const allYes = (): Record<string, string> =>
  Object.fromEntries(ALL_IDS.map((id) => [id, "Yes"]));

const validForm: ImportForm = {
  reviewDate: "2026-06-15",
  initials: "AL",
  affiliation: "Analytical Engine Co.",
};

describe("assembleImport", () => {
  it("imports a complete sheet + form fields with no problems", () => {
    const out = assembleImport(
      reviewInfoCsv(),
      questionsCsv(allYes()),
      validForm,
      metric
    );
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.data.reviewer.name).toBe("Ada Lovelace");
    expect(out.data.reviewer.review_date).toBe("2026-06-15");
    expect(out.data.reviewer.initials).toBe("AL");
    expect(out.data.reviewer.affiliation).toBe("Analytical Engine Co.");
    expect(out.data.dataset.url).toBe("https://example.org/ds");
    expect(out.data.schema_version).toBe("0.3");
    expect(Object.keys(out.data.answers)).toHaveLength(28);
    expect(out.notices).toEqual([]);
  });

  it("imports a v0.4 sheet and stamps schema_version 0.4 with 27 answers", () => {
    const v04 = metricForVersion("0.4")!;
    const ids = METRIC_QUESTION_IDS["0.4"];
    const answers = Object.fromEntries(ids.map((id) => [id, "Yes"]));
    const out = assembleImport(
      reviewInfoCsv(),
      questionsCsv(answers),
      validForm,
      v04
    );
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    // schema_version comes from the metric (v0.5 converter), not a constant.
    expect(out.data.schema_version).toBe("0.4");
    expect(Object.keys(out.data.answers)).toHaveLength(27);
  });

  it("blocks when the review date is missing", () => {
    const out = assembleImport(reviewInfoCsv(), questionsCsv(allYes()), {
      ...validForm,
      reviewDate: "",
    }, metric);
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.problems).toContain("Review date is required.");
  });

  it("reports an unanswered question by id", () => {
    const answers = allYes();
    answers["ACM-12"] = "";
    const out = assembleImport(
      reviewInfoCsv(),
      questionsCsv(answers),
      validForm,
      metric
    );
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.problems).toContain("ACM-12: not answered.");
  });

  it("reports a non-Yes/No answer with the raw value", () => {
    const answers = allYes();
    answers["ACM-7"] = "Maybe";
    const out = assembleImport(
      reviewInfoCsv(),
      questionsCsv(answers),
      validForm,
      metric
    );
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.problems).toContain('ACM-7: answer "Maybe" is not "Yes" or "No".');
  });

  it("reports missing dataset url from the sheet", () => {
    const out = assembleImport(
      reviewInfoCsv({ datasetUrl: "" }),
      questionsCsv(allYes()),
      validForm,
      metric
    );
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.problems).toContain("Dataset link/URL is missing from the sheet.");
  });

  it("notes blank optional fields and ignored extra answers", () => {
    const answers = allYes();
    answers["ACM-99"] = "Yes"; // not in the metric
    const out = assembleImport(reviewInfoCsv(), questionsCsv(answers), {
      reviewDate: "2026-06-15",
    }, metric);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.notices).toContain(
      "Reviewer initials are blank (optional — not in the sheet)."
    );
    expect(out.notices).toContain(
      "Sheet answer ACM-99 is not in the metric — ignored."
    );
  });
});
