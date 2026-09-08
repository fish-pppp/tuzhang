import assert from "node:assert/strict";
import { test } from "node:test";
import { buildWebhookPayload, notifyBrief } from "../src/notify.js";
import type { Brief, FetchLike } from "../src/types.js";

const brief = {
  markdown: "# 日报\n高风险 1",
  json: { date: "2026-09-07" },
} as Pick<Brief, "markdown" | "json">;

test("Feishu webhook uses msg_type text", () => {
  const payload = buildWebhookPayload(brief, "https://open.feishu.cn/open-apis/bot/v2/hook/abc");
  assert.equal(payload.msg_type, "text");
  assert.equal((payload.content as { text: string }).text, brief.markdown);
});

test("generic webhook posts markdown and json", () => {
  const payload = buildWebhookPayload(brief, "https://hooks.example.com/digest");
  assert.equal(payload.text, brief.markdown);
  assert.deepEqual(payload.json, brief.json);
});

test("notifyBrief skips dry-run and missing url", async () => {
  const dry = await notifyBrief(brief, { webhookUrl: "https://x", dryRun: true });
  assert.equal(dry.skipped, true);
  const missing = await notifyBrief(brief, {});
  assert.equal(missing.reason, "no-webhook");
});

test("notifyBrief posts when configured", async () => {
  let captured: { url: string; init?: RequestInit } | undefined;
  const fetchImpl: FetchLike = async (url, init) => {
    captured = { url, init };
    return { ok: true, status: 200, async text() { return "ok"; }, async json() { return {}; } };
  };
  const result = await notifyBrief(brief, {
    webhookUrl: "https://hooks.example.com/digest",
    fetchImpl,
  });
  assert.equal(result.skipped, false);
  assert.equal(captured?.url, "https://hooks.example.com/digest");
  assert.match(String(captured?.init?.body), /每日合入|日报/);
});
