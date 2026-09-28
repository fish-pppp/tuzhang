import { formatCurrencyAmount, formatFxSnapshot, isForeignCurrency } from "./fx.mjs";
import { formatMoney } from "./money";
import type { Expense, ExpenseEditChange, ExpenseShare, ShareSnapshot } from "./types";

export function shareSnapshot(expense: {
  participantIds: string[];
  shares?: ExpenseShare[] | null;
  currency?: Expense["currency"];
}): ShareSnapshot[] {
  const ids = [...new Set(expense.participantIds)].sort((a, b) => a.localeCompare(b));
  const custom = (expense.shares ?? []).filter((share) => ids.includes(share.memberId));
  const useCustom = Boolean(
    expense.shares && expense.shares.length > 0 && custom.length === ids.length,
  );
  const byId = new Map(custom.map((share) => [share.memberId, share]));
  const currency = expense.currency ?? "CNY";
  return ids.map((memberId) => {
    if (!useCustom) return { memberId, cents: null };
    const share = byId.get(memberId);
    const snap: ShareSnapshot = { memberId, cents: share?.cents ?? 0 };
    if (share?.originalMinor != null && isForeignCurrency(currency)) {
      snap.originalMinor = share.originalMinor;
      snap.currency = currency;
    }
    return snap;
  });
}

function sameShares(a: ShareSnapshot[], b: ShareSnapshot[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((item, index) => {
    const other = b[index];
    return (
      item.memberId === other?.memberId &&
      item.cents === other?.cents &&
      (item.originalMinor ?? null) === (other?.originalMinor ?? null) &&
      (item.currency ?? null) === (other?.currency ?? null)
    );
  });
}

/** Fields that actually differ. Empty means the save is a no-op. */
export function diffExpenseEdits(
  before: {
    title: string;
    amountCents: number;
    payerId: string;
    participantIds: string[];
    shares?: ExpenseShare[] | null;
    currency?: Expense["currency"];
    originalMinor?: number | null;
    fx?: Expense["fx"];
  },
  after: {
    title: string;
    amountCents: number;
    payerId: string;
    participantIds: string[];
    shares?: ExpenseShare[] | null;
    currency?: Expense["currency"];
    originalMinor?: number | null;
    fx?: Expense["fx"];
  },
): ExpenseEditChange[] {
  const changes: ExpenseEditChange[] = [];
  if (before.title !== after.title) {
    changes.push({ field: "title", before: before.title, after: after.title });
  }
  if (before.amountCents !== after.amountCents) {
    changes.push({
      field: "amountCents",
      before: before.amountCents,
      after: after.amountCents,
    });
  }
  if (before.payerId !== after.payerId) {
    changes.push({ field: "payerId", before: before.payerId, after: after.payerId });
  }
  const beforeShares = shareSnapshot(before);
  const afterShares = shareSnapshot(after);
  if (!sameShares(beforeShares, afterShares)) {
    changes.push({ field: "shares", before: beforeShares, after: afterShares });
  }
  const beforeFx = fxEditLabel(before);
  const afterFx = fxEditLabel(after);
  if (beforeFx !== afterFx) {
    changes.push({ field: "fx", before: beforeFx, after: afterFx });
  }
  return changes;
}

function fxEditLabel(expense: {
  currency?: Expense["currency"];
  originalMinor?: number | null;
  amountCents: number;
  fx?: Expense["fx"];
}): string {
  if (!isForeignCurrency(expense.currency ?? "CNY")) return "人民币";
  return formatFxSnapshot(expense);
}

/** Only the bill's creator may change an open (not deleted, not settled) bill. */
export function canEditExpense(
  expense: Pick<Expense, "createdBy" | "deletedAt" | "settlementId">,
  actorId: string | null | undefined,
): boolean {
  if (!actorId || !expense.createdBy) return false;
  if (expense.deletedAt || expense.settlementId) return false;
  return expense.createdBy === actorId;
}

export function formatShareSnapshot(
  shares: ShareSnapshot[],
  nameOf: (id: string) => string,
): string {
  if (shares.length === 0) return "无人分摊";
  const equal = shares.every((share) => share.cents == null);
  if (equal) {
    return `${shares.map((share) => nameOf(share.memberId)).join("、")}（平均）`;
  }
  return shares
    .map((share) => {
      const name = nameOf(share.memberId);
      const cny = formatMoney(share.cents ?? 0);
      if (share.originalMinor != null && share.currency && isForeignCurrency(share.currency)) {
        return `${name} ${formatCurrencyAmount(share.currency, share.originalMinor)}（${cny}）`;
      }
      return `${name} ${cny}`;
    })
    .join("、");
}

const FIELD_LABEL: Record<ExpenseEditChange["field"], string> = {
  title: "标题",
  amountCents: "金额",
  payerId: "付款人",
  shares: "分摊",
  fx: "汇率",
};

export function formatExpenseChange(
  change: ExpenseEditChange,
  nameOf: (id: string) => string,
): { label: string; before: string; after: string } {
  if (change.field === "title") {
    return { label: FIELD_LABEL.title, before: change.before, after: change.after };
  }
  if (change.field === "amountCents") {
    return {
      label: FIELD_LABEL.amountCents,
      before: formatMoney(change.before),
      after: formatMoney(change.after),
    };
  }
  if (change.field === "payerId") {
    return {
      label: FIELD_LABEL.payerId,
      before: nameOf(change.before),
      after: nameOf(change.after),
    };
  }
  if (change.field === "fx") {
    return { label: FIELD_LABEL.fx, before: change.before, after: change.after };
  }
  return {
    label: FIELD_LABEL.shares,
    before: formatShareSnapshot(change.before, nameOf),
    after: formatShareSnapshot(change.after, nameOf),
  };
}

function isShareSnapshot(value: unknown): value is ShareSnapshot {
  if (!value || typeof value !== "object") return false;
  const row = value as {
    memberId?: unknown;
    cents?: unknown;
    originalMinor?: unknown;
    currency?: unknown;
  };
  if (typeof row.memberId !== "string" || row.memberId.length === 0) return false;
  if (!(row.cents === null || (typeof row.cents === "number" && Number.isInteger(row.cents)))) {
    return false;
  }
  if (
    row.originalMinor != null &&
    !(
      typeof row.originalMinor === "number" &&
      Number.isInteger(row.originalMinor) &&
      row.originalMinor >= 0
    )
  ) {
    return false;
  }
  if (
    row.currency != null &&
    row.currency !== "CNY" &&
    row.currency !== "AUD" &&
    row.currency !== "NZD" &&
    row.currency !== "VND"
  ) {
    return false;
  }
  return true;
}

export function parseExpenseChanges(raw: unknown): ExpenseEditChange[] {
  const list = Array.isArray(raw) ? raw : [];
  const changes: ExpenseEditChange[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const row = item as { field?: unknown; before?: unknown; after?: unknown };
    if (row.field === "title" && typeof row.before === "string" && typeof row.after === "string") {
      changes.push({ field: "title", before: row.before, after: row.after });
      continue;
    }
    if (
      row.field === "amountCents" &&
      typeof row.before === "number" &&
      Number.isInteger(row.before) &&
      typeof row.after === "number" &&
      Number.isInteger(row.after)
    ) {
      changes.push({ field: "amountCents", before: row.before, after: row.after });
      continue;
    }
    if (
      row.field === "payerId" &&
      typeof row.before === "string" &&
      typeof row.after === "string"
    ) {
      changes.push({ field: "payerId", before: row.before, after: row.after });
      continue;
    }
    if (
      row.field === "shares" &&
      Array.isArray(row.before) &&
      Array.isArray(row.after) &&
      row.before.every(isShareSnapshot) &&
      row.after.every(isShareSnapshot)
    ) {
      changes.push({ field: "shares", before: row.before, after: row.after });
      continue;
    }
    if (row.field === "fx" && typeof row.before === "string" && typeof row.after === "string") {
      changes.push({ field: "fx", before: row.before, after: row.after });
    }
  }
  return changes;
}
