export type Member = {
  id: string;
  name: string;
  avatar: string | null;
};

export type Expense = {
  id: string;
  title: string;
  amountCents: number;
  payerId: string;
  participantIds: string[];
  createdAt: string;
  /** Set when the bill is soft-deleted; omitted/empty means still active. */
  deletedAt?: string | null;
  deletedBy?: string | null;
  deleteReason?: string | null;
};

export function isActiveExpense(expense: Expense): boolean {
  return !expense.deletedAt;
}

export type Trip = {
  id: string;
  name: string;
  members: Member[];
  expenses: Expense[];
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
