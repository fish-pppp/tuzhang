import { minimatch } from "minimatch";
import type { ChangedFile, MergeRequest, RiskConfig, RiskFinding, RiskLevel, RiskResult } from "./types.js";

const TODO_RE = /\b(TODO|FIXME|HACK)\b/;
const DEBUG_RE = /\b(console\.log|debugger|printStackTrace|pdb\.set_trace)\b/;

function filePath(file: Pick<ChangedFile, "newPath" | "oldPath">): string {
  return file.newPath || file.oldPath || "";
}

function matchesAny(path: string, globs: string[]): boolean {
  return globs.some((glob) => minimatch(path, glob, { dot: true, nocase: true }));
}

function isTestFile(path: string, testGlobs: string[]): boolean {
  return matchesAny(path, testGlobs);
}

function isDocFile(path: string): boolean {
  return /\.(md|txt|rst|adoc)$/i.test(path)
    || /(^|\/)(README|LICENSE|CHANGELOG)(\.|$)/i.test(path);
}

function isSourceFile(path: string, testGlobs: string[]): boolean {
  if (!path) {
    return false;
  }
  if (isTestFile(path, testGlobs) || isDocFile(path)) {
    return false;
  }
  return true;
}

function addedContent(file: Pick<ChangedFile, "diff">): string {
  return (file.diff || "")
    .split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .map((line) => line.slice(1))
    .join("\n");
}

function basename(path: string): string {
  return path.split("/").pop() ?? path;
}

export function scoreRisk(
  mr: Pick<MergeRequest, "files" | "linesAdded">,
  riskConfig: Partial<RiskConfig> = {},
): RiskResult {
  const largePrLines = riskConfig.largePrLines ?? 300;
  const concentrationRatio = riskConfig.concentrationRatio ?? 0.6;
  const minConcentrationLines = riskConfig.minConcentrationLines ?? 80;
  const riskyPathGlobs = riskConfig.riskyPathGlobs ?? [];
  const dependencyFiles = new Set((riskConfig.dependencyFiles ?? []).map((name) => name.toLowerCase()));
  const testGlobs = riskConfig.testGlobs ?? [];
  const files = mr.files ?? [];
  const findings: RiskFinding[] = [];

  const totalChanged = files.reduce((sum, file) => sum + file.addedLines + file.removedLines, 0);
  if ((mr.linesAdded ?? 0) >= largePrLines) {
    findings.push({
      id: "large-pr",
      severity: "HIGH",
      points: 20,
      reason: `变更行数 ${mr.linesAdded} 超过阈值 ${largePrLines}`,
    });
  }

  if (totalChanged > 0) {
    const dominant = files
      .map((file) => ({
        path: filePath(file),
        size: file.addedLines + file.removedLines,
      }))
      .sort((a, b) => b.size - a.size)[0];
    const docsOnly = files.length > 0 && files.every((file) => isDocFile(filePath(file)));
    if (
      !docsOnly
      && totalChanged >= minConcentrationLines
      && dominant
      && dominant.size / totalChanged > concentrationRatio
    ) {
      findings.push({
        id: "risk-concentration",
        severity: "HIGH",
        points: 20,
        reason: `${dominant.path} 占本次变更的 ${Math.round((dominant.size / totalChanged) * 100)}%`,
      });
    }
  }

  const dependencyHits = files
    .map(filePath)
    .filter((path) => dependencyFiles.has(basename(path).toLowerCase()));
  if (dependencyHits.length) {
    findings.push({
      id: "dependency-change",
      severity: "HIGH",
      points: 20,
      reason: `依赖文件变更: ${dependencyHits.join(", ")}`,
    });
  }

  const riskyHits = files.map(filePath).filter((path) => matchesAny(path, riskyPathGlobs));
  if (riskyHits.length) {
    findings.push({
      id: "risky-file",
      severity: "HIGH",
      points: 20,
      reason: `敏感路径变更: ${riskyHits.join(", ")}`,
    });
  }

  const sourceChanged = files.some((file) => !file.deletedFile && isSourceFile(filePath(file), testGlobs));
  const testChanged = files.some((file) => isTestFile(filePath(file), testGlobs));
  if (sourceChanged && !testChanged) {
    findings.push({
      id: "missing-test",
      severity: "MEDIUM",
      points: 10,
      reason: "有源码变更但未见测试文件更新",
    });
  }

  const deletedTests = files.filter((file) => file.deletedFile && isTestFile(file.oldPath || filePath(file), testGlobs));
  if (deletedTests.length) {
    findings.push({
      id: "deleted-tests",
      severity: "HIGH",
      points: 15,
      reason: `删除测试文件: ${deletedTests.map((file) => file.oldPath).join(", ")}`,
    });
  }

  const todoFiles = files.filter((file) => TODO_RE.test(addedContent(file)));
  if (todoFiles.length) {
    findings.push({
      id: "todo-detector",
      severity: "MEDIUM",
      points: 10,
      reason: `新增 TODO/FIXME/HACK: ${todoFiles.map(filePath).join(", ")}`,
    });
  }

  const debugFiles = files.filter((file) => DEBUG_RE.test(addedContent(file)));
  if (debugFiles.length) {
    findings.push({
      id: "debug-artifact",
      severity: "LOW",
      points: 5,
      reason: `疑似调试残留: ${debugFiles.map(filePath).join(", ")}`,
    });
  }

  const score = findings.reduce((sum, item) => sum + item.points, 0);
  const hasHigh = findings.some((item) => item.severity === "HIGH");
  const hasMedium = findings.some((item) => item.severity === "MEDIUM");
  let level: RiskLevel = "LOW";
  if (hasHigh || score >= 40) {
    level = "HIGH";
  } else if (hasMedium || score >= 15) {
    level = "MEDIUM";
  }

  return {
    score,
    level,
    reasons: findings.map((item) => item.reason),
    findings,
  };
}
