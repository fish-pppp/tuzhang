import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import type { AppConfig, EnvMap, QwenProtocol } from "./types.js";

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

interface YamlSection {
  [key: string]: unknown;
}

interface YamlFile {
  gitlab?: YamlSection;
  risk?: YamlSection;
  qwen?: YamlSection;
  notify?: YamlSection;
}

function envValue(env: EnvMap, name?: string): string | undefined {
  if (!name) {
    return undefined;
  }
  const value = env[name];
  return value === undefined || value === "" ? undefined : value;
}

function asStringList(value: unknown, fallback: string[]): string[] {
  return Array.isArray(value) ? value.map(String) : fallback;
}

function asProtocol(value: unknown): QwenProtocol {
  return value === "dashscope" ? "dashscope" : "compatible";
}

export function loadConfig(configPath: string, env: EnvMap = process.env): AppConfig {
  const absolute = resolve(configPath);
  const data = (parseYaml(readFileSync(absolute, "utf8")) ?? {}) as YamlFile;
  const gitlab = data.gitlab ?? {};
  const risk = data.risk ?? {};
  const qwen = data.qwen ?? {};
  const notify = data.notify ?? {};

  return {
    sourcePath: absolute,
    gitlab: {
      url: typeof gitlab.url === "string" ? gitlab.url : undefined,
      tokenEnv: typeof gitlab.token_env === "string" ? gitlab.token_env : "GITLAB_TOKEN",
      token: envValue(env, typeof gitlab.token_env === "string" ? gitlab.token_env : "GITLAB_TOKEN"),
      projects: asStringList(gitlab.projects, []),
      timezone: typeof gitlab.timezone === "string" ? gitlab.timezone : "Asia/Shanghai",
    },
    risk: {
      largePrLines: Number(risk.large_pr_lines ?? 300),
      concentrationRatio: Number(risk.concentration_ratio ?? 0.6),
      minConcentrationLines: Number(risk.min_concentration_lines ?? 80),
      riskyPathGlobs: asStringList(risk.risky_path_globs, DEFAULT_RISKY_PATH_GLOBS),
      dependencyFiles: asStringList(risk.dependency_files, DEFAULT_DEPENDENCY_FILES),
      testGlobs: asStringList(risk.test_globs, DEFAULT_TEST_GLOBS),
    },
    qwen: {
      enabled: qwen.enabled !== false,
      protocol: asProtocol(qwen.protocol),
      timeoutSec: Number(qwen.timeout_sec ?? 60),
      maxDiffChars: Number(qwen.max_diff_chars ?? 12000),
      baseUrlEnv: typeof qwen.base_url_env === "string" ? qwen.base_url_env : "QWEN_BASE_URL",
      apiKeyEnv: typeof qwen.api_key_env === "string" ? qwen.api_key_env : "QWEN_API_KEY",
      modelEnv: typeof qwen.model_env === "string" ? qwen.model_env : "QWEN_MODEL",
      baseUrl: envValue(env, typeof qwen.base_url_env === "string" ? qwen.base_url_env : "QWEN_BASE_URL"),
      apiKey: envValue(env, typeof qwen.api_key_env === "string" ? qwen.api_key_env : "QWEN_API_KEY"),
      model: envValue(env, typeof qwen.model_env === "string" ? qwen.model_env : "QWEN_MODEL"),
    },
    notify: {
      webhookUrlEnv: typeof notify.webhook_url_env === "string" ? notify.webhook_url_env : "FEISHU_WEBHOOK_URL",
      webhookUrl: envValue(env, typeof notify.webhook_url_env === "string" ? notify.webhook_url_env : "FEISHU_WEBHOOK_URL"),
    },
  };
}
