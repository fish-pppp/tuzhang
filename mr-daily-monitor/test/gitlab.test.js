import assert from "node:assert/strict";
import { test } from "node:test";
import { ingestMergedMrs, normalizeMergeRequest, truncateDiff } from "../src/gitlab.js";
import { resolveWindow } from "../src/window.js";
import { loadFixtures, mockGitlab } from "./helpers.js";

test("normalizeMergeRequest counts added lines and keeps metadata", () => {
  const fixtures = loadFixtures();
  const mr = normalizeMergeRequest(fixtures.highPayment, { changes: fixtures.highPayment.changes }, {
    project: "group/pay",
  });
  assert.equal(mr.iid, 123);
  assert.equal(mr.author, "alice");
  assert.equal(mr.files[0].newPath, "src/payment/webhook.js");
  assert.ok(mr.linesAdded >= 3);
  assert.match(mr.diffSummary, /payment\/webhook\.js/);
});

test("truncateDiff stops at max chars", () => {
  const summary = truncateDiff([
    { oldPath: "a.js", newPath: "a.js", diff: "x".repeat(80) },
    { oldPath: "b.js", newPath: "b.js", diff: "y".repeat(80) },
  ], 60);
  assert.match(summary, /truncated/);
  assert.ok(summary.length <= 60);
});

test("ingestMergedMrs keeps only MRs merged in the window", async () => {
  const fixtures = loadFixtures();
  const window = resolveWindow({
    since: "2026-09-07",
    timeZone: "Asia/Shanghai",
  });
  const client = mockGitlab({
    "group/pay": [fixtures.highPayment, fixtures.lowDocs, fixtures.outsideWindow],
  });
  const mrs = await ingestMergedMrs(client, {
    projects: ["group/pay"],
    start: window.start,
    end: window.end,
  });
  assert.deepEqual(mrs.map((mr) => mr.iid), [123, 124]);
});
