import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MemberAvatar } from "@/components/member-avatar";
import { parseYuan } from "@/lib/split/money";
import type { Expense, Trip } from "@/lib/split/types";
import { cn } from "@/lib/utils";

export function AddExpenseDialog({
  open,
  onOpenChange,
  trip,
  defaultPayerId,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trip: Trip;
  defaultPayerId?: string | null;
  onAdd: (input: Omit<Expense, "id" | "createdAt">) => void | Promise<void>;
}) {
  const fallbackPayer = defaultPayerId ?? trip.members[0]?.id ?? "";
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [payerId, setPayerId] = useState(fallbackPayer);
  const [participantIds, setParticipantIds] = useState<string[]>(
    trip.members.map((m) => m.id),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPayerId(defaultPayerId ?? trip.members[0]?.id ?? "");
    setParticipantIds(trip.members.map((m) => m.id));
    setTitle("");
    setAmount("");
    setError(null);
    setPending(false);
  }, [open, defaultPayerId, trip.members]);

  const allSelected = participantIds.length === trip.members.length;
  const perHead = useMemo(() => {
    const cents = parseYuan(amount);
    if (!cents || participantIds.length === 0) return null;
    return cents / participantIds.length;
  }, [amount, participantIds.length]);

  function resetForm() {
    setTitle("");
    setAmount("");
    setPayerId(defaultPayerId ?? trip.members[0]?.id ?? "");
    setParticipantIds(trip.members.map((m) => m.id));
    setError(null);
    setPending(false);
  }

  function toggleParticipant(id: string) {
    setParticipantIds((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev;
        return prev.filter((x) => x !== id);
      }
      return [...prev, id];
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cents = parseYuan(amount);
    if (!cents) {
      setError("请输入有效金额");
      return;
    }
    if (!payerId) {
      setError("请选择付款人");
      return;
    }
    if (participantIds.length === 0) {
      setError("至少选择一位一起 AA 的人");
      return;
    }
    setPending(true);
    try {
      await onAdd({
        title: title.trim() || "未命名支出",
        amountCents: cents,
        payerId,
        participantIds,
      });
      resetForm();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "记账失败");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetForm();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>记一笔</DialogTitle>
          <DialogDescription>谁先垫了钱，再选一起 AA 的人。</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void onSubmit(e)} className="flex min-h-0 flex-col gap-5 overflow-y-auto">
          <div className="space-y-2">
            <Label htmlFor="amount">金额</Label>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 font-display text-xl text-muted">
                ¥
              </span>
              <Input
                id="amount"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError(null);
                }}
                className="h-14 pl-8 font-display text-2xl tabular-nums"
                autoFocus
              />
            </div>
            {perHead != null && (
              <p className="text-xs text-muted tabular-nums">
                {participantIds.length} 人平摊，约 ¥
                {(perHead / 100).toFixed(2)} / 人
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">备注</Label>
            <Input
              id="title"
              placeholder="晚饭、门票、打车…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={40}
            />
          </div>

          <div className="space-y-2">
            <Label>谁付的</Label>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {trip.members.map((m) => {
                const active = payerId === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPayerId(m.id)}
                    className={cn(
                      "flex min-w-16 flex-col items-center gap-1.5 rounded-lg px-2 py-2 transition-colors",
                      active ? "bg-chip" : "hover:bg-chip/60",
                    )}
                  >
                    <MemberAvatar member={m} size="md" selected={active} />
                    <span className="text-xs font-medium">{m.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>谁一起 AA</Label>
              <button
                type="button"
                className="text-xs font-medium text-primary"
                onClick={() =>
                  setParticipantIds(
                    allSelected ? [payerId].filter(Boolean) : trip.members.map((m) => m.id),
                  )
                }
              >
                {allSelected ? "只留付款人" : "全选"}
              </button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {trip.members.map((m) => {
                const active = participantIds.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleParticipant(m.id)}
                    className={cn(
                      "relative flex min-w-16 flex-col items-center gap-1.5 rounded-lg px-2 py-2 transition-colors",
                      active ? "bg-chip" : "hover:bg-chip/60",
                    )}
                  >
                    <MemberAvatar member={m} size="md" selected={active} />
                    {active && (
                      <span className="absolute top-1.5 right-1.5 grid size-4 place-items-center rounded-full bg-primary text-primary-fg">
                        <Check className="size-2.5" strokeWidth={3} />
                      </span>
                    )}
                    <span className="text-xs font-medium">{m.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {error && <p className="text-sm text-owe">{error}</p>}

          <Button type="submit" className="h-12 w-full rounded-lg text-base" disabled={pending}>
            {pending ? "记账中…" : "记入账单"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
