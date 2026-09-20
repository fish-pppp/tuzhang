export type Member = {
  id: string;
  name: string;
  avatar: string | null;
};

export type ExpenseShare = {
  memberId: string;
  cents: number;
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
  createdAt: string;
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
