import type { Brief, BriefJson, MergeRequest, RiskLevel, TimeWindow } from "./types.js";

const LEVEL_ORDER: Record<RiskLevel, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

export function sortMrsForTesting(mrs: MergeRequest[]): MergeRequest[] {
  return [...mrs].sort((a, b) => {
    const levelDelta = (LEVEL_ORDER[a.risk?.level ?? "LOW"] ?? 9) - (LEVEL_ORDER[b.risk?.level ?? "LOW"] ?? 9);
    if (levelDelta !== 0) {
      return levelDelta;
    }
    const scoreDelta = (b.risk?.score ?? 0) - (a.risk?.score ?? 0);
    if (scoreDelta !== 0) {
      return scoreDelta;
    }
    return String(a.mergedAt ?? "").localeCompare(String(b.mergedAt ?? ""));
  });
}

export function summarizeLevels(mrs: MergeRequest[]): Record<RiskLevel, number> {
  return mrs.reduce(
    (acc, mr) => {
      const level = mr.risk?.level ?? "LOW";
      acc[level] = (acc[level] ?? 0) + 1;
      return acc;
    },
    { HIGH: 0, MEDIUM: 0, LOW: 0 } as Record<RiskLevel, number>,
  );
}

function formatMrSection(mr: MergeRequest): string {
  const features = (mr.features ?? []).map((item) => `- ${item}`).join("\n") || "- （无）";
  const cases = (mr.testCases ?? []).map((item) => `- ${item}`).join("\n") || "- （无）";
  const reasons = (mr.risk?.reasons ?? []).join("；") || "无明显规则命中";
  const fallback = mr.llmFallback ? "\n- 说明: 千问不可用，功能点已降级为标题/描述" : "";
  return [
    `### !${mr.iid} ${mr.title}  ${mr.risk?.level ?? "LOW"}`,
    `- 项目: ${mr.project}`,
    `- 作者: ${mr.author}  合入: ${mr.mergedAt ?? "unknown"}`,
    `- 链接: ${mr.webUrl || "（无）"}`,
    `- 原因: ${reasons}${fallback}`,
    `- 功能:`,
    features,
    `- 用例:`,
    cases,
  ].join("\n");
}

export function renderBrief(mrs: MergeRequest[], window: TimeWindow): Brief {
  const sorted = sortMrsForTesting(mrs);
  const levels = summarizeLevels(sorted);
  const date = window.date;
  const priority = sorted.filter((mr) => mr.risk?.level === "HIGH");
  const rest = sorted.filter((mr) => mr.risk?.level !== "HIGH");

  const lines = [
    `# 每日合入测试简报 ${date}`,
    `高风险 ${levels.HIGH} / 中风险 ${levels.MEDIUM} / 低风险 ${levels.LOW}`,
    `窗口: ${window.label}`,
    `合计合入 ${sorted.length} 个 MR`,
    "",
    "## 优先测",
    priority.length ? priority.map(formatMrSection).join("\n\n") : "（今日无高风险合入）",
  ];

  if (rest.length) {
    lines.push("", "## 其他合入功能", rest.map(formatMrSection).join("\n\n"));
  }

  const markdown = `${lines.join("\n")}\n`;
  const json: BriefJson = {
    date,
    timezone: window.timeZone,
    window: {
      start: window.start.toISOString(),
      end: window.end.toISOString(),
      label: window.label,
    },
    summary: {
      total: sorted.length,
      ...levels,
    },
    mergeRequests: sorted.map((mr) => ({
      project: mr.project,
      iid: mr.iid,
      title: mr.title,
      webUrl: mr.webUrl,
      author: mr.author,
      mergedAt: mr.mergedAt,
      risk: mr.risk,
      features: mr.features ?? [],
      testCases: mr.testCases ?? [],
      llmFallback: Boolean(mr.llmFallback),
      llmError: mr.llmError,
      files: (mr.files ?? []).map((file) => file.newPath || file.oldPath),
    })),
  };

  return { markdown, json, date, sorted, levels };
}
