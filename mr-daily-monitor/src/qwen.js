import OpenAI from "openai";

const SYSTEM_PROMPT = "你是资深测试工程师。只输出 JSON 对象，不要解释。";

export function fallbackSemantics(mr) {
  const features = [];
  if (mr.title) {
    features.push(mr.title);
  }
  const firstLine = String(mr.description || "")
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);
  if (firstLine && firstLine !== mr.title) {
    features.push(firstLine.slice(0, 200));
  }
  const testCases = (mr.files ?? [])
    .slice(0, 5)
    .map((file) => `回归检查 ${file.newPath || file.oldPath}`);
  return {
    features: features.length ? features : ["（无标题，请人工确认功能）"],
    testCases: testCases.length ? testCases : ["按 MR 描述做冒烟回归"],
    llmFallback: true,
  };
}

export function parseModelJson(text) {
  if (!text || typeof text !== "string") {
    throw new Error("empty model response");
  }
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < start) {
    throw new Error("model response is not JSON");
  }
  const parsed = JSON.parse(raw.slice(start, end + 1));
  const features = Array.isArray(parsed.features)
    ? parsed.features.map(String).filter(Boolean)
    : [];
  const testCases = Array.isArray(parsed.testCases)
    ? parsed.testCases.map(String).filter(Boolean)
    : Array.isArray(parsed.test_cases)
      ? parsed.test_cases.map(String).filter(Boolean)
      : [];
  if (!features.length || !testCases.length) {
    throw new Error("model JSON missing features or testCases");
  }
  return { features, testCases };
}

export function buildUserPrompt(mr) {
  const fileList = (mr.files ?? [])
    .map((file) => `- ${file.deletedFile ? "[del] " : ""}${file.newPath || file.oldPath}`)
    .join("\n");
  return [
    "根据以下已合入 GitLab MR，提取可测试的功能点，并给出建议测试用例。",
    "输出 JSON：{\"features\":[\"...\"],\"testCases\":[\"...\"]}",
    `标题: ${mr.title}`,
    `项目: ${mr.project}`,
    `IID: !${mr.iid}`,
    `作者: ${mr.author}`,
    `风险: ${mr.risk?.level ?? "UNKNOWN"} ${(mr.risk?.reasons ?? []).join("; ")}`,
    `描述:\n${mr.description || "（无）"}`,
    `变更文件:\n${fileList || "（无）"}`,
    `Diff 摘要:\n${mr.diffSummary || "（无）"}`,
  ].join("\n\n");
}

function compatibleUrl(baseUrl) {
  return String(baseUrl).replace(/\/+$/, "");
}

export function dashscopeUrl(baseUrl) {
  const trimmed = compatibleUrl(baseUrl);
  if (trimmed.includes("/services/aigc/text-generation/generation")) {
    return trimmed;
  }
  return `${trimmed}/api/v1/services/aigc/text-generation/generation`;
}

export async function callCompatibleQwen({
  baseUrl,
  apiKey,
  model,
  messages,
  timeoutSec = 60,
  openaiClient,
}) {
  const client = openaiClient ?? new OpenAI({
    apiKey,
    baseURL: compatibleUrl(baseUrl),
    timeout: timeoutSec * 1000,
  });

  try {
    const completion = await client.chat.completions.create({
      model,
      messages,
      response_format: { type: "json_object" },
    });
    return completion.choices?.[0]?.message?.content ?? "";
  } catch (error) {
    if (/response_format|json_object/i.test(String(error?.message ?? error))) {
      const completion = await client.chat.completions.create({ model, messages });
      return completion.choices?.[0]?.message?.content ?? "";
    }
    throw error;
  }
}

export async function callDashscopeQwen({
  baseUrl,
  apiKey,
  model,
  messages,
  timeoutSec = 60,
  fetchImpl = fetch,
}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutSec * 1000);
  try {
    const response = await fetchImpl(dashscopeUrl(baseUrl), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: { messages },
        parameters: { result_format: "message" },
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`DashScope ${response.status}: ${body.slice(0, 300)}`);
    }
    const payload = await response.json();
    return (
      payload.output?.choices?.[0]?.message?.content
      ?? payload.output?.text
      ?? ""
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function enrichMr(mr, options) {
  const qwen = options.qwen ?? {};
  if (!qwen.enabled) {
    return { ...mr, ...fallbackSemantics(mr) };
  }
  if (!qwen.baseUrl || !qwen.apiKey || !qwen.model) {
    return {
      ...mr,
      ...fallbackSemantics(mr),
      llmError: "QWEN_BASE_URL / QWEN_API_KEY / QWEN_MODEL 未配置，已降级",
    };
  }

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: buildUserPrompt(mr) },
  ];

  try {
    const text = qwen.protocol === "dashscope"
      ? await callDashscopeQwen({
        baseUrl: qwen.baseUrl,
        apiKey: qwen.apiKey,
        model: qwen.model,
        messages,
        timeoutSec: qwen.timeoutSec,
        fetchImpl: options.fetchImpl,
      })
      : await callCompatibleQwen({
        baseUrl: qwen.baseUrl,
        apiKey: qwen.apiKey,
        model: qwen.model,
        messages,
        timeoutSec: qwen.timeoutSec,
        openaiClient: options.openaiClient,
      });
    const semantic = parseModelJson(text);
    return { ...mr, ...semantic, llmFallback: false };
  } catch (error) {
    return {
      ...mr,
      ...fallbackSemantics(mr),
      llmError: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function enrichMrs(mrs, options) {
  const enriched = [];
  for (const mr of mrs) {
    enriched.push(await enrichMr(mr, options));
  }
  return enriched;
}
