import { Gitlab } from "@gitbeaker/rest";
import { isMergedInWindow } from "./window.js";

export function createGitlabClient({ host, token } = {}) {
  if (!host) {
    throw new Error("gitlab.url is required");
  }
  if (!token) {
    throw new Error("GITLAB_TOKEN is required");
  }

  const api = new Gitlab({ host, token });

  return {
    async listMergedMrs({ projectId, mergedAfter, mergedBefore }) {
      return api.MergeRequests.all({
        projectId,
        state: "merged",
        scope: "all",
        updatedAfter: mergedAfter,
        // GitLab 支持 merged_after；GitBeaker 类型未列出，运行时仍传给查询串。
        mergedAfter,
        mergedBefore,
      });
    },
    async getChanges(projectId, iid) {
      if (typeof api.MergeRequests.showChanges === "function") {
        return api.MergeRequests.showChanges(projectId, iid);
      }
      const diffs = await api.MergeRequests.allDiffs(projectId, iid);
      return { changes: diffs };
    },
  };
}

export function countDiffLines(diff, prefix) {
  if (!diff) {
    return 0;
  }
  return diff.split("\n").filter((line) => line.startsWith(prefix) && !line.startsWith(prefix + prefix)).length;
}

export function truncateDiff(files, maxDiffChars) {
  const chunks = [];
  let used = 0;
  for (const file of files) {
    const header = `--- ${file.oldPath}\n+++ ${file.newPath}\n`;
    const remaining = Math.max(0, maxDiffChars - used);
    if (remaining <= 0) {
      chunks.push("...[diff truncated]");
      break;
    }
    const body = file.diff || "";
    const slice = body.length > remaining - header.length
      ? `${body.slice(0, Math.max(0, remaining - header.length))}\n...[diff truncated]`
      : body;
    const chunk = header + slice;
    chunks.push(chunk);
    used += chunk.length;
  }
  return chunks.join("\n");
}

export function normalizeMergeRequest(mr, changesPayload, { project, maxDiffChars = 12000 } = {}) {
  const rawChanges = Array.isArray(changesPayload)
    ? changesPayload
    : changesPayload?.changes ?? [];

  const files = rawChanges.map((change) => {
    const oldPath = change.old_path ?? change.oldPath ?? "";
    const newPath = change.new_path ?? change.newPath ?? oldPath;
    const diff = change.diff ?? "";
    return {
      oldPath,
      newPath,
      newFile: Boolean(change.new_file ?? change.newFile),
      deletedFile: Boolean(change.deleted_file ?? change.deletedFile),
      renamedFile: Boolean(change.renamed_file ?? change.renamedFile),
      diff,
      addedLines: countDiffLines(diff, "+"),
      removedLines: countDiffLines(diff, "-"),
    };
  });

  return {
    project: project ?? mr.project_id ?? mr.projectId,
    iid: mr.iid,
    id: mr.id,
    title: mr.title ?? "",
    description: mr.description ?? "",
    webUrl: mr.web_url ?? mr.webUrl ?? "",
    author: mr.author?.username ?? mr.author?.name ?? "unknown",
    mergedAt: mr.merged_at ?? mr.mergedAt ?? null,
    labels: mr.labels ?? [],
    files,
    linesAdded: files.reduce((sum, file) => sum + file.addedLines, 0),
    linesRemoved: files.reduce((sum, file) => sum + file.removedLines, 0),
    diffSummary: truncateDiff(files, maxDiffChars),
  };
}

export async function ingestMergedMrs(client, {
  projects,
  start,
  end,
  maxDiffChars = 12000,
} = {}) {
  if (!projects?.length) {
    throw new Error("gitlab.projects must list at least one project");
  }

  const mergedAfter = start.toISOString();
  const mergedBefore = end.toISOString();
  const collected = [];

  for (const project of projects) {
    const mrs = await client.listMergedMrs({
      projectId: project,
      mergedAfter,
      mergedBefore,
    });

    for (const mr of mrs) {
      if (!isMergedInWindow(mr, start, end)) {
        continue;
      }
      const changes = await client.getChanges(project, mr.iid);
      collected.push(normalizeMergeRequest(mr, changes, { project, maxDiffChars }));
    }
  }

  collected.sort((a, b) => String(a.mergedAt).localeCompare(String(b.mergedAt)));
  return collected;
}
