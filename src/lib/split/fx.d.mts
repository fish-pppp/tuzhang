export const FX_CURRENCIES: readonly ["AUD", "NZD", "VND"];
export const DEFAULT_FX_FEE_RATE: "0.005";
export const FX_PROVIDER: string;
export const FX_ENDPOINT: string;

export type ForeignCurrency = "AUD" | "NZD" | "VND";
export type CurrencyCode = "CNY" | ForeignCurrency;

export function isForeignCurrency(code: string): code is ForeignCurrency;
export function currencyDecimals(code: string): number;
export function currencyLabel(code: string): string;
export function currencySymbol(code: string): string;
export function normalizeDecimal(
  raw: unknown,
  opts?: { allowZero?: boolean },
): string | null;
export function decimalFromNumber(value: unknown): string | null;
export function actualFxRate(midRate: string, feeRate: string): string | null;
export function formatFeePercent(feeRate: string): string | null;
export function parseFeePercent(raw: unknown): string | null;
export function parseCurrencyAmount(raw: unknown, currency: string): number | null;
export function formatCurrencyAmount(currency: string, minor: number): string;
export function formatFxPair(currency: string, rate: string): string;
export function toCnyCents(
  originalMinor: number,
  currency: string,
  rateStr: string,
): number | null;
export function sameQuoteTime(a: string, b: string): boolean;
export function formatFxSnapshot(input: {
  currency?: string;
  originalMinor?: number | null;
  amountCents?: number;
  fx?: { midRate: string; feeRate: string; rate: string } | null;
}): string;
