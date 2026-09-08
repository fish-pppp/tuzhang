import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../src/config.js";
import { normalizeMergeRequest } from "../src/gitlab.js";
import type { EnvMap, GitlabClient, MergeRequest, RawGitlabChange, RawGitlabMr } from "../src/types.js";

const root = dirname(fileURLToPath(import.meta.url));

export interface FixtureMr extends RawGitlabMr {
  project: string;
  changes: RawGitlabChange[];
}

export type FixtureName = "highPayment" | "lowDocs" | "outsideWindow" | "withTests";

export function loadFixtures(): Record<FixtureName, FixtureMr> {
  return JSON.parse(readFileSync(join(root, "fixtures/mrs.json"), "utf8")) as Record<FixtureName, FixtureMr>;
}

export function normalizedFixture(name: FixtureName, fixtures = loadFixtures()): MergeRequest {
  const raw = fixtures[name];
  return normalizeMergeRequest(raw, { changes: raw.changes }, {
    project: raw.project,
    maxDiffChars: 12000,
  });
}

export function exampleConfig(env: EnvMap = {
  GITLAB_TOKEN: "glpat-test",
  QWEN_BASE_URL: "https://llm.corp.example.com/compatible-mode/v1",
  QWEN_API_KEY: "sk-test",
  QWEN_MODEL: "qwen-plus",
}) {
  return loadConfig(join(root, "../config.example.yml"), env);
}

export function mockGitlab(mrsByProject: Record<string, FixtureMr[]>): GitlabClient {
  return {
    async listMergedMrs({ projectId }) {
      return mrsByProject[String(projectId)] ?? [];
    },
    async getChanges(projectId, iid) {
      const mr = (mrsByProject[String(projectId)] ?? []).find((item) => item.iid === iid);
      return { changes: mr?.changes ?? [] };
    },
  };
}
