import { Gitlab } from "@gitbeaker/rest";
import type {
  ChangedFile,
  GitlabChangesPayload,
  GitlabClient,
  MergeRequest,
  RawGitlabChange,
  RawGitlabMr,
} from "./types.js";
import { isMergedInWindow } from "./window.js";

export function createGitlabClient({ host, token }: { host?: string; token?: string } = {}): GitlabClient {
  if (!host) {
    throw new Error("gitlab.url is required");
  }
  if (!token) {
    throw new Error("GITLAB_TOKEN is required");
  }

  const api = new Gitlab({ host, token });

  return {
    async listMergedMrs({ projectId, mergedAfter, mergedBefore }) {
      const mrs = await api.MergeRequests.all({
        projectId,
        state: "merged",
        scope: "all",
        updatedAfter: mergedAfter,
        ...({ mergedAfter, mergedBefore } as Record<string, string>),
      });
      return mrs as RawGitlabMr[];
    },
    async getChanges(projectId, iid) {
      if (typeof api.MergeRequests.showChanges === "function") {
        return api.MergeRequests.showChanges(projectId, iid) as Promise<GitlabChangesPayload>;
      }
      const diffs = await api.MergeRequests.allDiffs(projectId, iid);
      return { changes: diffs as RawGitlabChange[] };
    },
  };
}

export function countDiffLines(diff: string | undefined, prefix: string): number {
  if (!diff) {
    return 0;
  }
  return diff.split("\n").filter((line) => line.startsWith(prefix) && !line.startsWith(prefix + prefix)).length;
}

export function truncateDiff(files: Array<Pick<ChangedFile, "oldPath" | "newPath" | "diff">>, maxDiffChars: number): string {
  if (maxDiffChars <= 0) {
    return "";
  }
  const chunks: string[] = [];
  let used = 0;
  for (const file of files) {
    if (used >= maxDiffChars) {
      break;
    }
    const header = `--- ${file.oldPath}\n+++ ${file.newPath}\n`;
    const available = maxDiffChars - used;
    let chunk = header + (file.diff || "");
    if (chunk.length > available) {
      const marker = "\n...[diff truncated]";
      chunk = `${chunk.slice(0, Math.max(0, available - marker.length))}${marker}`;
    }
    chunks.push(chunk);
    used += chunk.length;
  }
  return chunks.join("\n").slice(0, maxDiffChars);
}

export function normalizeMergeRequest(
  mr: RawGitlabMr,
  changesPayload: GitlabChangesPayload | RawGitlabChange[] | undefined,
  { project, maxDiffChars = 12000 }: { project?: string | number; maxDiffChars?: number } = {},
): MergeRequest {
  const rawChanges = Array.isArray(changesPayload)
    ? changesPayload
    : changesPayload?.changes ?? [];

  const files: ChangedFile[] = rawChanges.map((change) => {
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
    project: project ?? mr.project_id ?? mr.projectId ?? mr.project ?? "",
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

export async function ingestMergedMrs(client: GitlabClient, {
  projects,
  start,
  end,
  maxDiffChars = 12000,
}: {
  projects?: string[];
  start: Date;
  end: Date;
  maxDiffChars?: number;
}): Promise<MergeRequest[]> {
  if (!projects?.length) {
    throw new Error("gitlab.projects must list at least one project");
  }

  const mergedAfter = start.toISOString();
  const mergedBefore = end.toISOString();
  const collected: MergeRequest[] = [];

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
