import { ExpenseEditHistory } from "@/components/expense-edit-history";
import { ExpensePhotoStrip } from "@/components/expense-photos";
import { MemberAvatar } from "@/components/member-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { expenseInvolves, shareBreakdown, shareForMember } from "@/lib/split/calc";
import { formatStamp } from "@/lib/split/date";
import { formatMoney } from "@/lib/split/money";
import {
  isOpenExpense,
  isSettledExpense,
  type Expense,
  type ExpenseEdit,
  type Member,
} from "@/lib/split/types";

export function ExpenseDetailDialog({
  expense,
  meId,
  membersById,
  edits,
  canEdit,
  onClose,
  onDelete,
  onEdit,
}: {
  expense: Expense | null;
  meId: string | null;
  membersById: Record<string, Member>;
  edits: ExpenseEdit[];
  canEdit: boolean;
  onClose: () => void;
  onDelete?: (expense: Expense) => void;
  onEdit?: (expense: Expense) => void;
}) {
  const open = Boolean(expense);
  const payer = expense ? membersById[expense.payerId] : undefined;
  const mine = Boolean(expense && meId && expenseInvolves(expense, meId));
  const myShare = expense && meId ? shareForMember(expense, meId) : 0;
  const slices = expense ? shareBreakdown(expense) : [];
  const othersOwe =
    expense && meId && expense.payerId === meId
      ? slices.filter((s) => s.memberId !== meId).reduce((sum, s) => sum + s.cents, 0)
      : 0;
  const canDelete = Boolean(expense && onDelete && isOpenExpense(expense));
  const creatorName = expense?.createdBy ? (membersById[expense.createdBy]?.name ?? "未知") : null;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        {expense ? (
          <>
            <DialogHeader>
              <DialogTitle>{expense.title}</DialogTitle>
              <DialogDescription>
                {formatStamp(expense.createdAt) || "刚才"}
                {payer ? ` · ${payer.name}付` : ""}
                {creatorName ? ` · 创建人 ${creatorName}` : ""}
              </DialogDescription>
            </DialogHeader>
            <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-2">
                <AmountBox label="总价" value={formatMoney(expense.amountCents)} />
                {mine ? (
                  <AmountBox label="我要付" value={formatMoney(myShare)} tone="owe" />
                ) : (
                  <AmountBox label="付款人" value={payer?.name ?? "未知"} />
                )}
              </div>

              {expense.payerId === meId && othersOwe > 0 ? (
                <p className="text-sm tabular-nums text-receive">
                  别人还我 {formatMoney(othersOwe)}
                </p>
              ) : null}

              {isSettledExpense(expense) ? <Badge variant="settled">已结算</Badge> : null}

              {expense.deletedAt ? (
                <p className="text-sm">
                  <span className="text-owe">已删除 · </span>
                  {expense.deleteReason || "未填写"}
                </p>
              ) : null}

              <ExpensePhotoStrip photos={expense.photos} />

              <ul className="space-y-2">
                {slices.map((slice) => {
                  const person = membersById[slice.memberId];
                  if (!person) return null;
                  const isPayer = slice.memberId === expense.payerId;
                  return (
                    <li
                      key={slice.memberId}
                      className="flex items-center gap-2 rounded-lg bg-bg-elevated px-3 py-2"
                    >
                      <MemberAvatar member={person} size="sm" />
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {person.name}
                        {slice.memberId === meId ? (
                          <span className="ml-1 text-muted">我</span>
                        ) : null}
                        {isPayer ? <span className="ml-1 text-xs text-subtle">付</span> : null}
                      </span>
                      <span className="text-sm tabular-nums">{formatMoney(slice.cents)}</span>
                    </li>
                  );
                })}
              </ul>

              <section className="space-y-2">
                <h3 className="text-xs font-medium text-muted">修改记录</h3>
                <ExpenseEditHistory
                  edits={edits}
                  membersById={membersById}
                  empty="这条账单还没有修改记录。"
                />
              </section>

              {canEdit ? (
                <Button type="button" onClick={() => onEdit?.(expense)}>
                  修改明细
                </Button>
              ) : expense.createdBy && isOpenExpense(expense) ? (
                <p className="text-xs text-muted">只有创建人可以修改明细。</p>
              ) : null}

              {canDelete ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-owe hover:text-owe"
                  onClick={() => onDelete?.(expense)}
                >
                  删除
                </Button>
              ) : null}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function AmountBox({ label, value, tone }: { label: string; value: string; tone?: "owe" }) {
  return (
    <div className="rounded-xl bg-bg-elevated px-3 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p
        className={`mt-1 font-display text-xl font-semibold tabular-nums ${
          tone === "owe" ? "text-owe" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}
