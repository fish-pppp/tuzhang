export type Member = {
  id: string;
  name: string;
  avatar: string | null;
};

export type ExpenseShare = {
  memberId: string;
  /** This person's share of the CNY ledger, in cents. */
  cents: number;
  /**
   * This person's share in minor units of the bill currency.
   * Set for custom splits in AUD / NZD / VND. Omitted for RMB.
   */
  originalMinor?: number;
};

/** One person's split as stored on an edit. `cents: null` means equal AA. */
export type ShareSnapshot = {
  memberId: string;
  cents: number | null;
  /** Original-currency minor units, when this custom share was entered that way. */
  originalMinor?: number | null;
  currency?: CurrencyCode;
};

export type CurrencyCode = "CNY" | "AUD" | "NZD" | "VND";

/** Rate snapshot frozen onto a foreign-currency bill. Amounts in the ledger stay CNY. */
export type ExpenseFx = {
  /** CNY per 1 unit of the foreign currency, before the bank fee. */
  midRate: string;
  /** Fee ratio, e.g. "0.005" for 0.5%. */
  feeRate: string;
  /** midRate × (1 + feeRate). */
  rate: string;
  quotedAt: string;
  /** True when this quote was the last successful cache, not a live fetch. */
  cached: boolean;
  cachedAt?: string | null;
};

export type ExpenseEditChange =
  | { field: "title"; before: string; after: string }
  | { field: "amountCents"; before: number; after: number }
  | { field: "payerId"; before: string; after: string }
  | { field: "shares"; before: ShareSnapshot[]; after: ShareSnapshot[] }
  | { field: "fx"; before: string; after: string };

export type ExpenseEdit = {
  id: string;
  expenseId: string;
  editedBy: string;
  editedAt: string;
  changes: ExpenseEditChange[];
};

export type ExpensePhoto = {
  id: string;
  /** Same-origin `/api/expense-photo/<id>` or a compressed JPEG data URL (demo). */
  url: string;
};

export type Expense = {
  id: string;
  title: string;
  /** CNY cents. Foreign bills store the converted amount here so splits stay in RMB. */
  amountCents: number;
  /** Original currency. Omitted or CNY means the amount was entered in RMB. */
  currency?: CurrencyCode;
  /** Minor units of `currency` (cents, or whole dong for VND). */
  originalMinor?: number;
  fx?: ExpenseFx;
  payerId: string;
  participantIds: string[];
  /**
   * Per-person amounts when the bill is not an equal AA.
   * Omitted/empty means split the total evenly among `participantIds`.
   */
  shares?: ExpenseShare[];
  /** Optional receipt / proof photos. Omitted/empty means none. */
  photos?: ExpensePhoto[];
  createdAt: string;
  /** Account that created this bill. Only they may edit its details. */
  createdBy?: string | null;
  /** Set when the bill is soft-deleted; omitted/empty means still active. */
  deletedAt?: string | null;
  deletedBy?: string | null;
  deleteReason?: string | null;
  /** Set after an early/offline settlement; locked bills must not change. */
  settlementId?: string | null;
};

export function isActiveExpense(expense: Expense): boolean {
  return !expense.deletedAt;
}

export function isSettledExpense(expense: Expense): boolean {
  return Boolean(expense.settlementId);
}

/** Still counts toward the current open period. */
export function isOpenExpense(expense: Expense): boolean {
  return isActiveExpense(expense) && !isSettledExpense(expense);
}

export function isCustomSplit(expense: Expense): boolean {
  return Boolean(expense.shares && expense.shares.length > 0);
}

export type Settlement = {
  id: string;
  createdAt: string;
  createdBy?: string | null;
  /** Snapshot of who should pay whom, settled offline. */
  transfers: Transfer[];
  expenseIds: string[];
};

export type Trip = {
  id: string;
  name: string;
  members: Member[];
  expenses: Expense[];
  settlements?: Settlement[];
  /** Append-only edits, newest first. Omitted when a trip has none. */
  expenseEdits?: ExpenseEdit[];
};

export type PersonLedger = {
  memberId: string;
  paidCents: number;
  shareCents: number;
  netCents: number;
};

export type Transfer = {
  fromId: string;
  toId: string;
  cents: number;
};

export type Ledger = {
  totalCents: number;
  perPerson: PersonLedger[];
  transfers: Transfer[];
  unsettledCents: number;
};
