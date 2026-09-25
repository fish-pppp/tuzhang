import { create } from "zustand";
import { persist } from "zustand/middleware";
import { cloneDemoTrip } from "./demo";
import { canEditExpense, diffExpenseEdits } from "./expense-edit";
import { newId } from "./money";
import { normalizeDeleteReason } from "./delete-reason";
import { applySettlement, assertExpenseEditable, buildSettlement } from "./settlement";
import { normalizeExpensePhotos } from "./photo";
import { normalizeExpenseShares } from "./shares";
import { isSettledExpense, type Expense, type ExpenseEdit, type Member, type Trip } from "./types";

type ExpenseDraft = Omit<
  Expense,
  "id" | "createdAt" | "createdBy" | "deletedAt" | "deletedBy" | "deleteReason" | "settlementId"
>;

type TripState = {
  trip: Trip;
  selectedMemberId: string | null;
  meId: string | null;
  hydrated: boolean;
  setHydrated: (value: boolean) => void;
  selectMember: (id: string | null) => void;
  setMeId: (id: string) => void;
  renameTrip: (name: string) => void;
  addExpense: (input: ExpenseDraft) => void;
  updateExpense: (id: string, input: ExpenseDraft) => void;
  removeExpense: (id: string, reason: string) => void;
  settleOpen: () => void;
  addMember: (name: string) => void;
  renameMember: (id: string, name: string) => void;
  removeMember: (id: string) => void;
  resetDemo: () => void;
  clearExpenses: () => void;
  replaceTrip: (trip: Trip) => void;
};

export const useTripStore = create<TripState>()(
  persist(
    (set) => ({
      trip: cloneDemoTrip(),
      selectedMemberId: null,
      meId: null,
      hydrated: false,
      setHydrated: (value) => set({ hydrated: value }),
      selectMember: (id) =>
        set((s) => ({
          selectedMemberId: s.selectedMemberId === id ? null : id,
        })),
      setMeId: (id) => set({ meId: id, selectedMemberId: id }),
      renameTrip: (name) => set((s) => ({ trip: { ...s.trip, name: name.trim() || s.trip.name } })),
      addExpense: (input) =>
        set((s) => {
          const shares = normalizeExpenseShares({
            participantIds: input.participantIds,
            amountCents: input.amountCents,
            shares: input.shares,
          });
          const photos = normalizeExpensePhotos(input.photos);
          return {
            trip: {
              ...s.trip,
              expenses: [
                {
                  title: input.title,
                  amountCents: input.amountCents,
                  payerId: input.payerId,
                  participantIds: [...new Set(input.participantIds)],
                  ...(shares ? { shares } : {}),
                  ...(photos ? { photos } : {}),
                  id: newId(),
                  createdAt: new Date().toISOString(),
                  createdBy: s.meId ?? input.payerId,
                },
                ...s.trip.expenses,
              ],
            },
          };
        }),
      updateExpense: (id, input) =>
        set((s) => {
          const current = s.trip.expenses.find((expense) => expense.id === id);
          if (!current || !canEditExpense(current, s.meId)) return s;
          const shares = normalizeExpenseShares({
            participantIds: input.participantIds,
            amountCents: input.amountCents,
            shares: input.shares,
          });
          const next = {
            title: input.title.trim() || "未命名支出",
            amountCents: input.amountCents,
            payerId: input.payerId,
            participantIds: [...new Set(input.participantIds)],
            shares,
          };
          const changes = diffExpenseEdits(current, next);
          if (changes.length === 0) return s;
          const edit: ExpenseEdit = {
            id: newId(),
            expenseId: id,
            editedBy: s.meId ?? current.createdBy ?? "",
            editedAt: new Date().toISOString(),
            changes,
          };
          return {
            trip: {
              ...s.trip,
              expenses: s.trip.expenses.map((expense) => {
                if (expense.id !== id) return expense;
                return {
                  ...expense,
                  title: next.title,
                  amountCents: next.amountCents,
                  payerId: next.payerId,
                  participantIds: next.participantIds,
                  ...(shares ? { shares } : { shares: undefined }),
                };
              }),
              expenseEdits: [edit, ...(s.trip.expenseEdits ?? [])],
            },
          };
        }),
      removeExpense: (id, reason) =>
        set((s) => {
          const target = s.trip.expenses.find((e) => e.id === id);
          if (target) assertExpenseEditable(target);
          const deleteReason = normalizeDeleteReason(reason);
          const deletedAt = new Date().toISOString();
          return {
            trip: {
              ...s.trip,
              expenses: s.trip.expenses.map((e) =>
                e.id === id && !e.deletedAt
                  ? {
                      ...e,
                      deletedAt,
                      deletedBy: s.meId,
                      deleteReason,
                    }
                  : e,
              ),
            },
          };
        }),
      settleOpen: () =>
        set((s) => {
          const { settlement } = buildSettlement(s.trip, s.meId);
          return { trip: applySettlement(s.trip, settlement) };
        }),
      addMember: (name) =>
        set((s) => {
          const trimmed = name.trim();
          if (!trimmed) return s;
          const member: Member = { id: newId(), name: trimmed, avatar: null };
          return { trip: { ...s.trip, members: [...s.trip.members, member] } };
        }),
      renameMember: (id, name) =>
        set((s) => ({
          trip: {
            ...s.trip,
            members: s.trip.members.map((m) =>
              m.id === id ? { ...m, name: name.trim() || m.name } : m,
            ),
          },
        })),
      removeMember: (id) =>
        set((s) => {
          if (s.trip.members.length <= 1) return s;
          return {
            trip: {
              ...s.trip,
              members: s.trip.members.filter((m) => m.id !== id),
              expenses: s.trip.expenses
                .map((e) => {
                  if (isSettledExpense(e)) return e;
                  return {
                    ...e,
                    participantIds: e.participantIds.filter((pid) => pid !== id),
                    shares: e.shares?.filter((share) => share.memberId !== id),
                  };
                })
                .filter(
                  (e) => isSettledExpense(e) || (e.payerId !== id && e.participantIds.length > 0),
                ),
            },
            selectedMemberId: s.selectedMemberId === id ? null : s.selectedMemberId,
            meId: s.meId === id ? null : s.meId,
          };
        }),
      resetDemo: () => set({ trip: cloneDemoTrip(), selectedMemberId: null, meId: null }),
      clearExpenses: () =>
        set((s) => {
          const deletedAt = new Date().toISOString();
          return {
            trip: {
              ...s.trip,
              expenses: s.trip.expenses.map((e) =>
                e.deletedAt || isSettledExpense(e)
                  ? e
                  : {
                      ...e,
                      deletedAt,
                      deletedBy: s.meId,
                      deleteReason: "清空示例账单",
                    },
              ),
            },
          };
        }),
      replaceTrip: (trip) =>
        set({
          trip: { ...trip, settlements: trip.settlements ?? [] },
          selectedMemberId: null,
        }),
    }),
    {
      name: "tuzhang-trip-v4",
      partialize: (s) => ({ trip: s.trip, meId: s.meId }),
      skipHydration: true,
    },
  ),
);
