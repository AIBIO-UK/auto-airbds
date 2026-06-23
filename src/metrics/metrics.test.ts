import { describe, expect, it } from "vitest";
import airbds03 from "./airbds_metric_v0.3.yaml";
import airbds04 from "./airbds_metric_v0.4.yaml";
import {
  questionMeta,
  questionScore,
  questionMaxScore,
  maxScore,
  computeGrade,
  hasMetricVersion,
  SUPPORTED_VERSIONS,
  supportedVersionsLabel,
} from "./index";

// Read each metric definition straight from its YAML so these tests track the
// files: if the questions, grades, points, or thresholds change, the tests use
// the new values rather than stale hard-coded ones. (The metric is pre-release
// and still changing.) The suite runs once per registered version so v0.3 and
// v0.4 are both exercised; `theme` is v0.3-only, so it is optional here.
interface RawQuestion {
  scope: string;
  theme?: string;
  grade: string;
  question: string;
}
interface RawGrade {
  name: string;
  description?: string;
  min_proportion_yes: Record<string, number>;
  min_score: number;
}
interface RawMetric {
  version: string;
  grade_points: Record<string, number>;
  grading: RawGrade[];
  questions: Record<string, RawQuestion>;
}

const METRICS = [airbds03, airbds04] as RawMetric[];

for (const METRIC of METRICS) {
  const VERSION = METRIC.version;
  const QUESTIONS = METRIC.questions;
  const GRADE_POINTS = METRIC.grade_points;
  const GRADING = METRIC.grading;
  const ALL_IDS = Object.keys(QUESTIONS);

  // Question ids grouped by grade, derived from the YAML.
  const idsByGrade: Record<string, string[]> = {};
  for (const [id, q] of Object.entries(QUESTIONS)) {
    (idsByGrade[q.grade] ??= []).push(id);
  }

  /** Build an answer set over every question where the listed ids are "Yes". */
  function answersWithYes(yesIds: string[]) {
    const yes = new Set(yesIds);
    return ALL_IDS.map((id) => ({
      questionId: id,
      answer: yes.has(id) ? "Yes" : "No",
    }));
  }

  describe(`metric v${VERSION} question lookup`, () => {
    it("exposes scope/theme/grade/question matching the YAML for every question", () => {
      for (const [id, q] of Object.entries(QUESTIONS)) {
        // `theme` is only present in versions that define it (v0.3), so the
        // expected meta includes it only when the YAML question carries one.
        const expected: Record<string, string> = {
          scope: q.scope,
          grade: q.grade,
          question: q.question,
        };
        if (q.theme !== undefined) expected.theme = q.theme;
        expect(questionMeta(VERSION, id)).toEqual(expected);
      }
    });

    it("returns null for unknown versions, questions, or missing args", () => {
      expect(questionMeta("0.99", ALL_IDS[0])).toBeNull();
      expect(questionMeta(VERSION, "ZZZ-does-not-exist")).toBeNull();
      expect(questionMeta(null, ALL_IDS[0])).toBeNull();
      expect(questionMeta(VERSION, null)).toBeNull();
    });

    it("scores a Yes at the grade's full points and a No at 0", () => {
      for (const id of ALL_IDS) {
        const points = GRADE_POINTS[QUESTIONS[id].grade];
        expect(questionScore(VERSION, id, "Yes")).toBe(points);
        expect(questionScore(VERSION, id, "No")).toBe(0);
        expect(questionMaxScore(VERSION, id)).toBe(points);
      }
    });

    it("returns null score for unknown versions/questions or non-Yes/No answers", () => {
      expect(questionScore("0.99", ALL_IDS[0], "Yes")).toBeNull();
      expect(questionScore(VERSION, "ZZZ-does-not-exist", "Yes")).toBeNull();
      expect(questionScore(VERSION, ALL_IDS[0], "Maybe")).toBeNull();
      expect(questionScore(VERSION, ALL_IDS[0], null)).toBeNull();
      expect(questionMaxScore(VERSION, "ZZZ-does-not-exist")).toBeNull();
      expect(questionMaxScore(null, ALL_IDS[0])).toBeNull();
    });

    it("computes the max score as the sum of every question's full points", () => {
      const expected = ALL_IDS.reduce(
        (sum, id) => sum + GRADE_POINTS[QUESTIONS[id].grade],
        0
      );
      expect(maxScore(VERSION)).toBe(expected);
      expect(maxScore("0.99")).toBeNull();
      expect(maxScore(null)).toBeNull();
    });

    describe("computeGrade", () => {
      // The minimal answer set that meets a grade's required proportions: for
      // each category, mark the first ceil(min_proportion * count) questions Yes.
      function witnessFor(grade: RawGrade): string[] {
        const yes: string[] = [];
        for (const [category, ids] of Object.entries(idsByGrade)) {
          const minProportion = grade.min_proportion_yes[category] ?? 0;
          yes.push(...ids.slice(0, Math.ceil(minProportion * ids.length)));
        }
        return yes;
      }

      it("awards each grade for an answer set that just meets its thresholds", () => {
        for (const grade of GRADING) {
          const yesIds = witnessFor(grade);
          const score = yesIds.reduce(
            (sum, id) => sum + GRADE_POINTS[QUESTIONS[id].grade],
            0
          );
          // Sanity: a witness built from the proportions should also clear the
          // grade's minimum score (true for the current thresholds).
          expect(score).toBeGreaterThanOrEqual(grade.min_score);
          expect(computeGrade(VERSION, answersWithYes(yesIds))?.name).toBe(
            grade.name
          );
        }
      });

      it("awards the highest grade when every answer is Yes", () => {
        expect(computeGrade(VERSION, answersWithYes(ALL_IDS))?.name).toBe(
          GRADING[0].name
        );
      });

      it("awards the floor grade when every answer is No", () => {
        expect(computeGrade(VERSION, answersWithYes([]))?.name).toBe(
          GRADING[GRADING.length - 1].name
        );
      });

      it("returns null for an unknown version", () => {
        expect(computeGrade("0.99", answersWithYes(ALL_IDS))).toBeNull();
      });
    });

    it("reports which metric versions are available", () => {
      expect(hasMetricVersion(VERSION)).toBe(true);
      expect(hasMetricVersion("0.99")).toBe(false);
      expect(hasMetricVersion(null)).toBe(false);
    });
  });
}

describe("supported versions", () => {
  // Derived from the registry (built from the imported YAMLs), so this tracks
  // whatever versions are registered rather than a hard-coded list.
  const expected = METRICS.map((m) => m.version).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  );

  it("lists exactly the registered metric versions, ascending", () => {
    expect(SUPPORTED_VERSIONS).toEqual(expected);
    for (const v of SUPPORTED_VERSIONS) expect(hasMetricVersion(v)).toBe(true);
  });

  it("labels the supported range from first to last version", () => {
    expect(supportedVersionsLabel()).toBe(
      `v${expected[0]}–v${expected[expected.length - 1]}`
    );
  });
});
