import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import {
  FX_ENDPOINT,
  FX_PROVIDER,
  actualFxRate,
  decimalFromNumber,
  isForeignCurrency,
  normalizeDecimal,
  sameQuoteTime,
  toCnyCents,
  type CurrencyCode,
  type ForeignCurrency,
} from "./fx.mjs";
import type { Expense, ExpenseFx } from "./types";

export type FxBooking = {
  currency: CurrencyCode;
  amountCents: number;
  originalMinor: number | null;
  fxMidRate: string | null;
  fxFeeRate: string | null;
  fxRate: string | null;
  fxQuotedAt: string | null;
  fxCached: boolean;
  fxCachedAt: string | null;
};

export type FxBookingInput = {
  currency?: CurrencyCode;
  amountCents: number;
  originalMinor?: number;
  fxMidRate?: string;
  fxQuotedAt?: string;
  fxCached?: boolean;
  fxFeeRate?: string;
};

type CacheQuote = {
  midRate: string;
  quotedAt: string;
  cachedAt: string;
  source: string;
};

function toIso(value: unknown): string | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function failMessage(err: unknown): string {
  if (err instanceof Error && err.message.startsWith("实时汇率获取失败")) return err.message;
  return "实时汇率获取失败";
}

async function fetchCnyMid(
  currency: ForeignCurrency,
): Promise<{ midRate: string; quotedAt: string }> {
  let response: Response;
  try {
    response = await fetch(`${FX_ENDPOINT}${currency}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    throw new Error("实时汇率获取失败，网络连不上汇率接口");
  }
  if (!response.ok) {
    throw new Error(`实时汇率获取失败（HTTP ${response.status}）`);
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error("实时汇率获取失败，接口没有返回有效数据");
  }
  if (!body || typeof body !== "object") {
    throw new Error("实时汇率获取失败，接口没有返回有效数据");
  }
  const record = body as {
    result?: unknown;
    base_code?: unknown;
    rates?: { CNY?: unknown };
    time_last_update_unix?: unknown;
  };
  if (record.result !== "success" || record.base_code !== currency) {
    throw new Error("实时汇率获取失败，接口未返回成功结果");
  }
  const raw = record.rates?.CNY;
  const midRate =
    typeof raw === "number"
      ? decimalFromNumber(raw)
      : typeof raw === "string"
        ? normalizeDecimal(raw)
        : null;
  if (!midRate) throw new Error("实时汇率获取失败，没有兑人民币的价格");
  if (
    typeof record.time_last_update_unix !== "number" ||
    !Number.isFinite(record.time_last_update_unix)
  ) {
    throw new Error("实时汇率获取失败，没有取价时间");
  }
  return { midRate, quotedAt: new Date(record.time_last_update_unix * 1000).toISOString() };
}

async function readCache(sql: Sql, currency: ForeignCurrency): Promise<CacheQuote | null> {
  const rows = await sql<{
    mid_rate: string;
    quoted_at: unknown;
    fetched_at: unknown;
    source: string;
  }>`
    select mid_rate::text as mid_rate, quoted_at, fetched_at, source
    from fx_rate_cache
    where currency = ${currency}
    limit 1
  `;
  const row = rows[0];
  if (!row) return null;
  const midRate = normalizeDecimal(row.mid_rate);
  const quotedAt = toIso(row.quoted_at);
  const cachedAt = toIso(row.fetched_at);
  if (!midRate || !quotedAt || !cachedAt) return null;
  return { midRate, quotedAt, cachedAt, source: row.source };
}

async function writeCache(
  sql: Sql,
  currency: ForeignCurrency,
  quote: { midRate: string; quotedAt: string },
) {
  await sql`
    insert into fx_rate_cache (currency, mid_rate, quoted_at, fetched_at, source)
    values (${currency}, ${quote.midRate}, ${quote.quotedAt}, now(), ${FX_PROVIDER})
    on conflict (currency) do update
      set mid_rate = excluded.mid_rate,
          quoted_at = excluded.quoted_at,
          fetched_at = now(),
          source = excluded.source
  `;
}

const quoteSchema = z.object({
  currency: z.enum(["AUD", "NZD", "VND"]),
});

export const getFxQuote = createServerFn({ method: "GET" })
  .validator((data: unknown) => quoteSchema.parse(data))
  .handler(async ({ data }) => {
    const sql = await getSql();
    try {
      const live = await fetchCnyMid(data.currency);
      try {
        await writeCache(sql, data.currency, live);
      } catch {
        const cache = await readCache(sql, data.currency).catch(() => null);
        return {
          ok: false as const,
          currency: data.currency,
          error: "实时汇率获取失败，这次的价格没有存下来",
          cache,
        };
      }
      return {
        ok: true as const,
        currency: data.currency,
        midRate: live.midRate,
        quotedAt: live.quotedAt,
        source: FX_PROVIDER,
      };
    } catch (err) {
      const cache = await readCache(sql, data.currency).catch(() => null);
      return {
        ok: false as const,
        currency: data.currency,
        error: failMessage(err),
        cache,
      };
    }
  });

export function bookingFromDb(row: {
  amount_cents: number;
  currency?: string | null;
  original_minor?: number | null;
  fx_mid_rate?: string | null;
  fx_fee_rate?: string | null;
  fx_rate?: string | null;
  fx_quoted_at?: unknown;
  fx_cached?: boolean | null;
  fx_cached_at?: unknown;
}): FxBooking {
  const currency =
    row.currency === "AUD" || row.currency === "NZD" || row.currency === "VND"
      ? row.currency
      : "CNY";
  if (currency === "CNY") return cnyBooking(Number(row.amount_cents));
  return {
    currency,
    amountCents: Number(row.amount_cents),
    originalMinor: row.original_minor == null ? null : Number(row.original_minor),
    fxMidRate: normalizeDecimal(row.fx_mid_rate),
    fxFeeRate: normalizeDecimal(row.fx_fee_rate, { allowZero: true }),
    fxRate: normalizeDecimal(row.fx_rate),
    fxQuotedAt: toIso(row.fx_quoted_at),
    fxCached: Boolean(row.fx_cached),
    fxCachedAt: toIso(row.fx_cached_at),
  };
}

export function expenseMoneyFromBooking(
  booking: FxBooking,
): Pick<Expense, "currency" | "originalMinor" | "fx"> {
  if (
    booking.currency === "CNY" ||
    booking.originalMinor == null ||
    !booking.fxMidRate ||
    booking.fxFeeRate == null ||
    !booking.fxRate ||
    !booking.fxQuotedAt
  ) {
    return { currency: "CNY" };
  }
  const fx: ExpenseFx = {
    midRate: booking.fxMidRate,
    feeRate: booking.fxFeeRate,
    rate: booking.fxRate,
    quotedAt: booking.fxQuotedAt,
    cached: booking.fxCached,
    cachedAt: booking.fxCachedAt,
  };
  return { currency: booking.currency, originalMinor: booking.originalMinor, fx };
}

function cnyBooking(amountCents: number): FxBooking {
  return {
    currency: "CNY",
    amountCents,
    originalMinor: null,
    fxMidRate: null,
    fxFeeRate: null,
    fxRate: null,
    fxQuotedAt: null,
    fxCached: false,
    fxCachedAt: null,
  };
}

function sameBooking(existing: FxBooking, input: FxBookingInput): boolean {
  if (existing.currency === "CNY" || !isForeignCurrency(existing.currency)) return false;
  if (input.currency !== existing.currency) return false;
  if (input.originalMinor !== existing.originalMinor) return false;
  if (input.amountCents !== existing.amountCents) return false;
  const mid = normalizeDecimal(input.fxMidRate ?? "");
  const fee = normalizeDecimal(input.fxFeeRate ?? "", { allowZero: true });
  const storedFee = normalizeDecimal(existing.fxFeeRate ?? "", { allowZero: true });
  if (!mid || mid !== existing.fxMidRate || fee == null || fee !== storedFee) return false;
  if (
    !input.fxQuotedAt ||
    !existing.fxQuotedAt ||
    !sameQuoteTime(input.fxQuotedAt, existing.fxQuotedAt)
  ) {
    return false;
  }
  return true;
}

/** CNY amount for a new or edited bill. Foreign rates must match the last stored quote. */
export async function resolveFxBooking(
  sql: Sql,
  groupFeeRate: string,
  input: FxBookingInput,
  existing?: FxBooking | null,
): Promise<FxBooking> {
  const currency = input.currency ?? "CNY";
  if (currency === "CNY") {
    if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
      throw new Error("请输入有效金额");
    }
    return cnyBooking(input.amountCents);
  }
  if (!isForeignCurrency(currency)) throw new Error("不支持这个币种");
  if (existing && sameBooking(existing, input)) return existing;

  const originalMinor = input.originalMinor;
  if (originalMinor == null || !Number.isInteger(originalMinor) || originalMinor <= 0) {
    throw new Error(currency === "VND" ? "越南盾请填整数" : "请输入有效金额");
  }
  const fee = normalizeDecimal(groupFeeRate, { allowZero: true });
  if (fee == null) throw new Error("群组手续费无效");
  const submittedFee = normalizeDecimal(input.fxFeeRate ?? "", { allowZero: true });
  if (submittedFee !== fee) throw new Error("手续费刚被改过，请再看一眼汇率");

  const cache = await readCache(sql, currency);
  if (!cache) throw new Error("还没有汇率。请先获取实时汇率，或稍后再试");
  const mid = normalizeDecimal(input.fxMidRate ?? "");
  if (
    !mid ||
    mid !== cache.midRate ||
    !input.fxQuotedAt ||
    !sameQuoteTime(input.fxQuotedAt, cache.quotedAt)
  ) {
    throw new Error("汇率对不上，请重新获取后再记");
  }
  const rate = actualFxRate(cache.midRate, fee);
  if (!rate) throw new Error("算不出实际汇率");
  const cents = toCnyCents(originalMinor, currency, rate);
  if (cents == null) throw new Error("折成人民币后金额无效");
  if (cents !== input.amountCents) throw new Error("折合人民币和汇率对不上，请再记一次");
  const cached = Boolean(input.fxCached);
  return {
    currency,
    amountCents: cents,
    originalMinor,
    fxMidRate: cache.midRate,
    fxFeeRate: fee,
    fxRate: rate,
    fxQuotedAt: cache.quotedAt,
    fxCached: cached,
    fxCachedAt: cached ? cache.cachedAt : null,
  };
}
