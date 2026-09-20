import { computeLedger } from "./calc";
import { newId } from "./money";
import {
  isOpenExpense,
  isSettledExpense,
  type Expense,
  type Settlement,
  type Trip,
} from "./types";

export function assertExpenseEditable(expense: Expense): void {
  if (isSettledExpense(expense)) {
    throw new Error("这笔账单已经结算，不能再改");
  }
}

export function openExpenses(trip: Trip): Expense[] {
  return trip.expenses.filter(isOpenExpense);
}

export function buildSettlement(
  trip: Trip,
  createdBy?: string | null,
  now = new Date(),
): { settlement: Settlement; expenses: Expense[] } {
  const expenses = openExpenses(trip);
  if (expenses.length === 0) {
    throw new Error("没有待结算的账单");
  }
  const ledger = computeLedger({ ...trip, expenses });
  const id = newId();
  const expenseIds = expenses.map((e) => e.id);
  return {
    settlement: {
      id,
      createdAt: now.toISOString(),
      createdBy: createdBy ?? null,
      transfers: ledger.transfers,
      expenseIds,
    },
    expenses,
  };
}

export function applySettlement(trip: Trip, settlement: Settlement): Trip {
  const locked = new Set(settlement.expenseIds);
  return {
    ...trip,
    expenses: trip.expenses.map((expense) =>
      locked.has(expense.id) && isOpenExpense(expense)
        ? { ...expense, settlementId: settlement.id }
        : expense,
    ),
    settlements: [settlement, ...(trip.settlements ?? [])],
  };
}

export function tripSettlements(trip: Trip): Settlement[] {
  return trip.settlements ?? [];
}
