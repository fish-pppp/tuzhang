import assert from "node:assert/strict";
import test from "node:test";
import {
  groupChipByPayer,
  groupOthersOweByPerson,
  sortRowsByNewest,
} from "../src/lib/split/aa-groups.mjs";

const ALL = ["yeah", "xinxin", "yuki", "lin", "chen", "yingjian", "fu"];

const DEMO = {
  members: ALL.map((id) => ({ id })),
  expenses: [
    {
      id: "e1",
      title: "昆明机场打车",
      amountCents: 14000,
      payerId: "yingjian",
      participantIds: [...ALL],
      createdAt: "2026-08-12T09:10:00.000Z",
    },
    {
      id: "e2",
      title: "大理古城民宿",
      amountCents: 210000,
      payerId: "yeah",
      participantIds: [...ALL],
      createdAt: "2026-08-12T16:40:00.000Z",
    },
    {
      id: "e3",
      title: "洱海骑行",
      amountCents: 35000,
      payerId: "xinxin",
      participantIds: ["yeah", "xinxin", "yingjian", "lin", "chen"],
      createdAt: "2026-08-13T11:20:00.000Z",
    },
    {
      id: "e4",
      title: "双廊海鲜",
      amountCents: 56000,
      payerId: "fu",
      participantIds: ["yeah", "xinxin", "lin", "chen", "yingjian", "fu"],
      createdAt: "2026-08-13T19:05:00.000Z",
    },
    {
      id: "e5",
      title: "玉龙雪山门票",
      amountCents: 84000,
      payerId: "chen",
      participantIds: ["yeah", "xinxin", "lin", "chen", "yingjian", "fu"],
      createdAt: "2026-08-15T08:30:00.000Z",
    },
    {
      id: "e6",
      title: "丽江晚饭",
      amountCents: 42000,
      payerId: "yuki",
      participantIds: [...ALL],
      createdAt: "2026-08-16T20:15:00.000Z",
    },
  ],
};

function splitShares(amountCents, n) {
  if (n <= 0) return [];
  const base = Math.floor(amountCents / n);
  const rem = amountCents % n;
  return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0));
}

function shareBreakdown(expense) {
  const ids = expense.participantIds;
  if (ids.length === 0 || expense.amountCents <= 0) return [];
  const slices = splitShares(expense.amountCents, ids.length);
  return ids.map((memberId, i) => ({ memberId, cents: slices[i] ?? 0 }));
}

function personalBook(trip, memberId) {
  const paidByMe = trip.expenses
    .filter((e) => e.payerId === memberId)
    .map((expense) => {
      const slices = shareBreakdown(expense);
      const myShareCents = slices.find((s) => s.memberId === memberId)?.cents ?? 0;
      const others = slices.filter((s) => s.memberId !== memberId);
      return {
        expense,
        myShareCents,
        othersOweCents: others.reduce((sum, s) => sum + s.cents, 0),
        others,
      };
    });
  const INeedToChip = trip.expenses
    .filter((e) => e.payerId !== memberId && e.participantIds.includes(memberId))
    .map((expense) => ({
      expense,
      myShareCents:
        shareBreakdown(expense).find((s) => s.memberId === memberId)?.cents ?? 0,
    }));
  return { paidByMe, INeedToChip };
}

test("yingjian A'd the airport taxi and still needs to A five other bills", () => {
  const book = personalBook(DEMO, "yingjian");
  assert.equal(book.paidByMe.length, 1);
  assert.equal(book.paidByMe[0]?.expense.title, "昆明机场打车");
  assert.equal(book.paidByMe[0]?.expense.amountCents, 14000);
  assert.equal(book.paidByMe[0]?.myShareCents, 2000);
  assert.equal(book.paidByMe[0]?.othersOweCents, 12000);
  assert.equal(book.INeedToChip.length, 5);
  assert.equal(
    book.INeedToChip.reduce((s, r) => s + r.myShareCents, 0),
    66333,
  );
});

test("yeah A'd the Dali stay; grouping shows who still owes that bill", () => {
  const book = personalBook(DEMO, "yeah");
  assert.equal(book.paidByMe.length, 1);
  assert.equal(book.paidByMe[0]?.expense.title, "大理古城民宿");
  assert.equal(book.paidByMe[0]?.othersOweCents, 180000);

  const byPerson = groupOthersOweByPerson(book.paidByMe);
  assert.equal(byPerson.length, 6);
  assert.ok(byPerson.every((g) => g.cents === 30000 && g.rows.length === 1));
  assert.deepEqual(
    byPerson.map((g) => g.memberId).sort(),
    ["chen", "fu", "lin", "xinxin", "yingjian", "yuki"],
  );
});

test("chip-by-payer lists each bill I still need to A under who paid", () => {
  const book = personalBook(DEMO, "yingjian");
  const byPayer = groupChipByPayer(book.INeedToChip);
  const titlesByPayer = Object.fromEntries(
    byPayer.map((g) => [g.memberId, g.rows.map((r) => r.expense.title)]),
  );
  assert.deepEqual(titlesByPayer.yeah, ["大理古城民宿"]);
  assert.deepEqual(titlesByPayer.xinxin, ["洱海骑行"]);
  assert.deepEqual(titlesByPayer.fu, ["双廊海鲜"]);
  assert.deepEqual(titlesByPayer.chen, ["玉龙雪山门票"]);
  assert.deepEqual(titlesByPayer.yuki, ["丽江晚饭"]);
  assert.equal(
    byPayer.reduce((s, g) => s + g.cents, 0),
    66333,
  );
});

test("sortRowsByNewest puts later bills first", () => {
  const book = personalBook(DEMO, "yingjian");
  const sorted = sortRowsByNewest(book.INeedToChip);
  assert.deepEqual(
    sorted.map((r) => r.expense.title),
    ["丽江晚饭", "玉龙雪山门票", "双廊海鲜", "洱海骑行", "大理古城民宿"],
  );
});
