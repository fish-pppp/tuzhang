import assert from "node:assert/strict";
import test from "node:test";

function assertCanRemoveMember({ actorId, ownerId, targetId }) {
  if (actorId !== ownerId) {
    throw new Error("只有创建该群的群主可以移除成员");
  }
  if (targetId === actorId) {
    throw new Error("不能移除自己");
  }
}

function isActiveMember(row) {
  return row.removed_at == null;
}

/**
 * Current-group settlement after a removal (mirrors computeLedger):
 * only active members appear; leftover participants re-AA the bill;
 * a removed payer is not credited.
 */
function splitShares(amountCents, n) {
  if (n <= 0) return [];
  const base = Math.floor(amountCents / n);
  const rem = amountCents % n;
  return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0));
}

function computeActiveLedger(members, expenses) {
  const paid = new Map();
  const share = new Map();
  for (const m of members) {
    paid.set(m.id, 0);
    share.set(m.id, 0);
  }
  let totalCents = 0;
  for (const expense of expenses) {
    if (expense.deletedAt) continue;
    const participants = expense.participantIds.filter((id) => share.has(id));
    if (participants.length === 0 || expense.amountCents <= 0) continue;
    totalCents += expense.amountCents;
    if (paid.has(expense.payerId)) {
      paid.set(expense.payerId, (paid.get(expense.payerId) ?? 0) + expense.amountCents);
    }
    const slices = splitShares(expense.amountCents, participants.length);
    participants.forEach((id, i) => {
      share.set(id, (share.get(id) ?? 0) + (slices[i] ?? 0));
    });
  }
  return members.map((m) => ({
    memberId: m.id,
    paidCents: paid.get(m.id) ?? 0,
    shareCents: share.get(m.id) ?? 0,
    netCents: (paid.get(m.id) ?? 0) - (share.get(m.id) ?? 0),
  }));
}

test("only the creating owner can remove someone else", () => {
  assert.throws(
    () => assertCanRemoveMember({ actorId: "bob", ownerId: "alice", targetId: "carol" }),
    /只有创建该群的群主/,
  );
  assert.throws(
    () => assertCanRemoveMember({ actorId: "alice", ownerId: "alice", targetId: "alice" }),
    /不能移除自己/,
  );
  assert.doesNotThrow(() =>
    assertCanRemoveMember({ actorId: "alice", ownerId: "alice", targetId: "bob" }),
  );
});

test("soft-removed rows drop out of the active roster", () => {
  const rows = [
    { user_id: "alice", removed_at: null },
    { user_id: "bob", removed_at: "2026-09-19T00:00:00.000Z" },
  ];
  assert.deepEqual(rows.filter(isActiveMember).map((r) => r.user_id), ["alice"]);
});

test("after removal, settlement ignores the person but keeps the historical bill", () => {
  const expense = {
    title: "火锅",
    amountCents: 10000,
    payerId: "alice",
    participantIds: ["alice", "bob"],
    deletedAt: null,
  };
  const before = computeActiveLedger(
    [{ id: "alice" }, { id: "bob" }],
    [expense],
  );
  assert.equal(before.find((p) => p.memberId === "alice")?.netCents, 5000);
  assert.equal(before.find((p) => p.memberId === "bob")?.netCents, -5000);

  const after = computeActiveLedger([{ id: "alice" }], [expense]);
  assert.equal(after.length, 1);
  assert.equal(after[0]?.memberId, "alice");
  // Bob is gone: Alice is the only remaining participant, so she AA's the
  // whole bill to herself. The expense row is unchanged (title / payer / shares).
  assert.equal(after[0]?.paidCents, 10000);
  assert.equal(after[0]?.shareCents, 10000);
  assert.equal(after[0]?.netCents, 0);
  assert.deepEqual(expense.participantIds, ["alice", "bob"]);
  assert.equal(expense.title, "火锅");
});
