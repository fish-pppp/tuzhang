import { useEffect, useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";
import { FxFacts } from "@/components/fx-facts";
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
import { formatStamp } from "@/lib/split/date";
import { getFxQuote } from "@/lib/split/fx-api";
import {
  DEFAULT_FX_FEE_RATE,
  actualFxRate,
  allocateByWeights,
  currencyLabel,
  currencySymbol,
  formatCurrencyAmount,
  formatCurrencyInput,
  isForeignCurrency,
  parseCurrencyAmount,
  toCnyCents,
  type CurrencyCode,
} from "@/lib/split/fx.mjs";
import { formatMoney, newId } from "@/lib/split/money";
import {
  compressExpensePhoto,
  MAX_EXPENSE_PHOTOS,
  normalizeExpensePhotos,
} from "@/lib/split/photo";
import { customAmountInputs, normalizeExpenseShares, splitShares } from "@/lib/split/shares";
import type { Expense, ExpensePhoto, ExpenseShare, Trip } from "@/lib/split/types";
import { cn } from "@/lib/utils";

type SplitMode = "equal" | "custom";
type CurrencyOption = CurrencyCode;

const CURRENCY_OPTIONS: CurrencyOption[] = ["CNY", "AUD", "NZD", "VND"];

type ShownQuote = {
  midRate: string;
  quotedAt: string;
  cached: boolean;
  cachedAt: string | null;
};

type SplitBasis = { currency: CurrencyOption; minor: number };

type LoadedCustom = {
  currency: CurrencyOption;
  minor: number;
  amountCents: number;
  participantKey: string;
  texts: Record<string, string>;
  shares: ExpenseShare[];
};

function formatMinor(currency: string, minor: number): string {
  return isForeignCurrency(currency) ? formatCurrencyAmount(currency, minor) : formatMoney(minor);
}

function currencyFieldClass(currency: string): { box: string; input: string } {
  if (currency === "NZD") return { box: "w-36", input: "pl-12" };
  if (currency === "AUD") return { box: "w-32", input: "pl-9" };
  if (currency === "VND") return { box: "w-36", input: "pl-7" };
  return { box: "w-28", input: "pl-6" };
}

export function AddExpenseDialog({
  open,
  onOpenChange,
  trip,
  defaultPayerId,
  onAdd,
  onUploadPhoto,
  onDiscardPhotos,
  initialExpense,
  fxFeeRate = DEFAULT_FX_FEE_RATE,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trip: Trip;
  defaultPayerId?: string | null;
  onAdd: (
    input: Omit<
      Expense,
      "id" | "createdAt" | "createdBy" | "deletedAt" | "deletedBy" | "deleteReason" | "settlementId"
    >,
  ) => void | Promise<void>;
  onUploadPhoto?: (base64: string) => Promise<ExpensePhoto>;
  onDiscardPhotos?: (ids: string[]) => void | Promise<void>;
  /** Set to edit an existing bill instead of creating one. Photos stay as they are. */
  initialExpense?: Expense | null;
  /** Group bank fee ratio. Defaults to 0.5%. */
  fxFeeRate?: string;
}) {
  const fallbackPayer = defaultPayerId ?? trip.members[0]?.id ?? "";
  const [title, setTitle] = useState("");
  const [currency, setCurrency] = useState<CurrencyOption>("CNY");
  const [amount, setAmount] = useState("");
  const [liveQuote, setLiveQuote] = useState<ShownQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteCache, setQuoteCache] = useState<ShownQuote | null>(null);
  const [acceptCache, setAcceptCache] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const splitBasis = useRef<SplitBasis | null>(null);
  const loadedCustom = useRef<LoadedCustom | null>(null);
  const [payerId, setPayerId] = useState(fallbackPayer);
  const [participantIds, setParticipantIds] = useState<string[]>(trip.members.map((m) => m.id));
  const [splitMode, setSplitMode] = useState<SplitMode>("equal");
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [photos, setPhotos] = useState<ExpensePhoto[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const photosRef = useRef<ExpensePhoto[]>([]);
  const submittedRef = useRef(false);
  const formReady = useRef(false);
  const editing = Boolean(initialExpense);
  photosRef.current = photos;

  function fillEqualCustom(ids: string[], minor: number | null) {
    if (minor == null || ids.length === 0) {
      splitBasis.current = null;
      setCustomAmounts(Object.fromEntries(ids.map((id) => [id, ""])));
      return;
    }
    splitBasis.current = { currency, minor };
    const parts = splitShares(minor, ids.length);
    const next: Record<string, string> = {};
    ids.forEach((id, index) => {
      next[id] = formatCurrencyInput(currency, parts[index] ?? 0);
    });
    setCustomAmounts(next);
  }

  function amountText(expense: Expense): string {
    const code = expense.currency ?? "CNY";
    if (isForeignCurrency(code) && expense.originalMinor != null) {
      return code === "VND"
        ? String(expense.originalMinor)
        : (expense.originalMinor / 100).toFixed(2);
    }
    return (expense.amountCents / 100).toFixed(2);
  }

  useEffect(() => {
    if (!open) {
      formReady.current = false;
      return;
    }
    if (formReady.current) return;
    formReady.current = true;
    submittedRef.current = false;
    setError(null);
    setPending(false);
    setPhotoBusy(false);
    setPhotos([]);
    setLiveQuote(null);
    setQuoteError(null);
    setQuoteCache(null);
    setAcceptCache(false);
    setQuoteLoading(false);
    if (initialExpense) {
      const memberIds = new Set(trip.members.map((member) => member.id));
      const ids = initialExpense.participantIds.filter((id) => memberIds.has(id));
      setTitle(initialExpense.title);
      setCurrency(initialExpense.currency ?? "CNY");
      setAmount(amountText(initialExpense));
      setPayerId(
        memberIds.has(initialExpense.payerId)
          ? initialExpense.payerId
          : (defaultPayerId ?? trip.members[0]?.id ?? ""),
      );
      const activeIds = ids.length > 0 ? ids : trip.members.map((member) => member.id);
      setParticipantIds(activeIds);
      if (initialExpense.shares && initialExpense.shares.length > 0) {
        setSplitMode("custom");
        const code = (initialExpense.currency ?? "CNY") as CurrencyOption;
        const texts = customAmountInputs({ ...initialExpense, participantIds: activeIds });
        setCustomAmounts(texts);
        const minor = isForeignCurrency(code)
          ? (initialExpense.originalMinor ?? null)
          : initialExpense.amountCents;
        splitBasis.current = minor == null ? null : { currency: code, minor };
        const keptShares = initialExpense.shares.filter((share) =>
          activeIds.includes(share.memberId),
        );
        loadedCustom.current =
          minor == null
            ? null
            : {
                currency: code,
                minor,
                amountCents: initialExpense.amountCents,
                participantKey: [...activeIds].sort().join("\0"),
                texts,
                shares: keptShares,
              };
      } else {
        setSplitMode("equal");
        setCustomAmounts({});
        splitBasis.current = null;
        loadedCustom.current = null;
      }
      return;
    }
    const ids = trip.members.map((m) => m.id);
    setPayerId(defaultPayerId ?? trip.members[0]?.id ?? "");
    setParticipantIds(ids);
    setTitle("");
    setCurrency("CNY");
    setAmount("");
    splitBasis.current = null;
    loadedCustom.current = null;
    setSplitMode("equal");
    setCustomAmounts({});
  }, [open, defaultPayerId, initialExpense, trip.members]);

  const originalMinor = parseCurrencyAmount(amount, currency);
  const initialCurrency = initialExpense?.currency ?? "CNY";
  const reuseStored = Boolean(
    editing &&
    initialExpense &&
    currency === initialCurrency &&
    originalMinor != null &&
    (currency === "CNY"
      ? originalMinor === initialExpense.amountCents
      : originalMinor === initialExpense.originalMinor && initialExpense.fx),
  );
  const storedQuote: ShownQuote | null =
    reuseStored && initialExpense?.fx
      ? {
          midRate: initialExpense.fx.midRate,
          quotedAt: initialExpense.fx.quotedAt,
          cached: initialExpense.fx.cached,
          cachedAt: initialExpense.fx.cachedAt ?? null,
        }
      : null;
  const activeQuote: ShownQuote | null = storedQuote
    ? storedQuote
    : acceptCache && quoteCache
      ? { ...quoteCache, cached: true }
      : liveQuote;
  const shownFee = reuseStored && initialExpense?.fx ? initialExpense.fx.feeRate : fxFeeRate;
  const shownRate =
    reuseStored && initialExpense?.fx
      ? initialExpense.fx.rate
      : activeQuote
        ? actualFxRate(activeQuote.midRate, shownFee)
        : null;
  const amountCents =
    currency === "CNY"
      ? originalMinor
      : reuseStored && initialExpense
        ? initialExpense.amountCents
        : originalMinor != null && shownRate
          ? toCnyCents(originalMinor, currency, shownRate)
          : null;

  useEffect(() => {
    if (!open || currency === "CNY") return;
    let cancelled = false;
    setLiveQuote(null);
    setQuoteError(null);
    setQuoteCache(null);
    setAcceptCache(false);
    setQuoteLoading(true);
    void getFxQuote({ data: { currency } })
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setLiveQuote({
            midRate: result.midRate,
            quotedAt: result.quotedAt,
            cached: false,
            cachedAt: null,
          });
          setQuoteError(null);
          setQuoteCache(null);
        } else {
          setLiveQuote(null);
          setQuoteError(result.error);
          setQuoteCache(
            result.cache
              ? {
                  midRate: result.cache.midRate,
                  quotedAt: result.cache.quotedAt,
                  cached: true,
                  cachedAt: result.cache.cachedAt,
                }
              : null,
          );
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLiveQuote(null);
        setQuoteError(err instanceof Error ? err.message : "实时汇率获取失败");
        setQuoteCache(null);
      })
      .finally(() => {
        if (!cancelled) setQuoteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, currency]);

  useEffect(() => {
    if (!open || splitMode !== "custom" || originalMinor == null) return;
    const basis = splitBasis.current;
    if (basis && basis.currency === currency && basis.minor === originalMinor) return;
    if (basis && basis.currency === currency) {
      let total = 0;
      let complete = true;
      for (const id of participantIds) {
        const minor = parseCurrencyAmount(customAmounts[id] ?? "", currency, { allowZero: true });
        if (minor == null) {
          complete = false;
          break;
        }
        total += minor;
      }
      if (!complete || total !== basis.minor) return;
    }
    fillEqualCustom(participantIds, originalMinor);
    // Refill when the bill currency or original total changes, not on each keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, splitMode, currency, originalMinor]);

  const allSelected = participantIds.length === trip.members.length;
  const perHead = useMemo(() => {
    if (!amountCents || participantIds.length === 0) return null;
    return amountCents / participantIds.length;
  }, [amountCents, participantIds.length]);

  const customShares = useMemo(() => {
    if (splitMode !== "custom") return null;
    const foreign = isForeignCurrency(currency);
    const shares: ExpenseShare[] = [];
    for (const id of participantIds) {
      const minor = parseCurrencyAmount(customAmounts[id] ?? "", currency, { allowZero: true });
      if (minor == null) return null;
      shares.push(
        foreign ? { memberId: id, cents: 0, originalMinor: minor } : { memberId: id, cents: minor },
      );
    }
    return shares;
  }, [customAmounts, participantIds, splitMode, currency]);

  const customTotal =
    customShares?.reduce((sum, share) => sum + (share.originalMinor ?? share.cents), 0) ?? null;
  const customDiff =
    originalMinor != null && customTotal != null ? customTotal - originalMinor : null;
  const customPreviewCents = useMemo(() => {
    if (!isForeignCurrency(currency) || amountCents == null || !customShares || customDiff !== 0) {
      return null;
    }
    const loaded = loadedCustom.current;
    const textsMatch = Boolean(
      loaded &&
      loaded.currency === currency &&
      loaded.amountCents === amountCents &&
      loaded.minor === originalMinor &&
      [...participantIds].sort().join("\0") === loaded.participantKey &&
      participantIds.every((id) => (customAmounts[id] ?? "") === (loaded.texts[id] ?? "")),
    );
    if (textsMatch && loaded) {
      const stored: Record<string, number> = {};
      for (const share of loaded.shares) stored[share.memberId] = share.cents;
      if (participantIds.every((id) => stored[id] != null)) return stored;
    }
    const parts = allocateByWeights(
      amountCents,
      customShares.map((share) => share.originalMinor ?? 0),
    );
    const preview: Record<string, number> = {};
    customShares.forEach((share, index) => {
      preview[share.memberId] = parts[index] ?? 0;
    });
    return preview;
  }, [
    currency,
    amountCents,
    customShares,
    customDiff,
    originalMinor,
    participantIds,
    customAmounts,
  ]);

  function resetForm() {
    setTitle("");
    setCurrency("CNY");
    setAmount("");
    setLiveQuote(null);
    setQuoteError(null);
    setQuoteCache(null);
    setAcceptCache(false);
    setQuoteLoading(false);
    splitBasis.current = null;
    loadedCustom.current = null;
    setPayerId(defaultPayerId ?? trip.members[0]?.id ?? "");
    setParticipantIds(trip.members.map((m) => m.id));
    setSplitMode("equal");
    setCustomAmounts({});
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
      if (splitMode === "custom") fillEqualCustom(next, originalMinor);
      return next;
    });
  }

  function unchangedCustomShares(cents: number): ExpenseShare[] | null {
    const loaded = loadedCustom.current;
    if (!loaded || loaded.currency !== currency || loaded.amountCents !== cents) return null;
    if (originalMinor == null || loaded.minor !== originalMinor) return null;
    const key = [...participantIds].sort().join("\0");
    if (key !== loaded.participantKey) return null;
    for (const id of participantIds) {
      if ((customAmounts[id] ?? "") !== (loaded.texts[id] ?? "")) return null;
    }
    const byId = new Map(loaded.shares.map((share) => [share.memberId, share]));
    if (participantIds.some((id) => !byId.has(id))) return null;
    return participantIds.map((id) => byId.get(id)!);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (currency === "VND" && amount.trim() && originalMinor == null) {
      setError("越南盾请填整数");
      return;
    }
    if (isForeignCurrency(currency) && !activeQuote) {
      setError(quoteError ?? "请先等实时汇率出来，或使用上次成功的缓存");
      return;
    }
    const cents = amountCents;
    if (!cents) {
      setError(currency === "VND" ? "越南盾请填整数" : "请输入有效金额");
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
    if (splitMode === "custom") {
      const kept = unchangedCustomShares(cents);
      const source = kept ?? customShares;
      if (!source) {
        setError(currency === "VND" ? "请按越南盾填写每个人的整数金额" : "请给每个人填写有效金额");
        return;
      }
      try {
        shares = normalizeExpenseShares({
          participantIds,
          amountCents: cents,
          currency,
          originalMinor: isForeignCurrency(currency) ? originalMinor : null,
          shares: source,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "分摊金额不对");
        return;
      }
    }
    setPending(true);
    try {
      const attached = normalizeExpensePhotos(photos);
      await onAdd({
        title: title.trim() || "未命名支出",
        amountCents: cents,
        currency,
        ...(isForeignCurrency(currency) && activeQuote && shownRate && originalMinor != null
          ? {
              originalMinor,
              fx: {
                midRate: activeQuote.midRate,
                feeRate: shownFee,
                rate: shownRate,
                quotedAt: activeQuote.quotedAt,
                cached: activeQuote.cached,
                cachedAt: activeQuote.cachedAt,
              },
            }
          : {}),
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
          <DialogTitle>{editing ? "修改账单" : "记一笔"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "改金额、标题、付款人或分摊。保存后会记下改前改后。"
              : "谁先垫了钱。可以平均 AA，也可以按人填不同的价。小票可以附多张照片。"}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => void onSubmit(e)}
          className="flex min-h-0 flex-col gap-5 overflow-y-auto"
        >
          <div className="space-y-2">
            <Label htmlFor="amount">金额</Label>
            <div className="flex flex-wrap gap-1.5">
              {CURRENCY_OPTIONS.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => {
                    setCurrency(code);
                    setError(null);
                    setAcceptCache(false);
                  }}
                  className={cn(
                    "h-8 rounded-full px-3 text-xs font-medium",
                    currency === code ? "bg-primary text-primary-fg" : "bg-chip text-muted",
                  )}
                >
                  {currencyLabel(code)}
                </button>
              ))}
            </div>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 font-display text-xl text-muted">
                {currencySymbol(currency)}
              </span>
              <Input
                id="amount"
                inputMode={currency === "VND" ? "numeric" : "decimal"}
                placeholder={currency === "VND" ? "0" : "0.00"}
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError(null);
                }}
                className={cn(
                  "h-14 font-display text-2xl tabular-nums",
                  currency === "NZD" ? "pl-14" : currency === "AUD" ? "pl-12" : "pl-8",
                )}
                autoFocus
              />
            </div>
            {isForeignCurrency(currency) ? (
              <FxPreview
                currency={currency}
                loading={quoteLoading && !storedQuote}
                error={storedQuote ? null : quoteError}
                cache={quoteCache}
                quote={activeQuote}
                feeRate={shownFee}
                rate={shownRate}
                amountCents={amountCents}
                onUseCache={() => {
                  setAcceptCache(true);
                  setError(null);
                }}
              />
            ) : null}
            {splitMode === "equal" && perHead != null && (
              <p className="text-xs text-muted tabular-nums">
                {isForeignCurrency(currency) ? "按折合人民币，" : ""}
                {participantIds.length} 人平摊，约 ¥{(perHead / 100).toFixed(2)} / 人
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
                  if (splitMode === "custom") fillEqualCustom(next, originalMinor);
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
                  fillEqualCustom(participantIds, originalMinor);
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
                  const field = currencyFieldClass(currency);
                  const preview = customPreviewCents?.[id];
                  return (
                    <li key={id} className="flex items-center gap-2">
                      <MemberAvatar member={member} size="sm" />
                      <span className="min-w-0 flex-1 truncate text-sm">{member.name}</span>
                      <div className="flex flex-col items-end gap-0.5">
                        <div className={cn("relative", field.box)}>
                          <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs text-muted">
                            {currencySymbol(currency)}
                          </span>
                          <Input
                            inputMode={currency === "VND" ? "numeric" : "decimal"}
                            value={customAmounts[id] ?? ""}
                            onChange={(e) => {
                              setCustomAmounts((prev) => ({ ...prev, [id]: e.target.value }));
                              setError(null);
                            }}
                            className={cn("h-10 tabular-nums", field.input)}
                            placeholder={currency === "VND" ? "0" : "0.00"}
                            aria-label={`${member.name}的${currencyLabel(currency)}金额`}
                          />
                        </div>
                        {preview != null ? (
                          <span className="text-[11px] text-muted tabular-nums">
                            折合 {formatMoney(preview)}
                          </span>
                        ) : null}
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
                      ? `加起来 ${formatMinor(currency, customTotal ?? 0)}${
                          isForeignCurrency(currency) && amountCents != null
                            ? `，折合 ${formatMoney(amountCents)}`
                            : ""
                        }，对得上`
                      : customDiff > 0
                        ? `比总额多了 ${formatMinor(currency, customDiff)}`
                        : `比总额少了 ${formatMinor(currency, -customDiff)}`}
                  </p>
                ) : (
                  <p className="text-xs text-muted">
                    每个人填自己那一份（{currencyLabel(currency)}），加起来要等于总价。
                  </p>
                )}
              </ul>
            ) : null}
          </div>

          {editing ? null : (
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
          )}

          {error && <p className="text-sm text-owe">{error}</p>}

          <Button
            type="submit"
            className="h-12 w-full rounded-lg text-base"
            disabled={pending || photoBusy || (isForeignCurrency(currency) && !activeQuote)}
          >
            {pending
              ? editing
                ? "保存中…"
                : "记账中…"
              : photoBusy
                ? "处理照片…"
                : editing
                  ? "保存修改"
                  : "记入账单"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FxPreview({
  currency,
  loading,
  error,
  cache,
  quote,
  feeRate,
  rate,
  amountCents,
  onUseCache,
}: {
  currency: CurrencyOption;
  loading: boolean;
  error: string | null;
  cache: ShownQuote | null;
  quote: ShownQuote | null;
  feeRate: string;
  rate: string | null;
  amountCents: number | null;
  onUseCache: () => void;
}) {
  if (loading && !quote) {
    return <p className="text-xs text-muted">正在获取实时汇率…</p>;
  }
  return (
    <div className="space-y-1.5 rounded-xl bg-bg-elevated px-3 py-2.5">
      {error ? <p className="text-xs text-owe">{error}</p> : null}
      {error && cache && !quote?.cached ? (
        <button type="button" className="text-xs font-medium text-primary" onClick={onUseCache}>
          使用上次成功的缓存（取价时间 {formatStamp(cache.quotedAt) || cache.quotedAt}，缓存于{" "}
          {formatStamp(cache.cachedAt) || "上次成功"}）
        </button>
      ) : null}
      {quote && rate ? (
        <FxFacts
          currency={currency}
          amountCents={amountCents}
          fx={{
            midRate: quote.midRate,
            feeRate,
            rate,
            quotedAt: quote.quotedAt,
            cached: quote.cached,
            cachedAt: quote.cachedAt,
          }}
        />
      ) : null}
    </div>
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
