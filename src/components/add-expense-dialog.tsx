import { useEffect, useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";
import { ExpensePhotoPicker } from "@/components/expense-photos";
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
import { formatMoney, newId, parseYuan } from "@/lib/split/money";
import {
  compressExpensePhoto,
  MAX_EXPENSE_PHOTOS,
  normalizeExpensePhotos,
} from "@/lib/split/photo";
import { equalShares, normalizeExpenseShares } from "@/lib/split/shares";
import type { Expense, ExpensePhoto, ExpenseShare, Trip } from "@/lib/split/types";
import { cn } from "@/lib/utils";

type SplitMode = "equal" | "custom";

export function AddExpenseDialog({
  open,
  onOpenChange,
  trip,
  defaultPayerId,
  onAdd,
  onUploadPhoto,
  onDiscardPhotos,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trip: Trip;
  defaultPayerId?: string | null;
  onAdd: (
    input: Omit<
      Expense,
      "id" | "createdAt" | "deletedAt" | "deletedBy" | "deleteReason" | "settlementId"
    >,
  ) => void | Promise<void>;
  onUploadPhoto?: (base64: string) => Promise<ExpensePhoto>;
  onDiscardPhotos?: (ids: string[]) => void | Promise<void>;
}) {
  const fallbackPayer = defaultPayerId ?? trip.members[0]?.id ?? "";
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [payerId, setPayerId] = useState(fallbackPayer);
  const [participantIds, setParticipantIds] = useState<string[]>(
    trip.members.map((m) => m.id),
  );
  const [splitMode, setSplitMode] = useState<SplitMode>("equal");
  const [customYuan, setCustomYuan] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [photos, setPhotos] = useState<ExpensePhoto[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const photosRef = useRef<ExpensePhoto[]>([]);
  const submittedRef = useRef(false);
  photosRef.current = photos;

  function fillEqualCustom(ids: string[], yuan: string) {
    const cents = parseYuan(yuan);
    if (!cents || ids.length === 0) {
      setCustomYuan(Object.fromEntries(ids.map((id) => [id, ""])));
      return;
    }
    const next: Record<string, string> = {};
    for (const share of equalShares(ids, cents)) {
      next[share.memberId] = (share.cents / 100).toFixed(2);
    }
    setCustomYuan(next);
  }

  useEffect(() => {
    if (!open) return;
    const ids = trip.members.map((m) => m.id);
    setPayerId(defaultPayerId ?? trip.members[0]?.id ?? "");
    setParticipantIds(ids);
    setTitle("");
    setAmount("");
    setSplitMode("equal");
    setCustomYuan({});
    setError(null);
    setPending(false);
    setPhotos([]);
    setPhotoBusy(false);
    submittedRef.current = false;
  }, [open, defaultPayerId, trip.members]);

  const allSelected = participantIds.length === trip.members.length;
  const amountCents = parseYuan(amount);
  const perHead = useMemo(() => {
    if (!amountCents || participantIds.length === 0) return null;
    return amountCents / participantIds.length;
  }, [amountCents, participantIds.length]);

  const customShares = useMemo(() => {
    if (splitMode !== "custom") return null;
    const shares: ExpenseShare[] = [];
    for (const id of participantIds) {
      const cents = parseYuan(customYuan[id] ?? "", { allowZero: true });
      if (cents == null) return null;
      shares.push({ memberId: id, cents });
    }
    return shares;
  }, [customYuan, participantIds, splitMode]);

  const customTotal = customShares?.reduce((sum, s) => sum + s.cents, 0) ?? null;
  const customDiff =
    amountCents != null && customTotal != null ? customTotal - amountCents : null;

  function resetForm() {
    setTitle("");
    setAmount("");
    setPayerId(defaultPayerId ?? trip.members[0]?.id ?? "");
    setParticipantIds(trip.members.map((m) => m.id));
    setSplitMode("equal");
    setCustomYuan({});
    setError(null);
    setPending(false);
    setPhotos([]);
    setPhotoBusy(false);
  }

  async function discardRemote(ids: string[]) {
    if (!onDiscardPhotos || ids.length === 0) return;
    try {
      await onDiscardPhotos(ids);
    } catch {
      // Closing the form should still succeed if cleanup fails.
    }
  }

  async function onPickFiles(list: FileList) {
    const room = MAX_EXPENSE_PHOTOS - photosRef.current.length;
    if (room <= 0) {
      setError(`最多 ${MAX_EXPENSE_PHOTOS} 张照片`);
      return;
    }
    const files = [...list].slice(0, room);
    setPhotoBusy(true);
    setError(null);
    try {
      for (const file of files) {
        const base64 = await compressExpensePhoto(file);
        const photo = onUploadPhoto
          ? await onUploadPhoto(base64)
          : { id: newId(), url: `data:image/jpeg;base64,${base64}` };
        setPhotos((prev) => {
          if (prev.length >= MAX_EXPENSE_PHOTOS) return prev;
          if (prev.some((item) => item.id === photo.id)) return prev;
          return [...prev, photo];
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "照片处理失败");
    } finally {
      setPhotoBusy(false);
    }
  }

  function onRemovePhoto(id: string) {
    setPhotos((prev) => prev.filter((photo) => photo.id !== id));
    void discardRemote([id]);
  }

  function toggleParticipant(id: string) {
    setParticipantIds((prev) => {
      const next = prev.includes(id)
        ? prev.length === 1
          ? prev
          : prev.filter((x) => x !== id)
        : [...prev, id];
      if (splitMode === "custom") fillEqualCustom(next, amount);
      return next;
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
      setError("至少选择一位一起分摊的人");
      return;
    }
    let shares: ExpenseShare[] | undefined;
    try {
      shares = normalizeExpenseShares({
        participantIds,
        amountCents: cents,
        shares: splitMode === "custom" ? customShares ?? undefined : undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "分摊金额不对");
      return;
    }
    setPending(true);
    try {
      const attached = normalizeExpensePhotos(photos);
      await onAdd({
        title: title.trim() || "未命名支出",
        amountCents: cents,
        payerId,
        participantIds,
        ...(shares ? { shares } : {}),
        ...(attached ? { photos: attached } : {}),
      });
      submittedRef.current = true;
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
        if (!next) {
          if (!submittedRef.current) {
            void discardRemote(photosRef.current.map((photo) => photo.id));
          }
          resetForm();
        }
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>记一笔</DialogTitle>
          <DialogDescription>
            谁先垫了钱。可以平均 AA，也可以按人填不同的价。小票可以附多张照片。
          </DialogDescription>
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
                  const next = e.target.value;
                  setAmount(next);
                  setError(null);
                  if (splitMode === "custom") fillEqualCustom(participantIds, next);
                }}
                className="h-14 pl-8 font-display text-2xl tabular-nums"
                autoFocus
              />
            </div>
            {splitMode === "equal" && perHead != null && (
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
              <Label>谁一起摊</Label>
              <button
                type="button"
                className="text-xs font-medium text-primary"
                onClick={() => {
                  const next = allSelected
                    ? [payerId].filter(Boolean)
                    : trip.members.map((m) => m.id);
                  setParticipantIds(next);
                  if (splitMode === "custom") fillEqualCustom(next, amount);
                }}
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

          <div className="space-y-2">
            <Label>怎么分</Label>
            <div className="flex rounded-full bg-chip p-0.5">
              <ModeButton
                active={splitMode === "equal"}
                onClick={() => {
                  setSplitMode("equal");
                  setError(null);
                }}
              >
                平均 AA
              </ModeButton>
              <ModeButton
                active={splitMode === "custom"}
                onClick={() => {
                  setSplitMode("custom");
                  fillEqualCustom(participantIds, amount);
                  setError(null);
                }}
              >
                自定义价格
              </ModeButton>
            </div>
            {splitMode === "custom" ? (
              <ul className="space-y-2">
                {participantIds.map((id) => {
                  const member = trip.members.find((m) => m.id === id);
                  if (!member) return null;
                  return (
                    <li key={id} className="flex items-center gap-2">
                      <MemberAvatar member={member} size="sm" />
                      <span className="min-w-0 flex-1 truncate text-sm">{member.name}</span>
                      <div className="relative w-28">
                        <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs text-muted">
                          ¥
                        </span>
                        <Input
                          inputMode="decimal"
                          value={customYuan[id] ?? ""}
                          onChange={(e) => {
                            setCustomYuan((prev) => ({ ...prev, [id]: e.target.value }));
                            setError(null);
                          }}
                          className="h-10 pl-6 tabular-nums"
                          placeholder="0.00"
                        />
                      </div>
                    </li>
                  );
                })}
                {customDiff != null ? (
                  <p
                    className={cn(
                      "text-xs tabular-nums",
                      customDiff === 0 ? "text-muted" : "text-owe",
                    )}
                  >
                    {customDiff === 0
                      ? `加起来 ${formatMoney(customTotal ?? 0)}，对得上`
                      : customDiff > 0
                        ? `比总额多了 ${formatMoney(customDiff)}`
                        : `比总额少了 ${formatMoney(-customDiff)}`}
                  </p>
                ) : (
                  <p className="text-xs text-muted">每个人填自己那一份，加起来要等于总价。</p>
                )}
              </ul>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="expense-photos">照片证明</Label>
            <ExpensePhotoPicker
              photos={photos}
              disabled={pending}
              pending={photoBusy}
              onPickFiles={(files) => void onPickFiles(files)}
              onRemove={onRemovePhoto}
            />
          </div>

          {error && <p className="text-sm text-owe">{error}</p>}

          <Button
            type="submit"
            className="h-12 w-full rounded-lg text-base"
            disabled={pending || photoBusy}
          >
            {pending ? "记账中…" : photoBusy ? "处理照片…" : "记入账单"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ModeButton({
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
      className={cn(
        "h-8 flex-1 rounded-full text-xs font-medium transition-colors",
        active ? "bg-surface text-fg shadow-card" : "text-muted hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}
