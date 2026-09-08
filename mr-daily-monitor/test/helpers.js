import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeMergeRequest } from "../src/gitlab.js";
import { loadConfig } from "../src/config.js";

const root = dirname(fileURLToPath(import.meta.url));

export function loadFixtures() {
  return JSON.parse(readFileSync(join(root, "fixtures/mrs.json"), "utf8"));
}

export function normalizedFixture(name, fixtures = loadFixtures()) {
  const raw = fixtures[name];
  return normalizeMergeRequest(raw, { changes: raw.changes }, {
    project: raw.project,
    maxDiffChars: 12000,
  });
}

export function exampleConfig(env = {
  GITLAB_TOKEN: "glpat-test",
  QWEN_BASE_URL: "https://llm.corp.example.com/compatible-mode/v1",
  QWEN_API_KEY: "sk-test",
  QWEN_MODEL: "qwen-plus",
}) {
  return loadConfig(join(root, "../config.example.yml"), env);
}

export function mockGitlab(mrsByProject) {
  return {
    async listMergedMrs({ projectId }) {
      return mrsByProject[projectId] ?? [];
    },
    async getChanges(projectId, iid) {
      const mr = (mrsByProject[projectId] ?? []).find((item) => item.iid === iid);
      return { changes: mr?.changes ?? [] };
    },
  };
}
