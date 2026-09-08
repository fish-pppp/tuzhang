import type { Brief, FetchLike, NotifyResult } from "./types.js";

const FEISHU_HINT = /feishu|larksuite|lark/i;

export function buildWebhookPayload(brief: Pick<Brief, "markdown" | "json">, webhookUrl?: string): Record<string, unknown> {
  if (webhookUrl && FEISHU_HINT.test(webhookUrl)) {
    return {
      msg_type: "text",
      content: {
        text: brief.markdown.slice(0, 4000),
      },
    };
  }
  return {
    text: brief.markdown,
    json: brief.json,
  };
}

export async function notifyBrief(
  brief: Pick<Brief, "markdown" | "json">,
  {
    webhookUrl,
    dryRun = false,
    fetchImpl = fetch as FetchLike,
  }: {
    webhookUrl?: string;
    dryRun?: boolean;
    fetchImpl?: FetchLike;
  } = {},
): Promise<NotifyResult> {
  if (dryRun || !webhookUrl) {
    return { skipped: true, reason: dryRun ? "dry-run" : "no-webhook" };
  }

  const response = await fetchImpl(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildWebhookPayload(brief, webhookUrl)),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`webhook ${response.status}: ${body.slice(0, 300)}`);
  }
  return { skipped: false, status: response.status };
}
