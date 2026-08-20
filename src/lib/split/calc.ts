import type { Expense, Ledger, PersonLedger, Transfer, Trip } from "./types";

function splitShares(amountCents: number, n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor(amountCents / n);
  const rem = amountCents % n;
  return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0));
}

export function computeLedger(trip: Trip): Ledger {
  const paid = new Map<string, number>();
  const share = new Map<string, number>();
  for (const m of trip.members) {
    paid.set(m.id, 0);
    share.set(m.id, 0);
  }

  let totalCents = 0;
  for (const expense of trip.expenses) {
    const participants = expense.participantIds.filter((id) => share.has(id));
    if (participants.length === 0 || expense.amountCents <= 0) continue;
    totalCents += expense.amountCents;
    if (paid.has(expense.payerId)) {
      paid.set(expense.payerId, (paid.get(expense.payerId) ?? 0) + expense.amountCents);
    }
    const slices = splitShares(expense.amountCents, participants.length);
    participants.forEach((id, i) => {
      share.set(id, (share.get(id) ?? 0) + (slices[i] ?? 0));
    });
  }

  const perPerson: PersonLedger[] = trip.members.map((m) => {
    const paidCents = paid.get(m.id) ?? 0;
    const shareCents = share.get(m.id) ?? 0;
    return {
      memberId: m.id,
      paidCents,
      shareCents,
      netCents: paidCents - shareCents,
    };
  });

  const transfers = settle(perPerson);
  const unsettledCents = perPerson.reduce(
    (sum, p) => sum + Math.max(0, p.netCents),
    0,
  );

  return { totalCents, perPerson, transfers, unsettledCents };
}

function settle(perPerson: PersonLedger[]): Transfer[] {
  const debtors = perPerson
    .filter((p) => p.netCents < -0)
    .map((p) => ({ id: p.memberId, cents: -p.netCents }))
    .sort((a, b) => b.cents - a.cents);
  const creditors = perPerson
    .filter((p) => p.netCents > 0)
    .map((p) => ({ id: p.memberId, cents: p.netCents }))
    .sort((a, b) => b.cents - a.cents);

  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i];
    const c = creditors[j];
    if (!d || !c) break;
    const amount = Math.min(d.cents, c.cents);
    if (amount > 0) {
      transfers.push({ fromId: d.id, toId: c.id, cents: amount });
      d.cents -= amount;
      c.cents -= amount;
    }
    if (d.cents <= 0) i += 1;
    if (c.cents <= 0) j += 1;
  }
  return transfers;
}

export function expenseInvolves(expense: Expense, memberId: string): boolean {
  return expense.payerId === memberId || expense.participantIds.includes(memberId);
}
