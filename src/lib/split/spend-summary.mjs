/** Spending parts inferred from a bill title. Order breaks equal-length ties. */
export const SPEND_PARTS = [
  {
    id: "food",
    label: "餐饮",
    keywords: [
      "海鲜",
      "咖啡",
      "奶茶",
      "火锅",
      "早餐",
      "午餐",
      "晚餐",
      "午饭",
      "晚饭",
      "早饭",
      "宵夜",
      "夜宵",
      "小吃",
      "甜品",
      "烧烤",
      "吃饭",
      "餐厅",
      "饭店",
      "下午茶",
      "酒吧",
      "coffee",
      "breakfast",
      "lunch",
      "dinner",
      "饭",
      "餐",
    ],
  },
  {
    id: "stay",
    label: "住宿",
    keywords: [
      "民宿",
      "酒店",
      "宾馆",
      "客栈",
      "住宿",
      "青旅",
      "公寓",
      "房费",
      "hotel",
      "airbnb",
      "hostel",
    ],
  },
  {
    id: "transport",
    label: "交通",
    keywords: [
      "打车",
      "出租车",
      "出租",
      "地铁",
      "公交",
      "高铁",
      "火车",
      "飞机",
      "机票",
      "航班",
      "加油",
      "停车",
      "租车",
      "骑行",
      "船票",
      "轮渡",
      "滴滴",
      "的士",
      "大巴",
      "动车",
      "自驾",
      "包车",
      "网约车",
      "过路费",
      "油费",
      "taxi",
      "uber",
      "flight",
      "train",
    ],
  },
  {
    id: "ticket",
    label: "门票",
    keywords: [
      "门票",
      "景点",
      "雪山",
      "博物馆",
      "公园",
      "演出",
      "展览",
      "动物园",
      "海洋馆",
      "ticket",
      "museum",
    ],
  },
  {
    id: "shopping",
    label: "购物",
    keywords: ["购物", "特产", "超市", "商场", "shopping"],
  },
  {
    id: "play",
    label: "娱乐",
    keywords: ["ktv", "剧本杀", "电影", "按摩", "温泉", "漂流", "潜水"],
  },
  { id: "other", label: "其他", keywords: [] },
];

const PART_LABEL = new Map(SPEND_PARTS.map((part) => [part.id, part.label]));

export function spendPartLabel(id) {
  return PART_LABEL.get(id) ?? "其他";
}

/** Longest keyword wins. Equal length keeps the earlier part in `SPEND_PARTS`. */
export function classifySpendTitle(title) {
  const text = String(title ?? "")
    .trim()
    .toLowerCase();
  if (!text) return "other";
  let bestId = "other";
  let bestLen = 0;
  for (const part of SPEND_PARTS) {
    for (const word of part.keywords) {
      const key = word.toLowerCase();
      if (!key || !text.includes(key)) continue;
      if (key.length > bestLen) {
        bestId = part.id;
        bestLen = key.length;
      }
    }
  }
  return bestId;
}

/**
 * Tenths of a percent that add up to 100.0.
 * `weights` are non-negative and should sum to `total`.
 */
export function allocatePercents(weights, total) {
  const list = weights.map((value) => Math.max(0, Number(value) || 0));
  if (!Number.isFinite(total) || total <= 0 || list.every((value) => value <= 0)) {
    return list.map(() => 0);
  }
  const units = list.map((value) => (value * 1000) / total);
  const floors = units.map((unit) => Math.floor(unit + 1e-9));
  let remain = Math.round(1000 - floors.reduce((sum, unit) => sum + unit, 0));
  if (remain < 0) remain = 0;
  const order = units
    .map((unit, index) => ({ index, frac: unit - (floors[index] ?? 0) }))
    .sort((a, b) => b.frac - a.frac || a.index - b.index);
  const out = [...floors];
  for (let i = 0; i < order.length && remain > 0; i += 1) {
    const index = order[i]?.index;
    if (index == null) break;
    out[index] = (out[index] ?? 0) + 1;
    remain -= 1;
  }
  return out.map((unit) => unit / 10);
}

export function formatSpendPercent(value) {
  const rounded = Math.round(Number(value) * 10) / 10;
  if (!Number.isFinite(rounded) || rounded <= 0) return "0%";
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
}

function byShareThenNewest(a, b) {
  if (b.myShareCents !== a.myShareCents) return b.myShareCents - a.myShareCents;
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function billView(bill, percent) {
  return {
    id: bill.id,
    title: bill.title,
    groupId: bill.groupId,
    groupName: bill.groupName,
    amountCents: bill.amountCents,
    myShareCents: bill.myShareCents,
    createdAt: bill.createdAt,
    settled: Boolean(bill.settled),
    partId: bill.partId,
    percent,
  };
}

/**
 * Personal spend: what this person was charged on each bill (their share),
 * plus how much they fronted. Deleted bills must already be excluded.
 */
export function summarizeSpend(bills) {
  let paidCents = 0;
  const mine = [];
  for (const bill of bills ?? []) {
    const amountCents = Math.max(0, Number(bill.amountCents) || 0);
    const myShareCents = Math.max(0, Number(bill.myShareCents) || 0);
    if (bill.paidByMe) paidCents += amountCents;
    if (myShareCents <= 0) continue;
    mine.push({
      id: String(bill.id),
      title: String(bill.title ?? "").trim() || "未命名支出",
      groupId: String(bill.groupId ?? ""),
      groupName: String(bill.groupName ?? "").trim() || "未命名群组",
      amountCents,
      myShareCents,
      createdAt: String(bill.createdAt ?? ""),
      settled: Boolean(bill.settled),
      partId: classifySpendTitle(bill.title),
    });
  }

  const totalShareCents = mine.reduce((sum, bill) => sum + bill.myShareCents, 0);
  const billPercents = allocatePercents(
    mine.map((bill) => bill.myShareCents),
    totalShareCents,
  );
  const flat = mine
    .map((bill, index) => billView(bill, billPercents[index] ?? 0))
    .sort(byShareThenNewest);

  const partBuckets = new Map();
  const groupBuckets = new Map();
  for (const bill of flat) {
    const part = partBuckets.get(bill.partId) ?? [];
    part.push(bill);
    partBuckets.set(bill.partId, part);
    const group = groupBuckets.get(bill.groupId) ?? [];
    group.push(bill);
    groupBuckets.set(bill.groupId, group);
  }

  const partOrder = SPEND_PARTS.map((part) => part.id).filter((id) => partBuckets.has(id));
  const partCents = partOrder.map((id) =>
    (partBuckets.get(id) ?? []).reduce((sum, bill) => sum + bill.myShareCents, 0),
  );
  const partPercents = allocatePercents(partCents, totalShareCents);
  const parts = partOrder
    .map((id, index) => ({
      id,
      label: spendPartLabel(id),
      cents: partCents[index] ?? 0,
      percent: partPercents[index] ?? 0,
      bills: [...(partBuckets.get(id) ?? [])].sort(byShareThenNewest),
    }))
    .sort((a, b) => b.cents - a.cents || partOrder.indexOf(a.id) - partOrder.indexOf(b.id));

  const groupIds = [...groupBuckets.keys()];
  const groupCents = groupIds.map((id) =>
    (groupBuckets.get(id) ?? []).reduce((sum, bill) => sum + bill.myShareCents, 0),
  );
  const groupPercents = allocatePercents(groupCents, totalShareCents);
  const groups = groupIds
    .map((id, index) => ({
      id,
      name: groupBuckets.get(id)?.[0]?.groupName ?? "未命名群组",
      cents: groupCents[index] ?? 0,
      percent: groupPercents[index] ?? 0,
      bills: [...(groupBuckets.get(id) ?? [])].sort(byShareThenNewest),
    }))
    .sort((a, b) => b.cents - a.cents || a.name.localeCompare(b.name, "zh"));

  return {
    totalShareCents,
    paidCents,
    billCount: flat.length,
    parts,
    groups,
    bills: flat,
  };
}
