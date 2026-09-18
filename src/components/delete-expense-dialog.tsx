import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { DELETE_REASON_PRESETS, normalizeDeleteReason } from "@/lib/split/delete-reason";
import { formatMoney } from "@/lib/split/money";
import type { Expense } from "@/lib/split/types";
import { cn } from "@/lib/utils";

export function DeleteExpenseDialog({
  expense,
  onClose,
  onConfirm,
}: {
  expense: Expense | null;
  onClose: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!expense) return;
    setReason("");
    setError(null);
    setPending(false);
  }, [expense]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const text = normalizeDeleteReason(reason);
      setPending(true);
      setError(null);
      await onConfirm(text);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={Boolean(expense)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>删除这条账单</DialogTitle>
          <DialogDescription>
            账单不会消失，会留在下面的删除记录里。请写清楚为什么删，方便以后对账。
          </DialogDescription>
        </DialogHeader>
        {expense ? (
          <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
            <p className="rounded-xl bg-bg-elevated px-3 py-2 text-sm">
              <span className="font-medium">{expense.title}</span>
              <span className="ml-2 tabular-nums text-muted">
                {formatMoney(expense.amountCents)}
              </span>
            </p>
            <div className="space-y-2">
              <Label htmlFor="delete-reason">删除原因</Label>
              <div className="flex flex-wrap gap-1.5">
                {DELETE_REASON_PRESETS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      setReason(item);
                      setError(null);
                    }}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs",
                      reason === item ? "bg-primary text-primary-fg" : "bg-chip text-muted",
                    )}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <textarea
                id="delete-reason"
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  setError(null);
                }}
                maxLength={80}
                rows={3}
                placeholder="例如：记重了、金额填错、已经退款…"
                className="w-full resize-none rounded-lg bg-bg-elevated px-3 py-2 text-sm outline-none ring-ring/40 focus:ring-2"
              />
              <p className="text-xs text-subtle">{reason.trim().length}/80</p>
            </div>
            {error ? <p className="text-sm text-owe">{error}</p> : null}
            <div className="flex gap-2">
              <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
                留下
              </Button>
              <Button type="submit" variant="destructive" className="flex-1" disabled={pending}>
                {pending ? "删除中…" : "确认删除"}
              </Button>
            </div>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
