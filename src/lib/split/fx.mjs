/** Foreign currencies that convert into the CNY ledger. */
export const FX_CURRENCIES = ["AUD", "NZD", "VND"];

export const DEFAULT_FX_FEE_RATE = "0.005";

/** Keyless public rates. The open endpoint includes VND, which ECB/Frankfurter do not. */
export const FX_PROVIDER = "ExchangeRate-API";
export const FX_ENDPOINT = "https://open.er-api.com/v6/latest/";

const LABELS = {
  CNY: "人民币",
  AUD: "澳元",
  NZD: "新西兰元",
  VND: "越南盾",
};

const SYMBOLS = {
  CNY: "¥",
  AUD: "A$",
  NZD: "NZ$",
  VND: "₫",
};

export function isForeignCurrency(code) {
  return code === "AUD" || code === "NZD" || code === "VND";
}

export function currencyDecimals(code) {
  return code === "VND" ? 0 : 2;
}

export function currencyLabel(code) {
  return LABELS[code] ?? code;
}

export function currencySymbol(code) {
  return SYMBOLS[code] ?? "";
}

function parseDecimal(raw) {
  const text = String(raw ?? "").trim();
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const [whole, frac = ""] = text.split(".");
  const digits = `${whole}${frac}`.replace(/^0+(?=\d)/, "");
  return { int: BigInt(digits), scale: frac.length };
}

function formatDecimal(dec) {
  const digits = dec.int.toString().padStart(dec.scale + 1, "0");
  if (dec.scale === 0) return digits;
  const cut = digits.length - dec.scale;
  const whole = digits.slice(0, cut);
  const frac = digits.slice(cut).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole;
}

function cmpDec(a, b) {
  const scale = Math.max(a.scale, b.scale);
  const ai = a.int * 10n ** BigInt(scale - a.scale);
  const bi = b.int * 10n ** BigInt(scale - b.scale);
  if (ai < bi) return -1;
  if (ai > bi) return 1;
  return 0;
}

function mulDec(a, b) {
  return { int: a.int * b.int, scale: a.scale + b.scale };
}

/** Positive decimal, or "0" when allowZero. Trailing zeros are stripped. */
export function normalizeDecimal(raw, opts) {
  const allowZero = Boolean(opts?.allowZero);
  const dec = parseDecimal(raw);
  if (!dec) return null;
  if (dec.int === 0n) return allowZero ? "0" : null;
  if (dec.int < 0n) return null;
  return formatDecimal(dec);
}

/** Turn a JSON number from the rate API into a stable decimal string. */
export function decimalFromNumber(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return normalizeDecimal(value.toFixed(10));
}

/**
 * Actual rate = mid × (1 + fee). Fee is a ratio such as "0.005", not a percent.
 * Returns a decimal string.
 */
export function actualFxRate(midRate, feeRate) {
  const mid = parseDecimal(midRate);
  const fee = parseDecimal(feeRate);
  if (!mid || mid.int <= 0n || !fee) return null;
  const factor = { int: 10n ** BigInt(fee.scale) + fee.int, scale: fee.scale };
  return formatDecimal(mulDec(mid, factor));
}

/** "0.005" → "0.5". */
export function formatFeePercent(feeRate) {
  const fee = parseDecimal(feeRate);
  if (!fee) return null;
  if (fee.int === 0n) return "0";
  return formatDecimal(mulDec(fee, { int: 100n, scale: 0 }));
}

/** Percent text ("0.5" or "0.5%") → fee ratio "0.005". Allows 0 through 10, two decimals. */
export function parseFeePercent(raw) {
  const text = String(raw ?? "")
    .trim()
    .replace(/%/g, "")
    .trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const dec = parseDecimal(text);
  if (!dec) return null;
  if (cmpDec(dec, { int: 10n, scale: 0 }) > 0) return null;
  if (dec.int === 0n) return "0";
  return formatDecimal({ int: dec.int, scale: dec.scale + 2 });
}

/**
 * Minor units: cents for AUD/NZD/CNY, whole dong for VND.
 * Returns null when the text is empty, zero, or has the wrong precision.
 */
export function parseCurrencyAmount(raw, currency) {
  let cleaned = String(raw ?? "").trim();
  if (!cleaned) return null;
  cleaned = cleaned.replace(/[¥￥₫,\s]/g, "").replace(/A\$|NZ\$/g, "");
  if (currency === "VND") {
    if (!/^\d+$/.test(cleaned)) return null;
    const n = Number(cleaned);
    if (!Number.isSafeInteger(n) || n <= 0 || n > 2_000_000_000) return null;
    return n;
  }
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  const minor = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  if (!Number.isSafeInteger(minor) || minor <= 0 || minor > 2_000_000_000) return null;
  return minor;
}

export function formatCurrencyAmount(currency, minor) {
  if (!Number.isInteger(minor)) return "";
  if (currency === "VND") {
    const grouped = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 }).format(minor);
    return `₫${grouped}`;
  }
  const negative = minor < 0;
  const abs = Math.abs(minor);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, "0");
  const grouped = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 }).format(whole);
  return `${negative ? "-" : ""}${currencySymbol(currency)}${grouped}.${frac}`;
}

/** "1 AUD = 4.741116645 CNY" */
export function formatFxPair(currency, rate) {
  return `1 ${currency} = ${rate} CNY`;
}

/** CNY cents from an original minor amount and a CNY-per-unit rate. Half-up. */
export function toCnyCents(originalMinor, currency, rateStr) {
  if (!Number.isInteger(originalMinor) || originalMinor <= 0) return null;
  const rate = parseDecimal(rateStr);
  if (!rate || rate.int <= 0n) return null;
  const decimals = currencyDecimals(currency);
  const numer = BigInt(originalMinor) * rate.int * 100n;
  const denom = 10n ** BigInt(decimals + rate.scale);
  const cents = (numer + denom / 2n) / denom;
  const n = Number(cents);
  if (!Number.isSafeInteger(n) || n <= 0) return null;
  return n;
}

export function sameQuoteTime(a, b) {
  const left = new Date(a).getTime();
  const right = new Date(b).getTime();
  return Number.isFinite(left) && left === right;
}

/** One line for edit history. */
export function formatFxSnapshot(input) {
  const currency = input.currency ?? "CNY";
  if (!isForeignCurrency(currency) || !input.fx || input.originalMinor == null) {
    const cents = input.amountCents ?? input.originalMinor ?? 0;
    return `人民币 ${formatCurrencyAmount("CNY", cents)}`;
  }
  const percent = formatFeePercent(input.fx.feeRate) ?? input.fx.feeRate;
  return `${currencyLabel(currency)} ${formatCurrencyAmount(currency, input.originalMinor)}，中间价 ${input.fx.midRate}，手续费 ${percent}%，实际 ${input.fx.rate}`;
}
