import { describe, expect, it } from "vitest";
// The frontend metric YAML is the source of truth. This test asserts the
// server-side question-id descriptor (which the Functions bundle can't derive
// from the YAML, having no YAML loader) stays in sync with it.
import metricYaml from "../src/metrics/airbds_metric_v0.3.yaml";
import { METRIC_QUESTION_IDS } from "./metrics";

interface RawMetric {
  version: string;
  questions: Record<string, unknown>;
}

describe("server metric descriptor", () => {
  const metric = metricYaml as RawMetric;

  it("lists exactly the metric YAML's question ids, in order, for its version", () => {
    const fromDescriptor = METRIC_QUESTION_IDS[metric.version];
    expect(fromDescriptor).toBeDefined();
    expect([...fromDescriptor]).toEqual(Object.keys(metric.questions));
  });
});
