import { createGateway, experimental_evaluate as evaluate } from "ai";
import { partFromJevChoice, spendTitleKey } from "./spend-summary.mjs";

/** TypeSafe evaluation model. It picks a category instead of writing text. */
const SPEND_CLASSIFY_MODEL = "typesafe-ai/jev";
const QUESTION_BATCH = 20;

const CRITERIA = {
  food: "吃饭、喝的、咖啡、酒吧、夜宵",
  stay: "酒店、民宿、青旅、房费、租来住的房子",
  transport: "打车、地铁、机票、火车、加油、停车、共享单车。只是把人从一处送到另一处",
  ticket: "景点、演出、博物馆的门票",
  shopping: "买东西、特产、超市",
  play: "骑行、漂流、温泉、潜水、电影、KTV、按摩、一日游、包车游这种玩的项目",
  other: "看不出来主要花在哪",
} as const;

const STATE =
  "这是旅行 AA 记账的账单名称。读完整句再归类，不要只因为出现某一个词就选。例子：洱海骑行是玩乐，昆明机场打车是赶路，酒店早餐是餐饮，出租屋是住宿，玉龙雪山门票是门票，共享单车是赶路。";

export type SpendClassifyResult = {
  parts: Record<string, string>;
  source: "model" | "unavailable";
};

const memory = new Map<string, string>();

function uniqueTitles(titles: readonly string[]): string[] {
  const seen = new Set<string>();
  const list: string[] = [];
  for (const title of titles) {
    const key = spendTitleKey(title);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    list.push(key);
  }
  return list;
}

type ChoiceAnswer = {
  type?: string;
  choice?: string;
  probabilities?: Record<string, number>;
};

function jevModel() {
  const apiKey = process.env.JEV_API_KEY?.trim();
  if (!apiKey) return SPEND_CLASSIFY_MODEL;
  return createGateway({ apiKey }).evaluationModel(SPEND_CLASSIFY_MODEL);
}

async function classifyBatch(titles: string[]): Promise<Record<string, string>> {
  const questions: Record<
    string,
    { type: "choice"; instructions: string; criteria: typeof CRITERIA }
  > = {};
  titles.forEach((title, index) => {
    questions[`q${index}`] = {
      type: "choice",
      instructions: `账单名称是「${title}」。判断这笔钱主要属于哪一类。`,
      criteria: CRITERIA,
    };
  });
  const result = await evaluate({
    model: jevModel(),
    state: STATE,
    questions,
    abortSignal: AbortSignal.timeout(12_000),
  });
  const answers = result.answers as Record<string, ChoiceAnswer>;
  const parts: Record<string, string> = {};
  titles.forEach((title, index) => {
    const answer = answers[`q${index}`];
    if (!answer || answer.type !== "choice" || !answer.choice) return;
    const probability = answer.probabilities?.[answer.choice];
    const part = partFromJevChoice(answer.choice, probability);
    if (part) parts[title] = part;
  });
  return parts;
}

export async function classifyTitlesWithModel(
  titles: readonly string[],
): Promise<SpendClassifyResult> {
  const unique = uniqueTitles(titles);
  const parts: Record<string, string> = {};
  const missing: string[] = [];
  for (const title of unique) {
    const cached = memory.get(title);
    if (cached) parts[title] = cached;
    else missing.push(title);
  }
  if (missing.length === 0) return { parts, source: "model" };

  let classified = false;
  for (let i = 0; i < missing.length; i += QUESTION_BATCH) {
    const batch = missing.slice(i, i + QUESTION_BATCH);
    try {
      const fresh = await classifyBatch(batch);
      if (Object.keys(fresh).length === 0) continue;
      classified = true;
      for (const [title, part] of Object.entries(fresh)) {
        memory.set(title, part);
        parts[title] = part;
      }
    } catch (err) {
      console.error("spend classify failed", err instanceof Error ? err.message : "unknown");
    }
  }

  if (!classified && Object.keys(parts).length === 0) {
    return { parts: {}, source: "unavailable" };
  }
  return { parts, source: "model" };
}
