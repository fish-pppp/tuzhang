import assert from "node:assert/strict";
import test from "node:test";

function splitShares(amountCents, n) {
  if (n <= 0) return [];
  const base = Math.floor(amountCents / n);
  const rem = amountCents % n;
  return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0));
}

function equalShares(participantIds, amountCents) {
  const slices = splitShares(amountCents, participantIds.length);
  return participantIds.map((memberId, i) => ({
    memberId,
    cents: slices[i] ?? 0,
  }));
}

function normalizeExpenseShares({ participantIds, amountCents, shares }) {
  const ids = [...new Set(participantIds)];
  if (ids.length === 0) throw new Error("至少选择一位一起分摊的人");
  if (!shares || shares.length === 0) return undefined;
  const byId = new Map();
  for (const share of shares) {
    if (!ids.includes(share.memberId)) throw new Error("自定义金额里有未选中的人");
    if (!Number.isInteger(share.cents) || share.cents < 0) {
      throw new Error("自定义金额必须是非负整数（分）");
    }
    byId.set(share.memberId, (byId.get(share.memberId) ?? 0) + share.cents);
  }
  if (ids.some((id) => !byId.has(id))) {
    throw new Error("请给每一位一起分摊的人填写金额");
  }
  const total = ids.reduce((sum, id) => sum + (byId.get(id) ?? 0), 0);
  if (total !== amountCents) throw new Error("自定义金额加起来必须等于账单总额");
  return ids.map((memberId) => ({ memberId, cents: byId.get(memberId) ?? 0 }));
}

function resolveShares(expense, allowedIds) {
  const ids = expense.participantIds.filter((id) =>
    allowedIds ? allowedIds.has(id) : true,
  );
  if (ids.length === 0 || expense.amountCents <= 0) return [];
  if (expense.shares && expense.shares.length > 0) {
    const byId = new Map(expense.shares.map((s) => [s.memberId, s.cents]));
    const custom = ids
      .map((memberId) => ({ memberId, cents: byId.get(memberId) ?? 0 }))
      .filter((s) => s.cents > 0 || byId.has(s.memberId));
    if (custom.length > 0) return custom;
  }
  return equalShares(ids, expense.amountCents);
}

function isOpenExpense(expense) {
  return !expense.deletedAt && !expense.settlementId;
}

function computeLedger(trip) {
  const paid = new Map();
  const share = new Map();
  for (const m of trip.members) {
    paid.set(m.id, 0);
    share.set(m.id, 0);
  }
  const allowed = new Set(trip.members.map((m) => m.id));
  for (const expense of trip.expenses) {
    if (!isOpenExpense(expense)) continue;
    const slices = resolveShares(expense, allowed);
    if (slices.length === 0 || expense.amountCents <= 0) continue;
    if (paid.has(expense.payerId)) {
      paid.set(expense.payerId, (paid.get(expense.payerId) ?? 0) + expense.amountCents);
    }
    for (const slice of slices) {
      if (!share.has(slice.memberId)) continue;
      share.set(slice.memberId, (share.get(slice.memberId) ?? 0) + slice.cents);
    }
  }
  return trip.members.map((m) => ({
    memberId: m.id,
    paidCents: paid.get(m.id) ?? 0,
    shareCents: share.get(m.id) ?? 0,
    netCents: (paid.get(m.id) ?? 0) - (share.get(m.id) ?? 0),
  }));
}

function applySettlement(trip, settlement) {
  const locked = new Set(settlement.expenseIds);
  return {
    ...trip,
    expenses: trip.expenses.map((expense) =>
      locked.has(expense.id) && isOpenExpense(expense)
        ? { ...expense, settlementId: settlement.id }
        : expense,
    ),
    settlements: [settlement, ...(trip.settlements ?? [])],
  };
}

function assertExpenseEditable(expense) {
  if (expense.settlementId) throw new Error("这笔账单已经结算，不能再改");
}

function parseYuan(raw, opts) {
  const cleaned = raw.replace(/[¥￥,\s]/g, "").trim();
  if (!cleaned) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  if (!opts?.allowZero && value <= 0) return null;
  return Math.round(value * 100);
}

function exportTripMarkdown(trip, version = "1.1.0") {
  const lines = [`# ${trip.name} · 途账记录`, `- 应用版本：${version}`];
  for (const expense of trip.expenses) {
    lines.push(`### ${expense.title}`);
    if (expense.shares?.length) lines.push("- 分摊：自定义");
    if (expense.settlementId) lines.push("- 状态：已结算");
  }
  return lines.join("\n");
}

test("equal AA still splits leftover cents to the first people", () => {
  assert.deepEqual(splitShares(10001, 3), [3334, 3334, 3333]);
});

test("custom prices keep the amounts people actually typed", () => {
  const shares = normalizeExpenseShares({
    participantIds: ["a", "b", "c"],
    amountCents: 10000,
    shares: [
      { memberId: "a", cents: 5000 },
      { memberId: "b", cents: 3000 },
      { memberId: "c", cents: 2000 },
    ],
  });
  assert.deepEqual(shares, [
    { memberId: "a", cents: 5000 },
    { memberId: "b", cents: 3000 },
    { memberId: "c", cents: 2000 },
  ]);
});

test("custom prices must add up to the bill total", () => {
  assert.throws(
    () =>
      normalizeExpenseShares({
        participantIds: ["a", "b"],
        amountCents: 10000,
        shares: [
          { memberId: "a", cents: 4000 },
          { memberId: "b", cents: 4000 },
        ],
      }),
    /必须等于账单总额/,
  );
});

test("omitting custom shares means equal AA", () => {
  assert.equal(
    normalizeExpenseShares({
      participantIds: ["a", "b"],
      amountCents: 10000,
    }),
    undefined,
  );
  assert.deepEqual(
    resolveShares({
      participantIds: ["a", "b"],
      amountCents: 10000,
    }),
    [
      { memberId: "a", cents: 5000 },
      { memberId: "b", cents: 5000 },
    ],
  );
});

test("ledger uses custom prices instead of forcing AA", () => {
  const trip = {
    members: [{ id: "a" }, { id: "b" }],
    expenses: [
      {
        id: "e1",
        amountCents: 9000,
        payerId: "a",
        participantIds: ["a", "b"],
        shares: [
          { memberId: "a", cents: 6000 },
          { memberId: "b", cents: 3000 },
        ],
      },
    ],
  };
  const rows = computeLedger(trip);
  assert.equal(rows.find((r) => r.memberId === "a")?.netCents, 3000);
  assert.equal(rows.find((r) => r.memberId === "b")?.netCents, -3000);
});

test("early settlement locks those bills and they drop out of the open ledger", () => {
  const trip = {
    members: [{ id: "a" }, { id: "b" }],
    expenses: [
      {
        id: "e1",
        amountCents: 8000,
        payerId: "a",
        participantIds: ["a", "b"],
      },
    ],
    settlements: [],
  };
  const before = computeLedger(trip);
  assert.equal(before.find((r) => r.memberId === "a")?.netCents, 4000);

  const settled = applySettlement(trip, {
    id: "s1",
    createdAt: "2026-09-20T00:00:00.000Z",
    expenseIds: ["e1"],
    transfers: [{ fromId: "b", toId: "a", cents: 4000 }],
  });
  assert.equal(settled.expenses[0]?.settlementId, "s1");
  assert.equal(settled.settlements[0]?.id, "s1");
  const after = computeLedger(settled);
  assert.equal(after.find((r) => r.memberId === "a")?.netCents, 0);
  assert.equal(after.find((r) => r.memberId === "b")?.netCents, 0);
  assert.throws(() => assertExpenseEditable(settled.expenses[0]), /已经结算/);
});

test("new bills after a settlement start a fresh period", () => {
  const trip = applySettlement(
    {
      members: [{ id: "a" }, { id: "b" }],
      expenses: [
        {
          id: "old",
          amountCents: 8000,
          payerId: "a",
          participantIds: ["a", "b"],
        },
        {
          id: "new",
          amountCents: 2000,
          payerId: "b",
          participantIds: ["a", "b"],
        },
      ],
    },
    {
      id: "s1",
      createdAt: "2026-09-20T00:00:00.000Z",
      expenseIds: ["old"],
      transfers: [],
    },
  );
  const rows = computeLedger(trip);
  assert.equal(rows.find((r) => r.memberId === "b")?.netCents, 1000);
  assert.equal(rows.find((r) => r.memberId === "a")?.netCents, -1000);
});

test("exported markdown keeps version, custom split, and settled status", () => {
  const md = exportTripMarkdown({
    name: "大理",
    expenses: [
      {
        title: "咖啡",
        shares: [{ memberId: "a", cents: 3000 }],
        settlementId: "s1",
      },
    ],
  });
  assert.match(md, /途账记录/);
  assert.match(md, /应用版本：1\.1\.0/);
  assert.match(md, /自定义/);
  assert.match(md, /已结算/);
});

test("parseYuan can accept a zero custom share", () => {
  assert.equal(parseYuan("0", { allowZero: true }), 0);
  assert.equal(parseYuan("0"), null);
  assert.equal(parseYuan("12.3"), 1230);
});
