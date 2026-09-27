import { formatStamp } from "@/lib/split/date";
import { formatFeePercent, formatFxPair, isForeignCurrency } from "@/lib/split/fx.mjs";
import { formatMoney } from "@/lib/split/money";
import type { ExpenseFx } from "@/lib/split/types";

export function FxFacts({
  currency,
  amountCents,
  fx,
}: {
  currency: string;
  amountCents: number | null;
  fx: ExpenseFx;
}) {
  if (!isForeignCurrency(currency)) return null;
  const percent = formatFeePercent(fx.feeRate) ?? fx.feeRate;
  const quoteLabel = fx.cached ? "缓存中间价" : "实时中间价";
  const quoted = formatStamp(fx.quotedAt) || fx.quotedAt;
  const cached = fx.cached ? formatStamp(fx.cachedAt) || "上次成功" : null;
  return (
    <dl data-fx-facts className="space-y-1 text-xs leading-5 tabular-nums text-muted">
      <div className="flex flex-wrap gap-x-2">
        <dt className="font-medium text-fg">{quoteLabel}</dt>
        <dd>
          {formatFxPair(currency, fx.midRate)}
          <span className="text-subtle"> · 取价时间 {quoted}</span>
          {cached ? <span className="text-subtle"> · 缓存于 {cached}</span> : null}
        </dd>
      </div>
      <div className="flex flex-wrap gap-x-2">
        <dt className="font-medium text-fg">银行换汇手续费</dt>
        <dd>{percent}%</dd>
      </div>
      <div className="flex flex-wrap gap-x-2">
        <dt className="font-medium text-fg">实际使用汇率</dt>
        <dd>{formatFxPair(currency, fx.rate)}</dd>
      </div>
      {amountCents != null && amountCents > 0 ? (
        <div className="flex flex-wrap gap-x-2">
          <dt className="font-medium text-fg">折合人民币</dt>
          <dd>{formatMoney(amountCents)}</dd>
        </div>
      ) : null}
    </dl>
  );
}
