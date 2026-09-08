import assert from "node:assert/strict";
import { test } from "node:test";
import { exampleConfig } from "./helpers.js";

test("example config reads env-backed tokens and qwen settings", () => {
  const config = exampleConfig({
    GITLAB_TOKEN: "glpat-secret",
    QWEN_BASE_URL: "https://llm.corp.example.com/compatible-mode/v1",
    QWEN_API_KEY: "sk-corp",
    QWEN_MODEL: "qwen-plus",
    FEISHU_WEBHOOK_URL: "https://open.feishu.cn/open-apis/bot/v2/hook/x",
  });
  assert.equal(config.gitlab.token, "glpat-secret");
  assert.equal(config.gitlab.timezone, "Asia/Shanghai");
  assert.ok(config.gitlab.projects.includes("group/app-a"));
  assert.equal(config.qwen.protocol, "compatible");
  assert.equal(config.qwen.model, "qwen-plus");
  assert.equal(config.notify.webhookUrl.includes("feishu"), true);
});
