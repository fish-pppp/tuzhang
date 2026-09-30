import assert from "node:assert/strict";
import test from "node:test";
import {
  allocatePercents,
  classifySpendTitle,
  formatSpendPercent,
  partFromJevChoice,
  partsFromModelChoices,
  summarizeSpend,
} from "../src/lib/split/spend-summary.mjs";

test("classifies travel bill titles into spending parts", () => {
  assert.equal(classifySpendTitle("昆明机场打车"), "transport");
  assert.equal(classifySpendTitle("大理古城民宿"), "stay");
  assert.equal(classifySpendTitle("洱海骑行"), "transport");
  assert.equal(classifySpendTitle("双廊海鲜"), "food");
  assert.equal(classifySpendTitle("玉龙雪山门票"), "ticket");
  assert.equal(classifySpendTitle("丽江晚饭"), "food");
  assert.equal(classifySpendTitle("束河古镇咖啡"), "food");
  assert.equal(classifySpendTitle("酒店早餐"), "food");
  assert.equal(classifySpendTitle("随便走走"), "other");
  assert.equal(classifySpendTitle(""), "other");
});

test("percent slices add up to 100", () => {
  const parts = allocatePercents([9000, 30000, 21134, 14000], 74134);
  assert.deepEqual(parts, [12.1, 40.5, 28.5, 18.9]);
  assert.equal(
    parts.reduce((sum, value) => sum + value, 0),
    100,
  );
  assert.deepEqual(allocatePercents([0, 0], 0), [0, 0]);
  assert.equal(formatSpendPercent(12.1), "12.1%");
  assert.equal(formatSpendPercent(40), "40%");
  assert.equal(formatSpendPercent(0), "0%");
});

test("summarizeSpend totals my share and keeps fronted-only bills out of the parts", () => {
  const summary = summarizeSpend([
    {
      id: "stay",
      title: "民宿",
      groupId: "g1",
      groupName: "云南",
      amountCents: 210000,
      myShareCents: 30000,
      paidByMe: true,
      createdAt: "2026-08-12T16:40:00.000Z",
      settled: false,
    },
    {
      id: "fronted",
      title: "帮朋友买票",
      groupId: "g1",
      groupName: "云南",
      amountCents: 5000,
      myShareCents: 0,
      paidByMe: true,
      createdAt: "2026-08-13T00:00:00.000Z",
      settled: true,
    },
    {
      id: "food",
      title: "晚饭",
      groupId: "g2",
      groupName: "丽江",
      amountCents: 42000,
      myShareCents: 6000,
      paidByMe: false,
      createdAt: "2026-08-16T20:15:00.000Z",
      settled: false,
    },
  ]);

  assert.equal(summary.totalShareCents, 36000);
  assert.equal(summary.paidCents, 215000);
  assert.equal(summary.billCount, 2);
  assert.deepEqual(
    summary.parts.map((part) => [part.id, part.cents]),
    [
      ["stay", 30000],
      ["food", 6000],
    ],
  );
  assert.equal(
    summary.parts.reduce((sum, part) => sum + part.percent, 0),
    100,
  );
  assert.equal(summary.groups.length, 2);
  assert.equal(summary.groups[0]?.name, "云南");
  assert.equal(summary.bills[0]?.title, "民宿");
  assert.equal(
    summary.bills.some((bill) => bill.id === "fronted"),
    false,
  );
});

test("a model label replaces the keyword guess for the same title", () => {
  const bill = {
    id: "ride",
    title: "洱海骑行",
    groupId: "g1",
    groupName: "云南",
    amountCents: 35000,
    myShareCents: 7000,
    paidByMe: false,
    createdAt: "2026-08-13T11:20:00.000Z",
    settled: false,
  };
  assert.equal(summarizeSpend([bill]).parts[0]?.id, "transport");
  const summary = summarizeSpend([bill], { 洱海骑行: "play" });
  assert.equal(summary.parts[0]?.id, "play");
  assert.equal(summary.parts[0]?.label, "娱乐");
  assert.equal(summarizeSpend([bill], { 洱海骑行: "不是类别" }).parts[0]?.id, "transport");
});

test("model choices keep only known parts and the titles that were sent", () => {
  const parts = partsFromModelChoices(
    ["洱海骑行", "昆明机场打车"],
    [
      { id: "0", part: "play" },
      { id: "1", part: "交通" },
      { id: "4", part: "food" },
      { id: "1", part: "nope" },
    ],
  );
  assert.deepEqual(parts, { 洱海骑行: "play", 昆明机场打车: "transport" });
});

test("Jev choices below the probability floor are left for keywords", () => {
  assert.equal(partFromJevChoice("play", 0.82), "play");
  assert.equal(partFromJevChoice("play", 0.2), null);
  assert.equal(partFromJevChoice("玩乐", 0.9), null);
  assert.equal(partFromJevChoice("food", null), "food");
});
