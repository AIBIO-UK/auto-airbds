import { describe, expect, it } from "vitest";
// The frontend metric YAML is the source of truth. This test asserts the
// server-side question-id descriptor (which the Functions bundle can't derive
// from the YAML, having no YAML loader) stays in sync with it.
import metricYaml from "../src/metrics/airbds_metric_v0.3.yaml";
import { METRIC_ETHICS_IDS, METRIC_QUESTION_IDS, metricForVersion } from "./metrics";

interface RawMetric {
  version: string;
  questions: Record<string, { scope?: string }>;
}

describe("server metric descriptor", () => {
  const metric = metricYaml as RawMetric;

  it("lists exactly the metric YAML's question ids, in order, for its version", () => {
    const fromDescriptor = METRIC_QUESTION_IDS[metric.version];
    expect(fromDescriptor).toBeDefined();
    expect([...fromDescriptor]).toEqual(Object.keys(metric.questions));
  });

  it("lists exactly the metric YAML's Ethics-scope ids for its version", () => {
    const fromDescriptor = METRIC_ETHICS_IDS[metric.version];
    expect(fromDescriptor).toBeDefined();
    const ethicsFromYaml = Object.entries(metric.questions)
      .filter(([, q]) => q.scope === "Ethics")
      .map(([id]) => id);
    expect([...fromDescriptor]).toEqual(ethicsFromYaml);
  });

  it("builds a converter Metric with question ids and the Ethics set", () => {
    const m = metricForVersion(metric.version);
    expect(m).not.toBeNull();
    expect(m!.questionIds).toEqual(Object.keys(metric.questions));
    expect([...m!.ethicsIds].sort()).toEqual(
      [...METRIC_ETHICS_IDS[metric.version]].sort()
    );
    expect(metricForVersion("9.9")).toBeNull();
    expect(metricForVersion(undefined)).toBeNull();
  });
});
