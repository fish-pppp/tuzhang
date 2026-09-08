import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { renderBrief } from "./brief.js";
import { createGitlabClient, ingestMergedMrs } from "./gitlab.js";
import { notifyBrief } from "./notify.js";
import { enrichMrs } from "./qwen.js";
import { scoreRisk } from "./risk.js";
import type {
  AppConfig,
  Brief,
  ChatCompletionsClient,
  FetchLike,
  GitlabClient,
  MergeRequest,
  NotifyResult,
  TimeWindow,
} from "./types.js";
import { resolveWindow } from "./window.js";

export async function writeReports(
  outDir: string,
  date: string,
  brief: Brief,
): Promise<{ mdPath: string; jsonPath: string }> {
  await mkdir(outDir, { recursive: true });
  const mdPath = join(outDir, `${date}.md`);
  const jsonPath = join(outDir, `${date}.json`);
  await writeFile(mdPath, brief.markdown, "utf8");
  await writeFile(jsonPath, `${JSON.stringify(brief.json, null, 2)}\n`, "utf8");
  return { mdPath, jsonPath };
}

export interface RunDigestOptions {
  config: AppConfig;
  since?: string;
  from?: string;
  to?: string;
  dryRun?: boolean;
  outDir?: string;
  now?: Date;
  gitlabClient?: GitlabClient;
  openaiClient?: ChatCompletionsClient;
  fetchImpl?: FetchLike;
}

export interface DigestResult {
  window: TimeWindow;
  mrs: MergeRequest[];
  brief: Brief;
  paths: { mdPath: string; jsonPath: string };
  notify: NotifyResult;
}

export async function runDigest({
  config,
  since,
  from,
  to,
  dryRun = false,
  outDir = "reports",
  now = new Date(),
  gitlabClient,
  openaiClient,
  fetchImpl,
}: RunDigestOptions): Promise<DigestResult> {
  const window = resolveWindow({
    since,
    from,
    to,
    timeZone: config.gitlab.timezone,
    now,
  });

  const client = gitlabClient ?? createGitlabClient({
    host: config.gitlab.url,
    token: config.gitlab.token,
  });

  const mrs = await ingestMergedMrs(client, {
    projects: config.gitlab.projects,
    start: window.start,
    end: window.end,
    maxDiffChars: config.qwen.maxDiffChars,
  });

  const scored = mrs.map((mr) => ({
    ...mr,
    risk: scoreRisk(mr, config.risk),
  }));

  const enriched = await enrichMrs(scored, {
    qwen: config.qwen,
    openaiClient,
    fetchImpl,
  });

  const brief = renderBrief(enriched, window);
  const paths = await writeReports(outDir, window.date, brief);
  const notify = await notifyBrief(brief, {
    webhookUrl: config.notify.webhookUrl,
    dryRun: dryRun || process.env.DRY_RUN === "1",
    fetchImpl,
  });

  return { window, mrs: enriched, brief, paths, notify };
}
