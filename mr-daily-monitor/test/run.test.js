import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { main } from "../src/cli.js";
import { runDigest } from "../src/run.js";
import { exampleConfig, loadFixtures, mockGitlab } from "./helpers.js";

test("runDigest writes reports and skips webhook in dry-run", async () => {
  const fixtures = loadFixtures();
  const outDir = await mkdtemp(join(tmpdir(), "mrdigest-"));
  const result = await runDigest({
    config: exampleConfig(),
    since: "2026-09-07",
    dryRun: true,
    outDir,
    gitlabClient: mockGitlab({
      "group/app-a": [fixtures.highPayment],
      "group/app-b": [fixtures.lowDocs, fixtures.outsideWindow],
    }),
    openaiClient: {
      chat: {
        completions: {
          async create() {
            return {
              choices: [{ message: { content: "{\"features\":[\"回调重试\"],\"testCases\":[\"幂等\"]}" } }],
            };
          },
        },
      },
    },
  });

  assert.equal(result.mrs.length, 2);
  assert.equal(result.notify.skipped, true);
  const markdown = await readFile(join(outDir, "2026-09-07.md"), "utf8");
  const json = JSON.parse(await readFile(join(outDir, "2026-09-07.json"), "utf8"));
  assert.match(markdown, /支付回调重试/);
  assert.equal(json.summary.total, 2);
  assert.equal(json.mergeRequests.find((mr) => mr.iid === 123).features[0], "回调重试");
});

test("cli run --dry-run uses injected gitlab client", async () => {
  const fixtures = loadFixtures();
  const outDir = await mkdtemp(join(tmpdir(), "mrdigest-cli-"));
  const logs = [];
  const result = await main(
    ["run", "--since", "2026-09-07", "--config", "config.example.yml", "--out-dir", outDir, "--dry-run"],
    {
      env: {
        GITLAB_TOKEN: "glpat-test",
        QWEN_BASE_URL: "https://llm.corp.example.com/v1",
        QWEN_API_KEY: "sk-test",
        QWEN_MODEL: "qwen-plus",
      },
      cwd: new URL("..", import.meta.url).pathname.replace(/test\/$/, ""),
      gitlabClient: mockGitlab({
        "group/app-a": [fixtures.withTests],
        "group/app-b": [],
      }),
      openaiClient: {
        chat: {
          completions: {
            async create() {
              throw new Error("should degrade");
            },
          },
        },
      },
      stdout: { log: (line) => logs.push(line) },
    },
  );

  assert.equal(result.mrs.length, 1);
  assert.equal(result.mrs[0].llmFallback, true);
  assert.ok(logs.some((line) => line.includes(outDir)));
});
