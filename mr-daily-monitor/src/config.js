import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";

const DEFAULT_RISKY_PATH_GLOBS = [
  "**/auth/**",
  "**/payment/**",
  "**/pay/**",
  "**/*migration*",
  "**/infra/**",
  "**/.gitlab-ci.yml",
  "**/Dockerfile*",
];

const DEFAULT_DEPENDENCY_FILES = [
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "go.mod",
  "go.sum",
  "requirements.txt",
  "poetry.lock",
  "Cargo.toml",
  "pom.xml",
  "build.gradle",
];

const DEFAULT_TEST_GLOBS = [
  "**/*.{test,spec}.*",
  "**/test/**",
  "**/tests/**",
  "**/__tests__/**",
];

function envValue(env, name) {
  if (!name) {
    return undefined;
  }
  const value = env[name];
  return value === undefined || value === "" ? undefined : value;
}

export function loadConfig(configPath, env = process.env) {
  const absolute = resolve(configPath);
  const data = parseYaml(readFileSync(absolute, "utf8")) ?? {};
  const gitlab = data.gitlab ?? {};
  const risk = data.risk ?? {};
  const qwen = data.qwen ?? {};
  const notify = data.notify ?? {};

  return {
    sourcePath: absolute,
    gitlab: {
      url: gitlab.url,
      tokenEnv: gitlab.token_env || "GITLAB_TOKEN",
      token: envValue(env, gitlab.token_env || "GITLAB_TOKEN"),
      projects: Array.isArray(gitlab.projects) ? gitlab.projects : [],
      timezone: gitlab.timezone || "Asia/Shanghai",
    },
    risk: {
      largePrLines: Number(risk.large_pr_lines ?? 300),
      concentrationRatio: Number(risk.concentration_ratio ?? 0.6),
      riskyPathGlobs: risk.risky_path_globs ?? DEFAULT_RISKY_PATH_GLOBS,
      dependencyFiles: risk.dependency_files ?? DEFAULT_DEPENDENCY_FILES,
      testGlobs: risk.test_globs ?? DEFAULT_TEST_GLOBS,
    },
    qwen: {
      enabled: qwen.enabled !== false,
      protocol: qwen.protocol || "compatible",
      timeoutSec: Number(qwen.timeout_sec ?? 60),
      maxDiffChars: Number(qwen.max_diff_chars ?? 12000),
      baseUrlEnv: qwen.base_url_env || "QWEN_BASE_URL",
      apiKeyEnv: qwen.api_key_env || "QWEN_API_KEY",
      modelEnv: qwen.model_env || "QWEN_MODEL",
      baseUrl: envValue(env, qwen.base_url_env || "QWEN_BASE_URL"),
      apiKey: envValue(env, qwen.api_key_env || "QWEN_API_KEY"),
      model: envValue(env, qwen.model_env || "QWEN_MODEL"),
    },
    notify: {
      webhookUrlEnv: notify.webhook_url_env || "FEISHU_WEBHOOK_URL",
      webhookUrl: envValue(env, notify.webhook_url_env || "FEISHU_WEBHOOK_URL"),
    },
  };
}
