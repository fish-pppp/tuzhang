import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { config as loadDotenv } from "dotenv";
import { loadConfig } from "./config.js";
import { runDigest, type DigestResult } from "./run.js";
import type { ChatCompletionsClient, EnvMap, FetchLike, GitlabClient } from "./types.js";

function printHelp(): void {
  console.log(`Usage:
  mrdigest run --since yesterday [--config config.yml]
  mrdigest run --since today
  mrdigest run --since 2026-09-07
  mrdigest run --from 2026-09-07T00:00:00+08:00 --to 2026-09-08T00:00:00+08:00

Options:
  --config, -c   YAML 配置文件，默认 config.yml
  --since        yesterday | today | YYYY-MM-DD
  --from         窗口开始（需同时给 --to）
  --to           窗口结束
  --out-dir      报告目录，默认 reports
  --dry-run      只写本地报告，不发 webhook
  --help         显示帮助
`);
}

export function parseCli(argv: string[]) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      config: { type: "string", short: "c", default: "config.yml" },
      since: { type: "string" },
      from: { type: "string" },
      to: { type: "string" },
      "out-dir": { type: "string", default: "reports" },
      "dry-run": { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
  });

  return {
    command: positionals[0] ?? "run",
    extra: positionals.slice(1),
    values,
  };
}

export interface MainOptions {
  env?: EnvMap;
  cwd?: string;
  gitlabClient?: GitlabClient;
  openaiClient?: ChatCompletionsClient;
  fetchImpl?: FetchLike;
  stdout?: { log: (line: string) => void };
}

export async function main(argv: string[], {
  env = process.env,
  cwd = process.cwd(),
  gitlabClient,
  openaiClient,
  fetchImpl,
  stdout = console,
}: MainOptions = {}): Promise<DigestResult | { ok: true; help: true }> {
  loadDotenv({ path: `${cwd}/.env` });
  const parsed = parseCli(argv);

  if (parsed.values.help || parsed.command === "help") {
    printHelp();
    return { ok: true, help: true };
  }

  if (parsed.command !== "run") {
    throw new Error(`Unknown command: ${parsed.command}`);
  }

  const config = loadConfig(resolve(cwd, parsed.values.config ?? "config.yml"), env);
  const result = await runDigest({
    config,
    since: parsed.values.since,
    from: parsed.values.from,
    to: parsed.values.to,
    dryRun: parsed.values["dry-run"],
    outDir: resolve(cwd, parsed.values["out-dir"] ?? "reports"),
    gitlabClient,
    openaiClient,
    fetchImpl,
  });

  stdout.log(`Wrote ${result.paths.mdPath}`);
  stdout.log(`Wrote ${result.paths.jsonPath}`);
  stdout.log(
    `MRs=${result.mrs.length} HIGH=${result.brief.levels.HIGH} MEDIUM=${result.brief.levels.MEDIUM} LOW=${result.brief.levels.LOW}`,
  );
  if (result.notify.skipped) {
    stdout.log(`Notify skipped (${result.notify.reason})`);
  } else {
    stdout.log(`Notify sent (${result.notify.status})`);
  }
  return result;
}
