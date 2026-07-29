import assert from "node:assert/strict";
import test from "node:test";

import {
  EVALUATION_SCHEMA_VERSION,
  comparisonFor,
  evaluateResult,
  graphIssues,
  validateBaseline,
  validateCases,
} from "../../scripts/runPlanningEvaluation.mjs";

const testCase = {
  id: "quality-case",
  title: "Quality case",
  request: { requirement: "실행 계획을 만들어줘." },
  expectations: {
    forbiddenTerms: ["금지"],
    minimumNodeCount: 2,
    minimumRoadmapStepCount: 2,
    requiredRoadmapTerms: ["완료"],
    requiredTerms: ["준비"],
  },
};

function validResult() {
  return {
    edges: [
      {
        id: "edge-prepare-execute",
        source: "node-prepare",
        target: "node-execute",
      },
    ],
    metadata: {
      model: "test-model",
      promptVersion: "planning-prompt-v2",
    },
    nodes: [
      { id: "node-prepare", label: "준비" },
      { id: "node-execute", label: "실행" },
    ],
    roadmap: [
      {
        componentNodeIds: ["node-prepare"],
        dependsOn: [],
        description: "필요한 준비 항목을 확인하고 완료한다.",
        id: "step-prepare",
        order: 1,
        title: "준비",
      },
      {
        componentNodeIds: ["node-execute"],
        dependsOn: ["step-prepare"],
        description: "준비 결과를 사용해 실행하고 완료한다.",
        id: "step-execute",
        order: 2,
        title: "실행",
      },
    ],
    summary: "준비 후 실행하는 계획",
  };
}

function check(result, name) {
  return result.checks.find((item) => item.name === name);
}

test("valid result passes all quality checks", () => {
  const evaluated = evaluateResult(testCase, validResult());

  assert.equal(evaluated.passed, true);
  assert.equal(evaluated.score, 1);
  assert.deepEqual(evaluated.graphIssues, []);
});

test("component and roadmap cycles are reported", () => {
  const result = validResult();
  result.edges.push({
    id: "edge-execute-prepare",
    source: "node-execute",
    target: "node-prepare",
  });
  result.roadmap[0].dependsOn = ["step-execute"];

  assert.deepEqual(graphIssues(result), [
    "component graph contains a cycle",
    "roadmap dependency graph contains a cycle",
  ]);
});

test("duplicate labels, order gaps, reversed dependencies, and missing coverage fail", () => {
  const result = validResult();
  result.nodes[1].label = " 준비 ";
  result.roadmap[0].componentNodeIds = [];
  result.roadmap[0].dependsOn = ["step-execute"];
  result.roadmap[1].order = 3;

  const evaluated = evaluateResult(testCase, result);

  assert.equal(check(evaluated, "distinctNodeLabels").passed, false);
  assert.equal(check(evaluated, "contiguousRoadmapOrders").passed, false);
  assert.equal(check(evaluated, "dependenciesPrecedeSteps").passed, false);
  assert.equal(check(evaluated, "roadmapCoversAllNodes").passed, false);
  assert.equal(check(evaluated, "executableRoadmapSteps").passed, false);
});

test("case validation rejects duplicate ids and invalid roadmap terms", () => {
  assert.throws(
    () => validateCases([testCase, structuredClone(testCase)]),
    /Duplicate evaluation case id/,
  );
  const invalid = structuredClone(testCase);
  invalid.expectations.requiredRoadmapTerms = "완료";
  assert.throws(() => validateCases([invalid]), /Invalid expectations/);
});

test("baseline schema is enforced and comparison marks score changes", () => {
  const baseline = {
    averageScore: 0.5,
    evaluatedAt: "2026-07-28T00:00:00.000Z",
    evaluationSchemaVersion: EVALUATION_SCHEMA_VERSION,
    results: [
      {
        caseId: "quality-case",
        metadata: { promptVersion: "planning-prompt-v1" },
        passed: false,
        score: 0.5,
      },
    ],
  };
  const report = {
    averageScore: 1,
    results: [
      {
        caseId: "quality-case",
        metadata: { promptVersion: "planning-prompt-v2" },
        passed: true,
        score: 1,
      },
    ],
  };

  validateBaseline(baseline);
  assert.throws(
    () => validateBaseline({ ...baseline, evaluationSchemaVersion: "v1" }),
    /Baseline evaluation schema/,
  );
  assert.deepEqual(comparisonFor(report, baseline), {
    averageScoreDelta: 0.5,
    baselineEvaluatedAt: baseline.evaluatedAt,
    baselinePromptVersions: ["planning-prompt-v1"],
    caseDeltas: [
      {
        caseId: "quality-case",
        passedDelta: "improved",
        scoreDelta: 0.5,
      },
    ],
  });
});
