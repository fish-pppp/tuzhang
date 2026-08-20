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
};

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
