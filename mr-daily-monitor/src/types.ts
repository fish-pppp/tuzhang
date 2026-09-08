export type RiskLevel = "HIGH" | "MEDIUM" | "LOW";
export type QwenProtocol = "compatible" | "dashscope";

export interface RiskFinding {
  id: string;
  severity: RiskLevel;
  points: number;
  reason: string;
}

export interface RiskResult {
  score: number;
  level: RiskLevel;
  reasons: string[];
  findings: RiskFinding[];
}

export interface ChangedFile {
  oldPath: string;
  newPath: string;
  newFile: boolean;
  deletedFile: boolean;
  renamedFile: boolean;
  diff: string;
  addedLines: number;
  removedLines: number;
}

export interface MergeRequest {
  project: string | number;
  iid: number;
  id: number;
  title: string;
  description: string;
  webUrl: string;
  author: string;
  mergedAt: string | null;
  labels: string[];
  files: ChangedFile[];
  linesAdded: number;
  linesRemoved: number;
  diffSummary: string;
  risk?: RiskResult;
  features?: string[];
  testCases?: string[];
  llmFallback?: boolean;
  llmError?: string;
}

export interface TimeWindow {
  start: Date;
  end: Date;
  date: string;
  timeZone: string;
  label: string;
}

export interface GitlabConfig {
  url?: string;
  tokenEnv: string;
  token?: string;
  projects: string[];
  timezone: string;
}

export interface RiskConfig {
  largePrLines: number;
  concentrationRatio: number;
  minConcentrationLines: number;
  riskyPathGlobs: string[];
  dependencyFiles: string[];
  testGlobs: string[];
}

export interface QwenConfig {
  enabled: boolean;
  protocol: QwenProtocol;
  timeoutSec: number;
  maxDiffChars: number;
  baseUrlEnv: string;
  apiKeyEnv: string;
  modelEnv: string;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}

export interface NotifyConfig {
  webhookUrlEnv: string;
  webhookUrl?: string;
}

export interface AppConfig {
  sourcePath: string;
  gitlab: GitlabConfig;
  risk: RiskConfig;
  qwen: QwenConfig;
  notify: NotifyConfig;
}

export interface GitlabListParams {
  projectId: string | number;
  mergedAfter: string;
  mergedBefore: string;
}

export interface RawGitlabUser {
  username?: string;
  name?: string;
}

export interface RawGitlabChange {
  old_path?: string;
  oldPath?: string;
  new_path?: string;
  newPath?: string;
  new_file?: boolean;
  newFile?: boolean;
  deleted_file?: boolean;
  deletedFile?: boolean;
  renamed_file?: boolean;
  renamedFile?: boolean;
  diff?: string;
}

export interface RawGitlabMr {
  iid: number;
  id: number;
  title?: string;
  description?: string;
  web_url?: string;
  webUrl?: string;
  author?: RawGitlabUser;
  merged_at?: string | null;
  mergedAt?: string | null;
  labels?: string[];
  project_id?: string | number;
  projectId?: string | number;
  project?: string;
  changes?: RawGitlabChange[];
}

export interface GitlabChangesPayload {
  changes?: RawGitlabChange[];
}

export interface GitlabClient {
  listMergedMrs(params: GitlabListParams): Promise<RawGitlabMr[]>;
  getChanges(projectId: string | number, iid: number): Promise<GitlabChangesPayload | RawGitlabChange[]>;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionResult {
  choices?: Array<{ message?: { content?: string | null } | null } | null>;
}

export interface ChatCompletionsClient {
  chat: {
    completions: {
      create(body: {
        model: string;
        messages: ChatMessage[];
        response_format?: { type: "json_object" };
      }): Promise<ChatCompletionResult>;
    };
  };
}

export interface HttpResponse {
  ok: boolean;
  status: number;
  text(): Promise<string>;
  json(): Promise<unknown>;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<HttpResponse>;

export interface BriefJson {
  date: string;
  timezone: string;
  window: {
    start: string;
    end: string;
    label: string;
  };
  summary: {
    total: number;
    HIGH: number;
    MEDIUM: number;
    LOW: number;
  };
  mergeRequests: Array<{
    project: string | number;
    iid: number;
    title: string;
    webUrl: string;
    author: string;
    mergedAt: string | null;
    risk?: RiskResult;
    features: string[];
    testCases: string[];
    llmFallback: boolean;
    llmError?: string;
    files: string[];
  }>;
}

export interface Brief {
  markdown: string;
  json: BriefJson;
  date: string;
  sorted: MergeRequest[];
  levels: Record<RiskLevel, number>;
}

export interface NotifyResult {
  skipped: boolean;
  reason?: string;
  status?: number;
}

export type EnvMap = Record<string, string | undefined>;
