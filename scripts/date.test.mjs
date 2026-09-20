import assert from "node:assert/strict";
import test from "node:test";

const SHANGHAI = "Asia/Shanghai";

function dayKey(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: SHANGHAI,
  }).format(date);
}

function formatDayHeading(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    timeZone: SHANGHAI,
  }).format(date);
}

function groupByDay(items) {
  const map = new Map();
  for (const item of items) {
    const key = dayKey(item.createdAt) || "other";
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, group]) => ({
      key,
      label: formatDayHeading(group[0]?.createdAt) || "其他",
      items: [...group].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    }));
}

function formatMoney(cents) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function expenseInvolves(expense, memberId) {
  return expense.payerId === memberId || expense.participantIds.includes(memberId);
}

function shareForMember(expense, memberId) {
  const n = expense.participantIds.length;
  if (n <= 0) return 0;
  const base = Math.floor(expense.amountCents / n);
  const rem = expense.amountCents % n;
  const index = expense.participantIds.indexOf(memberId);
  if (index < 0) return 0;
  return base + (index < rem ? 1 : 0);
}

function expenseCardPeopleIds(expense) {
  const seen = new Set();
  const ids = [];
  for (const id of [expense.payerId, ...expense.participantIds]) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function expenseCardLine(expense, meId, payerName) {
  if (meId && expenseInvolves(expense, meId)) {
    return `我要付 ${formatMoney(shareForMember(expense, meId))}`;
  }
  return `${payerName}付`;
}

const e1 = {
  id: "e1",
  title: "昆明机场打车",
  amountCents: 14000,
  payerId: "yingjian",
  participantIds: ["yeah", "yingjian"],
  createdAt: "2026-08-12T09:10:00.000Z",
};
const e2 = {
  id: "e2",
  title: "大理古城民宿",
  amountCents: 210000,
  payerId: "yeah",
  participantIds: ["yeah", "yingjian"],
  createdAt: "2026-08-12T16:40:00.000Z",
};
const e3 = {
  id: "e3",
  title: "洱海骑行",
  amountCents: 35000,
  payerId: "xinxin",
  participantIds: ["yeah", "xinxin"],
  createdAt: "2026-08-13T11:20:00.000Z",
};

test("groupByDay buckets Shanghai calendar days, newest first", () => {
  const days = groupByDay([e1, e3, e2]);
  assert.equal(days.length, 2);
  // e2 is 00:40 the next Shanghai day (UTC 16:40 on the 12th).
  assert.equal(days[0]?.key, "2026-08-13");
  assert.deepEqual(
    days[0]?.items.map((e) => e.id),
    ["e3", "e2"],
  );
  assert.equal(days[1]?.key, "2026-08-12");
  assert.deepEqual(
    days[1]?.items.map((e) => e.id),
    ["e1"],
  );
  assert.match(days[0]?.label ?? "", /8/);
});

test("expenseCardLine shows my share when involved, otherwise who paid", () => {
  assert.equal(expenseCardLine(e1, "yeah", "硬件"), `我要付 ${formatMoney(7000)}`);
  assert.equal(expenseCardLine(e3, "yingjian", "欣欣"), "欣欣付");
  assert.equal(expenseCardLine(e3, null, "欣欣"), "欣欣付");
});

test("expenseCardPeopleIds puts the payer first and drops duplicates", () => {
  assert.deepEqual(expenseCardPeopleIds(e1), ["yingjian", "yeah"]);
  assert.deepEqual(expenseCardPeopleIds(e2), ["yeah", "yingjian"]);
  assert.deepEqual(
    expenseCardPeopleIds({
      ...e3,
      payerId: "xinxin",
      participantIds: ["yeah", "xinxin", "yeah"],
    }),
    ["xinxin", "yeah"],
  );
});
