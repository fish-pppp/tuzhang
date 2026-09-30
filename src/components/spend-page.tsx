import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BedDouble,
  Bus,
  CircleEllipsis,
  Wallet,
  ShoppingBag,
  Sparkles,
  Ticket,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { AuthSlot } from "@/components/auth-slot";
import { MemberAvatar } from "@/components/member-avatar";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { friendlyError, isUnauthorizedError } from "@/lib/errors";
import { formatDay } from "@/lib/split/date";
import { loadMySpend } from "@/lib/split/group-api";
import { formatMoney } from "@/lib/split/money";
import {
  buildSpendSummary,
  formatSpendSharePercent,
  spendBillsForTrip,
  spendSearch,
  type SpendBillInput,
  type SpendLine,
} from "@/lib/split/spend";
import { useTripStore } from "@/lib/split/store";
import { cn } from "@/lib/utils";

type SpendView = "part" | "bill" | "group";

const PART_ICON: Record<string, LucideIcon> = {
  food: UtensilsCrossed,
  stay: BedDouble,
  transport: Bus,
  ticket: Ticket,
  shopping: ShoppingBag,
  play: Sparkles,
  other: CircleEllipsis,
};

export function SpendEntry({
  tripId,
  tripName,
  bills,
  demo,
  groupId,
}: {
  tripId: string;
  tripName: string;
  bills: SpendBillInput[];
  demo: boolean;
  groupId?: string;
}) {
  const summary = useMemo(() => buildSpendSummary(bills), [bills]);
  if (summary.billCount === 0) return null;
  const hint = summary.parts
    .slice(0, 3)
    .map((part) => `${part.label} ${formatMoney(part.cents)}`)
    .join(" · ");
  return (
    <Link
      to="/spend"
      search={spendSearch(demo, groupId ?? tripId)}
      className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3.5 shadow-card transition-colors hover:bg-chip/60"
    >
      <span className="min-w-0">
        <span className="block text-xs text-muted">我一共花了</span>
        <span className="mt-0.5 block font-display text-2xl font-semibold tabular-nums">
          {formatMoney(summary.totalShareCents)}
        </span>
        <span className="mt-1 block truncate text-xs text-subtle">{hint || tripName}</span>
      </span>
      <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary">
        <Wallet className="size-4" />
        明细
      </span>
    </Link>
  );
}

export function SpendPage({ demo, groupId }: { demo?: boolean; groupId?: string }) {
  const { user, isPending, sessionTimedOut } = useCurrentUserState();
  const trip = useTripStore((s) => s.trip);
  const meId = useTripStore((s) => s.meId);
  const setMeId = useTripStore((s) => s.setMeId);
  const hydrated = useTripStore((s) => s.hydrated);
  const setHydrated = useTripStore((s) => s.setHydrated);

  useEffect(() => {
    if (!demo) return;
    const result = useTripStore.persist.rehydrate();
    void Promise.resolve(result).then(() => setHydrated(true));
  }, [demo, setHydrated]);

  const spendQuery = useQuery({
    queryKey: ["my-spend"],
    queryFn: () => loadMySpend(),
    enabled: Boolean(user) && !demo && !isPending,
    retry: (count, err) => !isUnauthorizedError(err) && count < 1,
  });

  if (sessionTimedOut) {
    return (
      <Status>
        登录确认超时。
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-3 text-sm text-primary underline-offset-4 hover:underline"
        >
          重试
        </button>
      </Status>
    );
  }

  if (isPending && !demo) {
    return <Status>正在确认登录…</Status>;
  }

  if (!demo && (!user || isUnauthorizedError(spendQuery.error))) {
    return (
      <Status>
        登录后才能看你一共花了多少。
        <Link
          to="/login"
          search={{ redirect: groupId ? `/spend?groupId=${groupId}` : "/spend" }}
          className="mt-3 text-sm text-primary underline-offset-4 hover:underline"
        >
          去登录
        </Link>
      </Status>
    );
  }

  if (demo && !hydrated) {
    return <Status>正在打开示例…</Status>;
  }

  if (!demo && spendQuery.isPending) {
    return <Status>正在统计花费…</Status>;
  }

  if (!demo && (spendQuery.error || !spendQuery.data)) {
    return (
      <Status>
        {friendlyError(spendQuery.error, "花费统计没有载入。")}
        <button
          type="button"
          onClick={() => void spendQuery.refetch()}
          className="mt-3 text-sm text-primary underline-offset-4 hover:underline"
        >
          重试
        </button>
        <BackLink demo={false} groupId={groupId} />
      </Status>
    );
  }

  if (demo && !meId) {
    return (
      <Frame demo groupId={undefined}>
        <section className="rounded-2xl bg-surface p-5 shadow-card">
          <h2 className="font-display text-lg font-semibold">你是谁？</h2>
          <p className="mt-1 text-sm text-muted">选中之后，这里按你摊到的份额算花费。</p>
          <ul className="mt-4 flex flex-wrap gap-3">
            {trip.members.map((member) => (
              <li key={member.id}>
                <button
                  type="button"
                  onClick={() => setMeId(member.id)}
                  className="flex w-20 flex-col items-center gap-2 rounded-xl px-2 py-2 hover:bg-chip"
                >
                  <MemberAvatar member={member} size="lg" />
                  <span className="text-xs font-medium">{member.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </Frame>
    );
  }

  const bills = demo ? spendBillsForTrip(trip, meId ?? "") : (spendQuery.data ?? []);
  const meName = demo ? trip.members.find((member) => member.id === meId)?.name : undefined;
  return (
    <SpendBody
      bills={bills}
      demo={Boolean(demo)}
      groupId={demo ? undefined : groupId}
      meName={meName}
    />
  );
}

function SpendBody({
  bills,
  demo,
  groupId,
  meName,
}: {
  bills: SpendBillInput[];
  demo: boolean;
  groupId?: string;
  meName?: string;
}) {
  const [scope, setScope] = useState(groupId ?? "all");
  const [view, setView] = useState<SpendView>("part");
  const allSummary = useMemo(() => buildSpendSummary(bills), [bills]);
  const scopedBills = useMemo(
    () => (scope === "all" ? bills : bills.filter((bill) => bill.groupId === scope)),
    [bills, scope],
  );
  const summary = useMemo(() => buildSpendSummary(scopedBills), [scopedBills]);
  const showScope = Boolean(groupId) && allSummary.groups.some((group) => group.id !== groupId);
  const focused = allSummary.groups.find((group) => group.id === groupId);
  const showGroupView = summary.groups.length > 1;

  useEffect(() => {
    if (view === "group" && !showGroupView) setView("part");
  }, [showGroupView, view]);

  return (
    <Frame demo={demo} groupId={groupId}>
      <section className="rounded-2xl bg-surface px-5 py-5 shadow-card">
        <p className="text-sm text-muted">一共花了</p>
        <p className="mt-1 font-display text-4xl font-semibold tracking-tight tabular-nums">
          {formatMoney(summary.totalShareCents)}
        </p>
        <p className="mt-2 text-sm text-muted">
          {summary.billCount === 0 ? "还没有你摊到的花费" : `${summary.billCount} 笔里你摊到的份额`}
          {summary.paidCents > summary.totalShareCents
            ? ` · 你先付出去 ${formatMoney(summary.paidCents)}`
            : ""}
        </p>
        {meName ? <p className="mt-2 text-xs text-subtle">示例账单 · {meName}</p> : null}
      </section>

      {showScope ? (
        <div className="mt-4 flex rounded-full bg-chip p-1">
          <TabButton active={scope === groupId} onClick={() => setScope(groupId ?? "all")}>
            {focused?.name ?? "这个群"}
          </TabButton>
          <TabButton active={scope === "all"} onClick={() => setScope("all")}>
            全部群组
          </TabButton>
        </div>
      ) : null}

      {summary.billCount === 0 ? (
        <section className="mt-4 rounded-2xl bg-surface p-5 shadow-card">
          <p className="text-sm text-muted">
            {scope !== "all" && allSummary.billCount > 0
              ? "这个群里还没有你摊到的花费。"
              : "记一笔、并且你也在分摊里，这里会按每一部分加总。"}
          </p>
          {scope !== "all" && allSummary.billCount > 0 ? (
            <button
              type="button"
              onClick={() => setScope("all")}
              className="mt-3 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              看全部群组
            </button>
          ) : null}
        </section>
      ) : (
        <>
          <div className={cn("flex rounded-full bg-chip p-1", showScope ? "mt-3" : "mt-4")}>
            <TabButton active={view === "part"} onClick={() => setView("part")}>
              按用途
            </TabButton>
            <TabButton active={view === "bill"} onClick={() => setView("bill")}>
              按账单
            </TabButton>
            {showGroupView ? (
              <TabButton active={view === "group"} onClick={() => setView("group")}>
                按群组
              </TabButton>
            ) : null}
          </div>

          {view === "part" ? (
            <div className="mt-4 space-y-3">
              <p className="px-1 text-xs text-subtle">按账单名称归到每一部分</p>
              {summary.parts.map((part) => (
                <PartBlock
                  key={part.id}
                  icon={PART_ICON[part.id] ?? CircleEllipsis}
                  title={part.label}
                  cents={part.cents}
                  percent={part.percent}
                  count={part.bills.length}
                  bills={part.bills}
                  showGroup={summary.groups.length > 1}
                />
              ))}
            </div>
          ) : null}

          {view === "bill" ? (
            <section className="mt-4 rounded-2xl bg-surface px-4 py-2 shadow-card sm:px-5">
              <ul className="divide-y divide-border">
                {summary.bills.map((bill) => (
                  <BillRow key={bill.id} bill={bill} showGroup={summary.groups.length > 1} />
                ))}
              </ul>
            </section>
          ) : null}

          {view === "group" && showGroupView ? (
            <div className="mt-4 space-y-3">
              {summary.groups.map((group) => (
                <PartBlock
                  key={group.id}
                  title={group.name}
                  cents={group.cents}
                  percent={group.percent}
                  count={group.bills.length}
                  bills={group.bills}
                  showGroup={false}
                />
              ))}
            </div>
          ) : null}
        </>
      )}
    </Frame>
  );
}

function PartBlock({
  icon: Icon,
  title,
  cents,
  percent,
  count,
  bills,
  showGroup,
}: {
  icon?: LucideIcon;
  title: string;
  cents: number;
  percent: number;
  count: number;
  bills: SpendLine[];
  showGroup: boolean;
}) {
  return (
    <section className="rounded-2xl bg-surface px-4 py-4 shadow-card sm:px-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {Icon ? (
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-chip text-primary">
              <Icon className="size-4" />
            </span>
          ) : null}
          <div className="min-w-0">
            <h2 className="truncate font-display text-lg font-semibold">{title}</h2>
            <p className="text-xs text-subtle">
              {count} 笔 · {formatSpendSharePercent(percent)}
            </p>
          </div>
        </div>
        <p className="shrink-0 font-display text-lg font-semibold tabular-nums">
          {formatMoney(cents)}
        </p>
      </div>
      <div className="mt-3">
        <AmountBar percent={percent} />
      </div>
      <ul className="mt-1 divide-y divide-border">
        {bills.map((bill) => (
          <BillRow key={bill.id} bill={bill} showGroup={showGroup} />
        ))}
      </ul>
    </section>
  );
}

function BillRow({ bill, showGroup }: { bill: SpendLine; showGroup: boolean }) {
  const when = formatDay(bill.createdAt);
  const meta = [
    when,
    showGroup ? bill.groupName : "",
    bill.settled ? "已结" : "",
    `账单 ${formatMoney(bill.amountCents)}`,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <li className="py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-medium">{bill.title}</p>
        <p className="shrink-0 text-sm font-medium tabular-nums">
          {formatMoney(bill.myShareCents)}
        </p>
      </div>
      <p className="mt-0.5 text-xs text-subtle">{meta}</p>
    </li>
  );
}

function AmountBar({ percent }: { percent: number }) {
  const width = percent <= 0 ? 0 : Math.min(100, Math.max(percent, 1.5));
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-chip" aria-hidden>
      <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
    </div>
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
        "h-9 min-w-0 flex-1 truncate rounded-full px-2 text-sm font-medium transition-colors",
        active ? "bg-surface text-fg shadow-card" : "text-muted hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

function Frame({
  demo,
  groupId,
  children,
}: {
  demo: boolean;
  groupId?: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto min-h-dvh max-w-lg px-4 pt-6 pb-16 sm:px-6">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <BackLink demo={demo} groupId={groupId} />
          <p className="mt-3 text-xs font-medium tracking-[0.18em] text-muted uppercase">途账</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight">我的花费</h1>
        </div>
        <AuthSlot />
      </header>
      {children}
    </main>
  );
}

function BackLink({ demo, groupId }: { demo: boolean; groupId?: string }) {
  if (!demo && groupId) {
    return (
      <Link
        to="/g/$groupId"
        params={{ groupId }}
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg"
      >
        <ArrowLeft className="size-4" />
        返回账本
      </Link>
    );
  }
  return (
    <Link
      to="/"
      search={{ demo: demo ? true : undefined }}
      className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg"
    >
      <ArrowLeft className="size-4" />
      返回账本
    </Link>
  );
}

function Status({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-2 px-6 text-center text-sm text-muted">
      {children}
    </main>
  );
}
