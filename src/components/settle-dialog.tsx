import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MemberAvatar } from "@/components/member-avatar";
import { computeLedger } from "@/lib/split/calc";
import { formatMoney } from "@/lib/split/money";
import { openExpenses } from "@/lib/split/settlement";
import type { Member, Trip } from "@/lib/split/types";

export function SettleDialog({
  open,
  onOpenChange,
  trip,
  membersById,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trip: Trip;
  membersById: Record<string, Member>;
  onConfirm: () => void | Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const openBills = openExpenses(trip);
  const ledger = computeLedger(trip);

  async function submit() {
    setPending(true);
    setError(null);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "结算失败");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setError(null);
          setPending(false);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>提前结算</DialogTitle>
          <DialogDescription>
            线下转完账后点确认。确认后，本期 {openBills.length}{" "}
            笔未结账单会锁住，不能再改；之后新记的账重新算。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {ledger.transfers.length === 0 ? (
            <p className="rounded-xl bg-bg-elevated px-3 py-3 text-sm text-muted">
              本期已经平了，没有人还要转钱。确认后只是把这些账单锁进结算记录。
            </p>
          ) : (
            <ul className="space-y-2">
              {ledger.transfers.map((t) => {
                const from = membersById[t.fromId];
                const to = membersById[t.toId];
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
                      <p className="text-xs text-muted tabular-nums">
                        转 {formatMoney(t.cents)}
                      </p>
                    </div>
                    <MemberAvatar member={to} size="sm" />
                  </li>
                );
              })}
            </ul>
          )}
          <p className="text-xs text-muted">
            钱在微信 / 支付宝 / 现金里转即可。途账只记下「已经线下结清」。
          </p>
          {error ? <p className="text-sm text-owe">{error}</p> : null}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              再等等
            </Button>
            <Button
              type="button"
              className="flex-1"
              disabled={pending || openBills.length === 0}
              onClick={() => void submit()}
            >
              {pending ? "结算中…" : "确认已线下结清"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
