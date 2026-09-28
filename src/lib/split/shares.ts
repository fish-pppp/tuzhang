import {
  allocateByWeights,
  formatCurrencyAmount,
  formatCurrencyInput,
  isForeignCurrency,
} from "./fx.mjs";
import { formatMoney } from "./money";
import type { Expense, ExpenseShare } from "./types";

export function splitShares(amountCents: number, n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor(amountCents / n);
  const rem = amountCents % n;
  return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0));
}

export function equalShares(participantIds: string[], amountCents: number): ExpenseShare[] {
  const slices = splitShares(amountCents, participantIds.length);
  return participantIds.map((memberId, i) => ({
    memberId,
    cents: slices[i] ?? 0,
  }));
}

/**
 * Normalize custom amounts for a new bill.
 * Empty / omitted `shares` means equal AA (returns undefined).
 *
 * Foreign custom splits carry `originalMinor` in the bill currency. Those
 * amounts must add up to the bill's original total; CNY cents are then
 * allocated so they still add up to `amountCents`. Older foreign splits that
 * only have CNY cents stay as stored.
 */
export function normalizeExpenseShares(input: {
  participantIds: string[];
  amountCents: number;
  currency?: string;
  originalMinor?: number | null;
  shares?: ExpenseShare[] | null;
}): ExpenseShare[] | undefined {
  const participantIds = [...new Set(input.participantIds)];
  if (participantIds.length === 0) {
    throw new Error("至少选择一位一起分摊的人");
  }
  if (!input.shares || input.shares.length === 0) return undefined;

  const byCents = new Map<string, number>();
  const byMinor = new Map<string, number>();
  let sawOriginal = false;
  let missingOriginal = false;
  for (const share of input.shares) {
    if (!participantIds.includes(share.memberId)) {
      throw new Error("自定义金额里有未选中的人");
    }
    if (!Number.isInteger(share.cents) || share.cents < 0) {
      throw new Error("自定义金额必须是非负整数（分）");
    }
    byCents.set(share.memberId, (byCents.get(share.memberId) ?? 0) + share.cents);
    if (share.originalMinor == null) {
      missingOriginal = true;
      continue;
    }
    if (!Number.isInteger(share.originalMinor) || share.originalMinor < 0) {
      throw new Error("请按所选货币填写每个人的金额");
    }
    sawOriginal = true;
    byMinor.set(share.memberId, (byMinor.get(share.memberId) ?? 0) + share.originalMinor);
  }

  const missing = participantIds.filter((id) => !byCents.has(id));
  if (missing.length > 0) {
    throw new Error("请给每一位一起分摊的人填写金额");
  }

  const extra = [...byCents.keys()].filter((id) => !participantIds.includes(id));
  if (extra.length > 0) {
    throw new Error("自定义金额里有未选中的人");
  }

  const foreign = isForeignCurrency(input.currency ?? "CNY");
  if (foreign && sawOriginal) {
    if (missingOriginal || participantIds.some((id) => !byMinor.has(id))) {
      throw new Error("请按所选货币填写每个人的金额");
    }
    if (input.originalMinor == null) {
      throw new Error("外币账单缺少原币金额");
    }
    const minorTotal = participantIds.reduce((sum, id) => sum + (byMinor.get(id) ?? 0), 0);
    if (minorTotal !== input.originalMinor) {
      throw new Error("自定义金额加起来必须等于账单总额");
    }
    const allocated = allocateByWeights(
      input.amountCents,
      participantIds.map((id) => byMinor.get(id) ?? 0),
    );
    const centsTotal = allocated.reduce((sum, cents) => sum + cents, 0);
    if (centsTotal !== input.amountCents) {
      throw new Error("折合人民币没有对上");
    }
    return participantIds.map((memberId, index) => ({
      memberId,
      cents: allocated[index] ?? 0,
      originalMinor: byMinor.get(memberId) ?? 0,
    }));
  }

  const total = participantIds.reduce((sum, id) => sum + (byCents.get(id) ?? 0), 0);
  if (total !== input.amountCents) {
    throw new Error("自定义金额加起来必须等于账单总额");
  }

  return participantIds.map((memberId) => ({
    memberId,
    cents: byCents.get(memberId) ?? 0,
  }));
}

export type ShareAmountRow = {
  memberId: string;
  cents: number;
  /** Minor units of the bill currency. Null on RMB bills. */
  originalMinor: number | null;
};

/** Per-person amounts, with the bill currency filled in for foreign bills. */
export function shareRows(expense: Expense): ShareAmountRow[] {
  const slices = resolveShares(expense);
  const currency = expense.currency ?? "CNY";
  if (!isForeignCurrency(currency) || expense.originalMinor == null) {
    return slices.map((slice) => ({
      memberId: slice.memberId,
      cents: slice.cents,
      originalMinor: null,
    }));
  }

  const stored = new Map(
    (expense.shares ?? []).map((share) => [share.memberId, share.originalMinor]),
  );
  const complete = slices.every((slice) => {
    const minor = stored.get(slice.memberId);
    return minor != null && Number.isInteger(minor) && minor >= 0;
  });
  if (complete) {
    const minorTotal = slices.reduce((sum, slice) => sum + (stored.get(slice.memberId) ?? 0), 0);
    if (minorTotal === expense.originalMinor) {
      return slices.map((slice) => ({
        memberId: slice.memberId,
        cents: slice.cents,
        originalMinor: stored.get(slice.memberId) ?? 0,
      }));
    }
  }

  const allocated = allocateByWeights(
    expense.originalMinor,
    slices.map((slice) => Math.max(0, slice.cents)),
  );
  return slices.map((slice, index) => ({
    memberId: slice.memberId,
    cents: slice.cents,
    originalMinor: allocated[index] ?? 0,
  }));
}

/** Input text for each custom share, in the bill currency. */
export function customAmountInputs(expense: Expense): Record<string, string> {
  const currency = expense.currency ?? "CNY";
  const foreign = isForeignCurrency(currency);
  const next: Record<string, string> = {};
  for (const row of shareRows(expense)) {
    if (foreign && row.originalMinor != null) {
      next[row.memberId] = formatCurrencyInput(currency, row.originalMinor);
    } else {
      next[row.memberId] = formatCurrencyInput("CNY", row.cents);
    }
  }
  return next;
}

/** One person's share, original currency first when the bill is not RMB. */
export function formatShareAmount(
  currency: string,
  cents: number,
  originalMinor: number | null,
): string {
  if (originalMinor != null && isForeignCurrency(currency)) {
    return `${formatCurrencyAmount(currency, originalMinor)} · ${formatMoney(cents)}`;
  }
  return formatMoney(cents);
}

export function resolveShares(
  expense: Pick<Expense, "participantIds" | "amountCents" | "shares">,
  allowedIds?: Set<string>,
): ExpenseShare[] {
  const ids = expense.participantIds.filter((id) => (allowedIds ? allowedIds.has(id) : true));
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
