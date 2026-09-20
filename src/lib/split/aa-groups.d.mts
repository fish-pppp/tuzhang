import type { Expense } from "./types";

export type PersonAaGroup = {
  memberId: string;
  cents: number;
  rows: Array<{ expense: Expense; cents: number }>;
};

export function sortRowsByNewest<T extends { expense: Expense }>(rows: T[]): T[];
export function groupOthersOweByPerson(
  paidByMe: Array<{
    expense: Expense;
    others: Array<{ memberId: string; cents: number }>;
  }>,
): PersonAaGroup[];
export function groupChipByPayer(
  chipRows: Array<{ expense: Expense; myShareCents: number }>,
): PersonAaGroup[];
