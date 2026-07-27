import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const DEFAULT_CASES = path.resolve(
  "tests/evaluation/cases/representative-planning-cases.json",
);
const DEFAULT_REPORT_DIR = path.resolve("tests/evaluation/reports");

function parseArguments(argv) {
  const options = {
    baseUrl: "http://localhost:8000",
    casesPath: DEFAULT_CASES,
    dryRun: false,
    model: undefined,
    outputDir: DEFAULT_REPORT_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--dry-run") {
      options.dryRun = true;
    } else if (argument === "--base-url") {
      options.baseUrl = argv[++index];
    } else if (argument === "--cases") {
      options.casesPath = path.resolve(argv[++index]);
    } else if (argument === "--model") {
      options.model = argv[++index];
    } else if (argument === "--output-dir") {
      options.outputDir = path.resolve(argv[++index]);
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return options;
}

function validateCases(cases) {
  if (!Array.isArray(cases) || cases.length === 0) {
    throw new Error("Evaluation cases must be a non-empty array.");
  }
  const ids = new Set();
  for (const item of cases) {
    if (!item.id || !item.title || !item.request?.requirement) {
      throw new Error("Every case needs id, title, and request.requirement.");
    }
    if (ids.has(item.id)) {
      throw new Error(`Duplicate evaluation case id: ${item.id}`);
    }
    ids.add(item.id);
    const expectations = item.expectations;
    if (
      !expectations ||
      !Array.isArray(expectations.requiredTerms) ||
      !Array.isArray(expectations.forbiddenTerms) ||
      !Number.isInteger(expectations.minimumNodeCount) ||
      !Number.isInteger(expectations.minimumRoadmapStepCount)
    ) {
      throw new Error(`Invalid expectations for case: ${item.id}`);
    }
  }
}

function searchableText(result) {
  return JSON.stringify({
    edges: result.edges,
    nodes: result.nodes,
    roadmap: result.roadmap,
    summary: result.summary,
  }).toLocaleLowerCase("ko-KR");
}

function graphIssues(result) {
  const issues = [];
  const nodeIds = new Set(result.nodes.map((node) => node.id));
  const stepIds = new Set(result.roadmap.map((step) => step.id));
  for (const edge of result.edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      issues.push(`edge ${edge.id} references an unknown node`);
    }
    if (edge.source === edge.target) {
      issues.push(`edge ${edge.id} references itself`);
    }
  }
  for (const step of result.roadmap) {
    for (const dependency of step.dependsOn) {
      if (!stepIds.has(dependency)) {
        issues.push(`step ${step.id} references an unknown dependency`);
      }
    }
    for (const nodeId of step.componentNodeIds ?? []) {
      if (!nodeIds.has(nodeId)) {
        issues.push(`step ${step.id} references an unknown node`);
      }
    }
  }
  return issues;
}

function evaluateResult(testCase, result) {
  const text = searchableText(result);
  const requiredTerms = testCase.expectations.requiredTerms.map((term) => ({
    passed: text.includes(term.toLocaleLowerCase("ko-KR")),
    term,
  }));
  const forbiddenTerms = testCase.expectations.forbiddenTerms.map((term) => ({
    passed: !text.includes(term.toLocaleLowerCase("ko-KR")),
    term,
  }));
  const issues = graphIssues(result);
  const checks = [
    {
      name: "minimumNodeCount",
      passed: result.nodes.length >= testCase.expectations.minimumNodeCount,
    },
    {
      name: "minimumRoadmapStepCount",
      passed:
        result.roadmap.length >=
        testCase.expectations.minimumRoadmapStepCount,
    },
    { name: "graphConsistency", passed: issues.length === 0 },
    ...requiredTerms.map((item) => ({
      name: `requiredTerm:${item.term}`,
      passed: item.passed,
    })),
    ...forbiddenTerms.map((item) => ({
      name: `forbiddenTerm:${item.term}`,
      passed: item.passed,
    })),
  ];
  const passedCount = checks.filter((check) => check.passed).length;
  return {
    caseId: testCase.id,
    checks,
    graphIssues: issues,
    metadata: result.metadata,
    passed: passedCount === checks.length,
    score: Number((passedCount / checks.length).toFixed(3)),
    title: testCase.title,
  };
}

async function generateResult(testCase, options) {
  const request = structuredClone(testCase.request);
  if (options.model) {
    request.options = { ...(request.options ?? {}), model: options.model };
  }
  const response = await fetch(`${options.baseUrl.replace(/\/$/, "")}/planning/generate`, {
    body: JSON.stringify(request),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`API ${response.status}: ${body.slice(0, 500)}`);
  }
  return response.json();
}

function markdownReport(report) {
  const lines = [
    "# Planning Evaluation Report",
    "",
    `- Evaluated at: ${report.evaluatedAt}`,
    `- Passed: ${report.passedCount}/${report.caseCount}`,
    `- Average score: ${report.averageScore}`,
    "",
  ];
  for (const item of report.results) {
    lines.push(
      `## ${item.passed ? "PASS" : "FAIL"} · ${item.title}`,
      "",
      `- Case: \`${item.caseId}\``,
      `- Score: ${item.score}`,
      `- Model: ${item.metadata?.model ?? "unknown"}`,
      `- Prompt: ${item.metadata?.promptVersion ?? "unknown"}`,
      "",
      ...item.checks.map(
        (check) => `- [${check.passed ? "x" : " "}] ${check.name}`,
      ),
      "",
    );
  }
  return `${lines.join("\n")}\n`;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const cases = JSON.parse(await readFile(options.casesPath, "utf8"));
  validateCases(cases);
  if (options.dryRun) {
    process.stdout.write(`Validated ${cases.length} evaluation cases.\n`);
    return;
  }

  const results = [];
  for (const testCase of cases) {
    process.stdout.write(`Evaluating ${testCase.id}...\n`);
    const generated = await generateResult(testCase, options);
    results.push(evaluateResult(testCase, generated));
  }
  const evaluatedAt = new Date().toISOString();
  const report = {
    averageScore: Number(
      (
        results.reduce((sum, item) => sum + item.score, 0) / results.length
      ).toFixed(3),
    ),
    caseCount: results.length,
    evaluatedAt,
    passedCount: results.filter((item) => item.passed).length,
    results,
  };
  const fileStamp = evaluatedAt.replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z");
  await mkdir(options.outputDir, { recursive: true });
  const jsonPath = path.join(options.outputDir, `${fileStamp}.json`);
  const markdownPath = path.join(options.outputDir, `${fileStamp}.md`);
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, markdownReport(report), "utf8");
  process.stdout.write(
    `Saved evaluation reports:\n${jsonPath}\n${markdownPath}\n`,
  );
  if (report.passedCount !== report.caseCount) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
  process.exitCode = 1;
});
