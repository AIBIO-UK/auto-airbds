// Runs under Node (not jsdom) so import.meta.url is a file: URL and the example
// fixture can be read from disk.
// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseAndValidate, validateAssessment } from "./validation";
import { METRIC_QUESTION_IDS } from "./metrics";

const IDS = METRIC_QUESTION_IDS["0.3"];

/** A complete, valid assessment object for metric version 0.3. */
function validObject(): Record<string, unknown> {
  const answers: Record<string, unknown> = {};
  for (const id of IDS) answers[id] = { answer: "Yes", comments: "ok" };
  return {
    schema_version: "0.3",
    reviewer: { name: "claude-opus-4-7", review_date: "2026-05-26" },
    dataset: { name: "A dataset", url: "https://example.org/d", comments: "fine" },
    answers,
  };
}

/** Serialise a valid object as real YAML syntax (not JSON). */
function toYaml(obj: ReturnType<typeof validObject>): string {
  const reviewer = obj.reviewer as Record<string, string>;
  const dataset = obj.dataset as Record<string, string>;
  const answers = obj.answers as Record<string, { answer: string; comments: string }>;
  return [
    `schema_version: "${obj.schema_version}"`,
    `reviewer:`,
    `  name: "${reviewer.name}"`,
    `  review_date: "${reviewer.review_date}"`,
    `dataset:`,
    `  name: "${dataset.name}"`,
    `  url: "${dataset.url}"`,
    `  comments: "${dataset.comments}"`,
    `answers:`,
    ...Object.entries(answers).map(
      ([id, a]) => `  ${id}: { answer: "${a.answer}", comments: "${a.comments}" }`
    ),
  ].join("\n");
}

describe("parseAndValidate", () => {
  it("accepts a complete assessment as YAML", () => {
    const result = parseAndValidate(toYaml(validObject()));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.data as { schema_version: string }).schema_version).toBe("0.3");
    }
  });

  it("accepts a complete assessment as JSON (YAML is a superset)", () => {
    const result = parseAndValidate(JSON.stringify(validObject()));
    expect(result.ok).toBe(true);
  });

  it("rejects unparseable input with 400", () => {
    const result = parseAndValidate("[1, 2");
    expect(result).toMatchObject({ ok: false, status: 400 });
  });

  it("rejects an oversized body with 413 before parsing", () => {
    const result = parseAndValidate("#".repeat(256 * 1024 + 1));
    expect(result).toMatchObject({ ok: false, status: 413 });
  });

  it("rejects an incomplete assessment with 400", () => {
    const obj = validObject();
    delete (obj.answers as Record<string, unknown>)["ACM-5"];
    const result = parseAndValidate(JSON.stringify(obj));
    expect(result).toMatchObject({ ok: false, status: 400 });
  });
});

describe("parseAndValidate security hardening", () => {
  it("rejects a billion-laughs / alias-bomb payload (does not expand it)", () => {
    // Tiny source (~325 bytes, well under the size cap) that would expand to
    // ~9^9 nodes if the aliases were resolved. maxAliasCount must stop it.
    const bomb = [
      'a: &a ["x","x","x","x","x","x","x","x","x"]',
      "b: &b [*a,*a,*a,*a,*a,*a,*a,*a,*a]",
      "c: &c [*b,*b,*b,*b,*b,*b,*b,*b,*b]",
      "d: &d [*c,*c,*c,*c,*c,*c,*c,*c,*c]",
      "e: &e [*d,*d,*d,*d,*d,*d,*d,*d,*d]",
      "f: &f [*e,*e,*e,*e,*e,*e,*e,*e,*e]",
      "g: &g [*f,*f,*f,*f,*f,*f,*f,*f,*f]",
      "h: &h [*g,*g,*g,*g,*g,*g,*g,*g,*g]",
      "i: &i [*h,*h,*h,*h,*h,*h,*h,*h,*h]",
    ].join("\n");
    const result = parseAndValidate(bomb);
    expect(result).toMatchObject({ ok: false, status: 400 });
  });

  it("does not pollute Object.prototype via a __proto__ key", () => {
    parseAndValidate('__proto__:\n  polluted: true');
    parseAndValidate(JSON.stringify({ __proto__: { polluted: true } }));
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("never executes code for language/custom tags (no PyYAML-style RCE)", () => {
    // The tag must be inert: parsing yields plain data, nothing is instantiated
    // or run. (It still fails validation, as it isn't a complete assessment.)
    const result = parseAndValidate(
      '!!python/object/apply:os.system ["echo pwned"]'
    );
    expect(result.ok).toBe(false);
  });
});

describe("validateAssessment", () => {
  it("passes a complete assessment", () => {
    expect(validateAssessment(validObject())).toBeNull();
  });

  it("ignores unrecognised extra answer keys", () => {
    const obj = validObject();
    (obj.answers as Record<string, unknown>)["ZZZ-99"] = { answer: "Yes" };
    expect(validateAssessment(obj)).toBeNull();
  });

  it("rejects a non-mapping payload", () => {
    expect(validateAssessment("nope")).toMatch(/mapping/);
    expect(validateAssessment(null)).toMatch(/mapping/);
  });

  it("rejects a missing or unknown metric version", () => {
    const noVersion = validObject();
    delete noVersion.schema_version;
    expect(validateAssessment(noVersion)).toMatch(/schema_version/);

    const badVersion = validObject();
    badVersion.schema_version = "9.9";
    expect(validateAssessment(badVersion)).toMatch(/Unknown metric version/);
  });

  it("rejects missing reviewer identity fields", () => {
    const noName = validObject();
    (noName.reviewer as Record<string, unknown>).name = "";
    expect(validateAssessment(noName)).toMatch(/reviewer\.name/);

    const noDate = validObject();
    delete (noDate.reviewer as Record<string, unknown>).review_date;
    expect(validateAssessment(noDate)).toMatch(/review_date/);
  });

  it("rejects missing dataset identity fields", () => {
    const noName = validObject();
    delete (noName.dataset as Record<string, unknown>).name;
    expect(validateAssessment(noName)).toMatch(/dataset\.name/);

    const noUrl = validObject();
    (noUrl.dataset as Record<string, unknown>).url = "   ";
    expect(validateAssessment(noUrl)).toMatch(/dataset\.url/);
  });

  it("rejects a missing answer", () => {
    const obj = validObject();
    delete (obj.answers as Record<string, unknown>)["ACM-12"];
    expect(validateAssessment(obj)).toBe("Missing answer for ACM-12");
  });

  it("rejects an answer that is not Yes or No", () => {
    const obj = validObject();
    (obj.answers as Record<string, { answer: string }>)["ACM-1"].answer = "Maybe";
    expect(validateAssessment(obj)).toMatch(/must be "Yes" or "No"/);
  });
});

describe("example fixture", () => {
  it("accepts the committed example assessment as a complete upload", () => {
    // Guards against the example regressing (e.g. a blank review_date), so it
    // always uploads directly via the Upload button / POST, not just via the
    // helper script that backfills the date.
    const yaml = readFileSync(
      fileURLToPath(
        new URL("../scripts/example-assessment-1.yaml", import.meta.url)
      ),
      "utf8"
    );
    expect(parseAndValidate(yaml).ok).toBe(true);
  });
});
