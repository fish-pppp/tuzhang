import assert from "node:assert/strict";
import { test } from "node:test";
import { scoreRisk } from "../src/risk.js";
import type { ChangedFile } from "../src/types.js";
import { exampleConfig, normalizedFixture } from "./helpers.js";

const risk = exampleConfig().risk;

test("payment path without tests is HIGH", () => {
  const result = scoreRisk(normalizedFixture("highPayment"), risk);
  assert.equal(result.level, "HIGH");
  assert.ok(result.findings.some((item) => item.id === "risky-file"));
  assert.ok(result.findings.some((item) => item.id === "missing-test"));
  assert.ok(result.findings.some((item) => item.id === "todo-detector"));
});

test("docs-only change stays LOW", () => {
  const result = scoreRisk(normalizedFixture("lowDocs"), risk);
  assert.equal(result.level, "LOW");
  assert.equal(result.findings.length, 0);
});

test("source plus test file is not missing-test", () => {
  const result = scoreRisk(normalizedFixture("withTests"), risk);
  assert.ok(!result.findings.some((item) => item.id === "missing-test"));
});

test("large PR, dependency, deleted tests, debug, concentration", () => {
  const files: ChangedFile[] = [
    {
      oldPath: "package.json",
      newPath: "package.json",
      newFile: false,
      deletedFile: false,
      renamedFile: false,
      addedLines: 300,
      removedLines: 1,
      diff: "+console.log('debug')\n",
    },
    {
      oldPath: "src/foo.test.js",
      newPath: "src/foo.test.js",
      newFile: false,
      deletedFile: true,
      renamedFile: false,
      addedLines: 0,
      removedLines: 20,
      diff: "-test('x') {}\n",
    },
  ];
  const result = scoreRisk({ linesAdded: 320, files }, risk);
  const ids = result.findings.map((item) => item.id);
  assert.ok(ids.includes("large-pr"));
  assert.ok(ids.includes("dependency-change"));
  assert.ok(ids.includes("deleted-tests"));
  assert.ok(ids.includes("debug-artifact"));
  assert.ok(ids.includes("risk-concentration"));
  assert.equal(result.level, "HIGH");
});
