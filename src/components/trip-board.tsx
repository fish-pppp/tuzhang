import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ChevronDown, Download, Plus, RotateCcw, Users } from "lucide-react";
import { AddExpenseDialog } from "@/components/add-expense-dialog";
import { AuthSlot } from "@/components/auth-slot";
import { DeleteExpenseDialog } from "@/components/delete-expense-dialog";
import { ExpenseDayList } from "@/components/expense-card";
import { ExpenseDetailDialog } from "@/components/expense-detail-dialog";
import { ExpenseEditHistory } from "@/components/expense-edit-history";
import { GroupMembersDialog } from "@/components/group-members-dialog";
import { GroupSwitcher } from "@/components/group-switcher";
import { MemberAvatar } from "@/components/member-avatar";
import { MembersDialog } from "@/components/members-dialog";
import { MyGroupsPanel } from "@/components/my-groups";
import { SettleDialog } from "@/components/settle-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { computeLedger, expenseInvolves } from "@/lib/split/calc";
import { canEditExpense } from "@/lib/split/expense-edit";
import { formatStamp, groupByDay } from "@/lib/split/date";
import { downloadMarkdown, exportFileName, exportTripMarkdown } from "@/lib/split/export-md";
import { formatMoney } from "@/lib/split/money";
import { openExpenses, tripSettlements } from "@/lib/split/settlement";
import { useTripStore } from "@/lib/split/store";
import { useTripSync } from "@/lib/split/use-trip-sync";
import {
  isActiveExpense,
  isOpenExpense,
  type Expense,
  type ExpensePhoto,
  type Member,
  type Trip,
} from "@/lib/split/types";
import { cn } from "@/lib/utils";

export type TripViewProps = {
  trip: Trip;
  meId: string | null;
  variant: "demo" | "group";
  inviteCode?: string;
  groupId?: string;
  createdBy?: string;
  formerMembers?: Member[];
  onRename: (name: string) => void;
  onAddExpense: (
    input: Omit<
      Expense,
      "id" | "createdAt" | "createdBy" | "deletedAt" | "deletedBy" | "deleteReason" | "settlementId"
    >,
  ) => void | Promise<void>;
  onUpdateExpense?: (
    id: string,
    input: Omit<
      Expense,
      "id" | "createdAt" | "createdBy" | "deletedAt" | "deletedBy" | "deleteReason" | "settlementId"
    >,
  ) => void | Promise<void>;
  onUploadExpensePhoto?: (base64: string) => Promise<ExpensePhoto>;
  onDiscardExpensePhotos?: (ids: string[]) => void | Promise<void>;
  onRemoveExpense: (id: string, reason: string) => void | Promise<void>;
  onSettle: () => void | Promise<void>;
  onSetMe?: (id: string) => void;
  onLeave?: () => void;
  onUpdateMyName?: (name: string) => void | Promise<void>;
  onRemoveMember?: (userId: string) => void | Promise<void>;
};

type BoardTab = "mine" | "all" | "settle";

export function TripView({
  trip,
  meId,
  variant,
  inviteCode,
  createdBy,
  formerMembers,
  onRename,
  onAddExpense,
  onUpdateExpense,
  onUploadExpensePhoto,
  onDiscardExpensePhotos,
  onRemoveExpense,
  onSettle,
  onSetMe,
  onLeave,
  onUpdateMyName,
  onRemoveMember,
}: TripViewProps) {
  const [tab, setTab] = useState<BoardTab>("mine");
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [focusExpenseId, setFocusExpenseId] = useState<string | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const [detail, setDetail] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState<Expense | null>(null);
  const [settleOpen, setSettleOpen] = useState(false);
  const [exported, setExported] = useState(false);
  const [pastOpen, setPastOpen] = useState(false);

  const ledger = useMemo(() => computeLedger(trip), [trip]);
  const settlements = useMemo(() => tripSettlements(trip), [trip]);
  const openBillCount = useMemo(() => openExpenses(trip).length, [trip]);
  const memberMap = useMemo(
    () => Object.fromEntries([...trip.members, ...(formerMembers ?? [])].map((m) => [m.id, m])),
    [formerMembers, trip.members],
  );
  const myNet = meId ? (ledger.perPerson.find((p) => p.memberId === meId)?.netCents ?? 0) : 0;

  const activeExpenses = useMemo(() => trip.expenses.filter(isActiveExpense), [trip.expenses]);
  const myExpenses = useMemo(
    () => (meId ? activeExpenses.filter((e) => expenseInvolves(e, meId)) : []),
    [activeExpenses, meId],
  );
  const deletedExpenses = useMemo(
    () => trip.expenses.filter((e) => !isActiveExpense(e)),
    [trip.expenses],
  );
  const expenseById = useMemo(
    () => Object.fromEntries(trip.expenses.map((expense) => [expense.id, expense])),
    [trip.expenses],
  );
  const detailEdits = useMemo(
    () => (trip.expenseEdits ?? []).filter((edit) => edit.expenseId === detail?.id),
    [detail?.id, trip.expenseEdits],
  );

  useEffect(() => {
    setDetail((current) => {
      if (!current) return current;
      return trip.expenses.find((e) => e.id === current.id) ?? null;
    });
  }, [trip.expenses]);

  useEffect(() => {
    if (!focusExpenseId) return;
    const next = trip.expenses.find((expense) => expense.id === focusExpenseId);
    if (!next) return;
    setDetail(next);
    setFocusExpenseId(null);
  }, [focusExpenseId, trip.expenses]);

  function exportRecords() {
    downloadMarkdown(exportFileName(trip.name), exportTripMarkdown(trip));
    setExported(true);
    window.setTimeout(() => setExported(false), 1600);
  }

  const dialogOpen =
    expenseOpen ||
    Boolean(editing) ||
    membersOpen ||
    Boolean(deleting) ||
    settleOpen ||
    Boolean(detail);

  return (
    <div className="relative mx-auto min-h-dvh max-w-5xl px-4 pb-28 pt-6 sm:px-6">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2">
            <p className="text-xs font-medium tracking-[0.18em] text-muted uppercase">途账</p>
            <GroupSwitcher
              currentLabel={variant === "group" ? "群组" : "示例"}
              currentGroupId={variant === "group" ? trip.id : null}
            />
          </div>
          <input
            value={trip.name}
            onChange={(e) => onRename(e.target.value)}
            className="w-full max-w-md bg-transparent font-display text-3xl font-semibold tracking-tight text-fg outline-none sm:text-4xl"
            aria-label="旅行或群组名称"
          />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-10"
            onClick={() => setMembersOpen(true)}
            aria-label={variant === "demo" ? "管理成员" : "成员"}
          >
            <Users className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-10"
            onClick={exportRecords}
            aria-label={exported ? "已导出" : "导出记录"}
          >
            <Download className="size-4" />
          </Button>
          <AuthSlot />
        </div>
      </header>

      {variant === "demo" ? <MyGroupsPanel /> : null}

      <div className="mb-5 flex rounded-full bg-chip p-1">
        <TabButton active={tab === "mine"} onClick={() => setTab("mine")}>
          我的
        </TabButton>
        <TabButton active={tab === "all"} onClick={() => setTab("all")}>
          全部
        </TabButton>
        <TabButton active={tab === "settle"} onClick={() => setTab("settle")}>
          结算
        </TabButton>
      </div>

      {tab === "mine" ? (
        !meId ? (
          <WhoAmI members={trip.members} onSetMe={onSetMe} />
        ) : (
          <div>
            <MineNet cents={myNet} />
            <ExpenseDayList
              expenses={myExpenses}
              meId={meId}
              membersById={memberMap}
              onOpen={setDetail}
              empty={
                activeExpenses.length === 0
                  ? "还没有支出。点右下角记一笔。"
                  : "没有和你相关的账单。"
              }
            />
          </div>
        )
      ) : null}

      {tab === "all" ? (
        <div>
          <ExpenseDayList
            expenses={activeExpenses}
            meId={meId}
            membersById={memberMap}
            onOpen={setDetail}
            empty="还没有支出。点右下角记一笔。"
          />
          <section className="mt-8">
            <h3 className="mb-3 px-1 text-xs font-medium text-muted">修改记录</h3>
            <ExpenseEditHistory
              edits={trip.expenseEdits ?? []}
              membersById={memberMap}
              expensesById={expenseById}
              onOpenExpense={setDetail}
            />
          </section>
          {deletedExpenses.length > 0 ? (
            <DeletedDayList expenses={deletedExpenses} onOpen={setDetail} />
          ) : null}
          {variant === "demo" ? <DemoBillActions /> : null}
        </div>
      ) : null}

      {tab === "settle" ? (
        <SettleTab
          transfers={ledger.transfers}
          memberMap={memberMap}
          openBillCount={openBillCount}
          settlements={settlements}
          pastOpen={pastOpen}
          onTogglePast={() => setPastOpen((v) => !v)}
          onSettle={() => setSettleOpen(true)}
        />
      ) : null}

      {!dialogOpen && (
        <Button
          type="button"
          onClick={() => setExpenseOpen(true)}
          className="fixed right-4 bottom-5 z-40 h-14 rounded-full px-5 shadow-card-hover sm:right-8"
        >
          <Plus className="size-5" />
          记一笔
        </Button>
      )}

      <AddExpenseDialog
        open={expenseOpen}
        onOpenChange={setExpenseOpen}
        trip={trip}
        defaultPayerId={meId ?? trip.members[0]?.id}
        onAdd={onAddExpense}
        onUploadPhoto={onUploadExpensePhoto}
        onDiscardPhotos={onDiscardExpensePhotos}
      />
      <AddExpenseDialog
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        trip={trip}
        defaultPayerId={editing?.payerId ?? meId}
        initialExpense={editing}
        onAdd={async (input) => {
          if (!editing || !onUpdateExpense) return;
          const id = editing.id;
          await onUpdateExpense(id, input);
          setFocusExpenseId(id);
        }}
      />
      <ExpenseDetailDialog
        expense={detail}
        meId={meId}
        membersById={memberMap}
        edits={detailEdits}
        canEdit={Boolean(detail && onUpdateExpense && canEditExpense(detail, meId))}
        onClose={() => setDetail(null)}
        onEdit={(expense) => {
          setDetail(null);
          setEditing(expense);
        }}
        onDelete={(expense) => {
          setDetail(null);
          setDeleting(expense);
        }}
      />
      <DeleteExpenseDialog
        expense={deleting && isOpenExpense(deleting) ? deleting : null}
        onClose={() => setDeleting(null)}
        onConfirm={(reason) => {
          if (!deleting) return;
          return onRemoveExpense(deleting.id, reason);
        }}
      />
      <SettleDialog
        open={settleOpen}
        onOpenChange={setSettleOpen}
        trip={trip}
        membersById={memberMap}
        onConfirm={onSettle}
      />
      {variant === "demo" ? (
        <MembersDialog open={membersOpen} onOpenChange={setMembersOpen} />
      ) : (
        <GroupMembersDialog
          open={membersOpen}
          onOpenChange={setMembersOpen}
          members={trip.members}
          meId={meId}
          inviteCode={inviteCode}
          createdBy={createdBy}
          onUpdateMyName={onUpdateMyName}
          onLeave={onLeave}
          onRemoveMember={onRemoveMember}
        />
      )}
    </div>
  );
}

function WhoAmI({ members, onSetMe }: { members: Member[]; onSetMe?: (id: string) => void }) {
  return (
    <section className="rounded-2xl bg-surface p-5 shadow-card">
      <h2 className="font-display text-lg font-semibold">你是谁？</h2>
      <ul className="mt-4 flex flex-wrap gap-3">
        {members.map((member) => (
          <li key={member.id}>
            <button
              type="button"
              onClick={() => onSetMe?.(member.id)}
              className="flex w-20 flex-col items-center gap-2 rounded-xl px-2 py-2 hover:bg-chip"
            >
              <MemberAvatar member={member} size="lg" />
              <span className="text-xs font-medium">{member.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function MineNet({ cents }: { cents: number }) {
  return (
    <p
      className={cn(
        "mb-4 px-1 text-sm font-medium tabular-nums",
        cents > 0 && "text-receive",
        cents < 0 && "text-owe",
        cents === 0 && "text-subtle",
      )}
    >
      {cents > 0 && `我应收 ${formatMoney(cents)}`}
      {cents < 0 && `我还要付 ${formatMoney(-cents)}`}
      {cents === 0 && "已结清"}
    </p>
  );
}

function DeletedDayList({
  expenses,
  onOpen,
}: {
  expenses: Expense[];
  onOpen: (expense: Expense) => void;
}) {
  return (
    <div className="mt-8">
      <h3 className="mb-3 px-1 text-xs font-medium text-muted">删除记录</h3>
      <div className="space-y-5">
        {groupByDay(expenses).map((day) => (
          <section key={day.key}>
            <h4 className="mb-2 px-1 text-xs text-subtle">{day.label}</h4>
            <ul className="space-y-2">
              {day.items.map((expense) => (
                <li key={expense.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(expense)}
                    className="flex w-full items-baseline justify-between gap-3 rounded-xl bg-surface px-4 py-3 text-left shadow-card hover:bg-chip/60"
                  >
                    <span className="min-w-0 truncate text-sm text-muted line-through">
                      {expense.title}
                    </span>
                    <span className="shrink-0 text-sm text-subtle tabular-nums line-through">
                      {formatMoney(expense.amountCents)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function SettleTab({
  transfers,
  memberMap,
  openBillCount,
  settlements,
  pastOpen,
  onTogglePast,
  onSettle,
}: {
  transfers: { fromId: string; toId: string; cents: number }[];
  memberMap: Record<string, Member>;
  openBillCount: number;
  settlements: ReturnType<typeof tripSettlements>;
  pastOpen: boolean;
  onTogglePast: () => void;
  onSettle: () => void;
}) {
  return (
    <section className="rounded-2xl bg-surface p-4 shadow-card sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold">谁付给谁</h2>
        <Button variant="ghost" size="sm" disabled={openBillCount === 0} onClick={onSettle}>
          提前结算
        </Button>
      </div>
      {transfers.length === 0 ? (
        <p className="text-sm text-muted">
          {openBillCount === 0 ? "本期没有未结账单。" : "本期已经平了。"}
        </p>
      ) : (
        <ul className="space-y-3">
          {transfers.map((t) => {
            const from = memberMap[t.fromId];
            const to = memberMap[t.toId];
            if (!from || !to) return null;
            return (
              <li
                key={`${t.fromId}-${t.toId}`}
                className="flex items-center gap-2 rounded-lg bg-bg-elevated px-3 py-2.5"
              >
                <MemberAvatar member={from} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">
                    <span className="font-medium">{from.name}</span>
                    <ArrowRight className="mx-1 inline size-3.5 text-subtle" />
                    <span className="font-medium">{to.name}</span>
                  </p>
                  <p className="text-xs text-muted tabular-nums">转 {formatMoney(t.cents)}</p>
                </div>
                <MemberAvatar member={to} size="sm" />
              </li>
            );
          })}
        </ul>
      )}
      {settlements.length > 0 ? (
        <div className="mt-5 border-t border-border pt-3">
          <button
            type="button"
            onClick={onTogglePast}
            className="flex w-full items-center justify-between gap-2 py-1 text-left text-sm font-medium"
          >
            <span>已结算 {settlements.length} 次</span>
            <ChevronDown
              className={cn("size-4 text-subtle transition-transform", pastOpen && "rotate-180")}
            />
          </button>
          {pastOpen ? (
            <ul className="mt-3 space-y-3">
              {settlements.map((settlement, index) => (
                <li key={settlement.id} className="rounded-lg bg-bg-elevated px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">第 {settlements.length - index} 次</p>
                    <Badge variant="settled">已结算</Badge>
                  </div>
                  <p className="mt-1 text-xs text-subtle">
                    {formatStamp(settlement.createdAt) || "刚才"}
                    {settlement.createdBy && memberMap[settlement.createdBy]
                      ? ` · ${memberMap[settlement.createdBy]?.name}`
                      : ""}
                    {` · ${settlement.expenseIds.length} 笔`}
                  </p>
                  {settlement.transfers.length === 0 ? (
                    <p className="mt-2 text-xs text-muted">当时账已经平了。</p>
                  ) : (
                    <ul className="mt-2 space-y-1">
                      {settlement.transfers.map((t) => (
                        <li
                          key={`${settlement.id}-${t.fromId}-${t.toId}`}
                          className="text-xs text-muted"
                        >
                          {memberMap[t.fromId]?.name ?? "未知"}
                          <ArrowRight className="mx-1 inline size-3 text-subtle" />
                          {memberMap[t.toId]?.name ?? "未知"}{" "}
                          <span className="tabular-nums">{formatMoney(t.cents)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-9 flex-1 rounded-full text-sm font-medium transition-colors",
        active ? "bg-surface text-fg shadow-card" : "text-muted hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

function DemoBillActions() {
  const clearExpenses = useTripStore((s) => s.clearExpenses);
  const resetDemo = useTripStore((s) => s.resetDemo);
  return (
    <div className="mt-6 flex items-center justify-end gap-1">
      <Button variant="ghost" size="sm" onClick={() => clearExpenses()}>
        清空
      </Button>
      <Button variant="ghost" size="sm" onClick={() => resetDemo()}>
        <RotateCcw className="size-3.5" />
        示例
      </Button>
    </div>
  );
}

export function TripBoard() {
  const trip = useTripStore((s) => s.trip);
  const meId = useTripStore((s) => s.meId);
  const setHydrated = useTripStore((s) => s.setHydrated);
  const renameTrip = useTripStore((s) => s.renameTrip);
  const addExpense = useTripStore((s) => s.addExpense);
  const updateExpense = useTripStore((s) => s.updateExpense);
  const removeExpense = useTripStore((s) => s.removeExpense);
  const settleOpen = useTripStore((s) => s.settleOpen);
  const setMeId = useTripStore((s) => s.setMeId);

  useTripSync();

  useEffect(() => {
    const result = useTripStore.persist.rehydrate();
    void Promise.resolve(result).then(() => setHydrated(true));
  }, [setHydrated]);

  return (
    <TripView
      trip={trip}
      meId={meId}
      variant="demo"
      onRename={renameTrip}
      onAddExpense={addExpense}
      onUpdateExpense={updateExpense}
      onRemoveExpense={removeExpense}
      onSettle={settleOpen}
      onSetMe={setMeId}
    />
  );
}
