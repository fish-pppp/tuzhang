import type { Expense, ExpenseShare } from "./types";

export function splitShares(amountCents: number, n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor(amountCents / n);
  const rem = amountCents % n;
  return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0));
}

export function equalShares(
  participantIds: string[],
  amountCents: number,
): ExpenseShare[] {
  const slices = splitShares(amountCents, participantIds.length);
  return participantIds.map((memberId, i) => ({
    memberId,
    cents: slices[i] ?? 0,
  }));
}

/**
 * Normalize custom amounts for a new bill.
 * Empty / omitted `shares` means equal AA (returns undefined).
 */
export function normalizeExpenseShares(input: {
  participantIds: string[];
  amountCents: number;
  shares?: ExpenseShare[] | null;
}): ExpenseShare[] | undefined {
  const participantIds = [...new Set(input.participantIds)];
  if (participantIds.length === 0) {
    throw new Error("至少选择一位一起分摊的人");
  }
  if (!input.shares || input.shares.length === 0) return undefined;

  const byId = new Map<string, number>();
  for (const share of input.shares) {
    if (!participantIds.includes(share.memberId)) {
      throw new Error("自定义金额里有未选中的人");
    }
    if (!Number.isInteger(share.cents) || share.cents < 0) {
      throw new Error("自定义金额必须是非负整数（分）");
    }
    byId.set(share.memberId, (byId.get(share.memberId) ?? 0) + share.cents);
  }

  const missing = participantIds.filter((id) => !byId.has(id));
  if (missing.length > 0) {
    throw new Error("请给每一位一起分摊的人填写金额");
  }

  const extra = [...byId.keys()].filter((id) => !participantIds.includes(id));
  if (extra.length > 0) {
    throw new Error("自定义金额里有未选中的人");
  }

  const total = participantIds.reduce((sum, id) => sum + (byId.get(id) ?? 0), 0);
  if (total !== input.amountCents) {
    throw new Error("自定义金额加起来必须等于账单总额");
  }

  return participantIds.map((memberId) => ({
    memberId,
    cents: byId.get(memberId) ?? 0,
  }));
}

export function resolveShares(
  expense: Pick<Expense, "participantIds" | "amountCents" | "shares">,
  allowedIds?: Set<string>,
): ExpenseShare[] {
  const ids = expense.participantIds.filter((id) =>
    allowedIds ? allowedIds.has(id) : true,
  );
  if (ids.length === 0 || expense.amountCents <= 0) return [];

  if (expense.shares && expense.shares.length > 0) {
    const byId = new Map(expense.shares.map((s) => [s.memberId, s.cents]));
    const custom = ids
      .map((memberId) => ({
        memberId,
        cents: byId.get(memberId) ?? 0,
      }))
      .filter((s) => s.cents > 0 || byId.has(s.memberId));
    if (custom.length > 0) return custom;
  }

  return equalShares(ids, expense.amountCents);
}
