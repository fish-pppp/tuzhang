import { create } from "zustand";
import { persist } from "zustand/middleware";
import { cloneDemoTrip } from "./demo";
import { newId } from "./money";
import type { Expense, Member, Trip } from "./types";

type TripState = {
  trip: Trip;
  selectedMemberId: string | null;
  meId: string | null;
  hydrated: boolean;
  setHydrated: (value: boolean) => void;
  selectMember: (id: string | null) => void;
  setMeId: (id: string) => void;
  renameTrip: (name: string) => void;
  addExpense: (input: Omit<Expense, "id" | "createdAt">) => void;
  removeExpense: (id: string) => void;
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
      renameTrip: (name) =>
        set((s) => ({ trip: { ...s.trip, name: name.trim() || s.trip.name } })),
      addExpense: (input) =>
        set((s) => ({
          trip: {
            ...s.trip,
            expenses: [
              {
                ...input,
                id: newId(),
                createdAt: new Date().toISOString(),
              },
              ...s.trip.expenses,
            ],
          },
        })),
      removeExpense: (id) =>
        set((s) => ({
          trip: {
            ...s.trip,
            expenses: s.trip.expenses.filter((e) => e.id !== id),
          },
        })),
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
                .map((e) => ({
                  ...e,
                  participantIds: e.participantIds.filter((pid) => pid !== id),
                }))
                .filter(
                  (e) => e.payerId !== id && e.participantIds.length > 0,
                ),
            },
            selectedMemberId:
              s.selectedMemberId === id ? null : s.selectedMemberId,
            meId: s.meId === id ? null : s.meId,
          };
        }),
      resetDemo: () =>
        set({ trip: cloneDemoTrip(), selectedMemberId: null, meId: null }),
      clearExpenses: () =>
        set((s) => ({ trip: { ...s.trip, expenses: [] } })),
      replaceTrip: (trip) => set({ trip, selectedMemberId: null }),
    }),
    {
      name: "tuzhang-trip-v3",
      partialize: (s) => ({ trip: s.trip, meId: s.meId }),
      skipHydration: true,
    },
  ),
);
