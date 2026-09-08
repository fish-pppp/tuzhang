import assert from "node:assert/strict";
import { test } from "node:test";
import { renderBrief, sortMrsForTesting } from "../src/brief.js";
import { fallbackSemantics } from "../src/qwen.js";
import { scoreRisk } from "../src/risk.js";
import type { AppConfig, MergeRequest } from "../src/types.js";
import { resolveWindow } from "../src/window.js";
import { exampleConfig, normalizedFixture, type FixtureName } from "./helpers.js";

function scored(name: FixtureName, config: AppConfig): MergeRequest {
  const mr = normalizedFixture(name);
  const risk = scoreRisk(mr, config.risk);
  return { ...mr, risk, ...fallbackSemantics(mr) };
}

test("sorts HIGH before LOW", () => {
  const config = exampleConfig();
  const sorted = sortMrsForTesting([
    scored("lowDocs", config),
    scored("highPayment", config),
  ]);
  assert.equal(sorted[0]?.iid, 123);
  assert.equal(sorted[1]?.iid, 124);
});

test("renderBrief puts high-risk MRs under 优先测", () => {
  const config = exampleConfig();
  const window = resolveWindow({ since: "2026-09-07", timeZone: "Asia/Shanghai" });
  const brief = renderBrief([scored("lowDocs", config), scored("highPayment", config)], window);
  assert.match(brief.markdown, /每日合入测试简报 2026-09-07/);
  assert.match(brief.markdown, /高风险 1 \/ 中风险 0 \/ 低风险 1/);
  const priorityIndex = brief.markdown.indexOf("## 优先测");
  const restIndex = brief.markdown.indexOf("## 其他合入功能");
  const highIndex = brief.markdown.indexOf("!123");
  const lowIndex = brief.markdown.indexOf("!124");
  assert.ok(priorityIndex < highIndex && highIndex < restIndex);
  assert.ok(restIndex < lowIndex);
  assert.equal(brief.json.summary.HIGH, 1);
  assert.equal(brief.json.mergeRequests[0]?.iid, 123);
});
