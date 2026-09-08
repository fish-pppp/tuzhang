import assert from "node:assert/strict";
import { test } from "node:test";
import {
  callDashscopeQwen,
  dashscopeUrl,
  enrichMr,
  fallbackSemantics,
  parseModelJson,
} from "../src/qwen.js";
import type { FetchLike } from "../src/types.js";
import { exampleConfig, normalizedFixture } from "./helpers.js";
import { scoreRisk } from "../src/risk.js";

test("parseModelJson accepts fenced JSON and test_cases alias", () => {
  const parsed = parseModelJson("```json\n{\"features\":[\"重试\"],\"test_cases\":[\"超时\"]}\n```");
  assert.deepEqual(parsed.features, ["重试"]);
  assert.deepEqual(parsed.testCases, ["超时"]);
});

test("fallbackSemantics uses title and first description line", () => {
  const semantic = fallbackSemantics(normalizedFixture("highPayment"));
  assert.ok(semantic.features.includes("支付回调重试"));
  assert.ok(semantic.llmFallback);
});

test("enrichMr uses compatible client and JSON schema", async () => {
  const config = exampleConfig();
  const mr = {
    ...normalizedFixture("highPayment"),
    risk: scoreRisk(normalizedFixture("highPayment"), config.risk),
  };
  const openaiClient = {
    chat: {
      completions: {
        async create() {
          return {
            choices: [
              { message: { content: "{\"features\":[\"失败回调重试\"],\"testCases\":[\"超时重试\"]}" } },
            ],
          };
        },
      },
    },
  };
  const enriched = await enrichMr(mr, { qwen: config.qwen, openaiClient });
  assert.equal(enriched.llmFallback, false);
  assert.deepEqual(enriched.features, ["失败回调重试"]);
  assert.deepEqual(enriched.testCases, ["超时重试"]);
});

test("enrichMr degrades when qwen is disabled or the model fails", async () => {
  const mr = normalizedFixture("lowDocs");
  const disabled = await enrichMr(mr, { qwen: { enabled: false } });
  assert.equal(disabled.llmFallback, true);
  assert.ok(disabled.features?.includes("更新 README"));

  const failed = await enrichMr(mr, {
    qwen: {
      enabled: true,
      protocol: "compatible",
      baseUrl: "https://llm.corp.example.com/v1",
      apiKey: "sk",
      model: "qwen-plus",
    },
    openaiClient: {
      chat: {
        completions: {
          async create() {
            throw new Error("gateway down");
          },
        },
      },
    },
  });
  assert.equal(failed.llmFallback, true);
  assert.match(failed.llmError ?? "", /gateway down/);
});

test("dashscope protocol posts native generation body", async () => {
  assert.equal(
    dashscopeUrl("https://llm.corp.example.com"),
    "https://llm.corp.example.com/api/v1/services/aigc/text-generation/generation",
  );

  let captured: { url: string; init?: RequestInit } | undefined;
  const fetchImpl: FetchLike = async (url, init) => {
    captured = { url, init };
    return {
      ok: true,
      status: 200,
      async text() {
        return "";
      },
      async json() {
        return { output: { choices: [{ message: { content: "{\"features\":[\"A\"],\"testCases\":[\"B\"]}" } }] } };
      },
    };
  };
  const text = await callDashscopeQwen({
    baseUrl: "https://llm.corp.example.com",
    apiKey: "sk",
    model: "qwen-plus",
    messages: [{ role: "user", content: "hi" }],
    fetchImpl,
  });
  assert.match(text, /features/);
  assert.equal(captured?.url, "https://llm.corp.example.com/api/v1/services/aigc/text-generation/generation");
  const body = JSON.parse(String(captured?.init?.body)) as {
    model: string;
    input: { messages: Array<{ content: string }> };
  };
  assert.equal(body.model, "qwen-plus");
  assert.equal(body.input.messages[0]?.content, "hi");
});
