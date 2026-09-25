export type Member = {
  id: string;
  name: string;
  avatar: string | null;
};

export type ExpenseShare = {
  memberId: string;
  cents: number;
};

/** One person's split as stored on an edit. `cents: null` means equal AA. */
export type ShareSnapshot = {
  memberId: string;
  cents: number | null;
};

export type ExpenseEditChange =
  | { field: "title"; before: string; after: string }
  | { field: "amountCents"; before: number; after: number }
  | { field: "payerId"; before: string; after: string }
  | { field: "shares"; before: ShareSnapshot[]; after: ShareSnapshot[] };

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
  amountCents: number;
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
